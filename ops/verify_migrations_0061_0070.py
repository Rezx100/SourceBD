#!/usr/bin/env python3
import os
import psycopg

with psycopg.connect(os.environ["SUPABASE_DB_URL"], prepare_threshold=None) as conn:
    with conn.cursor() as cur:
        for table in (
            "search_concept_groups",
            "search_terms",
            "etl_job_events",
            "etl_job_queue",
        ):
            cur.execute("select to_regclass(%s)", (f"public.{table}",))
            print(f"{table}:", cur.fetchone()[0])
        cur.execute("select count(*) from public.search_terms")
        print("search_terms count:", cur.fetchone()[0])
        cur.execute(
            "select count(*) from public.suppliers where discover_search_tsv is not null"
        )
        print("suppliers with discover_search_tsv:", cur.fetchone()[0])
