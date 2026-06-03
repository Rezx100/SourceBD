#!/usr/bin/env bash
# Spec P1 — SourceBD production VPS deploy script.
#
# Target: 109.104.153.228 (SourceBD VPS). Never run against 37.49.227.151
# (pixelsport-backend, off-limits per access boundaries).
#
# Idempotent — safe to re-run. Default does NOT touch Supabase migrations.
# Migrations 0001 → 0047 are already applied to the production project via
# the per-migration psycopg pattern (see progress-tracker.md). Only pass
# `--with-migrations` when shipping a NEW migration; you'll then need
# `psycopg` available in the etl container.
#
# Usage on the VPS:
#   cd /opt/sourcebd && bash ops/deploy_vps.sh
#   cd /opt/sourcebd && bash ops/deploy_vps.sh --with-migrations
#
# Pre-reqs on the VPS (one-time bootstrap, not handled by this script):
#   - docker + docker-compose
#   - caddy (apt-get install caddy)
#   - git clone https://github.com/<org>/sourcebd /opt/sourcebd
#   - /opt/sourcebd/.env populated (see ops/deploy/README.md)
#   - /etc/caddy/Caddyfile -> /opt/sourcebd/ops/Caddyfile (symlink)

set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-/opt/sourcebd}"
BRANCH="${BRANCH:-development}"
COMPOSE_FILE="docker-compose.yml"
WITH_MIGRATIONS=0

for arg in "$@"; do
	case "$arg" in
		--with-migrations) WITH_MIGRATIONS=1 ;;
		--branch=*) BRANCH="${arg#*=}" ;;
		--help|-h)
			grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -40
			exit 0
			;;
		*) echo "Unknown flag: $arg" >&2; exit 2 ;;
	esac
done

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

cd "$REPO_DIR" || die "REPO_DIR $REPO_DIR not found"

step "Pulling latest $BRANCH"
git fetch --quiet origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
COMMIT_SHA="$(git rev-parse --short HEAD)"
export COMMIT_SHA
echo "  head = $COMMIT_SHA"

step "Validating .env"
[ -f .env ] || die ".env missing — copy .env.example and populate (see ops/deploy/README.md)"
required=(SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY NEXT_PUBLIC_APP_URL)
missing=0
for key in "${required[@]}"; do
	if ! grep -qE "^${key}=.+" .env; then
		warn "Missing or empty: $key"
		missing=$((missing+1))
	fi
done
[ "$missing" -eq 0 ] || die "Fix .env and re-run."

if [ "$WITH_MIGRATIONS" -eq 1 ]; then
	step "Applying any new Supabase migrations"
	warn "Spec P1 default skips migrations — only --with-migrations should run this."
	warn "Migrations 0001 → 0047 are already applied to production. New SQL files"
	warn "should be applied one at a time via the etl container + psycopg pattern."
	echo "  (no-op in P1 — wire your migration command here for future specs)"
else
	step "Skipping migrations (default)"
	echo "  Use --with-migrations only when shipping a NEW supabase/migrations/*.sql"
fi

step "Building web image (Dockerfile.web)"
docker build -f Dockerfile.web -t sourcebd-web:latest .

step "Restarting web container"
# Pull etl image if upstream changed (separate compose target — ETL has its
# own Dockerfile).
docker compose -f "$COMPOSE_FILE" build web
docker compose -f "$COMPOSE_FILE" up -d web

step "Waiting for /api/health"
attempt=0
until curl --silent --fail --max-time 3 http://127.0.0.1:3000/api/health >/dev/null; do
	attempt=$((attempt+1))
	if [ "$attempt" -gt 20 ]; then
		docker compose -f "$COMPOSE_FILE" logs --tail=80 web >&2
		die "Web container did not become healthy in 60s"
	fi
	sleep 3
done
echo "  ✓ web container healthy"

step "Reloading Caddy"
if command -v caddy >/dev/null 2>&1; then
	caddy validate --config /etc/caddy/Caddyfile >/dev/null
	systemctl reload caddy || caddy reload --config /etc/caddy/Caddyfile
	echo "  ✓ caddy reloaded"
else
	warn "Caddy binary not found — install with: apt-get install -y caddy"
fi

step "Public health check"
if curl --silent --fail --max-time 5 http://109.104.153.228/api/health; then
	echo
	echo "  ✓ deploy OK — http://109.104.153.228 (commit $COMMIT_SHA)"
else
	warn "Public health check failed — verify Caddy is running + port 80 is open"
fi
