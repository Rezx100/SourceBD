"""Spec 09 — Brand supplier-list disclosures miner (Tier 4).

Six brand sources: H&M, Inditex, Primark, ASOS, M&S, Next.

Per-brand pipeline (shared `BrandDisclosureBase`):
  1. Fetch the brand's stable landing page.
  2. Discover the latest disclosure file link (.xlsx / .xls / .pdf / .csv) by
     scraping the page — never hard-code dated URLs.
  3. Download bytes; mirror to BunnyCDN at
     `brand-disclosures/{brand_code}/{YYYY-MM-DD}.{ext}` (idempotent HEAD probe).
  4. Parse to canonical rows; keep only `country ~ Bangladesh`.
  5. Yield `ScrapedRecord(source_code='BRAND_*', ...)` with stable
     `source_ref = sha256(brand:norm_name|country|city)[:16]`.
  6. Custom `run()`: after each upsert, if the supplier still has no active
     Tier 1-3 source_record, enqueue one `brand_disclosure_match_review` row
     into `verification_queue` (idempotent on open rows for that supplier).
"""
from __future__ import annotations

import abc
import hashlib
import io
import json
import re
from dataclasses import dataclass
from datetime import date
from typing import Any, AsyncIterator, Iterable

import pdfplumber
from bs4 import BeautifulSoup
from openpyxl import load_workbook

from etl.core.bunny import upload as bunny_upload, exists as bunny_exists
from etl.core.db import db
from etl.core.http import HttpClient
from etl.core.normalize import normalize_company_name
from etl.core.scraper import BaseScraper, ScrapedRecord

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


@dataclass
class DiscoveredFile:
    url: str
    ext: str            # 'xlsx' | 'xls' | 'pdf' | 'csv'
    disclosure_date: date


def _ext_from_url(url: str) -> str | None:
    m = re.search(r"\.(xlsx|xls|pdf|csv)(?:[?#]|$)", url, re.IGNORECASE)
    return m.group(1).lower() if m else None


def _absolute(base: str, href: str) -> str:
    from urllib.parse import urljoin
    return urljoin(base, href)


def _bd_country(value: Any) -> bool:
    if value is None:
        return False
    s = str(value).strip().lower()
    return s == "bangladesh" or s == "bd" or s.startswith("bangladesh")


def _source_ref(brand_code: str, name: str, country: str, city: str | None) -> str:
    key = f"{brand_code}|{normalize_company_name(name)}|{(country or '').lower()}|{(city or '').lower()}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]


def _mirror_path(brand_code: str, disclosure_date: date, ext: str) -> str:
    return f"brand-disclosures/{brand_code.lower()}/{disclosure_date.isoformat()}.{ext}"


def _collect_candidates(
    html: str, base_url: str, link_regex: re.Pattern[str]
) -> list[tuple[str, str | None]]:
    """Return [(absolute_url, ext_or_None)] for anchors matching link_regex.

    When the href has no file extension (e.g. CDN routes like
    `bigcontent.io/v1/static/<slug>`), `ext` is None and the caller must
    probe Content-Type."""
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")
    out: list[tuple[str, str | None]] = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        label = a.get_text(" ", strip=True)
        haystack = f"{label} {href}"
        if link_regex.search(haystack):
            ext = _ext_from_url(href)
            out.append((_absolute(base_url, href), ext))
    return out


_CT_EXT = {
    "application/pdf":  "pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
    "text/csv":         "csv",
}


async def _infer_ext(url: str, http: HttpClient) -> str | None:
    """HEAD-probe `url`; map Content-Type to file extension."""
    try:
        resp = await http._client.head(url, follow_redirects=True)
        ct = (resp.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
        if ct in _CT_EXT:
            return _CT_EXT[ct]
        cd = resp.headers.get("content-disposition") or ""
        m = re.search(r"filename\*?=[\"']?([^;\"']+)", cd)
        if m:
            return _ext_from_url(m.group(1))
    except Exception:  # noqa: BLE001
        return None
    return None


async def _render_playwright(url: str, *, wait_ms: int = 4000) -> str:
    """Render `url` with headless Chromium and return final HTML.

    Bypasses Cloudflare bot pages and JS-only SPAs. Requires the
    playwright base Docker image (already used in production)."""
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await browser.new_context(
            user_agent=_BROWSER_HEADERS["User-Agent"],
            locale="en-GB",
            viewport={"width": 1366, "height": 900},
        )
        page = await ctx.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=45000)
            try:
                await page.wait_for_load_state("networkidle", timeout=15000)
            except Exception:  # noqa: BLE001
                pass
            await page.wait_for_timeout(wait_ms)
            html = await page.content()
        finally:
            await ctx.close()
            await browser.close()
        return html


async def _download_playwright(url: str) -> bytes:
    """Download a binary via Playwright's request context (CF-friendly)."""
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await browser.new_context(
            user_agent=_BROWSER_HEADERS["User-Agent"],
            locale="en-GB",
        )
        try:
            resp = await ctx.request.get(url, timeout=120000)
            if not resp.ok:
                raise RuntimeError(f"playwright download {url}: HTTP {resp.status}")
            body = await resp.body()
        finally:
            await ctx.close()
            await browser.close()
        return body


# --------------------------------------------------------------------------- #
# Parsers (header-tolerant)
# --------------------------------------------------------------------------- #

_HEADER_ALIASES = {
    "country":           {"country", "country/region", "country / region"},
    "factory_name":      {"factory", "factory name", "supplier", "supplier name",
                          "manufacturer", "facility", "facility name",
                          "production unit", "name of factory", "name"},
    "parent_group":      {"parent company", "group", "supplier group",
                          "parent group", "owner", "company"},
    "city":              {"city", "town", "city/town"},
    "address":           {"address", "factory address", "location"},
    "tier":              {"tier", "supply chain tier", "supplier tier"},
    "products":          {"product type", "products", "product category",
                          "process", "production process"},
    "workers":           {"number of workers", "workers", "total workers",
                          "employees", "number of employees"},
}


def _normalise_header(s: Any) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def _match_columns(headers: list[str]) -> dict[str, int]:
    """Return {canonical_key: column_index} where present in headers."""
    out: dict[str, int] = {}
    norm = [_normalise_header(h) for h in headers]
    for key, aliases in _HEADER_ALIASES.items():
        for idx, h in enumerate(norm):
            if h in aliases:
                out[key] = idx
                break
    return out


def _row_to_dict(row: list[Any], cols: dict[str, int]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, idx in cols.items():
        if idx < len(row):
            v = row[idx]
            if v is not None and str(v).strip() != "":
                out[key] = str(v).strip() if isinstance(v, str) else v
    return out


def _find_header_row(rows: Iterable[list[Any]], lookahead: int = 30) -> tuple[int, list[Any]] | None:
    rows_list = list(rows)
    for i, r in enumerate(rows_list[:lookahead]):
        norm = {_normalise_header(c) for c in r if c is not None}
        if not norm:
            continue
        # Need at least a country column AND a factory/supplier column.
        has_country = bool(norm & _HEADER_ALIASES["country"])
        has_name = bool(norm & _HEADER_ALIASES["factory_name"])
        if has_country and has_name:
            return i, list(r)
    return None


def parse_xlsx(content: bytes) -> list[dict[str, Any]]:
    """Parse the first sheet of an .xlsx; auto-detect header row; BD only."""
    wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    out: list[dict[str, Any]] = []
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue
        hdr = _find_header_row(rows)
        if hdr is None:
            continue
        hdr_idx, headers = hdr
        cols = _match_columns(headers)
        if "country" not in cols or "factory_name" not in cols:
            continue
        for r in rows[hdr_idx + 1:]:
            if r is None or all(c is None or str(c).strip() == "" for c in r):
                continue
            rec = _row_to_dict(list(r), cols)
            if _bd_country(rec.get("country")) and rec.get("factory_name"):
                out.append(rec)
    return out


def parse_csv(content: bytes) -> list[dict[str, Any]]:
    import csv
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    hdr = _find_header_row(rows)
    if hdr is None:
        return []
    hdr_idx, headers = hdr
    cols = _match_columns(headers)
    out: list[dict[str, Any]] = []
    for r in rows[hdr_idx + 1:]:
        if not r:
            continue
        rec = _row_to_dict(r, cols)
        if _bd_country(rec.get("country")) and rec.get("factory_name"):
            out.append(rec)
    return out


def parse_pdf(content: bytes) -> list[dict[str, Any]]:
    """Parse PDF tables; keep only rows whose country column == Bangladesh."""
    out: list[dict[str, Any]] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                if not table or len(table) < 2:
                    continue
                hdr = _find_header_row(table)
                if hdr is None:
                    continue
                hdr_idx, headers = hdr
                cols = _match_columns(headers)
                if "country" not in cols or "factory_name" not in cols:
                    continue
                for r in table[hdr_idx + 1:]:
                    if not r:
                        continue
                    rec = _row_to_dict(r, cols)
                    if _bd_country(rec.get("country")) and rec.get("factory_name"):
                        out.append(rec)
    return out


def parse_bytes(ext: str, content: bytes) -> list[dict[str, Any]]:
    if ext in ("xlsx", "xls"):
        return parse_xlsx(content)
    if ext == "csv":
        return parse_csv(content)
    if ext == "pdf":
        return parse_pdf(content)
    raise ValueError(f"unsupported extension: {ext}")


# --------------------------------------------------------------------------- #
# Base scraper
# --------------------------------------------------------------------------- #


class BrandDisclosureBase(BaseScraper, abc.ABC):
    brand_code: str = ""                # e.g. 'BRAND_HM' (also the source_code)
    landing_url: str = ""
    # Regex used to filter list-page anchors when discovering the latest file.
    file_link_regex: re.Pattern[str] = re.compile(
        r"(supplier|factory|production).*\.(xlsx|xls|pdf|csv)",
        re.IGNORECASE,
    )

    def __init__(self) -> None:
        super().__init__()
        if not self.brand_code:
            raise RuntimeError(f"{type(self).__name__}.brand_code is empty")
        self.source_code = self.brand_code

    async def discover(self, http: HttpClient) -> DiscoveredFile:
        """Scrape the landing page for the latest disclosure file.

        Tries plain HTTP first; on 4xx/5xx or empty candidates falls back to
        Playwright Chromium render (handles JS-only SPAs + Cloudflare)."""
        html: str | None = None
        try:
            resp = await http.get(self.landing_url)
            html = resp.text
        except Exception as exc:  # noqa: BLE001
            self.log.info("brand.http_failed", brand=self.brand_code, error=str(exc))
        candidates = _collect_candidates(html or "", self.landing_url, self.file_link_regex)
        if not candidates:
            self.log.info("brand.fallback_playwright", brand=self.brand_code, url=self.landing_url)
            html = await _render_playwright(self.landing_url)
            candidates = _collect_candidates(html, self.landing_url, self.file_link_regex)
        if not candidates:
            raise RuntimeError(
                f"{self.brand_code}: no disclosure file link found on {self.landing_url}"
            )
        # Resolve extension-less candidates via HEAD probe.
        for i, (url, ext) in enumerate(candidates):
            if ext is None:
                ext = await _infer_ext(url, http)
                if ext:
                    candidates[i] = (url, ext)
        candidates = [(u, e) for (u, e) in candidates if e]
        if not candidates:
            raise RuntimeError(
                f"{self.brand_code}: discovered link(s) but Content-Type unknown"
            )
        url, ext = candidates[0]
        return DiscoveredFile(url=url, ext=ext, disclosure_date=date.today())

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        async with HttpClient(rps=0.5, headers=_BROWSER_HEADERS) as http:
            found = await self.discover(http)
            self.log.info(
                "brand.discovered", brand=self.brand_code, url=found.url,
                ext=found.ext, date=found.disclosure_date.isoformat(),
            )
            mirror_path = _mirror_path(self.brand_code, found.disclosure_date, found.ext)
            if await bunny_exists(mirror_path):
                self.log.info("brand.mirror_exists", path=mirror_path)
                # Still need bytes to (re-)parse — download once.
            try:
                resp = await http.get(found.url)
                content = resp.content
                content_type = resp.headers.get("content-type")
            except Exception as exc:  # noqa: BLE001
                self.log.info("brand.file_http_failed", brand=self.brand_code, error=str(exc))
                content = await _download_playwright(found.url)
                content_type = None
            mirror_url = await bunny_upload(mirror_path, content, content_type=content_type)
            rows = parse_bytes(found.ext, content)
            self.log.info(
                "brand.parsed", brand=self.brand_code,
                bd_rows=len(rows), source_url=found.url,
            )
            for row in rows:
                name = str(row.get("factory_name") or "").strip()
                if not name:
                    continue
                city = row.get("city") or None
                payload = {
                    "brand": self.brand_code,
                    "source_url": found.url,
                    "mirror_url": mirror_url,
                    "disclosure_date": found.disclosure_date.isoformat(),
                    "parent_group": row.get("parent_group"),
                    "tier": row.get("tier"),
                    "products": row.get("products"),
                    "workers": row.get("workers"),
                    "country": row.get("country"),
                    "city": city,
                    "address": row.get("address"),
                }
                yield ScrapedRecord(
                    source_code=self.brand_code,
                    source_ref=_source_ref(self.brand_code, name, str(row.get("country") or ""), city),
                    company_name=name,
                    address_raw=row.get("address") or None,
                    city=city,
                    payload={k: v for k, v in payload.items() if v is not None},
                )

    async def run(self) -> dict[str, int]:
        """Override: after each upsert, enqueue brand-only suppliers for review."""
        from etl.core.upsert import upsert_supplier_with_source

        run_id = self._open_run()
        seen = upserted = skipped = enqueued = 0
        try:
            async for rec in self.fetch():
                seen += 1
                try:
                    supplier_id = upsert_supplier_with_source(rec)
                    upserted += 1
                    if _enqueue_if_brand_only(supplier_id, rec):
                        enqueued += 1
                except Exception as exc:  # noqa: BLE001
                    skipped += 1
                    self.log.error("upsert.failed", source_ref=rec.source_ref, error=str(exc))
                if seen % 50 == 0:
                    self.log.info(
                        "progress", seen=seen, upserted=upserted,
                        skipped=skipped, enqueued=enqueued,
                    )
            self._close_run(run_id, "success", seen, upserted, skipped, None)
        except Exception as exc:  # noqa: BLE001
            self._close_run(run_id, "failed", seen, upserted, skipped, str(exc))
            raise
        return {
            "seen": seen, "upserted": upserted,
            "skipped": skipped, "enqueued_for_review": enqueued,
        }


def _enqueue_if_brand_only(supplier_id: str, rec: ScrapedRecord) -> bool:
    """If the supplier has zero active Tier 1-3 source_records, enqueue one
    `brand_disclosure_match_review` row (idempotent on open rows)."""
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """select count(*) as n
                 from public.source_records
                where supplier_id = %s
                  and status = 'active'
                  and source_tier in ('tier1_gov','tier2_industry','tier3_cert')""",
            (supplier_id,),
        )
        n = int(cur.fetchone()["n"])
        if n > 0:
            return False
        cur.execute(
            """insert into public.verification_queue
                 (queue_type, supplier_a_id, supplier_b_name, confidence, source_data)
               select 'brand_disclosure_match_review', %s, %s, null, %s::jsonb
                where not exists (
                  select 1 from public.verification_queue
                   where queue_type = 'brand_disclosure_match_review'
                     and supplier_a_id = %s
                     and reviewed_at is null
                )""",
            (
                supplier_id,
                rec.company_name,
                json.dumps({
                    "brand": rec.source_code,
                    "source_ref": rec.source_ref,
                    "payload": rec.payload,
                }, default=str),
                supplier_id,
            ),
        )
        inserted = cur.rowcount > 0
        c.commit()
    return inserted


# --------------------------------------------------------------------------- #
# Brand-specific scrapers
# --------------------------------------------------------------------------- #


class BrandHmScraper(BrandDisclosureBase):
    code = "brand_hm"
    brand_code = "BRAND_HM"
    landing_url = "https://hmgroup.com/sustainability/leading-the-change/transparency/supply-chain/"
    file_link_regex = re.compile(r"\.(xlsx|xls)(?:[?#]|$)", re.IGNORECASE)


class BrandInditexScraper(BrandDisclosureBase):
    code = "brand_inditex"
    brand_code = "BRAND_INDITEX"
    landing_url = "https://www.inditex.com/itxcomweb/en/sustainability/our-impact/people-in-our-supply-chain"
    file_link_regex = re.compile(
        r"(suppliers?|factories|manufactur|UKIMSAct|modern[-_ ]?slavery).*\.(pdf|xlsx|xls)(?:[?#]|$)",
        re.IGNORECASE,
    )


class BrandPrimarkScraper(BrandDisclosureBase):
    code = "brand_primark"
    brand_code = "BRAND_PRIMARK"
    # The /factory-list/ page is JS-only and empty after render; the actual
    # disclosure (MSS PDF, contains supplier annex) lives on /modern-slavery-act.
    landing_url = "https://corporate.primark.com/en-gb/modern-slavery-act"
    file_link_regex = re.compile(
        r"modern[-_ ]?slavery[-_ ]?statement",
        re.IGNORECASE,
    )


# --- ASOS-specific helpers (factory list PDF has a fixed 7-col schema with
# the header row only on page 1; pages 2..N have NO header and `t[0]` is
# already a data row. The shared `parse_pdf` would silently drop pages 2..N.
# Filename pattern is stable: factory-list-<month-name>-<YYYY>.pdf.)

_ASOS_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5,
    "june": 6, "july": 7, "august": 8, "september": 9,
    "october": 10, "november": 11, "december": 12,
}
_ASOS_DATE_RE = re.compile(r"factory-list-([a-z]+)-(\d{4})\.pdf", re.IGNORECASE)


def _asos_disclosure_date(url: str) -> date:
    m = _ASOS_DATE_RE.search(url)
    if not m:
        return date.today()
    month = _ASOS_MONTHS.get(m.group(1).lower())
    if not month:
        return date.today()
    return date(int(m.group(2)), month, 1)


def parse_asos_pdf(content: bytes) -> list[dict[str, Any]]:
    """Parse ASOS factory-list PDF (fixed 7-column schema).

    Columns: Factory Name | Address Line 1 | Country | Department |
             Number of Workers | Male Workers | Female Workers.
    """
    out: list[dict[str, Any]] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                if not table:
                    continue
                first = table[0] or []
                is_header = any(
                    isinstance(c, str) and c.strip().lower() == "factory name"
                    for c in first
                )
                start = 1 if is_header else 0
                for row in table[start:]:
                    if not row or len(row) < 3:
                        continue
                    country = (row[2] or "").strip() if row[2] else ""
                    if not _bd_country(country):
                        continue
                    name = (row[0] or "").strip()
                    if not name:
                        continue
                    out.append({
                        "factory_name": name,
                        "address": (row[1] or "").strip() or None if len(row) > 1 else None,
                        "country": country,
                        "products": (row[3] or "").strip() or None if len(row) > 3 else None,
                        "workers": (row[4] or "").strip() or None if len(row) > 4 else None,
                        "male_workers": (row[5] or "").strip() or None if len(row) > 5 else None,
                        "female_workers": (row[6] or "").strip() or None if len(row) > 6 else None,
                    })
    return out


class BrandAsosScraper(BrandDisclosureBase):
    code = "brand_asos"
    brand_code = "BRAND_ASOS"
    landing_url = "https://www.asosplc.com/sustainability/supply-chain-and-policies/"
    # Strict match for `factory-list-<month>-<YYYY>.pdf` only (avoids MSS,
    # code-of-conduct, policy PDFs that also live on this page).
    file_link_regex = re.compile(r"factory-list-[a-z]+-\d{4}\.pdf", re.IGNORECASE)

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        async with HttpClient(rps=0.5, headers=_BROWSER_HEADERS) as http:
            found = await self.discover(http)
            # ASOS dates the file in the filename — use that, not today.
            found = DiscoveredFile(
                url=found.url, ext=found.ext,
                disclosure_date=_asos_disclosure_date(found.url),
            )
            self.log.info(
                "brand.discovered", brand=self.brand_code, url=found.url,
                ext=found.ext, date=found.disclosure_date.isoformat(),
            )
            mirror_path = _mirror_path(self.brand_code, found.disclosure_date, found.ext)
            if await bunny_exists(mirror_path):
                self.log.info("brand.mirror_exists", path=mirror_path)
            try:
                resp = await http.get(found.url)
                content = resp.content
                content_type = resp.headers.get("content-type")
            except Exception as exc:  # noqa: BLE001
                self.log.info("brand.file_http_failed", brand=self.brand_code, error=str(exc))
                content = await _download_playwright(found.url)
                content_type = None
            mirror_url = await bunny_upload(mirror_path, content, content_type=content_type)
            rows = parse_asos_pdf(content)
            self.log.info(
                "brand.parsed", brand=self.brand_code,
                bd_rows=len(rows), source_url=found.url,
            )
            for row in rows:
                name = row["factory_name"]
                payload = {
                    "brand": self.brand_code,
                    "source_url": found.url,
                    "mirror_url": mirror_url,
                    "disclosure_date": found.disclosure_date.isoformat(),
                    "country": row.get("country"),
                    "address": row.get("address"),
                    "products": row.get("products"),
                    "workers": row.get("workers"),
                    "male_workers": row.get("male_workers"),
                    "female_workers": row.get("female_workers"),
                }
                yield ScrapedRecord(
                    source_code=self.brand_code,
                    source_ref=_source_ref(self.brand_code, name, row.get("country") or "", None),
                    company_name=name,
                    address_raw=row.get("address") or None,
                    city=None,
                    payload={k: v for k, v in payload.items() if v is not None},
                )


class BrandMsScraper(BrandDisclosureBase):
    code = "brand_ms"
    brand_code = "BRAND_MS"
    # M&S publishes supplier data only through the JS-rendered Interactive
    # Supplier Map widget (ArcGIS-style API). No static disclosure file is
    # linked from public pages — will fail discovery until a bespoke map-API
    # client is added in a follow-up.
    landing_url = "https://corporate.marksandspencer.com/sustainability/interactive-supplier-map"
    file_link_regex = re.compile(
        r"(factory|supplier|interactive[-_ ]?map|global[-_ ]?sourcing|modern[-_ ]?slavery).*\.(xlsx|xls|csv|pdf)(?:[?#]|$)",
        re.IGNORECASE,
    )


# --- Next plc Tier-1 PDF helpers ----------------------------------------- #
#
# Next's T1 PDF has an 8-column schema with NO country column. Country is a
# section header row spanning the page; rows beneath belong to that country
# until the next header. Schema:
#   SUPPLIER NAME | MANUFACTURING SITE NAME | ADDRESS | PRODUCT TYPE |
#   FEMALE EMPLOYEES | MALE EMPLOYEES | TRADE UNION IN FACTORY |
#   FREELY ELECTED WORKERS COMMITTEE
# We use MANUFACTURING SITE NAME (col 1) as company_name -- it's the actual
# BD factory; col 0 is Next's UK vendor/importer.
# Disclosure date comes from PDF page-1 text: "Produced <Month> <Year>".

_NEXT_PRODUCED_RE = re.compile(r"Produced\s+([A-Za-z]+)\s+(\d{4})", re.IGNORECASE)
_NEXT_T1_FILE_RE  = re.compile(r"/T1[ %]+20\d{2}\.pdf", re.IGNORECASE)
_NEXT_T1_YEAR_RE  = re.compile(r"T1[ %]+20(\d{2})\.pdf", re.IGNORECASE)
_NEXT_COUNTRY_NAMES = {
    "albania", "bangladesh", "bulgaria", "cambodia", "china", "egypt",
    "ethiopia", "france", "germany", "haiti", "honduras", "india",
    "indonesia", "italy", "japan", "jordan", "kenya", "korea", "laos",
    "lao pdr", "madagascar", "malaysia", "mauritius", "mexico", "moldova",
    "morocco", "myanmar", "nepal", "nicaragua", "north macedonia", "pakistan",
    "peru", "philippines", "portugal", "romania", "south korea", "spain",
    "sri lanka", "taiwan", "thailand", "tunisia", "turkey", "uk",
    "ukraine", "united kingdom", "united states", "usa", "uzbekistan",
    "vietnam", "viet nam", "el salvador",
}


def _next_country_marker(row: list[Any]) -> str | None:
    non_empty = [str(c).strip() for c in row if c is not None and str(c).strip()]
    if len(non_empty) != 1:
        return None
    val = non_empty[0]
    if val.lower() in _NEXT_COUNTRY_NAMES:
        return val
    return None


def _next_disclosure_date(content: bytes, fallback_url: str) -> date:
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            txt = pdf.pages[0].extract_text() or ""
    except Exception:  # noqa: BLE001
        txt = ""
    m = _NEXT_PRODUCED_RE.search(txt)
    if m:
        month = _ASOS_MONTHS.get(m.group(1).lower())
        if month:
            return date(int(m.group(2)), month, 1)
    m2 = _NEXT_T1_YEAR_RE.search(fallback_url)
    if m2:
        return date(2000 + int(m2.group(1)), 1, 1)
    return date.today()


def parse_next_t1_pdf(content: bytes) -> list[dict[str, Any]]:
    """Parse Next plc Tier-1 PDF; country tracked by section header rows."""
    out: list[dict[str, Any]] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            current_country: str | None = None
            for table in page.extract_tables() or []:
                if not table:
                    continue
                for row in table:
                    if not row:
                        continue
                    cm = _next_country_marker(row)
                    if cm:
                        current_country = cm
                        continue
                    cell0 = str(row[0] or "").strip()
                    cell1 = str(row[1] or "").strip() if len(row) > 1 else ""
                    if not cell0 or not cell1:
                        continue
                    if cell0.upper().startswith("TIER "):
                        continue
                    if cell0.upper() == "SUPPLIER NAME":
                        continue
                    if not current_country:
                        continue
                    if current_country.lower() != "bangladesh":
                        continue
                    out.append({
                        "factory_name": cell1,
                        "supplier_vendor": cell0,
                        "address": str(row[2] or "").strip() or None if len(row) > 2 else None,
                        "country": current_country,
                        "products": str(row[3] or "").strip() or None if len(row) > 3 else None,
                        "female_workers": str(row[4] or "").strip() or None if len(row) > 4 else None,
                        "male_workers": str(row[5] or "").strip() or None if len(row) > 5 else None,
                        "trade_union": str(row[6] or "").strip() or None if len(row) > 6 else None,
                        "workers_committee": str(row[7] or "").strip() or None if len(row) > 7 else None,
                    })
    return out


class BrandNextScraper(BrandDisclosureBase):
    code = "brand_next"
    brand_code = "BRAND_NEXT"
    landing_url = "https://www.nextplc.co.uk/corporate-responsibility/our-suppliers"
    # Match Next CDN path `/T1 2025.pdf` (raw or URL-encoded spaces). Excludes
    # T2/T3 (those are downstream tiers; T1 = direct manufacturers, which is
    # the per-factory authenticity-rule-compliant disclosure).
    file_link_regex = _NEXT_T1_FILE_RE

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        # Next's CDN requires a Referer matching the supplier landing page.
        headers = dict(_BROWSER_HEADERS)
        headers["Referer"] = self.landing_url
        async with HttpClient(rps=0.5, headers=headers) as http:
            # Discover ALL matching T1 candidates, pick the highest year.
            html: str | None = None
            try:
                resp = await http.get(self.landing_url)
                html = resp.text
            except Exception as exc:  # noqa: BLE001
                self.log.info("brand.http_failed", brand=self.brand_code, error=str(exc))
            candidates = _collect_candidates(html or "", self.landing_url, self.file_link_regex)
            if not candidates:
                self.log.info("brand.fallback_playwright", brand=self.brand_code, url=self.landing_url)
                html = await _render_playwright(self.landing_url)
                candidates = _collect_candidates(html, self.landing_url, self.file_link_regex)
            if not candidates:
                raise RuntimeError(
                    f"{self.brand_code}: no T1 PDF link found on {self.landing_url}"
                )

            def _year(u: str) -> int:
                m = _NEXT_T1_YEAR_RE.search(u)
                return int(m.group(1)) if m else 0
            candidates.sort(key=lambda c: _year(c[0]), reverse=True)
            url, ext = candidates[0]
            ext = ext or "pdf"

            try:
                resp = await http.get(url)
                content = resp.content
                content_type = resp.headers.get("content-type")
            except Exception as exc:  # noqa: BLE001
                self.log.info("brand.file_http_failed", brand=self.brand_code, error=str(exc))
                content = await _download_playwright(url)
                content_type = None

            disclosure_date = _next_disclosure_date(content, url)
            self.log.info(
                "brand.discovered", brand=self.brand_code, url=url,
                ext=ext, date=disclosure_date.isoformat(),
            )
            mirror_path = _mirror_path(self.brand_code, disclosure_date, ext)
            mirror_url = await bunny_upload(mirror_path, content, content_type=content_type)

            rows = parse_next_t1_pdf(content)
            self.log.info(
                "brand.parsed", brand=self.brand_code,
                bd_rows=len(rows), source_url=url,
            )
            for row in rows:
                name = row["factory_name"]
                payload = {
                    "brand": self.brand_code,
                    "source_url": url,
                    "mirror_url": mirror_url,
                    "disclosure_date": disclosure_date.isoformat(),
                    "country": row.get("country"),
                    "address": row.get("address"),
                    "products": row.get("products"),
                    "female_workers": row.get("female_workers"),
                    "male_workers": row.get("male_workers"),
                    "trade_union": row.get("trade_union"),
                    "workers_committee": row.get("workers_committee"),
                    "next_supplier_vendor": row.get("supplier_vendor"),
                }
                yield ScrapedRecord(
                    source_code=self.brand_code,
                    source_ref=_source_ref(self.brand_code, name, row.get("country") or "", None),
                    company_name=name,
                    address_raw=row.get("address") or None,
                    city=None,
                    payload={k: v for k, v in payload.items() if v is not None},
                )
