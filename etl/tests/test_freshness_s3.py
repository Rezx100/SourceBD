"""ETL freshness S3: the daily digest, retries with dead letter, and the
claim's concurrency bound (etl/jobs/freshness_digest.py, scraper_queue.py)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from etl.jobs import freshness_digest as fd
from etl.jobs import scraper_queue as sq
from etl.tests.conftest import FakeConn, FakeDb

NOW = datetime(2026, 10, 7, 3, 5, tzinfo=timezone.utc)


def _row(**over: Any) -> dict[str, Any]:
    base = {"scraper_code": "x", "enabled": True, "max_age_hours": 48, "age_hours": 3,
            "over_sla": False, "failures_in_row": 0, "last_breaker_trip": None}
    return {**base, **over}


def test_digest_names_what_needs_a_look():
    text = fd.build_digest([
        _row(scraper_code="wrap", max_age_hours=72, age_hours=2472, over_sla=True),
        _row(scraper_code="gots", failures_in_row=2),
        _row(scraper_code="bgmea_web", last_breaker_trip=NOW - timedelta(hours=2)),
        _row(scraper_code="rsc", enabled=False, over_sla=True),
    ], credits_month=312, now=NOW)
    assert "Past their age limit: wrap (103 days old, limit 72 h)" in text
    assert "rsc" not in text.split("Past their age limit:")[1].split("\n")[0], "a source that is off is not nagged"
    assert "Failing: gots (2 in a row)" in text
    assert "safety limit in the last day: bgmea_web" in text
    assert text.endswith("Firecrawl credits this month: 312 of 1,500.")


def test_digest_says_all_is_well_when_it_is():
    text = fd.build_digest([_row(), _row(enabled=False)], credits_month=0, now=NOW)
    assert "All 1 scheduled sources are within their age limits; nothing failed." in text


class Cur:
    def __init__(self, attempts: int | None) -> None:
        self.attempts = attempts
        self.executed: list[tuple[str, Any]] = []
        self._sql = ""

    def execute(self, sql: str, params: Any = None) -> None:
        self._sql = sql
        self.executed.append((sql, params))

    def fetchone(self):
        if "select attempts" in self._sql:
            return None if self.attempts is None else {"attempts": self.attempts, "scraper_code": "gots"}
        return None

    def fetchall(self):
        return []

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _fail(monkeypatch, attempts: int | None):
    cur = Cur(attempts)
    posts: list[str] = []
    monkeypatch.setattr(sq, "db", FakeDb(FakeConn(cur)))
    monkeypatch.setattr("etl.core.notify.slack", posts.append)
    sq._mark_failed("job-1", "boom")
    return cur, posts


def test_a_first_failure_is_retried_after_a_backoff(monkeypatch):
    cur, posts = _fail(monkeypatch, attempts=1)
    retry = [p for s, p in cur.executed if "set status = 'pending'" in s]
    assert retry and retry[0][3] == 15
    assert not any("set status = 'failed'" in s for s, _ in cur.executed)
    assert posts == []


def test_the_second_retry_waits_an_hour(monkeypatch):
    cur, _ = _fail(monkeypatch, attempts=2)
    assert [p for s, p in cur.executed if "set status = 'pending'" in s][0][3] == 60


def test_the_third_failure_is_dead_lettered_and_told(monkeypatch):
    cur, posts = _fail(monkeypatch, attempts=3)
    assert any("set status = 'failed'" in s for s, _ in cur.executed)
    assert posts and "failed 3 times" in posts[0]


def test_the_claim_bounds_concurrency_and_honours_retry_after(monkeypatch):
    cur = Cur(None)
    monkeypatch.setattr(sq, "db", FakeDb(FakeConn(cur)))
    assert sq._claim_next_job() is None
    sqls = [s for s, _ in cur.executed]
    assert "pg_advisory_xact_lock" in sqls[0]
    claim = sqls[1]
    assert "r.status = 'running') < %s" in claim
    assert "r.scraper_code = q.scraper_code" in claim
    assert "retry_after" in claim
    assert cur.executed[1][1] == (sq.MAX_RUNNING,)
