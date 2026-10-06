"""REZ-C boundary test: `rfq_create` itself refuses a sanctioned supplier.

Hand-off §3 makes this one of three non-optional boundary tests, and AGENTS 16
is explicit that a helper-level test does not count where the deliverable is
something an outside caller observes. The record sheet disables Send RFQ on a
sanctioned record, and `components/record/record.test.ts` asserts that
in the HTML — but hiding UI is never a security control, so the claim that
matters is about the function a caller can reach directly through PostgREST.

That claim cannot be made from Node. This runs the LIVE `rfq_create` against
the real database, as `authenticated` rather than as the database owner, inside
one transaction that always rolls back.

The experiment is controlled: ONE supplier, called twice, with `is_sanctioned`
the only thing that changes between the calls. An earlier version used a
different supplier for the refusal than for the acceptance, so any per-supplier
reason to refuse would have been indistinguishable from the sanction.

What this is, stated plainly: `rfq_create` already refused a sanctioned target
before REZ-C — migration 0105 changes that function not at all. So this is a
CHARACTERISATION test of behaviour the PR relies on, not a guard on behaviour
the PR adds. It is here because the hand-off requires the claim to be asserted
where an outside caller observes it.

CI has no Postgres (`CLAUDE.md`: pytest and ruff run on the founder's machine
only), so without `SUPABASE_DB_URL` these skip — and that skip is the whole
assertion disappearing. The other two ways it could vanish quietly, a missing
buyer profile and a missing published supplier, are `pytest.fail` rather than
`pytest.skip` for exactly that reason.

Nothing is committed, and this session never calls `--apply` (AGENTS 15).
"""

from __future__ import annotations

import os
from contextlib import contextmanager
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


@pytest.fixture(scope="module")
def fixture_ids(rfq_conn):
    """One buyer and one published, unsanctioned supplier.

    Module-scoped on purpose. A function-scoped version re-queried
    `where is_sanctioned = false` on a connection where an earlier test's
    UPDATE was still live, so each test silently used a different row — and
    running one test alone exercised a different row than the full file did.
    """
    with rfq_conn.cursor() as cur:
        cur.execute("select id from public.profiles where role::text = 'buyer' order by id limit 1")
        buyer = cur.fetchone()
        if buyer is None:
            pytest.fail("no buyer profile in this database: this boundary test cannot run and must not pass silently")
        cur.execute(
            """
            select id
              from public.suppliers
             where is_published = true
               and is_sanctioned = false
             order by id
             limit 1
            """
        )
        supplier = cur.fetchone()
        if supplier is None:
            pytest.fail("no published unsanctioned supplier: this boundary test cannot run and must not pass silently")

    return {"buyer_id": str(buyer["id"]), "supplier_id": str(supplier["id"])}


@contextmanager
def as_buyer(conn, buyer_id: str):
    """A rolled-back savepoint in which the session is `authenticated`, not the owner.

    The DSN connects as the database owner, for whom RLS is not enforced and
    every EXECUTE is granted. The claim this file makes is about the caller a
    buyer's browser actually is, so the role is set here — which additionally
    proves `authenticated` holds EXECUTE on `rfq_create` at all.
    """
    with conn.transaction(force_rollback=True):
        with conn.cursor() as cur:
            cur.execute("select set_config('request.jwt.claims', %s, true)", ('{"sub": "%s"}' % buyer_id,))
            cur.execute("set local role authenticated")
            cur.execute("select auth.uid() as uid")
            row = cur.fetchone()
            assert row is not None and str(row["uid"]) == buyer_id, "auth.uid() did not take the claim"
        yield


def _payload(target_ids: list[str]) -> str:
    import json

    return json.dumps(
        {
            "target_supplier_ids": target_ids,
            "product_title": "REZ-C boundary test - rolled back",
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


def test_rfq_create_accepts_the_supplier_until_it_is_sanctioned(rfq_conn, fixture_ids):
    """The controlled pair: one supplier, one variable, both halves in one test."""
    import psycopg

    sid = fixture_ids["supplier_id"]

    # Before. Without this half, a function that refused everything would pass
    # the refusal below while proving nothing about the sanction.
    with as_buyer(rfq_conn, fixture_ids["buyer_id"]):
        assert _call(rfq_conn, [sid]) is not None

    # After: the same row, sanctioned inside the transaction.
    with rfq_conn.transaction(force_rollback=True):
        with rfq_conn.cursor() as cur:
            cur.execute("update public.suppliers set is_sanctioned = true where id = %s::uuid", (sid,))
        with as_buyer(rfq_conn, fixture_ids["buyer_id"]):
            with pytest.raises(psycopg.errors.RaiseException) as err:
                with rfq_conn.transaction(force_rollback=True):
                    _call(rfq_conn, [sid])
    msg = str(err.value).lower()
    assert "target suppliers" in msg or "sanction" in msg, str(err.value)


def test_rfq_create_refuses_a_batch_that_contains_one_sanctioned_target(rfq_conn, fixture_ids):
    """The whole call is refused, not the sanctioned target quietly dropped.

    A silently shortened target list sends an RFQ the buyer did not review.
    """
    import psycopg

    sid = fixture_ids["supplier_id"]
    with rfq_conn.transaction(force_rollback=True):
        with rfq_conn.cursor() as cur:
            cur.execute(
                """
                select id from public.suppliers
                 where is_published = true and is_sanctioned = false and id <> %s::uuid
                 order by id limit 1
                """,
                (sid,),
            )
            other = cur.fetchone()
            assert other is not None, "only one published supplier in this database"
            cur.execute("update public.suppliers set is_sanctioned = true where id = %s::uuid", (sid,))

        with as_buyer(rfq_conn, fixture_ids["buyer_id"]):
            # The raising call gets a savepoint of its own: a statement that
            # raises aborts everything back to the enclosing savepoint, so the
            # count below has to sit outside it or it cannot run at all.
            with pytest.raises(psycopg.errors.RaiseException):
                with rfq_conn.transaction(force_rollback=True):
                    _call(rfq_conn, [str(other["id"]), sid])

        with rfq_conn.cursor() as cur:
            cur.execute(
                "select count(*)::int as n from public.rfqs where buyer_id = %s::uuid and product_title like 'REZ-C boundary test%%'",
                (fixture_ids["buyer_id"],),
            )
            row = cur.fetchone()
        assert row is not None and row["n"] == 0, "a refused call still wrote an rfqs row"
