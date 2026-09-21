#!/usr/bin/env bash
# Regenerates the gallery stylesheet, page and the six screenshots from THIS
# tree, and stamps the commit they were rendered from.
#
#   ./scripts/gallery/regen.sh [--allow-dirty]
#   GALLERY_OUT=/tmp/shots ./scripts/gallery/regen.sh
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
out="${GALLERY_OUT:-$repo_root/_gallery-out}"
allow_dirty=0
[[ "${1:-}" == "--allow-dirty" ]] && allow_dirty=1

# The stamp names the commit whose screenshots these are. Taken over a dirty
# tree it names a commit nobody can reproduce them from, so the run stops.
sha="$(git rev-parse --short HEAD)"
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  if [[ "$allow_dirty" -eq 0 ]]; then
    echo "regen.sh: the working tree has uncommitted changes, so '$sha' would not be the tree being rendered." >&2
    echo "          Commit them, or pass --allow-dirty to stamp '${sha}-dirty'." >&2
    git status --short --untracked-files=no >&2
    exit 1
  fi
  sha="${sha}-dirty"
fi

mkdir -p "$out/shots"
echo "$sha" > "$out/CANDIDATE_SHA"
echo "regen.sh: rendering $sha into $out"

pnpm exec tailwindcss -c tailwind.config.ts -i app/ds.css -o "$out/ds.css" >/dev/null

# No `|| true` here: the copy this replaced swallowed compile errors and then
# re-screenshotted whatever was left in the build directory from last time.
rm -rf .render-build
pnpm exec tsc -p scripts/gallery/tsconfig.render.json

GALLERY_OUT="$out" REPO_ROOT="$repo_root" RENDER_BUILD_DIR=.render-build \
  node --require ./scripts/gallery/register-aliases.cjs .render-build/scripts/gallery/render-gallery-fixtures.js
rm -rf .render-build

GALLERY_OUT="$out" node ./scripts/gallery/shots.mjs
echo "regen.sh: done — $out/shots/*.png at $sha"
