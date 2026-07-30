#!/usr/bin/env bash
# -e is deliberately absent: a failing step must reach notify_etl_fail, not
# abort the script silently.
set -uo pipefail

# Run from the SourceBD VPS cron, for example:
# * * * * * /opt/sourcebd/ops/scraper_queue_cron.sh >> /opt/sourcebd/etl/logs/scraper_queue_cron.log 2>&1

APP_DIR="${SOURCEBD_APP_DIR:-/opt/sourcebd}"

cd "$APP_DIR"

notify_etl_fail() {
  local reason="$1"
  local webhook=""
  if [ -f "$APP_DIR/.env" ]; then
    webhook=$(grep -E '^SLACK_WEBHOOK_ETL=' "$APP_DIR/.env" | tail -n1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//; s/"$//')
  fi
  bash "$APP_DIR/ops/slack_notify.sh" "$webhook" ":warning: SourceBD ETL cron failed — ${reason}"
}

# Drain the Firecrawl monitor inbox first. The API route only records deliveries
# (it has ten seconds before Firecrawl retries), so this is what turns "the page
# moved" into re-check work. Running it before the queue means a page that
# changed minutes ago is already at the front of the verify queue when the
# verifier next runs, rather than a cycle behind.
if ! docker compose run --rm etl process-webhooks --limit 200; then
  notify_etl_fail "process-webhooks"
  exit 1
fi

if ! docker compose run --rm etl enqueue-due-schedules; then
  notify_etl_fail "enqueue-due-schedules"
  exit 1
fi

if ! docker compose run --rm etl run-queue --limit 1; then
  notify_etl_fail "run-queue --limit 1"
  exit 1
fi

exit 0
