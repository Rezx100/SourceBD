#!/usr/bin/env python3
"""Quick smoke: discover_suppliers + admin_beta_dashboard via direct SQL."""
import json
import os
import psycopg

with psycopg.connect(os.environ["SUPABASE_DB_URL"], prepare_threshold=None) as conn:
    with conn.cursor() as cur:
        cur.execute(
            """
            select count(*)
              from public.discover_suppliers(
                p_q := 'denim',
                p_limit := 5,
                p_offset := 0
              )
            """
        )
        print("discover_suppliers(denim) rows:", cur.fetchone()[0])

        cur.execute("select public.admin_beta_dashboard()")
        doc = cur.fetchone()[0]
        print("admin_beta_dashboard keys:", sorted(doc.keys())[:6], "...")
        print("funnel signups:", doc.get("funnel", {}).get("signups"))
