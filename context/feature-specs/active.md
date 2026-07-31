# Active Feature Spec Pointer

This file keeps routine agent sessions from scanning every inactive feature spec.

## Active / Recent Spec
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
