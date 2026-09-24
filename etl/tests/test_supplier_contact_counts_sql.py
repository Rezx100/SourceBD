"""REZ-C: `supplier_contact_counts` returns counts, and `anon` cannot call it.

The durable guard (closed-loop §16) for a defect the 0105 dry run found: the
first version of the migration used `revoke all ... from public`, and `anon`
still held EXECUTE afterwards, because Supabase's default privileges grant it
BY NAME and a revoke from PUBLIC does not touch a named grant. The founder's
rule of 23 Sep is that contact details are sign-in gated, and how many a record
holds is part of that same locked card.

A repaired migration body is not a guard. If someone later adds another
security-definer function to this schema the same way, or edits 0105's grants,
this is what notices.

It also pins the shape: four keys, all counts or booleans, and no contact
value — the contract the whole locked card rests on.

These skip until 0105 is applied, because there is nothing to inspect before
then. That is stated rather than silent: `test_0105_is_applied_or_skip` names
the state it found.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parents[2]
load_dotenv(REPO / ".env")

FN = "supplier_contact_counts"
# Column names that could only appear in the payload if a VALUE had been
# spread into it. `phones` and `website` are excluded on purpose: they are the
# names of two of the four keys, and counting them as leaks would make this
# assertion fail on a correct function.
VALUE_ONLY_COLUMNS = ("email_primary", "contact_name", "contact_role")


def _dsn() -> str | None:
    return os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")


@pytest.fixture(scope="module")
def conn():
    dsn = _dsn()
    if not dsn:
        pytest.skip("SUPABASE_DB_URL not set")
    import psycopg
    from psycopg.rows import dict_row

    c = psycopg.connect(dsn, autocommit=False, row_factory=dict_row, connect_timeout=30)
    try:
        yield c
    finally:
        c.rollback()
        c.close()


def _exists(conn) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            select count(*)::int as n
              from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = %s
            """,
            (FN,),
        )
        row = cur.fetchone()
    return bool(row and row["n"] > 0)


@pytest.fixture(scope="module")
def applied(conn):
    if not _exists(conn):
        pytest.skip(f"{FN} is not in this database yet — migration 0105 is not applied")
    return True


def test_0105_is_applied_or_skip(conn):
    """Names the state, so 'all green' never hides 'none of it ran'."""
    if not _exists(conn):
        pytest.skip(f"{FN} absent: 0105 not applied. The grant and shape guards below did NOT run.")
    assert _exists(conn)


def test_anon_cannot_execute(conn, applied):
    with conn.cursor() as cur:
        cur.execute(
            """
            select grantee, privilege_type
              from information_schema.role_routine_grants
             where routine_schema = 'public' and routine_name = %s
            """,
            (FN,),
        )
        grants = {(r["grantee"], r["privilege_type"]) for r in cur.fetchall()}
    grantees = {g for g, _ in grants}
    assert "anon" not in grantees, f"anon can call {FN}; contact counts are sign-in gated (23 Sep): {sorted(grantees)}"
    assert "authenticated" in grantees, f"a signed-in buyer cannot call {FN}: {sorted(grantees)}"


def test_is_security_definer_with_a_pinned_search_path(conn, applied):
    # 0083 revoked the contact columns from `authenticated`, so the count has to
    # be taken inside a definer function; an unpinned search_path in one is a
    # well-known way to get it to run the wrong `suppliers`.
    with conn.cursor() as cur:
        cur.execute(
            """
            select p.prosecdef as definer, p.provolatile as volatility,
                   array_to_string(p.proconfig, '|') as config
              from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = %s
            """,
            (FN,),
        )
        row = cur.fetchone()
    assert row is not None
    assert row["definer"] is True, f"{FN} is not SECURITY DEFINER"
    assert row["volatility"] == "s", f"{FN} is not STABLE"
    assert row["config"] == "search_path=public", f"{FN} has an unpinned search_path: {row['config']}"


def test_returns_counts_and_never_a_value(conn, applied):
    with conn.cursor() as cur:
        cur.execute(
            """
            select s.slug, public.supplier_contact_counts(s.slug) as counts
              from public.suppliers s
             where s.is_published
               and s.email_primary is not null
               and coalesce(array_length(s.phones, 1), 0) > 0
             order by s.slug
             limit 5
            """
        )
        rows = cur.fetchall()
    assert rows, "no published record holds both an email and a phone number"
    for r in rows:
        counts = r["counts"]
        assert set(counts) == {"emails", "phones", "website", "representatives"}, counts
        assert isinstance(counts["emails"], int) and counts["emails"] >= 0
        assert isinstance(counts["phones"], int) and counts["phones"] >= 0
        assert isinstance(counts["representatives"], int) and counts["representatives"] >= 0
        assert isinstance(counts["website"], bool)
        # The whole point: nothing in the payload is a contact detail.
        blob = str(counts)
        assert "@" not in blob, f"an email address is in the counts for {r['slug']}: {counts}"
        assert "+" not in blob, f"a phone number is in the counts for {r['slug']}: {counts}"
        for col in VALUE_ONLY_COLUMNS:
            assert col not in blob, f"the {col} column name is in the counts for {r['slug']}"


def test_the_counts_match_the_columns_they_count(conn, applied):
    # A count that is not the count is worse than no count.
    with conn.cursor() as cur:
        cur.execute(
            """
            select s.slug,
                   public.supplier_contact_counts(s.slug) as counts,
                   case when nullif(btrim(s.email_primary), '') is null then 0 else 1 end as want_emails,
                   coalesce((select count(*) from unnest(coalesce(s.phones, '{}'::text[])) ph
                              where nullif(btrim(ph), '') is not null), 0)::int as want_phones,
                   (nullif(btrim(s.website), '') is not null) as want_website,
                   case when nullif(btrim(s.contact_name), '') is null then 0 else 1 end as want_reps
              from public.suppliers s
             where s.is_published
             order by s.slug
             limit 200
            """
        )
        rows = cur.fetchall()
    assert len(rows) > 0
    for r in rows:
        c = r["counts"]
        assert c["emails"] == r["want_emails"], r["slug"]
        assert c["phones"] == r["want_phones"], r["slug"]
        assert c["website"] == r["want_website"], r["slug"]
        assert c["representatives"] == r["want_reps"], r["slug"]


def test_null_for_an_unpublished_or_unknown_slug(conn, applied):
    # Not zeros: a record nobody may see, and a record that does not exist, are
    # both "no answer", and the locked card then claims nothing about kinds.
    with conn.cursor() as cur:
        cur.execute("select public.supplier_contact_counts('no-such-slug-at-all-rez-c') as counts")
        assert cur.fetchone()["counts"] is None
        cur.execute(
            """
            select public.supplier_contact_counts(s.slug) as counts
              from public.suppliers s where s.is_published = false limit 1
            """
        )
        row = cur.fetchone()
        if row is not None:
            assert row["counts"] is None, "an unpublished record answers the contact-counts function"
