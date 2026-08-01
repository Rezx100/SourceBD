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

# The per-page `status` values in a `monitor.page` delivery that mean the
# watched page's content moved. Everything else (`same`, `error`, a bare
# `monitor.check.completed`) is recorded and ignored — the requeue decision
# turns on this vocabulary, so a value missing here is silently classed as
# "nothing moved".
CHANGE_STATUSES = frozenset({"changed", "new", "removed"})


def _page_entries(payload: Any) -> list[dict[str, Any]]:
    """The per-page entries of a delivery. `data` is an array in the real
    contract; an object is tolerated, anything else means no entries."""
    if not isinstance(payload, dict):
        return []
    data = payload.get("data")
    if isinstance(data, list):
        return [e for e in data if isinstance(e, dict)]
    if isinstance(data, dict):
        return [data]
    return []


def _entry_status(event: dict[str, Any]) -> str:
    """The `status` of the page entry this row was recorded from.

    The route writes one row per `data[i]`, carrying that entry's `monitorId`
    and `url` in the columns, so the entry is found back by matching them.
    Classifying on the envelope alone is impossible — the root `type` is
    `monitor.page` whether the page changed or not.
    """
    entries = _page_entries(event.get("payload"))
    if not entries:
        return ""
    page_url = event.get("page_url")
    monitor_id = event.get("monitor_id")
    chosen: dict[str, Any] | None = None
    for entry in entries:
        if page_url and entry.get("url") == page_url:
            chosen = entry
            break
    if chosen is None:
        for entry in entries:
            if monitor_id and entry.get("monitorId") == monitor_id:
                chosen = entry
                break
    if chosen is None:
        if len(entries) != 1:
            return ""
        chosen = entries[0]
    return str(chosen.get("status") or "")


def _pending(cur: Any, limit: int) -> list[dict[str, Any]]:
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


def _requeue_documents(cur: Any, page_url: str, scraper_code: str | None) -> int:
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

    cur.execute(sql, params)
    return cur.rowcount or 0


def _monitor_scraper_code(cur: Any, monitor_id: str | None, page_url: str | None) -> str | None:
    if not monitor_id and not page_url:
        return None
    cur.execute(
        # The bare `%s is not null` guard needs an explicit cast: unlike the
        # column comparisons, it gives Postgres no type context, so psycopg's
        # server-side binding raises IndeterminateDatatype on $2. Mocked-cursor
        # unit tests cannot see this — only a real drain can (found 2 Aug 2026
        # by the REZ-34 activation runbook's first live delivery).
        """select scraper_code from public.evidence_monitors
            where (monitor_id = %s and %s::text is not null)
               or target_url = %s
            limit 1""",
        (monitor_id, monitor_id, page_url),
    )
    row = cur.fetchone()
    return str(row["scraper_code"]) if row else None


def _touch_monitor(cur: Any, monitor_id: str | None, status: str) -> None:
    """Record the monitor's heartbeat and what its last check concluded.

    A change status moves `last_change_at`; an `error` status increments
    `consecutive_errors` instead of resetting it, so a monitor that fails every
    check surfaces as erroring in the health strip rather than looking quiet.
    """
    if not monitor_id:
        return
    cur.execute(
        """update public.evidence_monitors
              set last_check_at      = now(),
                  last_status        = %s,
                  last_change_at     = case when %s then now() else last_change_at end,
                  consecutive_errors = case when %s
                                            then consecutive_errors + 1
                                            else 0 end,
                  updated_at         = now()
            where monitor_id = %s""",
        (status, status in CHANGE_STATUSES, status == "error", monitor_id),
    )


def _finish(cur: Any, event_id: str, status: str, error: str | None = None) -> None:
    cur.execute(
        """update public.firecrawl_webhook_events
              set process_status = %s,
                  processed_at   = now(),
                  process_error  = %s,
                  attempts       = attempts + 1
            where id = %s""",
        (status, error, event_id),
    )


def process_pending(limit: int = 100) -> dict[str, int]:
    """Drain the inbox. Returns per-outcome counts.

    REZ-42: the claiming transaction is held for the whole drain — claim with
    `FOR UPDATE SKIP LOCKED`, process, mark, one commit. The old shape claimed
    in one transaction and processed in follow-up ones, so the row locks were
    released before the work began and two overlapping drains (the minutely
    cron plus a manual run) could both act on the same delivery. A batch is a
    few hundred local UPDATEs, so the transaction stays short; a delivery that
    arrives mid-drain is picked up by the next pass a minute later.
    """
    result = {"seen": 0, "requeued_documents": 0, "processed": 0, "ignored": 0, "failed": 0}
    with db.conn() as c, c.cursor() as cur:
        for event in _pending(cur, limit):
            event_id = str(event["id"])
            result["seen"] += 1
            event_type = str(event.get("event_type") or "")
            page_url = event.get("page_url")
            monitor_id = event.get("monitor_id")
            try:
                status = _entry_status(event)
                if not status and event_type == "monitor.check.completed":
                    # A check ran and reported nothing per-page: heartbeat only.
                    status = "same"

                if status in CHANGE_STATUSES:
                    _touch_monitor(cur, monitor_id, status)
                    if not page_url:
                        # Guessing which documents were meant would requeue the
                        # wrong ones.
                        _finish(cur, event_id, "ignored")
                        result["ignored"] += 1
                        continue
                    scraper_code = _monitor_scraper_code(cur, monitor_id, page_url)
                    touched = _requeue_documents(cur, page_url, scraper_code)
                    result["requeued_documents"] += touched
                    result["processed"] += 1
                    _finish(cur, event_id, "processed")
                    log.info(
                        "webhook.page_changed",
                        monitor_id=monitor_id,
                        url=page_url,
                        scraper=scraper_code,
                        documents_requeued=touched,
                    )
                    continue

                if status == "error":
                    _touch_monitor(cur, monitor_id, "error")
                elif status:
                    _touch_monitor(cur, monitor_id, status)
                else:
                    # No per-page status to classify on: the heartbeat is still
                    # recorded, so "this monitor has not checked in for a week"
                    # stays answerable — but nothing is requeued on a guess.
                    _touch_monitor(cur, monitor_id, "unchanged")
                _finish(cur, event_id, "ignored")
                result["ignored"] += 1
            except Exception as exc:  # noqa: BLE001
                result["failed"] += 1
                _finish(cur, event_id, "failed", str(exc)[:500])
                log.error("webhook.process_failed", event_id=event_id, error=str(exc)[:300])
        c.commit()
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
