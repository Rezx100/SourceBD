# SourceBD - Current State

Last compacted for agent-token efficiency: 30 Jun 2026.

## Phase
Phase 7 - Public Beta launch prep.

## Shipped Baseline
- Phase 0 data moat and Phases 1-5 are shipped in the codebase.
- Phase 6 hardening H1-H8 is shipped in codebase.
- FE-SITEWIDE design conformance pass is complete enough to be the current visual baseline.
- P1 deploy artefacts and Phase 7 P2-P4 beta surfaces are reported as landed.

## Current Goal
Launch-readiness closeout:
- Deploy to VPS `109.104.153.228`.
- Apply migrations 0048-0049 and 0060 to production Supabase.
- Run the 30-day zero P1/P2 Sentry incident window before calling beta fully live.

## Recent Admin Scraper Ops
26 Jun 2026 - Admin scraper operations implemented from the accepted plan.
Scope adds `/admin/sources`, admin-only ETL queue/schedule RPCs and API
routes, the `etl_job_queue` / `etl_schedules` migration, a VPS cron runner
for due schedules and queued jobs, and a shared scraper catalog that includes
BGMEA, BKMEA, BGAPMEA, EPB, BTMA, RSC, WRAP, OEKO-TEX, GOTS, SA8000,
sanctions/regulatory, and brand-disclosure scrapers. ETL execution remains in
the Python/Docker ETL service; the web app only enqueues and reports.
`pnpm typecheck`, `pnpm lint`, Python compile checks, `python -m etl.cli list`,
and `python -m etl.cli run-queue --limit 0` pass. Lint still reports
pre-existing warnings outside this work.

27 Jun 2026 - Admin scraper monitoring upgraded and deployed to VPS
`109.104.153.228`. Scope adds live progress counters, heartbeat timestamps,
per-job event timelines (`etl_job_events`), an admin polling status API, and a
live `/admin/sources` monitor with elapsed time, visual record bars, and
operator-facing action text. Production migration
`0064_admin_etl_live_monitoring.sql` applied and verified; web rebuilt and
restarted healthy. Local verification passed: `python -m py_compile` for ETL
progress files, `pnpm typecheck`, and `pnpm lint` (same pre-existing warnings).
Production smoke: `/api/health` OK, `docker compose ps` healthy, cron installed,
and `docker compose run --rm etl run-queue --limit 0` returned processed 0 /
failed 0.

26 Jun 2026 - Scraper operations deployed to VPS `109.104.153.228` via a
tmux-backed finish deploy after the first SSH build disconnected. Production
Supabase migration `0063_admin_etl_scraper_ops.sql` applied and verified,
`sourcebd-etl:latest` and `sourcebd-web:latest` built, web container recreated
healthy, and the scraper queue cron installed:
`/opt/sourcebd/ops/scraper_queue_cron.sh` every minute. Final smoke checks:
`/api/health` OK, `docker compose ps` healthy, ETL CLI lists `wrap`, and
`docker compose run --rm etl run-queue --limit 0` returns processed 0 / failed 0.

## Recent Admin Repair
26 Jun 2026 - Admin UI overhaul completed in the working tree under
`context/feature-specs/spec-ADMIN-CONSOLE-repair.md`. Scope is presentation
and operator usability across `/admin`, using the existing SourceBD app
surface primitives and vendored Magic UI-style layout components without new
dependencies or backend changes. Changes add shared admin UI wrappers, polish
supplier and queue workflows, migrate admin moderation/list/detail pages to a
consistent responsive system, and add the review queue to admin topbar quick
navigation. `pnpm typecheck` and `pnpm lint` pass; lint still reports
pre-existing warnings outside the touched admin work.

26 Jun 2026 - Admin console repair completed in the working tree under
`context/feature-specs/spec-ADMIN-CONSOLE-repair.md`. Changes add a unified
`/admin/queue` hub, clearer supplier publication feedback and profile
revalidation, operator-focused supplier list/detail labels, and moderation
page polish. `pnpm typecheck` and `pnpm lint` pass; `pnpm build` still fails
on Windows before compilation with `.next/trace` EPERM.

## Recent Frontend Polish
30 Jun 2026 - Principal product chip dedup and compound-label split deployed to VPS
`109.104.153.228`. Frontend-only (DB unchanged) in `lib/product-icons.ts`:
spelling correction for common BGMEA harvest typos, singular/plural merge
(Shirt/Shirts, Legging/Leggings, etc.), near-duplicate collapse and generic
suppression (e.g. generic Shirt hidden when Knit Shirt present), and compound
label split on `/`, `&`, `+` so `Sweater/Jacket` and `T-Shirt/Polo Shirt`
render as separate chips with distinct Noun Project icons. Supplemental trim/
packaging icons added (Poly Bag, Leggings, Lace, Hanger, Elastic, Athletic
Wear, Home Textile, Carton, Pajama, Back Board, Neck Board, Printed Label,
Tissue Paper, Hang Tag, Barcode; T-Shirt icon 4464232). Quick-deployed;
health OK.

29 Jun 2026 - Principal product icons integrated and deployed to VPS
`109.104.153.228`. Scope: local Noun Project "Principal products" apparel set
under `public/icons/products/` (plus supplemental packaging/trim/material icons
from Noun Project), `lib/product-icons.ts` slug resolver with RMG-aware label
normalisation, `components/supplier/product-icon.tsx` `<img>` rendering in
original icon colour, and principal-products strip typography aligned to
Overview tab body font in `app/globals.css`. Ops helpers:
`ops/download_product_icons.py`, `ops/audit_product_icons_offline.py`. Deleted
legacy `public/ApparelIcons/`. Quick-deployed to production; health OK.

25 Jun 2026 - Frontend design stabilization pass complete in working tree.
Presentation-only changes: solid nav chrome, iPhone-safe bottom navigation,
full-width hairline Discover cards, and cleanup of touched prototype
card/typography drift across marketing and app surfaces. `pnpm typecheck`
and `pnpm lint` pass; `pnpm build` compiled successfully but failed during
Windows standalone symlink copy with `EPERM`.

## Recent Maintenance
25 Jun 2026 - Context-token optimization complete. Daily agent boot now uses
`AGENTS.md`, `context/agent-brief.md`, `context/current-state.md`, and
`context/feature-specs/active.md`; the old append-only tracker is archived.

## Current Working Tree Warning
At the start of the token-optimization task, the repo already had a large uncommitted frontend/design diff plus deleted old Magic UI component files. Treat those as pre-existing user/session work unless explicitly told otherwise. Do not revert them while doing context cleanup.

## Daily Development Rules
- For micro edits, do not read the full historical tracker or all feature specs.
- Load only the core boot files plus the active spec and task-relevant source documents.
- Before asserting whether a file is modified, check `git status` or `git diff` against HEAD.
- For debugging, state the hypothesis and minimal change before editing when `context/current-issues.md` is involved.

## Historical Record
The old full tracker was archived at `context/archive/progress-tracker-archive-2026-06-25.md`. Use that archive for old shipped-spec details, architectural decisions, and production smoke history.
