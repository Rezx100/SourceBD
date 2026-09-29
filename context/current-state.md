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
- **Buyer dashboard v3.2, REZ-B (results page)** — DONE. Judge
  `ACCEPTED_FOR_HUMAN_REVIEW` at `4f6eff2`; `development` PR #164 (`cfbbf4a`),
  `main` PR #165 (`1780c2c`), deployed 24 Sep, migration `0104` applied 25 Sep.
  Loop history: `feature-specs/handoff-rez-b-cycle15.md`,
  `handoff-rez-b-deploy.md`, `handoff-rez-b-live-migration.md` (its §5 is the
  follow-up list; its first item, the stale "Selection arrives with the results
  work" line, is fixed in REZ-C's PR).
- **Buyer dashboard v3.2, REZ-C (the company profile)** — IN PROGRESS on
  branch `rez-c-supplier-record`. `/app/suppliers/[slug]` is now the dashboard
  kit's `SupplierSheet`; the same component opens over the results as
  `?record=<slug>` (a `next/link` client navigation, so the search and the bulk
  selection survive); `/app/suppliers/[slug]/lines/[hs]` is the line sheet, and
  a line opened from the overlay stays on the search as `&line=NNNN`. The sheet
  gained Sources, Locations, Facilities, RFQs and a Sanctions-matches section,
  so every tab leads somewhere.
  Migration `0105` adds ONE function, `supplier_contact_counts` — NOT APPLIED.
  Evidence and the founder's command: `ops/plans/rez-c-0105-dry-run.md`.
  **The closed loop is OPEN** — thirteen audit cycles run, each repaired.
  Cycle 7: the women/men split invented a sex from a family total (jk-fabrics)
  — now shown only against the record's own filed total. Cycle 8 (requirements
  critic accepted): cycle 7's place-word exemption let names through ("Abdul
  Bari (MD)") — a name beside a role is now cut back to the last house or plot
  number, so "Nur Mansion (MD)" loses its place (privacy over completeness);
  the population guard has a fixture test. Cycle 9 (adversarial critic
  accepted): a number after a name kept it ("Abdul Karim 2nd Floor (Owner)") —
  only the numbers opening the stretch stay now; Locations lists the filed
  address instead of saying "no address" under it (77 live records); the guard
  reviews every text the stripper cut a role word from. Cycle 10
  (requirements critic accepted): "(Md. Ali Tower)" read as a role cut places
  — a full stop ends a role's part only at its end; honorific cuts go to
  review; every guard check now has a fixture (it can run a stand-in
  stripper). Cycle 11 (requirements critic accepted): cycle 10's full-stop
  rule let "Abdul Karim (MD). Plot 5" through — a closed bracket or a
  non-honorific role ends the part again, only "- MD." is left to review; a
  failed search re-run under an open record no longer drops the buyer's bulk
  selection. Cycle 12 (requirements critic accepted): cycle 11 had copied a
  surviving mutant into the stripper as "redundant", reopening "- MD & CEO.,
  Dhaka" — restored and pinned (rule: a surviving mutant gets a test, never
  the source); the guard's cut splits dot-joined words; "160-GM." is grams;
  the provider key is tested across open/close. Cycle 13 (requirements critic
  accepted): 0105 counted one number with and without +880 as two phones (4
  live records) — fixed, dry run owed; the guard judges each run of cut words
  on its own; "GM"-as-grams only in products. Loop stopped here by the founder;
  Acceptance Judge next. Founder, 25 Sep: Facilities lists the buildings; product
  entries differing only in case or spacing merge. **27 Sep, founder: ship cycle 13's candidate and file the rest later** — START HERE: `feature-specs/handoff-rez-c-deploy.md`.
  **Ratified by the founder 25 Sep:** "Exporters of 6105 · N" (the count
  equals the search it opens); 0105's five omitted §4.3 items; and these
  deferrals: the Barikoi map on Locations
  (§3.3's "map stays") and §3.3's "Map pin" fact row, both of which need the
  old design system's `LocationsSection` that the rebuild spec puts off-limits;
  `/app/compare`, which §7 assigns to REZ-C and which stays deferred with
  `/app/saved`; the admin-only contact unlock the replaced page had; and
  §3.5's 10-minute `discover-facets` cache on `hs_catalogue()`, which
  `/app/products` (shipped by REZ-B) still does not have — every view pays a
  316 ms function scan. Scope: `feature-specs/handoff-rez-c-start.md`.

- **Buyer dashboard redesign (founder review, 27 Sep)** — LIVE: `main` `383a31c`, deployed 27 Sep (PRs #176–#180, front end only, no migration). Open: #181 (Products/Saved-searches headers, CI flake in next/font), "Quoted" shown for withdrawn-only quotes (needs quote status in `rfq_list`), RJSC logo (none published).
- **Buyer app craft pass (27 Sep, against the sourceready walkthrough)** — PR #185 (the record tray slides in, the topbar search suggests as you type, illustrated empty states, press feedback, palette on browser surfaces; six Higgsfield vector illustrations with provenance in `public/illustrations/`; `DESIGN.md` written from the kit). Auto-merge to `development`. Not built, named in `.impeccable/surfaces/app-app-app.md`: the sticky record name in the tray bar on scroll; the sidebar's icon-only collapse at 1024–1279.
- **One-viewport buyer shell (27 Sep)** — LIVE: `main` `3f628b9`, deployed 27 Sep (PR #188 to `development`, promotion PR #189, Deploy Production run 36319747764, rollback ref `e3c86f3`). the buyer layout draws `AppShell` once; every /app page hands it only its content region (`Page`, or the search's workbench); the record is a `RecordPane` beside the results (no dialog, no scrim, nothing inert), and `mode="page"` on the full record and line pages. Hand-off: `feature-specs/handoff-one-viewport-shell.md`. Not started: supplier portal + admin (old shell), `/app/help`, the plans modal, the rail's icon-only collapse.
- **Buyer app enterprise pass (27 Sep, branch `enterprise-buyer-app`)** — IN PROGRESS. Critique 19/40 (`.impeccable/critique/2026-09-27T14-19-11Z__app-app-app.md`); founder picked G1 ledger grid · B1 quiet buttons · S1 split pane. Every secondary interface opens in the pane beside its list (composer `?rfq=`, filters, save search, orders, RFQs, saved, a record inside a thread); the buyer's own product base at `/app/products` (HS catalogue moved to `/app/headings`); workspace, members and inquiry settings. Migration `0106` (products, RFQ message/questions/drafts, workspace settings) NOT applied — `ops/plans/0106-dry-run.md`. PR #191 open with auto-merge (28 Sep); apply 0106 before the deploy. Hand-off: `context/feature-specs/handoff-enterprise-buyer-app.md`.
- **Search-first buyer app (28 Sep, founder walkthrough video)** — LIVE: PR #193 → `main` `d7e6c42` (PR #194), deployed 28 Sep, no migration; rollback ref `60c4879`. `/app` is the search landing (`app/(app)/app/(search)`, `components/dashboard/search-landing.tsx`, templates in `lib/dashboard/search-templates.ts`); Home's alerts and activity moved to Saved (`saved-desk.tsx`); typeahead rebuilt on `lib/search-suggest.ts` (words typed, HS categories, certs, places, then suppliers by name; a company opens beside the results); row actions always drawn in their own column (`RESULTS_COLUMNS`), type under the name, cert pills, one `WorkersCell` on search and Saved; `.skel` styles live in `app/ds.css`; search read through a 2-min anon cache (`lib/dashboard/search-cache.ts`) and the record streamed in a keyed `Suspense`; record facts grouped, registers listed, dashed pending mark, contact strip. Guards: `components/dashboard/search-first.test.ts`, `lib/search-suggest.test.ts`; route tests render with `prerenderToNodeStream`.
- **Dashboard fixes from the founder's 29 Sep video** — COMPLETE, live `79a59f8` (PRs #197–#202, #207); migration `0107` applied 29 Sep; detail in `archive/state-2026-sep.md`.
- **One-line names, fact icons, the video's leftovers (29 Sep)** — BUILT, on `main` via #213 (deploy waiting), `feature-specs/handoff-dashboard-names-and-facts.md`: PR 0 #206 (z-index tokens, guard in `tokens.test.ts`; on `main`, deploy waiting), A #209 (`splitQualifier`, `OneLine`), B #210 (`factIcon`, certificate rows), C #211 (card rebuilt, `resultsView`), D #212 (tappable reasons, sidebar foot, tour, folded filters). Harness: `.impeccable/preview/build-names30.cjs`. Not done: Linear issues (not connected); record tabs do not stick below 768px.

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
| `0104_discover_v32` | 25 Sep 2026 | REZ-B. Applied after its code was already live (`main` `1780c2c`, deployed 24 Sep) — signed-in search was down in between. Dry-run clean first (one transaction, rolled back). Verified after: 9 `discover_v32%` functions, `saved_searches` with 4 RLS policies, `discover_suppliers` at 25 args. sha256 (CRLF) `4f95641b7c8a1956d61d9b866373c963ec7150690afa2a46ff8b96cbbc3e8b47`. |
| `0105_supplier_record_v32` | **not applied** | REZ-C. One function, `supplier_contact_counts(text)` — counts of a published record's contact details, never a value; `anon` explicitly revoked. Deliberately does NOT rewrite `buyer_supplier_profile`: production's copy is ahead of this repo (it emits `'fetched_at', rr.fetched_at` on rsc rows, which no migration here adds), so a `create or replace` from the repo would delete that key. sha256 (CRLF) `b6fd758a08f63f8b7abc9a65479c819cf47d30e1a4bb151988de44e43207b465` (26 Sep: one number with and without +880 counts once). **Dry run NOT re-run at this sha** (pooler down) — re-run before applying; the last clean run was at `4b2dfb8c…` on 25 Sep. Population guard for the contact stripper: `ops/verify_contact_text.py`. Evidence: `ops/plans/rez-c-0105-dry-run.md`. |
| `0107_buyer_supplier_profile_one_supplier` | 29 Sep 2026 | 29 Sep video. Two FROM clauses: the profile's two views filtered on the one id instead of joined. Applied through the Supabase MCP on the founder's go-ahead (the pooler times out here), gated on the text's md5 and the live base (`63ee7ea0…`); dry run 45 records identical, 967 → 171 ms median; live md5 now `8648d817…`, recorded `20260929083008`. Evidence, rollback: `ops/plans/0107-profile-one-supplier.md`. |

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
