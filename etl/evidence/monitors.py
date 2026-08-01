"""Firecrawl monitors on the index pages that matter.

The `verify-evidence` sweep is the long tail: it re-checks tens of thousands of
per-supplier documents on a weekly cadence, which is right for them but far too
slow for the handful of pages a whole source hangs off. When BGMEA restructures
its member list, every one of ~4,300 detail-page citations behind it is at risk,
and waiting a week to find out is waiting a week too long.

So the ~20 index pages — registry list pages, sanctions list pages, brand landing
pages, the RSC reports index — get a Firecrawl `/v2/monitor` entry that checks on
a schedule and webhooks us the moment the page changes. That is the early-warning
tier; it is what buys time before citations rot rather than after.

Targets come from each source's own `monitor_targets()`, not a list kept here.
A separate list would silently stop covering a source the day it changed its
entry point, which is exactly the failure the monitors exist to catch.
"""
from __future__ import annotations

import json
from typing import Any
from urllib.parse import urljoin

from etl.acquire import FirecrawlAdapter
from etl.acquire.firecrawl import FirecrawlNotConfigured
from etl.core.config import settings
from etl.core.db import db
from etl.core.logging import get_logger
from etl.core.scraper import ScrapedRecord

log = get_logger("etl.evidence.monitors")

WEBHOOK_PATH = "/api/v1/webhooks/firecrawl"
# Daily. An index page restructure is a rare, high-impact event; checking more
# often would spend credits to shorten an already-short detection window.
DEFAULT_SCHEDULE = "daily"


def webhook_url() -> str | None:
    """Absolute webhook URL, or None when the base is not configured.

    Registering a monitor without a reachable webhook would produce a monitor
    that detects changes and tells nobody, which looks healthy in the Firecrawl
    console and is worse than having no monitor at all.
    """
    base = (settings.firecrawl_webhook_base_url or "").strip()
    if not base:
        return None
    return urljoin(base.rstrip("/") + "/", WEBHOOK_PATH.lstrip("/"))


def planned_targets() -> list[dict[str, str]]:
    """Every (scraper_code, url) pair that should have a monitor."""
    from etl.scrapers.registry import SCRAPERS

    out: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for code, cls in SCRAPERS.items():
        targets = cls.monitor_targets() if hasattr(cls, "monitor_targets") else ()
        for url in targets:
            key = (code, url)
            if not url or key in seen:
                continue
            seen.add(key)
            out.append({"scraper_code": code, "target_url": url, "name": f"sourcebd:{code}"})
    return out


def _monitor_spec(target: dict[str, str], hook: str) -> dict[str, Any]:
    """The real `/v2/monitor` schema.

    Targets are an array of typed entries, the schedule is an object with a
    `text` field, and the webhook must subscribe to events explicitly —
    `monitor.page` is the per-URL change notification. Sending the shorthand
    `{urls, schedule: "daily"}` shape gets a 400, which is how six phantom
    monitors with NULL ids were "created" on 30 Jul 2026.
    """
    return {
        "name": target["name"],
        "targets": [
            {
                "type": "scrape",
                "urls": [target["target_url"]],
                "scrapeOptions": {
                    "formats": ["markdown"],
                    # Registry tables live outside the main content block, and
                    # Firecrawl defaults this to true. Left at the default, every
                    # monitor would compare a stripped page against a stripped
                    # page and never notice the table changing.
                    "onlyMainContent": False,
                },
            }
        ],
        "schedule": {"text": DEFAULT_SCHEDULE},
        "webhook": {
            "url": hook,
            # Shared secret in a header rather than a query string, so it does
            # not end up in Firecrawl's or our own request logs.
            "headers": {"X-SourceBD-Webhook-Secret": settings.firecrawl_webhook_secret},
            # Without an explicit subscription the monitor would check and tell
            # nobody, which is the failure this whole tier exists to prevent.
            "events": ["monitor.page"],
        },
    }


def _upsert_local(
    target: dict[str, str], monitor_id: str | None, meta: dict[str, Any]
) -> None:
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """insert into public.evidence_monitors
                 (monitor_id, name, scraper_code, target_url, schedule_text, meta)
               values (%s, %s, %s, %s, %s, %s::jsonb)
               on conflict (scraper_code, target_url) do update set
                 monitor_id    = coalesce(excluded.monitor_id, public.evidence_monitors.monitor_id),
                 name          = excluded.name,
                 schedule_text = excluded.schedule_text,
                 enabled       = true,
                 meta          = public.evidence_monitors.meta || excluded.meta,
                 updated_at    = now()""",
            (
                monitor_id,
                target["name"],
                target["scraper_code"],
                target["target_url"],
                DEFAULT_SCHEDULE,
                json.dumps(meta),
            ),
        )
        c.commit()


def _existing_ids() -> dict[tuple[str, str], str | None]:
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            "select scraper_code, target_url, monitor_id from public.evidence_monitors"
        )
        return {
            (str(r["scraper_code"]), str(r["target_url"])): r["monitor_id"]
            for r in cur.fetchall()
        }


async def refresh_monitors(
    dry_run: bool = False,
    progress_callback: Any | None = None,
) -> dict[str, Any]:
    """Reconcile Firecrawl monitors with what the sources declare.

    Idempotent: a target that already has a monitor id is left alone rather than
    re-registered, so running this on every deploy does not accumulate duplicate
    monitors all webhooking the same change.

    `progress_callback`, when given, is invoked once per reconciled target with
    (message, seen, upserted, skipped) so a queue-dispatched run keeps its
    heartbeat fresh; the CLI passes nothing.
    """
    targets = planned_targets()
    hook = webhook_url()
    result: dict[str, Any] = {
        "planned": len(targets),
        "created": 0,
        "existing": 0,
        "skipped": 0,
        "failed": 0,
    }

    if not settings.firecrawl_api_key:
        result["error"] = "FIRECRAWL_API_KEY not set"
        log.warning("monitors.unconfigured", reason="missing_api_key")
        return result
    if not hook:
        result["error"] = "FIRECRAWL_WEBHOOK_BASE_URL not set"
        log.warning("monitors.unconfigured", reason="missing_webhook_base")
        return result
    if not settings.firecrawl_webhook_secret:
        # Without the shared secret the route would have to accept unauthenticated
        # posts, which is an open write path into our verification queue.
        result["error"] = "FIRECRAWL_WEBHOOK_SECRET not set"
        log.warning("monitors.unconfigured", reason="missing_webhook_secret")
        return result

    # Before touching the database. A dry run is what you reach for to check the
    # plan on a machine where migration 0084 has not been applied yet, so making
    # it depend on `evidence_monitors` existing would break it exactly when it is
    # most useful.
    if dry_run:
        result["skipped"] = len(targets)
        result["targets"] = targets
        return result

    known = _existing_ids()
    adapter = FirecrawlAdapter()
    try:
        for index, target in enumerate(targets, start=1):
            key = (target["scraper_code"], target["target_url"])
            if known.get(key):
                result["existing"] += 1
            else:
                try:
                    payload = await adapter.create_monitor(_monitor_spec(target, hook))
                except (FirecrawlNotConfigured, RuntimeError) as exc:
                    result["failed"] += 1
                    log.error(
                        "monitors.create_failed",
                        scraper=target["scraper_code"],
                        url=target["target_url"],
                        error=str(exc)[:300],
                    )
                else:
                    monitor_id = _extract_monitor_id(payload)
                    _upsert_local(target, monitor_id, {"registered_webhook": hook})
                    result["created"] += 1
                    log.info(
                        "monitors.created",
                        scraper=target["scraper_code"],
                        url=target["target_url"],
                        monitor_id=monitor_id,
                    )
            if progress_callback is not None:
                progress_callback(
                    f"Reconciled {index} of {len(targets)} monitors.",
                    index,
                    result["created"],
                    result["existing"] + result["skipped"],
                )
    finally:
        await adapter.aclose()
    return result


def _extract_monitor_id(payload: dict[str, Any]) -> str | None:
    for key in ("id", "monitorId", "monitor_id"):
        value = payload.get(key)
        if value:
            return str(value)
    data = payload.get("data")
    if isinstance(data, dict):
        return _extract_monitor_id(data)
    return None


class RefreshMonitorsJob:
    """Schedulable wrapper, so monitor upkeep runs from the admin queue too."""

    code = "refresh_monitors"
    source_code = ""
    transport = "firecrawl"
    progress_callback: Any | None = None

    def __init__(self, dry_run: bool = False) -> None:
        self.log = get_logger("etl.scraper.refresh_monitors")
        self.dry_run = dry_run
        self.last_run_id: str | None = None

    async def fetch(self):  # pragma: no cover - not a source
        if False:
            yield ScrapedRecord(source_code="", source_ref="", company_name="")

    def _emit_progress(self, message: str, seen: int, upserted: int, skipped: int) -> None:
        """Heartbeat for the queue runner; a no-op from the CLI (no callback)."""
        if self.progress_callback is None:
            return
        self.progress_callback(
            {
                "etl_run_id": self.last_run_id,
                "scraper_code": self.code,
                "event_type": "progress",
                "message": message,
                "records_seen": seen,
                "records_upserted": upserted,
                "records_skipped": skipped,
                "records_matched": 0,
            }
        )

    async def run(self) -> dict[str, Any]:
        run_id = self._open_run()
        self._emit_progress("Refreshing monitors.", 0, 0, 0)
        try:
            result = await refresh_monitors(
                dry_run=self.dry_run,
                progress_callback=self._emit_progress,
            )
        except Exception as exc:  # noqa: BLE001
            self._close_run(run_id, "failed", 0, 0, str(exc))
            raise
        # An unconfigured environment is a failed run, not a silent success: a
        # green tick here would mean "monitoring is on" when nothing is watching.
        status = "failed" if result.get("error") else "success"
        self._close_run(
            run_id,
            status,
            int(result.get("planned", 0)),
            int(result.get("created", 0)),
            result.get("error"),
        )
        return {
            "seen": result.get("planned", 0),
            "upserted": result.get("created", 0),
            "skipped": result.get("existing", 0) + result.get("skipped", 0),
            **result,
        }

    def _open_run(self) -> str:
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """insert into public.etl_runs (scraper_code, status)
                   values (%s, 'running') returning id""",
                (self.code,),
            )
            run_id = str(cur.fetchone()["id"])
            self.last_run_id = run_id
            c.commit()
        return run_id

    def _close_run(
        self, run_id: str, status: str, seen: int, created: int, error: str | None
    ) -> None:
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """update public.etl_runs
                     set finished_at      = now(),
                         status           = %s,
                         records_seen     = %s,
                         records_upserted = %s,
                         error            = %s
                   where id = %s""",
                (status, seen, created, error, run_id),
            )
            c.commit()
        self.log.info("run.end", run_id=run_id, status=status, seen=seen, created=created)


__all__ = [
    "DEFAULT_SCHEDULE",
    "RefreshMonitorsJob",
    "WEBHOOK_PATH",
    "planned_targets",
    "refresh_monitors",
    "webhook_url",
]
