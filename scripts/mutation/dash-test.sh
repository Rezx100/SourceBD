#!/bin/bash
# Fast targeted run of the dashboard tests only (the full suite has an 8-min
# address-dedup fixture that is unrelated to REZ-A).
#
# The root is an argument, then $MUTATE_ROOT, then /home/claude/sb. The
# mutation harness runs in a worktree of its own so it can never rewrite a
# file in the tree the author commits from — three commits were made from a
# tree a concurrent sweep had mutated, and each shipped the mutant.
set -o pipefail
export PATH=/opt/node22/bin:$PATH
ROOT="${1:-${MUTATE_ROOT:-/home/claude/sb}}"
cd "$ROOT" || exit 1
pnpm exec tsc -p tsconfig.npm-test.json || exit 1
node --require ./test-stubs/register-node-test-aliases.cjs --experimental-websocket \
  --test --test-reporter spec \
  .tests-build/lib/dashboard/*.test.js \
  .tests-build/lib/design/*.test.js \
  .tests-build/components/dashboard/*.test.js \
  .tests-build/app/dev/ds/*.test.js \
  .tests-build/scripts/gallery/*.test.js
