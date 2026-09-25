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

Baselines **re-measured 25 Sep 2026** at REZ-C's audited candidate, on the commit that
writes them. The `e15966c` (17 Sep) figures they replace were out of date.

- `pnpm exec tsc --noEmit` — exit 0, no output. (Unchanged.)
- `pnpm test` — **1,811 tests / 248 suites: 1,810 pass, 1 fail** (REZ-C cycle-10 repairs), ~12–25 min. The old
  "602 passed / 86 suites" predates REZ-A, REZ-B and REZ-C. **Node 21+, not 20.** The
  script passes `".tests-build/**/*.test.js"` to `node --test`, and Node 20 has no glob
  support there: it looks for a file of that literal name, prints `Could not find`, and
  exits 1 with nothing run. Measured on Node 25.4.0. It sits several minutes on one
  CPU-bound suite near the end; that is not a hang.
  **One known failure, pre-existing and not REZ-C's:** `lib/rate-limit/limits.test.ts` —
  "bucket `api_export` is not in rl_check's allow-list". REZ-B added the `api_export`
  class in `lib/rate-limit/limits.ts` without adding it to `rl_check`'s allow-list in a
  migration, so **`/api/v1/discover/export` is never rate limited**. Identical at
  `1366220`. Worth its own issue.
- `ruff check etl ops --no-cache` — **49 findings on ruff 0.15.13** (and on ≤ 0.12; 442 on
  0.16, whose default rule set differs). `pyproject.toml` pins only `ruff>=0.6`, so the
  version you install decides the number — state the version alongside the count, always.
- `python -m pytest -q etl/tests` — the answer depends on whether the database is
  reachable, and `.env` sets `SUPABASE_DB_URL`, which `load_dotenv` picks up whatever the
  shell says. **With the DB reachable: 1,009 passed / 42 failed / 6 skipped.** The old
  "1024 passed, 25 skipped" describes a machine with no database URL, which this is not.
  Every one of those failures is environmental and pre-existing — the same five files at
  the merge base `1366220`, in a clean worktree, fail the same 42:
  - `test_github_https_fetch_auth.py` (31) — shells out to `bash`, which on this machine
    now resolves to WSL with no distribution installed. The old note blamed a missing git
    identity; setting `GIT_AUTHOR_NAME/EMAIL` + `GIT_COMMITTER_NAME/EMAIL` does not fix it.
  - `test_queue_release_plan_sql.py` (5), `test_queue_decide_rpc_live.py` (4) — pin
    production queue rows from August that migration `0102` released on 14 Aug.
  - `test_epb_detail_url_sql.py` (1), `test_deploy_production_smoke.py` (1) — DB and
    live-site reads.
  `FIRECRAWL_API_KEY` set to any value is still needed (6 `test_credit_budget` tests).
  The 6 skips are `test_supplier_contact_counts_sql.py`, which cannot run until migration
  `0105` is applied and says so in its skip messages; they become passes after it is.
  DB-backed tests skip cleanly without the URL.

Any difference from these numbers, in either direction, is a finding to explain. Use `/verify`.

CI (`.github/workflows/ci.yml`) runs `tsc`, `next lint`, `next build`, `pnpm test` and the
HTTP-boundary guard. `pytest` and `ruff` run nowhere but this machine. A green CI run is
evidence, not completion (closed-loop §1).

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
- CI runs the JS gates and `pnpm test`; `pytest` and `ruff` are local. `pnpm test` needs Node 21+.
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
