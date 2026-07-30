#!/usr/bin/env bash
# Soft-fail Slack Incoming Webhook notify for SourceBD doorbells.
# Usage: slack_notify.sh <webhook_url> <message>
# If webhook is empty/unset, exits 0 (no-op). Network failures do not abort callers.

set -u

WEBHOOK="${1:-}"
MESSAGE="${2:-}"

if [ -z "$WEBHOOK" ]; then
  exit 0
fi

if [ -z "$MESSAGE" ]; then
  echo "slack_notify.sh: empty message" >&2
  exit 0
fi

# Escape JSON string (minimal)
json_escape() {
  printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null \
    || printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\r//g; s/\t/\\t/g' | awk '{printf "\"%s\"", $0}'
}

PAYLOAD=$(printf '{"text":%s}' "$(json_escape "$MESSAGE")")

curl -sS -X POST \
  -H 'Content-type: application/json' \
  --data "$PAYLOAD" \
  --max-time 15 \
  "$WEBHOOK" >/dev/null 2>&1 || true

exit 0
