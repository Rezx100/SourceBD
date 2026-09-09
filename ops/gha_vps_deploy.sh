#!/usr/bin/env bash
# GitHub Actions SSH entrypoint for production deploy.
# appleboy/ssh-action@v1.2.0 sends this via `script_path` (not `script_file`).
# It must be self-contained: the VPS tree still has the expired HTTPS
# credential and the old deploy_vps.sh until fetch succeeds.
#
# Keep every control-flow construct on a single line. `script_stop: true`
# injects an exit-code check after each newline; a split `case`/`function`
# becomes a syntax error.
set -Eeuo pipefail

if [ -z "${GITHUB_TOKEN:-}" ]; then echo "GITHUB_TOKEN missing — cannot fetch private repo on the VPS" >&2; exit 1; fi

REPO_DIR="${APP_DIR:-/opt/sourcebd}"
cd "$REPO_DIR" || { echo "REPO_DIR $REPO_DIR not found"; exit 1; }
if [ ! -d .git ]; then echo "No .git in $REPO_DIR — run first-time VPS migration (docs/ENTERPRISE_DEPLOYMENT.md)"; exit 1; fi

origin="$(git config --local --get remote.origin.url 2>/dev/null || true)"
if printf '%s' "$origin" | grep -qE '^https://([^/@]+@)?github\.com/'; then git remote set-url origin "$(printf '%s' "$origin" | sed -E 's#https://[^/@]+@github\.com/#https://github.com/#')"; fi
git config --local --get-regexp '^url\..*\.insteadof$' 2>/dev/null | while read -r key val; do if printf '%s' "$val" | grep -q github.com; then git config --local --unset-all "$key" || true; fi; done || true

auth="$(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 | tr -d '\n')"
export GIT_CONFIG_GLOBAL=/dev/null
export GIT_CONFIG_SYSTEM=/dev/null
export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0="http.https://github.com/.extraheader"
export GIT_CONFIG_VALUE_0="AUTHORIZATION: basic ${auth}"
export GIT_CONFIG_KEY_1="credential.helper"
export GIT_CONFIG_VALUE_1=""
export GIT_TERMINAL_PROMPT=0

bash ops/deploy_vps.sh --ref="${DEPLOY_REF}" --require-git
