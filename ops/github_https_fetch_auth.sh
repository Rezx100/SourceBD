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
# safe.directory, so the overlay sets safe.directory=* (root SSH to a
# sourcebd-owned /opt/sourcebd).

sourcebd_prepare_github_https_fetch() {
	local token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
	if [ -z "$token" ]; then
		return 0
	fi

	local origin=""
	origin="$(git config --local --get remote.origin.url 2>/dev/null || true)"
	if printf '%s' "$origin" | grep -qE '^https://([^/@]+@)?github\.com/'; then
		git remote set-url origin "$(printf '%s' "$origin" | sed -E 's#https://[^/@]+@github\.com/#https://github.com/#')"
	fi
	# Local insteadOf can rewrite the cleaned URL back to an expired PAT.
	git config --local --get-regexp '^url\..*\.insteadof$' 2>/dev/null | while read -r key val; do
		if printf '%s' "$val" | grep -q github.com; then
			git config --local --unset-all "$key" || true
		fi
	done || true

	git config --local --unset-all http.https://github.com/.extraheader 2>/dev/null || true
	git config --local --unset-all http.extraHeader 2>/dev/null || true
	git config --local --get-regexp '^http\..*extraheader$' 2>/dev/null | while read -r key val; do
		git config --local --unset-all "$key" || true
	done || true
	git config --local --unset-all credential.helper 2>/dev/null || true
	git config --local --get-regexp '^credential\..*\.helper$' 2>/dev/null | while read -r key val; do
		git config --local --unset-all "$key" || true
	done || true

	local auth
	auth="$(printf 'x-access-token:%s' "$token" | base64 | tr -d '\n')"
	export GIT_CONFIG_GLOBAL=/dev/null
	export GIT_CONFIG_SYSTEM=/dev/null
	export GIT_CONFIG_COUNT=3
	export GIT_CONFIG_KEY_0="http.https://github.com/.extraheader"
	export GIT_CONFIG_VALUE_0="AUTHORIZATION: basic ${auth}"
	export GIT_CONFIG_KEY_1="credential.helper"
	export GIT_CONFIG_VALUE_1=""
	export GIT_CONFIG_KEY_2="safe.directory"
	export GIT_CONFIG_VALUE_2="*"
	export GIT_TERMINAL_PROMPT=0
}
