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

Transport: hybrid. Landing pages go through Firecrawl, which renders JS and
proxies past the Cloudflare interstitials these corporate sites use — that is
what the local Playwright render fallback existed to do, so it is gone. The
disclosure file itself is downloaded directly, because openpyxl and pdfplumber
need the exact bytes, with a Playwright download retained only as a last resort
for CDNs that refuse a plain client.

`brand_ms` is the exception and still drives Playwright end to end: it has to
capture a per-contributor embed token out of live iframe request headers, which
no scrape API can do.
"""
from __future__ import annotations

import abc
import hashlib
import io
import json
import re
from dataclasses import dataclass
from datetime import date
from typing import Any, AsyncIterator, Iterable, Sized
from urllib.parse import unquote, urlsplit

import pdfplumber
from bs4 import BeautifulSoup
from openpyxl import load_workbook

from etl.acquire import AcquiredDoc, AcquireRequest
from etl.core.acquiring import AcquiringScraper
from etl.core.bunny import upload as bunny_upload, exists as bunny_exists
from etl.core.db import db
from etl.core.normalize import canonical_url, normalize_company_name
from etl.core.scraper import EvidenceAttachment, ScrapedRecord

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
            out.append((canonical_url(_absolute(base_url, href)), ext))
    return out


_CT_EXT = {
    "application/pdf":  "pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
    "text/csv":         "csv",
}


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


# Which payload keys the disclosure file actually asserts. `brand`,
# `source_url`, `mirror_url` and `disclosure_date` are our own bookkeeping.
_DISCLOSURE_UNCITABLE = ("brand", "disclosure_date", "city")


class BrandDisclosureBase(AcquiringScraper, abc.ABC):
    brand_code: str = ""                # e.g. 'BRAND_HM' (also the source_code)
    landing_url: str = ""
    transport = "firecrawl"
    fallback_transport = "direct"

    @classmethod
    def monitor_targets(cls) -> tuple[str, ...]:
        """Watch the landing page, which is where the file link is published.

        Brands replace their disclosure file on their own schedule and rarely
        announce it, so the landing page changing is the earliest signal that a
        new supplier list exists — and the only signal that the link we cite has
        moved. Derived from `landing_url` rather than repeated per brand so the
        two cannot disagree.
        """
        return (cls.landing_url,) if cls.landing_url else ()
    request_headers = _BROWSER_HEADERS
    rps = 0.5
    # Regex used to filter list-page anchors when discovering the latest file.
    file_link_regex: re.Pattern[str] = re.compile(
        r"(supplier|factory|production).*\.(xlsx|xls|pdf|csv)",
        re.IGNORECASE,
    )

    def __init__(self, transport: str | None = None) -> None:
        super().__init__(transport=transport)
        if not self.brand_code:
            raise RuntimeError(f"{type(self).__name__}.brand_code is empty")
        self.source_code = self.brand_code

    async def landing_page(self) -> AcquiredDoc:
        """Acquire the brand's landing page.

        Firecrawl renders JS and proxies past bot interstitials, so there is one
        path here rather than the old httpx-then-Playwright ladder.
        """
        doc = await self.acquire(
            AcquireRequest(
                url=self.landing_url,
                only_main_content=False,
                # These pages hydrate their download links client-side.
                wait_for_ms=3000,
                label=f"{self.brand_code} landing page",
            )
        )
        if not doc.ok:
            self.log.info(
                "brand.landing_failed",
                brand=self.brand_code,
                status=doc.fetch_status.value,
                error=doc.error_message,
            )
        return doc

    async def _infer_ext(self, url: str) -> str | None:
        """HEAD-probe `url`; map Content-Type to a file extension."""
        probe = await self.acquire_direct(
            AcquireRequest(url=url, method="HEAD", label="ext probe")
        )
        if not probe.ok:
            return None
        ct = (probe.content_type or "").split(";", 1)[0].strip().lower()
        if ct in _CT_EXT:
            return _CT_EXT[ct]
        cd = str(probe.meta.get("content_disposition") or "")
        m = re.search(r"filename\*?=[\"']?([^;\"']+)", cd)
        if m:
            return _ext_from_url(m.group(1))
        return None

    async def discover(self) -> tuple[DiscoveredFile, AcquiredDoc]:
        """Scrape the landing page for the latest disclosure file."""
        doc = await self.landing_page()
        candidates = _collect_candidates(doc.text(), self.landing_url, self.file_link_regex)
        if not candidates:
            # Name the soft 404 explicitly. Inditex answers 200 for this page and
            # redirects to its homepage, so "no link found" reads as a parser bug
            # when the real cause is that the page no longer exists.
            diverted = (
                f" — the request was redirected to {doc.citable_url}, which looks "
                "like the site homepage, so this page has probably been retired"
                if doc.landed_on_site_root
                else ""
            )
            raise RuntimeError(
                f"{self.brand_code}: no disclosure file link found on {self.landing_url} "
                f"(fetch {doc.fetch_status.value} via {doc.adapter.value}){diverted}"
            )
        # Resolve extension-less candidates via HEAD probe.
        for i, (url, ext) in enumerate(candidates):
            if ext is None:
                ext = await self._infer_ext(url)
                if ext:
                    candidates[i] = (url, ext)
        candidates = [(u, e) for (u, e) in candidates if e]
        if not candidates:
            raise RuntimeError(
                f"{self.brand_code}: discovered link(s) but Content-Type unknown"
            )
        url, ext = candidates[0]
        return DiscoveredFile(url=url, ext=ext, disclosure_date=date.today()), doc

    async def download(self, url: str) -> tuple[bytes, str | None, AcquiredDoc | None]:
        """Fetch the disclosure file's exact bytes.

        Direct first: the parsers need the original workbook/PDF, not a rendered
        view of it. Playwright is kept as a last resort for CDNs that reject a
        plain client, and in that case there is no `AcquiredDoc` to cite from.
        """
        doc = await self.acquire_direct(
            AcquireRequest(url=url, want_bytes=True, label=f"{self.brand_code} file")
        )
        if doc.ok and doc.body_bytes:
            return doc.body_bytes, doc.content_type, doc
        self.log.info(
            "brand.file_http_failed",
            brand=self.brand_code,
            status=doc.fetch_status.value,
            error=doc.error_message,
        )
        return await _download_playwright(url), None, None

    def _require_rows(self, rows: Sized, source_url: str) -> None:
        """Refuse a disclosure that parsed to no Bangladesh rows.

        A brand that has published a Bangladesh supplier list for years does not
        abruptly stop having Bangladesh factories. Zero rows means the link moved,
        the format changed, or we are reading the wrong document — Primark's
        Modern Slavery Statement is narrative prose, and parsing it for a factory
        list yields exactly zero rows with no error.

        Yielding nothing instead of raising is the harmful option: the run reports
        success, the existing suppliers quietly stop being refreshed, and nothing
        anywhere says the source went stale.
        """
        if len(rows) == 0:
            raise RuntimeError(
                f"{self.brand_code}: parsed 0 Bangladesh rows from {source_url}. "
                "Refusing to report an empty supplier list — the document, its "
                "format, or the link has probably changed."
            )

    def _evidence_for(
        self, file_doc: AcquiredDoc | None, row: dict[str, Any], found: DiscoveredFile
    ) -> EvidenceAttachment | None:
        """Cite the disclosure file, with the row's own cells as the excerpt.

        The excerpt is built from the parsed row rather than the file body: the
        body is a binary workbook or PDF, so searching it for "1,240" would fail
        and leave every claim unverifiable.
        """
        if file_doc is None or not file_doc.ok:
            return None
        row_text = "\t".join(
            str(v) for v in row.values() if v is not None and str(v).strip()
        )
        return EvidenceAttachment(
            doc=file_doc,
            default_locator=(
                f"{self.brand_code} disclosure "
                f"({found.disclosure_date.isoformat()}, .{found.ext}), Bangladesh rows"
            ),
            document_text=row_text,
            skip_keys=_DISCLOSURE_UNCITABLE,
        )

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        found, _landing = await self.discover()
        self.log.info(
            "brand.discovered", brand=self.brand_code, url=found.url,
            ext=found.ext, date=found.disclosure_date.isoformat(),
            transport=self.active_transport,
        )
        mirror_path = _mirror_path(self.brand_code, found.disclosure_date, found.ext)
        if await bunny_exists(mirror_path):
            self.log.info("brand.mirror_exists", path=mirror_path)
            # Still need bytes to (re-)parse — download once.
        content, content_type, file_doc = await self.download(found.url)
        mirror_url = await bunny_upload(mirror_path, content, content_type=content_type)
        rows = parse_bytes(found.ext, content)
        self.log.info(
            "brand.parsed", brand=self.brand_code,
            bd_rows=len(rows), source_url=found.url,
        )
        self._require_rows(rows, found.url)
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
                evidence=self._evidence_for(file_doc, row, found),
            )

    async def run(self) -> dict[str, int]:
        """Override: after each upsert, enqueue brand-only suppliers for review."""
        from etl.core.upsert import upsert_supplier_with_source
        from etl.evidence.writer import reset_document_cache

        run_id = self._open_run()
        reset_document_cache()
        seen = upserted = skipped = enqueued = 0
        try:
            async for rec in self.fetch():
                seen += 1
                try:
                    supplier_id = upsert_supplier_with_source(rec)
                    if supplier_id is not None:
                        upserted += 1
                        if _enqueue_if_brand_only(supplier_id, rec):
                            enqueued += 1
                except Exception as exc:  # noqa: BLE001
                    skipped += 1
                    self.log.error("upsert.failed", source_ref=rec.source_ref, error=str(exc))
                else:
                    if supplier_id is None:
                        # Unchanged payload: fetched_at was touched, nothing else to do.
                        skipped += 1
                    else:
                        await self._record_evidence(rec, supplier_id, run_id)
                if seen % 50 == 0:
                    self.log.info(
                        "progress", seen=seen, upserted=upserted,
                        skipped=skipped, enqueued=enqueued,
                    )
            self._close_run(run_id, "success", seen, upserted, skipped, None)
        except Exception as exc:  # noqa: BLE001
            self._close_run(run_id, "failed", seen, upserted, skipped, str(exc))
            raise
        finally:
            await self.aclose()
        return {
            "seen": seen, "upserted": upserted,
            "skipped": skipped, "enqueued_for_review": enqueued,
            "transport": self.active_transport,
            "evidence_documents": self.evidence_documents,
            "evidence_claims": self.evidence_claims,
            "credits_used": self.credits_used,
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


# BrandInditexScraper was removed on 29 Jul 2026. Inditex does not publish a
# factory-level supplier list at any URL: they disclose aggregate per-country
# counts only, and share the real list privately with IndustriALL Global Union
# under their Global Framework Agreement. The page this scraper read now answers
# 200 and redirects to the Inditex homepage. Reinstating it needs a public list to
# exist first, not a new selector.


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
        found, _landing = await self.discover()
        # ASOS dates the file in the filename — use that, not today.
        found = DiscoveredFile(
            url=found.url, ext=found.ext,
            disclosure_date=_asos_disclosure_date(found.url),
        )
        self.log.info(
            "brand.discovered", brand=self.brand_code, url=found.url,
            ext=found.ext, date=found.disclosure_date.isoformat(),
            transport=self.active_transport,
        )
        mirror_path = _mirror_path(self.brand_code, found.disclosure_date, found.ext)
        if await bunny_exists(mirror_path):
            self.log.info("brand.mirror_exists", path=mirror_path)
        content, content_type, file_doc = await self.download(found.url)
        mirror_url = await bunny_upload(mirror_path, content, content_type=content_type)
        rows = parse_asos_pdf(content)
        self.log.info(
            "brand.parsed", brand=self.brand_code,
            bd_rows=len(rows), source_url=found.url,
        )
        self._require_rows(rows, found.url)
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
                evidence=self._evidence_for(file_doc, row, found),
            )


_MS_OSH_CONTRIBUTOR_ID = 10061
_MS_EMBED_PAGE = "https://corporate.marksandspencer.com/sustainability/interactive-supplier-map"
_MS_OSH_FACILITIES_API = "https://opensupplyhub.org/api/facilities/"


async def _ms_verify_embed_and_fetch(log) -> tuple[list[dict[str, Any]], str]:
    """Open the M&S corporate embed page (verifying the on-domain OSH embed
    actually fires XHRs against contributor 10061), then paginate the OSH
    facilities API for that contributor, country=BD, from the same Playwright
    context (carries OSH session cookies that bare httpx cannot get).

    Returns (features, api_url_used_for_first_page).
    """
    from playwright.async_api import async_playwright

    features: list[dict[str, Any]] = []
    first_url = (
        f"{_MS_OSH_FACILITIES_API}?contributors={_MS_OSH_CONTRIBUTOR_ID}"
        "&countries=BD&pageSize=50&embed=1&sort_by=name_asc"
    )
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await browser.new_context(
            user_agent=_BROWSER_HEADERS["User-Agent"],
            locale="en-GB",
            viewport={"width": 1366, "height": 900},
        )
        page = await ctx.new_page()
        seen_urls: list[str] = []
        # OSH /api/* endpoints require a per-contributor `x-oar-client-key`
        # header (and matching Referer). The key is a public embed token
        # delivered by the M&S corporate page's iframe — we capture it here
        # at runtime so it stays correct if OSH rotates it.
        osh_client_key: dict[str, str] = {}

        async def _capture(req) -> None:
            seen_urls.append(req.url)
            if "opensupplyhub.org/api/" in req.url and "client_key" not in osh_client_key:
                try:
                    hdrs = await req.all_headers()
                except Exception:  # noqa: BLE001
                    return
                key = hdrs.get("x-oar-client-key") or hdrs.get("X-OAR-Client-Key")
                if key:
                    osh_client_key["client_key"] = key
                    osh_client_key["referer"] = hdrs.get("referer") or hdrs.get("Referer") or ""

        page.on("request", _capture)
        try:
            await page.goto(_MS_EMBED_PAGE, wait_until="domcontentloaded", timeout=60000)
            try:
                await page.wait_for_load_state("networkidle", timeout=20000)
            except Exception:  # noqa: BLE001
                pass
            # On-domain embed verification: the M&S page must actually fire
            # XHRs referencing OSH contributor 10061. This is the runtime
            # enforcement of the narrow OSH extension to the authenticity rule.
            cid = str(_MS_OSH_CONTRIBUTOR_ID)
            verified = any(
                "opensupplyhub.org" in u
                and (f"contributors={cid}" in u or f"contributor-embed-configs/{cid}" in u)
                for u in seen_urls
            )
            if not verified:
                raise RuntimeError(
                    f"BRAND_MS: embed verification failed — {_MS_EMBED_PAGE} did not "
                    f"fire any opensupplyhub.org XHR referencing contributor {cid} "
                    f"(captured {len(seen_urls)} requests)."
                )
            log.info(
                "brand.ms_embed_verified",
                contributor_id=_MS_OSH_CONTRIBUTOR_ID,
                requests=len(seen_urls),
            )
            # The M&S corporate page loads OSH inside an iframe whose XHRs
            # carry a per-contributor `x-oar-client-key` embed token plus a
            # Referer pointing at the OSH facilities embed URL. Both are
            # required (the API returns 401 without them). We captured them
            # above from the live iframe requests and replay them here.
            if "client_key" not in osh_client_key:
                raise RuntimeError(
                    "BRAND_MS: failed to capture x-oar-client-key from M&S OSH iframe"
                )
            api_headers = {
                "x-oar-client-key": osh_client_key["client_key"],
                "Referer": osh_client_key.get("referer")
                or f"https://opensupplyhub.org/facilities?contributors={_MS_OSH_CONTRIBUTOR_ID}&sort_by=name_asc&embed=1",
                "Accept": "application/json, text/plain, */*",
            }
            log.info(
                "brand.ms_osh_client_key_captured",
                key_prefix=osh_client_key["client_key"][:8],
            )
            url = first_url
            pages = 0
            while url:
                resp = await ctx.request.get(url, headers=api_headers, timeout=60000)
                if not resp.ok:
                    body = (await resp.text())[:300]
                    raise RuntimeError(
                        f"BRAND_MS: OSH facilities fetch failed: HTTP {resp.status} "
                        f"at {url} — body: {body}"
                    )
                data = await resp.json()
                page_feats = data.get("features") or []
                # Belt-and-suspenders: filter BD client-side in case the API
                # ignores `countries=BD` for a given contributor.
                for feat in page_feats:
                    props = feat.get("properties") or {}
                    cc = (props.get("country_code") or "").upper()
                    cn = (props.get("country_name") or "").lower()
                    if cc == "BD" or cn.startswith("bangladesh"):
                        features.append(feat)
                pages += 1
                url = data.get("next")
            log.info("brand.ms_osh_fetched", pages=pages, bd_features=len(features))
        finally:
            await ctx.close()
            await browser.close()
    return features, first_url


class BrandMsScraper(BrandDisclosureBase):
    code = "brand_ms"
    brand_code = "BRAND_MS"
    # M&S's per-factory disclosure is the Open Supply Hub supplier list (M&S
    # is OSH contributor 10061), embedded on the M&S corporate domain at
    # /sustainability/interactive-supplier-map. Per the narrow OSH extension
    # to the per-factory authenticity rule (decided 2026-05-19), this
    # satisfies a BRAND_MS attribution because (a) M&S is the named OSH
    # contributor AND (b) the list is officially embedded on M&S's own
    # corporate domain. Both conditions are runtime-enforced.
    landing_url = _MS_EMBED_PAGE
    file_link_regex = re.compile(r"^never$")  # unused; we override fetch()
    # The only source that cannot move: we must read a per-contributor
    # `x-oar-client-key` out of the live iframe's request headers, which requires
    # a real browser observing real network traffic. No scrape API exposes that.
    transport = "direct"
    fallback_transport = None

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        features, source_url = await _ms_verify_embed_and_fetch(self.log)
        disclosure_date = date.today()
        snapshot = json.dumps(
            {
                "contributor_id": _MS_OSH_CONTRIBUTOR_ID,
                "embed_page": _MS_EMBED_PAGE,
                "source_api": source_url,
                "fetched_at": disclosure_date.isoformat(),
                "bd_features": features,
            },
            default=str,
        ).encode("utf-8")
        mirror_path = _mirror_path(self.brand_code, disclosure_date, "json")
        mirror_url = await bunny_upload(
            mirror_path, snapshot, content_type="application/json"
        )
        self.log.info(
            "brand.parsed", brand=self.brand_code,
            bd_rows=len(features), source_url=source_url,
        )
        self._require_rows(features, source_url)
        for feat in features:
            props = feat.get("properties") or {}
            name = (props.get("name") or "").strip()
            if not name:
                continue
            oar_id = str(feat.get("id") or props.get("os_id") or "").strip()
            address = (props.get("address") or "").strip() or None
            country = props.get("country_name") or "Bangladesh"
            payload = {
                "brand": self.brand_code,
                "source_url": source_url,
                "embed_page": _MS_EMBED_PAGE,
                "osh_contributor_id": _MS_OSH_CONTRIBUTOR_ID,
                "osh_facility_id": oar_id or None,
                "mirror_url": mirror_url,
                "disclosure_date": disclosure_date.isoformat(),
                "country": country,
                "address": address,
                "sector": props.get("sector"),
                "lists": props.get("contributor_lists") or props.get("lists"),
            }
            yield ScrapedRecord(
                source_code=self.brand_code,
                source_ref=(
                    f"ms-osh-{oar_id}" if oar_id
                    else _source_ref(self.brand_code, name, country, None)
                ),
                company_name=name,
                address_raw=address,
                city=None,
                payload={k: v for k, v in payload.items() if v is not None},
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
# Next renames these lists freely: the Tier 1 file has been `T1 2025.pdf`,
# `T1 - CO SEC - AW23 - SS24.pdf`, `TIER 1 PLC LIST AUGUST 2024.pdf` and now
# `PLC LIST FEB 2026 - TIER1.pdf`. So the collector takes every PDF on the page
# and the tier is decided afterwards, rather than being pinned to one filename
# shape that goes stale the next time they publish.
_NEXT_PDF_RE = re.compile(r"\.pdf(?:[?#]|$)", re.IGNORECASE)

_NEXT_TIER1_RE = re.compile(r"(?:^|[^a-z0-9])(?:tier[\s_-]*1|t1)(?![0-9])", re.IGNORECASE)
_NEXT_TIER23_RE = re.compile(r"(?:^|[^a-z0-9])(?:tier[\s_-]*[23]|t[23])(?![0-9])", re.IGNORECASE)
_NEXT_YEAR_RE = re.compile(r"20\d{2}")


def _url_filename(url: str) -> str:
    """The last path segment, percent-decoded.

    Tests must not run against the whole URL: Next keeps these files in a folder
    called `Tier 1 -2 - 3 lists`, so a URL-wide search for "Tier 1" matches the
    Tier 2 and Tier 3 lists sitting beside it, and we would publish downstream
    subcontractors as if they were direct manufacturers.

    Decoding matters for the same reason it is easy to miss. `%20` ends in a
    digit, so `...FEB%202026%20-%20TIER1.pdf` breaks a word-boundary test right
    where the tier is named, and `20\\d{2}` reads a year of 2020 out of the
    encoding itself rather than the 2026 in the name. Decoding first collapses
    both URL spellings into one and keeps the patterns honest.
    """
    return unquote(urlsplit(url).path.rstrip("/").rpartition("/")[2])


def _is_next_tier1(url: str) -> bool:
    """Whether a URL names the Tier 1 list specifically."""
    name = _url_filename(url)
    if _NEXT_TIER23_RE.search(name):
        return False
    return bool(_NEXT_TIER1_RE.search(name))


def _next_t1_year(url: str) -> int:
    """Latest 4-digit year in the filename, 0 when it carries none."""
    years = [int(y) for y in _NEXT_YEAR_RE.findall(_url_filename(url))]
    return max(years) if years else 0
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
    year = _next_t1_year(fallback_url)
    if year:
        return date(year, 1, 1)
    return date.today()


# Next's own column titles mapped to our field names. The titles are stable even
# though their positions are not, which is why the parser keys off them.
_NEXT_COLUMNS = {
    "manufacturing site name": "factory_name",
    "supplier name": "supplier_vendor",
    "address": "address",
    "country": "country",
    "product type": "products",
    "female employees": "female_workers",
    "male employees": "male_workers",
    "trade union in factory": "trade_union",
    "freely elected workers committee": "workers_committee",
}


def _next_header_map(row: list[Any]) -> dict[str, int] | None:
    """Column indexes keyed by our field names, or None if this is not a header.

    Header cells arrive clipped to the PDF's column widths — the committee column
    reads "FREELY ELECTED WORKERS COM" — so a title matches when it is a prefix of
    a known column name. The minimum length keeps a stray short cell from
    matching several columns at once.
    """
    found: dict[str, int] = {}
    for i, cell in enumerate(row):
        label = " ".join(str(cell or "").split()).lower()
        if len(label) < 6:
            continue
        for known, field_name in _NEXT_COLUMNS.items():
            if known.startswith(label):
                found.setdefault(field_name, i)
                break
    if "factory_name" in found and "supplier_vendor" in found:
        return found
    return None


def parse_next_t1_pdf(content: bytes) -> list[dict[str, Any]]:
    """Parse Next plc's tier 1 PDF into its Bangladesh rows.

    Both of Next's layouts are supported because both are still in circulation:
    older files name the country once in a section header row and omit it from the
    rows beneath, while the February 2026 file gives every row its own Country
    column and shifts every other column right by two.

    Reading the header row instead of fixed offsets is what lets one parser handle
    both. The previous version indexed columns positionally, so the new file
    silently produced zero rows: no country header row was ever found, so every
    row was skipped as having no country.
    """
    out: list[dict[str, Any]] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        # The header appears once, on page 1, and governs every later page.
        cols: dict[str, int] | None = None
        for page in pdf.pages:
            section_country: str | None = None
            for table in page.extract_tables() or []:
                for row in table or []:
                    if not row:
                        continue
                    header = _next_header_map(row)
                    if header:
                        cols = header
                        continue
                    marker = _next_country_marker(row)
                    if marker:
                        section_country = marker
                        continue
                    if cols is None:
                        continue

                    def cell(name: str, _row: list[Any] = row) -> str | None:
                        i = cols.get(name)  # type: ignore[union-attr]
                        if i is None or i >= len(_row):
                            return None
                        return " ".join(str(_row[i] or "").split()) or None

                    factory = cell("factory_name")
                    supplier = cell("supplier_vendor")
                    if not factory or not supplier:
                        continue
                    # Per-row country in the new layout; section header in the old.
                    country = cell("country") or section_country
                    if not country or country.lower() != "bangladesh":
                        continue
                    out.append({
                        "factory_name": factory,
                        "supplier_vendor": supplier,
                        "address": cell("address"),
                        "country": country,
                        "products": cell("products"),
                        "female_workers": cell("female_workers"),
                        "male_workers": cell("male_workers"),
                        "trade_union": cell("trade_union"),
                        "workers_committee": cell("workers_committee"),
                    })
    return out


class BrandNextScraper(BrandDisclosureBase):
    code = "brand_next"
    brand_code = "BRAND_NEXT"
    landing_url = "https://www.nextplc.co.uk/corporate-responsibility/our-suppliers"
    # Every PDF on the page; `_is_next_tier1` picks the tier. T1 = direct
    # manufacturers, which is the per-factory authenticity-rule-compliant
    # disclosure. T2/T3 are downstream tiers and must never be substituted.
    file_link_regex = _NEXT_PDF_RE

    @property
    def request_headers(self) -> dict[str, str]:
        # Next's CDN requires a Referer matching the supplier landing page.
        return {**_BROWSER_HEADERS, "Referer": self.landing_url}

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:
        # Discover ALL matching T1 candidates, pick the highest year.
        landing = await self.landing_page()
        pdfs = _collect_candidates(
            landing.text(), self.landing_url, self.file_link_regex
        )
        candidates = [c for c in pdfs if _is_next_tier1(c[0])]
        if not candidates:
            raise RuntimeError(
                f"{self.brand_code}: no T1 PDF link found on {self.landing_url} "
                f"({len(pdfs)} PDFs on the page, none naming tier 1) "
                f"(fetch {landing.fetch_status.value} via {landing.adapter.value})"
            )

        candidates.sort(key=lambda c: _next_t1_year(c[0]), reverse=True)
        url, ext = candidates[0]
        ext = ext or "pdf"

        content, content_type, file_doc = await self.download(url)

        disclosure_date = _next_disclosure_date(content, url)
        self.log.info(
            "brand.discovered", brand=self.brand_code, url=url,
            ext=ext, date=disclosure_date.isoformat(),
            transport=self.active_transport,
        )
        mirror_path = _mirror_path(self.brand_code, disclosure_date, ext)
        mirror_url = await bunny_upload(mirror_path, content, content_type=content_type)

        found = DiscoveredFile(url=url, ext=ext, disclosure_date=disclosure_date)
        rows = parse_next_t1_pdf(content)
        self.log.info(
            "brand.parsed", brand=self.brand_code,
            bd_rows=len(rows), source_url=url,
        )
        self._require_rows(rows, url)
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
                evidence=self._evidence_for(file_doc, row, found),
            )
