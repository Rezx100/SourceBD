#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${SOURCEBD_APP_DIR:-/opt/sourcebd}"
MIGRATION="${1:?usage: apply_one_migration.sh <filename>}"
cd "$APP_DIR"
docker compose run --rm \
  -v "$APP_DIR/supabase/migrations:/migrations:ro" \
  --entrypoint python etl - "$MIGRATION" <<'PY'
import os
import pathlib
import sys
import psycopg

filename = sys.argv[1]
path = pathlib.Path("/migrations") / filename
url = os.environ.get("SUPABASE_DB_URL", "")
if not url:
    raise SystemExit("SUPABASE_DB_URL not set")
if not path.is_file():
    raise SystemExit(f"migration not found: {path}")
sql = path.read_text(encoding="utf-8")
with psycopg.connect(url, prepare_threshold=None, autocommit=True) as conn:
    with conn.cursor() as cur:
        cur.execute("set statement_timeout = 0")
        cur.execute("set lock_timeout = '5min'")
        cur.execute(sql)
print(f"applied: {path.name}")
PY
