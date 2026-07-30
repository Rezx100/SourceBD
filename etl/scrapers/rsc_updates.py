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

Transport: Firecrawl. The four dashboards live inside Elementor Premium modal
boxes that must be opened before their bodies are readable, which is what the
local Playwright driver did. A single `executeJavascript` action now performs the
same open/read/close walk inside Firecrawl's browser and hands back the modal
HTML, so the extraction below is unchanged and the Playwright dependency is gone.
"""
from __future__ import annotations

import json
import re
from datetime import date
from typing import AsyncIterator

from etl.acquire import AcquiredDoc, AcquireRequest
from etl.core.acquiring import AcquiringScraper
from etl.core.db import db
from etl.core.scraper import ScrapedRecord

UPDATES_URL = "https://rsc-bd.org/updates/"

# Elementor Premium modal-box selectors. Kept in one place because they are the
# whole contract with the page and will need updating if RSC rebuilds it.
_WIDGET_SEL = ".elementor-widget-premium-addon-modal-box"
_TITLE_SEL = ".premium-modal-box-modal-title"
_TRIGGER_SEL = ".premium-modal-trigger-container"
_BODY_SEL = ".premium-modal-box-modal-body"
_CLOSE_SEL = ".premium-modal-box-modal-close"

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


def _build_modal_script() -> str:
    """Open each modal box in turn and return its title plus body HTML.

    Mirrors the old Playwright walk step for step: scroll, click, wait, read,
    close. Returning raw HTML (rather than the image URL) keeps extraction in
    Python where it is unit-tested.
    """
    return f"""
(async () => {{
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const widgets = Array.from(document.querySelectorAll({json.dumps(_WIDGET_SEL)}));
  const out = [];
  for (let i = 0; i < widgets.length; i++) {{
    const w = widgets[i];
    const titleEl = w.querySelector({json.dumps(_TITLE_SEL)});
    const title = titleEl ? titleEl.innerText.trim() : ('section_' + i);
    let body_html = null;
    let error = null;
    try {{
      const trigger = w.querySelector({json.dumps(_TRIGGER_SEL)});
      if (trigger) {{
        trigger.scrollIntoView({{ block: 'center' }});
        trigger.click();
        await sleep(1200);
      }}
      const body = w.querySelector({json.dumps(_BODY_SEL)});
      body_html = body ? body.innerHTML : null;
      const close = w.querySelector({json.dumps(_CLOSE_SEL)});
      if (close) {{ close.click(); }}
      await sleep(400);
    }} catch (e) {{
      error = String(e);
    }}
    out.push({{ title, body_html, error }});
  }}
  return out;
}})()
"""


class RscUpdatesScraper(AcquiringScraper):
    code = "rsc_updates"
    source_code = "RSC"
    transport = "firecrawl"
    # No fallback: without a browser to open the modals there is nothing to read,
    # and a plain fetch would report zero dashboards rather than a failed run.
    fallback_transport = None
    monitor_urls = (UPDATES_URL,)
    # `run()` writes the dashboard tables directly; `fetch()` is a stub.
    yields_records = False

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:  # not used
        if False:
            yield  # type: ignore[unreachable]

    async def run(self) -> dict[str, int]:  # type: ignore[override]
        from etl.evidence.writer import reset_document_cache

        run_id = self._open_run()
        reset_document_cache()
        seen = upserted = skipped = 0
        # Snapshot under "first of current month".
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).date()
        month = today.replace(day=1)
        try:
            doc = await self.acquire(
                AcquireRequest(
                    url=UPDATES_URL,
                    only_main_content=False,
                    actions=(
                        {"type": "wait", "milliseconds": 3000},
                        {"type": "executeJavascript", "script": _build_modal_script()},
                    ),
                    label="RSC updates dashboards",
                )
            )
            if not doc.ok:
                raise RuntimeError(
                    f"rsc_updates: {UPDATES_URL} unreadable "
                    f"({doc.fetch_status.value}: {doc.error_message})"
                )

            sections = doc.js_returns[0] if doc.js_returns else None
            if not isinstance(sections, list):
                raise RuntimeError(
                    "rsc_updates: modal walk returned nothing. Refusing to "
                    "report a successful run with zero dashboards."
                )
            self.log.info("updates.widgets_found", n=len(sections))

            for entry in sections:
                if not isinstance(entry, dict):
                    continue
                title = str(entry.get("title") or "").strip()
                section = _section_for(title)
                seen += 1
                if entry.get("error"):
                    skipped += 1
                    self.log.error(
                        "updates.section_failed",
                        section=section, error=str(entry["error"])[:300],
                    )
                    continue
                image_url = _extract_image_url(str(entry.get("body_html") or ""))
                if not image_url:
                    skipped += 1
                    self.log.warning("updates.no_image", section=section)
                    continue
                _upsert(
                    month, section,
                    "dashboard_snapshot_image_url",
                    1.0, "count", image_url, image_url,
                )
                upserted += 1
                await self._cite_snapshot(doc, month, section, image_url, run_id)
                self.log.info("updates.snapshot", section=section, image=image_url)

            self._close_run(run_id, "success", seen, upserted, skipped, None)
        except Exception as e:  # noqa: BLE001
            self._close_run(run_id, "failed", seen, upserted, skipped, str(e))
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

    async def _cite_snapshot(
        self,
        doc: AcquiredDoc,
        month: date,
        section: str,
        image_url: str,
        run_id: str,
    ) -> None:
        from etl.evidence.writer import record

        try:
            doc_id, claims = await record(
                doc,
                scraper_code=self.code,
                source_code=self.source_code,
                subject_table="rsc_industry_metrics",
                subject_id=None,
                subject_key=f"report_month={month.isoformat()}&scope={section}",
                payload={"dashboard_snapshot_image_url": image_url},
                source_tier="tier2_industry",
                etl_run_id=run_id,
                locators={
                    "dashboard_snapshot_image_url": (
                        f"'{section}' modal body, dashboard image"
                    )
                },
                document_text=image_url,
            )
        except Exception as exc:  # noqa: BLE001
            self.log.error("evidence.record_failed", section=section, error=str(exc))
            return
        if doc_id:
            if doc_id not in self._evidence_doc_ids:
                self._evidence_doc_ids.add(doc_id)
                self.credits_used += doc.credits_used
            self.evidence_claims += claims


def _extract_image_url(html: str) -> str | None:
    """Return the first dashboard image URL inside the modal body, if any.

    Elementor defers images behind `data-src`/`data-lazy-src` until they scroll
    into view, and a modal that was opened programmatically may never trigger
    that. Checking the lazy attributes as well avoids reading a placeholder as
    "no dashboard published this month".
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")
    for img in soup.find_all("img"):
        for attr in ("src", "data-src", "data-lazy-src", "data-large_image"):
            src = (img.get(attr) or "").strip()
            if src and not src.startswith("data:"):
                return src
    return None
