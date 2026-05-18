"""List every source identifier currently in the DB so logos.lock.md can
mirror reality, not guesswork. Looks at:
  - sources table (canonical source registry)
  - sanctions_list_entries.list (sanctions list codes)
  - source_records.source_code (any other ingest source)
  - brand_disclosures.brand (if table exists)
"""
from etl.core.db import db


def _safe(cur, sql, args=()):
    try:
        cur.execute(sql, args)
        return cur.fetchall()
    except Exception as e:  # noqa: BLE001
        return [{"error": str(e).split("\n")[0]}]


with db.conn() as c, c.cursor() as cur:
    print("=" * 70)
    print("sources table:")
    rows = _safe(cur, "select * from sources order by tier, code")
    for r in rows:
        print(f"  {r}")

    print()
    print("=" * 70)
    print("Distinct sanctions_list_entries.list:")
    rows = _safe(cur, """select list, count(*) as n
                           from sanctions_list_entries
                          group by list order by 1""")
    for r in rows:
        print(f"  {r}")

    print()
    print("=" * 70)
    print("Distinct source_records.source_code (top 50):")
    rows = _safe(cur, """select source_code, count(*) as n
                           from source_records
                          group by source_code
                          order by 2 desc limit 50""")
    for r in rows:
        print(f"  {r}")

    print()
    print("=" * 70)
    print("Distinct suppliers.member_of (associations on canonical rows):")
    rows = _safe(cur, """select unnest(member_of) as m, count(*) as n
                           from suppliers
                          where member_of is not null
                          group by 1 order by 2 desc""")
    for r in rows:
        print(f"  {r}")

    print()
    print("=" * 70)
    print("Distinct brand_disclosures.brand (if table exists):")
    rows = _safe(cur, """select brand, count(*) as n
                           from brand_disclosures
                          group by brand order by 2 desc""")
    for r in rows:
        print(f"  {r}")

    print()
    print("=" * 70)
    print("Distinct certifications.body (if table exists):")
    rows = _safe(cur, """select body, count(*) as n
                           from certifications
                          group by body order by 2 desc""")
    for r in rows:
        print(f"  {r}")
