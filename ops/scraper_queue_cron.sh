#!/usr/bin/env bash
set -euo pipefail

# Run from the SourceBD VPS cron, for example:
# * * * * * /opt/sourcebd/ops/scraper_queue_cron.sh >> /opt/sourcebd/etl/logs/scraper_queue_cron.log 2>&1

APP_DIR="${SOURCEBD_APP_DIR:-/opt/sourcebd}"

cd "$APP_DIR"

docker compose run --rm etl enqueue-due-schedules
docker compose run --rm etl run-queue --limit 1
