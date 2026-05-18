"""Aggregate stats for v_supplier_addresses."""
from etl.core.db import db

with db.conn() as c, c.cursor() as cur:
    cur.execute("select count(*) from public.v_supplier_addresses")
    print("total address rows:", list(cur.fetchone().values())[0])

    cur.execute("select count(distinct supplier_id) from public.v_supplier_addresses")
    print("distinct suppliers with >=1 address:", list(cur.fetchone().values())[0])

    cur.execute("""
        select source_code, address_kind, count(*) as n
        from public.v_supplier_addresses
        group by 1,2 order by 1,2
    """)
    print("\nby source x kind:")
    for r in cur.fetchall():
        v = list(r.values())
        print(f"  {v[0]:8s} {v[1]:11s} {v[2]}")

    cur.execute("""
        select n_addrs, count(*) as suppliers
        from (
          select supplier_id, count(*) as n_addrs
          from public.v_supplier_addresses group by 1
        ) t
        group by 1 order by 1
    """)
    print("\nhistogram (addresses per supplier):")
    for r in cur.fetchall():
        v = list(r.values())
        print(f"  {v[0]} addresses : {v[1]} suppliers")

    cur.execute("""
        select count(*) from public.suppliers s
        where exists (select 1 from public.v_supplier_addresses v where v.supplier_id = s.id)
    """)
    with_addr = list(cur.fetchone().values())[0]
    cur.execute("select count(*) from public.suppliers")
    total = list(cur.fetchone().values())[0]
    print(f"\ncoverage: {with_addr}/{total} suppliers have >=1 verified address ({100*with_addr//total}%)")

    print("\nsample multi-source suppliers (>=2 sources reporting addresses):")
    cur.execute("""
        select s.company_name,
               array_agg(distinct v.source_code) as sources,
               count(*) as addr_rows
        from public.v_supplier_addresses v
        join public.suppliers s on s.id = v.supplier_id
        group by s.id, s.company_name
        having count(distinct v.source_code) >= 2
        order by count(*) desc
        limit 10
    """)
    for r in cur.fetchall():
        v = list(r.values())
        print(f"  {v[0][:55]:55s} sources={v[1]} rows={v[2]}")
