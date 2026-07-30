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

Transport: local file, wrapped in the acquisition interface. There is no network
transport to replace — what the wrapper adds is provenance the source never had.
Previously a run of this source looked identical whether the extract on disk was
staged this week or a year ago. Now each page file is acquired as its own
document with a path, mtime and content hash, and mirrored to Bunny, so every
mill's fields cite the dated file and page they were read from.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any, AsyncIterator, Iterable

from etl.acquire import AcquireRequest
from etl.acquire.local import path_to_url
from etl.core.acquiring import AcquiringScraper
from etl.core.config import settings
from etl.core.normalize import clean_display_name, make_slug, normalize_phones
from etl.core.scraper import EvidenceAttachment, ScrapedRecord
from etl.evidence.locate import NO_EXCERPT, json_locator, json_record_window

if TYPE_CHECKING:
    from etl.acquire import AcquiredDoc

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


# Both are the register's own bookkeeping — which table a mill was listed under
# and its serial number in that table — rather than facts about the mill.
# `btma_status` is our reading of the section heading, cited via `btma_section`.
_UNCITABLE_FIELDS = ("btma_section", "btma_sl_no", "btma_status")

# Payload key → the JSON field it was read from, for pointer locators.
_JSON_FIELDS = {
    "mailing_address": "head_office",
    "factory_address": "mill_site",
    "raw_tel": "telephone",
    "raw_fax": "fax",
    "raw_email": "email",
    "installed_capacity": "installed_capacity",
    "annual_production": "annual_production",
    "btma_notes": "notes",
    "raw_contact_person": "contact_person",
}


def _row_to_record(
    row: _Row,
    doc: "AcquiredDoc | None" = None,
    raw_page: str | None = None,
) -> ScrapedRecord:
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

    evidence: EvidenceAttachment | None = None
    if doc is not None:
        where = f"rows[sl_no={row.sl_no}]"
        evidence = EvidenceAttachment(
            doc=doc,
            locators={
                key: json_locator(f"{where}/{field}")
                for key, field in _JSON_FIELDS.items()
            },
            default_locator=json_locator(where),
            # Scope the excerpt search to this mill's own entry: capacities and
            # district names repeat across a page, so a page-wide search could
            # cite a neighbouring mill's figure as this one's. When the entry
            # cannot be anchored we keep the locator and forgo the excerpt, since
            # falling back to the page would reintroduce exactly that risk.
            document_text=json_record_window(
                raw_page, json.dumps(row.mill_name)[1:-1]
            )
            or NO_EXCERPT,
            document_is_html=False,
            skip_keys=_UNCITABLE_FIELDS,
        )

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
        evidence=evidence,
    )


class BtmaSpinningScraper(AcquiringScraper):
    """BTMA spinning-mills register — local JSON ingest. No HTTP."""

    code = "btma_spinning"
    source_code = "BTMA"
    transport = "local"
    fallback_transport = None

    def __init__(
        self, data_dir: Path | None = None, *, dry_run: bool = False, **kwargs: Any
    ) -> None:
        super().__init__(**kwargs)
        self.data_dir = data_dir or DEFAULT_DATA_DIR
        self.dry_run = dry_run

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        files = sorted(self.data_dir.glob("page_*.json"))
        if not files:
            raise FileNotFoundError(
                f"No page_*.json files under {self.data_dir}. "
                "Stage the BTMA extract there and re-run."
            )
        # One evidence document per page file rather than per directory, so a
        # claim points at the file its value is actually in and a single
        # re-staged page shows as changed instead of the whole extract.
        for path in files:
            doc = await self.acquire(
                AcquireRequest(url=path_to_url(path), label=f"BTMA {path.name}")
            )
            if not doc.ok:
                raise FileNotFoundError(
                    f"btma_spinning: {path} unreadable "
                    f"({doc.fetch_status.value}: {doc.error_message})"
                )
            raw_page = doc.text()
            page = json.loads(raw_page)
            section = (page.get("section") or "").strip()
            for raw in page.get("rows") or []:
                row = _Row.from_json(section, raw)
                if not row.mill_name:
                    continue
                yield _row_to_record(row, doc, raw_page)

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
