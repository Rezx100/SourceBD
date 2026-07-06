#!/usr/bin/env python3
"""Smoke-check key RPCs from migrations 0061-0070."""
from __future__ import annotations

import os
import sys

import psycopg

CHECKS = [
    ("0061", "discover_suppliers"),
    ("0062", "admin_queue_list"),
    ("0062", "admin_queue_decide"),
    ("0063", "admin_etl_dashboard"),
    ("0064", "admin_etl_job_status"),
    ("0065", "admin_beta_dashboard"),
    ("0066", "smart_match_suppliers"),
    ("0067", "discover_search_v2"),
    ("0068", "supplier_search_candidates"),
    ("0070", "buyer_smart_match"),
]


def main() -> None:
    url = os.environ.get("SUPABASE_DB_URL", "")
    if not url:
        raise SystemExit("SUPABASE_DB_URL not set")

    with psycopg.connect(url, prepare_threshold=None) as conn:
        with conn.cursor() as cur:
            for mig, name in CHECKS:
                cur.execute(
                    """
                    select exists(
                      select 1
                        from pg_proc p
                        join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public'
                         and p.proname = %s
                    )
                    """,
                    (name,),
                )
                ok = cur.fetchone()[0]
                status = "OK" if ok else "MISSING"
                print(f"{mig} {name}: {status}")
                if not ok:
                    sys.exit_code = 1


if __name__ == "__main__":
    main()
