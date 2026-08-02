"""Runner SQL / row-mapping contract tests (REZ-33).

Mocked cursors never parse SQL (the REZ-34 IndeterminateDatatype lesson), so
the column contract between `_FETCH_SQL` and `_row_to_inputs` is pinned by
reading the statement text itself, plus a fake-cursor pass for the batch
heartbeat the queue job heartbeats through.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from etl.scoring import runner


def test_fetch_sql_reads_real_progress_pct():
    assert "r.progress_pct" in runner._FETCH_SQL
    assert "as rsc_progress_pct" in runner._FETCH_SQL


def test_fetch_sql_has_no_null_stub_columns():
    """The old `null::numeric as rsc_*` stubs are what silently scored every
    supplier 0+0 on the safety ladders. They must never come back."""
    assert "null::numeric as rsc_" not in runner._FETCH_SQL
    assert "rsc_fire_pct" not in runner._FETCH_SQL
    assert "rsc_structural_pct" not in runner._FETCH_SQL


def test_fetch_sql_keeps_active_row_join():
    """Inactive remediation rows score 0: the join filters them and
    rsc_has_row falls to false."""
    assert "r.active is true" in runner._FETCH_SQL


def _row(**over: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "supplier_id": "00000000-0000-0000-0000-000000000001",
        "source_tags": ["BGMEA"],
        "bgmea_reg_numbers": ["123"],
        "bkmea_reg_number": None,
        "rjsc_reg_number": None,
        "epb_erc_number": None,
        "bgmea_verified": True,
        "bkmea_verified": False,
        "bgapmea_verified": False,
        "btma_verified": False,
        "rsc_progress_pct": 42.5,
        "rsc_has_row": True,
        "certs_json": [],
        "established_date": None,
        "employees_total": None,
        "capacity_pcs_day": None,
        "capacity_dozen_yearly": None,
        "existing_hash": None,
    }
    row.update(over)
    return row


def test_row_to_inputs_maps_progress_pct():
    inputs = runner._row_to_inputs(_row())
    assert inputs.rsc_progress_pct == 42.5
    assert inputs.rsc_has_row is True


def test_row_to_inputs_accepts_db_decimal():
    """psycopg returns Decimal for numeric columns; the scorer works in float."""
    inputs = runner._row_to_inputs(_row(rsc_progress_pct=Decimal("87.50")))
    assert inputs.rsc_progress_pct == 87.5


def test_row_to_inputs_no_rsc_row_yields_none():
    inputs = runner._row_to_inputs(_row(rsc_progress_pct=None, rsc_has_row=False))
    assert inputs.rsc_progress_pct is None
    assert inputs.rsc_has_row is False


def test_run_emits_progress_per_committed_batch(monkeypatch):
    """The queue-dispatched job heartbeats through this hook; without it the
    stale reaper would kill a healthy full recompute (REZ-31)."""
    rows = [
        _row(supplier_id=f"00000000-0000-0000-0000-00000000000{i}") for i in range(3)
    ]
    upserted_batches: list[int] = []

    class FakeCursor:
        def execute(self, sql, params=None):
            pass

        def fetchall(self):
            return rows

        def executemany(self, sql, batch):
            upserted_batches.append(len(batch))

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    class FakeConn:
        def cursor(self):
            return FakeCursor()

        def commit(self):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    class FakeDb:
        def conn(self):
            return FakeConn()

    monkeypatch.setattr(runner, "db", FakeDb())

    events: list[dict[str, int]] = []
    result = runner.run(
        batch_size=2,
        today=None,
        progress_callback=events.append,
    )

    assert result == {"seen": 3, "computed": 3, "upserted": 3, "skipped_hash": 0}
    # Two upsert batches (2 + trailing 1); progress fires per full batch only.
    assert upserted_batches == [2, 1]
    assert events == [{"seen": 2, "computed": 2, "upserted": 2, "skipped_hash": 0}]


def test_run_skips_unchanged_hashes(monkeypatch):
    """Idempotency: a row whose stored inputs_hash matches is not upserted."""
    from datetime import date

    from etl.scoring.sbi import compute_inputs_hash

    today = date(2026, 8, 2)
    row = _row()
    row["existing_hash"] = compute_inputs_hash(runner._row_to_inputs(row), today)
    upserted_batches: list[int] = []

    class FakeCursor:
        def execute(self, sql, params=None):
            pass

        def fetchall(self):
            return [row]

        def executemany(self, sql, batch):
            upserted_batches.append(len(batch))

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    class FakeConn:
        def cursor(self):
            return FakeCursor()

        def commit(self):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    class FakeDb:
        def conn(self):
            return FakeConn()

    monkeypatch.setattr(runner, "db", FakeDb())

    result = runner.run(today=today, progress_callback=lambda _c: None)

    assert result == {"seen": 1, "computed": 1, "upserted": 0, "skipped_hash": 1}
    assert upserted_batches == []
