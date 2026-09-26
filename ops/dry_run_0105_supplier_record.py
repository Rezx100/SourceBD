"""Dry run of migration 0105 (REZ-C) in ONE transaction that is always rolled back.

Applies `0105_supplier_record_v32.sql`, then proves:

  * `supplier_contact_counts` exists, is STABLE SECURITY DEFINER with
    `search_path = public`, and is executable by `authenticated` and
    `service_role` but NOT by `anon`;
  * `buyer_supplier_profile` is byte-identical before and after (same md5 of
    `pg_get_functiondef`) -- 0105 must not rewrite it, because production's
    copy is ahead of this repo's migrations (see the migration's header);
  * the counts are right on real rows, and the function returns null for an
    unpublished record and for an unknown slug.

Then it rolls back. Nothing is committed, and nothing here is `--apply`
(AGENTS rule 15). Reads `SUPABASE_DB_URL` from `.env`.

    python ops/dry_run_0105_supplier_record.py

Output of the 25 Sep 2026 run: `ops/plans/rez-c-0105-dry-run.md`.
"""
import hashlib
import pathlib

import psycopg
from psycopg.rows import dict_row

REPO = pathlib.Path("E:/SourceBD")
MIG = REPO / "supabase" / "migrations" / "0105_supplier_record_v32.sql"
env = (REPO / ".env").read_text(encoding="utf-8", errors="replace")
dsn = next(
    line.split("=", 1)[1].strip().strip('"').strip("'")
    for line in env.splitlines()
    if line.startswith("SUPABASE_DB_URL=")
)

raw = MIG.read_bytes()
CRLF = bytes([13, 10])
print("file          : supabase/migrations/0105_supplier_record_v32.sql")
print("bytes         : %d" % len(raw))
print("line endings  : " + ("CRLF" if CRLF in raw else "LF"))
print("sha256        : " + hashlib.sha256(raw).hexdigest())
print()

conn = psycopg.connect(dsn, autocommit=False, row_factory=dict_row, connect_timeout=30)
try:
    with conn.cursor() as cur:

        def show(label, sql, args=()):
            cur.execute(sql, args)
            rows = cur.fetchall()
            print(label + ":")
            for r in rows:
                print("   ", dict(r))
            if not rows:
                print("    (no rows)")
            print()

        print("=== BEFORE ===")
        show(
            "supplier_contact_counts exists",
            "select count(*)::int as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
            "where n.nspname='public' and p.proname='supplier_contact_counts'",
        )
        show(
            "buyer_supplier_profile md5",
            "select md5(pg_get_functiondef(p.oid)) as md5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
            "where n.nspname='public' and p.proname='buyer_supplier_profile'",
        )

        print("=== APPLYING 0105 (this transaction only) ===")
        cur.execute(MIG.read_text(encoding="utf-8"))
        print("applied without error")
        print()

        print("=== AFTER ===")
        show(
            "supplier_contact_counts exists",
            "select count(*)::int as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
            "where n.nspname='public' and p.proname='supplier_contact_counts'",
        )
        show(
            "buyer_supplier_profile md5 (must be unchanged)",
            "select md5(pg_get_functiondef(p.oid)) as md5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
            "where n.nspname='public' and p.proname='buyer_supplier_profile'",
        )
        show(
            "security / volatility / search_path",
            "select p.prosecdef as security_definer, p.provolatile as volatility, array_to_string(p.proconfig,'|') as config "
            "from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
            "where n.nspname='public' and p.proname='supplier_contact_counts'",
        )
        show(
            "grants (anon must NOT appear)",
            "select grantee, privilege_type from information_schema.role_routine_grants "
            "where routine_schema='public' and routine_name='supplier_contact_counts' order by grantee",
        )

        print("=== BEHAVIOUR ON REAL ROWS ===")
        show(
            "the 11-source record (aboni)",
            "select s.slug, public.supplier_contact_counts(s.slug) as counts "
            "from public.suppliers s where s.slug like 'aboni%%' and s.is_published limit 1",
        )
        show(
            "three more published records",
            "select s.slug, public.supplier_contact_counts(s.slug) as counts "
            "from public.suppliers s where s.is_published order by s.slug limit 3",
        )
        show(
            "a record with no contact detail at all, if one exists",
            "select s.slug, public.supplier_contact_counts(s.slug) as counts from public.suppliers s "
            "where s.is_published and s.email_primary is null and coalesce(array_length(s.phones,1),0)=0 "
            "and s.contact_name is null and s.website is null limit 1",
        )
        show(
            "an UNPUBLISHED record must return null",
            "select s.slug, public.supplier_contact_counts(s.slug) as counts from public.suppliers s "
            "where s.is_published = false limit 1",
        )
        show(
            "an unknown slug must return null",
            "select public.supplier_contact_counts('no-such-slug-at-all') as counts",
        )

        print("=== TOTALS ACROSS THE PUBLISHED SET ===")
        show(
            "what the locked cards will say, in aggregate",
            "select count(*)::int as published, "
            " count(*) filter (where (public.supplier_contact_counts(slug)->>'emails')::int > 0)::int as with_email, "
            " count(*) filter (where (public.supplier_contact_counts(slug)->>'phones')::int > 0)::int as with_phone, "
            " count(*) filter (where (public.supplier_contact_counts(slug)->>'website')::boolean)::int as with_website, "
            " count(*) filter (where (public.supplier_contact_counts(slug)->>'representatives')::int > 0)::int as with_rep "
            "from public.suppliers where is_published",
        )
finally:
    conn.rollback()
    conn.close()
    print("=== ROLLED BACK -- nothing was committed ===")
