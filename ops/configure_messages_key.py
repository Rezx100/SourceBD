"""Configure the Postgres `app.messages_key` GUC for encrypted messaging.

Usage examples:
  python ops/configure_messages_key.py
  python ops/configure_messages_key.py --key "<hex>" --rotate

The script reads `SUPABASE_DB_URL` from the environment, falling back to the
repo's `.env` via `etl.core.config.settings`, matching the other SourceBD ops
helpers. It never prints the configured key unless `--show-key` is passed.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import secrets
import sys

import psycopg
from psycopg import sql

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def resolve_db_url() -> str:
    """Resolve the production-safe DB URL from env or the repo `.env` file."""
    url = os.environ.get("SUPABASE_DB_URL", "")
    if url:
        return url

    from etl.core.config import settings

    return settings.supabase_db_url


def generate_key() -> str:
    """Return a 256-bit random hex key for pgcrypto message encryption."""
    return secrets.token_hex(32)


def read_messages_key(conn: psycopg.Connection[tuple[object, ...]]) -> str | None:
    """Read the configured app.messages_key if present in this session."""
    with conn.cursor() as cur:
        cur.execute("select current_setting('app.messages_key', true)")
        row = cur.fetchone()
    if row is None:
        return None
    value = row[0]
    return value if isinstance(value, str) and value else None


def apply_messages_key(
    conn: psycopg.Connection[tuple[object, ...]],
    key: str,
) -> None:
    """Persist the key at the database level for future sessions."""
    with conn.cursor() as cur:
        cur.execute("select current_database()")
        row = cur.fetchone()
        if row is None or not isinstance(row[0], str) or not row[0]:
            raise RuntimeError("could not resolve current database name")
        database_name = row[0]
        cur.execute(
            sql.SQL("alter database {} set app.messages_key = {}").format(
                sql.Identifier(database_name),
                sql.Literal(key),
            )
        )


def apply_messages_key_fallback(
    conn: psycopg.Connection[tuple[object, ...]],
    key: str,
) -> None:
    """Store the key in the private fallback table from migration 0078."""
    with conn.cursor() as cur:
        cur.execute(
            """
            insert into public.app_private_settings (key, value)
            values ('messages_key', %s)
            on conflict (key)
            do update
               set value = excluded.value,
                   updated_at = now()
            """,
            [key],
        )


def parse_args() -> argparse.Namespace:
    """Build the CLI for first-time setup and explicit rotations."""
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--key",
        help="Explicit key to set. Defaults to a new 256-bit random hex key.",
    )
    parser.add_argument(
        "--rotate",
        action="store_true",
        help="Overwrite an existing key. Use only when intentionally rotating.",
    )
    parser.add_argument(
        "--show-key",
        action="store_true",
        help="Print the configured key after success.",
    )
    return parser.parse_args()


def main() -> int:
    """Configure the messaging encryption key and verify it in a new session."""
    args = parse_args()
    url = resolve_db_url()
    if not url:
        print("SUPABASE_DB_URL not set", file=sys.stderr)
        return 2

    key = args.key or generate_key()
    if len(key) < 16:
        print("key must be at least 16 characters", file=sys.stderr)
        return 2

    with psycopg.connect(url, prepare_threshold=None, autocommit=True) as conn:
        current_key = read_messages_key(conn)
        if current_key and not args.rotate:
            print(
                "app.messages_key is already configured; rerun with --rotate to overwrite",
                file=sys.stderr,
            )
            return 1
        try:
            apply_messages_key(conn, key)
        except psycopg.errors.InsufficientPrivilege:
            try:
                apply_messages_key_fallback(conn, key)
            except psycopg.errors.UndefinedTable:
                print(
                    "ALTER DATABASE is not permitted and fallback table is missing; apply migration 0078_messages_key_fallback.sql first",
                    file=sys.stderr,
                )
                return 1

    with psycopg.connect(url, prepare_threshold=None, autocommit=True) as verify_conn:
        verified_key = read_messages_key(verify_conn)
        with verify_conn.cursor() as cur:
            cur.execute("select public._messages_key()")
            row = cur.fetchone()
            if row is None or row[0] != key:
                print("verification failed: public._messages_key() did not return the configured key", file=sys.stderr)
                return 1
        if verified_key not in (None, key):
            print(
                "verification failed: current_setting(app.messages_key) returned an unexpected value",
                file=sys.stderr,
            )
            return 1

    print("configured app.messages_key successfully")
    if args.show_key:
        print(key)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
