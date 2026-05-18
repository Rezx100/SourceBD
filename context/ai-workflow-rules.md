# SourceBD — AI Workflow Rules

These rules govern how the coding agent behaves on every task. They override convenience.

## Before any code

1. Read every file in `/context/` in order (project-overview → architecture → code-standards → ai-workflow-rules → ui-context → progress-tracker → phases).
2. Read the active spec in `context/feature-specs/NN-name.md`.
3. If a `context/current-issues.md` exists, read it too.
4. Update progress-tracker.md → mark this spec **"in progress"** before writing any code.

## During the work

- Implement EXACTLY what the spec says. Nothing more.
- **No drive-by refactors.** If you spot something broken outside the spec, log it in `context/current-issues.md` and keep moving.
- **No new tools/packages** that aren't in `architecture.md`. If you believe one is needed → STOP, propose it, wait for approval.
- If the spec is ambiguous → ask ONE clarifying question, wait. Do NOT guess.
- Match `code-standards.md` exactly.
- For UI work, only design tokens from `ui-context.md` — never raw hex colors.
- Validate data at every system boundary (API input via zod, ETL via pydantic, DB via constraints).

## After the work

1. Run, in this order: `pnpm typecheck`, `pnpm lint`, `pnpm test`, then build (`pnpm build`). For ETL: `ruff check`, `mypy`, `pytest`.
2. Fix every error. Warnings: fix or document in current-issues.md.
3. Update progress-tracker.md → mark spec **"complete"**, add architectural decisions made, list follow-ups.
4. Commit on the `development` branch with a Conventional Commit message. Open a PR to `main`.
5. **Do NOT commit** `.env*` (except `.env.example`), `context/current-issues.md`, `etl/raw/`, `node_modules/`, `.next/`, `__pycache__/`, `.venv/`.

## Debugging mode (when reading `current-issues.md`)

1. State your hypothesis for each issue, in plain English.
2. Propose the minimal change.
3. **WAIT for explicit approval** before editing any file.
4. After approval: implement → mark each issue **"pending test"** → user verifies.

## Spec scope discipline

- One spec = one fresh chat session.
- If a spec is taking >1 session, it's too big — split it.
- If you find yourself touching files not listed in the spec, STOP and ask.

## Data pipeline rules (Phase 0 specific)

- **Never** import Tier 6 records alone. Cross-check against ≥1 Tier 1–3 source first.
- Every supplier row gets a corresponding `source_records` row per source that verified it.
- Conflicts in conflicting sources resolve **highest tier wins**.
- Run dedup logic BEFORE inserts. The DB is the source of truth — re-runnable scripts must be idempotent (use `ON CONFLICT (slug) DO UPDATE`).
- Cache raw HTML/PDF fetches under `etl/raw/` (gitignored). Re-scrape only when explicitly told.
- Respect robots.txt and rate limits per `SourceBD_Data_Pipeline_Spec.md` Section 3.3.
- Identify scrapers in User-Agent: `SourceBD-Research/1.0 (+https://sourcebd.com/data-policy)`.

## Hard prohibitions

- Never push to `main` directly.
- Never use `--no-verify`, `--force`, `git reset --hard` without explicit user approval.
- Never delete files outside the spec's file list.
- Never commit secrets. If one leaks, rotate immediately and notify the user.
- Never SSH to or touch the pixelsport-backend VPS (37.49.227.151).
- Never use an LLM in production logic in v1 (Smart Match is rule-based).
- Never charge money in v1 outside Stripe subscriptions. SourceBD is not a transaction platform.

## When in doubt
Ask. Cheaper than rolling back.
