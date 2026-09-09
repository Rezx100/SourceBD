#!/usr/bin/env bash
# GitHub Actions SSH entrypoint for production deploy.
# appleboy/ssh-action sends this file from the runner to the VPS, so it must
# be self-contained: the VPS copy of the repo may still have an expired
# HTTPS credential and the old deploy_vps.sh.
set -Eeuo pipefail

# --- begin github_https_fetch_auth.sh ---
sourcebd_prepare_github_https_fetch() {
	local token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
	if [ -z "$token" ]; then
		return 0
	fi

	local origin=""
	origin="$(git config --local --get remote.origin.url 2>/dev/null || true)"
	case "$origin" in
		https://*github.com/*)
			local clean
			clean="$(printf '%s' "$origin" | sed -E 's#https://[^/]*@github.com/#https://github.com/#')"
			git remote set-url origin "$clean"
			;;
	esac

	local auth
	auth="$(printf 'x-access-token:%s' "$token" | base64 | tr -d '\n')"
	export GIT_CONFIG_COUNT=1
	export GIT_CONFIG_KEY_0="http.https://github.com/.extraheader"
	export GIT_CONFIG_VALUE_0="AUTHORIZATION: basic ${auth}"
}
# --- end github_https_fetch_auth.sh ---

if [ -z "${GITHUB_TOKEN:-}" ]; then
	echo "GITHUB_TOKEN missing — cannot fetch private repo on the VPS" >&2
	exit 1
fi

REPO_DIR="${APP_DIR:-/opt/sourcebd}"
cd "$REPO_DIR" || { echo "REPO_DIR $REPO_DIR not found"; exit 1; }
if [ ! -d .git ]; then
	echo "No .git in $REPO_DIR — run first-time VPS migration (docs/ENTERPRISE_DEPLOYMENT.md)"
	exit 1
fi

sourcebd_prepare_github_https_fetch
bash ops/deploy_vps.sh --ref="${DEPLOY_REF}" --require-git
