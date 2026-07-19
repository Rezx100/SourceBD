# Active Feature Spec Pointer

This file keeps routine agent sessions from scanning every inactive feature spec.

## Active / Recent Spec
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
