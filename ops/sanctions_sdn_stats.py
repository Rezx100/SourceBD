"""Show OFAC SDN entity-type distribution + program distribution."""
from etl.core.db import db

with db.conn() as c, c.cursor() as cur:
    cur.execute(
        """select coalesce(raw->>'sdn_type','(null)') as t, count(*) as n
             from sanctions_list_entries
            where list = 'ofac_sdn'
            group by 1 order by 2 desc"""
    )
    print("By sdn_type:")
    for r in cur.fetchall():
        print(f"  {r['t']:<20} {r['n']:>6}")

    cur.execute(
        """select coalesce(raw->>'program','(null)') as p, count(*) as n
             from sanctions_list_entries
            where list = 'ofac_sdn'
              and lower(coalesce(raw->>'sdn_type','')) in ('entity','')
            group by 1 order by 2 desc limit 20"""
    )
    print()
    print("Top programs (entity-type only):")
    for r in cur.fetchall():
        print(f"  {r['p']:<40} {r['n']:>6}")
