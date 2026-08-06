"""REZ-86 / A6b — field locks on contact_merge, address_norm, rsc_crosslink.

CI has no database. These tests cover:

1. No locks → each job's UPDATE SQL matches today's shape (byte-identical
   on an empty lock table). There is no separate historical suite for these
   three jobs; the full pytest run is the regression.
2. A lock on `phones` blocks contact_merge phone union, still writes website.
3. A lock on `city` blocks address_norm city, still writes district.
4. A lock on `district` blocks rsc_crosslink writing it.
5. A released lock (absent from the live SELECT) no longer blocks any of the
   three.
"""
from __future__ import annotations

from typing import Any

import pytest

from etl.jobs import address_norm, contact_merge, rsc_crosslink
from etl.tests.conftest import FakeConn, FakeDb


class JobCursor:
    """Minimal cursor for the three F5/F6 jobs + lock lookup."""

    def __init__(
        self,
        *,
        supplier_row: dict[str, Any] | None = None,
        record_rows: list[Any] | None = None,
        lock_rows: list[dict[str, Any]] | None = None,
        index_rows: list[dict[str, Any]] | None = None,
        pool_rows: list[dict[str, Any]] | None = None,
        current_geo: dict[str, Any] | None = None,
    ) -> None:
        self._supplier_row = supplier_row
        self._record_rows = list(record_rows or [])
        self._lock_rows = list(lock_rows or [])
        self._index_rows = list(index_rows or [])
        self._pool_rows = list(pool_rows or [])
        self._current_geo = current_geo
        self.executed: list[tuple[str, Any]] = []
        self._last_sql = ""

    def execute(self, sql: str, params: Any = None) -> None:
        self._last_sql = sql
        self.executed.append((sql, params))

    def fetchone(self) -> dict[str, Any] | None:
        sql = self._last_sql
        if "from public.suppliers where id" in sql and "address_raw" in sql:
            return self._supplier_row
        if "select district, city from public.suppliers where id" in sql:
            return self._current_geo
        if "select city, district, address_raw from public.suppliers where id" in sql:
            return self._supplier_row
        return self._supplier_row

    def fetchall(self) -> list[Any]:
        sql = self._last_sql
        if "from public.supplier_field_locks" in sql:
            return list(self._lock_rows)
        if "join public.sources s on s.id = sr.source_id" in sql:
            return list(self._record_rows)
        if "from public.suppliers where district is not null" in sql:
            return list(self._index_rows)
        if "sr.source_id = %s" in sql and "district is null" in sql:
            return list(self._pool_rows)
        return []

    def __enter__(self) -> "JobCursor":
        return self

    def __exit__(self, *exc: Any) -> bool:
        return False


def _patch_job_db(monkeypatch: pytest.MonkeyPatch, cur: JobCursor, module: Any) -> FakeConn:
    conn = FakeConn(cur)  # type: ignore[arg-type]
    monkeypatch.setattr(module, "db", FakeDb(conn))
    return conn


# ---------------------------------------------------------------------------
# Case 1 — no locks: UPDATE SQL unchanged
# ---------------------------------------------------------------------------


def test_contact_merge_no_locks_writes_all_pending_columns(monkeypatch: pytest.MonkeyPatch) -> None:
    cur = JobCursor(
        supplier_row={
            "id": "sup-1",
            "address_raw": None,
            "email_primary": None,
            "phones": [],
            "contact_name": None,
            "contact_role": None,
            "website": None,
        },
        record_rows=[
            (
                "OEKO_TEX",
                "tier3_cert",
                {
                    "oeko_profile_website": "https://example.com",
                    "oeko_profile_phone": "+8801711000000",
                    "oeko_profile_address": "Savar, Dhaka",
                    "oeko_profile_email": "a@b.com",
                },
            ),
        ],
        lock_rows=[],
    )
    _patch_job_db(monkeypatch, cur, contact_merge)
    counters = contact_merge.run_for("sup-1")
    updates = [
        (sql, params) for sql, params in cur.executed
        if sql.startswith("update public.suppliers set")
    ]
    assert len(updates) == 1
    sql, params = updates[0]
    for col in ("address_raw", "email_primary", "website", "phones"):
        assert f"{col} = %s" in sql
    assert "https://example.com" in params
    assert counters["website"] == 1
    assert counters["phones"] >= 1
    lock_lookups = [
        sql for sql, _ in cur.executed if "from public.supplier_field_locks" in sql
    ]
    assert len(lock_lookups) == 1


def test_address_norm_no_locks_keeps_both_coalesce_fragments(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cur = JobCursor(
        supplier_row={"city": None, "district": None, "address_raw": "DEPZ, Savar, Dhaka"},
        record_rows=[],
        lock_rows=[],
    )
    _patch_job_db(monkeypatch, cur, address_norm)
    monkeypatch.setattr(address_norm, "get_source_id", lambda code: f"src-{code}")
    city_upd, dist_upd = address_norm.run_for("sup-1")
    assert city_upd and dist_upd
    updates = [
        sql for sql, _ in cur.executed if sql.startswith("update public.suppliers set")
    ]
    assert len(updates) == 1
    assert updates[0] == (
        "update public.suppliers set "
        "city = coalesce(city, %s), district = coalesce(district, %s) "
        "where id = %s"
    )


def test_rsc_crosslink_no_locks_keeps_both_coalesce_fragments(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cur = JobCursor(
        index_rows=[
            {"company_name": "Acme Knitwear Ltd", "district": "Gazipur", "city": "Tongi"},
        ],
        pool_rows=[{"id": "sup-rsc", "company_name": "Acme Knitwear Ltd"}],
        current_geo={"district": None, "city": None},
        lock_rows=[],
    )
    _patch_job_db(monkeypatch, cur, rsc_crosslink)
    monkeypatch.setattr(rsc_crosslink, "get_source_id", lambda code: "src-RSC")
    stats = rsc_crosslink.run()
    assert stats["safe_matched"] == 1
    assert stats["district_filled"] == 1
    assert stats["city_filled"] == 1
    updates = [
        sql for sql, _ in cur.executed if sql.startswith("update public.suppliers set")
    ]
    assert len(updates) == 1
    assert updates[0] == (
        "update public.suppliers set "
        "district = coalesce(district, %s), "
        "city = coalesce(city, %s) "
        "where id = %s"
    )


# ---------------------------------------------------------------------------
# Case 2 — phones lock blocks union, website still written
# ---------------------------------------------------------------------------


def test_contact_merge_phones_lock_skips_phones_keeps_website(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cur = JobCursor(
        supplier_row={
            "id": "sup-1",
            "address_raw": "already set",
            "email_primary": "already@set.com",
            "phones": ["8801700000000"],
            "contact_name": "Already",
            "contact_role": "Owner",
            "website": None,
        },
        record_rows=[
            (
                "OEKO_TEX",
                "tier3_cert",
                {
                    "oeko_profile_website": "https://locked-phones.example",
                    "oeko_profile_phone": "+8801711999999",
                },
            ),
        ],
        lock_rows=[{"column_name": "phones"}],
    )
    _patch_job_db(monkeypatch, cur, contact_merge)
    counters = contact_merge.run_for("sup-1")
    updates = [
        (sql, params) for sql, params in cur.executed
        if sql.startswith("update public.suppliers set")
    ]
    assert len(updates) == 1
    sql, params = updates[0]
    assert "phones = %s" not in sql
    assert "website = %s" in sql
    assert "https://locked-phones.example" in params
    assert counters["phones"] == 0
    assert counters["website"] == 1


# ---------------------------------------------------------------------------
# Case 3 — city lock blocks address_norm city, district still written
# ---------------------------------------------------------------------------


def test_address_norm_city_lock_skips_city_keeps_district(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cur = JobCursor(
        supplier_row={"city": None, "district": None, "address_raw": "DEPZ, Savar, Dhaka"},
        record_rows=[],
        lock_rows=[{"column_name": "city"}],
    )
    _patch_job_db(monkeypatch, cur, address_norm)
    monkeypatch.setattr(address_norm, "get_source_id", lambda code: f"src-{code}")
    city_upd, dist_upd = address_norm.run_for("sup-1")
    assert city_upd is False
    assert dist_upd is True
    updates = [
        (sql, params) for sql, params in cur.executed
        if sql.startswith("update public.suppliers set")
    ]
    assert len(updates) == 1
    sql, params = updates[0]
    assert "city = coalesce(city, %s)" not in sql
    assert "district = coalesce(district, %s)" in sql
    assert "Dhaka" in params
    assert "Savar" not in params


# ---------------------------------------------------------------------------
# Case 4 — district lock blocks rsc_crosslink
# ---------------------------------------------------------------------------


def test_rsc_crosslink_district_lock_skips_district(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cur = JobCursor(
        index_rows=[
            {"company_name": "Acme Knitwear Ltd", "district": "Gazipur", "city": "Tongi"},
        ],
        pool_rows=[{"id": "sup-rsc", "company_name": "Acme Knitwear Ltd"}],
        current_geo={"district": None, "city": None},
        lock_rows=[{"column_name": "district"}],
    )
    _patch_job_db(monkeypatch, cur, rsc_crosslink)
    monkeypatch.setattr(rsc_crosslink, "get_source_id", lambda code: "src-RSC")
    stats = rsc_crosslink.run()
    assert stats["safe_matched"] == 1
    assert stats["district_filled"] == 0
    assert stats["city_filled"] == 1
    updates = [
        (sql, params) for sql, params in cur.executed
        if sql.startswith("update public.suppliers set")
    ]
    assert len(updates) == 1
    sql, params = updates[0]
    assert "district = coalesce(district, %s)" not in sql
    assert "city = coalesce(city, %s)" in sql
    assert "Tongi" in params
    assert "Gazipur" not in params


def test_rsc_crosslink_both_locked_skips_update_entirely(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cur = JobCursor(
        index_rows=[
            {"company_name": "Acme Knitwear Ltd", "district": "Gazipur", "city": "Tongi"},
        ],
        pool_rows=[{"id": "sup-rsc", "company_name": "Acme Knitwear Ltd"}],
        current_geo={"district": None, "city": None},
        lock_rows=[
            {"column_name": "district"},
            {"column_name": "city"},
        ],
    )
    _patch_job_db(monkeypatch, cur, rsc_crosslink)
    monkeypatch.setattr(rsc_crosslink, "get_source_id", lambda code: "src-RSC")
    stats = rsc_crosslink.run()
    assert stats["safe_matched"] == 1
    assert stats["district_filled"] == 0
    assert stats["city_filled"] == 0
    updates = [
        sql for sql, _ in cur.executed if sql.startswith("update public.suppliers set")
    ]
    assert updates == []


# ---------------------------------------------------------------------------
# Case 5 — released lock no longer blocks
# ---------------------------------------------------------------------------


def test_released_lock_does_not_block_any_job(monkeypatch: pytest.MonkeyPatch) -> None:
    # FakeCursor / JobCursor only surface live locks; a released row is absent
    # from SELECT ... WHERE released_at IS NULL.
    cur = JobCursor(
        supplier_row={
            "id": "sup-1",
            "address_raw": None,
            "email_primary": None,
            "phones": [],
            "contact_name": None,
            "contact_role": None,
            "website": None,
        },
        record_rows=[
            (
                "OEKO_TEX",
                "tier3_cert",
                {
                    "oeko_profile_website": "https://released.example",
                    "oeko_profile_phone": "+8801711000000",
                },
            ),
        ],
        lock_rows=[],  # released_at set ⇒ not returned
    )
    _patch_job_db(monkeypatch, cur, contact_merge)
    counters = contact_merge.run_for("sup-1")
    updates = [
        sql for sql, _ in cur.executed if sql.startswith("update public.suppliers set")
    ]
    assert len(updates) == 1
    assert "website = %s" in updates[0]
    assert "phones = %s" in updates[0]
    assert counters["website"] == 1

    cur2 = JobCursor(
        supplier_row={"city": None, "district": None, "address_raw": "DEPZ, Savar, Dhaka"},
        record_rows=[],
        lock_rows=[],
    )
    _patch_job_db(monkeypatch, cur2, address_norm)
    monkeypatch.setattr(address_norm, "get_source_id", lambda code: f"src-{code}")
    city_upd, dist_upd = address_norm.run_for("sup-1")
    assert city_upd and dist_upd

    cur3 = JobCursor(
        index_rows=[
            {"company_name": "Acme Knitwear Ltd", "district": "Gazipur", "city": "Tongi"},
        ],
        pool_rows=[{"id": "sup-rsc", "company_name": "Acme Knitwear Ltd"}],
        current_geo={"district": None, "city": None},
        lock_rows=[],
    )
    _patch_job_db(monkeypatch, cur3, rsc_crosslink)
    monkeypatch.setattr(rsc_crosslink, "get_source_id", lambda code: "src-RSC")
    stats = rsc_crosslink.run()
    assert stats["district_filled"] == 1
    assert stats["city_filled"] == 1
