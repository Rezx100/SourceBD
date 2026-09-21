---
description: Run the SourceBD verification gate on HEAD and report raw results against the recorded baselines
allowed-tools: Bash(git:*), Bash(node:*), Bash(pnpm:*), Bash(ruff:*), Bash(python:*), Bash(python3:*)
---

From the repository root, run every step even if an earlier one fails:

1. `git rev-parse HEAD && git branch --show-current && git status --short` — a dirty tree is a
   finding (AGENTS.md rule 11), not something to tidy up in passing.
2. `node --version` — must be 20.x; the test runner does not start on 22.
3. `pnpm exec tsc --noEmit`
4. `pnpm test` (allow ~7 minutes)
5. `ruff --version && ruff check etl ops --no-cache` — report the version with the count. The
   baseline of 49 holds only for ruff ≤ 0.12; `pyproject.toml` pins nothing tighter than `>=0.6`.
6. `python -m pytest -q etl/tests` — if `FIRECRAWL_API_KEY` is unset or no git identity exists in
   the environment, 16 tests fail for environment reasons; say which and why rather than calling
   them flaky.

Report per gate: the exit code and the raw summary lines verbatim, then the delta against the
baselines in `CLAUDE.md`. Never "fix" a baseline as a drive-by; a changed number is a finding to
explain.

Banned words: green, clean, should, appears, probably, seems.
