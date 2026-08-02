"""OEKO-TEX Buying Guide scraper (Spec 08 OEKO leg).

OEKO-TEX's certified-company directory is exposed by the public Buying Guide
search at https://services.oeko-tex.com/buying-guide/. The frontend posts a
wrapped body to `/buying-guide/result/` and renders the row table as HTML.

Strategy: for each `oets_standard` (STANDARD 100, LEATHER STANDARD, STeP,
ECO PASSPORT, MIG, DETOX TO ZERO, ORGANIC COTTON), paginate
`ort=397` (Far East) + `land=12` (Bangladesh) with `p_size=50` until
`active_page > ceil(F_COUNT / 50)`. Each row carries a `customer_profile`
URL with an opaque `idx` that we use as the OEKO customer id.

A single company may hold several OEKO-TEX certifications; we model each
(company, oets_standard) pair as a separate row in `public.certifications`
keyed on `certificate_no = "{idx}-{oets_standard}"`, all under
`kind = 'oeko_tex'`.

Transport: direct, wrapped in the acquisition interface.

The plan grouped this source with the Firecrawl set, but the Buying Guide result
endpoint is reached by POSTing a wrapped form body, and Firecrawl's scrape API
only issues GETs — there is no way to express this request through it. Driving
the form with Firecrawl `actions` would also break the second constraint: the
`customer_profile` URLs each row yields are short-lived and bound to the
requesting session, so they must be fetched immediately from the same client
that ran the search. Routing them via Firecrawl's proxy pool would return
"Profile key has expired" instead of contact data.

It still runs through the acquisition layer, so it produces the same evidence
rows, transport badge and admin controls as every other source.
"""
from __future__ import annotations

import asyncio
import math
import re
from typing import AsyncIterator
from urllib.parse import urlencode

from bs4 import BeautifulSoup

from etl.acquire import AcquiredDoc, AcquireRequest
from etl.core.acquiring import AcquiringScraper
from etl.core.config import settings
from etl.core.db import db, get_source_id
from etl.core.scraper import EvidenceAttachment, ScrapedRecord

BASE = "https://services.oeko-tex.com"
RESULT_URL = f"{BASE}/buying-guide/result/"
PROFILE_URL_PREFIX = BASE  # profile hrefs are root-relative

LAND_BANGLADESH = "12"
ORT_FAR_EAST = "397"
PAGE_SIZE = 50
TAB_ID = "1"

OETS_STANDARDS: dict[str, str] = {
    "100":            "OEKO-TEX STANDARD 100",
    "leather":        "OEKO-TEX LEATHER STANDARD",
    "step":           "OEKO-TEX STeP",
    "ecopass":        "OEKO-TEX ECO PASSPORT",
    "mig":            "OEKO-TEX MADE IN GREEN",
    "detox":          "OEKO-TEX DETOX TO ZERO",
    "organic-cotton": "OEKO-TEX ORGANIC COTTON",
}

_F_COUNT_RE = re.compile(r"F_COUNT:\s*(\d+)")
_POSTAL_RE = re.compile(r"^\s*(\d{3,5})\s+(.+?)\s*$")
_POSTAL_TRAIL_RE = re.compile(r"^\s*(.+?)\s*-\s*(\d{3,5})\s*$")
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_URL_RE = re.compile(r"^(?:https?://)?(?:www\.)?[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)+(?:/\S*)?$")

# Polite delay between customer-profile fetches (seconds). The buying-guide
# pages themselves are paginated already; this throttles the per-row profile
# enrichment introduced in migration 0017's companion change (F4b).
PROFILE_DELAY_SECONDS = 0.4


def _build_body(oets: str, page: int) -> str:
    inner = urlencode({
        "searchtext": "",
        "oets_standard": oets,
        "produktstufe": "",
        "produktart": "",
        "verwendungszweck": "",
        "material": "",
        "ort": ORT_FAR_EAST,
        "land": LAND_BANGLADESH,
        "produktanhang": "",
        "produktklasse": "",
    })
    return urlencode({
        "tab_id": TAB_ID,
        "formdata": inner,
        "p_size": str(PAGE_SIZE),
        "active_page": str(page),
        "targetGroup": "",
        "startletter": "",
        "auto_submit": "0",
        "sgs_sort": "",
        "sgs_reverse": "",
        "keep_values": "",
    })


def _parse_city(loc_text: str) -> str | None:
    """Location cell looks like 'Bangladesh\\n 1341 Dhaka' or 'Bangladesh\\n Dhaka - 1341'."""
    parts = [p.strip() for p in loc_text.split("\n") if p.strip()]
    if len(parts) < 2:
        return None
    tail = parts[-1]
    m = _POSTAL_RE.match(tail)
    if m:
        return m.group(2).strip() or None
    m = _POSTAL_TRAIL_RE.match(tail)
    if m:
        return m.group(1).strip() or None
    return tail or None


def _extract_rows(html: str) -> tuple[int, list[dict[str, str | None]]]:
    """Return (f_count, rows)."""
    soup = BeautifulSoup(html, "html.parser")
    f_count = 0
    script = soup.find("script", string=_F_COUNT_RE)
    if script and script.string:
        m = _F_COUNT_RE.search(script.string)
        if m:
            f_count = int(m.group(1))

    rows: list[dict[str, str | None]] = []
    for tr in soup.select("tr[idx]"):
        idx = tr.get("idx")
        if not idx:
            continue
        a = tr.select_one("td a.link.arrow")
        if not a:
            continue
        name = a.get_text(strip=True)
        href = a.get("href") or ""
        profile_url = (PROFILE_URL_PREFIX + href) if href.startswith("/") else href

        loc_a = tr.select("td p a")
        loc_text = loc_a[0].get_text("\n", strip=True) if loc_a else ""
        city = _parse_city(loc_text)

        rows.append({
            "idx": str(idx),
            "name": name,
            "city": city,
            "profile_url": profile_url or None,
            "location_raw": loc_text,
        })
    return f_count, rows


_FIELD_LOCATORS = {
    "oeko_profile_address": "customer_profile page, address block",
    "oeko_profile_phone": "customer_profile page, 'Phone' row",
    "oeko_profile_email": "customer_profile page, 'Email' row",
    "oeko_profile_website": "customer_profile page, contact block URL",
    "oeko_standard_label": "buying-guide result row, oets_standard filter",
}
# `oeko_customer_id`/`oeko_standard`/`oeko_profile_url` are request plumbing, and
# `country` is the Bangladesh filter we applied rather than text on the page.
_UNCITABLE_FIELDS = (
    "oeko_customer_id",
    "oeko_standard",
    "oeko_profile_url",
    "country",
)


class OekoTexScraper(AcquiringScraper):
    code = "oeko_tex"
    source_code = "OEKO_TEX"
    transport = "direct"
    fallback_transport = None
    # The public Buying Guide entry point. The search endpoint itself is a POST,
    # which a monitor cannot express — but a restructure of the guide is what
    # would break the search, and that is visible here.
    monitor_urls = (f"{BASE}/buying-guide/",)

    @property
    def request_headers(self) -> dict[str, str]:
        return {
            "User-Agent": settings.etl_user_agent,
            "Referer": f"{BASE}/buying-guide/",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        search_headers = {
            **self.request_headers,
            "Origin": BASE,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "text/html, */*; q=0.01",
        }

        for oets, label in OETS_STANDARDS.items():
            page = 1
            total_pages = 1
            while page <= total_pages:
                result = await self.acquire(
                    AcquireRequest(
                        url=RESULT_URL,
                        method="POST",
                        content=_build_body(oets, page),
                        headers=search_headers,
                        label=f"buying-guide {oets} p{page}",
                    )
                )
                if not result.ok:
                    self.log.warning(
                        "oeko.search_failed",
                        oets=oets, page=page,
                        status=result.fetch_status.value,
                        error=result.error_message,
                    )
                    break

                f_count, rows = _extract_rows(result.text())
                if page == 1:
                    total_pages = max(1, math.ceil(f_count / PAGE_SIZE))
                    self.log.info(
                        "oeko.standard.start",
                        oets=oets, label=label, f_count=f_count, pages=total_pages,
                    )
                if not rows:
                    self.log.info("oeko.empty_page", oets=oets, page=page)
                    break
                for r in rows:
                    profile_doc = await self._fetch_profile_doc(
                        r.get("profile_url"), idx=r["idx"], oets=oets
                    )
                    profile = _parse_profile(profile_doc, self.log, idx=r["idx"], oets=oets)
                    payload = {
                        "oeko_customer_id": r["idx"],
                        "oeko_standard": oets,
                        "oeko_standard_label": label,
                        "oeko_profile_url": r.get("profile_url"),
                        "country": "Bangladesh",
                    }
                    if profile.get("address"):
                        payload["oeko_profile_address"] = profile["address"]
                    if profile.get("phone"):
                        payload["oeko_profile_phone"] = profile["phone"]
                    if profile.get("email"):
                        payload["oeko_profile_email"] = profile["email"]
                    if profile.get("website"):
                        payload["oeko_profile_website"] = profile["website"]
                    yield ScrapedRecord(
                        source_code="OEKO_TEX",
                        source_ref=f"oeko-tex-{r['idx']}",
                        company_name=r["name"] or "",
                        city=r.get("city"),
                        address_raw=profile.get("address") or r.get("location_raw"),
                        email=profile.get("email"),
                        phone_raw=profile.get("phone"),
                        website=profile.get("website"),
                        payload=payload,
                        evidence=self._evidence_for(profile_doc, result),
                    )
                page += 1

    def _evidence_for(
        self, profile_doc: AcquiredDoc | None, result: AcquiredDoc
    ) -> EvidenceAttachment | None:
        """Cite the customer profile when we got one, else the result page.

        The profile URL is deliberately NOT used as the citable link even when we
        read it successfully: its key expires within minutes, so storing it would
        guarantee a dead citation. We cite the Buying Guide search entry point,
        which is the durable public page where a buyer can re-run the lookup, and
        keep the profile's own excerpt as the checkable content.
        """
        doc = profile_doc if (profile_doc is not None and profile_doc.ok) else result
        return EvidenceAttachment(
            doc=doc,
            locators=_FIELD_LOCATORS,
            default_locator="OEKO-TEX Buying Guide result row",
            skip_keys=_UNCITABLE_FIELDS,
            citable_url_override=f"{BASE}/buying-guide/",
        )

    async def _fetch_profile_doc(
        self, url: str | None, *, idx: str, oets: str
    ) -> AcquiredDoc | None:
        """Fetch a freshly-issued customer_profile URL.

        Profile keys expire quickly, so this MUST run during the search pass that
        produced the URL; reusing a stored URL yields 'Profile key has expired'.
        """
        if not url:
            return None
        await asyncio.sleep(PROFILE_DELAY_SECONDS)
        doc = await self.acquire(
            AcquireRequest(url=url, label=f"profile {idx}/{oets}")
        )
        if not doc.ok:
            self.log.warning(
                "oeko.profile.fetch_failed",
                idx=idx, oets=oets, status=doc.fetch_status.value,
            )
            return None
        return doc

    async def run(self) -> dict[str, int]:  # type: ignore[override]
        from etl.core.upsert import upsert_supplier_with_source
        from etl.evidence.writer import reset_document_cache

        run_id = self._open_run()
        reset_document_cache()
        seen = upserted = skipped = 0
        try:
            async for rec in self.fetch():
                seen += 1
                if not rec.company_name:
                    skipped += 1
                    continue
                try:
                    supplier_id = upsert_supplier_with_source(rec)
                    if supplier_id is not None:
                        _write_certification(supplier_id, rec)
                        upserted += 1
                except Exception as exc:  # noqa: BLE001
                    skipped += 1
                    self.log.error(
                        "upsert.failed", source_ref=rec.source_ref, error=str(exc),
                    )
                else:
                    if supplier_id is None:
                        # Unchanged payload: fetched_at was touched, nothing else to do.
                        skipped += 1
                    else:
                        await self._record_evidence(rec, supplier_id, run_id)
                if seen % 100 == 0:
                    self.log.info("progress", seen=seen, upserted=upserted, skipped=skipped)
            self._close_run(run_id, "success", seen, upserted, skipped, None)
        except Exception as exc:  # noqa: BLE001
            self._close_run(run_id, "failed", seen, upserted, skipped, str(exc))
            raise
        finally:
            await self.aclose()
        return {
            "seen": seen,
            "upserted": upserted,
            "skipped": skipped,
            "transport": self.active_transport,
            "evidence_documents": self.evidence_documents,
            "evidence_claims": self.evidence_claims,
            "credits_used": self.credits_used,
        }


def _parse_profile(
    doc: AcquiredDoc | None,
    logger,
    *,
    idx: str,
    oets: str,
) -> dict[str, str | None]:
    """Parse the public contact block (address, phone, email, website) out of a
    fetched OEKO customer_profile page."""
    out: dict[str, str | None] = {"address": None, "phone": None, "email": None, "website": None}
    if doc is None:
        return out
    html = doc.text()
    if "Profile key has expired" in html or len(html) < 800:
        logger.warning("oeko.profile.expired_or_empty", idx=idx, oets=oets, length=len(html))
        return out
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text("\n", strip=True)
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    try:
        i = lines.index("Customer Profile")
    except ValueError:
        return out
    label_idx = len(lines)
    for j in range(i + 2, len(lines)):
        if lines[j] in ("Phone", "Fax", "Email", "Certified products"):
            label_idx = j
            break
    addr_lines = lines[i + 2:label_idx]
    if addr_lines:
        out["address"] = ", ".join(addr_lines)
    j = label_idx
    while j < len(lines):
        ln = lines[j]
        if ln == "Phone" and j + 1 < len(lines):
            val = lines[j + 1]
            if val and val != "--":
                out["phone"] = val
            j += 2
            continue
        if ln == "Fax" and j + 1 < len(lines):
            j += 2
            continue
        if ln == "Email" and j + 1 < len(lines):
            val = lines[j + 1]
            if val and val != "--" and _EMAIL_RE.fullmatch(val):
                out["email"] = val.lower()
            j += 2
            continue
        if ln == "Certified products":
            break
        if _URL_RE.fullmatch(ln) and not out["website"]:
            out["website"] = ln.lower()
        j += 1
    return out


def _write_certification(supplier_id: str, rec: ScrapedRecord) -> None:
    p = rec.payload
    src_id = get_source_id("OEKO_TEX")
    cert_no = f"{p['oeko_customer_id']}-{p['oeko_standard']}"
    scope = p.get("oeko_standard_label")

    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """select id from public.source_records
                where supplier_id = %s and source_id = %s and source_ref = %s""",
            (supplier_id, src_id, rec.source_ref),
        )
        sr = cur.fetchone()
        sr_id = str(sr["id"]) if sr else None
        cur.execute(
            """insert into public.certifications
                 (supplier_id, kind, certificate_no, issuer,
                  issued_on, expires_on, scope, source_record_id, document_url)
               values (%s, 'oeko_tex', %s, %s, %s, %s, %s, %s, %s)
               on conflict (supplier_id, kind, certificate_no) do update set
                 issuer = excluded.issuer,
                 scope = excluded.scope,
                 source_record_id = excluded.source_record_id,
                 document_url = excluded.document_url""",
            (
                supplier_id,
                cert_no,
                "OEKO-TEX",
                None,
                None,
                scope,
                sr_id,
                p.get("oeko_profile_url"),
            ),
        )
        c.commit()
