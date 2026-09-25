"""Apply 0105 in a rolled-back transaction and run its guard's assertions.

`etl/tests/test_supplier_contact_counts_sql.py` skips until 0105 is applied, so
without this the PR would ship a durable guard nobody had ever seen pass. This
applies the migration inside one transaction, runs the same five assertions the
test makes, and rolls back.

    python ops/verify_0105_guards.py

Nothing is committed and nothing here is `--apply` (AGENTS 15). Output of the
25 Sep 2026 run is in `ops/plans/rez-c-0105-dry-run.md`.
"""
import os
import pathlib
import re
import subprocess

import psycopg
from psycopg.rows import dict_row

# The checkout this file is in, so a worktree verifies its own migration.
REPO = pathlib.Path(__file__).resolve().parents[1]
MIG = REPO / "supabase" / "migrations" / "0105_supplier_record_v32.sql"


def _dsn() -> str:
    """`SUPABASE_DB_URL` from the environment, else this checkout's `.env`,
    else the main checkout's — `.env` is git-ignored, so a worktree has none."""
    if os.environ.get("SUPABASE_DB_URL"):
        return os.environ["SUPABASE_DB_URL"]
    common = subprocess.run(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        cwd=REPO, capture_output=True, text=True, check=True,
    ).stdout.strip()
    for env in (REPO / ".env", pathlib.Path(common).parent / ".env"):
        if env.exists():
            for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
                if line.startswith("SUPABASE_DB_URL="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("SUPABASE_DB_URL is not set and no .env holds it")


dsn = _dsn()

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

        # Recounted here, in Python, from the raw columns — not by restating
        # the function's SQL, which would agree with any bug it has.
        cur.execute(
            "select s.slug, s.email_primary, s.phones, s.website, s.contact_name, "
            "public.supplier_contact_counts(s.slug) as counts from public.suppliers s where s.is_published"
        )
        rows = cur.fetchall()
        mismatches = []
        for row in rows:
            digits = {re.sub(r"\D", "", ph) for ph in row["phones"] or []}
            website = row["website"] or ""
            expect = {
                "emails": len(re.findall(r"[^@\s,;]+\s*@\s*[^@\s,;]+", row["email_primary"] or "")),
                "phones": len({d for d in digits if len(d) >= 6}),
                "website": bool(re.search(r"[a-z0-9-]+\.[a-z]{2,}", website, re.I)) and "@" not in website,
                "representatives": 1 if (row["contact_name"] or "").strip() else 0,
            }
            if row["counts"] != expect:
                mismatches.append((row["slug"], row["counts"], expect))
        assert not mismatches, mismatches[:10]
        # The shapes that made the first version wrong, on real rows.
        scheme_only = [r for r in rows if (r["website"] or "").strip() in ("https://", "http://")]
        assert scheme_only and all(r["counts"]["website"] is False for r in scheme_only), len(scheme_only)
        no_at = [r for r in rows if (r["email_primary"] or "").strip() and "@" not in r["email_primary"]]
        assert all(r["counts"]["emails"] == 0 for r in no_at), [r["slug"] for r in no_at]
        several = [r for r in rows if (r["email_primary"] or "").count("@") >= 2]
        assert several and all(r["counts"]["emails"] >= 2 for r in several), len(several)
        print(
            f"counts match a Python recount: 0 mismatches over all {len(rows):,} published records "
            f"({len(scheme_only)} scheme-only websites count as none, {len(no_at)} '@'-less emails as 0, "
            f"{len(several)} multi-address fields as 2+) OK"
        )
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
