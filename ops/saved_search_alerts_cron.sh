#!/usr/bin/env bash
# The Monday "new matches" email for saved searches (gap 14). Calls the app's own door,
# POST /api/v1/webhooks/saved-search-alerts, with the shared secret JOB_SECRET from .env.
# -e is deliberately absent: a failed run must reach the Slack notify, as in conflation_check_cron.sh.
set -uo pipefail

# Run from the SourceBD VPS cron, for example (07:00 UTC on Mondays, a UK morning):
# 0 7 * * 1 /opt/sourcebd/ops/saved_search_alerts_cron.sh >> /opt/sourcebd/etl/logs/saved_search_alerts.log 2>&1
#
# Weekly is the whole product: "One email on Monday, only when something new matches". A search is due once it
# has not been checked for six days, so a second run the same day does nothing, and one that failed (or was
# not reached, the job takes up to 200 searches a run) is picked up by the next run. Nothing is installed by
# this file: the founder adds the cron line and sets JOB_SECRET in .env, the same value the app reads.

APP_DIR="${SOURCEBD_APP_DIR:-/opt/sourcebd}"
URL="${SOURCEBD_JOB_URL:-http://127.0.0.1:3000/api/v1/webhooks/saved-search-alerts}"
cd "$APP_DIR" || exit 0

envval() {
  [ -f "$APP_DIR/.env" ] && grep -E "^$1=" "$APP_DIR/.env" | tail -n1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//; s/"$//'
}
notify() {
  bash "$APP_DIR/ops/slack_notify.sh" "$(envval SLACK_WEBHOOK_ETL)" "$1"
}

SECRET=$(envval JOB_SECRET)
if [ -z "$SECRET" ]; then
  echo "=== $(date -Is) saved search alerts: JOB_SECRET is not set in .env, nothing to do ==="
  exit 0
fi

echo "=== $(date -Is) saved search alerts ==="
# The secret goes in a header, never on the command line's URL, so it stays out of process lists and logs.
body=$(curl -sS --max-time 900 -X POST -H "x-sourcebd-job-secret: ${SECRET}" -w '\n%{http_code}' "$URL" 2>&1)
rc=$?
code=$(printf '%s' "$body" | tail -n1)
echo "$body" | sed '$d'
echo "http ${code} (curl exit ${rc})"

if [ "$rc" -ne 0 ] || [ "$code" != "200" ]; then
  notify ":warning: SourceBD: the saved-search email run failed (curl ${rc}, http ${code}). Searches not reached stay due and are tried at the next run."
  exit 1
fi
exit 0
