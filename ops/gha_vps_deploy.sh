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
# `git config --file` / `--local`. Root SSH into a sourcebd-owned /opt/sourcebd
# otherwise treats the tree as dubious, unsets become no-ops, and a leftover
# extraheader is sent next to the job token.
set -Eeuo pipefail

if [ -z "${GITHUB_TOKEN:-}" ]; then echo "GITHUB_TOKEN missing — cannot fetch private repo on the VPS" >&2; exit 1; fi

REPO_DIR="${APP_DIR:-/opt/sourcebd}"
export REPO_DIR
cd "$REPO_DIR" || { echo "REPO_DIR $REPO_DIR not found"; exit 1; }
if [ ! -d .git ] && [ ! -f .git ]; then echo "No .git in $REPO_DIR — run first-time VPS migration (docs/ENTERPRISE_DEPLOYMENT.md)"; exit 1; fi
unset GIT_CONFIG_PARAMETERS
unset GIT_CONFIG

export GIT_CONFIG_GLOBAL=/dev/null
export GIT_CONFIG_SYSTEM=/dev/null
export GIT_CONFIG_COUNT=1
export GIT_CONFIG_KEY_0="safe.directory"
export GIT_CONFIG_VALUE_0="*"
export GIT_TERMINAL_PROMPT=0

cfg="$(git rev-parse --git-path config 2>/dev/null || true)"
wtc="$(git rev-parse --git-path config.worktree 2>/dev/null || true)"
if [ -n "$cfg" ] && [ -f "$cfg" ]; then _o="$(git config --file "$cfg" --get-all remote.origin.url 2>/dev/null || true)"; printf '%s\n' "$_o" | while IFS= read -r origin; do [ -n "$origin" ] || continue; if printf '%s' "$origin" | grep -qiE '^https?://([^/@]+@)?(www\.)?github\.com(\.|:443)?/'; then c="$(printf '%s' "$origin" | sed -E 's#^[Hh][Tt][Tt][Pp][Ss]?://([^/@]+@)?([Ww][Ww][Ww]\.)?[Gg][Ii][Tt][Hh][Uu][Bb]\.[Cc][Oo][Mm]\.?(:443)?/#https://github.com/#')"; git config --file "$cfg" --unset-all remote.origin.url 2>/dev/null || true; git config --file "$cfg" --add remote.origin.url "$c"; fi; done; fi
for f in "$cfg" "$wtc"; do [ -n "$f" ] && [ -f "$f" ] || continue; git config --file "$f" --unset-all include.path 2>/dev/null || true; git config --file "$f" --get-regexp '^includeIf\..*\.path$' 2>/dev/null | while read -r key val; do git config --file "$f" --unset-all "$key" || true; done || true; git config --file "$f" --get-regexp '^url\..*\.(push)?insteadof$' 2>/dev/null | while read -r key val; do git config --file "$f" --unset-all "$key" || true; done || true; git config --file "$f" --unset-all http.https://github.com/.extraheader 2>/dev/null || true; git config --file "$f" --unset-all http.extraHeader 2>/dev/null || true; git config --file "$f" --get-regexp '^http\..*extraheader$' 2>/dev/null | while read -r key val; do git config --file "$f" --unset-all "$key" || true; done || true; git config --file "$f" --unset-all credential.helper 2>/dev/null || true; git config --file "$f" --get-regexp '^credential\..*\.helper$' 2>/dev/null | while read -r key val; do git config --file "$f" --unset-all "$key" || true; done || true; done
if [ -n "$cfg" ] && [ -f "$cfg" ]; then git config --file "$cfg" --unset-all extensions.worktreeConfig 2>/dev/null || true; fi

auth="$(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 | tr -d '\n')"
export GIT_CONFIG_COUNT=3
export GIT_CONFIG_KEY_0="http.https://github.com/.extraheader"
export GIT_CONFIG_VALUE_0="AUTHORIZATION: basic ${auth}"
export GIT_CONFIG_KEY_1="credential.helper"
export GIT_CONFIG_VALUE_1=""
export GIT_CONFIG_KEY_2="safe.directory"
export GIT_CONFIG_VALUE_2="*"

_deploy="ops/deploy_vps.sh"
if [ -f .git ] && [ -f ops/deploy_vps.sh ]; then _deploy="$(mktemp)"; cp ops/deploy_vps.sh "$_deploy"; sed -i -e 's/\[ "$REQUIRE_GIT" -eq 1 \] && \[ ! -d \.git \]; then/[ "$REQUIRE_GIT" -eq 1 ] \&\& [ ! -d .git ] \&\& [ ! -f .git ]; then/' -e 's/if \[ -d \.git \]; then/if [ -d .git ] || [ -f .git ]; then/' "$_deploy"; fi
bash "$_deploy" --ref="${DEPLOY_REF}" --require-git
