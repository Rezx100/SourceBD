# SourceBD — Claude Code entry point

Read these, in order, before any work. They are the law; this file only points at them.

@AGENTS.md
@.cursor/rules/sourcebd-lean-context.mdc
@.cursor/rules/sourcebd-closed-loop.mdc

Then the lean boot set named in AGENTS.md rule 3 (`context/agent-brief.md`,
`context/current-state.md`, `context/feature-specs/active.md`). Nothing else under
`/context` until the task names it. Before any deploy talk:
`.cursor/rules/sourcebd-enterprise-deploy.mdc` and `docs/ENTERPRISE_DEPLOYMENT.md`.

## Verification gate — run all four, paste raw output, compare to baselines

Baselines at `e15966c` (17 Sep 2026):

- `pnpm exec tsc --noEmit` — exit 0, no output
- `pnpm test` — 602 passed / 0 failed / 86 suites, ~7 min. **Node 20 only.** On Node 22 the
  runner treats `node_modules/.cache/sourcebd-tests` as a file and the suite does not start.
- `ruff check etl ops --no-cache` — 49 findings on ruff ≤ 0.12 (442 on 0.16, whose default rule
  set differs). `pyproject.toml` pins only `ruff>=0.6`, so the version you install decides the
  number — state the version alongside the count, always.
- `python -m pytest -q etl/tests` — 1024 passed, 25 skipped. Needs `FIRECRAWL_API_KEY` set to any
  value (6 `test_credit_budget` tests) and a git identity in `GIT_AUTHOR_NAME/EMAIL` +
  `GIT_COMMITTER_NAME/EMAIL` (10 `test_github_https_fetch_auth` tests seed a temp repo). Without
  them 16 fail for environment reasons, not flakiness. The 25 skips are DB-backed tests gated on
  `SUPABASE_DB_URL`.

Any difference from these numbers, in either direction, is a finding to explain. Use `/verify`.

CI (`.github/workflows/ci.yml`) runs only `tsc`, `next lint`, `next build` and the HTTP-boundary
guard. `pytest` and `ruff` run nowhere but this machine. A green CI run is evidence, not
completion (closed-loop §1).

## What this machine will refuse (see `.claude/hooks/guard.py`)

`git push` to `main`, to tags, or force · bare `git push` while on `main` · `gh pr merge` ·
`gh workflow run` · any `--apply` · `ops/apply_*` and `ops/*_apply.*` · `ops/deploy*` and
`ops/bootstrap-vps.sh` · `ssh`/`rsync` to the VPS · anything touching `37.49.227.151` ·
`rsync --delete` · `docker compose down -v` · `rm -rf` of `etl/raw|parsed|logs`, `.deploy`, `.env`,
`supabase/migrations` · writing `.env` · direct SQL mutation via `psql -c`.

When you reach one of these, print the exact command for the founder to run, and stop.

## Facts an agent trips over here

- `pnpm`, not `npm`. Tests are `tsc` + `node --test` (`pnpm test`), not vitest. mypy is neither
  configured nor run — `context/architecture.md` claims both, and is wrong.
- CI runs the JS gates only; `pytest` and `ruff` are local. Node 20 is required for `pnpm test`.
- `pip install -e .` fails at the repo root (flat layout); install the dependency list out of
  `pyproject.toml` instead.
- `context/architecture.md` repo layout (`etl/parsers|dedup|enrich|load`) is aspirational; reality
  is `etl/core|scrapers|jobs|acquire|evidence|scoring|lib|content|tests`.
- `context/ai-workflow-rules.md` says "open a PR to main". AGENTS.md 9/9a is authoritative:
  feature → `development` PR, then `development` → `main` PR, each gate asked for separately.
- `gh run list` shows a workflow's branch, not its deploy input. Read the log line
  "Expected production commit" to learn what a Deploy Production run actually shipped.
- Linear issues always carry a plain description on first mention:
  `REZ-102 (nine suppliers holding another company's BGMEA records)`, never bare `REZ-102`.
- Reply style: five lines or fewer unless the founder asks for depth. No jargon.

## Commands

`/verify` · `/evidence-bundle <merge-base> <issue-id>` · `/audit <sha>` · `/deploy-preflight <sha>`
