#!/usr/bin/env python3
"""Inspect Robintex profile payload."""
from __future__ import annotations

import json
import os

import psycopg


def main() -> None:
    url = os.environ.get("SUPABASE_DB_URL", "")
    if not url:
        raise SystemExit("SUPABASE_DB_URL not set")

    with psycopg.connect(url, prepare_threshold=None) as conn:
        with conn.cursor() as cur:
            for slug in (
                "robintex-bangladesh",
                "robintex-bangladesh-ltd",
                "robintex-bangladesh-limited",
            ):
                cur.execute(
                    "select public.buyer_supplier_profile(%s)",
                    (slug,),
                )
                row = cur.fetchone()
                if not row or row[0] is None:
                    print(f"{slug}: not found")
                    continue
                payload = row[0]
                s = payload["supplier"]
                print(f"\n=== {slug} ===")
                print("name:", s.get("company_name"))
                print("address_raw:", s.get("address_raw"))
                print("city/district:", s.get("city"), s.get("district"))
                for a in payload.get("addresses", [])[:8]:
                    print(
                        " addr:",
                        (a.get("address") or "")[:100],
                        "|",
                        a.get("source_code"),
                        a.get("kind"),
                    )


if __name__ == "__main__":
    main()
