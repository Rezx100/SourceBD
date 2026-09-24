"""REZ-C boundary test: `rfq_create` itself refuses a sanctioned supplier.

Hand-off §3 makes this one of three non-optional boundary tests, and AGENTS 16
is explicit that a helper-level test does not count where the deliverable is
something an outside caller observes. The record sheet disables Send RFQ on a
sanctioned record, and `components/dashboard/record-sheet.test.ts` asserts that
in the HTML — but hiding UI is never a security control, so the claim that
matters is about the function a caller can reach directly through PostgREST.

That claim cannot be made from Node. This runs the LIVE `rfq_create` against
the real database inside one transaction and always rolls back:

  1. pick a real buyer and two real published suppliers,
  2. flip one of them to `is_sanctioned = true` — inside the transaction,
  3. call `rfq_create` with it in the target list and assert it raises,
  4. call `rfq_create` with only the clean one and assert it does NOT raise,
     so step 3 is not passing for some unrelated reason,
  5. roll back, so not one row survives.

Nothing is committed, and the session never calls `--apply` (AGENTS 15).

CI has no Postgres; without SUPABASE_DB_URL these skip, like the other
DB-backed tests in this directory.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parents[2]
load_dotenv(REPO / ".env")


def _dsn() -> str | None:
    return os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")


@pytest.fixture(scope="module")
def rfq_conn():
    dsn = _dsn()
    if not dsn:
        pytest.skip("SUPABASE_DB_URL not set")
    import psycopg
    from psycopg.rows import dict_row

    conn = psycopg.connect(dsn, autocommit=False, row_factory=dict_row, connect_timeout=30)
    try:
        yield conn
    finally:
        # Always. Every test in this file writes, and none of it may survive.
        conn.rollback()
        conn.close()


@pytest.fixture
def fixture_ids(rfq_conn):
    """A buyer and two published suppliers, one of them made sanctioned here.

    Each test runs inside its own savepoint so a raising call does not poison
    the ones after it, and the module fixture rolls the whole thing back.
    """
    with rfq_conn.cursor() as cur:
        cur.execute("select id from public.profiles where role::text = 'buyer' order by id limit 1")
        buyer = cur.fetchone()
        if buyer is None:
            pytest.skip("no buyer profile in this database")
        cur.execute(
            """
            select id
              from public.suppliers
             where is_published = true
               and is_sanctioned = false
             order by id
             limit 2
            """
        )
        suppliers = cur.fetchall()
        if len(suppliers) < 2:
            pytest.skip("fewer than two published suppliers in this database")

        clean_id = str(suppliers[0]["id"])
        target_id = str(suppliers[1]["id"])
        # Inside the transaction only. Production has no sanctioned published
        # supplier today (SQL, 25 Sep 2026), so the state under test has to be
        # created rather than found.
        cur.execute("update public.suppliers set is_sanctioned = true where id = %s::uuid", (target_id,))
        cur.execute("select set_config('request.jwt.claims', %s, true)", ('{"sub": "%s"}' % str(buyer["id"]),))
        cur.execute("select auth.uid() as uid")
        row = cur.fetchone()
        assert row is not None and str(row["uid"]) == str(buyer["id"]), "auth.uid() did not take the claim"

    return {"buyer_id": str(buyer["id"]), "clean_id": clean_id, "sanctioned_id": target_id}


def _payload(target_ids: list[str]) -> str:
    import json

    return json.dumps(
        {
            "target_supplier_ids": target_ids,
            "product_title": "REZ-C boundary test — rolled back",
            "quantity": 100,
            "quantity_unit": "pcs",
        }
    )


def _call(conn, target_ids: list[str]):
    with conn.cursor() as cur:
        cur.execute("select public.rfq_create(%s::jsonb) as id", (_payload(target_ids),))
        row = cur.fetchone()
    assert row is not None
    return row["id"]


def test_rfq_create_refuses_a_sanctioned_target(rfq_conn, fixture_ids):
    import psycopg

    with pytest.raises(psycopg.errors.RaiseException) as err:
        with rfq_conn.transaction(force_rollback=True):
            _call(rfq_conn, [fixture_ids["sanctioned_id"]])
    assert "target suppliers" in str(err.value).lower() or "sanction" in str(err.value).lower(), str(err.value)


def test_rfq_create_refuses_a_batch_that_contains_one_sanctioned_target(rfq_conn, fixture_ids):
    # The whole call is refused, not the sanctioned target quietly dropped —
    # a silently shortened target list sends an RFQ the buyer did not review.
    import psycopg

    with rfq_conn.transaction(force_rollback=True):
        # The raising call gets a savepoint of its own: a statement that raises
        # aborts everything back to the enclosing savepoint, so the count below
        # has to sit outside it or it cannot run at all.
        with pytest.raises(psycopg.errors.RaiseException):
            with rfq_conn.transaction(force_rollback=True):
                _call(rfq_conn, [fixture_ids["clean_id"], fixture_ids["sanctioned_id"]])

        with rfq_conn.cursor() as cur:
            cur.execute(
                "select count(*)::int as n from public.rfqs where buyer_id = %s::uuid and product_title like 'REZ-C boundary test%%'",
                (fixture_ids["buyer_id"],),
            )
            row = cur.fetchone()
        assert row is not None and row["n"] == 0, "a refused call still wrote an rfqs row"


def test_rfq_create_accepts_a_clean_target(rfq_conn, fixture_ids):
    # Without this, the two tests above would pass on a function that refuses
    # everything — which proves nothing about the sanction.
    with rfq_conn.transaction(force_rollback=True):
        rfq_id = _call(rfq_conn, [fixture_ids["clean_id"]])
        assert rfq_id is not None
