#!/usr/bin/env bash
# The activity record's two jobs (moderation and evidence plan, 1e), through the app's own doors with the
# shared secret JOB_SECRET from .env:
#   ledger_cron.sh seal    POST /api/v1/webhooks/ledger-seal   every hour: copy Auth's log, seal every finished hour
#   ledger_cron.sh stamp   POST /api/v1/webhooks/ledger-stamp  once a day: stamp the newest seal with the outside
#                                                              timestamp authority, verify the chain, email the
#                                                              seal and the token to LEDGER_STAMP_MAILBOX
# -e is deliberately absent: a failed run must reach the Slack notify, as in saved_search_alerts_cron.sh.
set -uo pipefail

# Run from the SourceBD VPS cron, for example:
# 7 * * * *  /opt/sourcebd/ops/ledger_cron.sh seal  >> /opt/sourcebd/etl/logs/ledger_seal.log 2>&1
# 20 1 * * * /opt/sourcebd/ops/ledger_cron.sh stamp >> /opt/sourcebd/etl/logs/ledger_stamp.log 2>&1
#
# Nothing is installed by this file: the founder adds the two cron lines and sets JOB_SECRET, LEDGER_TSA_URL
# (optional; the default is freetsa.org) and LEDGER_STAMP_MAILBOX in .env, the same values the app reads. The
# mailbox must be outside the company's control (a personal account, a lawyer's): that is what makes the
# daily copy worth anything.

MODE="${1:-seal}"
case "$MODE" in
  seal)  PATH_PART="ledger-seal" ;;
  stamp) PATH_PART="ledger-stamp" ;;
  *) echo "usage: ledger_cron.sh seal|stamp" >&2; exit 2 ;;
esac

APP_DIR="${SOURCEBD_APP_DIR:-/opt/sourcebd}"
URL="${SOURCEBD_JOB_URL:-http://127.0.0.1:3000/api/v1/webhooks/${PATH_PART}}"
cd "$APP_DIR" || exit 0

envval() {
  [ -f "$APP_DIR/.env" ] && grep -E "^$1=" "$APP_DIR/.env" | tail -n1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//; s/"$//'
}
notify() {
  bash "$APP_DIR/ops/slack_notify.sh" "$(envval SLACK_WEBHOOK_ETL)" "$1"
}

SECRET=$(envval JOB_SECRET)
if [ -z "$SECRET" ]; then
  echo "=== $(date -Is) ledger ${MODE}: JOB_SECRET is not set in .env, nothing to do ==="
  exit 0
fi

echo "=== $(date -Is) ledger ${MODE} ==="
# The secret goes in a header, never on the command line's URL, so it stays out of process lists and logs.
body=$(curl -sS --max-time 300 -X POST -H "x-sourcebd-job-secret: ${SECRET}" -w '\n%{http_code}' "$URL" 2>&1)
rc=$?
code=$(printf '%s' "$body" | tail -n1)
echo "$body" | sed '$d'
echo "http ${code} (curl exit ${rc})"

if [ "$rc" -ne 0 ] || [ "$code" != "200" ]; then
  if [ "$code" = "500" ]; then
    notify ":rotating_light: SourceBD: THE ACTIVITY RECORD'S SEAL CHAIN IS BROKEN (daily stamp run). Read the Data page's Verify and the stamp email today."
  else
    notify ":warning: SourceBD: the activity record ${MODE} run failed (curl ${rc}, http ${code}). Hours not sealed are sealed by the next run."
  fi
  exit 1
fi
exit 0
