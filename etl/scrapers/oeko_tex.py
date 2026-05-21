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
"""
from __future__ import annotations

import asyncio
import math
import re
from typing import AsyncIterator
from urllib.parse import urlencode

import httpx
from bs4 import BeautifulSoup

from etl.core.config import settings
from etl.core.db import db, get_source_id
from etl.core.scraper import BaseScraper, ScrapedRecord

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


class OekoTexScraper(BaseScraper):
    code = "oeko_tex"
    source_code = "OEKO_TEX"

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        headers = {
            "User-Agent": settings.etl_user_agent,
            "Referer": f"{BASE}/buying-guide/",
            "Origin": BASE,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "text/html, */*; q=0.01",
            "Accept-Language": "en-US,en;q=0.9",
        }
        profile_headers = {
            "User-Agent": settings.etl_user_agent,
            "Referer": f"{BASE}/buying-guide/",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        async with httpx.AsyncClient(timeout=60.0, headers=headers, follow_redirects=True) as client:
            for oets, label in OETS_STANDARDS.items():
                page = 1
                total_pages = 1
                while page <= total_pages:
                    body = _build_body(oets, page)
                    resp = await client.post(RESULT_URL, content=body)
                    resp.raise_for_status()
                    f_count, rows = _extract_rows(resp.text)
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
                        profile = await _fetch_profile(
                            client, r.get("profile_url"), profile_headers, self.log,
                            idx=r["idx"], oets=oets,
                        )
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
                        )
                    page += 1

    async def run(self) -> dict[str, int]:  # type: ignore[override]
        from etl.core.upsert import upsert_supplier_with_source

        run_id = self._open_run()
        seen = upserted = skipped = 0
        try:
            async for rec in self.fetch():
                seen += 1
                if not rec.company_name:
                    skipped += 1
                    continue
                try:
                    supplier_id = upsert_supplier_with_source(rec)
                    _write_certification(supplier_id, rec)
                    upserted += 1
                except Exception as exc:  # noqa: BLE001
                    skipped += 1
                    self.log.error(
                        "upsert.failed", source_ref=rec.source_ref, error=str(exc),
                    )
                if seen % 100 == 0:
                    self.log.info("progress", seen=seen, upserted=upserted, skipped=skipped)
            self._close_run(run_id, "success", seen, upserted, skipped, None)
        except Exception as exc:  # noqa: BLE001
            self._close_run(run_id, "failed", seen, upserted, skipped, str(exc))
            raise
        return {"seen": seen, "upserted": upserted, "skipped": skipped}


async def _fetch_profile(
    client: httpx.AsyncClient,
    url: str | None,
    headers: dict[str, str],
    logger,
    *,
    idx: str,
    oets: str,
) -> dict[str, str | None]:
    """GET a freshly-issued OEKO customer_profile URL and parse the public
    contact block (address, phone, email, website). Profile keys expire
    quickly so this MUST be called during the search pass that produced the
    URL; reusing a stored URL yields 'Profile key has expired'."""
    out: dict[str, str | None] = {"address": None, "phone": None, "email": None, "website": None}
    if not url:
        return out
    await asyncio.sleep(PROFILE_DELAY_SECONDS)
    try:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("oeko.profile.fetch_failed", idx=idx, oets=oets, error=str(exc))
        return out
    html = resp.text
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
