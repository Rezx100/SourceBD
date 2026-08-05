# Active Feature Spec Pointer

This file keeps routine agent sessions from scanning every inactive feature spec.

## Active / Recent Spec
- REPORT COMPLETE, awaiting decision (6 Aug 2026): **REZ-102 — the nine
  group-of-companies hosts + the backed-only identity gap** (Linear REZ-102,
  parent REZ-57). Branched from `development` @ `b436660`. **Read-only; REZ-90's
  `review` gate, the REZ-88 detector and REZ-99's three stranded numbers
  untouched.** `ops/report_group_of_companies.py` →
  `ops/plans/rez-102-group-of-companies-report.md`. The name-stem family
  reading fails against premises/switchboard evidence: **2
  group-corroborated / 3 refs-cohere-only / 4 no-link**, and the split does not
  follow the stems. **L. A. T Sportwear is the best-evidenced ref on
  `dk-knitwear`**, not a stray — DK's own BKMEA mailing address and rep mobile.
  `scraped_company_name` is **0 of 20,224** in production, so the gap is
  measured from the associate PDF + REZ-88 cache keyed by whole `source_ref`
  (bare-number keying collided the two registers and read 609 instead of
  **50**). 5,740 suppliers / 5,970 records, 1,816 nameable, **50 hold only
  records naming someone else**; the nine are a strict subset. Options costed
  fail-open 203 / fail-closed 4,357, **not chosen**. pytest 827. See
  `context/current-state.md` → "group-of-companies + backed-only identity gap".
- COMPLETE in the working tree (5 Aug 2026): **REZ-90 — revise the multi-ref
  plan** (Linear REZ-90, parent REZ-57). Branched from `development` @
  `6884e67`. **Plan only; no mutations; detector and its tests untouched.**
  New plan `ops/plans/rez-90-multi-ref-plan.md`; the rejected REZ-88 plan
  stays as evidence and as the merge rule's fixture. Merge is gated on root
  tokens rather than a similarity score (**50 / 4 / 6** over the rejected
  plan's 60 merges, the 6 exactly as named); keeper is the ref bearing the
  host's `company_name` (7 changed, **9 hosts match no ref at all**);
  `extension_base_name` is asked about the host as well as the excess, adding
  `attach-host-as-facility`. **Founder-approved 5 Aug with one required
  change, now shipped:** all 13 excess refs on the 9 no-host-match hosts are
  forced to `review` — a row whose identity is unsettled cannot produce a
  split. Classes: split 141 / attach-as-facility 11 / attach-host-as-facility
  2 / merge 54 / review 19 / unresolved 3. **130 new published rows** (11
  splits re-point to an existing supplier). No member pages re-fetched —
  names cached in `ops/plans/rez-90-ref-names.json`. REZ-98's 61 reproduce
  and are disjoint from the 199. The 9 hosts are filed as **REZ-102**
  (group-of-companies shape; BKMEA/RSC corroborates the row while its whole
  BGMEA set is foreign, which backed-only cannot see). **`--apply` stays
  closed.** pytest 804. See `context/current-state.md`
  → "multi-member-ref plan revision".
  Also open: **REZ-102** (the 9 group-of-companies hosts REZ-90 gated),
  **REZ-101** (RSC as a workforce floor, 802 suppliers),
  **REZ-100** (extract the duplicated projection rules), **REZ-99** (repair the
  three BGMEA residues), **REZ-96** (premise contradicted — re-scope first).
- COMPLETE in the working tree (5 Aug 2026): **REZ-89 — A8b; the BGMEA
  conflation repair max-merged numerics and ignored field locks** (Linear
  REZ-89, parent REZ-57). Branched from `development` @ `ae0d9e9`.
  `ops/repair_bgmea_conflations.py` numerics moved from max-merge to the A8
  rule (highest `source_tier`, then most recent `fetched_at`, then lower
  record id); `_numbers_from_record` now takes the whole record and returns
  `NumericCandidate`s so `max()` is unexpressible at the call sites; both
  `rest.patch("suppliers", ...)` bodies filter through `_locked_columns`
  (A6), `bgmea_reg_numbers` included; `employees_total` derived as
  `Employee Male + Employee Female` (REZ-95 parity — the old code max()'d
  `Management` in). **Repair NOT run against production; the `--apply` gate
  stays closed.** Did NOT touch `_compatible` / conflation detection
  (REZ-87), array-union, fill-only scalars, or REZ-98's backed-set recompute.
  **Open proposal: extract the projection helpers shared with
  `ops/backfill_profile_columns.py` into one module** — deliberately not
  implemented here. pytest 764 (749 baseline + 15). See
  `context/current-state.md` → "Repair script on the A8 rule + field locks".
- COMPLETE in the working tree (5 Aug 2026): **REZ-98 — BGMEA reg-number array
  provenance; option (a) backed-only display + append guards** (Linear REZ-98,
  parent REZ-57). `suppliers.bgmea_reg_numbers` is the only denormalised
  register in `v_supplier_registry_ids_direct`; all four writers union and none
  ever removes an element, so a number outlives the record that put it there.
  Entry mechanism = `_find_existing` contact-match attach + append, then
  `repair_bgmea_conflations.py` moving the record away while `_recompute_parent`
  rebuilt only numeric columns. Production: 5,801 suppliers showed 6,775
  numbers, **805 unbacked**, **664** multi-number (165/493/6) plus **55**
  single-number-unbacked; **all 805 are live records on another supplier — zero
  phantoms**. **Founder chose option (a).** Migration
  `20260805_rez98_registry_ids_bgmea_backed_only.sql` (**APPLIED to production
  5 Aug 2026**) — live view returns 6,775→5,970, 5,801→5,740, 664→**199**
  (exactly REZ-90's scope), matching the dry-run predicate row for row. Guards added to `_apply_source_specific` and
  `_recompute_parent`; scorer NOT changed. **SBI finding: all 61
  entirely-unbacked suppliers also carry a residual `BGMEA` source_tag and hold
  no BGMEA record, so repairing the array alone moves no score** — the tag is a
  second append-only residue; 5 of them also carry the +4 register bonus.
  Follow-up: the array + `source_tags` repair as its own snapshot/dry-run issue.
  See `context/current-state.md` → "BGMEA reg-number array provenance".
- COMPLETE (PR #104, 5 Aug 2026): **REZ-95 — REZ-91 regression; BGMEA's first
  employees column is not reliably "Management"** (Linear REZ-95, parent
  REZ-57). Both production applies done and verified. Step 1 rollback: 1,390
  rows restored, 10,912/10,912 match snapshot, 0 sibling movement
  (`ops/rez95_rollback_employees_total.sql`). Step 2 re-derive to `Employee Male
  + Employee Female`: **1,232 rows changed, 1,030 up, 202 down**, verified
  1,232/1,232 row for row against
  `public._rez95_production_workers_expected_20260805`, 0 collateral writes
  (`ops/rez95_apply_production_workers.sql`). Field renamed to **"Production
  workers"** on the hero card + Capacity tab with the "workers + staff" subtitle
  dropped, shipped in the same PR; the first-column figure is rendered nowhere.
  The evidence is **definitional** — BKMEA has no management key at all and its
  total equals male + female on 4,037/4,039 records; the band tables are
  supporting. Follow-ups: **REZ-96** (224 possibly-understated suppliers),
  **REZ-90** (`coast-to-coast` reads 710 not 3,450), **REZ-89** (extended to
  cover `repair_bgmea_conflations.py`). Did NOT touch REZ-94,
  `employees_male`/`female`, machines, capacity, or `etl/scrapers/bgmea_web.py`.
- ROLLED BACK BY REZ-95 (5 Aug 2026): **REZ-91 — employees_total sums BGMEA
  cohorts, not max** (Linear REZ-91, parent REZ-57). Merged PR #101 into
  `development`. Production apply matched dry-run **1,390/1,390** upward;
  sibling columns 0, but the `sum()` formula was wrong and the apply is
  reverted. Rollback:
  `public._rez91_employees_total_snapshot_20260805`. REZ-94 (BGMEA vs
  BKMEA workforce winner) is a separate PR — do not fold in.
- COMPLETE (merged PR #98, 5 Aug 2026): **REZ-87 — A7b Unify Python extension
  definition + Direction B patterns** (Linear REZ-87, parent REZ-57).
  Founder decision: Option 1 scoped to Python only — do NOT touch
  `public.rsc_extension_base_name` (indexes 0055/0056; B4 owns SQL).
  `extension_base_name` is Python SoT; `_compatible` delegates; Direction B
  patterns added; production fixture checked in. Unblocks REZ-90 + REZ-71.
  Sequential with REZ-89 (both touch `repair_bgmea_conflations.py`).
- COMPLETE (detector only, 5 Aug 2026): **REZ-88 — structural
  multi-member-ref detector** (Linear REZ-88, parent REZ-57). Merged PR #95
  (`a7695bc`). Classification plan **REJECTED** — do not execute
  `ops/plans/rez-88-multi-ref-plan.md`. Rework is REZ-90 (blocked by REZ-87).
  See `context/current-state.md` → "Guardrails Epic — multi-member-ref".
- COMPLETE in working tree / PR #93 open (5 Aug 2026): **REZ-68 — A8
  Replace greatest() in backfill_profile_columns with
  highest-trust-then-most-recent** (Linear REZ-68, parent REZ-57).
  `greatest()` + `>` guards removed; winner = highest `source_tier` then
  most recent `fetched_at`; `nullif(..., 0)` preserved. Dry-run posted on
  Linear (802 downward corrections; KNIT GUARD 150→36). Production
  `--apply` awaits founder approval. See `context/current-state.md` →
  "Guardrails Epic — profile numeric projection".
- COMPLETE in working tree (5 Aug 2026): **REZ-67 — A7 Extension-pattern
  records attach as facilities** (Linear REZ-67, parent REZ-57).
  `extension_base_name()` in `etl/core/normalize.py` (SQL 0014 port +
  production extras + multi-pass); upsert create path sets
  `facility_of` on exact slug/squash parent only (no fuzzy). Detector
  unreachable from this machine (pooler :6543 timeout); proof =
  code-only + pytest green. Drift list vs `_compatible` prefix guard
  posted on the Linear issue — not unified. See
  `context/current-state.md` → "Guardrails Epic — extension facility attach".
- COMPLETE in working tree (4 Aug 2026): **REZ-66 — A6 field-level
  manual-override lock** (Linear REZ-66, parent REZ-57). Migration
  `0094_supplier_field_locks` + ETL skip in `upsert.py` / lock
  predicates on all 13 UPDATEs in `ops/backfill_profile_columns.py`.
  Third write paths (`rsc_crosslink` / `contact_merge` /
  `address_norm`) listed on the issue and left alone. Not applied to
  production. See `context/current-state.md` → "Guardrails Epic —
  field locks".
- COMPLETE in working tree / PR #86 open (4 Aug 2026): **REZ-65 — A5
  Seed resolution_edges from founder rulings** (Linear REZ-65, parent
  REZ-57). `ops/seed_resolution_edges.py` dry-run by default; REST
  transport; encodes sarada≠sarada-fashions + corny≠crony;
  `sarda-knitwear` same-ruling reported as structurally satisfied
  (tombstoned). Production untouched until founder approves `--apply`.
  See `context/current-state.md` → "Guardrails Epic — resolution_edges
  seed".
- COMPLETE (merged PR #82 into `development`, 4 Aug 2026): **REZ-64 —
  A4 Make resolution_edges load-bearing** (Linear REZ-64, parent
  REZ-57). Positive `same`-edge canonicalisation in `_find_existing` (no
  pass reorder); live `different`-edge guards in merge / audit /
  split-detector ops only. Empty table remains a no-op. Unblocks A5.
  See `context/current-state.md` → "Guardrails Epic — resolution_edges
  matcher".
- COMPLETE in the working tree (4 Aug 2026): **REZ-63 — A3 Add
  resolution_edges table for sticky always-same / never-same pair
  rulings (schema only)** (Linear REZ-63, parent REZ-57). Migration
  `0093_resolution_edges.sql` only — order-independent pair CHECKs,
  live-pair partial unique index, read-path indexes, RLS with no
  permissive policies. No rows; no matcher / upsert change. Not applied
  to production. Unblocks A4 / A5 / C3. See `context/current-state.md`
  → "Guardrails Epic — resolution_edges schema".
- COMPLETE in the working tree (4 Aug 2026): **REZ-62 — A2 Make
  enforce_publish_tier() refuse to publish any row with facility_of set**
  (Linear REZ-62, parent REZ-57). Migration
  `0092_enforce_publish_tier_facility_guard.sql` only — silent coerce of
  `is_published` when `facility_of` is set; trigger widened to fire on
  `facility_of`; Tier 1–3 logic unchanged. Not applied to production.
  Unblocks B1. See `context/current-state.md` → "Guardrails Epic —
  facility publish refuse".
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
- **SPECIFIED, NOT STARTED (4 Aug 2026): entity resolution core** —
  `context/feature-specs/spec-resolution-core.md`. Replaces the
  `_find_existing` decision (five passes, first match wins, trigram capped at
  50) with a batch resolution stage: immutable `staging_records`, one shared
  `record_identity`, multi-key blocking, an explainable feature vector, and a
  three-band policy writing append-only `resolution_decisions`. Founder
  decisions recorded in the spec (4 Aug): LLM adjudicator approved for the
  **review band only** (never auto-merge, rationale persisted), Firecrawl
  `/v2/extract` **not** approved, resolution runs as a **batch stage** rather
  than inline. **Prerequisite: the Guardrails epic (Linear REZ-57) must merge
  first** — `resolution_edges` (A3) is the override table the policy reads,
  A5's rulings are the regression fixtures, `extension_base_name` (A7) is an
  identity input, and A9's invariant check is what makes cutover reversible.
  The Extensions epic (REZ-58) should also be applied so facility rows are not
  scored as candidate companies. Key measured findings: replay needs **zero
  re-scraping** (6,374 evidence documents, 100% raw-mirror coverage; 20,224
  source records all with fields); **BGMEA registration equality is not
  decisive** (1,196 numbers shared across published suppliers — Opex, Shamoli,
  Chorka) while BKMEA's is (4); shared address is a group/anti-merge signal,
  not identity (479 keys shared by 1,752 suppliers, largest cluster 69);
  `suppliers.lat/lng` is empty, coordinates live only in `address_geocodes`.
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
