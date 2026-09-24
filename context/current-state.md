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
- **Address premises merge — one row per premises on Locations** (11 Sep,
  landed on `development` 17 Sep via PR #159). Matcher-only in
  `lib/dedup-addresses.ts`; alternate spellings stay as "Also recorded as"
  pills. No raw-string, geocode-key, ETL or schema change. Evidence:
  `ops/plans/address-dedup-baseline.md`.
- **EPB evidence + HS codes on existing companies, independent of BGMEA/BKMEA
  flags** (REZ-113 follow-on, 15 Aug). Attach-only of 1,953 EPB matches and
  the HS backfill are APPLIED on production (2,492 EPB records on 2,472
  companies; 2,476 with HS codes; company count 10,922). Migration `0103`
  applied. **Frontend HS card is in the working tree, not on the server.**
  Evidence: `ops/plans/rez-113-epb-coverage-evidence.md`.
- **REZ-73 — Facilities section + labelled group figures on mother profiles**,
  on branch `rez-73-facilities-lean`. Lean rewrite: migration `0097_` + thin
  UI; SQL owns the roll-up; under 400 product lines.
- **Design-system rebuild** — spec `feature-specs/ds-rebuild-must-stay.md`.
  `design-rebuild` landed on `development` 18 Sep (`09ec96b`): tokens +
  `/dev/ds` gallery. Old pages are unstyled until rebuilt.
- **Buyer dashboard v3.2, REZ-A (the code port of the dashboard kit)** —
  DONE. `ACCEPTED_FOR_HUMAN_REVIEW` at cycle 21 (candidate `1ccb4bc`),
  merged to `development` via PR #161 (21 Sep). Dev/admin-only gallery at
  `/dev/ds`; no live route wired yet. Full history:
  `context/feature-specs/handoff-rez-a-cycle21.md`.
- **Buyer dashboard v3.2, REZ-B (results page)** — DEPLOYED, MIGRATION
  MISSING. Judge `ACCEPTED_FOR_HUMAN_REVIEW` at `4f6eff2`; landed on
  `development` via PR #164 (`cfbbf4a`), promoted to `main` via PR #165
  (`1780c2c`), deployed 24 Sep (run `36035938232`, `/api/health` confirms
  the commit). **Migration `0104` is NOT applied, so every signed-in search
  on the live site fails; the public `/discover` page is unaffected.**
  START HERE: `feature-specs/handoff-rez-b-live-migration.md` (the apply,
  the smoke run, the follow-up list). Loop history:
  `feature-specs/handoff-rez-b-cycle15.md` (24 Sep: state, decisions (all
  taken), loop, gates, what follows REZ-B) and `handoff-rez-b-deploy.md`
  (its §1–§2.3 are done). Cycles 10–14: §10–§11 of
  `handoff-rez-b-cycle10.md`. `/app/discover` uses the kit;
  `/app/products`, `/app/searches`, `/app/match` redirect added.
  `/app/saved` and `/app/compare` stay deferred.

## Founder rules still in force (one line each; detail in archive)
- EPB is a government register: show its evidence and HS codes whenever EPB has them, flagged or not. Never mint EPB-only suppliers. (15 Aug)
- Registry columns are canonical-latest-wins: the provider's current page is the truth and shows without a review round-trip. (3 Aug)
- BGMEA reg numbers display backed-only (option a). (5 Aug)
- `employees_total` = production workers = Male + Female; never sum BGMEA's three keys. (5 Aug, REZ-95)
- Numeric profile fields cannot be corrected downwards today (`greatest()` merge) — known defect, queued. (31 Jul)
- LLM adjudicator approved for the resolution review band only; Firecrawl `/v2/extract` not approved; resolution runs as a batch stage. (4 Aug)
- Dry-runs and snapshots never need approval; `--apply` always does. (AGENTS rule 15)
- Signed-out visitors see every supplier field except the company's contact details; contact info is sign-in gated. (23 Sep, REZ-B)
- Products counts leave out sanctioned suppliers, so each equals the Discover search it links to. (24 Sep, REZ-B)
- Discover's worker figure is the one the Workers sort uses (the supplier's own); the profile's figure, when different, is a second line whose words come only from the sites it sums. (24 Sep, REZ-B)
- No Help button until a help page exists. (24 Sep, REZ-B)

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
| `0104_discover_v32` | **NOT APPLIED** | REZ-B. Its code IS live (`main` `1780c2c`, deployed 24 Sep), so signed-in search is broken until this is applied. Verified 25 Sep: no `discover_v32%` functions, no `saved_searches` table, `discover_suppliers` still at 16 args. sha256 (CRLF) `4f95641b7c8a1956d61d9b866373c963ec7150690afa2a46ff8b96cbbc3e8b47`. |

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
