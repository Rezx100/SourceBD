"""Post-RSC-run verification: counts + multi-source coverage."""
from etl.core.db import db

QUERIES = [
    ("Total suppliers", "select count(*) as n from public.suppliers"),
    ("Published suppliers", "select count(*) as n from public.suppliers where is_published"),
    ("Suppliers with RSC tag", "select count(*) as n from public.suppliers where 'RSC' = any(source_tags)"),
    ("Suppliers with BKMEA tag", "select count(*) as n from public.suppliers where 'BKMEA' = any(source_tags)"),
    ("Suppliers with BGMEA tag", "select count(*) as n from public.suppliers where 'BGMEA' = any(source_tags)"),
    ("Multi-source (2+) suppliers", "select count(*) as n from public.suppliers where coalesce(array_length(source_tags,1),0) >= 2"),
    ("rsc_remediation rows", "select count(*) as n from public.rsc_remediation"),
    ("RSC progress 100%", "select count(*) as n from public.rsc_remediation where progress_pct = 100"),
    ("RSC training completed", "select count(*) as n from public.rsc_remediation where training_status = 'completed'"),
    ("RSC ineligible factories", "select count(*) as n from public.rsc_remediation where remediation_status = 'ineligible'"),
    ("Distinct parent groups (RSC)", "select count(distinct parent_group_name) as n from public.rsc_remediation where parent_group_name is not null"),
    ("source_records total", "select count(*) as n from public.source_records"),
]

with db.conn() as c, c.cursor() as cur:
    print(f"{'Metric':<40}  Count")
    print("-" * 55)
    for label, q in QUERIES:
        cur.execute(q)
        n = cur.fetchone()["n"]
        print(f"{label:<40}  {n:>10}")

    print()
    print("Top 10 parent groups by factory count (RSC view):")
    cur.execute(
        """select parent_group_name, count(*) as factories,
                  sum(workers_count) as workers,
                  round(avg(progress_pct)::numeric, 1) as avg_progress
             from public.rsc_remediation
             where parent_group_name is not null
             group by 1 order by factories desc, workers desc nulls last
             limit 10"""
    )
    for r in cur.fetchall():
        print(f"  {r['parent_group_name'][:40]:<40}  {r['factories']:>3} factories  {r['workers'] or 0:>7} workers  avg {r['avg_progress']}%")

    print()
    print("Top 10 multi-source suppliers (sample):")
    cur.execute(
        """select company_name, source_tags
             from public.suppliers
             where coalesce(array_length(source_tags,1),0) >= 2
             order by company_name limit 10"""
    )
    for r in cur.fetchall():
        print(f"  {r['company_name'][:50]:<50}  {r['source_tags']}")

    print()
    print("Latest etl_runs (last 5):")
    cur.execute(
        """select source, status, seen, upserted, skipped,
                  to_char(started_at, 'YYYY-MM-DD HH24:MI') as started,
                  extract(epoch from (finished_at - started_at))::int as secs
             from public.etl_runs order by started_at desc limit 5"""
    )
    for r in cur.fetchall():
        print(f"  {r['started']} {r['source']:<10} {r['status']:<8}  seen={r['seen']:<5} upsert={r['upserted']:<5} skip={r['skipped']:<3} {r['secs']}s")
