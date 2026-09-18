# design/

Design-side artefacts for the SourceBD rebuild. Nothing here is imported by the app; the code port is a separate task (see `context/feature-specs/handoff-ds-element-redesign.md` §6).

- **Source of truth:** the Design System artifact — https://claude.ai/artifact/3n9MkVaXgFaFokziwhmP5o (v3 tokens, marketing components, and from 18 Sep the buyer dashboard v3.2: ResultsList, ResultsTable, SupplierSheet, ProductSheet, RFQComposer, RFQList — each a full screen in the app shell at 1440).
- `reference/sourceready/` — the three sourceready.com screenshots the dashboard is built against (card view, card view scrolled, table view). Start here.
- `reference/sourceready/crawl-2026-09-18.md` — what app.sourceready.com's dashboard actually contains, read signed in on 18 Sep (free and Entry plans). Evidence for the gap analysis in `context/feature-specs/handoff-dashboard-v3.2-implementation.md`, the implementation hand-off for these screens.
- `audit-sourceready-dashboard.md` — what the reference does, what we keep, what we change and why.
- `dashboard-ux-flow.md` — the end-to-end buyer flow the screens run in, V1 with V2 marked.
- `handoff-v3.2-fresh-dashboard.md` — the brief this round was built from (what was rejected before, what is locked).
- `src/` — the screens' source. `dash.css` (only `var(--token)` values), `screens/*.html` fragments, `build.py` (fragments → `project/components/<Name>/preview.html` with CDN photo URLs, or `--inline` for data-URI photos), `render.py` (Playwright PNGs at 2×, light and dark, fonts inlined), `gen_tablerows.py` (the table rows from production values), `tokens.css` (generated from the artifact's tokens.json; the only file with hex).
- `renders/v3.2/` — the six screens at 1×, light, as reviewed on 18 Sep 2026.
- `assets/products/hs/manifest.json` — the photo catalogue: one illustrative photo per 4-digit EPB HS heading, 46 headings (every heading with 20+ exporters), each with prompt, job id, CDN file, exporter count and source URL. 12 files are in the repo (`aboni-knitwear/hs-<code>.min.webp`); the other 34 are generated on Higgsfield and need saving into `hs/` as `hs-<code>.png` (the CDN host is blocked from the design sessions) — `build.py` picks them up by name. Strips and thumbs show a supplier's least-common lines first; a heading without a photo shows its code.
- `_rejected-v3/` — the 18 Sep v3 set and its mockup, kept only so nothing has to be recovered from git; not design input.

To rebuild: `cd design/src && python3 build.py && python3 build.py --inline && DS_FONTS=<dir with the artifact's woff2 files> python3 render.py`. Publish the changed `project/components/<Name>/{preview.html,README.md}` to the artifact; `design-system.json` last with a new `lastChange`.

Rules that apply to everything here: `context/feature-specs/ds-rebuild-must-stay.md` §2 and §9. No hand-typed colours — every preview uses `var(--token)` only. Every value shown is production (18 Sep 2026); Zaheen is a labelled sanctioned *sample*, not sanctioned in production.
