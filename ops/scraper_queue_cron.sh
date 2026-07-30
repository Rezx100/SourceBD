#!/usr/bin/env bash
set -euo pipefail

# Run from the SourceBD VPS cron, for example:
# * * * * * /opt/sourcebd/ops/scraper_queue_cron.sh >> /opt/sourcebd/etl/logs/scraper_queue_cron.log 2>&1

APP_DIR="${SOURCEBD_APP_DIR:-/opt/sourcebd}"

cd "$APP_DIR"

# Drain the Firecrawl monitor inbox first. The API route only records deliveries
# (it has ten seconds before Firecrawl retries), so this is what turns "the page
# moved" into re-check work. Running it before the queue means a page that
# changed minutes ago is already at the front of the verify queue when the
# verifier next runs, rather than a cycle behind.
docker compose run --rm etl process-webhooks --limit 200

docker compose run --rm etl enqueue-due-schedules
docker compose run --rm etl run-queue --limit 1
