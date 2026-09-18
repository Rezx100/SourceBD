# Hand-off — refine the SourceBD dashboard set (v3.1)

Paste this whole file as the first message of the new session.

## 1. What exists

Design System artifact (source of truth):

    https://claude.ai/artifact/3n9MkVaXgFaFokziwhmP5o

On 18 Sep 2026 a dashboard set was added on top of v3: 15 components in groups **App shell**, **Data display**, **Overlays**, **Feedback**, **Showcase** — AppShell, SearchComposer, SupplierResultCard, ResultsList, ProductTile, SupplierSheet, ProductSheet, RFQComposer, RFQList, StatTiles, CertificateCard, LockedTable, EmptyState, Highlights, Dashboard. Read, in this order, with the Artifact tool (`action: "read"`, `url` above, `path`):

1. `project/README.md` — brand book; the last section ("The buyer dashboard") is the set's intent.
2. `project/tokens.json` — light + dark colours, type, spacing, density, radius, shadow, timing.
3. `project/components/SupplierResultCard/preview.html` + README, then `SupplierSheet`, `SearchComposer`, `Dashboard`. Every preview is self-contained (a shared stylesheet is inlined at the top of each).

In the repo (`E:\SourceBD`):

- `design/src/` — the build that made the previews: `base.css` (the shared component styles, `var(--token)` only), `screens/*.html` (fragments; `_*.html` are partials), `screens/spec.json` (name, group, height, README per component), `build.py` (fragments → `project/components/<Name>/preview.html` + `out/dashboard-flow.html`), `render.py` (Playwright PNGs, light and dark; needs the three woff2 files from the artifact's `project/fonts/` in `./fonts` or `DS_FONTS`). Edit here, build, render, look, then publish.
- `design/audit-sourceready-dashboard.md` — the reference audit, what was kept / changed. Section 3 is the rule set the founder's critique below sharpens.
- `design/dashboard-ux-flow.md` — the flow the components run in. The flow stays; the pieces change.
- `design/assets/products/aboni-knitwear/manifest.json` — 12 product photos keyed by HS code (Higgsfield, CDN URLs). Use them; do not regenerate.
- `design/mockups/dashboard-flow.html` — all screens on one page (browser).

## 2. The founder's critique (18 Sep, after seeing 03 and 05)

Verbatim: *"the color needs refinement. the surface looks muddy and not clear. text looks crammed on some places and the design looks exact clone of the referenced dashboard."*

What it means, piece by piece:

**Muddy.** Too many grounds stacked on one screen: green-cast `canvas` (#f6f7f2) → `surface` card → `surface-sunken` tiles (#eceee7) → `brand-tint` selected card (#e6f2e6) → `smart-tint` band. Four tinted greys in one card; nothing is white and nothing is clearly figure or ground. The photo tiles' off-white seamless (#F6F5F1) sits inside `surface-sunken` and adds a fifth grey.

**Crammed.** The 13px meta line carries six facts and eleven source marks; four 120px tiles wrap their values ("BGMEA · BKMEA" on two lines); chips wrap to a second row; HS captions are clamped mid-word ("pullovers,…"); band gap is `space-3`. The card has more words than a table row and less order.

**Clone.** The result card is the reference's card with the tokens swapped: identity line → chip row → four mini tiles + photo carousel → match band. Same silhouette, same reading order, same sheet-with-tabs, same three-column RFQ modal. The founder wanted the journey, not the layout.

## 3. Locked — do not reopen

- Brand green `#1B5E20`, the three faces (Geist 300/400/500, Instrument Serif italic one word, Geist Mono for stamps and codes), status hues, `sanction` reserved, `smart` only for V2 surfaces with the `V2` tag, `signal` icon-size only.
- Product rules: no score / grade / star / "verified" badge on any buyer surface; every fact has a source mark; names wrap; locked is striped, never blurred; empty is quiet; sanction cannot be hidden by layout; nothing fake — the real records named in `ds-rebuild-must-stay.md` §3.
- The journey: search → results → record (over the results) → RFQ. V1 has no AI; everything AI is design-only, lavender, tagged V2.
- Contrast: 4.5:1 text, 3:1 controls, 7:1 sanction, both themes.

## 4. Open — this is the work

1. **Grounds.** Propose two or three ground schemes as full-card PNGs (light + dark): e.g. (a) neutral canvas #f7f7f5-ish, pure white cards, no sunken fills inside cards — hairlines only; (b) keep the warm canvas but make the card the only white and remove every tinted fill from inside it (selected = `brand` border + 3px left mark, not a tint); (c) inverse — cards on white page, canvas only behind the sidebar. Any new or changed ground goes into `tokens.json` with a usage note and passing pairs in both themes. Founder picks one.
2. **The result unit.** Do not iterate the card; re-invent it. Three directions, each a PNG at 1040px, light + dark, with Aboni Knitwear (11 sources, 4 certs, 12 HS codes), S M Knitwears (10 sources, 6 certs), Zaheen (100-char name, sanctioned sample) and AR Fashion (almost nothing on file). Starting points, not a menu: a **ledger row** (mono key column, facts as label/value pairs, sources as a rank ramp on the left edge, one hero photo, no tiles, no chips); a **table with an expanding row** (36px rows are the default view, a row opens into facts + photos in place); a **two-column receipt** (left: identity and registers; right: certificates and HS lines as a mono list with the photo as a 64px thumbnail). Fewer facts per card than now — decide which five earn the card, the rest live in the sheet.
3. **Rhythm.** After the unit is picked: one meta line of at most three facts; source marks on their own line or collapsed to "11 sources" with the ramp; `space-4` between bands; no clamped text — shorten the label instead; tiles, if any survive, ≥150px or gone.
4. **Sheet and RFQ.** Same pass once the card is settled: the sheet should stop looking like a tabbed profile page (consider a scrolling ledger with a sticky mono index on the left instead of top tabs); the RFQ composer should stop being the reference's three columns (consider preview-as-you-type in one column with the rail as a checklist on the right).
5. Update each element's README when its structure changes; keep `design/src/` as the way previews are built, and republish only changed files (read the artifact once right before publishing or the call is refused as stale; send the index last with a new `lastChange`).

## 5. How to work

1. Copy the artifact's `project/tokens.json` and the components you touch into a scratch folder as `<dir>/project/...`; copy `design/src/` beside it and build from there.
2. Previews: plain HTML/CSS, no React, line 1 `<!-- @dsCard group="…" height=N -->`, `var(--token)` values only, no hand-typed hex (grep before publishing). Images: `<img onerror="this.style.display='none'">` with the CDN URLs from the manifest; the artifact origin may block them, so the empty state of every photo slot must look intentional.
3. Render every option in light AND dark, look at the PNGs yourself, fix, then show the founder. Show, don't describe — the founder cannot picture a design from prose. Five lines or fewer per reply. One question at most, then build.
4. Publish only changed files to the artifact URL above (`root` = scratch folder, `file_path` = one changed file's absolute path, `files` = the rest by `project/...` path). Never resend `design-system.json` unless the title or an asset record changes — then it goes last with `lastChange`.
5. Commit `design/src/` changes back to the repo (`design/` is documentation; no app code, no `tokens.ts`, no Tailwind — the code port is a separate task).

## 6. Real records to test with (production, never invent)

- `Aboni Knitwear Ltd` — 11 sources, 3,314 workers, est. 1985, Savar/Dhaka, BGMEA 2071, BKMEA 1187; certs GOTS-31587 (valid to 12 May 2027), WRAP 7865 (expires 29 Sep 2026), OEKO-TEX 32597-100 (no expiry on file), GOTS-27605 (expired 4 Apr 2026); HS 6102 6103 6104 6105 6106 6107 6108 6109 6110 6111 6114 6115.
- `S M Knitwears Limited` — 10 sources, 300 workers, Gazipur, 6 certs, 24 HS codes.
- `Liberty Knitwear Ltd` — 16,934 workers, Narayanganj, 5 buildings, 32 HS codes.
- `Zaheen Knitwear Limited (Shed 3, 4, 5, 10, 11, 12, 13 and Building, Security, ETP and Fire Pump)` — the 100-char name; use as the sanctioned **sample** only.
- `A.R. Fashion` — buying house, almost nothing on file.
