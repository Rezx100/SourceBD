from etl.core.db import db
with db.conn() as c, c.cursor() as cur:
    cur.execute("select count(*) from public.suppliers")
    print("total_suppliers", list(cur.fetchone().values())[0])
    cur.execute("select unnest(source_tags) as tag, count(*) as n from public.suppliers group by 1 order by 2 desc")
    print("== source_tags ==")
    for r in cur.fetchall():
        v = list(r.values())
        print(f"  {v[0]:10s} {v[1]}")
    cur.execute("select entity_type, count(*) as n from public.suppliers group by 1 order by 2 desc")
    print("== entity_type ==")
    for r in cur.fetchall():
        v = list(r.values())
        print(f"  {str(v[0]):15s} {v[1]}")
    cur.execute("select count(*) from public.source_records")
    print("source_records", list(cur.fetchone().values())[0])
    cur.execute("""
        select count(*) filter (where bgmea_member_type='general_manufacturer') as gen,
               count(*) filter (where bgmea_member_type='associate_buying_house') as assoc
        from public.suppliers
        where exists (select 1 from public.source_records sr where sr.supplier_id=suppliers.id and sr.source_code='BGMEA')
    """)
    # alternative simpler check
    cur.execute("""
        select count(distinct s.id)
        from public.suppliers s
        join public.source_records sr on sr.supplier_id = s.id
        where sr.source_code='BGMEA' and (sr.payload->>'bgmea_member_type')='general_manufacturer'
    """)
    print("BGMEA general manufacturer source_records:", list(cur.fetchone().values())[0])
    cur.execute("""
        select count(distinct s.id)
        from public.suppliers s
        join public.source_records sr on sr.supplier_id = s.id
        where sr.source_code='BGMEA' and (sr.payload->>'bgmea_member_type')='associate_buying_house'
    """)
    print("BGMEA associate buying house source_records:", list(cur.fetchone().values())[0])
