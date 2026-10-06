# Active Feature Spec Pointer

Hard cap: 6 KB. This file holds only what is IN PROGRESS or QUEUED. When a
spec ships, move its entry to `context/archive/specs-shipped-2026.md` in the
same PR. Read once per session.

## In progress
- **Address premises merge — one row per premises on Locations** (11 Sep;
  PR #159 on `development` 17 Sep). Matcher-only in `lib/dedup-addresses.ts`,
  "Also recorded as" pills; raw strings, geocode keys, ETL and schema untouched.
- **EPB evidence + HS codes on existing companies** (REZ-113 follow-on).
  Data side APPLIED on production 15 Aug (migration `0103`, attach-only,
  HS backfill). Frontend HS card in working tree, not on server.
  Evidence: `ops/plans/rez-113-epb-coverage-evidence.md`.
- **REZ-73 — Facilities section + labelled group figures on mother profiles**,
  branch `rez-73-facilities-lean`. Migration `0097_` + thin UI; SQL owns the
  roll-up; under 400 product lines.
- **Design-system rebuild** — `feature-specs/ds-rebuild-must-stay.md`.
  IN PROGRESS on branch `design-rebuild` (18 Sep). Step 3 built: tokens
  (`lib/design/tokens.ts`) and the gallery at `/dev/ds`. No page rebuilds
  yet. Old design files are archived under `context/archive/old-design/`
  and stay off-limits to the builder; see the spec's section 1.

- **Buyer dashboard v3.2 + V2 AI** — `handoff-dashboard-v3.2-implementation.md`
  + `handoff-dashboard-v3.2-session-state.md` (founder answers).
  REZ-A (the code port of the dashboard kit): DONE.
  `ACCEPTED_FOR_HUMAN_REVIEW` cycle 21, merged to `development` PR #161
  (21 Sep). `handoff-rez-a-cycle21.md`.
  REZ-B (results page): DONE — `ACCEPTED_FOR_HUMAN_REVIEW` at `4f6eff2`,
  `development` PR #164 (`cfbbf4a`), `main` PR #165 (`1780c2c`), deployed
  24 Sep, migration `0104` applied 25 Sep. Loop history:
  `handoff-rez-b-cycle15.md`, `handoff-rez-b-deploy.md`,
  `handoff-rez-b-live-migration.md`.
  REZ-C (the company profile): IN PROGRESS on `rez-c-supplier-record`. The
  record sheet serves both the overlay (`?record=<slug>`) and the full page;
  the line sheet is `/app/suppliers/[slug]/lines/[hs]`; Sources, Locations,
  Facilities and RFQs added. Migration `0105` (one function,
  `supplier_contact_counts`) is NOT applied — dry run and the founder's
  command in `ops/plans/rez-c-0105-dry-run.md`. Thirteen audit cycles run, each
  repaired. Founder 27 Sep: ship cycle 13's candidate, file the rest.
  Hand-off: `handoff-rez-c-deploy.md`, then `handoff-rez-c-start.md`.
  Then D → H → G → E → F → I per §7.

- **Buyer dashboard redesign** — LIVE 27 Sep (`383a31c`); follow-ups in `current-state.md`.
  Enterprise pass (every secondary interface in the pane, ledger grid, quiet buttons, product base; migration 0106 not applied): branch `enterprise-buyer-app`, PR #191, hand-off `handoff-enterprise-buyer-app.md`, surface brief `.impeccable/surfaces/app-app-app.md`.
  One-viewport shell (the layout draws the shell once, the record beside
  the results): LIVE 27 Sep (`3f628b9`); hand-off `handoff-one-viewport-shell.md`.

- **Search-first buyer app** (28 Sep, founder's walkthrough video): LIVE 28 Sep (`d7e6c42`, PRs #193/#194); detail in `current-state.md`.
- **One-line names, fact icons and the video's leftovers** — slate since dropped
  for greys and near-black (founder, 29 Sep). BUILT,
  `handoff-dashboard-names-and-facts.md`: PRs #206 (PR 0, live bugs), #209 (A,
  names on one line), #210 (B, fact icons, certificate rows), #211 (C, card
  view), #212 (D, leftovers, sidebar foot). LIVE 29 Sep (`8e773eb`, #213);
  no slate LIVE 29 Sep (`7d46e2b`, #215/#216). Migration 0107 applied 29 Sep.

- **Buyer app on a phone** — BUILT, `handoff-dashboard-mobile.md`: M0–M5 on
  `development` (PRs #218, #220–#224); promotion to `main` next. Detail:
  `archive/specs-shipped-2026.md`.

- **Home page film** — `spec-home-film.md` (6 Oct). Behind `?film=1`. Slices 1 and 2a built: dark set, Pane
  family, thread, rail, planet, map, scenes 01 to 03. Next: 2b (the dated cells), then scenes 04 and 05.

## Queued
- **ETL freshness: check each fact as often as it changes** (6 Oct) —
  `spec-etl-freshness.md`. BUILT 6 Oct: S1 #325, C1 #328, C2+C4 #329, S2 #330,
  S3 #331, S4 #332, S5+C3 #333, S6 #334. Waiting on the founder: apply 0121–0125,
  C1's `--apply`, deploy, then enable schedules (`ops/plans/0121`…`0125-dry-run.md`).
- **SourceBD v4: new design system, Paper first, then build** (3 Oct).
  Hand-off: `handoff-ds-v4-paper-first.md`. Issues: `ui-issue-register-oct-2026.md`.
  Paper phases DONE (3 Oct). Build and go-live: `handoff-ds-v4-build.md`
  (Paper used as is, Tailwind 3.4, PRs into `ds-v4`, one switch). Migration
  0109 (onboarding answers) on `development`, NOT applied. Supersedes the visual direction (section 9)
  of `ds-rebuild-must-stay.md`; that file's sections 2–6 still bind.
- **Entity resolution core** — `spec-resolution-core.md` (4 Aug). Batch
  resolution stage over immutable `staging_records`; LLM adjudicator for the
  review band only; Firecrawl `/v2/extract` not approved. Prerequisite:
  Guardrails epic (REZ-57) merged; Extensions epic (REZ-58) applied.
- **Numeric fields cannot be corrected downwards** — `greatest()` merge in
  `ops/backfill_profile_columns.py`. Needs a most-recent-from-highest-trust
  rule and a one-off recompute. Not urgent.
- `spec-brand-primark-global-sourcing-map.md` — retarget `brand_primark` at
  the Global Sourcing Map. Safe to defer.

## Launch work
Phase 7 public beta launch prep: deploy to VPS, apply required migrations,
monitor the 30-day zero P1/P2 window.

## Loading rule
Open another file under `context/feature-specs/` only when the user names
that spec, the code path clearly belongs to it, or a regression needs its
acceptance criteria. Shipped entries: `context/archive/specs-shipped-2026.md`.
