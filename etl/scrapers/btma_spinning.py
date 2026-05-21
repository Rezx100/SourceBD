"""BTMA Spinning-Mills register ingestion (Spec 16).

Reads the curated JSON extraction of the BTMA spinning-mills PDF from
`etl/raw/btma_spinning/pages/page_NN.json` and emits one `ScrapedRecord`
per mill. 528 rows across 4 sections (General Member 371 / Associate
Spinning 65 / Mills Under Suspension 79 / Suspension+Implementation 13).

`source_code='BTMA'` → `tier2_industry` (already mapped in
`etl/core/upsert.py::_TIER_MAP`); default entity_type 'factory' applies.
The existing 4-pass dedup (slug → email → phone → fuzzy name ≥92) auto-
merges BTMA rows onto existing BGMEA / BKMEA / RSC / EPB / cert suppliers.

Dry-run (`--dry-run`) prints a match report without writing to the DB.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, AsyncIterator, Iterable

from etl.core.config import settings
from etl.core.normalize import clean_display_name, make_slug, normalize_phones
from etl.core.scraper import BaseScraper, ScrapedRecord

DEFAULT_DATA_DIR = settings.etl_raw_dir / "btma_spinning" / "pages"

def _is_suspended_section(section: str) -> bool:
    return "suspension" in section.lower() or "implementation" in section.lower()

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_URL_RE = re.compile(r"(?:https?://)?(?:www\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,}[/\w.\-]*", re.IGNORECASE)
# Role parenthetical: "Solaiman Ahmed (MD)" → role = "MD".
_ROLE_PAREN_RE = re.compile(r"^(?P<name>.+?)\s*\((?P<role>[^)]+)\)\s*$")
# Role suffix: "Md. Abul Kalam, MD" → role = "MD". (Only when first contact.)
_ROLE_SUFFIX_RE = re.compile(r"^(?P<name>.+?)\s*,\s*(?P<role>(?:MD|Chairman|Director|CEO|GM|Managing Director|Proprietor)\.?)\s*$", re.IGNORECASE)

_DISTRICTS = {
    # Standard Bangladesh district names — used to extract the trailing
    # district from a mill-site address line like "Sreepur, Gazipur." or
    # "Jamairdia Masterbari, Valuka, Mymensingh.".
    "dhaka", "gazipur", "narayanganj", "narayangonj", "tangail", "munshiganj",
    "manikganj", "narsingdi", "faridpur", "madaripur", "gopalganj", "rajbari",
    "shariatpur", "kishoreganj", "mymensingh", "netrokona", "jamalpur",
    "sherpur", "tangail", "chattogram", "chittagong", "comilla", "cumilla",
    "feni", "brahmanbaria", "chandpur", "lakshmipur", "noakhali",
    "khagrachari", "rangamati", "bandarban", "cox's bazar", "coxs bazar",
    "khulna", "bagerhat", "satkhira", "jessore", "jashore", "magura",
    "narail", "kushtia", "chuadanga", "meherpur", "jhenaidah", "rajshahi",
    "natore", "naogaon", "chapainawabganj", "pabna", "sirajganj", "bogra",
    "bogura", "joypurhat", "rangpur", "dinajpur", "gaibandha", "kurigram",
    "lalmonirhat", "nilphamari", "panchagarh", "thakurgaon", "sylhet",
    "moulvibazar", "habiganj", "sunamganj", "barisal", "barishal", "bhola",
    "patuakhali", "jhalokati", "pirojpur", "barguna",
}

# Reasonable district-to-canonical-city mapping. BTMA mill-sites are in
# rural districts most of the time, so city == district here; we surface
# the district name on both `city` and `district` for filter/search.
_DISTRICT_CANON = {
    "narayangonj": "Narayanganj",
    "chittagong": "Chattogram",
    "cumilla": "Comilla",
    "jashore": "Jessore",
    "bogura": "Bogra",
    "coxs bazar": "Cox's Bazar",
    "barishal": "Barisal",
}


def _slugify_section(section: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", section.lower()).strip("-")
    return s or "unknown"


def _parse_contact(raw: str) -> tuple[str | None, str | None]:
    """Pull a (name, role) tuple from `contact_person`.

    BTMA writes contacts in several shapes:
      "Md. Mukhlesur Rahman"                → ("Md. Mukhlesur Rahman", None)
      "Solaiman Ahmed (MD)"                 → ("Solaiman Ahmed", "MD")
      "Md. Abul Kalam, MD"                  → ("Md. Abul Kalam", "MD")
      "Shadratul Muntaha (MD); Tariqul Islam" → ("Shadratul Muntaha", "MD")
        (the second contact is preserved in payload.raw_contact_person)
    """
    if not raw:
        return None, None
    first = raw.split(";")[0].strip()
    m = _ROLE_PAREN_RE.match(first)
    if m:
        return m.group("name").strip(), m.group("role").strip()
    m = _ROLE_SUFFIX_RE.match(first)
    if m:
        return m.group("name").strip(), m.group("role").strip().rstrip(".")
    return first or None, None


def _split_email_and_website(raw: str) -> tuple[str | None, str | None]:
    """BTMA jams emails and websites into one field; split them out."""
    if not raw:
        return None, None
    emails = _EMAIL_RE.findall(raw)
    email = emails[0].lower() if emails else None
    # Find a www.* / http(s)://* token that is NOT inside an email.
    leftover = _EMAIL_RE.sub(" ", raw)
    urls = _URL_RE.findall(leftover)
    website: str | None = None
    if urls:
        u = urls[0].strip().rstrip(".,;")
        if not u.lower().startswith(("http://", "https://")):
            u = "https://" + u
        website = u
    return email, website


def _detect_district(text: str | None) -> tuple[str | None, str | None]:
    """Return (city, district) by matching the trailing comma-token of a
    mill-site address against the known district set."""
    if not text:
        return None, None
    # Drop trailing punctuation, then walk tokens from the end inward.
    parts = [p.strip().rstrip(".") for p in text.split(",") if p.strip()]
    for token in reversed(parts):
        key = token.lower()
        # Strip a trailing "-1234" postcode if attached: "Sonargaon-1440"
        key_no_post = re.sub(r"-\d+$", "", key).strip()
        if key_no_post in _DISTRICTS:
            canon = _DISTRICT_CANON.get(key_no_post, key_no_post.title())
            return canon, canon
    return None, None


def _btma_status(section: str) -> str | None:
    return "suspended" if _is_suspended_section(section) else None


@dataclass
class _Row:
    sl_no: str
    section: str
    mill_name: str
    contact_person: str
    head_office: str
    mill_site: str
    telephone: str
    fax: str
    email: str
    installed_capacity: str
    annual_production: str
    notes: str

    @classmethod
    def from_json(cls, section: str, raw: dict[str, Any]) -> "_Row":
        def _s(k: str) -> str:
            v = raw.get(k)
            return (v or "").strip() if isinstance(v, str) else ""
        return cls(
            sl_no=_s("sl_no"),
            section=section,
            mill_name=_s("mill_name"),
            contact_person=_s("contact_person"),
            head_office=_s("head_office"),
            mill_site=_s("mill_site"),
            telephone=_s("telephone"),
            fax=_s("fax"),
            email=_s("email"),
            installed_capacity=_s("installed_capacity"),
            annual_production=_s("annual_production"),
            notes=_s("notes"),
        )


def _iter_rows(data_dir: Path) -> Iterable[_Row]:
    """Walk page_NN.json files in lexicographic order, yielding _Row dicts."""
    files = sorted(data_dir.glob("page_*.json"))
    if not files:
        raise FileNotFoundError(
            f"No page_*.json files under {data_dir}. "
            "Stage the BTMA extract there and re-run."
        )
    for f in files:
        page = json.loads(f.read_text(encoding="utf-8"))
        section = (page.get("section") or "").strip()
        for raw in page.get("rows") or []:
            yield _Row.from_json(section, raw)


def _row_to_record(row: _Row) -> ScrapedRecord:
    name = clean_display_name(row.mill_name)
    contact_name, contact_role = _parse_contact(row.contact_person)
    email, website = _split_email_and_website(row.email)
    city, district = _detect_district(row.mill_site)

    # Prefer the mill_site as the canonical address_raw (factory location is
    # what buyers want surfaced). Fall back to head_office when mill_site is
    # blank (rare in this dataset).
    address_raw = row.mill_site or row.head_office or None

    payload: dict[str, Any] = {
        "btma_section": row.section,
        "btma_sl_no": row.sl_no,
    }
    if row.head_office:
        payload["mailing_address"] = row.head_office
    if row.mill_site:
        payload["factory_address"] = row.mill_site
    if row.telephone:
        payload["raw_tel"] = row.telephone
    if row.fax:
        payload["raw_fax"] = row.fax
    if row.email:
        payload["raw_email"] = row.email
    if row.installed_capacity:
        payload["installed_capacity"] = row.installed_capacity
    if row.annual_production:
        payload["annual_production"] = row.annual_production
    if row.notes:
        payload["btma_notes"] = row.notes
    if ";" in row.contact_person:
        payload["raw_contact_person"] = row.contact_person
    status = _btma_status(row.section)
    if status:
        payload["btma_status"] = status

    section_slug = _slugify_section(row.section)

    return ScrapedRecord(
        source_code="BTMA",
        source_ref=f"spinning-{section_slug}-{row.sl_no}",
        company_name=name,
        contact_name=contact_name,
        contact_role=contact_role,
        email=email,
        phone_raw=row.telephone or None,
        address_raw=address_raw,
        city=city,
        district=district,
        website=website,
        payload=payload,
    )


class BtmaSpinningScraper(BaseScraper):
    """BTMA spinning-mills register — local JSON ingest. No HTTP."""

    code = "btma_spinning"
    source_code = "BTMA"

    def __init__(self, data_dir: Path | None = None, *, dry_run: bool = False) -> None:
        super().__init__()
        self.data_dir = data_dir or DEFAULT_DATA_DIR
        self.dry_run = dry_run

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        for row in _iter_rows(self.data_dir):
            if not row.mill_name:
                continue
            yield _row_to_record(row)

    async def run(self) -> dict[str, int]:  # type: ignore[override]
        if self.dry_run:
            return await self._dry_run()
        return await super().run()

    async def _dry_run(self) -> dict[str, int]:
        """Print a match report without writing to the DB."""
        from etl.core.db import db, get_source_id

        section_counts: Counter[str] = Counter()
        status_counts: Counter[str] = Counter()
        slug_hits = 0
        email_hits = 0
        phone_hits = 0
        net_new = 0
        cross_source_overlap: Counter[str] = Counter()
        records: list[ScrapedRecord] = []

        async for rec in self.fetch():
            records.append(rec)
            section_counts[rec.payload.get("btma_section", "")] += 1
            st = rec.payload.get("btma_status")
            if st:
                status_counts[st] += 1

        btma_source_id = get_source_id("BTMA")
        with db.conn() as c, c.cursor() as cur:
            for rec in records:
                slug = make_slug(rec.company_name)
                phones = normalize_phones(rec.phone_raw)
                email = (rec.email or "").strip().lower() or None
                match_id: str | None = None

                cur.execute("select id, source_tags from public.suppliers where slug = %s", (slug,))
                row = cur.fetchone()
                if row:
                    match_id = str(row["id"])
                    slug_hits += 1
                if match_id is None and email:
                    cur.execute("select id, source_tags from public.suppliers where email_primary = %s", (email,))
                    row = cur.fetchone()
                    if row:
                        match_id = str(row["id"])
                        email_hits += 1
                if match_id is None and phones:
                    cur.execute("select id, source_tags from public.suppliers where phones && %s::text[]", (phones,))
                    row = cur.fetchone()
                    if row:
                        match_id = str(row["id"])
                        phone_hits += 1
                if match_id is None:
                    net_new += 1
                    continue
                tags = row["source_tags"] or []
                for tag in tags:
                    if tag and tag != "BTMA":
                        cross_source_overlap[tag] += 1

        self.log.info(
            "btma_spinning.dry_run",
            total=len(records),
            sections=dict(section_counts),
            status=dict(status_counts),
            slug_hits=slug_hits,
            email_hits=email_hits,
            phone_hits=phone_hits,
            net_new=net_new,
            cross_source_overlap=dict(cross_source_overlap),
            btma_source_id=btma_source_id,
        )
        return {
            "seen": len(records),
            "upserted": 0,
            "skipped": 0,
            "slug_hits": slug_hits,
            "email_hits": email_hits,
            "phone_hits": phone_hits,
            "net_new": net_new,
        }
