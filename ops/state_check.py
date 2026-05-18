"""Quick state check after fix_quality.py"""
from etl.core.db import db

with db.conn() as c, c.cursor() as cur:
    cur.execute("select count(*) as n from public.suppliers")
    print(f"suppliers total      : {cur.fetchone()['n']}")
    cur.execute("select count(*) as n from public.suppliers where 'RSC' = any(source_tags)")
    print(f"  with RSC tag        : {cur.fetchone()['n']}")
    cur.execute("select count(*) as n from public.suppliers where 'BKMEA' = any(source_tags)")
    print(f"  with BKMEA tag      : {cur.fetchone()['n']}")
    cur.execute("select count(*) as n from public.suppliers where array_length(source_tags,1) >= 2")
    print(f"  multi-source (>=2)  : {cur.fetchone()['n']}")
    cur.execute("select count(*) as n from public.source_records")
    print(f"source_records total : {cur.fetchone()['n']}")
    cur.execute("select count(*) as n from public.rsc_remediation")
    print(f"rsc_remediation rows : {cur.fetchone()['n']}")
    cur.execute("select count(*) as n from public.suppliers where city is not null")
    print(f"suppliers with city  : {cur.fetchone()['n']}")
    print()
    # Did the 40 merges actually happen? Look for the known pairs.
    pairs = [
        ('knit-radix', 'Knit Radix'),
        ('iris-fabrics', 'Iris Fabrics'),
        ('crystal-composite', 'Crystal Composite'),
        ('mohammad-ali-knitex', 'Mohammad Ali Knitex'),
        ('p-a-knit-composite', 'P.A. Knit Composite'),
    ]
    for slug, label in pairs:
        cur.execute("select id, company_name, slug, source_tags, created_at from public.suppliers where slug = %s or slug like %s order by created_at",
                    (slug, slug + '%'))
        rows = cur.fetchall()
        print(f"-- {label}: {len(rows)} row(s) --")
        for r in rows:
            print(f"   {str(r['id'])[:8]} slug={r['slug']!r:32s} tags={r['source_tags']} name={r['company_name']!r}")
