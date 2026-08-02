"""SbiRecomputeJob queue-shape tests (REZ-33).

The job must be dispatchable by the admin queue without pretending to be a
source: keeping it out of `SCRAPERS` is what lets the registry-wide
invariant — every source declares a transport and produces evidence — stay an
assertion rather than a convention.
"""
from __future__ import annotations

import asyncio
from typing import Any

import pytest


def test_sbi_recompute_is_runnable_from_the_queue_but_not_a_source():
    from etl.scrapers.registry import JOBS, RUNNABLE, SCRAPERS

    assert "sbi_recompute" in JOBS
    assert "sbi_recompute" in RUNNABLE
    assert "sbi_recompute" not in SCRAPERS
    job = RUNNABLE["sbi_recompute"]
    # The queue runner assigns a progress callback and reads `last_run_id`.
    instance = job()
    instance.progress_callback = lambda _event: None
    assert instance.last_run_id is None
    assert hasattr(instance, "run")


def _patched_instance(monkeypatch: pytest.MonkeyPatch) -> Any:
    from etl.scoring.job import SbiRecomputeJob

    instance = SbiRecomputeJob()
    monkeypatch.setattr(instance, "_open_run", lambda: "run-1")
    return instance


def test_run_maps_runner_counters_to_queue_keys(monkeypatch):
    """`_mark_success` reads seen/upserted/skipped/matched; `computed` rides
    along for the run metadata."""
    from etl.scoring import job as job_mod

    monkeypatch.setattr(
        job_mod.runner,
        "run",
        lambda **kw: {"seen": 3, "computed": 3, "upserted": 2, "skipped_hash": 1},
    )
    instance = _patched_instance(monkeypatch)
    closed: dict[str, Any] = {}
    monkeypatch.setattr(
        instance,
        "_close_run",
        lambda run_id, status, seen, upserted, skipped, error: closed.update(
            status=status,
            seen=seen,
            upserted=upserted,
            skipped=skipped,
            error=error,
        ),
    )

    result = asyncio.run(instance.run())

    assert result == {
        "seen": 3,
        "upserted": 2,
        "skipped": 1,
        "matched": 0,
        "computed": 3,
    }
    assert closed == {
        "status": "success",
        "seen": 3,
        "upserted": 2,
        "skipped": 1,
        "error": None,
    }


def test_run_failure_marks_the_run_failed_and_raises(monkeypatch):
    from etl.scoring import job as job_mod

    def _boom(**kw: Any) -> dict[str, int]:
        raise RuntimeError("db gone")

    monkeypatch.setattr(job_mod.runner, "run", _boom)
    instance = _patched_instance(monkeypatch)
    closed: dict[str, Any] = {}
    monkeypatch.setattr(
        instance,
        "_close_run",
        lambda run_id, status, seen, upserted, skipped, error: closed.update(
            status=status, error=error
        ),
    )

    with pytest.raises(RuntimeError, match="db gone"):
        asyncio.run(instance.run())
    assert closed["status"] == "failed"
    assert "db gone" in closed["error"]


def test_batch_heartbeat_emits_queue_event_shape(monkeypatch):
    instance = _patched_instance(monkeypatch)
    instance.last_run_id = "run-1"
    events: list[dict[str, Any]] = []
    instance.progress_callback = events.append

    instance._on_batch({"seen": 500, "computed": 500, "upserted": 500, "skipped_hash": 0})

    assert len(events) == 1
    event = events[0]
    assert event["etl_run_id"] == "run-1"
    assert event["scraper_code"] == "sbi_recompute"
    assert event["event_type"] == "progress"
    assert event["records_seen"] == 500
    assert event["records_upserted"] == 500
    assert event["records_skipped"] == 0
    assert event["records_matched"] == 0
    assert event["message"]


def test_batch_heartbeat_is_a_noop_without_callback(monkeypatch):
    """CLI runs have no queue to heartbeat to."""
    instance = _patched_instance(monkeypatch)
    instance._on_batch({"seen": 1, "computed": 1, "upserted": 1, "skipped_hash": 0})
