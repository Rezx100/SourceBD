"""RSC monthly report scraper (Spec 15).

Pipeline per month:
  1. List PDFs from https://rsc-bd.org/reports/  (and quarterly/annual sections).
  2. Download each PDF to etl/raw/rsc_reports/<filename>.
  3. Parse with pdfplumber → industry-aggregate KPIs (text-narrative + tables).
  4. Upsert into rsc_industry_metrics (idempotent on report_month + metric_key).
  5. Catalog every PDF in rsc_monthly_reports.

This scraper is conservative: it extracts only well-known KPIs we can match with
high confidence. Anything ambiguous is skipped (no garbage metrics). Re-runs are
safe.

Bunny CDN mirroring is deferred to Spec 13 (compliance documents) — for now
source_url is the rsc-bd.org URL.
"""
from __future__ import annotations

import asyncio
import hashlib
import re
import ssl
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import AsyncIterator, Iterable

import certifi
import httpx
import pdfplumber
from bs4 import BeautifulSoup

from etl.core.config import settings
from etl.core.db import db
from etl.core.logging import get_logger
from etl.core.scraper import BaseScraper, ScrapedRecord

log = get_logger("etl.scraper.rsc_reports")

REPORTS_INDEX_URL = "https://rsc-bd.org/reports/"
RAW_DIR = settings.etl_raw_dir / "rsc_reports"

# rsc-bd.org serves only the leaf cert and omits the Sectigo intermediate, so
# Python/httpx (no AIA chasing) fails verification even with certifi. We fetch
# the intermediate via the AIA URL embedded in the leaf cert and append it to
# a custom SSL context. The intermediate itself chains up to a root that IS in
# certifi, so the resulting trust decision is still strict.
_RSC_INTERMEDIATE_URL = (
    "http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt"
)


def _build_rsc_ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context(cafile=certifi.where())
    try:
        r = httpx.get(_RSC_INTERMEDIATE_URL, timeout=30)
        r.raise_for_status()
        try:
            pem = ssl.DER_cert_to_PEM_cert(r.content)
        except Exception:  # noqa: BLE001
            pem = r.text
        ctx.load_verify_locations(cadata=pem)
    except Exception as exc:  # noqa: BLE001
        log.warn("ssl.intermediate_fetch_failed", error=str(exc))
    return ctx

_MONTHS = {
    m.lower(): i + 1
    for i, m in enumerate(
        [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ]
    )
}

_FILENAME_RE = re.compile(
    r"(?P<month>January|February|March|April|May|June|July|August|September|October|November|December)"
    r"[-_ ]?(?P<year>20\d{2})",
    re.IGNORECASE,
)


@dataclass
class ReportRef:
    title: str
    url: str
    report_month: date | None  # None when it's a quarterly/annual aggregate
    source_kind: str           # 'rsc_monthly_report' | 'rsc_quarterly_report' | 'rsc_annual_report'


# --------------------------------------------------------------------------- #
# Discovery
# --------------------------------------------------------------------------- #

async def discover_reports(client: httpx.AsyncClient) -> list[ReportRef]:
    """Fetch the reports page and enumerate every PDF link by section."""
    r = await client.get(REPORTS_INDEX_URL, timeout=60)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")

    refs: list[ReportRef] = []
    seen_urls: set[str] = set()

    # Walk headings to know which section a link belongs to.
    current_kind = "rsc_monthly_report"
    for el in soup.find_all(["h1", "h2", "h3", "h4", "h5", "a"]):
        if el.name in {"h1", "h2", "h3", "h4", "h5"}:
            text = el.get_text(" ", strip=True).lower()
            if "annual" in text:
                current_kind = "rsc_annual_report"
            elif "quarterly" in text:
                current_kind = "rsc_quarterly_report"
            elif "monthly" in text or re.match(r"^\s*20\d{2}\s*$", text):
                current_kind = "rsc_monthly_report"
            continue

        href = el.get("href") or ""
        if not href.lower().endswith(".pdf"):
            continue
        if href in seen_urls:
            continue
        seen_urls.add(href)

        # Title: prefer a nearby h4/h5 with the report name.
        title = el.get_text(" ", strip=True) or href.rsplit("/", 1)[-1]
        if not title or title.lower() in {"read more", ""}:
            # Look up to 3 prev siblings/parents for an <h4>/<h5>
            cand = el.find_previous(["h4", "h5"])
            if cand:
                title = cand.get_text(" ", strip=True)

        # Derive month from URL/filename or the title.
        month = _parse_month(href) or _parse_month(title)
        refs.append(
            ReportRef(
                title=title or href,
                url=href,
                report_month=month,
                source_kind=current_kind,
            )
        )
    return refs


def _parse_month(s: str) -> date | None:
    m = _FILENAME_RE.search(s)
    if not m:
        return None
    return date(int(m.group("year")), _MONTHS[m.group("month").lower()], 1)


# --------------------------------------------------------------------------- #
# Download + catalog
# --------------------------------------------------------------------------- #

async def download_pdf(client: httpx.AsyncClient, ref: ReportRef) -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    fname = ref.url.rsplit("/", 1)[-1]
    dest = RAW_DIR / fname
    if dest.exists() and dest.stat().st_size > 1000:
        return dest
    async with client.stream("GET", ref.url, timeout=120) as resp:
        resp.raise_for_status()
        with open(dest, "wb") as f:
            async for chunk in resp.aiter_bytes(64 * 1024):
                f.write(chunk)
    return dest


def _sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _catalog_report(ref: ReportRef, path: Path, status: str, error: str | None) -> None:
    if ref.report_month is None:
        return  # only catalog datable monthly reports here
    sha = _sha256(path) if path.exists() else None
    size = path.stat().st_size if path.exists() else None
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """insert into public.rsc_monthly_reports
                 (report_month, title, source_url, file_sha256, byte_size,
                  parsed_at, parse_status, parse_error)
               values (%s,%s,%s,%s,%s, now(), %s, %s)
               on conflict (report_month) do update set
                 title         = excluded.title,
                 source_url    = excluded.source_url,
                 file_sha256   = excluded.file_sha256,
                 byte_size     = excluded.byte_size,
                 parsed_at     = now(),
                 parse_status  = excluded.parse_status,
                 parse_error   = excluded.parse_error""",
            (ref.report_month, ref.title, ref.url, sha, size, status, error),
        )
        c.commit()


# --------------------------------------------------------------------------- #
# PDF parsing — narrative + table KPIs
# --------------------------------------------------------------------------- #

# (regex, scope, metric_key, unit) — anchored on phrases that appear consistently
# across the RSC monthly report corpus (2022→present).
_NARRATIVE_PATTERNS: list[tuple[re.Pattern[str], str, str, str]] = [
    (re.compile(r"([\d,]+)\s+factories?\s+have\s+approved\s+FADS\s+designs", re.I),
        "fads", "fads_approved_factories", "count"),
    (re.compile(r"([\d,]+)\s+factories?\s+are\s+in\s+the\s+installation\s+stage", re.I),
        "fads", "fads_installation_stage_factories", "count"),
    (re.compile(r"([\d,]+)\s+factories?\s+have\s+completed\s+installation", re.I),
        "fads", "fads_installation_completed_factories", "count"),
    (re.compile(r"([\d,]+)\s+factories?\s+are\s+undergoing\s+the\s+CAP\s+development", re.I),
        "fads", "fads_cap_development_factories", "count"),
    (re.compile(r"([\d,]+)\s+factories?\s+(?:are\s+)?covered", re.I),
        "coverage", "covered_factories", "count"),
]

# Table-row label → (scope, metric_key, unit). Lowercased + stripped + de-bulleted.
_TABLE_LABELS: dict[str, tuple[str, str, str]] = {
    "total no. of covered factory":
        ("inspection_remediation", "total_covered_factory", "count"),
    "brand factory":
        ("inspection_remediation", "brand_factory", "count"),
    "independent/no brand factory":
        ("inspection_remediation", "independent_factory", "count"),
    "factories initially inspected":
        ("inspection_remediation", "factories_initially_inspected", "count"),
    "factories waiting for inspection":
        ("inspection_remediation", "factories_waiting_for_inspection", "count"),
    "no. of factories where >90% initial issue remediated":
        ("inspection_remediation", "factories_gt90pct_remediated", "count"),
    "no. of factories 100% completed initial findings and received recognition letter":
        ("inspection_remediation", "factories_recognition_letter", "count"),
    "initial remediation progress rate (fire, electrical & structural)":
        ("inspection_remediation", "initial_remediation_progress_rate_pct", "pct"),
    "total inspection number -fire, electrical and structural":
        ("inspection_remediation", "total_inspection_number_month", "count"),
    "number of unique factories covered through inspection":
        ("inspection_remediation", "unique_factories_covered_month", "count"),
    "initial inspections findings progress rate - electrical":
        ("inspection_remediation", "initial_findings_progress_electrical_pct", "pct"),
    "initial inspections findings progress rate - fire":
        ("inspection_remediation", "initial_findings_progress_fire_pct", "pct"),
    "initial inspections findings progress rate - structural":
        ("inspection_remediation", "initial_findings_progress_structural_pct", "pct"),
    "follow-up inspections findings progress rate - electrical":
        ("inspection_remediation", "followup_findings_progress_electrical_pct", "pct"),
    "follow-up inspections findings progress rate - fire":
        ("inspection_remediation", "followup_findings_progress_fire_pct", "pct"),
    "follow-up inspections findings progress rate - structural":
        ("inspection_remediation", "followup_findings_progress_structural_pct", "pct"),
    "current escalation status - stage 1":
        ("escalation", "stage_1_factories", "count"),
    "current escalation status - stage 2":
        ("escalation", "stage_2_factories", "count"),
    "current escalation status - stage 3":
        ("escalation", "stage_3_factories", "count"),
}


def _to_num(txt: str) -> float | None:
    if txt is None:
        return None
    s = txt.strip().replace(",", "").rstrip("%")
    try:
        return float(s)
    except ValueError:
        return None


def _norm_label(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("–", "-").replace("—", "-")).strip(" -•").lower()


def parse_pdf(path: Path) -> list[dict]:
    """Return a list of metric dicts: {scope, metric_key, value_num, unit, raw_label}."""
    out: list[dict] = []
    seen: set[tuple[str, str]] = set()

    def _add(scope: str, key: str, value: float | None, unit: str, raw: str) -> None:
        if value is None:
            return
        if (scope, key) in seen:
            return
        seen.add((scope, key))
        out.append(
            {
                "scope": scope,
                "metric_key": key,
                "value_num": value,
                "unit": unit,
                "raw_label": raw[:300],
            }
        )

    with pdfplumber.open(path) as pdf:
        # 1) narrative regex over full text
        full_text = "\n".join((p.extract_text() or "") for p in pdf.pages)
        for pat, scope, key, unit in _NARRATIVE_PATTERNS:
            m = pat.search(full_text)
            if m:
                _add(scope, key, _to_num(m.group(1)), unit, m.group(0))

        # 2) table parsing — flatten 2-col tables to (label, value) pairs
        current_section: str | None = None
        for page in pdf.pages:
            for tbl in page.extract_tables() or []:
                for row in tbl:
                    cells = [(c or "").strip() for c in row]
                    if not any(cells):
                        continue
                    if len(cells) < 2:
                        continue
                    label = _norm_label(cells[0])
                    val_txt = cells[-1].strip()
                    val = _to_num(val_txt)

                    # Detect section headers (no numeric value present)
                    if val is None and label in {
                        "inspection status",
                        "initial inspections findings progress rate",
                        "follow-up inspections findings progress rate",
                        "current escalation status",
                    }:
                        current_section = label
                        continue

                    # If row is a sub-bullet under a known section, expand label
                    composite = label
                    if current_section and label in {
                        "electrical", "fire", "structural", "stage 1", "stage 2", "stage 3",
                    }:
                        composite = f"{current_section} - {label}"

                    spec = _TABLE_LABELS.get(composite)
                    if not spec:
                        continue
                    scope, key, unit = spec
                    _add(scope, key, val, unit, cells[0])
    return out


def upsert_metrics(report_month: date, source_url: str, metrics: Iterable[dict]) -> int:
    n = 0
    with db.conn() as c, c.cursor() as cur:
        for m in metrics:
            cur.execute(
                """insert into public.rsc_industry_metrics
                     (report_month, scope, metric_key, value_num, unit, raw_label,
                      source, source_url)
                   values (%s,%s,%s,%s,%s,%s,'rsc_monthly_report',%s)
                   on conflict (report_month, scope, metric_key, source) do update set
                     value_num   = excluded.value_num,
                     unit        = excluded.unit,
                     raw_label   = excluded.raw_label,
                     source_url  = excluded.source_url,
                     fetched_at  = now()""",
                (report_month, m["scope"], m["metric_key"], m["value_num"],
                 m["unit"], m["raw_label"], source_url),
            )
            n += 1
        c.commit()
    return n


# --------------------------------------------------------------------------- #
# Scraper class
# --------------------------------------------------------------------------- #

class RscReportsScraper(BaseScraper):
    code = "rsc_reports"
    source_code = "RSC"

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:  # not used; we override run()
        if False:
            yield  # type: ignore[unreachable]

    async def run(self) -> dict[str, int]:  # type: ignore[override]
        run_id = self._open_run()
        seen = upserted = skipped = 0
        try:
            async with httpx.AsyncClient(
                headers={"User-Agent": settings.etl_user_agent},
                follow_redirects=True,
                verify=_build_rsc_ssl_context(),
            ) as client:
                refs = await discover_reports(client)
                self.log.info("discover.done", n_pdfs=len(refs))

                for ref in refs:
                    seen += 1
                    if ref.report_month is None:
                        # Quarterly/annual aggregates: just record provenance, skip parsing.
                        skipped += 1
                        continue
                    try:
                        path = await download_pdf(client, ref)
                        metrics = await asyncio.to_thread(parse_pdf, path)
                        if not metrics:
                            _catalog_report(ref, path, "failed", "no metrics extracted")
                            skipped += 1
                            self.log.warn("parse.empty", url=ref.url)
                            continue
                        n = upsert_metrics(ref.report_month, ref.url, metrics)
                        _catalog_report(ref, path, "parsed", None)
                        upserted += 1
                        self.log.info(
                            "report.parsed",
                            month=ref.report_month.isoformat(),
                            metrics=n,
                            url=ref.url,
                        )
                    except Exception as e:  # noqa: BLE001
                        skipped += 1
                        try:
                            _catalog_report(ref, RAW_DIR / ref.url.rsplit("/", 1)[-1],
                                            "failed", str(e)[:500])
                        except Exception:  # noqa: BLE001
                            pass
                        self.log.error("report.failed", url=ref.url, error=str(e))

            self._close_run(run_id, "success", seen, upserted, skipped, None)
        except Exception as e:  # noqa: BLE001
            self._close_run(run_id, "failed", seen, upserted, skipped, str(e))
            raise
        return {"seen": seen, "upserted": upserted, "skipped": skipped}
