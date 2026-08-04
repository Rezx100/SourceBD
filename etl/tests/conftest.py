"""Shared ETL test doubles.

The REZ-34 lesson: mocked cursors never parse SQL. `FakeCursor` dispatches on
statement shape, so production SQL must stay simple — prefer casts (`%s::text`)
where a bare parameter has no type context, and keep gate predicates in pure
Python where they can be unit-tested directly.
"""
from __future__ import annotations

from typing import Any

import pytest


class FakeCursor:
    """Routes the handful of upsert-path queries by statement shape."""

    def __init__(
        self,
        *,
        skip_rows: list[dict[str, Any]] | None = None,
        pass0_row: dict[str, Any] | None = None,
        slug_row: dict[str, Any] | None = None,
        squash_row: dict[str, Any] | None = None,
        lock_rows: list[dict[str, Any]] | None = None,
        new_supplier_id: str = "sup-new",
    ) -> None:
        self._skip_rows = list(skip_rows or [])
        self._pass0_row = pass0_row
        self._slug_row = slug_row
        self._squash_row = squash_row
        # Live locks only (released_at IS NULL). Default empty = ETL unchanged.
        self._lock_rows = list(lock_rows or [])
        self._new_supplier_id = new_supplier_id
        self.executed: list[tuple[str, Any]] = []
        self._last_sql = ""

    def execute(self, sql: str, params: Any = None) -> None:
        self._last_sql = sql
        self.executed.append((sql, params))

    def fetchall(self) -> list[dict[str, Any]]:
        if "select supplier_id, raw_hash from public.source_records" in self._last_sql:
            return list(self._skip_rows)
        if "from public.supplier_field_locks" in self._last_sql:
            return list(self._lock_rows)
        # Pass 3 phone candidates, Pass 4 fuzzy candidates: none.
        return []

    def fetchone(self) -> dict[str, Any] | None:
        if "select supplier_id from public.source_records" in self._last_sql:
            return self._pass0_row
        if "insert into public.suppliers" in self._last_sql:
            return {"id": self._new_supplier_id}
        if "where slug = %s" in self._last_sql:
            return self._slug_row
        if "replace(company_name_norm" in self._last_sql:
            return self._squash_row
        # Pass 2 email: no match.
        return None

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *exc: Any) -> bool:
        return False


class FakeConn:
    def __init__(self, cursor: FakeCursor) -> None:
        self._cursor = cursor
        self.commits = 0

    def cursor(self) -> FakeCursor:
        return self._cursor

    def commit(self) -> None:
        self.commits += 1

    def __enter__(self) -> "FakeConn":
        return self

    def __exit__(self, *exc: Any) -> bool:
        return False


class FakeDb:
    def __init__(self, conn: FakeConn) -> None:
        self._conn = conn

    def conn(self) -> FakeConn:
        return self._conn


@pytest.fixture(autouse=True)
def _clear_resolution_edges_cache() -> None:
    """Matcher caches live same-edges once per process (REZ-64). Reset
    between tests so a seeded index cannot leak into unrelated suites."""
    from etl.core.resolution_edges import clear_live_same_edge_cache

    clear_live_same_edge_cache()
    yield
    clear_live_same_edge_cache()


@pytest.fixture
def patched_db(monkeypatch: pytest.MonkeyPatch):
    """Point the upsert path at a FakeDb and neuter the side effects that are
    other specs' concerns (REZ-32 in-transaction screening, F5 post-commit
    enrichment). Returns the spies/helpers a test asserts against."""

    def _install(cursor: FakeCursor) -> dict[str, Any]:
        conn = FakeConn(cursor)
        spies: dict[str, Any] = {"conn": conn, "screened": [], "post_enrich": []}
        monkeypatch.setattr("etl.core.upsert.db", FakeDb(conn))
        monkeypatch.setattr("etl.core.upsert.get_source_id", lambda code: "src-1")
        monkeypatch.setattr(
            "etl.core.sanctions.screen_supplier_against_entries",
            lambda *a, **k: spies["screened"].append((a, k)) or [],
        )
        monkeypatch.setattr(
            "etl.jobs.contact_merge.run_for",
            lambda sid: spies["post_enrich"].append(sid) or {},
        )
        monkeypatch.setattr("etl.jobs.address_norm.run_for", lambda sid: (False, False))
        return spies

    return _install
