"""Tag and entity_type distribution after BGMEA ingest."""
from etl.core.db import db

def vals(row):
    return list(row.values()) if isinstance(row, dict) else list(row)

with db.conn() as c, c.cursor() as cur:
    cur.execute("select unnest(source_tags) as tag, count(*) as n from public.suppliers group by 1 order by 2 desc")
    print("== source_tags ==")
    for r in cur.fetchall():
        v = vals(r)
        print(f"  {str(v[0]):10s} {v[1]}")
    print("== entity_type ==")
    cur.execute("select entity_type, count(*) as n from public.suppliers group by 1 order by 2 desc")
    for r in cur.fetchall():
        v = vals(r)
        print(f"  {str(v[0]):15s} {v[1]}")
    print("== BGMEA quality ==")
    cur.execute("""
        select
          count(*) as total,
          count(*) filter (where city is not null) as with_city,

          count(*) filter (where email is not null) as with_email,
          count(*) filter (where phone is not null) as with_phone,
          count(*) filter (where bgmea_reg_numbers <> '{}') as with_reg
        from public.suppliers where 'BGMEA' = any(source_tags)
    """)
    v = vals(cur.fetchone())
    print(f"  total={v[0]} city={v[1]} email={v[2]} phone={v[3]} reg={v[4]}")
