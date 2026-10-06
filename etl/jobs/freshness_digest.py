"""The daily ETL freshness digest to Slack (spec-etl-freshness S3, §4.7).

Sanctions and certificate changes are posted the moment they happen (their
runs do it); everything else waits for this one message a day: sources past
their age limit, failures in a row, circuit-breaker stops, and Firecrawl
credits this month against the founder's 1,500 ceiling.

It rides on the every-minute queue tick, not a cron line of its own: the first
tick after DIGEST_HOUR_UTC posts it, and a marker row in `etl_runs`
(`scraper_code = 'freshness_digest'`, status `posted`, never `success`, so the
console's "last successful update" is not faked) stops the other 1,439 ticks.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from psycopg.errors import UndefinedFunction

from etl.core.db import db
from etl.core.logging import get_logger
from etl.core import notify

log = get_logger("etl.freshness_digest")

DIGEST_HOUR_UTC = 3  # 09:00 in Dhaka
CREDIT_CEILING = 1500


def build_digest(rows: list[dict[str, Any]], *, credits_month: int, now: datetime) -> str:
    """The message. Pure, so the wording is pinned by a test."""
    stale = [r for r in rows if r.get("enabled") and r.get("over_sla")]
    failing = [r for r in rows if (r.get("failures_in_row") or 0) > 0]
    tripped = [r for r in rows if r.get("last_breaker_trip")
               and now - r["last_breaker_trip"] < timedelta(days=1)]
    scheduled = sum(1 for r in rows if r.get("enabled"))

    lines = [f":newspaper: SourceBD ETL, {now:%d %b %Y}"]
    if stale:
        lines.append("Past their age limit: " + ", ".join(
            f"{r['scraper_code']} ({_age(r)} old, limit {r['max_age_hours']} h)" for r in stale))
    if failing:
        lines.append("Failing: " + ", ".join(
            f"{r['scraper_code']} ({r['failures_in_row']} in a row)" for r in failing))
    if tripped:
        lines.append("Stopped by the safety limit in the last day: "
                     + ", ".join(r["scraper_code"] for r in tripped)
                     + ". Read the run, then release with --accept-changes.")
    if not (stale or failing or tripped):
        lines.append(f"All {scheduled} scheduled sources are within their age limits; nothing failed.")
    lines.append(f"Firecrawl credits this month: {credits_month:,} of {CREDIT_CEILING:,}.")
    return "\n".join(lines)


def _age(r: dict[str, Any]) -> str:
    if r.get("age_hours") is None:
        return "never read in full"
    hours = float(r["age_hours"])
    return f"{hours:.0f} h" if hours < 72 else f"{hours / 24:.0f} days"


def post_daily_digest_once(now: datetime | None = None) -> bool:
    """Post today's digest if it is due and nobody has posted it. True if posted."""
    now = now or datetime.now(timezone.utc)
    if now.hour < DIGEST_HOUR_UTC:
        return False
    with db.conn() as c, c.cursor() as cur:
        cur.execute("select pg_try_advisory_xact_lock(hashtext('sourcebd.etl.digest')) as ok")
        if not cur.fetchone()["ok"]:
            return False
        cur.execute(
            """select exists (select 1 from public.etl_runs
                               where scraper_code = 'freshness_digest'
                                 and started_at >= date_trunc('day', now())) as done"""
        )
        if cur.fetchone()["done"]:
            return False
        try:
            cur.execute("select * from public.etl_source_freshness()")
        except UndefinedFunction:
            return False  # 0123 not applied yet: no digest, no noise
        rows = cur.fetchall()
        cur.execute(
            """select coalesce(sum(credits_used), 0)::int as n from public.evidence_documents
                where created_at >= date_trunc('month', now())"""
        )
        credits = int(cur.fetchone()["n"])
        cur.execute(
            """insert into public.etl_runs (scraper_code, status, finished_at)
               values ('freshness_digest', 'posted', now())"""
        )
        c.commit()
    notify.slack(build_digest(rows, credits_month=credits, now=now))
    log.info("digest.posted", sources=len(rows), credits=credits)
    return True
