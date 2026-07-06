# Active Feature Spec Pointer

This file keeps routine agent sessions from scanning every inactive feature spec.

## Active / Recent Spec
- Barikoi integration (6 Jul 2026, ad-hoc, founder-approved): Rupantor geocode
  cache in ETL + profile Locations map on app/marketing routes. Code complete;
  migration 0077 pending application from the VPS. See current-state.md →
  Recent Barikoi Integration.
- Most recent ad-hoc frontend work (30 Jun 2026): principal product chip
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
