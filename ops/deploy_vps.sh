#!/usr/bin/env bash
# SourceBD production VPS deploy script (git-backed).
#
# Target: 109.104.153.228 (SourceBD VPS). Never run against 37.49.227.151
# (pixelsport-backend, off-limits per access boundaries).
#
# Canonical reference: docs/ENTERPRISE_DEPLOYMENT.md
#
# Usage on the VPS:
#   cd /opt/sourcebd && bash ops/deploy_vps.sh --ref=main --require-git
#   cd /opt/sourcebd && bash ops/deploy_vps.sh --ref=v2026.06.30-1 --require-git
#   cd /opt/sourcebd && bash ops/deploy_vps.sh --ref=abc1234 --require-git
#   cd /opt/sourcebd && bash ops/deploy_vps.sh --with-migrations --ref=main
#
# Legacy (no .git on VPS — tarball/rsync bootstrap only):
#   bash ops/deploy_vps.sh
#
# Pre-reqs on the VPS (one-time bootstrap, not handled by this script):
#   - docker + docker-compose
#   - caddy (apt-get install caddy)
#   - git clone https://github.com/Rezx100/SourceBD.git /opt/sourcebd
#   - /opt/sourcebd/.env populated (see ops/deploy/README.md)
#   - /etc/caddy/Caddyfile -> /opt/sourcebd/ops/Caddyfile (symlink)
#
# IMPORTANT — this script is self-modifying: `main()` performs a `git
# checkout` on this very repo, which can overwrite ops/deploy_vps.sh on disk
# mid-run. Bash reads script files incrementally as it executes them, so a
# self-modifying script can desync bash's read offset and silently execute
# stale bytes from the OLD file version after the checkout point (observed
# 2 Jul 2026: `systemctl restart caddy` silently executed as a stale
# `systemctl reload caddy` from the previous file version, failing because
# `admin off` disables the endpoint reload needs). Fix: every line that
# matters is inside `main()`, and bash fully parses a function body into
# memory before it starts calling it — only the final `main "$@"` line at
# EOF, invoked after the whole file (including the function) has already
# been read, is safe to keep outside the function. Never add top-level
# logic after this point again.

set -Eeuo pipefail

main() {
	DEPLOY_START_S="$(date +%s)"

	REPO_DIR="${REPO_DIR:-/opt/sourcebd}"
	BRANCH="${BRANCH:-development}"
	REF=""
	COMPOSE_FILE="docker-compose.yml"
	WITH_MIGRATIONS=0
	REQUIRE_GIT=0
	SKIP_BACKUP=0
	DEPLOY_META_DIR=".deploy"

	for arg in "$@"; do
		case "$arg" in
			--with-migrations) WITH_MIGRATIONS=1 ;;
			--branch=*) BRANCH="${arg#*=}" ;;
			--ref=*) REF="${arg#*=}" ;;
			--require-git) REQUIRE_GIT=1 ;;
			--skip-backup) SKIP_BACKUP=1 ;;
			--help|-h)
				grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -50
				exit 0
				;;
			*) echo "Unknown flag: $arg" >&2; exit 2 ;;
		esac
	done

	CHECKOUT_TARGET="${REF:-$BRANCH}"

	cd "$REPO_DIR" || die "REPO_DIR $REPO_DIR not found"

	if [ "$REQUIRE_GIT" -eq 1 ] && [ ! -d .git ]; then
		die "Git checkout required (--require-git) but $REPO_DIR has no .git — migrate VPS first (docs/ENTERPRISE_DEPLOYMENT.md)"
	fi

	PREVIOUS_SHA=""
	COMMIT_SHA=""
	CADDYFILE_CHANGED=1

	if [ -d .git ]; then
		PREVIOUS_SHA="$(git rev-parse HEAD 2>/dev/null || true)"

		step "Fetching origin and checking out $CHECKOUT_TARGET"
		git fetch --quiet origin --tags
		git checkout "$CHECKOUT_TARGET" || die "Could not checkout $CHECKOUT_TARGET"

		# Fast-forward only when target resolves to a remote branch
		if git show-ref --verify --quiet "refs/remotes/origin/${CHECKOUT_TARGET}"; then
			git pull --ff-only origin "$CHECKOUT_TARGET" || die "Non-fast-forward pull for $CHECKOUT_TARGET — resolve manually"
		fi

		COMMIT_SHA="$(git rev-parse HEAD)"

		if [ -n "$PREVIOUS_SHA" ] && [ "$PREVIOUS_SHA" != "$COMMIT_SHA" ]; then
			if git diff --quiet "$PREVIOUS_SHA" "$COMMIT_SHA" -- ops/Caddyfile 2>/dev/null; then
				CADDYFILE_CHANGED=0
			fi
		elif [ -n "$PREVIOUS_SHA" ]; then
			CADDYFILE_CHANGED=0
		fi
	else
		if [ "$REQUIRE_GIT" -eq 1 ]; then
			die "Git required but .git missing"
		fi
		step "No .git found — legacy tarball/rsync mode (deprecated for production)"
		warn "Migrate to git-backed deploy: docs/ENTERPRISE_DEPLOYMENT.md"
		COMMIT_SHA="${COMMIT_SHA:-rsync}"
	fi

	mkdir -p "$DEPLOY_META_DIR"
	if [ -n "$PREVIOUS_SHA" ] && [ "$PREVIOUS_SHA" != "$COMMIT_SHA" ]; then
		echo "$PREVIOUS_SHA" > "$DEPLOY_META_DIR/previous-sha"
	fi
	echo "$COMMIT_SHA" > "$DEPLOY_META_DIR/current-sha"
	date -u +%Y-%m-%dT%H:%M:%SZ > "$DEPLOY_META_DIR/deployed-at"
	export COMMIT_SHA
	echo "  previous = ${PREVIOUS_SHA:-none}"
	echo "  head     = $COMMIT_SHA"

	step "Validating .env (never overwritten by this script)"
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

	if [ "$SKIP_BACKUP" -eq 0 ] && docker image inspect sourcebd-web:latest >/dev/null 2>&1; then
		step "Tagging current Docker image for rollback"
		rollback_tag="sourcebd-web:rollback-${PREVIOUS_SHA:-unknown}"
		docker tag sourcebd-web:latest "$rollback_tag" 2>/dev/null || warn "Could not tag rollback image"
		echo "$rollback_tag" > "$DEPLOY_META_DIR/previous-docker-tag"
	fi

	if [ "$WITH_MIGRATIONS" -eq 1 ]; then
		step "Applying any new Supabase migrations"
		warn "Default deploy skips migrations — only --with-migrations should run this."
		warn "Apply new supabase/migrations/*.sql via etl container + psycopg pattern."
		echo "  (no-op — wire migration command here for future specs)"
	else
		step "Skipping migrations (default)"
	fi

	step "Building web image (Dockerfile.web)"
	# Single build via `docker compose build` — a prior version of this script
	# also ran a standalone `docker build` first, building the same image twice
	# and roughly doubling deploy time for no benefit (both commands produced
	# the identical `sourcebd-web:latest` tag). BuildKit cache mounts in
	# Dockerfile.web (pnpm store + .next/cache) make this one build fast for
	# code-only changes.
	export DOCKER_BUILDKIT=1
	export COMPOSE_DOCKER_CLI_BUILD=1
	docker compose -f "$COMPOSE_FILE" build web

	step "Restarting web container only (etl volumes untouched)"
	# `--no-build`: the image was just built explicitly above. Without this
	# flag, `up` re-evaluates the service's `build:` block and reruns the
	# ENTIRE Dockerfile a second time (observed 2 Jul 2026: doubled a ~3 min
	# deploy to ~8 min for zero benefit — both builds produce the same tag).
	docker compose -f "$COMPOSE_FILE" up -d --no-deps --no-build web

	step "Waiting for /api/health"
	attempt=0
	until curl --silent --fail --max-time 3 http://127.0.0.1:3000/api/health >/dev/null; do
		attempt=$((attempt+1))
		if [ "$attempt" -gt 20 ]; then
			docker compose -f "$COMPOSE_FILE" logs --tail=80 web >&2
			die "Web container did not become healthy in 60s — rollback: bash ops/deploy_vps.sh --ref=$(cat "$DEPLOY_META_DIR/previous-sha" 2>/dev/null || echo UNKNOWN) --require-git"
		fi
		sleep 3
	done
	echo "  ✓ web container healthy"

	if [ "$CADDYFILE_CHANGED" -eq 1 ] && command -v caddy >/dev/null 2>&1; then
		step "Restarting Caddy (ops/Caddyfile changed)"
		caddy validate --config /etc/caddy/Caddyfile >/dev/null
		# This Caddyfile ships with `admin off` (hardening — no local admin
		# API), so `caddy reload` / `systemctl reload caddy` can never work:
		# both talk to the admin API over localhost:2019, which doesn't
		# exist. `restart` re-execs Caddy fresh from the config on disk
		# instead — the correct (and only reliable) way to apply Caddyfile
		# changes with admin off. Only runs when the Caddyfile actually
		# changed: the running Caddy process already proxies to the same
		# upstream port regardless of which app version is behind it, so
		# app-only deploys (the common case) skip this step entirely for a
		# faster, zero-risk deploy.
		systemctl restart caddy
		echo "  ✓ caddy restarted"
	else
		step "Skipping Caddy restart (ops/Caddyfile unchanged)"
	fi

	DEPLOY_ELAPSED_S="$(( $(date +%s) - DEPLOY_START_S ))"

	step "Public health check"
	if curl --silent --fail --max-time 5 http://109.104.153.228/api/health; then
		echo
		echo "  ✓ deploy OK — http://109.104.153.228 (commit $COMMIT_SHA)"
		echo "  elapsed: ${DEPLOY_ELAPSED_S}s"
		if [ -f "$DEPLOY_META_DIR/previous-sha" ]; then
			echo "  rollback ref: $(cat "$DEPLOY_META_DIR/previous-sha")"
		fi
	else
		warn "Public health check failed — verify Caddy is running + port 80 is open"
	fi
}

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

main "$@"
