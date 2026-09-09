#!/usr/bin/env bash
# GitHub Actions SSH entrypoint for production deploy.
# appleboy/ssh-action@v1.2.0 sends this via `script_path` (not `script_file`).
# It must be self-contained: the VPS tree still has the expired HTTPS
# credential and the old deploy_vps.sh until fetch succeeds.
#
# Keep every control-flow construct on a single line. `script_stop: true`
# injects an exit-code check after each newline; a split `case`/`function`
# becomes a syntax error.
#
# Trust overlay (safe.directory=*) MUST be exported before any
# `git config --local`. Root SSH into a sourcebd-owned /opt/sourcebd
# otherwise treats the tree as dubious, unsets become no-ops, and a
# leftover extraheader is sent next to the job token.
set -Eeuo pipefail

if [ -z "${GITHUB_TOKEN:-}" ]; then echo "GITHUB_TOKEN missing — cannot fetch private repo on the VPS" >&2; exit 1; fi

REPO_DIR="${APP_DIR:-/opt/sourcebd}"
cd "$REPO_DIR" || { echo "REPO_DIR $REPO_DIR not found"; exit 1; }
if [ ! -d .git ]; then echo "No .git in $REPO_DIR — run first-time VPS migration (docs/ENTERPRISE_DEPLOYMENT.md)"; exit 1; fi

export GIT_CONFIG_GLOBAL=/dev/null
export GIT_CONFIG_SYSTEM=/dev/null
export GIT_CONFIG_COUNT=1
export GIT_CONFIG_KEY_0="safe.directory"
export GIT_CONFIG_VALUE_0="*"
export GIT_TERMINAL_PROMPT=0

origin="$(git config --local --get remote.origin.url 2>/dev/null || true)"
if printf '%s' "$origin" | grep -qiE '^https://([^/@]+@)?github\.com(:443)?/'; then git remote set-url origin "$(printf '%s' "$origin" | sed -E 's#^[Hh][Tt][Tt][Pp][Ss]://([^/@]+@)?[Gg][Ii][Tt][Hh][Uu][Bb]\.[Cc][Oo][Mm](:443)?/#https://github.com/#')"; fi
cfg="$(git rev-parse --git-path config 2>/dev/null || true)"
wtc="$(git rev-parse --git-path config.worktree 2>/dev/null || true)"
for f in "$cfg" "$wtc"; do [ -n "$f" ] && [ -f "$f" ] || continue; git config --file "$f" --unset-all include.path 2>/dev/null || true; git config --file "$f" --get-regexp '^includeIf\..*\.path$' 2>/dev/null | while read -r key val; do git config --file "$f" --unset-all "$key" || true; done || true; git config --file "$f" --get-regexp '^url\..*\.insteadof$' 2>/dev/null | while read -r key val; do git config --file "$f" --unset-all "$key" || true; done || true; git config --file "$f" --unset-all http.https://github.com/.extraheader 2>/dev/null || true; git config --file "$f" --unset-all http.extraHeader 2>/dev/null || true; git config --file "$f" --get-regexp '^http\..*extraheader$' 2>/dev/null | while read -r key val; do git config --file "$f" --unset-all "$key" || true; done || true; git config --file "$f" --unset-all credential.helper 2>/dev/null || true; git config --file "$f" --get-regexp '^credential\..*\.helper$' 2>/dev/null | while read -r key val; do git config --file "$f" --unset-all "$key" || true; done || true; done
git config --local --unset-all extensions.worktreeConfig 2>/dev/null || true

auth="$(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 | tr -d '\n')"
export GIT_CONFIG_COUNT=3
export GIT_CONFIG_KEY_0="http.https://github.com/.extraheader"
export GIT_CONFIG_VALUE_0="AUTHORIZATION: basic ${auth}"
export GIT_CONFIG_KEY_1="credential.helper"
export GIT_CONFIG_VALUE_1=""
export GIT_CONFIG_KEY_2="safe.directory"
export GIT_CONFIG_VALUE_2="*"

bash ops/deploy_vps.sh --ref="${DEPLOY_REF}" --require-git
