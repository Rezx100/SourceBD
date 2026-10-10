"""Admin-controlled scraper queue runner.

The web app writes queue/schedule rows through admin RPCs. This module is run
from the ETL container on the VPS by cron.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, TypedDict

from etl.core.config import settings
from etl.core.db import db
from etl.core.logging import get_logger
from etl.scrapers.registry import RUNNABLE

log = get_logger("etl.jobs.scraper_queue")

# S3 (spec-etl-freshness §4.2, §4.7). Cron starts a worker every minute and a
# run can last hours, so the claim is where concurrency is bounded: at most
# MAX_RUNNING jobs at once and never two of one scraper. A failed job is
# retried after a backoff, then dead-lettered (failed, and Slack is told).
MAX_RUNNING = 2
MAX_ATTEMPTS = 3
RETRY_BACKOFF_MINUTES = (15, 60)  # after attempt 1, after attempt 2


class QueueJob(TypedDict, total=False):
    id: str
    scraper_code: str
    accept_changes: bool
    accept_delistings: bool


def _release_flags(row: dict[str, Any]) -> dict[str, bool]:
    """A job may carry the founder's release (`run <code> --accept-changes
    --accept-delistings`) in its metadata: the Needs-you buttons on
    /admin/sources, or a service-key insert. Honoured only when no signed-in
    user requested it or the requester is an admin today (`requester_role`,
    read at claim time, so a demoted account's old job releases nothing)."""
    meta = row.get("metadata") or {}
    if row.get("requested_by") is not None and row.get("requester_role") != "admin":
        return {"accept_changes": False, "accept_delistings": False}
    return {"accept_changes": meta.get("accept_changes") is True,
            "accept_delistings": meta.get("accept_delistings") is True}


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
                # Advance the timer only when a job was actually enqueued. On a
                # skip the schedule stays due, so it catches up on the next
                # cron minute once the reaper clears the blocking job — rather
                # than silently sliding past the interval it never ran.
                cur.execute(
                    """
                    update public.etl_schedules
                       set last_enqueued_at = now(),
                           -- S3 (§4.1): a schedule with a window starts in it, plus
                           -- jitter, so runs do not drift round the clock.
                           next_run_at = case
                             when metadata ? 'run_window_utc' then
                               date_trunc('day', now() + make_interval(mins => interval_minutes))
                               + make_interval(hours => (metadata ->> 'run_window_utc')::int)
                               + make_interval(mins => floor(random() * coalesce(
                                   (metadata ->> 'jitter_minutes')::int, 15))::int)
                             else now() + make_interval(mins => interval_minutes)
                           end
                     where scraper_code = %s
                    """,
                    (scraper_code,),
                )
                enqueued += 1

        c.commit()

    log.info("schedules.enqueued", enqueued=enqueued, skipped_existing=skipped_existing)
    return {"enqueued": enqueued, "skipped_existing": skipped_existing}


def reap_stale(stale_after_hours: float) -> dict[str, int]:
    """Fail queue jobs and orphaned runs whose worker died mid-run.

    Workers are ephemeral `docker compose run` containers; when one dies
    between _open_run() and _close_run() nothing else ever writes the terminal
    state, so without this pass a dead job blocks its schedule forever. Runs at
    the top of every run_queue() call in one transaction and raises on failure,
    so the cron's notify_etl_fail alert fires rather than the queue running on
    top of a broken reaper.

    A queue-backed run's liveness is its job's heartbeat, so the NOT EXISTS
    exemption is load-bearing: a run with a pending/running job is never reaped
    from under a living worker. Only truly orphaned runs (CLI-opened, or their
    job long terminal) age out on started_at. Pending jobs are never reaped —
    pending means the worker never arrived, which is an alerting problem.
    """
    hours = float(stale_after_hours)
    job_error = f"reaped: no heartbeat for >{hours:g}h (worker died)"
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            # `%s * interval '1 hour'`, not make_interval(hours => %s): the
            # hours argument is int-only on real Postgres, so a float bind
            # raises 42883 — and mocked-cursor tests never parse the SQL.
            """
            update public.etl_job_queue
               set status = 'failed',
                   finished_at = now(),
                   error = %s,
                   progress_message = 'Reaped as stale. Retry when ready.',
                   heartbeat_at = now()
             where status = 'running'
               and coalesce(heartbeat_at, started_at, requested_at)
                   < now() - (%s * interval '1 hour')
            returning id, scraper_code, etl_run_id
            """,
            (job_error, hours),
        )
        reaped_jobs = cur.fetchall()
        for job in reaped_jobs:
            cur.execute(
                """
                insert into public.etl_job_events (
                  job_id,
                  etl_run_id,
                  scraper_code,
                  event_type,
                  message
                )
                values (%s, %s, %s, 'failed', %s)
                """,
                (
                    str(job["id"]),
                    job["etl_run_id"],
                    str(job["scraper_code"]),
                    f"Reaped: no heartbeat for >{hours:g}h (worker died).",
                ),
            )
        run_ids = [str(job["etl_run_id"]) for job in reaped_jobs if job["etl_run_id"]]
        linked_reaped = 0
        if run_ids:
            cur.execute(
                """
                update public.etl_runs
                   set status = 'failed',
                       finished_at = now(),
                       error = %s
                 where status = 'running'
                   and id = any(%s::uuid[])
                """,
                (job_error, run_ids),
            )
            linked_reaped = cur.rowcount or 0
        cur.execute(
            """
            update public.etl_runs r
               set status = 'failed',
                   finished_at = now(),
                   error = 'reaped: run orphaned (process died)'
             where r.status = 'running'
               and r.started_at < now() - (%s * interval '1 hour')
               and not exists (
                     select 1
                       from public.etl_job_queue q
                      where q.etl_run_id = r.id
                        and q.status in ('pending', 'running')
                   )
            """,
            (hours,),
        )
        orphan_reaped = cur.rowcount or 0
        c.commit()
    jobs_reaped = len(reaped_jobs)
    runs_reaped = linked_reaped + orphan_reaped
    log.info("reaper.reaped", jobs_reaped=jobs_reaped, runs_reaped=runs_reaped)
    return {"jobs_reaped": jobs_reaped, "runs_reaped": runs_reaped}


def run_queue(limit: int = 1) -> dict[str, int]:
    """Run up to `limit` pending scraper jobs."""
    # Reap before claiming, outside the per-job try/except: a reaper failure
    # must propagate so the cron's Slack alert fires.
    reap_stale(settings.etl_reap_stale_hours)
    # C2: reviewed holds land within a minute rather than at the source's
    # next read. Best-effort: a replay problem must not stop the queue.
    try:
        from etl.core.hold import replay_decided

        replay_decided()
    except Exception as exc:  # noqa: BLE001
        log.error("hold.replay_batch_failed", error=str(exc))
    # S3: the daily freshness digest rides on the minute tick (no extra cron).
    try:
        from etl.jobs.freshness_digest import post_daily_digest_once

        post_daily_digest_once()
    except Exception as exc:  # noqa: BLE001
        log.error("digest.failed", error=str(exc))
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
        # One claimer at a time, so two overlapping ticks cannot both see a
        # free slot. Held for this short transaction only.
        cur.execute("select pg_advisory_xact_lock(hashtext('sourcebd.etl.claim'))")
        cur.execute(
            """
            select id, scraper_code, requested_by, metadata,
                   (select p.role::text from public.profiles p where p.id = q.requested_by)
                     as requester_role
              from public.etl_job_queue q
             where status = 'pending'
               and coalesce((metadata ->> 'retry_after')::timestamptz, '-infinity') <= now()
               and (select count(*) from public.etl_job_queue r where r.status = 'running') < %s
               and not exists (
                     select 1 from public.etl_job_queue r
                      where r.status = 'running' and r.scraper_code = q.scraper_code)
             order by priority asc, requested_at asc
             for update skip locked
             limit 1
            """,
            (MAX_RUNNING,),
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
                   error = null,
                   heartbeat_at = now()
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
        return {"id": str(row["id"]), "scraper_code": str(row["scraper_code"]),
                **_release_flags(row)}


def _run_job(job: QueueJob) -> None:
    scraper_code = job["scraper_code"]
    scraper_cls = RUNNABLE.get(scraper_code)
    if scraper_cls is None:
        _mark_failed(job["id"], f"unknown scraper_code: {scraper_code}")
        return

    scraper = scraper_cls()
    if job.get("accept_changes"):
        scraper.accept_changes = True
    if job.get("accept_delistings") and hasattr(scraper, "accept_delistings"):
        scraper.accept_delistings = True
    scraper.progress_callback = lambda event: _record_progress_event(job["id"], event)
    log.info("job.start", job_id=job["id"], scraper_code=scraper_code)
    try:
        result = asyncio.run(scraper.run())
    except Exception as exc:  # noqa: BLE001
        _mark_failed(job["id"], str(exc), getattr(scraper, "last_run_id", None))
        raise

    _mark_success(job["id"], result, getattr(scraper, "last_run_id", None))
    log.info("job.success", job_id=job["id"], scraper_code=scraper_code, result=result)
    try:
        _chain_after(scraper_code, result)
    except Exception as exc:  # noqa: BLE001 - a follow-up must not fail the run
        log.error("job.chain_failed", scraper_code=scraper_code, error=str(exc))


def _follow_ups(scraper_code: str, result: dict[str, Any]) -> list[tuple[str, int | None]]:
    """What a successful run starts next (spec-etl-freshness §4.1, §5): pure.

    Nothing changed means nothing follows. A supplier source that upserted
    something asks for the SBI recompute, at most once a day; an RSC read that
    changed something asks for its documents (new inspection URLs only).
    """
    from etl.core.scraper import BaseScraper
    from etl.scrapers.registry import SCRAPERS

    if int(result.get("upserted") or 0) <= 0:
        return []
    out: list[tuple[str, int | None]] = []
    if scraper_code == "rsc":
        out.append(("rsc_documents", None))
    cls = SCRAPERS.get(scraper_code)
    if cls is not None and isinstance(cls, type) and issubclass(cls, BaseScraper):
        out.append(("sbi_recompute", 24))
    return out


def _chain_after(scraper_code: str, result: dict[str, Any]) -> None:
    for code, debounce_hours in _follow_ups(scraper_code, result):
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """
                insert into public.etl_job_queue (scraper_code, priority, metadata)
                select %s, 100, jsonb_build_object('source', 'chain', 'after', %s::text)
                 where not exists (
                   select 1 from public.etl_job_queue q
                    where q.scraper_code = %s
                      and (q.status in ('pending', 'running')
                           or (%s::int is not null
                               and q.requested_at > now() - make_interval(hours => %s::int))))
                returning id
                """,
                (code, scraper_code, code, debounce_hours, debounce_hours or 0),
            )
            if cur.fetchone():
                log.info("job.chained", after=scraper_code, queued=code)
            c.commit()


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
               and status = 'running'
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
            "select attempts, scraper_code from public.etl_job_queue where id = %s and status = 'running'",
            (job_id,),
        )
        row = cur.fetchone()
        if row is not None and int(row["attempts"] or 0) < MAX_ATTEMPTS:
            minutes = RETRY_BACKOFF_MINUTES[min(int(row["attempts"] or 1), len(RETRY_BACKOFF_MINUTES)) - 1]
            cur.execute(
                """
                update public.etl_job_queue
                   set status = 'pending',
                       started_at = null,
                       etl_run_id = coalesce(%s, etl_run_id),
                       error = %s,
                       progress_message = %s,
                       metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
                         'retry_after', now() + make_interval(mins => %s)),
                       heartbeat_at = now()
                 where id = %s
                """,
                (etl_run_id, error[:4000], f"Failed; retrying in {minutes} minutes.", minutes, job_id),
            )
            cur.execute(
                """
                insert into public.etl_job_events (job_id, etl_run_id, scraper_code, event_type, message)
                values (%s, %s, %s, 'retry', %s)
                """,
                (job_id, etl_run_id, row["scraper_code"], f"Retry in {minutes} min: {error[:3800]}"),
            )
            c.commit()
            return
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
               and status = 'running'
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
    if row is not None:
        from etl.core.notify import slack

        slack(
            f":x: SourceBD: {row['scraper_code']} failed {MAX_ATTEMPTS} times and has stopped "
            f"retrying (job {job_id}): {error[:300]}"
        )


def _record_progress_event(job_id: str, event: dict[str, Any]) -> None:
    etl_run_id = event.get("etl_run_id")
    scraper_code = str(event.get("scraper_code") or "")
    event_type = str(event.get("event_type") or "progress")
    message = str(event.get("message") or "Progress updated.")
    seen = _int_value(event.get("records_seen"))
    upserted = _int_value(event.get("records_upserted"))
    skipped = _int_value(event.get("records_skipped"))
    matched = _int_value(event.get("records_matched"))
    if event_type == "heartbeat":
        # Alive, nothing more: the run's own progress figures and event log stay
        # as its last real progress event left them.
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """
                update public.etl_job_queue
                   set etl_run_id = coalesce(%s, etl_run_id),
                       progress_message = %s,
                       heartbeat_at = now()
                 where id = %s
                """,
                (etl_run_id, message, job_id),
            )
            c.commit()
        return
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
