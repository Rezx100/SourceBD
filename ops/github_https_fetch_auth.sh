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
# safe.directory, so export safe.directory=* *before* any git config --file
# (root SSH to a sourcebd-owned /opt/sourcebd).
# GIT_CONFIG_PARAMETERS (git -c packed into the environment) also merges
# with the overlay: leftover extraheader -> Duplicate header / HTTP 400;
# leftover insteadOf -> expired PAT in GETURL. Unset it before any git.
# GIT_CONFIG points git at a single file and makes `git config --local`
# fail ("only one config file at a time"), so leftover origin userinfo is
# never stripped. Unset GIT_CONFIG before any git.

sourcebd_prepare_github_https_fetch() {
	local token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
	if [ -z "$token" ]; then
		return 0
	fi

	unset GIT_CONFIG_PARAMETERS
	unset GIT_CONFIG
	export GIT_CONFIG_GLOBAL=/dev/null
	export GIT_CONFIG_SYSTEM=/dev/null
	export GIT_CONFIG_COUNT=1
	export GIT_CONFIG_KEY_0="safe.directory"
	export GIT_CONFIG_VALUE_0="*"
	export GIT_TERMINAL_PROMPT=0

	# Leftovers in include.path, includeIf, and config.worktree are
	# invisible to `git config --local --unset-all` of the HTTP keys.
	# insteadOf is dropped entirely (not only when the value mentions
	# github.com) so a rewrite of https:// cannot re-inject a PAT.
	# Origin is rewritten via --file on --git-path config so GIT_CONFIG
	# cannot divert --local, and every remote.origin.url value is replaced.
	local cfg="" wtc="" origin_line="" canon=""
	cfg="$(git rev-parse --git-path config 2>/dev/null || true)"
	wtc="$(git rev-parse --git-path config.worktree 2>/dev/null || true)"
	if [ -n "$cfg" ] && [ -f "$cfg" ]; then
		while IFS= read -r origin_line; do
			[ -n "$origin_line" ] || continue
			if printf '%s' "$origin_line" | grep -qiE '^https?://([^/@]+@)?(www\.)?github\.com(\.|:443)?/'; then
				canon="$(printf '%s' "$origin_line" | sed -E 's#^[Hh][Tt][Tt][Pp][Ss]?://([^/@]+@)?([Ww][Ww][Ww]\.)?[Gg][Ii][Tt][Hh][Uu][Bb]\.[Cc][Oo][Mm]\.?(:443)?/#https://github.com/#')"
			fi
		done <<EOF
$(git config --file "$cfg" --get-all remote.origin.url 2>/dev/null || true)
EOF
		if [ -n "$canon" ]; then
			git config --file "$cfg" --unset-all remote.origin.url 2>/dev/null || true
			git config --file "$cfg" --add remote.origin.url "$canon"
		fi
	fi
	local target=""
	for target in "$cfg" "$wtc"; do
		[ -n "$target" ] && [ -f "$target" ] || continue
		git config --file "$target" --unset-all include.path 2>/dev/null || true
		git config --file "$target" --get-regexp '^includeIf\..*\.path$' 2>/dev/null | while read -r key val; do
			git config --file "$target" --unset-all "$key" || true
		done || true
		git config --file "$target" --get-regexp '^url\..*\.(push)?insteadof$' 2>/dev/null | while read -r key val; do
			git config --file "$target" --unset-all "$key" || true
		done || true
		git config --file "$target" --unset-all http.https://github.com/.extraheader 2>/dev/null || true
		git config --file "$target" --unset-all http.extraHeader 2>/dev/null || true
		git config --file "$target" --get-regexp '^http\..*extraheader$' 2>/dev/null | while read -r key val; do
			git config --file "$target" --unset-all "$key" || true
		done || true
		git config --file "$target" --unset-all credential.helper 2>/dev/null || true
		git config --file "$target" --get-regexp '^credential\..*\.helper$' 2>/dev/null | while read -r key val; do
			git config --file "$target" --unset-all "$key" || true
		done || true
	done
	if [ -n "$cfg" ] && [ -f "$cfg" ]; then
		git config --file "$cfg" --unset-all extensions.worktreeConfig 2>/dev/null || true
	fi

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
