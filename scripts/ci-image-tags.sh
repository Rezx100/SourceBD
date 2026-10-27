#!/usr/bin/env bash
# Prints the registry tags for one source tree, as KEY=value lines for
# $GITHUB_OUTPUT. Used by the image, release-ok and fast-deploy jobs in
# .github/workflows/ci.yml and by Deploy Production, so they cannot drift.
#
#   bash scripts/ci-image-tags.sh <tree-sha>      (PUBLIC_ENV in the environment)
#
# Tags key on the tree, not the commit: the release PR's test merge and the
# merge commit main gets have different SHAs but the same tree whenever main
# has not moved in between, so main can reuse what the release PR built.
# The web tag also carries the NEXT_PUBLIC_ fingerprint (same recipe as the
# server's check in ops/deploy_vps.sh): new public settings mean a new build.
set -euo pipefail
tree="$1"
owner="$(printf '%s' "${GITHUB_REPOSITORY_OWNER:?}" | tr '[:upper:]' '[:lower:]')"
fp="$(printf '%s\n' "${PUBLIC_ENV:-}" | sed 's/\r$//' | { grep -E '^NEXT_PUBLIC_' || true; } | LC_ALL=C sort | sha256sum | cut -d' ' -f1)"
repo="ghcr.io/$owner/sourcebd-web"
echo "fp=$fp"
echo "web=$repo:tree-$tree-${fp:0:12}"
echo "etl=$repo:etl-tree-$tree"
# Exists only once every check passed on a release PR that tested this tree.
echo "ok=$repo:ok-tree-$tree-${fp:0:12}"
