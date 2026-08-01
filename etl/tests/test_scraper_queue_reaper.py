"""The stale-heartbeat reaper and the invariants that make it safe (REZ-31).

Workers are ephemeral `docker compose run` containers; when one dies between
_open_run() and _close_run() nothing else writes the terminal state, and the
dead job blocks its schedule forever. Three properties have to hold together,
and none is visible from a green run:

* the reaper fails only what is provably dead — a stale coalesced heartbeat for
  jobs, age plus no live queue job for runs — and does it in one transaction
  that raises on failure, so the cron's Slack alert fires;
* every long-running job heartbeats, so a healthy multi-hour batch is never
  reaped (the reaper without universal heartbeats would kill live work);
* a skipped schedule keeps its timer, so a blocked interval catches up after
  the reaper clears the block instead of silently sliding past it.
"""
from __future__ import annotations

import asyncio
from typing import Any

import pytest

from etl.evidence import monitors as mmod
from etl.evidence import verifier as vmod
from etl.jobs import scraper_queue as sq


# ------------------------------------------------------------- fake db ----
class _FakeCursor:
    def __init__(self, store: dict[str, Any]) -> None:
        self.store = store
        self.rowcount = 0
        self._rows: list[dict[str, Any]] = []

    def execute(self, sql: str, params: Any = None) -> None:
        normalised = " ".join(sql.split())
        self.store.setdefault("sql", []).append((normalised, params))
        self._rows = []
        self.rowcount = 0
        for needle, rows in self.store.get("returns", {}).items():
            if needle in normalised:
                self._rows = list(rows)
                break
        for needle, count in self.store.get("rowcounts", {}).items():
            if needle in normalised:
                self.rowcount = count
                break

    def fetchall(self):
        return self._rows

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class _FakeConn:
    def __init__(self, store: dict[str, Any]) -> None:
        self.store = store

    def cursor(self):
        return _FakeCursor(self.store)

    def commit(self):
        self.store["commits"] = self.store.get("commits", 0) + 1

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class _FakeDb:
    def __init__(self, store: dict[str, Any]) -> None:
        self.store = store

    def conn(self):
        self.store["connections"] = self.store.get("connections", 0) + 1
        return _FakeConn(self.store)


def _with_fake_db(monkeypatch: pytest.MonkeyPatch, store: dict[str, Any]) -> None:
    monkeypatch.setattr(sq, "db", _FakeDb(store))


def _statements(store: dict[str, Any], needle: str) -> list[tuple[str, Any]]:
    return [(sql, params) for sql, params in store["sql"] if needle in sql]


# ---------------------------------------------------------------- reaper ----
def test_a_stale_running_job_is_reaped_with_an_event_and_its_run_failed(
    monkeypatch: pytest.MonkeyPatch,
):
    run_id = "11111111-1111-1111-1111-111111111111"
    store: dict[str, Any] = {
        "returns": {
            "returning id, scraper_code, etl_run_id": [
                {"id": "job-1", "scraper_code": "rsc", "etl_run_id": run_id},
                {"id": "job-2", "scraper_code": "rsc_documents", "etl_run_id": None},
            ],
        },
        "rowcounts": {"id = any(%s::uuid[])": 1, "not exists": 5},
    }
    _with_fake_db(monkeypatch, store)

    result = sq.reap_stale(3)

    assert result == {"jobs_reaped": 2, "runs_reaped": 6}

    job_update_sql, job_update_params = store["sql"][0]
    assert "update public.etl_job_queue" in job_update_sql
    assert "set status = 'failed'" in job_update_sql
    assert "finished_at = now()" in job_update_sql
    assert "heartbeat_at = now()" in job_update_sql
    assert "where status = 'running'" in job_update_sql
    assert job_update_params[0] == "reaped: no heartbeat for >3h (worker died)"
    assert job_update_params[1] == 3.0

    events = _statements(store, "insert into public.etl_job_events")
    assert len(events) == 2, "one event row per reaped job"
    event_sql, event_params = events[0]
    assert "'failed'" in event_sql
    assert event_params[0] == "job-1"
    assert event_params[1] == run_id
    assert event_params[2] == "rsc"
    assert event_params[3].startswith("Reaped:")
    # The second reaped job died before its first progress event, so it has no
    # run yet; the event must not invent one.
    assert events[1][1][1] is None

    linked = _statements(store, "id = any(%s::uuid[])")
    assert len(linked) == 1
    linked_sql, linked_params = linked[0]
    assert "update public.etl_runs" in linked_sql
    assert "where status = 'running'" in linked_sql
    assert linked_params[0] == "reaped: no heartbeat for >3h (worker died)"
    assert linked_params[1] == [run_id]

    # One transaction, one connection, exactly one commit at the end.
    assert store["connections"] == 1
    assert store["commits"] == 1


def test_a_job_with_a_fresh_heartbeat_is_not_matched_by_the_reaper(
    monkeypatch: pytest.MonkeyPatch,
):
    """The guard lives in the WHERE clause: only a stale coalesced timestamp
    matches, so a job heartbeating normally is never touched."""
    store: dict[str, Any] = {"returns": {"returning id, scraper_code, etl_run_id": []}}
    _with_fake_db(monkeypatch, store)

    result = sq.reap_stale(3)

    job_update_sql, _ = store["sql"][0]
    assert "coalesce(heartbeat_at, started_at, requested_at)" in job_update_sql
    assert "< now() - (%s * interval '1 hour')" in job_update_sql

    assert result == {"jobs_reaped": 0, "runs_reaped": 0}
    assert _statements(store, "insert into public.etl_job_events") == []
    # With no reaped jobs there are no linked runs to fail...
    assert _statements(store, "id = any(%s::uuid[])") == []
    # ...but the orphan sweep still runs.
    assert len(_statements(store, "update public.etl_runs r")) == 1


def test_a_null_heartbeat_falls_back_to_started_at_then_requested_at(
    monkeypatch: pytest.MonkeyPatch,
):
    """A schedule-enqueued job sat heartbeat-NULL until its first progress
    event before the claim fix; the coalesce order is what lets the reaper
    measure such a job's age at all."""
    store: dict[str, Any] = {"returns": {"returning id, scraper_code, etl_run_id": []}}
    _with_fake_db(monkeypatch, store)

    sq.reap_stale(3)

    job_update_sql, _ = store["sql"][0]
    assert "coalesce(heartbeat_at, started_at, requested_at)" in job_update_sql


def test_an_orphaned_run_is_reaped_but_a_queue_backed_run_is_exempt(
    monkeypatch: pytest.MonkeyPatch,
):
    """A queue-backed run's liveness is its job's heartbeat: the NOT EXISTS
    exemption is what stops the reaper killing a run from under a living
    worker. CLI-opened runs have no job and age out on started_at."""
    store: dict[str, Any] = {
        "returns": {"returning id, scraper_code, etl_run_id": []},
        "rowcounts": {"not exists": 7},
    }
    _with_fake_db(monkeypatch, store)

    result = sq.reap_stale(3)

    assert result == {"jobs_reaped": 0, "runs_reaped": 7}
    orphan_sql, orphan_params = _statements(store, "update public.etl_runs r")[0]
    assert "r.status = 'running'" in orphan_sql
    assert "r.started_at < now() - (%s * interval '1 hour')" in orphan_sql
    assert "error = 'reaped: run orphaned (process died)'" in orphan_sql
    assert "not exists" in orphan_sql
    assert "q.etl_run_id = r.id" in orphan_sql
    assert "q.status in ('pending', 'running')" in orphan_sql
    assert orphan_params == (3.0,)


def test_pending_jobs_are_never_reaped(monkeypatch: pytest.MonkeyPatch):
    """Pending means the worker never arrived — an alerting problem, not a
    zombie. The reaper must not touch it."""
    store: dict[str, Any] = {"returns": {"returning id, scraper_code, etl_run_id": []}}
    _with_fake_db(monkeypatch, store)

    sq.reap_stale(3)

    job_update_sql, _ = store["sql"][0]
    assert "where status = 'running'" in job_update_sql
    assert "pending" not in job_update_sql.split("where")[1]


def test_run_queue_reaps_before_claiming_and_a_reaper_failure_raises(
    monkeypatch: pytest.MonkeyPatch,
):
    """Reaper placement is the contract: top of run_queue, outside the per-job
    try/except, and a reaper failure must propagate so the cron alerts."""
    calls: list[str] = []

    def fake_reap(hours: float) -> dict[str, int]:
        calls.append(f"reap:{hours:g}")
        return {"jobs_reaped": 0, "runs_reaped": 0}

    monkeypatch.setattr(sq, "reap_stale", fake_reap)
    monkeypatch.setattr(sq, "_claim_next_job", lambda: calls.append("claim") or None)

    assert sq.run_queue(limit=1) == {"processed": 0, "failed": 0}
    assert calls == [f"reap:{sq.settings.etl_reap_stale_hours:g}", "claim"]

    def boom(hours: float) -> dict[str, int]:
        raise RuntimeError("db down")

    monkeypatch.setattr(sq, "reap_stale", boom)
    calls.clear()
    with pytest.raises(RuntimeError, match="db down"):
        sq.run_queue(limit=1)
    assert calls == [], "the claim loop must not run when the reaper fails"


# ------------------------------------------------------- schedule timers ----
_SCHEDULE = {"scraper_code": "rsc", "interval_minutes": 10080, "requested_by": None}


def test_a_skipped_schedule_does_not_advance_its_timer(
    monkeypatch: pytest.MonkeyPatch,
):
    """Catch-up semantics: a schedule skipped because a job is still
    pending/running stays due, so it enqueues on the next cron minute after
    the reaper clears the block — instead of silently eating the interval."""
    store: dict[str, Any] = {
        "returns": {
            "from public.etl_schedules": [_SCHEDULE],
            "select id from public.etl_job_queue": [{"id": "job-still-running"}],
        }
    }
    _with_fake_db(monkeypatch, store)

    result = sq.enqueue_due_schedules()

    assert result == {"enqueued": 0, "skipped_existing": 1}
    assert _statements(store, "update public.etl_schedules") == []
    assert _statements(store, "insert into public.etl_job_queue") == []


def test_an_enqueued_schedule_advances_its_timer(
    monkeypatch: pytest.MonkeyPatch,
):
    store: dict[str, Any] = {
        "returns": {
            "from public.etl_schedules": [_SCHEDULE],
            "select id from public.etl_job_queue": [],
        }
    }
    _with_fake_db(monkeypatch, store)

    result = sq.enqueue_due_schedules()

    assert result == {"enqueued": 1, "skipped_existing": 0}
    assert len(_statements(store, "insert into public.etl_job_queue")) == 1
    advance = _statements(store, "update public.etl_schedules")
    assert len(advance) == 1
    assert "last_enqueued_at = now()" in advance[0][0]
    assert "next_run_at = now() + make_interval(mins => interval_minutes)" in advance[0][0]


# ------------------------------------------------------------- heartbeats ----
def test_claiming_a_job_sets_the_heartbeat(monkeypatch: pytest.MonkeyPatch):
    """A schedule-enqueued job is heartbeat-NULL until claimed; without this
    the reaper would measure a healthy worker's age from requested_at."""
    store: dict[str, Any] = {
        "returns": {"from public.etl_job_queue": [{"id": "job-1", "scraper_code": "rsc"}]}
    }
    _with_fake_db(monkeypatch, store)

    job = sq._claim_next_job()

    assert job == {"id": "job-1", "scraper_code": "rsc"}
    updates = _statements(store, "update public.etl_job_queue")
    assert len(updates) == 1
    assert "status = 'running'" in updates[0][0]
    assert "heartbeat_at = now()" in updates[0][0]


class _FakeVerifier:
    def __init__(self) -> None:
        self.checked = 0

    def planned_credits(self, row: dict[str, Any]) -> int:
        return 0

    async def verify_document(self, row: dict[str, Any]) -> vmod.VerifyOutcome:
        self.checked += 1
        return vmod.VerifyOutcome(
            evidence_id=str(row["id"]),
            url=row["url"],
            outcome="live",
            claims_confirmed=1,
        )

    async def aclose(self) -> None:
        pass


def _verify_rows(count: int) -> list[dict[str, Any]]:
    return [{"id": f"doc-{i}", "url": f"https://x/{i}"} for i in range(count)]


def _patch_run_bookends(monkeypatch: pytest.MonkeyPatch, job: Any) -> None:
    def fake_open() -> str:
        job.last_run_id = "run-1"
        return "run-1"

    monkeypatch.setattr(job, "_open_run", fake_open)
    monkeypatch.setattr(job, "_close_run", lambda *a: None)


def test_verify_evidence_heartbeats_every_25_documents(
    monkeypatch: pytest.MonkeyPatch,
):
    """The reaper precondition: a multi-hour Firecrawl-heavy batch must never
    go 3h without a heartbeat, or it would be reaped while perfectly healthy."""
    fake = _FakeVerifier()
    monkeypatch.setattr(vmod, "EvidenceVerifier", lambda: fake)
    monkeypatch.setattr(vmod, "_select_due", lambda *a, **k: _verify_rows(50))

    job = vmod.VerifyEvidenceJob(limit=50, max_credits=0)
    _patch_run_bookends(monkeypatch, job)
    events: list[dict[str, Any]] = []
    job.progress_callback = events.append

    result = asyncio.run(job.run())

    assert result["seen"] == 50
    assert [e["message"] for e in events] == [
        "Verified 25 documents.",
        "Verified 50 documents.",
    ]
    for event in events:
        assert event["etl_run_id"] == "run-1"
        assert event["scraper_code"] == "verify_evidence"
        assert event["event_type"] == "progress"
        for key in ("records_seen", "records_upserted", "records_skipped", "records_matched"):
            assert isinstance(event[key], int) and event[key] >= 0, key
    # 25 live documents with one confirmed claim each by the first heartbeat.
    assert events[0]["records_seen"] == 25
    assert events[0]["records_upserted"] == 25
    assert events[0]["records_matched"] == 25


def test_verify_evidence_heartbeats_are_optional_when_run_from_the_cli(
    monkeypatch: pytest.MonkeyPatch,
):
    """No callback is set outside the queue runner; the guard must hold."""
    fake = _FakeVerifier()
    monkeypatch.setattr(vmod, "EvidenceVerifier", lambda: fake)
    monkeypatch.setattr(vmod, "_select_due", lambda *a, **k: _verify_rows(30))

    job = vmod.VerifyEvidenceJob(limit=30, max_credits=0)
    _patch_run_bookends(monkeypatch, job)
    assert job.progress_callback is None

    result = asyncio.run(job.run())
    assert result["seen"] == 30


def test_refresh_monitors_heartbeats_at_start_and_per_reconcile(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(mmod.settings, "firecrawl_api_key", "fc-test", raising=False)
    monkeypatch.setattr(
        mmod.settings, "firecrawl_webhook_base_url", "https://sourcebd.com", raising=False
    )
    monkeypatch.setattr(mmod.settings, "firecrawl_webhook_secret", "s3cret", raising=False)
    planned = [
        {"scraper_code": "bgmea_web", "target_url": "https://a/1", "name": "sourcebd:bgmea_web"},
        {"scraper_code": "uflpa", "target_url": "https://b/2", "name": "sourcebd:uflpa"},
    ]
    monkeypatch.setattr(mmod, "planned_targets", lambda: planned)
    monkeypatch.setattr(mmod, "_existing_ids", lambda: {})
    monkeypatch.setattr(mmod, "_upsert_local", lambda *a, **k: None)

    class FakeAdapter:
        async def create_monitor(self, spec: dict[str, Any]) -> dict[str, Any]:
            return {"id": "mon_new"}

        async def aclose(self) -> None:
            pass

    monkeypatch.setattr(mmod, "FirecrawlAdapter", lambda: FakeAdapter())

    job = mmod.RefreshMonitorsJob()
    _patch_run_bookends(monkeypatch, job)
    events: list[dict[str, Any]] = []
    job.progress_callback = events.append

    result = asyncio.run(job.run())

    assert result["created"] == 2
    assert [e["message"] for e in events] == [
        "Refreshing monitors.",
        "Reconciled 1 of 2 monitors.",
        "Reconciled 2 of 2 monitors.",
    ]
    for event in events:
        assert event["etl_run_id"] == "run-1"
        assert event["scraper_code"] == "refresh_monitors"
        assert event["event_type"] == "progress"
    assert events[2]["records_seen"] == 2
    assert events[2]["records_upserted"] == 2


def test_refresh_monitors_heartbeats_at_start_even_when_unconfigured(
    monkeypatch: pytest.MonkeyPatch,
):
    """The start beat fires before the reconcile, so even a run that fails
    fast proves the worker was alive when it started."""

    async def fake_refresh(dry_run: bool = False, progress_callback: Any | None = None):
        return {"planned": 0, "created": 0, "error": "FIRECRAWL_API_KEY not set"}

    monkeypatch.setattr(mmod, "refresh_monitors", fake_refresh)
    job = mmod.RefreshMonitorsJob()
    _patch_run_bookends(monkeypatch, job)
    closed: list[tuple[Any, ...]] = []
    monkeypatch.setattr(job, "_close_run", lambda *a: closed.append(a))
    events: list[dict[str, Any]] = []
    job.progress_callback = events.append

    asyncio.run(job.run())

    assert [e["message"] for e in events] == ["Refreshing monitors."]
    assert closed[0][1] == "failed"


# ------------------------------------------------------ resurrection guard ----
def test_mark_success_and_mark_failed_only_touch_running_jobs(
    monkeypatch: pytest.MonkeyPatch,
):
    """A reaped job must stay reaped: a half-alive process finishing late
    cannot silently flip the terminal state back."""
    store: dict[str, Any] = {}
    _with_fake_db(monkeypatch, store)

    sq._mark_success("job-1", {"seen": 1}, "run-1")
    sq._mark_failed("job-2", "boom", "run-2")

    updates = _statements(store, "update public.etl_job_queue")
    assert len(updates) == 2
    for sql, _params in updates:
        assert "where id = %s and status = 'running'" in sql
