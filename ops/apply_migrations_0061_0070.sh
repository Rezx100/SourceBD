#!/usr/bin/env bash
# Apply migrations 0061-0070 on production (skips already-applied 0063/0064).
set -euo pipefail

APP_DIR="${SOURCEBD_APP_DIR:-/opt/sourcebd}"
MIGRATIONS=(
  "supabase/migrations/0065_admin_beta_dashboard_repair.sql"
  "supabase/migrations/0066_smart_match_return_all_results.sql"
  "supabase/migrations/0067_discover_search_upgrade.sql"
  "supabase/migrations/0068_shared_supplier_search_brain.sql"
  "supabase/migrations/0069_supplier_search_candidate_perf_hotfix.sql"
  "supabase/migrations/0070_buyer_smart_match_discover_wrapper.sql"
)

cd "$APP_DIR"

apply_migration() {
  local migration="$1"
  echo "==> applying $migration"
  docker compose run --rm \
    -v "$APP_DIR/supabase/migrations:/migrations:ro" \
    --entrypoint python etl - "$migration" <<'PY'
import os
import pathlib
import sys

import psycopg

filename = pathlib.Path(sys.argv[1]).name
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
}

echo "==> pre-check RPCs"
docker compose run --rm --entrypoint python etl - <<'PY'
import os
import psycopg

checks = [
    ("0062", "admin_queue_list"),
    ("0062", "admin_queue_decide"),
    ("0063", "admin_etl_dashboard"),
    ("0065", "admin_beta_dashboard"),
    ("0066", "buyer_smart_match"),
    ("0067", "refresh_supplier_discover_search_tsv"),
    ("0068", "supplier_search_candidates"),
    ("0070", "buyer_smart_match"),
]
with psycopg.connect(os.environ["SUPABASE_DB_URL"], prepare_threshold=None) as conn:
    with conn.cursor() as cur:
        for mig, name in checks:
            cur.execute(
                """
                select exists(
                  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = %s
                )
                """,
                (name,),
            )
            print(f"{mig} {name}: {cur.fetchone()[0]}")
PY

for migration in "${MIGRATIONS[@]}"; do
  apply_migration "$migration"
done

echo "==> post-check RPCs"
docker compose run --rm --entrypoint python etl - <<'PY'
import os
import sys
import psycopg

checks = [
    ("0062", "admin_queue_list"),
    ("0062", "admin_queue_decide"),
    ("0063", "admin_etl_dashboard"),
    ("0065", "admin_beta_dashboard"),
    ("0066", "buyer_smart_match"),
    ("0067", "refresh_supplier_discover_search_tsv"),
    ("0068", "supplier_search_candidates"),
    ("0070", "buyer_smart_match"),
]
missing = []
with psycopg.connect(os.environ["SUPABASE_DB_URL"], prepare_threshold=None) as conn:
    with conn.cursor() as cur:
        for mig, name in checks:
            cur.execute(
                """
                select exists(
                  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = %s
                )
                """,
                (name,),
            )
            ok = cur.fetchone()[0]
            print(f"{mig} {name}: {'OK' if ok else 'MISSING'}")
            if not ok:
                missing.append(name)
if missing:
    raise SystemExit(f"missing RPCs: {', '.join(missing)}")
print("all migration RPCs present")
PY

echo "==> smoke: admin_queue_list (service role via direct SQL grant check skipped)"
echo "==> migrations complete"
