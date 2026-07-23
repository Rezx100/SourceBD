#!/usr/bin/env python3
import os
import time
import psycopg

url = os.environ["SUPABASE_DB_URL"]
queries = [
    ("browse24", "select count(*) from public.discover_suppliers(p_limit := 24, p_offset := 0)"),
    ("denim24", "select count(*) from public.discover_suppliers(p_q := 'denim', p_limit := 24, p_offset := 0)"),
]
with psycopg.connect(url, prepare_threshold=None) as conn:
    with conn.cursor() as cur:
        for label, sql in queries:
            t0 = time.time()
            cur.execute("set statement_timeout = '4s'")
            try:
                cur.execute(sql)
                n = cur.fetchone()[0]
                print(f"{label}@4s: OK {time.time() - t0:.2f}s rows={n}")
            except Exception as exc:
                print(f"{label}@4s: FAIL {time.time() - t0:.2f}s {exc}")
