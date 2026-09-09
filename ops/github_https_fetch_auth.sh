#!/usr/bin/env bash
# Prepare git to fetch a private GitHub repo over HTTPS without persisting
# a PAT in `origin`. An expired token embedded in the remote URL makes
# `git fetch origin` fail even when a valid token is in the environment
# (Deploy Production 34313279340 / 34315443132, 9 Sep 2026).
#
# Usage: source this file, then sourcebd_prepare_github_https_fetch
# Requires: GITHUB_TOKEN or GH_TOKEN in the environment. No-op otherwise.
# Does not echo the token.
#
# extraheader and credential.helper are multi-valued: a GIT_CONFIG_COUNT
# overlay *adds* a value and does not replace leftovers in .git/config.
# Unset those keys before exporting the job-token header. Nulling
# system/global config drops a possible stale helper but also drops
# safe.directory, so export safe.directory=* *before* any git config --local
# (root SSH to a sourcebd-owned /opt/sourcebd).

sourcebd_prepare_github_https_fetch() {
	local token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
	if [ -z "$token" ]; then
		return 0
	fi

	export GIT_CONFIG_GLOBAL=/dev/null
	export GIT_CONFIG_SYSTEM=/dev/null
	export GIT_CONFIG_COUNT=1
	export GIT_CONFIG_KEY_0="safe.directory"
	export GIT_CONFIG_VALUE_0="*"
	export GIT_TERMINAL_PROMPT=0

	local origin=""
	origin="$(git config --local --get remote.origin.url 2>/dev/null || true)"
	# Drop userinfo, :443, and scheme-case variants so leftover PATs cannot
	# stay in origin (github.com:443 / HTTPS:// named counterexamples).
	if printf '%s' "$origin" | grep -qiE '^https://([^/@]+@)?github\.com(:443)?/'; then
		git remote set-url origin "$(printf '%s' "$origin" | sed -E 's#^[Hh][Tt][Tt][Pp][Ss]://([^/@]+@)?[Gg][Ii][Tt][Hh][Uu][Bb]\.[Cc][Oo][Mm](:443)?/#https://github.com/#')"
	fi
	# Leftovers in include.path, includeIf, and config.worktree are
	# invisible to `git config --local --unset-all` of the HTTP keys.
	# insteadOf is dropped entirely (not only when the value mentions
	# github.com) so a rewrite of https:// cannot re-inject a PAT.
	local gitdir="" cfg=""
	gitdir="$(git rev-parse --git-dir 2>/dev/null || true)"
	for cfg in "$gitdir/config" "$gitdir/config.worktree"; do
		[ -f "$cfg" ] || continue
		git config --file "$cfg" --unset-all include.path 2>/dev/null || true
		git config --file "$cfg" --get-regexp '^includeIf\..*\.path$' 2>/dev/null | while read -r key val; do
			git config --file "$cfg" --unset-all "$key" || true
		done || true
		git config --file "$cfg" --get-regexp '^url\..*\.insteadof$' 2>/dev/null | while read -r key val; do
			git config --file "$cfg" --unset-all "$key" || true
		done || true
		git config --file "$cfg" --unset-all http.https://github.com/.extraheader 2>/dev/null || true
		git config --file "$cfg" --unset-all http.extraHeader 2>/dev/null || true
		git config --file "$cfg" --get-regexp '^http\..*extraheader$' 2>/dev/null | while read -r key val; do
			git config --file "$cfg" --unset-all "$key" || true
		done || true
		git config --file "$cfg" --unset-all credential.helper 2>/dev/null || true
		git config --file "$cfg" --get-regexp '^credential\..*\.helper$' 2>/dev/null | while read -r key val; do
			git config --file "$cfg" --unset-all "$key" || true
		done || true
	done
	git config --local --unset-all extensions.worktreeConfig 2>/dev/null || true

	local auth
	auth="$(printf 'x-access-token:%s' "$token" | base64 | tr -d '\n')"
	export GIT_CONFIG_COUNT=3
	export GIT_CONFIG_KEY_0="http.https://github.com/.extraheader"
	export GIT_CONFIG_VALUE_0="AUTHORIZATION: basic ${auth}"
	export GIT_CONFIG_KEY_1="credential.helper"
	export GIT_CONFIG_VALUE_1=""
	export GIT_CONFIG_KEY_2="safe.directory"
	export GIT_CONFIG_VALUE_2="*"
}
