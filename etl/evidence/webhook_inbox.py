"""Process Firecrawl monitor webhook deliveries.

The route at `app/api/v1/webhooks/firecrawl` does the least possible work: it
authenticates the shared secret, writes the delivery to
`public.firecrawl_webhook_events`, and returns 2xx. It has to — Firecrawl retries
anything slower than ten seconds, and re-verifying a page takes longer than that,
so doing the work inline would turn one page change into a pile of duplicate
deliveries.

This module is the other half: the ETL worker drains that inbox. A change on a
monitored index page does not itself prove any citation is wrong, so the
consequence is deliberately modest — the documents behind that URL are moved to
the front of the verify queue by clearing `last_verified_at`, and the verifier
decides. Marking claims stale straight from a webhook would let a cosmetic
redeploy of a registry orphan thousands of facts.
"""
from __future__ import annotations

import json
from typing import Any

from etl.core.db import db
from etl.core.logging import get_logger

log = get_logger("etl.evidence.webhook_inbox")

# Event types that mean the watched page's content moved. Anything else (a
# monitor starting, a check completing unchanged) is recorded and ignored.
CHANGE_EVENTS = frozenset(
    {
        "monitor.page.changed",
        "monitor.page.added",
        "monitor.page.removed",
        "page.changed",
        "changed",
    }
)


def _pending(limit: int) -> list[dict[str, Any]]:
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """select id, event_type, monitor_id, page_url, payload, attempts
                 from public.firecrawl_webhook_events
                where process_status = 'pending'
                order by received_at asc
                for update skip locked
                limit %s""",
            (limit,),
        )
        return list(cur.fetchall())


def _requeue_documents(page_url: str, scraper_code: str | None) -> int:
    """Bring the affected documents forward in the verify queue.

    Clearing `last_verified_at` rather than writing a status is the whole point:
    the webhook says "look again", and only an actual re-fetch may conclude
    anything about a citation. `transient_failures` is reset too, so a page that
    changed after an outage is not still sitting behind a doubled backoff.
    """
    sql = """
    update public.evidence_documents
       set last_verified_at   = null,
           transient_failures = 0,
           updated_at         = now()
     where fetch_status = 'ok'
       and (url = %(url)s or final_url = %(url)s
    """
    params: dict[str, Any] = {"url": page_url}
    if scraper_code:
        # Also sweep the rest of that source's documents: when a registry's list
        # page restructures, its detail pages usually moved too, and they are
        # where the per-supplier citations actually live.
        sql += " or scraper_code = %(scraper_code)s"
        params["scraper_code"] = scraper_code
    sql += ")"

    with db.conn() as c, c.cursor() as cur:
        cur.execute(sql, params)
        count = cur.rowcount or 0
        c.commit()
    return count


def _monitor_scraper_code(monitor_id: str | None, page_url: str | None) -> str | None:
    if not monitor_id and not page_url:
        return None
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """select scraper_code from public.evidence_monitors
                where (monitor_id = %s and %s is not null)
                   or target_url = %s
                limit 1""",
            (monitor_id, monitor_id, page_url),
        )
        row = cur.fetchone()
    return str(row["scraper_code"]) if row else None


def _touch_monitor(monitor_id: str | None, changed: bool) -> None:
    if not monitor_id:
        return
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """update public.evidence_monitors
                  set last_check_at      = now(),
                      last_status        = %s,
                      last_change_at     = case when %s then now() else last_change_at end,
                      consecutive_errors = 0,
                      updated_at         = now()
                where monitor_id = %s""",
            ("changed" if changed else "unchanged", changed, monitor_id),
        )
        c.commit()


def _finish(event_id: str, status: str, error: str | None = None) -> None:
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """update public.firecrawl_webhook_events
                  set process_status = %s,
                      processed_at   = now(),
                      process_error  = %s,
                      attempts       = attempts + 1
                where id = %s""",
            (status, error, event_id),
        )
        c.commit()


def process_pending(limit: int = 100) -> dict[str, int]:
    """Drain the inbox. Returns per-outcome counts."""
    result = {"seen": 0, "requeued_documents": 0, "processed": 0, "ignored": 0, "failed": 0}
    for event in _pending(limit):
        event_id = str(event["id"])
        result["seen"] += 1
        event_type = str(event["event_type"] or "")
        page_url = event["page_url"]
        monitor_id = event["monitor_id"]
        try:
            changed = event_type in CHANGE_EVENTS
            _touch_monitor(monitor_id, changed)
            if not changed or not page_url:
                _finish(event_id, "ignored")
                result["ignored"] += 1
                continue
            scraper_code = _monitor_scraper_code(monitor_id, page_url)
            touched = _requeue_documents(page_url, scraper_code)
            result["requeued_documents"] += touched
            result["processed"] += 1
            _finish(event_id, "processed")
            log.info(
                "webhook.page_changed",
                monitor_id=monitor_id,
                url=page_url,
                scraper=scraper_code,
                documents_requeued=touched,
            )
        except Exception as exc:  # noqa: BLE001
            result["failed"] += 1
            _finish(event_id, "failed", str(exc)[:500])
            log.error("webhook.process_failed", event_id=event_id, error=str(exc)[:300])
    return result


def record_delivery(
    dedupe_key: str,
    event_type: str,
    monitor_id: str | None,
    page_url: str | None,
    payload: dict[str, Any],
) -> bool:
    """Insert one delivery. Returns False when it was a duplicate.

    Used by tests and any non-HTTP replay path; the production write happens in
    the Next.js route so the 10-second budget is not spent reaching the ETL box.
    """
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """insert into public.firecrawl_webhook_events
                 (dedupe_key, event_type, monitor_id, page_url, payload)
               values (%s, %s, %s, %s, %s::jsonb)
               on conflict (dedupe_key) do nothing
               returning id""",
            (dedupe_key, event_type, monitor_id, page_url, json.dumps(payload)),
        )
        row = cur.fetchone()
        c.commit()
    return row is not None
