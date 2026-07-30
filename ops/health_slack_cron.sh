#!/usr/bin/env bash
# SourceBD uptime doorbell — post to Slack only on state change (down/up).
# Cron example:
#   */5 * * * * /opt/sourcebd/ops/health_slack_cron.sh >> /opt/sourcebd/etl/logs/uptime_slack.log 2>&1

set -u

APP_DIR="${SOURCEBD_APP_DIR:-/opt/sourcebd}"
STATE_FILE="${APP_DIR}/.deploy/uptime_state"
HEALTH_URL="${SOURCEBD_HEALTH_URL:-http://127.0.0.1:3000/api/health}"
PUBLIC_URL="${SOURCEBD_PUBLIC_HEALTH_URL:-http://109.104.153.228/api/health}"

cd "$APP_DIR" || exit 0

# Load webhook from .env without sourcing the whole file into the shell as executable
WEBHOOK=""
if [ -f "$APP_DIR/.env" ]; then
  WEBHOOK=$(grep -E '^SLACK_WEBHOOK_UPTIME=' "$APP_DIR/.env" | tail -n1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//; s/"$//')
fi

mkdir -p "$(dirname "$STATE_FILE")"
PREV="unknown"
if [ -f "$STATE_FILE" ]; then
  PREV=$(tr -d '\r\n' < "$STATE_FILE")
fi

ok=0
if curl -sf --max-time 10 "$HEALTH_URL" >/dev/null 2>&1; then
  ok=1
elif curl -sf --max-time 10 "$PUBLIC_URL" >/dev/null 2>&1; then
  ok=1
fi

NOW="up"
MSG=""
if [ "$ok" -ne 1 ]; then
  NOW="down"
fi

if [ "$NOW" = "down" ] && [ "$PREV" != "down" ]; then
  MSG=":red_circle: SourceBD UPTIME DOWN — health check failed (${HEALTH_URL} / ${PUBLIC_URL})"
elif [ "$NOW" = "up" ] && [ "$PREV" = "down" ]; then
  MSG=":large_green_circle: SourceBD UPTIME RECOVERED — /api/health OK"
fi

printf '%s\n' "$NOW" > "$STATE_FILE"

if [ -n "$MSG" ]; then
  bash "$APP_DIR/ops/slack_notify.sh" "$WEBHOOK" "$MSG"
fi

exit 0
