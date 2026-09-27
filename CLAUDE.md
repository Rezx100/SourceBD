# SourceBD — Claude Code entry point

Read once per session, in this order, then nothing else under `/context` until the task names it:

@AGENTS.md
@.cursor/rules/sourcebd-lean-context.mdc
@.cursor/rules/sourcebd-closed-loop.mdc
@.cursor/rules/sourcebd-reply-style.mdc

Then the lean boot set from AGENTS.md rule 3 (`context/agent-brief.md`, `context/current-state.md`,
`context/feature-specs/active.md`). Before any deploy talk: `.cursor/rules/sourcebd-enterprise-deploy.mdc`.

## The workflow (since 27 Sep 2026)

1. Branch off `development`. Implement. Run only the one test file that covers the change.
2. One critic pass: `/code-review` on the diff against the merge base. Fix the real findings.
3. Push, open the PR to `development`, then `gh pr merge --auto --squash`. GitHub merges it when
   every required check is green. Read a red run with `gh run view --log-failed`, fix, push again.
4. To go live: the same PR flow from `development` to `main`. The push to `main` starts Deploy
   Production, which waits for the founder's approval in the GitHub `production` environment.
   That approval is the only human gate. Never `gh workflow run` it yourself.

Do not run locally what CI runs. CI (`.github/workflows/ci.yml`) is `tsc`, `next lint`, `next build`,
`pnpm test` on Node 22, the HTTP-boundary guard, the migration replay on Postgres 16, and
`pytest etl/tests`. All six are required checks on `development` and `main`. `ruff` runs nowhere:
49 pre-existing findings (ruff 0.15) would make it red on day one; fix them before adding it.

## What the guard hook refuses

The hook lives in `claude-config-staging/hooks/guard.py` until the founder installs it with
`claude-config-staging/install.ps1`. It refuses: `git push` to `main`, to tags, or force; bare
`git push` while on `main`; `gh pr merge` by hand (`--auto` is the intended exception);
`gh workflow run`; any `--apply`; `ops/apply_*` and `ops/*_apply.*`; `ops/deploy*` and
`ops/bootstrap-vps.sh`; `ssh`/`rsync` to the VPS; anything touching `37.49.227.151`;
`rsync --delete`; `docker compose down -v`; `rm -rf` of `etl/raw|parsed|logs`, `.deploy`, `.env`,
`supabase/migrations`; writing `.env`; direct SQL mutation via `psql -c`.

When you reach one of these, print the exact command for the founder to run, and stop.

## Facts an agent trips over here

- `pnpm`, not `npm`. Tests are `tsc` + `node --test` (`pnpm test`), not vitest; Node 21+ locally.
  mypy is neither configured nor run; `context/architecture.md` claims both, and is wrong.
- `pip install -e .` fails at the repo root (flat layout); install the dependency list out of
  `pyproject.toml` instead. `pytest` needs `FIRECRAWL_API_KEY` set to anything and a git identity.
- `context/architecture.md` repo layout (`etl/parsers|dedup|enrich|load`) is aspirational; reality
  is `etl/core|scrapers|jobs|acquire|evidence|scoring|lib|content|tests`.
- `context/ai-workflow-rules.md` says "open a PR to main". AGENTS.md 9/9a is authoritative.
- `gh run list` shows a workflow's branch, not its deploy input. Read the log line
  "Expected production commit" to learn what a Deploy Production run actually shipped.
- Open bug worth its own issue: `/api/v1/discover/export` is never rate limited. REZ-B added the
  `api_export` class in `lib/rate-limit/limits.ts` without adding it to `rl_check`'s allow-list.
- Linear issues and PRs carry a plain description on first mention: `REZ-102 (nine suppliers
  holding another company's BGMEA records)`, never bare `REZ-102`.
