"""Debug why the merges didn't persist"""
from etl.core.db import db

PAIRS = [
    ('e421dee0-', 'bb4a4a6a-'),  # KNIT RADIX LTD (BKMEA, primary) vs Knit Radix Limited (RSC)
]

with db.conn() as c, c.cursor() as cur:
    cur.execute("""
        select s.id, s.company_name, s.source_tags, s.created_at,
               (select count(*) from public.source_records sr where sr.supplier_id = s.id) as nrecs,
               (select string_agg(src.code, ',') from public.source_records sr
                  join public.sources src on src.id = sr.source_id where sr.supplier_id = s.id) as srcs
          from public.suppliers s
         where s.company_name ilike 'knit radix%' or s.company_name ilike 'KNIT RADIX%'
         order by s.created_at
    """)
    for r in cur.fetchall():
        print(f"  {str(r['id'])[:8]} created={r['created_at']:%Y-%m-%d %H:%M} tags={r['source_tags']}  source_records={r['nrecs']} srcs={r['srcs']}  name={r['company_name']!r}")
    print()
    # Was either deleted in this run? Check pg_stat
    cur.execute("""
        select schemaname, relname, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup
          from pg_stat_user_tables
         where relname in ('suppliers','source_records','rsc_remediation')
         order by relname
    """)
    print("table             ins      upd      del      live")
    for r in cur.fetchall():
        print(f"  {r['relname']:18s} {r['n_tup_ins']:8d} {r['n_tup_upd']:8d} {r['n_tup_del']:8d} {r['n_live_tup']:8d}")
