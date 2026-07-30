"""Admin-controlled scraper queue runner.

The web app writes queue/schedule rows through admin RPCs. This module is run
from the ETL container on the VPS by cron.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, TypedDict

from etl.core.db import db
from etl.core.logging import get_logger
from etl.scrapers.registry import RUNNABLE

log = get_logger("etl.jobs.scraper_queue")


class QueueJob(TypedDict):
    id: str
    scraper_code: str


def enqueue_due_schedules(limit: int | None = None) -> dict[str, int]:
    """Create pending queue jobs for enabled schedules whose timer is due."""
    sql_limit = "" if limit is None else "limit %s"
    params: tuple[int, ...] = () if limit is None else (limit,)
    enqueued = 0
    skipped_existing = 0

    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            f"""
            select scraper_code, interval_minutes, coalesce(updated_by, created_by) as requested_by
              from public.etl_schedules
             where enabled = true
               and next_run_at is not null
               and next_run_at <= now()
             order by next_run_at asc
             for update skip locked
             {sql_limit}
            """,
            params,
        )
        schedules = cur.fetchall()
        for schedule in schedules:
            scraper_code = str(schedule["scraper_code"])
            cur.execute(
                """
                select id
                  from public.etl_job_queue
                 where scraper_code = %s
                   and status in ('pending', 'running')
                 order by requested_at desc
                 limit 1
                """,
                (scraper_code,),
            )
            existing = cur.fetchone()
            if existing:
                skipped_existing += 1
            else:
                cur.execute(
                    """
                    insert into public.etl_job_queue (
                      scraper_code,
                      priority,
                      requested_by,
                      metadata
                    )
                    values (%s, 100, %s, %s::jsonb)
                    """,
                    (
                        scraper_code,
                        schedule["requested_by"],
                        json.dumps(
                            {
                                "source": "schedule",
                                "interval_minutes": schedule["interval_minutes"],
                            }
                        ),
                    ),
                )
                cur.execute(
                    """
                    insert into public.etl_job_events (
                      job_id, scraper_code, event_type, message, meta
                    )
                    select id, scraper_code, 'queued', 'Timer queued this scraper run.', metadata
                      from public.etl_job_queue
                     where scraper_code = %s
                       and status = 'pending'
                     order by requested_at desc
                     limit 1
                    """,
                    (scraper_code,),
                )
                enqueued += 1

            cur.execute(
                """
                update public.etl_schedules
                   set last_enqueued_at = now(),
                       next_run_at = now() + make_interval(mins => interval_minutes)
                 where scraper_code = %s
                """,
                (scraper_code,),
            )
        c.commit()

    log.info("schedules.enqueued", enqueued=enqueued, skipped_existing=skipped_existing)
    return {"enqueued": enqueued, "skipped_existing": skipped_existing}


def run_queue(limit: int = 1) -> dict[str, int]:
    """Run up to `limit` pending scraper jobs."""
    processed = 0
    failed = 0

    for _ in range(max(0, limit)):
        job = _claim_next_job()
        if job is None:
            break
        try:
            _run_job(job)
            processed += 1
        except Exception as exc:  # noqa: BLE001
            failed += 1
            log.error("job.failed", job_id=job["id"], scraper_code=job["scraper_code"], error=str(exc))

    return {"processed": processed, "failed": failed}


def _claim_next_job() -> QueueJob | None:
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """
            select id, scraper_code
              from public.etl_job_queue
             where status = 'pending'
             order by priority asc, requested_at asc
             for update skip locked
             limit 1
            """
        )
        row = cur.fetchone()
        if row is None:
            c.commit()
            return None
        cur.execute(
            """
            update public.etl_job_queue
               set status = 'running',
                   started_at = now(),
                   finished_at = null,
                   attempts = attempts + 1,
                   error = null
             where id = %s
            """,
            (row["id"],),
        )
        cur.execute(
            """
            insert into public.etl_job_events (
              job_id,
              scraper_code,
              event_type,
              message
            )
            values (%s, %s, 'claimed', 'The VPS worker picked up this scraper run.')
            """,
            (row["id"], row["scraper_code"]),
        )
        c.commit()
        return {"id": str(row["id"]), "scraper_code": str(row["scraper_code"])}


def _run_job(job: QueueJob) -> None:
    scraper_code = job["scraper_code"]
    scraper_cls = RUNNABLE.get(scraper_code)
    if scraper_cls is None:
        _mark_failed(job["id"], f"unknown scraper_code: {scraper_code}")
        return

    scraper = scraper_cls()
    scraper.progress_callback = lambda event: _record_progress_event(job["id"], event)
    log.info("job.start", job_id=job["id"], scraper_code=scraper_code)
    try:
        result = asyncio.run(scraper.run())
    except Exception as exc:  # noqa: BLE001
        _mark_failed(job["id"], str(exc), getattr(scraper, "last_run_id", None))
        raise

    _mark_success(job["id"], result, getattr(scraper, "last_run_id", None))
    log.info("job.success", job_id=job["id"], scraper_code=scraper_code, result=result)


def _mark_success(job_id: str, result: dict[str, int], etl_run_id: str | None) -> None:
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """
            update public.etl_job_queue
               set status = 'success',
                   finished_at = now(),
                   etl_run_id = %s,
                   error = null,
                   progress_seen = %s,
                   progress_upserted = %s,
                   progress_skipped = %s,
                   progress_matched = %s,
                   progress_message = 'Finished successfully.',
                   heartbeat_at = now(),
                   metadata = coalesce(metadata, '{}'::jsonb) || %s::jsonb
             where id = %s
            """,
            (
                etl_run_id,
                result.get("seen", 0),
                result.get("upserted", 0),
                result.get("skipped", 0),
                result.get("matched", 0),
                json.dumps({"result": result}),
                job_id,
            ),
        )
        c.commit()


def _mark_failed(job_id: str, error: str, etl_run_id: str | None = None) -> None:
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """
            update public.etl_job_queue
               set status = 'failed',
                   finished_at = now(),
                   etl_run_id = coalesce(%s, etl_run_id),
                   error = %s,
                   progress_message = %s,
                   heartbeat_at = now()
             where id = %s
            """,
            (etl_run_id, error[:4000], "Failed. Review the error and retry when ready.", job_id),
        )
        cur.execute(
            """
            insert into public.etl_job_events (
              job_id,
              etl_run_id,
              scraper_code,
              event_type,
              message
            )
            select id, %s, scraper_code, 'failed', %s
              from public.etl_job_queue
             where id = %s
            """,
            (etl_run_id, error[:4000], job_id),
        )
        c.commit()


def _record_progress_event(job_id: str, event: dict[str, Any]) -> None:
    etl_run_id = event.get("etl_run_id")
    scraper_code = str(event.get("scraper_code") or "")
    event_type = str(event.get("event_type") or "progress")
    message = str(event.get("message") or "Progress updated.")
    seen = _int_value(event.get("records_seen"))
    upserted = _int_value(event.get("records_upserted"))
    skipped = _int_value(event.get("records_skipped"))
    matched = _int_value(event.get("records_matched"))
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """
            update public.etl_job_queue
               set etl_run_id = coalesce(%s, etl_run_id),
                   progress_seen = %s,
                   progress_upserted = %s,
                   progress_skipped = %s,
                   progress_matched = %s,
                   progress_message = %s,
                   heartbeat_at = now()
             where id = %s
            """,
            (etl_run_id, seen, upserted, skipped, matched, message, job_id),
        )
        cur.execute(
            """
            insert into public.etl_job_events (
              job_id,
              etl_run_id,
              scraper_code,
              event_type,
              message,
              records_seen,
              records_upserted,
              records_skipped,
              records_matched,
              meta
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            """,
            (
                job_id,
                etl_run_id,
                scraper_code,
                event_type,
                message[:1000],
                seen,
                upserted,
                skipped,
                matched,
                json.dumps({k: v for k, v in event.items() if k not in {"message"}}),
            ),
        )
        c.commit()


def _int_value(value: object) -> int:
    return value if isinstance(value, int) and value >= 0 else 0
