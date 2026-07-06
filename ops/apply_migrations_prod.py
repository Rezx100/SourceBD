#!/usr/bin/env python3
"""Apply numbered Supabase migrations one at a time (production-safe)."""
from __future__ import annotations

import argparse
import os
import pathlib
import sys

import psycopg

REPO = pathlib.Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = REPO / "supabase" / "migrations"


def migration_files(numbers: list[str]) -> list[pathlib.Path]:
    out: list[pathlib.Path] = []
    for num in numbers:
        matches = sorted(MIGRATIONS_DIR.glob(f"{num}_*.sql"))
        if not matches:
            raise SystemExit(f"no migration file for {num}")
        if len(matches) > 1:
            raise SystemExit(f"ambiguous migration prefix {num}: {matches}")
        out.append(matches[0])
    return out


def apply_one(conn: psycopg.Connection, path: pathlib.Path) -> None:
    sql = path.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute("set statement_timeout = 0")
        cur.execute("set lock_timeout = '5min'")
        cur.execute(sql)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "numbers",
        nargs="+",
        help="Migration prefixes, e.g. 0061 0062",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List files only; do not execute SQL",
    )
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_DB_URL", "")
    if not url and not args.dry_run:
        raise SystemExit("SUPABASE_DB_URL not set")

    paths = migration_files(args.numbers)
    for path in paths:
        if args.dry_run:
            print(f"would apply: {path.name}")
            continue
        print(f"applying: {path.name} ...", flush=True)
        with psycopg.connect(url, prepare_threshold=None, autocommit=True) as conn:
            apply_one(conn, path)
        print(f"applied: {path.name}", flush=True)


if __name__ == "__main__":
    main()
