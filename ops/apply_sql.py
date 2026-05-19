"""Apply a SQL migration file via psycopg (psql is not present in the etl image)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg

if len(sys.argv) != 2:
    print("usage: python -m ops.apply_sql <migration.sql>", file=sys.stderr)
    sys.exit(2)

path = Path(sys.argv[1])
sql = path.read_text(encoding="utf-8")

url = os.environ.get("SUPABASE_DB_URL", "")
if not url:
    from etl.core.config import settings
    url = settings.supabase_db_url
if not url:
    print("SUPABASE_DB_URL not set", file=sys.stderr)
    sys.exit(2)

# autocommit is required because ALTER TYPE ... ADD VALUE cannot run inside a
# transaction block on Postgres < 12; we are on PG 15 where it works, but the
# do-block in 0011 also commits enum changes cleanly only under autocommit.
with psycopg.connect(url, prepare_threshold=None, autocommit=True) as conn:
    with conn.cursor() as cur:
        cur.execute("set statement_timeout = 0")
        cur.execute("set lock_timeout = '5min'")
        cur.execute(sql)

print(f"applied: {path}")
