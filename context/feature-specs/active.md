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
  IN PROGRESS: REZ-B (results page) on branch `rez-b-results-page`
  (tip: `git log -1`). Migration `0104` drafted, not applied, and a hard
  dependency of the branch. Cycle 21 repaired at `4f6eff2`, gate green, no
  judge yet. To ship: `handoff-rez-b-deploy.md` (24 Sep). Loop history:
  `handoff-rez-b-cycle15.md`.
  Then C → D → H → G → E → F → I per §7.

## Queued
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
