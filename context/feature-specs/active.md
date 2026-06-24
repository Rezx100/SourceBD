# Active Feature Spec Pointer

This file keeps routine agent sessions from scanning every inactive feature spec.

## Active / Recent Spec
- Current frontend baseline: `context/feature-specs/spec-FE-SITEWIDE-design-conformance-pass.md`.
- Status: frontend design stabilization polish completed in the working tree
  on top of the sitewide light SaaS visual baseline.
- Normal daily frontend polish should treat this spec plus `context/frontend-design-spec.md` as the relevant design source of truth.

## Current Launch Work
- Phase 7 public beta launch prep remains the current phase.
- Operational follow-up: deploy to production VPS, apply required migrations, and monitor the 30-day zero P1/P2 incident window.

## Loading Rule
Only open another file under `context/feature-specs/` when the user names that spec, the code path clearly belongs to that old spec, or a regression requires historical acceptance criteria.
