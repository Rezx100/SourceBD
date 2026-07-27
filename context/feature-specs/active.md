# Active Feature Spec Pointer

This file keeps routine agent sessions from scanning every inactive feature spec.

## Active / Recent Spec
- COMPLETE (28 Jul 2026): REZ-30 — Supplier map enrichment pack (12 points): taller inline map
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

## Current Launch Work
- Phase 7 public beta launch prep remains the current phase.
- Operational follow-up: deploy to production VPS, apply required migrations, and monitor the 30-day zero P1/P2 incident window.

## Loading Rule
Only open another file under `context/feature-specs/` when the user names that spec, the code path clearly belongs to that old spec, or a regression requires historical acceptance criteria.
