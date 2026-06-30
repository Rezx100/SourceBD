#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${SOURCEBD_APP_DIR:-/opt/sourcebd}"
MIGRATIONS=(
  "supabase/migrations/0063_admin_etl_scraper_ops.sql"
  "supabase/migrations/0064_admin_etl_live_monitoring.sql"
)

cd "$APP_DIR"
mkdir -p etl/logs

echo "==> build etl image"
docker compose build etl

echo "==> apply scraper-ops migration"
for migration in "${MIGRATIONS[@]}"; do
docker compose run --rm --entrypoint python etl - "$migration" <<'PY'
import os
import pathlib
import sys

import psycopg

path = pathlib.Path(sys.argv[1])
url = os.environ.get("SUPABASE_DB_URL", "")
if not url:
    raise SystemExit("SUPABASE_DB_URL not set")
sql = path.read_text(encoding="utf-8")
with psycopg.connect(url, prepare_threshold=None, autocommit=True) as conn:
    with conn.cursor() as cur:
        cur.execute("set statement_timeout = 0")
        cur.execute("set lock_timeout = '5min'")
        cur.execute(sql)
print(f"applied: {path}")
PY
done

echo "==> verify scraper-ops database objects"
docker compose run --rm --entrypoint python etl - <<'PY'
import os

import psycopg

with psycopg.connect(os.environ["SUPABASE_DB_URL"], prepare_threshold=None) as conn:
    with conn.cursor() as cur:
        for name in ("etl_job_queue", "etl_schedules"):
            cur.execute("select to_regclass(%s)", (f"public.{name}",))
            print(name, cur.fetchone()[0])
        cur.execute("select to_regclass(%s)", ("public.etl_job_events",))
        print("etl_job_events", cur.fetchone()[0])
        for name in (
            "admin_etl_dashboard",
            "admin_etl_enqueue",
            "admin_etl_schedule_upsert",
            "admin_etl_job_decide",
        ):
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
            print(name, cur.fetchone()[0])
PY

echo "==> build web image"
docker compose build web

echo "==> restart web"
docker compose up -d --no-deps --force-recreate web

echo "==> install scraper queue cron"
chmod +x ops/scraper_queue_cron.sh
tmp="$(mktemp)"
new_tmp="$(mktemp)"
crontab -l > "$tmp" 2>/dev/null || true
grep -v "scraper_queue_cron.sh" "$tmp" > "$new_tmp" || true
echo "* * * * * /opt/sourcebd/ops/scraper_queue_cron.sh >> /opt/sourcebd/etl/logs/scraper_queue_cron.log 2>&1" >> "$new_tmp"
crontab "$new_tmp"
rm -f "$tmp" "$new_tmp"

echo "==> health probe"
sleep 8
curl -sf http://127.0.0.1:3000/api/health
echo

echo "==> compose status"
docker compose ps

echo "==> cron status"
crontab -l | grep scraper_queue_cron.sh

echo "==> deploy finish complete"
