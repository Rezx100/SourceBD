"""Execute 0102's plan function against production rows, then roll back.

CI has no Postgres. When SUPABASE_DB_URL is set, this session creates the
0102 helpers + admin_queue_release_plan in an uncommitted transaction, reads
named ticket destinations, and always rolls back. It never replaces
admin_queue_decide (0062 stays live) and never commits.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parents[2]
load_dotenv(REPO / ".env")
MIGRATION = REPO / "supabase" / "migrations" / "0102_admin_queue_release.sql"

VALUKA_QUEUE = "7025396b-c7e0-4b59-a228-9186d31b9568"
LIZ_MOTHER = "55c13ea8"
HURRICANE_QUEUE = "ae1935ab-2672-4928-8188-28afc04c7eff"
HURRICANE_CHILD = "ed35695c"
HURRICANE_MOTHER = "766d04d7"
SHAFPUR_QUEUE = "aefbd03e-17e7-4876-a3db-d6b035722bd5"
KENPARK_QUEUE = "5d17c2ce-2a0a-4615-8a8a-c3c5c4707505"
CKL_QUEUE = "33cbb2d5-5fe8-4a3f-a27f-0e269e99632e"
SOUTH_EAST_QUEUE = "3567e858-df1d-4ecd-b5f0-5902b1530881"
SOUTH_EAST_PARENT = "987316ab"
MARK_FASHION_QUEUE = "a5c7886c-ce38-4bfc-b749-4ccd02ddafa2"


def _dsn() -> str | None:
    return os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")


def _plan_helpers_sql() -> str:
    sql = MIGRATION.read_text(encoding="utf-8")
    blob = sql.split("create or replace function public.admin_queue_decide", 1)[0]
    assert "admin_queue_release_plan" in blob
    assert "admin_queue_decide" not in blob.split("admin_queue_release_plan", 1)[1]
    return blob


def _statements(blob: str) -> list[str]:
    parts = blob.split("\n$$;\n")
    out: list[str] = []
    for i, part in enumerate(parts):
        text = part.strip()
        if not text:
            continue
        if i < len(parts) - 1:
            out.append(text + "\n$$;")
        elif "create or replace function" in text.lower():
            out.append(text if text.endswith("$$;") else text + "\n$$;")
    return out


@pytest.fixture(scope="module")
def plan_conn():
    dsn = _dsn()
    if not dsn:
        pytest.skip("SUPABASE_DB_URL not set")
    import psycopg
    from psycopg.rows import dict_row

    conn = psycopg.connect(dsn, autocommit=False, row_factory=dict_row, connect_timeout=30)
    try:
        with conn.cursor() as cur:
            for stmt in _statements(_plan_helpers_sql()):
                cur.execute(stmt)
        yield conn
    finally:
        conn.rollback()
        conn.close()


def _plan(conn, queue_id: str) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            "select public.admin_queue_release_plan(%s::uuid) as plan",
            (queue_id,),
        )
        row = cur.fetchone()
    assert row is not None
    plan = row["plan"]
    assert isinstance(plan, dict)
    return plan


def test_sql_valuka_attaches_to_liz_fashion(plan_conn):
    plan = _plan(plan_conn, VALUKA_QUEUE)
    assert plan["action"] == "attach_facility"
    assert str(plan["parent_id"]).startswith(LIZ_MOTHER)


def test_sql_shafipur_attaches_to_liz_fashion(plan_conn):
    plan = _plan(plan_conn, SHAFPUR_QUEUE)
    assert plan["action"] == "attach_facility"
    assert str(plan["parent_id"]).startswith(LIZ_MOTHER)


def test_sql_hurricane_printing_unit_attaches(plan_conn):
    plan = _plan(plan_conn, HURRICANE_QUEUE)
    assert plan["action"] == "attach_facility"
    assert str(plan["parent_id"]).startswith(HURRICANE_MOTHER)
    members = [str(x) for x in (plan.get("member_ids") or [])]
    assert any(m.startswith(HURRICANE_CHILD) for m in members)
    assert not any(m.startswith(HURRICANE_MOTHER) for m in members)


def test_sql_south_east_printing_unit_attaches(plan_conn):
    plan = _plan(plan_conn, SOUTH_EAST_QUEUE)
    assert plan["action"] == "attach_facility"
    assert str(plan["parent_id"]).startswith(SOUTH_EAST_PARENT)


def test_sql_kenpark_unit_2_needs_human(plan_conn):
    plan = _plan(plan_conn, KENPARK_QUEUE)
    assert plan["action"] == "needs_human"


def test_sql_ckl_unit_needs_human(plan_conn):
    plan = _plan(plan_conn, CKL_QUEUE)
    assert plan["action"] == "needs_human"


def test_sql_mark_fashion_u2_needs_human(plan_conn):
    plan = _plan(plan_conn, MARK_FASHION_QUEUE)
    assert plan["action"] == "needs_human"


def test_sql_knit_sw_stacked_does_not_fold_to_garment_base(plan_conn):
    names = (
        "Pacific Jeans Ltd. (Knit Unit) Unit-2",
        "Pacific Jeans Ltd. (Sw Unit) Unit-2",
        "Pacific Jeans Ltd. (Washing Unit) Unit-2",
        "The Civil Engineers Ltd. (Sw Unit) Unit-2",
    )
    with plan_conn.cursor() as cur:
        for name in names:
            cur.execute("select public._queue_building_base_name(%s) as base", (name,))
            base = cur.fetchone()["base"]
            if base:
                assert base not in {
                    "Pacific Jeans Ltd.",
                    "The Civil Engineers Ltd.",
                }, name
            cur.execute("select public._queue_unique_mother(array[%s]) as mid", (name,))
            assert cur.fetchone()["mid"] is None, name
