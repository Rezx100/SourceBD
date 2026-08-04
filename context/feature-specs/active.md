# Active Feature Spec Pointer

This file keeps routine agent sessions from scanning every inactive feature spec.

## Active / Recent Spec
- COMPLETE in the working tree (4 Aug 2026): **REZ-61 — A1 Add
  suppliers.facility_of column, FK and index (schema only)** (Linear
  REZ-61, parent REZ-57). Migration `0091_supplier_facility_of.sql` only.
  Not applied to production. Unblocks A2 / A7 / B1. See
  `context/current-state.md` → "Guardrails Epic — facility_of schema".
- FULLY COMPLETE IN PRODUCTION (3 Aug 2026): **REZ-56 — Cross-register
  coverage audit + split-evidence duplicate repair**
  (`context/feature-specs/spec-cross-register-audit.md`, Linear REZ-56).
  Merged via PRs #70-72 (main `ed84bef`), deployed to VPS, then the
  founder-reviewed apply merged **all 37 certain merge groups** in one
  transaction (10,213 → 10,176 published suppliers; 49 records / 168 claims /
  33 certs re-pointed, collision classes deduped per spec). Post-runbook run
  in order: profile-column backfill, registry-display repair (0 changes),
  identity backfill (521 updates; 6 slug-blocked pairs with unpublished
  holders remain as follow-up candidates), re-audit (**0 certain groups**),
  detector (**OK**). Smoke: FOUR H unified across six registers; RSC
  extension rows untouched; 0 orphan claims. **Follow-ups shipped 4 Aug
  2026** (development, PR pending): Sarada Knit Wear seeded merge applied in
  production (10,176 → 10,175; detector OK); founder decisions B/C/D/E
  landed — audit-v2 name-variant REPORT class (`variant_pairs`, certain-
  review band = founder's seeded-merge review list, never auto-merge),
  matcher Pass 1.5 squash-equality (no migration), EPB RMG-category
  enumeration with attach-only `ScrapedRecord.enrich_only` records, and
  `--pair` extended to unpublished losers (unblocks the 6 slug-blocked
  identity-backfill pairs). pytest 591, ruff clean, no schema migration.
  Residual: Linear REZ-56 closeout comment unposted (Linear MCP unavailable
  3 + 4 Aug). See `context/current-state.md` → "Cross-Register Audit +
  Split-Evidence Duplicate Repair".
- FULLY COMPLETE IN PRODUCTION (2 Aug 2026): **REZ-36 Spec A — ETL
  change-skip, BKMEA source_records split, bkmea_detail pre-fetch gate**
  (`context/feature-specs/spec-etl-change-skip.md`). Merged via PRs #64 + #66
  (main `948e0b6`), deployed to VPS `109.104.153.228` (`e482bd1`, both tags
  rebuilt, rollback ref `8e9af23`). Production: rekey applied (2,628 rekeys,
  152 re-listing duplicates merged, 0 collisions); `bkmea_web` 72% hash-skip
  (2,017/2,783), 3 credits; `bkmea_detail` acceptance run **seen=16,
  upserted=0, skipped=16, 16 credits** — gate cut targets 2,636 → 16.
  Follow-up in the same session: `supersede_claims` same-scraper
  reclassification fix + backlog repair (422 claims → `superseded`; worklist
  now 20 genuine cross-scraper items / 10 suppliers). Residual for Spec B:
  ~16 multi-list-row members re-target every run but always hash-skip (~16
  credits). `--full-refresh` proof run declined by founder (credit cost).
  NOT this spec: migration 0089 / REZ-32 backfill. See
  `context/current-state.md` → "ETL Change-Skip + BKMEA source_records
  Split".
- FULLY COMPLETE IN PRODUCTION (2 Aug 2026): **REZ-33 — restore SBI: re-spec
  Pillar 2 on real RSC progress data + schedulable nightly recompute**
  (Linear, P0). Pillar 2 re-spec'd on the one real signal (founder-approved
  ladder): base 5 for an ACTIVE `rsc_remediation` row + progress ladder
  >=95→25 / >=80→20 / >=60→14 / >=40→8 / >0→3, cap 30; no active row → 0.
  `_formula_version` 1→2 invalidated every stored inputs_hash, so the first
  plain run recomputed the world. `SbiRecomputeJob` registered in `JOBS`
  (never `SCRAPERS`), the TS catalog (+ transport map), and the SQL
  allow-list (migration 0090, applied + verified: 29 codes). Merged via PR
  #62 (main `645dc19`), deployed to VPS `109.104.153.228` (manual SSH path;
  BOTH web + etl tags rebuilt; rollback ref `e8b1b3f`). Production
  verification: first recompute seen=10,284 / upserted=10,284 /
  skipped_hash=0; pillar2 now 7 distinct values, non-zero exactly 1,615 (=
  active RSC rows), zero unscored suppliers (was 98); spot-checks 100%→30
  and inactive→0 hold; sanctions-zero trigger intact. Nightly
  `etl_schedules` row (1440 min) live; first queued run is the idempotency
  proof (upserted=0, skipped_hash=10,284, 4s, `next_run_at` +24h). Smoke:
  `/api/health` 200 at `645dc19`, `/discover` payload carries no
  pillar/total fields. Next-day check owed: first unattended nightly cycle
  (3 Aug ~01:02 UTC). See `context/current-state.md` → "SBI Recompute
  Restored + Pillar 2 Re-spec".
- FULLY COMPLETE IN PRODUCTION (2 Aug 2026): **REZ-32 — screen newly upserted
  suppliers against stored sanctions entries** (Linear, P0; moved to Done).
  One-directional
  screening gap closed: `_pair_matches` in `etl/core/sanctions.py` is the one
  pair-level predicate for BOTH directions (screenable both sides + >=2 shared
  significant tokens + token_sort_ratio >= 95 + `_names_compatible` — the
  order-sensitive guard is what rejects COTTON FAIR / FAIR COTTON at 100 and
  A. B. / B. A. KNITWEAR INDUSTRIES at 95.5); supplier-side
  `screen_supplier_against_entries` runs INSIDE the
  `upsert_supplier_with_source` transaction so a failure rolls the record back
  (`BaseScraper.run` contains it as `records_skipped`); migration 0089 adds
  the partial unique index `(supplier_id, list, coalesce(list_entry_ref,''))
  where active` so `on conflict do nothing` finally has something to conflict
  on. 23 new tests in `etl/tests/test_sanctions_screening.py`; pytest 471
  passed + same 1 pre-existing failure; ruff / tsc clean; npm test 336/336.
  Session 2 (2 Aug 2026): 0089 applied to production (`20260801234013`,
  definition verified in `pg_indexes`); VPS deployed `e8b1b3f` via manual SSH
  (GitHub Actions still broken), BOTH web + etl images built, smoke green
  (rollback ref `42da527`); backfill `ops/sanctions_rescreen.py` run
  supervised in tmux — 13,366 entries, **0 new matches**, all 10,284
  suppliers incl. the 67 never-screened verified clean; end-to-end proof in a
  rolled-back transaction on real Postgres (trigger flips `is_sanctioned` +
  zeroes SBI; duplicate insert blocked by `idx_sanc_screening_unique_active`;
  zero synthetic rows persisted). VPS since moved to `8e9af23` (REZ-36),
  which carries REZ-32; `e8b1b3f` is in `main` via PRs #63/#64.
  architecture.md line 68's false Inngest claim rewritten; lines 24/33
  Inngest tool mentions left as noted doc debt. See
  `context/current-state.md` → "Sanctions Screening Both Directions".
- FULLY COMPLETE IN PRODUCTION (2 Aug 2026): **REZ-31 — zombie ETL run/job
  reaper + universal heartbeats + stale-job manual retry/cancel**.
  `reap_stale()` runs at the top of every
  `run_queue()` in one transaction and raises (so the cron's Slack alert
  fires): stale `running` jobs fail on `coalesce(heartbeat_at, started_at,
  requested_at)` older than `ETL_REAP_STALE_HOURS` (default 3) with a
  `Reaped:` event row; orphaned `running` runs fail on age, exempted while a
  pending/running job references them (a queue-backed run's liveness is its
  job's heartbeat). Heartbeats are now universal — claim sets
  `heartbeat_at`, verify/refresh jobs emit progress mid-run — which is the
  reaper's safety precondition. Skip-slide fixed: a skipped schedule no
  longer advances `next_run_at`, so blocked schedules catch up instead of
  dropping intervals (the weekly `rsc` had silently eaten 31 Jul).
  Resurrection guard: `_mark_success`/`_mark_failed` only touch rows still
  `running`. First production cron pass reaped exactly the audited zombies
  (2 jobs + 7 runs); zero `running` stragglers since. Follow-up in the same
  session: migration 0088 lets admins retry/cancel a `running` job only
  under the reaper's own staleness predicate (a live job heartbeats, so the
  guard can never double-fire a real run), surfaced on `/admin/sources` as
  "Retry (stale)" / "Cancel (stale)"; verified in production in a
  rolled-back transaction (fresh raises, 4h-stale succeeds, anon gets
  `admin only`). Linear moved to Done; pending-job alerting continues as
  REZ-39. PR #59 (development→main) open, unmerged; VPS on `development`
  `42da527`. See
  `context/current-state.md` → "ETL Zombie Reaper + Universal Heartbeats".
- PHASES A–C COMPLETE IN PRODUCTION (2 Aug 2026): **REZ-34 — activate the
  evidence verification tier**
  (`context/feature-specs/spec-evidence-verification-tier-activation.md`), REZ-42
  riding along. 15 monitors registered (non-NULL ids, corrected webhook URL,
  upstream agrees); webhook path proven end-to-end (test delivery landed,
  drained, requeued, monitor health columns set; 401 on wrong secret); smoke
  verify 50/50 live at 1 credit; both maintenance jobs scheduled daily and
  their first unattended cycles succeeded. The runbook caught one real defect
  Phase A's mocked tests could not (`_monitor_scraper_code`
  `IndeterminateDatatype`; fixed `2b76046`). **VPS tracks `development`
  (`2b76046`); `origin/main` lacks the inbox fix — merge the development→main
  PR before any `--ref=main` deploy.** Phase D remains: contradicted-claims
  triage (881 unreviewed) as a standing routine. See `context/current-state.md`
  → "Evidence Verification Tier Activation".
- COMPLETE in the working tree (31 Jul 2026): supplier identity guards + evidence status
  split. `/admin/evidence` reported 11,320 items needing review; none had failed a check
  (`evidence_verifications` was empty) and every one had a newer active claim, because
  `supersede_claims` wrote `stale` — the verifier's drift word — for the routine re-scrape
  case. `bkmea_detail` alone added ~5,800 per run, unbounded. Migration 0087 adds a
  `superseded` status outside every needs-review filter, but *classifies* rather than
  assumes: same `url_hash` or same value is superseded and hidden, a different URL with a
  different value is `contradicted` and stays visible. That distinction is load-bearing —
  it is what surfaces the second defect found underneath: 82 suppliers holding BKMEA member
  records for genuinely different companies, merged by `_find_existing` Pass 2/3 on a shared
  group mailbox or switchboard with no name check, plus Pass 4's `token_sort_ratio` scoring
  COTTON FAIR / FAIR COTTON at 100 and H. R / G. R TEXTILE MILLS at 94. Contact matches now
  need a name floor of 85; fuzzy matches need an order-sensitive ratio and matching leading
  initials. 23 new tests pin both directions against the real observed pairs. Python 414
  passed (1 pre-existing failure: `bgmea_buying_house` missing from the SQL allow-list, at
  HEAD), `npm test` 161/161, typecheck clean, lint clean apart from pre-existing warnings.
  **Not applied to production: migration 0087, and `ops/unmerge_bkmea_suppliers.py`
  (dry-run by default) which splits the 82 merged suppliers and needs
  `backfill_profile_columns.py` re-run afterwards.** See `context/current-state.md` →
  "Supplier Identity + Evidence Status Split".
- COMPLETE in the working tree (31 Jul 2026): Barikoi geocode cache-key leak closed —
  `barikoi_geocode` keyed its cache through the place lexicon but decided what was
  still pending with raw SQL that did not, so every address the lexicon rewrites was
  re-geocoded at 2 Rupantor calls on every run, silently (`on conflict do nothing`
  absorbed the duplicate, the run counted it resolved). The pending decision moved
  out of SQL into the pure `select_pending`, making `normalize_key` the only thing
  that computes a key. Fixing it surfaced a worse, separate consequence: rows
  geocoded *before* REZ-28 are raw-keyed, and the app's read path applies the
  lexicon, so suppliers in renamed districts have had no map pin since 28 Jul. The
  fix self-heals them via a bounded one-time re-geocode. 12 new tests, no database
  needed. See `context/feature-specs/spec-barikoi-geocode-cache-key-leak.md`.
- COMPLETE in the working tree (29 Jul 2026): Firecrawl acquisition layer with verified
  per-field provenance, from the Cursor plan `firecrawl_acquisition_layer`. Acquisition split
  out of the 27 scrapers into `etl/acquire/` (Firecrawl / Direct / Local adapters); parsing and
  persistence unchanged, so Hard Rule 5 field fidelity stays in our own code. Every stored fact
  now carries a URL, a locator and a verbatim excerpt (`etl/evidence/`, migration 0084), which
  makes "the link still contains this fact" machine-checkable rather than assumed. Verification
  is two-tier: Firecrawl `/v2/monitor` on the index pages each source declares, webhooking
  `app/api/v1/webhooks/firecrawl`, plus a `verify-evidence` job for the long tail. Playwright is
  retired everywhere except `brand_ms`. Admin surface: transport badges and evidence health on
  `/admin/sources`, new `/admin/evidence` worklist, `verify_evidence` and `refresh_monitors`
  registered in all three synced places. Python 309/309, `npm test` 159/159, typecheck and lint
  clean apart from pre-existing warnings. **Migrations 0084 + 0085 applied to production
  30 Jul 2026 and verified (tables, RLS, grants, allow-list, and anon refusal all checked).
  Still not done: the new `Dockerfile` base image is unbuilt (no local Docker) and no
  monitors are registered.** See `context/current-state.md` → "Firecrawl Acquisition Layer
  + Verified Provenance" for the decisions worth remembering.
- Prior (28 Jul 2026): REZ-30 — Supplier map enrichment pack (12 points): taller inline map
  and fullscreen removal, inter-site haversine distances, pins differentiated by address kind +
  legend, on-map site switcher, curated-landmark context chips, optional nearby-SourceBD-suppliers
  layer, near-duplicate pin collision handling, geocode confidence cue, scale bar + attribution,
  `?site=` permalink, GeoJSON pin export, and arrow-key site cycling. Zero live Barikoi/Rupantor
  geocode calls — cache + our own catalog only. Touch: `components/supplier/locations-map.tsx`
  (rewrite), `locations-section.tsx`, `profile-overview-tab.tsx`, new `lib/geo.ts`,
  `lib/bd-landmarks.ts`, `lib/nearby-suppliers.ts`, `app/api/suppliers/nearby/route.ts`,
  `lib/geo.test.ts`; `lib/dedup-addresses.ts` gained server-safe `CATEGORY_BY_GROUP`;
  `lib/barikoi.ts` now surfaces cached `confidence_pct` / `address_status`.
  `pnpm test` 143/143, `pnpm typecheck` + `pnpm lint` pass (same pre-existing warnings
  outside this work). See `context/current-state.md` → "Recent Map UX" for the three
  silent-failure bugs this spec uncovered.
- Prior (28 Jul 2026): REZ-29 — Supplier map UX: satellite/street toggle, campus zoom (16),
  per-style maxZoom (19 sat / 20 street), one overview map for multi-site suppliers with fitBounds
  + click-to-focus flyTo, fullscreen mode (Esc/✕), copy lat/lng + Open in Google Maps per-pin
  popup, address list ↔ map highlight via shared `selectedIndex` in new `LocationsSection` client
  component. Touch: `components/supplier/locations-map.tsx` (rewrite),
  `components/supplier/locations-section.tsx` (new),
  `components/supplier/profile-overview-tab.tsx` (uses LocationsSection, removes inline AddressRow).
  `pnpm typecheck` + `pnpm lint` pass (same pre-existing warnings outside this work).
- Prior (28 Jul 2026): REZ-28 — Platform address canonicalization:
  shared BD place lexicon (TS + Python lockstep) merges 50+ approved spelling
  variants of Bangladesh place names for address dedup and geocode cache keys.
  `lib/bd-place-lexicon.ts` → `applyPlaceLexicon()`; mirrors in
  `etl/lib/bd_place_lexicon.py` → `apply_place_lexicon()`. Wired into
  `normaliseAddressKey` in `dedup-addresses.ts` (replaces inline
  TRANSLITERATION_PAIRS), `normalizeAddressKey` in `barikoi.ts`, and
  `normalize_key` in `etl/jobs/barikoi_geocode.py`. Tests: 108 TS (pnpm
  test) + 74 Python (pytest) all pass; `pnpm typecheck` + `pnpm lint` +
  `python -m py_compile` pass. Zero Barikoi API calls; raw source strings
  unchanged.
- Prior (27 Jul 2026): REZ-27 — Barikoi satellite maps at building zoom,
  one map per unique address on supplier profile Locations. Implemented in
  `components/supplier/locations-map.tsx`: satellite style
  (`barikoi_satellite`), zoom 18, `AddressMap` per marker when 2+ addresses.
  `pnpm typecheck` + `pnpm lint` pass.
- Prior (23 Jul 2026, latest): homepage promotion — the approved
  /home-demo composition IS now production `/` (old homepage SEO metadata
  + JSON-LD retained), `/home-demo` permanently redirects to `/`, and the
  scenic skyline footer is the global `MarketingFooter` on every
  (marketing) page. Includes Bugbot fixes: `#sources` / `#how-we-verify`
  anchors on `/`, and evidence-tab auto-advance pausing under visible
  keyboard focus. See current-state.md → Recent Frontend Polish.
- Prior (23 Jul 2026): /home-demo hero
  dashboard brought to life as `HeroDashboardDemo`
  (`components/marketing/home/hero-dashboard-demo.tsx`) — a ~22.6s looping
  "Find matches" story (Smart Match wizard 3 steps → real 405-match results
  → follow top supplier → dashboard counts tick 10→11) using the
  buyer-workflow bento's event-mark clock/cursor language. The match page
  is a hero-scaled replica of the REAL /app/match wizard + DiscoverResultCard
  results (founder correction: no invented search UI). See current-state.md
  → Recent Frontend Polish.
- Prior (23 Jul 2026): demo-only scenic
  footer on /home-demo (`components/marketing/home/demo-footer.tsx`) —
  forest-green RMG industrial-skyline artwork + blended "SourceBD"
  watermark; shared MarketingFooter hidden on that route only. See
  current-state.md → Recent Frontend Polish.
- Prior (23 Jul 2026): buyer-workflow
  choreography pass on `BuyerWorkflowBento` from the founder's fourth
  review — chapter pre-wake (next card un-dims before its chapter),
  longer ease-in-out on state changes, extended shortlist outro,
  Delivered→Seen receipt, staggered per-card loop reset. Timing/easing
  only; no visual redesign. See current-state.md → Recent Frontend Polish.
- Prior (23 Jul 2026): buyer-workflow
  motion-quality pass on `BuyerWorkflowBento` from the founder's third
  (video) review — chapter overlaps, Send→success causal chain, compliance
  update emphasis, MSA state ladder, ambient life on settled cards. Timing
  only; no visual redesign. See current-state.md → Recent Frontend Polish.
- Prior (23 Jul 2026, later): /home-demo section 4
  buyer-workflow bento rebuilt as `BuyerWorkflowBento`
  (`components/marketing/home/buyer-workflow-bento.tsx`) from the founder's
  enterprise motion spec — one continuous 12s event-driven sourcing story
  with a DOM-measured paper-plane handoff, ambient micro-motion, and an
  invisible loop reset. Replaces `CapabilityFeatureGrid` on the demo page
  only. See current-state.md → Recent Frontend Polish.
- Prior ad-hoc frontend work (23 Jul 2026): /home-demo section 5
  `IntelligenceEngineStage` rebuilt to match the founder's reference mockup
  (solid gray staggered-elbow traces, traveling green packet dashes, card
  edge ports, double-frame engine card, dark database emblem, 4-metric
  stats bar). Demo page only. See current-state.md → Recent Frontend Polish.
- Completed in the working tree (20 Jul 2026): `/home-demo` mobile responsive
  polish — phone-first hero/product preview, section density and wrapping,
  touch/accessibility semantics, reduced-motion behavior, and off-screen
  animation pausing. Demo page only; production `/` remains untouched.
  Typecheck/lint pass; runtime viewport smoke is pending on a machine with
  enough free memory for the Windows Next.js cold compile.
- Most recent ad-hoc frontend work (19 Jul 2026): /home-demo polish —
  section reorder (VerifiedRecordSteps before closing CTA),
  ExploreIndexTeaser removed from page, evidence stage light stone wash
  + hover no longer pauses auto-advance, buyer-workflow FrameHairlines
  clip fix, checklist milestone shadow/Due cleanup. Demo page only.
  Boot from `context/feature-specs/brief-home-demo-polish.md` if
  continuing polish. See `context/current-state.md` → Recent Frontend
  Polish.
- /home-demo audit remediation (15 Jul 2026, ad-hoc): founder-selected
  38-item fix list from the homepage UI/UX + data-moat audit — section
  reorder, new RSC safety / brand-disclosure / explore-index / closing-CTA
  sections with live RPC counts, shared Kicker, container + rhythm
  unification, contrast and a11y fixes. Demo page only; production `/`
  untouched. Brand-strip wording pending legal sign-off. See
  current-state.md → Recent Frontend Polish.
- Barikoi integration (6 Jul 2026, ad-hoc, founder-approved): Rupantor geocode
  cache in ETL + profile Locations map on app/marketing routes. Code complete;
  migration 0077 pending application from the VPS. See current-state.md →
  Recent Barikoi Integration.
- Previous ad-hoc frontend work (30 Jun 2026): principal product chip
  dedup, spelling correction, singular/plural merge, and compound-label split
  (`Sweater/Jacket` → separate chips) in `lib/product-icons.ts` — deployed via
  quick deploy. See `context/current-state.md` → Recent Frontend Polish.
- Previous ad-hoc frontend work (29 Jun 2026): principal product icons on
  supplier profiles — local Noun Project icon set, slug resolver in
  `lib/product-icons.ts`, deployed via quick deploy.
- Previous completed implementation: Admin scraper operations from the accepted
  Cursor plan `Admin Scraper Ops` (26 Jun 2026).
- Frontend visual baseline remains
  `context/feature-specs/spec-FE-SITEWIDE-design-conformance-pass.md`
  plus `context/frontend-design-spec.md`.

## Queued Specs
- **Numeric profile fields cannot be corrected downwards.**
  `ops/backfill_profile_columns.py` merges numeric columns with `greatest()`, so a
  supplier's `machines_sewing`, `employees_total` and capacity figures can only ever
  rise. When BKMEA corrected KNIT GUARD APPARELS from 150 sewing machines to 36, the
  profile kept 150. The rule was chosen to survive a source publishing a zero, and
  `_to_int_nonzero` in `bkmea_detail.py` already discards zeros, so `greatest()` is
  now guarding against a case that no longer reaches it — while silently blocking
  every legitimate correction. Raised 31 Jul 2026 during the /admin/evidence
  investigation. Needs a rule that prefers the most recently confirmed value from the
  highest-trust source rather than the largest one, and a one-off recompute
  afterwards. Not urgent, but it means published capacity figures currently read as
  high-water marks rather than current facts.
- `spec-brand-primark-global-sourcing-map.md` — retarget `brand_primark` from the
  Modern Slavery Statement (narrative prose, parses to zero rows) at Primark's
  Global Sourcing Map, which is the real factory-level list. Raised 29 Jul 2026 by
  the transport parity sweep. Safe to defer: the source now fails loudly rather
  than reporting an empty supplier list.

## Current Launch Work
- Phase 7 public beta launch prep remains the current phase.
- Operational follow-up: deploy to production VPS, apply required migrations, and monitor the 30-day zero P1/P2 incident window.

## Loading Rule
Only open another file under `context/feature-specs/` when the user names that spec, the code path clearly belongs to that old spec, or a regression requires historical acceptance criteria.
