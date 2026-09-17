# SourceBD - Current State

Compacted 18 Sep 2026. Hard cap: 16 KB (`lib/context-size.test.ts` fails
`npm test` when this file or `feature-specs/active.md` grows past its cap).
Read this file ONCE per session. Everything dated before 18 Sep 2026 lives
verbatim in `context/archive/state-2026-jun-aug.md` — grep it for a heading,
read that section only, never the whole file.

## Phase
Phase 7 - Public Beta launch prep.

## Current goal
Launch-readiness closeout: deploy to VPS `109.104.153.228`, apply required
migrations, run the 30-day zero P1/P2 Sentry incident window.

## In progress
- **EPB evidence + HS codes on existing companies, independent of BGMEA/BKMEA
  flags** (REZ-113 follow-on, 15 Aug). Attach-only of 1,953 EPB matches and
  the HS backfill are APPLIED on production (2,492 EPB records on 2,472
  companies; 2,476 with HS codes; company count 10,922). Migration `0103`
  applied. **Frontend HS card is in the working tree, not on the server.**
  Evidence: `ops/plans/rez-113-epb-coverage-evidence.md`.
- **REZ-73 — Facilities section + labelled group figures on mother profiles**,
  on branch `rez-73-facilities-lean`. Lean rewrite: migration `0097_` + thin
  UI; SQL owns the roll-up; under 400 product lines.
- **Design-system rebuild** — spec `feature-specs/ds-rebuild-must-stay.md`,
  awaiting founder answers to its four questions. No code yet.

## Founder rules still in force (one line each; detail in archive)
- EPB is a government register: show its evidence and HS codes whenever EPB has them, flagged or not. Never mint EPB-only suppliers. (15 Aug)
- Registry columns are canonical-latest-wins: the provider's current page is the truth and shows without a review round-trip. (3 Aug)
- BGMEA reg numbers display backed-only (option a). (5 Aug)
- `employees_total` = production workers = Male + Female; never sum BGMEA's three keys. (5 Aug, REZ-95)
- Numeric profile fields cannot be corrected downwards today (`greatest()` merge) — known defect, queued. (31 Jul)
- LLM adjudicator approved for the resolution review band only; Firecrawl `/v2/extract` not approved; resolution runs as a batch stage. (4 Aug)
- Dry-runs and snapshots never need approval; `--apply` always does. (AGENTS rule 15)

## Production migration ledger (authoritative)
Migration file headers are NOT live status. Check here or query the database.

| Migration | Applied to production | Notes |
| -- | -- | -- |
| `0091`–`0094` | 4–5 Aug 2026 | facility_of, publish guard, resolution_edges, field locks — all additive |
| `20260805_rez98_registry_ids_bgmea_backed_only` | 5 Aug 2026 | backed-only BGMEA display |
| `0095_buyer_supplier_profile_facility_documents` | not applied | REZ-93 |
| `0096_facility_parent_slug` | not applied | REZ-72 |
| `0097`–`0101` | see archive per issue | REZ-73 / REZ-114 / REZ-115 |
| `0102_admin_queue_release` | 14 Aug 2026 | 1,282 tickets released; 48 `needs_human` open |
| `0103_epb_detail_url_and_hscodes` | 15 Aug 2026 | EPB Open = exporter page |

Deploy-order hazard, twice hit: code that queries a new table with no
missing-table guard crashes every ETL run if shipped before its migration.
Apply the migration before or with the deploy.

## Queued (specified, not started)
- Entity resolution core — `feature-specs/spec-resolution-core.md`. Needs the Guardrails epic (REZ-57) merged first.
- Numeric downward-correction rule + one-off recompute.
- `spec-brand-primark-global-sourcing-map.md`.

## Shipped baseline
Phase 0 data moat; Phases 1–6 in codebase; FE-SITEWIDE conformance pass is the
current visual baseline; P1 deploy artefacts and Phase 7 beta surfaces landed.
Guardrails epic REZ-57 (A1–A8b) and Extensions B0/B0b/B2 complete — see archive.

## Working tree
Large uncommitted frontend diff (HS card + design conformance work) is
pre-existing founder work. Do not revert it during unrelated tasks. Rule 11
(clean tree at spec start) still applies to new specs.

## Where history lives
- `context/archive/state-2026-jun-aug.md` — every closeout Jun–Aug 2026 (51 sections).
- `context/archive/specs-shipped-2026.md` — every shipped spec entry.
- `context/archive/progress-tracker-archive-2026-06-25.md` — older.
