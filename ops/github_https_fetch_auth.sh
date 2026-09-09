#!/usr/bin/env bash
# Prepare git to fetch a private GitHub repo over HTTPS without persisting
# a PAT in `origin`. An expired token embedded in the remote URL makes
# `git fetch origin` fail even when a valid token is in the environment
# (Deploy Production 34313279340 / 34315443132, 9 Sep 2026).
#
# Usage: source this file, then sourcebd_prepare_github_https_fetch
# Requires: GITHUB_TOKEN or GH_TOKEN in the environment. No-op otherwise.
# Does not echo the token.

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
