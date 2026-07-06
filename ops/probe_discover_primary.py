#!/usr/bin/env python3
import os
import psycopg

slug = "ted-bernhardtz-textile-industries"
with psycopg.connect(os.environ["SUPABASE_DB_URL"], prepare_threshold=None) as conn:
    with conn.cursor() as cur:
        cur.execute(
            """
            select slug, city, district, public.supplier_primary_address(id)
              from suppliers
             where slug = %s
            """,
            (slug,),
        )
        print("supplier:", cur.fetchone())
        cur.execute(
            """
            select company_name, city, district, primary_address
              from public.discover_suppliers(p_q := null, p_limit := 10000, p_offset := 0)
             where slug = %s
            """,
            (slug,),
        )
        print("discover:", cur.fetchone())
