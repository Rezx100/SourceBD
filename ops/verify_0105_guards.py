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



def _expected(row) -> dict:
    """The counts, recomputed from the raw columns by splitting and scanning —
    deliberately not the migration's regular expressions, which a transliterated
    recount would agree with however wrong they were (audit cycle 5)."""
    def tokens(text: str) -> list[str]:
        for sep in ",;/\n\t":
            text = text.replace(sep, " ")
        return [t for t in text.split(" ") if t]

    def has_letters(s: str, n: int) -> bool:
        run = 0
        for ch in s:
            run = run + 1 if ch.isalpha() else 0
            if run >= n:
                return True
        return False

    # "a @ b.com" is one address: close the spaces around '@' before splitting.
    mail = row["email_primary"] or ""
    while " @" in mail or "@ " in mail:
        mail = mail.replace(" @", "@").replace("@ ", "@")
    emails = sum(1 for t in tokens(mail) if t.count("@") == 1 and t.index("@") > 0 and "." in t.split("@")[1].strip(".")[1:])

    phones = {"".join(ch for ch in ph if ch.isdigit()) for ph in row["phones"] or []}
    phones = {d for d in phones if len(d) >= 6}

    def is_site(t: str) -> bool:
        if "@" in t:
            return False
        host = t.split("://", 1)[-1]
        for i, ch in enumerate(host):
            if ch == "." and i > 0 and has_letters(host[i + 1 : i + 3], 2):
                return True
        return False

    website = any(is_site(t) for t in tokens((row["website"] or "").lower()))

    return {
        "emails": emails,
        "phones": len(phones),
        "website": website,
        "representatives": 1 if has_letters(row["contact_name"] or "", 3) else 0,
    }


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

        # Recounted here, in Python, by splitting and scanning the raw columns
        # (`_expected`) — not by restating the function's SQL.
        cur.execute(
            "select s.slug, s.email_primary, s.phones, s.website, s.contact_name, "
            "public.supplier_contact_counts(s.slug) as counts from public.suppliers s where s.is_published"
        )
        rows = cur.fetchall()
        mismatches = [(r["slug"], r["counts"], _expected(r)) for r in rows if r["counts"] != _expected(r)]
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
