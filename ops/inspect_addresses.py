"""Inspect addresses stored across sources for a supplier."""
import sys
import json
from etl.core.db import db

name_like = sys.argv[1] if len(sys.argv) > 1 else "FUTURE CLOTHING"

with db.conn() as c, c.cursor() as cur:
    cur.execute(
        """
        select id, company_name, source_tags, address_raw, city, district
        from public.suppliers
        where company_name ilike %s
        order by company_name
        limit 10
        """,
        (f"%{name_like}%",),
    )
    rows = cur.fetchall()
    for r in rows:
        v = list(r.values()) if isinstance(r, dict) else list(r)
        sid, name, tags, addr, city, district = v
        print("=" * 80)
        print(f"id={sid}  name={name}")
        print(f"  tags={tags}  city={city}  district={district}")
        print(f"  address_raw={addr!r}")
        cur.execute(
            """
            select s.code as source_code, sr.source_ref, sr.fields
            from public.source_records sr
            join public.sources s on s.id = sr.source_id
            where sr.supplier_id = %s
            order by s.code
            """,
            (sid,),
        )
        for sr in cur.fetchall():
            sv = list(sr.values()) if isinstance(sr, dict) else list(sr)
            sc, ref, fields = sv
            print(f"  -- {sc} ref={ref}")
            keys = [
                "raw_address",
                "address",
                "mailing_address",
                "factory_address",
                "bkmea_factory_address",
                "bkmea_mailing_address",
                "raw_tel",
                "phone",
                "mailing_phone",
                "factory_phone",
                "bkmea_factory_phone",
                "bkmea_mailing_phone",
            ]
            if not isinstance(fields, dict):
                try:
                    fields = json.loads(fields) if fields else {}
                except Exception:
                    fields = {}
            for k in keys:
                v2 = fields.get(k)
                if v2:
                    print(f"      {k}: {v2}")
