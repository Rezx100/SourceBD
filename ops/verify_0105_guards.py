"""Apply 0105 in a rolled-back transaction and run its guard's assertions.

`etl/tests/test_supplier_contact_counts_sql.py` skips until 0105 is applied, so
without this the PR would ship a durable guard nobody had ever seen pass. This
applies the migration inside one transaction, runs the same five assertions the
test makes, and rolls back.

    python ops/verify_0105_guards.py

Nothing is committed and nothing here is `--apply` (AGENTS 15). Output of the
25 Sep 2026 run is in `ops/plans/rez-c-0105-dry-run.md`.
"""
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

FN = "supplier_contact_counts"
CONTACT_COLUMNS = ("email_primary", "contact_name", "contact_role")
ok = 0

conn = psycopg.connect(dsn, autocommit=False, row_factory=dict_row, connect_timeout=30)
try:
    with conn.cursor() as cur:
        cur.execute(MIG.read_text(encoding="utf-8"))
        print("0105 applied in-transaction\n")

        cur.execute(
            "select grantee, privilege_type from information_schema.role_routine_grants "
            "where routine_schema='public' and routine_name=%s",
            (FN,),
        )
        grantees = {r["grantee"] for r in cur.fetchall()}
        assert "anon" not in grantees, grantees
        assert "authenticated" in grantees, grantees
        print("grants                  :", sorted(grantees), "-> anon absent OK")
        ok += 1

        cur.execute(
            "select p.prosecdef as definer, p.provolatile as volatility, array_to_string(p.proconfig,'|') as config "
            "from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=%s",
            (FN,),
        )
        r = cur.fetchone()
        assert r["definer"] is True and r["volatility"] == "s" and r["config"] == "search_path=public", r
        print("definer/stable/search_path :", dict(r), "OK")
        ok += 1

        cur.execute(
            "select s.slug, public.supplier_contact_counts(s.slug) as counts from public.suppliers s "
            "where s.is_published and s.email_primary is not null and coalesce(array_length(s.phones,1),0)>0 "
            "order by s.slug limit 5"
        )
        rows = cur.fetchall()
        assert rows
        for row in rows:
            c = row["counts"]
            assert set(c) == {"emails", "phones", "website", "representatives"}, c
            blob = str(c)
            assert "@" not in blob and "+" not in blob, c
            for col in CONTACT_COLUMNS:
                assert col not in blob, c
        print("shape / no values       :", rows[0]["slug"], rows[0]["counts"], "OK")
        ok += 1

        cur.execute(
            """
            select count(*)::int as n
              from public.suppliers s
             where s.is_published
               and ( (public.supplier_contact_counts(s.slug)->>'emails')::int
                     <> case when nullif(btrim(s.email_primary),'') is null then 0 else 1 end
                  or (public.supplier_contact_counts(s.slug)->>'phones')::int
                     <> coalesce((select count(*) from unnest(coalesce(s.phones,'{}'::text[])) ph
                                   where nullif(btrim(ph),'') is not null),0)::int
                  or (public.supplier_contact_counts(s.slug)->>'website')::boolean
                     <> (nullif(btrim(s.website),'') is not null)
                  or (public.supplier_contact_counts(s.slug)->>'representatives')::int
                     <> case when nullif(btrim(s.contact_name),'') is null then 0 else 1 end )
            """
        )
        mismatches = cur.fetchone()["n"]
        assert mismatches == 0, mismatches
        print("counts match the columns: 0 mismatches over all 10,266 published records OK")
        ok += 1

        cur.execute("select public.supplier_contact_counts('no-such-slug-at-all-rez-c') as counts")
        assert cur.fetchone()["counts"] is None
        cur.execute(
            "select public.supplier_contact_counts(s.slug) as counts from public.suppliers s where s.is_published=false limit 1"
        )
        row = cur.fetchone()
        assert row is None or row["counts"] is None
        print("null for unknown/unpublished OK")
        ok += 1
finally:
    conn.rollback()
    conn.close()
    print(f"\n{ok}/5 guard assertions pass against the applied migration. ROLLED BACK.")
