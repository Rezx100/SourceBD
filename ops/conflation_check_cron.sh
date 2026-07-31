#!/usr/bin/env bash
# -e is deliberately absent: a failing check must reach the Slack notify, not
# abort the script silently. Same reasoning as scraper_queue_cron.sh.
set -uo pipefail

# Run from the SourceBD VPS cron, for example:
# 17 3 * * * /opt/sourcebd/ops/conflation_check_cron.sh >> /opt/sourcebd/etl/logs/conflation_check.log 2>&1
#
# Daily is the right cadence: a conflation is created by a scraper run and stays
# put until somebody splits it, so catching it within a day is enough, and a
# quieter check is a check that still gets read.

APP_DIR="${SOURCEBD_APP_DIR:-/opt/sourcebd}"
cd "$APP_DIR"

notify() {
  local text="$1"
  local webhook=""
  if [ -f "$APP_DIR/.env" ]; then
    webhook=$(grep -E '^SLACK_WEBHOOK_ETL=' "$APP_DIR/.env" | tail -n1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//; s/"$//')
  fi
  bash "$APP_DIR/ops/slack_notify.sh" "$webhook" "$text"
}

echo "=== $(date -Is) supplier conflation check ==="

# The etl image copies in only `etl/` and `supabase/` (see Dockerfile), so
# `ops/` is mounted from the deployed tree rather than baked. That also means
# the check always runs whatever ops/ code is actually deployed, with no image
# rebuild needed to fix or tune it.
output=$(docker compose run --rm --entrypoint python \
  -e PYTHONPATH=/app -v "$APP_DIR/ops:/app/ops:ro" etl \
  ops/check_supplier_conflations.py --quiet 2>&1)
rc=$?
[ -n "$output" ] && echo "$output"

case "$rc" in
  0) ;;
  1) notify ":rotating_light: SourceBD: a supplier is publishing more than one company's BKMEA data. Repair with ops/unmerge_bkmea_suppliers.py (dry run first)." ;;
  # A check that cannot run is not a passing check, so it is reported too —
  # otherwise a broken DSN turns the alarm off without anyone noticing.
  *) notify ":warning: SourceBD: supplier conflation check could not run (exit ${rc})." ;;
esac

exit "$rc"
