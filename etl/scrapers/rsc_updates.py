"""RSC Updates page scraper (Spec 15).

Scrapes the 4 program-area popups on https://rsc-bd.org/updates/ :
  - Inspection and Remediation
  - Boiler Safety
  - OSH Training Programme
  - OSH Complaints

Each popup contains a 2-column "metric / current value" table that is updated
roughly monthly. We snapshot it as the *current* month (today's 1st-of-month)
under source = 'rsc_updates_page'. Re-runs are idempotent on
(report_month, scope, metric_key, source).

Strategy: generic table extraction — every row with a numeric right cell becomes
a metric, keyed by (section_slug, label_slug). No fixed dictionary so we don't
silently drop anything when RSC adds rows.
"""
from __future__ import annotations

import re
from datetime import date
from typing import AsyncIterator

from etl.core.config import settings
from etl.core.db import db
from etl.core.scraper import BaseScraper, ScrapedRecord

UPDATES_URL = "https://rsc-bd.org/updates/"

_SECTION_SLUGS = {
    "inspection and remediation":   "inspection_remediation",
    "boiler safety":                "boiler_safety",
    "osh training programme":       "osh_training",
    "osh training program":         "osh_training",
    "osh complaints":               "osh_complaints",
    "safety and health complaints": "osh_complaints",
}


def _slug(s: str) -> str:
    s = s.lower().strip(" -•:")
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return re.sub(r"_+", "_", s).strip("_")


def _to_num(txt: str) -> tuple[float | None, str]:
    """Return (numeric_value, unit). unit ∈ {'count','pct'}."""
    if txt is None:
        return None, "count"
    raw = txt.strip()
    is_pct = raw.endswith("%")
    s = raw.replace(",", "").rstrip("%").strip()
    try:
        return float(s), ("pct" if is_pct else "count")
    except ValueError:
        return None, "count"


def _section_for(title: str) -> str:
    norm = re.sub(r"\s+", " ", title.lower()).strip()
    for k, v in _SECTION_SLUGS.items():
        if k in norm:
            return v
    return _slug(title) or "unknown"


def _upsert(month: date, scope: str, key: str, value: float, unit: str, raw_label: str) -> None:
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """insert into public.rsc_industry_metrics
                 (report_month, scope, metric_key, value_num, unit, raw_label,
                  source, source_url)
               values (%s,%s,%s,%s,%s,%s,'rsc_updates_page',%s)
               on conflict (report_month, scope, metric_key, source) do update set
                 value_num   = excluded.value_num,
                 unit        = excluded.unit,
                 raw_label   = excluded.raw_label,
                 source_url  = excluded.source_url,
                 fetched_at  = now()""",
            (month, scope, key, value, unit, raw_label[:300], UPDATES_URL),
        )
        c.commit()


class RscUpdatesScraper(BaseScraper):
    code = "rsc_updates"
    source_code = "RSC"

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:  # not used
        if False:
            yield  # type: ignore[unreachable]

    async def run(self) -> dict[str, int]:  # type: ignore[override]
        from playwright.async_api import async_playwright

        run_id = self._open_run()
        seen = upserted = skipped = 0
        # Snapshot under "first of current month".
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).date()
        month = today.replace(day=1)
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=settings.etl_playwright_headless)
                ctx = await browser.new_context(user_agent=settings.etl_user_agent)
                page = await ctx.new_page()
                await page.goto(UPDATES_URL, wait_until="networkidle", timeout=120_000)

                # Each program area is a card with a clickable image/title.
                cards = page.locator(".et_pb_blurb_container, .et_pb_image_container, h5, h4")
                # Click through known section titles.
                titles = [
                    "INSPECTION AND REMEDIATION",
                    "Boiler Safety",
                    "OSH Training Programme",
                    "OSH Complaints",
                ]
                for title in titles:
                    seen += 1
                    section = _section_for(title)
                    try:
                        # Click the card with this title (text-based locator).
                        loc = page.get_by_text(title, exact=False).first
                        await loc.scroll_into_view_if_needed(timeout=5_000)
                        await loc.click(timeout=5_000)
                        await page.wait_for_timeout(800)

                        # Modal contains a table — grab all rows.
                        modal = page.locator(".et_pb_module_inner, .pum-content, .modal, body").first
                        html = await modal.inner_html()
                        rows = _extract_rows(html)
                        if not rows:
                            self.log.warn("updates.no_rows", section=section)
                            skipped += 1
                            continue
                        n = 0
                        for label, val_txt in rows:
                            value, unit = _to_num(val_txt)
                            if value is None:
                                continue
                            _upsert(month, section, _slug(label), value, unit, label)
                            n += 1
                        upserted += 1
                        self.log.info("updates.parsed", section=section, metrics=n)

                        # Close modal (esc).
                        await page.keyboard.press("Escape")
                        await page.wait_for_timeout(300)
                    except Exception as e:  # noqa: BLE001
                        skipped += 1
                        self.log.error("updates.section_failed", section=section, error=str(e))

                await browser.close()
            self._close_run(run_id, "success", seen, upserted, skipped, None)
        except Exception as e:  # noqa: BLE001
            self._close_run(run_id, "failed", seen, upserted, skipped, str(e))
            raise
        return {"seen": seen, "upserted": upserted, "skipped": skipped}


def _extract_rows(html: str) -> list[tuple[str, str]]:
    """Pull (label, value) tuples from any 2-col table in `html`."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")
    out: list[tuple[str, str]] = []
    for tbl in soup.find_all("table"):
        for tr in tbl.find_all("tr"):
            cells = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
            if len(cells) < 2:
                continue
            label = cells[0]
            value = cells[-1]
            if not label or not value:
                continue
            # skip header rows
            if value.lower().strip() in {"value", "total", "current"}:
                continue
            out.append((label, value))
    return out
