"""RSC Updates page scraper (Spec 15).

Scrapes the 4 program-area popups on https://rsc-bd.org/updates/ :
  - Inspection and Remediation
  - Boiler Safety
  - OSH Training Programme
  - OSH Complaints

As of May 2026 each modal body contains a single dashboard image (JPG/PNG
published monthly by RSC) rather than an HTML metric table. We therefore
snapshot the image URL per (section × month) as a provenance row in
`rsc_industry_metrics` with `metric_key='dashboard_snapshot_image_url'`,
`value_num=1` (presence flag), `raw_label=<image src>`, `source_url=<image src>`.
Structured numeric extraction from these images is deferred to a future
OCR-enabled spec.

Re-runs are idempotent on (report_month, scope, metric_key, source).
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


def _upsert(month: date, scope: str, key: str, value: float, unit: str,
            raw_label: str, source_url: str = UPDATES_URL) -> None:
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
            (month, scope, key, value, unit, raw_label[:300], source_url),
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

                widgets = page.locator(".elementor-widget-premium-addon-modal-box")
                n_widgets = await widgets.count()
                self.log.info("updates.widgets_found", n=n_widgets)
                for i in range(n_widgets):
                    widget = widgets.nth(i)
                    title_loc = widget.locator(".premium-modal-box-modal-title").first
                    try:
                        title = (await title_loc.inner_text()).strip()
                    except Exception:  # noqa: BLE001
                        title = f"section_{i}"
                    section = _section_for(title)
                    seen += 1
                    trigger = widget.locator(".premium-modal-trigger-container").first
                    modal = widget.locator(".premium-modal-box-modal").first
                    body = widget.locator(".premium-modal-box-modal-body").first
                    try:
                        await trigger.scroll_into_view_if_needed(timeout=5_000)
                        await trigger.click(timeout=5_000, force=True)
                        # wait for the modal to enter the open state
                        try:
                            await modal.wait_for(state="visible", timeout=5_000)
                        except Exception:  # noqa: BLE001
                            pass
                        await page.wait_for_timeout(800)
                        html = await body.inner_html()
                        image_url = _extract_image_url(html)
                        if image_url:
                            _upsert(
                                month, section,
                                "dashboard_snapshot_image_url",
                                1.0, "count", image_url, image_url,
                            )
                            upserted += 1
                            self.log.info(
                                "updates.snapshot",
                                section=section, image=image_url,
                            )
                        else:
                            skipped += 1
                            self.log.warn("updates.no_image", section=section)
                        # close: prefer the explicit close button
                        try:
                            close_btn = widget.locator(".premium-modal-box-modal-close").first
                            await close_btn.click(timeout=2_000, force=True)
                        except Exception:  # noqa: BLE001
                            await page.keyboard.press("Escape")
                        await page.wait_for_timeout(500)
                    except Exception as e:  # noqa: BLE001
                        skipped += 1
                        self.log.error(
                            "updates.section_failed",
                            section=section, error=str(e)[:300],
                        )

                await browser.close()
            self._close_run(run_id, "success", seen, upserted, skipped, None)
        except Exception as e:  # noqa: BLE001
            self._close_run(run_id, "failed", seen, upserted, skipped, str(e))
            raise
        return {"seen": seen, "upserted": upserted, "skipped": skipped}


def _extract_image_url(html: str) -> str | None:
    """Return the first <img src> inside the modal body, if any."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")
    img = soup.find("img")
    if not img:
        return None
    src = img.get("src")
    return src.strip() if src else None
