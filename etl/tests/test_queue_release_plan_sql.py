"""Execute 0102 plan + decide against production rows, then roll back.

CI has no Postgres. When SUPABASE_DB_URL is set, this session creates the
0102 helpers, admin_queue_release_plan, and (in the decide test)
admin_queue_decide in an uncommitted transaction, then always rolls back.
0062's live decide is restored when the transaction ends. Never commits.
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
HURRICANE_CHILD_ID = "ed35695c-033d-4683-a7a6-b088a310d95d"
HURRICANE_MOTHER = "766d04d7"
HURRICANE_MOTHER_ID = "766d04d7-4264-4ae7-9ea7-f350047de379"
SHAFPUR_QUEUE = "aefbd03e-17e7-4876-a3db-d6b035722bd5"
KENPARK_QUEUE = "5d17c2ce-2a0a-4615-8a8a-c3c5c4707505"
CKL_QUEUE = "33cbb2d5-5fe8-4a3f-a27f-0e269e99632e"
SOUTH_EAST_QUEUE = "3567e858-df1d-4ecd-b5f0-5902b1530881"
SOUTH_EAST_CHILD = "dcf53dbd-9f33-4002-9a57-a8021b56b097"
SOUTH_EAST_PARENT = "987316ab"
MARK_FASHION_QUEUE = "a5c7886c-ce38-4bfc-b749-4ccd02ddafa2"
MERGE_QUEUE = "dc85931e-a2ac-4ba5-86bb-fba82c2ff03a"
MERGE_WINNER = "05eb9f88-359a-4bb2-9138-dc216cf05e57"
MERGE_LOSER = "318c4dee-0cff-49b8-8576-d65f3d03132b"
BRAND_QUEUE = "1897bf34-734c-4135-92f9-f2b5ca126cbc"
BRAND_WINNER = "af0b137c-558b-4cda-9c03-d3e557ab093a"
BRAND_LOSER = "81e973c3-74cb-48c5-a44f-c6eb307f46bc"
PUBLISH_QUEUE = "06f65f4c-e55c-45ce-bb15-4ca5c92bf506"
PUBLISH_WINNER = "e2970a2e-2453-4113-ab75-cb5e9d9526e8"


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


def _privilege_statements() -> list[str]:
    sql = MIGRATION.read_text(encoding="utf-8")
    marker = "revoke all on function public._queue_edit_distance"
    tail = marker + sql.split(marker, 1)[1]
    return [part.strip() + ";" for part in tail.split(";") if part.strip()]


def _ids(cur, sql: str, args: tuple) -> list[str]:
    cur.execute(sql, args)
    return [str(r["id"]) for r in cur.fetchall()]


def _absorb_before(cur, winner: str, loser: str) -> dict[str, list[str]]:
    movable_sr = _ids(
        cur,
        """
        select sr.id
          from public.source_records sr
         where sr.supplier_id = %s::uuid
           and not exists (
             select 1 from public.source_records w
              where w.supplier_id = %s::uuid
                and w.source_id = sr.source_id
                and w.source_ref is not distinct from sr.source_ref
           )
        """,
        (loser, winner),
    )
    claims = _ids(
        cur,
        "select id from public.evidence_claims where supplier_id = %s::uuid",
        (loser,),
    )
    movable_certs = _ids(
        cur,
        """
        select c.id
          from public.certifications c
         where c.supplier_id = %s::uuid
           and not exists (
             select 1 from public.certifications w
              where w.supplier_id = %s::uuid
                and w.kind = c.kind
                and w.certificate_no is not distinct from c.certificate_no
           )
        """,
        (loser, winner),
    )
    return {
        "source_records": movable_sr,
        "evidence_claims": claims,
        "certifications": movable_certs,
    }


def _assert_absorbed(cur, winner: str, loser: str, before: dict[str, list[str]]) -> None:
    cur.execute(
        "select is_published from public.suppliers where id = %s::uuid",
        (winner,),
    )
    assert cur.fetchone()["is_published"] is True
    cur.execute(
        "select is_published from public.suppliers where id = %s::uuid",
        (loser,),
    )
    assert cur.fetchone()["is_published"] is False
    moved = (
        before["source_records"]
        or before["evidence_claims"]
        or before["certifications"]
    )
    assert moved, "loser had no unique source_records, claims, or certs to move"
    for table, ids in before.items():
        if not ids:
            continue
        cur.execute(
            f"select count(*)::int as n from public.{table} "
            "where id = any(%s::uuid[]) and supplier_id = %s::uuid",
            (ids, winner),
        )
        assert cur.fetchone()["n"] == len(ids), table
        cur.execute(
            f"select count(*)::int as n from public.{table} "
            "where id = any(%s::uuid[]) and supplier_id = %s::uuid",
            (ids, loser),
        )
        assert cur.fetchone()["n"] == 0, table


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
            for stmt in _privilege_statements():
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
        "Pacific Jeans Ltd. (Knit Unit) (Unit-2)",
        "Pacific Jeans Ltd. (Sw Unit) Unit-2",
        "Pacific Jeans Ltd. (Washing Unit) Unit-2",
        "Pacific Jeans Ltd. (Building 5) Unit-2",
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
            cur.execute(
                "select count(*)::int as n from public._queue_mother_hits(%s)",
                (name,),
            )
            assert cur.fetchone()["n"] == 0, name
            cur.execute("select public._queue_unique_mother(array[%s]) as mid", (name,))
            assert cur.fetchone()["mid"] is None, name


def test_sql_absorb_not_granted_to_anon_or_authenticated(plan_conn):
    with plan_conn.cursor() as cur:
        for role in ("anon", "authenticated"):
            cur.execute(
                """
                select has_function_privilege(
                         %s,
                         'public._queue_absorb_supplier(uuid,uuid)'::regprocedure,
                         'execute'
                       ) as ok
                """,
                (role,),
            )
            assert cur.fetchone()["ok"] is False, role
            cur.execute(
                """
                select has_function_privilege(
                         %s,
                         'public.admin_queue_release_plan(uuid)'::regprocedure,
                         'execute'
                       ) as ok
                """,
                (role,),
            )
            assert cur.fetchone()["ok"] is False, role


def _decide_fn_sql() -> str:
    sql = MIGRATION.read_text(encoding="utf-8")
    blob = sql.split("create or replace function public.admin_queue_decide", 1)[1]
    blob = blob.split("create or replace function public.admin_queue_list", 1)[0]
    return "create or replace function public.admin_queue_decide" + blob


def test_sql_decide_release_mutates_valuka_and_holds_kenpark(plan_conn):
    """Granted Review entrypoint in the same rolled-back session as the plan helpers."""
    import json
    from psycopg.errors import InvalidParameterValue, NoDataFound

    with plan_conn.cursor() as cur:
        cur.execute("set local lock_timeout = '8s'")
        for stmt in _statements(_decide_fn_sql()):
            cur.execute(stmt)
        cur.execute(
            "select id from public.profiles where role::text = 'admin' limit 1"
        )
        admin = cur.fetchone()
        assert admin is not None
        admin_id = str(admin["id"])
        claims = json.dumps({"sub": admin_id, "role": "authenticated"})
        cur.execute("select set_config('request.jwt.claims', %s, true)", (claims,))
        cur.execute(
            "select set_config('request.jwt.claim.sub', %s, true)", (admin_id,)
        )

        cur.execute(
            """
            select reviewed_at from public.verification_queue where id = %s::uuid
            """,
            (VALUKA_QUEUE,),
        )
        assert cur.fetchone()["reviewed_at"] is None
        valuka_members = [
            "02178d15-2c87-43c5-a85e-5d7f1a543287",
            "8a5f7152-8587-4047-8348-38ba59022d39",
        ]
        cur.execute(
            """
            select count(*)::int as n
              from public.suppliers
             where id = any(%s::uuid[])
               and is_published = true
               and facility_of is null
            """,
            (valuka_members,),
        )
        assert cur.fetchone()["n"] == 2

        cur.execute(
            "select public.admin_queue_decide(%s::uuid, 'release', 'sql-audit') as r",
            (VALUKA_QUEUE,),
        )
        result = cur.fetchone()["r"]
        assert result["release_action"] == "attach_facility"
        parent_id = str(result["plan"]["parent_id"])
        assert parent_id.startswith(LIZ_MOTHER)
        members = [str(x) for x in (result["plan"].get("member_ids") or [])]
        assert set(members) == set(valuka_members)
        cur.execute(
            """
            select count(*)::int as n
              from public.suppliers s
             where s.id = any(%s::uuid[])
               and s.facility_of = %s::uuid
               and s.is_published = false
            """,
            (members, parent_id),
        )
        assert cur.fetchone()["n"] == len(members)
        cur.execute(
            """
            select facility_of is null as ok
              from public.suppliers
             where id = %s::uuid
            """,
            (parent_id,),
        )
        assert cur.fetchone()["ok"] is True
        cur.execute(
            "select reviewed_at from public.verification_queue where id = %s::uuid",
            (VALUKA_QUEUE,),
        )
        assert cur.fetchone()["reviewed_at"] is not None
        cur.execute(
            """
            select count(*)::int as n
              from public.suppliers
             where is_published = true
               and id = any(%s::uuid[])
            """,
            (valuka_members,),
        )
        assert cur.fetchone()["n"] == 0
        cur.execute(
            """
            select count(*)::int as n
              from public.suppliers
             where is_published = true
               and id = %s::uuid
            """,
            (parent_id,),
        )
        assert cur.fetchone()["n"] == 1

        cur.execute("savepoint already_decided")
        with pytest.raises(NoDataFound, match="already decided"):
            cur.execute(
                "select public.admin_queue_decide(%s::uuid, 'release', null)",
                (VALUKA_QUEUE,),
            )
        cur.execute("rollback to savepoint already_decided")
        cur.execute(
            """
            select count(*)::int as n
              from public.suppliers
             where id = any(%s::uuid[])
               and facility_of = %s::uuid
               and is_published = false
            """,
            (valuka_members, parent_id),
        )
        assert cur.fetchone()["n"] == 2

        cur.execute(
            "select public.admin_queue_decide(%s::uuid, 'release', 'sql-audit') as r",
            (HURRICANE_QUEUE,),
        )
        hurricane_r = cur.fetchone()["r"]
        assert hurricane_r["release_action"] == "attach_facility"
        assert str(hurricane_r["plan"]["parent_id"]) == HURRICANE_MOTHER_ID
        cur.execute(
            """
            select facility_of, is_published
              from public.suppliers
             where id = %s::uuid
            """,
            (HURRICANE_CHILD_ID,),
        )
        hurricane_row = cur.fetchone()
        assert str(hurricane_row["facility_of"]) == HURRICANE_MOTHER_ID
        assert hurricane_row["is_published"] is False

        cur.execute(
            """
            select facility_of, is_published
              from public.suppliers
             where id = %s::uuid
            """,
            (SOUTH_EAST_CHILD,),
        )
        se_before = cur.fetchone()
        assert se_before["facility_of"] is None
        se_sr = _ids(
            cur,
            "select id from public.source_records where supplier_id = %s::uuid",
            (SOUTH_EAST_CHILD,),
        )
        cur.execute(
            "select public.admin_queue_decide(%s::uuid, 'reject', 'sql-audit') as r",
            (SOUTH_EAST_QUEUE,),
        )
        reject_r = cur.fetchone()["r"]
        assert reject_r["decision"] == "reject"
        cur.execute(
            """
            select facility_of, is_published
              from public.suppliers
             where id = %s::uuid
            """,
            (SOUTH_EAST_CHILD,),
        )
        se_after = cur.fetchone()
        assert se_after["facility_of"] is None
        assert se_after["is_published"] == se_before["is_published"]
        se_sr_after = _ids(
            cur,
            "select id from public.source_records where supplier_id = %s::uuid",
            (SOUTH_EAST_CHILD,),
        )
        assert se_sr_after == se_sr
        cur.execute(
            "select reviewed_at from public.verification_queue where id = %s::uuid",
            (SOUTH_EAST_QUEUE,),
        )
        assert cur.fetchone()["reviewed_at"] is not None

        merge_before = _absorb_before(cur, MERGE_WINNER, MERGE_LOSER)
        cur.execute(
            "select public.admin_queue_decide(%s::uuid, 'release', 'sql-audit') as r",
            (MERGE_QUEUE,),
        )
        merge_r = cur.fetchone()["r"]
        assert merge_r["release_action"] == "merge_into"
        assert str(merge_r["plan"]["winner_id"]) == MERGE_WINNER
        assert str(merge_r["plan"]["loser_id"]) == MERGE_LOSER
        _assert_absorbed(cur, MERGE_WINNER, MERGE_LOSER, merge_before)
        cur.execute(
            "select reviewed_at from public.verification_queue where id = %s::uuid",
            (MERGE_QUEUE,),
        )
        assert cur.fetchone()["reviewed_at"] is not None

        brand_before = _absorb_before(cur, BRAND_WINNER, BRAND_LOSER)
        cur.execute(
            "select public.admin_queue_decide(%s::uuid, 'release', 'sql-audit') as r",
            (BRAND_QUEUE,),
        )
        brand_r = cur.fetchone()["r"]
        assert brand_r["release_action"] == "attach_brand"
        assert str(brand_r["plan"]["winner_id"]) == BRAND_WINNER
        assert str(brand_r["plan"]["loser_id"]) == BRAND_LOSER
        _assert_absorbed(cur, BRAND_WINNER, BRAND_LOSER, brand_before)
        cur.execute(
            "select reviewed_at from public.verification_queue where id = %s::uuid",
            (BRAND_QUEUE,),
        )
        assert cur.fetchone()["reviewed_at"] is not None

        cur.execute(
            """
            select is_published
              from public.suppliers
             where id = %s::uuid
            """,
            (PUBLISH_WINNER,),
        )
        assert cur.fetchone()["is_published"] is False
        cur.execute(
            "select public.admin_queue_decide(%s::uuid, 'release', 'sql-audit') as r",
            (PUBLISH_QUEUE,),
        )
        pub_r = cur.fetchone()["r"]
        assert pub_r["release_action"] == "publish"
        cur.execute(
            """
            select is_published, facility_of
              from public.suppliers
             where id = %s::uuid
            """,
            (PUBLISH_WINNER,),
        )
        pub_row = cur.fetchone()
        assert pub_row["is_published"] is True
        assert pub_row["facility_of"] is None
        cur.execute(
            "select reviewed_at from public.verification_queue where id = %s::uuid",
            (PUBLISH_QUEUE,),
        )
        assert cur.fetchone()["reviewed_at"] is not None

        cur.execute("savepoint kenpark_hold")
        with pytest.raises(InvalidParameterValue, match="human"):
            cur.execute(
                "select public.admin_queue_decide(%s::uuid, 'release', null)",
                (KENPARK_QUEUE,),
            )
        cur.execute("rollback to savepoint kenpark_hold")
        cur.execute(
            "select reviewed_at from public.verification_queue where id = %s::uuid",
            (KENPARK_QUEUE,),
        )
        assert cur.fetchone()["reviewed_at"] is None

        cur.execute("savepoint ckl_hold")
        with pytest.raises(InvalidParameterValue, match="human"):
            cur.execute(
                "select public.admin_queue_decide(%s::uuid, 'release', null)",
                (CKL_QUEUE,),
            )
        cur.execute("rollback to savepoint ckl_hold")
        cur.execute(
            "select reviewed_at from public.verification_queue where id = %s::uuid",
            (CKL_QUEUE,),
        )
        assert cur.fetchone()["reviewed_at"] is None
