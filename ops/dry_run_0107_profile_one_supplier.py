"""Dry run of migration 0107 in ONE transaction that is always rolled back.

0107 changes two FROM clauses in `buyer_supplier_profile` so its two views are
read for one supplier instead of all of them. This proves, on production:

  * the live definition is still the base 0107 was built from (md5 below);
    if it is not, it stops before applying anything, because 0107 would then
    overwrite a change nobody has reviewed;
  * after the apply, the function is still STABLE SECURITY DEFINER with
    `search_path = public` and keeps its grants;
  * it returns the same jsonb as before for a sample that covers its branches:
    records at random, the ones with the most source records, mothers of
    facility buildings, EPB-only records, and an unknown slug (null);
  * how long it takes before and after.

Then it rolls back. Nothing is committed, and nothing here is `--apply`
(AGENTS rule 15). Reads `SUPABASE_DB_URL` from `.env`.

    python ops/dry_run_0107_profile_one_supplier.py

Evidence and the founder's command: `ops/plans/0107-profile-one-supplier.md`.
"""
import hashlib
import json
import pathlib
import statistics
import time

import psycopg
from psycopg.rows import dict_row

REPO = pathlib.Path("E:/SourceBD")
MIG = REPO / "supabase" / "migrations" / "0107_buyer_supplier_profile_one_supplier.sql"
BASE_MD5 = "63ee7ea06bacb0d30a537d78bc38ae28"

env = (REPO / ".env").read_text(encoding="utf-8", errors="replace")
dsn = next(
    line.split("=", 1)[1].strip().strip('"').strip("'")
    for line in env.splitlines()
    if line.startswith("SUPABASE_DB_URL=")
)

raw = MIG.read_bytes()
print("file          : supabase/migrations/0107_buyer_supplier_profile_one_supplier.sql")
print("bytes         : %d" % len(raw))
print("line endings  : " + ("CRLF" if bytes([13, 10]) in raw else "LF"))
print("sha256        : " + hashlib.sha256(raw).hexdigest())
print()

DEF = (
    "select md5(pg_get_functiondef(p.oid)) as md5, p.provolatile, p.prosecdef, p.proconfig, p.proacl::text as acl "
    "from pg_proc p join pg_namespace n on n.oid = p.pronamespace "
    "where n.nspname = 'public' and p.proname = 'buyer_supplier_profile'"
)
SAMPLE = """
select slug, kind from (
  (select slug, 'random' as kind from public.suppliers where is_published order by md5(slug || 'r1') limit 20)
  union all
  (select s.slug, 'most sources' from public.suppliers s
     join (select supplier_id from public.source_records where status = 'active'
            group by supplier_id order by count(*) desc limit 12) m on m.supplier_id = s.id
    where s.is_published)
  union all
  (select slug, 'facility mother' from public.suppliers s where is_published
      and exists (select 1 from public.suppliers f where f.facility_of = s.id) order by md5(slug) limit 8)
  union all
  (select slug, 'EPB only' from public.suppliers where is_published and source_tags = array['EPB']::text[]
    order by md5(slug) limit 4)
  union all
  (select 'no-such-slug-0107', 'unknown slug')
) x
"""


def read_all(cur, slugs):
    """Each record's payload (as text, null kept) and how long the call took."""
    out, ms = {}, []
    for slug in slugs:
        t0 = time.perf_counter()
        cur.execute("select public.buyer_supplier_profile(%s)::text as j", (slug,))
        ms.append((time.perf_counter() - t0) * 1000)
        out[slug] = cur.fetchone()["j"]
    return out, ms


conn = psycopg.connect(dsn, autocommit=False, row_factory=dict_row, connect_timeout=30)
try:
    with conn.cursor() as cur:
        cur.execute(DEF)
        before = cur.fetchone()
        print("=== BEFORE ===")
        print("definition md5:", before["md5"], "(0107 was built from %s)" % BASE_MD5)
        if before["md5"] != BASE_MD5:
            raise SystemExit(
                "STOP: production's buyer_supplier_profile is no longer the base 0107 was built from. "
                "Rebuild 0107 from the live definition before applying it."
            )
        cur.execute(SAMPLE)
        sample = cur.fetchall()
        slugs = [r["slug"] for r in sample]
        kinds = {r["slug"]: r["kind"] for r in sample}
        old, old_ms = read_all(cur, slugs)
        print("sample        : %d records" % len(slugs))
        print()

        print("=== APPLYING 0107 (this transaction only) ===")
        cur.execute(MIG.read_text(encoding="utf-8"))
        print("applied without error")
        print()

        print("=== AFTER ===")
        cur.execute(DEF)
        after = cur.fetchone()
        print("definition md5:", after["md5"])
        for key in ("provolatile", "prosecdef", "proconfig", "acl"):
            same = before[key] == after[key]
            print("%-14s: %s -> %s %s" % (key, before[key], after[key], "OK" if same else "CHANGED"))
        new, new_ms = read_all(cur, slugs)

        diffs = [s for s in slugs if (json.loads(old[s]) if old[s] else None) != (json.loads(new[s]) if new[s] else None)]
        by_kind = {}
        for s in slugs:
            k = kinds[s]
            n, d = by_kind.get(k, (0, 0))
            by_kind[k] = (n + 1, d + (1 if s in diffs else 0))
        print()
        print("same payload before and after:")
        for k, (n, d) in sorted(by_kind.items()):
            print("    %-16s %3d records, %d different" % (k, n, d))
        print()
        print("median ms     : %.0f before -> %.0f after (round trip from this machine included)" % (statistics.median(old_ms), statistics.median(new_ms)))
        print()
        ok = not diffs and all(before[k] == after[k] for k in ("provolatile", "prosecdef", "proconfig", "acl"))
        print("RESULT        : " + ("clean — safe to apply" if ok else "NOT clean — do not apply: %s" % diffs[:5]))
finally:
    conn.rollback()
    conn.close()
    print("rolled back; nothing committed")
