"""Verify v_supplier_addresses for a given supplier name."""
import sys
from etl.core.db import db

name = sys.argv[1] if len(sys.argv) > 1 else "FUTURE CLOTHING"
with db.conn() as c, c.cursor() as cur:
    cur.execute(
        """
        select s.id, s.company_name, s.source_tags
        from public.suppliers s
        where s.company_name ilike %s
        order by s.company_name
        limit 5
        """,
        (f"%{name}%",),
    )
    sups = cur.fetchall()
    for r in sups:
        v = list(r.values()) if isinstance(r, dict) else list(r)
        sid, cname, tags = v
        print("=" * 80)
        print(f"{cname}  tags={tags}")
        cur.execute(
            """
            select source_code, source_tier::text, address_kind, source_ref,
                   address, phone, email
            from public.v_supplier_addresses
            where supplier_id = %s
            order by source_code, address_kind
            """,
            (sid,),
        )
        for ar in cur.fetchall():
            av = list(ar.values()) if isinstance(ar, dict) else list(ar)
            sc, st, kind, ref, addr, ph, em = av
            print(f"  [{sc} {kind} ref={ref}] tier={st}")
            print(f"     addr : {addr}")
            if ph:
                print(f"     phone: {ph}")
            if em:
                print(f"     email: {em}")
