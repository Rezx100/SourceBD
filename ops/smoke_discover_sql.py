#!/usr/bin/env python3
import os
import time
import psycopg

url = os.environ["SUPABASE_DB_URL"]
queries = [
    ("browse", "select count(*) from public.discover_suppliers(p_limit := 5, p_offset := 0)"),
    ("denim", "select count(*) from public.discover_suppliers(p_q := 'denim', p_limit := 5, p_offset := 0)"),
    ("knitwear", "select count(*) from public.discover_suppliers(p_q := 'knitwear', p_limit := 5, p_offset := 0)"),
]
with psycopg.connect(url, prepare_threshold=None) as conn:
    with conn.cursor() as cur:
        for label, sql in queries:
            t0 = time.time()
            cur.execute("set statement_timeout = '30s'")
            try:
                cur.execute(sql)
                n = cur.fetchone()[0]
                print(f"{label}: OK {time.time() - t0:.2f}s rows={n}")
            except Exception as exc:
                print(f"{label}: FAIL {time.time() - t0:.2f}s {exc}")
