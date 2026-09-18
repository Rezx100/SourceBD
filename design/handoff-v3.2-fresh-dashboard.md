# Hand-off — SourceBD buyer dashboard, fresh design (v3.2)

Paste this whole file as the first message of the new session.

## 0. Why this exists

Two sessions built a dashboard set (v3, 15 components) and then nine alternative result cards. The founder rejected every one of them. On 18 Sep 2026 he re-sent the reference — the sourceready.com "Shirt Manufacturers" list in card view and table view — and said, verbatim: **"these look like the worst version of all. I want a better version of this reference."**

So the brief is not to reinvent the result card. It is to build the reference's card, list and table **properly**, in SourceBD's system. Start from the reference screenshots and the brand book. Do not start from anything that was built before.

## 1. Do not use as design input

- The artifact's dashboard set: `project/components/{AppShell,SearchComposer,SupplierResultCard,ResultsList,ProductTile,SupplierSheet,ProductSheet,RFQComposer,RFQList,StatTiles,CertificateCard,LockedTable,EmptyState,Highlights,Dashboard}/` — rejected as "the worst version". You will overwrite them under the same names.
- `design/src/screens/*.html`, `design/src/base.css` component classes, `design/mockups/dashboard-flow.html` — the same set.
- Anything described as a ledger row, table-with-expanding-row, two-column receipt, plate, two-up grid, 72px row or cut-out garment — the second session's options. Deleted; nothing of them is in the repo or the artifact.

Open those files only to copy a mechanic (how `build.py` assembles a preview), never for how something should look. Do not read the old component READMEs before you have your own design.

## 2. Read, in this order

1. `design/reference/sourceready/01-card-view.png`, `02-card-view-scrolled.png`, `03-table-view.png` — the reference. This is the target anatomy. Look at them with the Read tool before anything else.
2. Artifact `https://claude.ai/artifact/3n9MkVaXgFaFokziwhmP5o` (Artifact tool, `action: "read"`, `url`, `paths`): `project/README.md` (the brand book — ignore its last section, "The buyer dashboard"), `project/tokens.json` (light + dark colour, type, spacing, density, radius, shadow, timing), and `project/fonts/Geist-Variable.woff2`, `GeistMono-Variable.woff2`, `InstrumentSerif-Italic.woff2`.
3. `design/audit-sourceready-dashboard.md` §3–4 (what we change against the reference and why — still valid) and `design/dashboard-ux-flow.md` (the journey; it stays).
4. `design/assets/products/aboni-knitwear/manifest.json` and the twelve `hs-<code>.min.webp` beside it (1024px, added 18 Sep). The CDN host in the manifest is blocked from both the cloud container and the desktop VM, so: **embed the local files as data URIs when you render PNGs**; published previews keep the CDN URL from the manifest with `onerror="this.style.display='none'"`, and the empty photo slot must still look intentional.
5. `design/src/build.py`, `render.py`, `tokens.css` — keep the mechanics (fragments → `project/components/<Name>/preview.html`; Playwright PNGs with the fonts inlined), write new fragments and a new stylesheet.

## 3. The reference, and what "better" means

Card anatomy, as the reference does it — keep every band:

| Reference | Ours |
|---|---|
| 48px logo square · company name (600) · blue "Verified" pill | Logo slot (initials on a `tier` mark when there is no logo) · name in `title`, wraps at 100 characters · the source-mark row in place of Verified (locked: no verified badge) |
| Meta line: flag · year · people range · type | type · district · est. · workers, each fact with its source mark |
| Capability tag row with icons, "+3 more" | Highlight chips read from the records — GOTS valid, WRAP expiring, RSC active, EPB exporter, listed by H&M — in status hues, "+N" |
| 2×2 fact tiles: Description / Shipments / Key customer / Key market, each label · value · "View all" | Certificates / Export lines / Listed by / Registers, each label · value · link into the sheet tab. Tiles ≥150px wide; a value never wraps; a missing value is `—` with the reason |
| Product photo carousel, ~130px tiles, caption strip, send icon on hover, scroll arrow | HS-keyed photos, caption = HS code + short heading, one row, arrow, "+N". Photos must actually show in every render |
| "100 % matched ▾" · "✓ shirt manufacturer" · explanation box | V2 only, `smart` lavender, "Why matched" naming the filters met. Never a number, never in V1 (locked) |
| Save · Send inquiry (blue primary) · ▾ | Save · Open record · Send RFQ (`brand` primary, disabled on a sanctioned record) |
| Header: title, Comments, search, sort, card/table toggle; footer: per-page, page N of M | Query title · live count · Sort · Save search · Export CSV · card/table toggle; "1–25 of 312", Prev / Next |
| Table view: Supplier (logo, name, country) · Match score · criteria ✓ · Product images (3 thumbs + N) · Business types · Factory certifications · Send inquiry · Save | Supplier (logo, name, place) · Sources (count) · Certificates · Export lines (3 thumbs + N) · Type · Workers · actions; Match column is V2 |

"Better" means the same bones with:

- Real photos in every card — the empty grey boxes were the single biggest reason the v3 set read as the worst version.
- Room: 14px body, 13px labels, `space-4` between bands, `space-3` inside a band. Nothing clamped mid-word; shorten the label instead.
- One canvas, one white card, hairlines. Tiles take a hairline (`line-subtle`) or one very light fill — never a fill inside a fill. No green-cast greys stacked four deep.
- Brand green only on the primary button and links; status hues only on facts and certificates; `smart` only on V2.
- The name wraps; the sanction bar cannot be hidden; the locked state is striped.
- Rendered at 2× (`device_scale_factor=2`), inside the full AppShell at 1440, light and dark — it has to read as a product screenshot, not a component sheet.

## 4. What was tried and rejected — do not repeat

- **v3 set (session 1).** The reference's anatomy in green-tinted greys: `canvas` → `surface` → `surface-sunken` tiles → `brand-tint` selected → `smart-tint` band; 13px meta carrying six facts and eleven source marks; 120px tiles wrapping their values; captions clamped ("pullovers,…"); empty photo boxes. Founder: "muddy… crammed… exact clone" — and on 18 Sep, with the reference beside it, "the worst version of all".
- **Session 2, round 1.** Three reinventions — ledger row with a mono key column and a source-rank ramp, table with an expanding row, two-column receipt — on three ground schemes. Founder: "none of them works"; asked what failed, he picked *still flat and grey*, *reads as a spreadsheet*, *still crammed* (not the grounds).
- **Round 2.** Photo-led: plate (photo left), two-up grid (photo top), 72px row; 20px name, one big figure, three facts. "A bit better but still not there."
- **Round 3.** Garments cut out and set on a paper canvas, 2×, in the shell. Then the reference clarification above.

The lesson: the founder wants the reference's density and richness executed well, not a reduction of it, and not a different idea. Build **one** version, in the shell, at 2×, and iterate on it with him. Do not present option menus; he has rejected nine.

## 5. Locked — do not reopen

- Brand green `#1B5E20`; the three faces (Geist 300/400/500; Instrument Serif italic, one word, marketing only; Geist Mono for stamps and codes); status hues; `sanction` reserved; `smart` only on V2 surfaces with the `V2` tag; `signal` icon-size only.
- No score, grade, star or "verified" badge on any buyer surface. Every fact has a source mark. Names wrap. Locked is striped, never blurred. Empty is quiet. Sanction cannot be hidden by layout. Nothing invented — production values only (§8).
- The journey: search → results → record (sheet over the results) → RFQ. V1 has no AI; everything AI is design-only, lavender, tagged V2.
- Contrast 4.5:1 text, 3:1 controls, 7:1 sanction, both themes.
- Only `tokens.json` / `tokens.css` carry hex; previews use `var(--token)` — grep before publishing.

## 6. The work

1. **SupplierResultCard v3.2** in the ResultsList inside the AppShell at 1440: Aboni Knitwear Ltd (selected), S M Knitwears Limited, Zaheen (sanctioned sample, the 101-character name), A.R. Fashion (almost nothing on file). Render 2×, light and dark, with photos. Show. Iterate until the founder says yes. This is most of the job.
2. **Table view** of the same list (the toggle's other state), 36px rows, photo thumbs.
3. **SupplierSheet**, **ProductSheet**, **RFQComposer**, **RFQList** in the same idiom. The reference's record uses tabs — keep tabs, do them well. The RFQ composer may keep the reference's three columns if it earns them.
4. **Ground.** Keep `canvas` `#f6f7f2` unless the finished card still looks muddy on it; then propose exactly one alternative (neutral `#f7f7f5` or the photo's paper `#f6f5f1`) as a `tokens.json` change with a usage note and passing pairs in both themes.
5. Update each component's README, republish only changed files (read the artifact once right before publishing or the call is refused as stale; `design-system.json` goes last with a new `lastChange`, only if an asset record or the title changes), commit `design/src` and `design/` docs back to the repo. `design/` is documentation — no app code, no `tokens.ts`, no Tailwind.

## 7. How to work

- Scratch: `<dir>/project/tokens.json`, `<dir>/project/fonts/*`, `<dir>/design/src/` with the existing `build.py` / `render.py` / `tokens.css` and your own fragments + stylesheet.
- Previews: plain HTML/CSS, no React; line 1 `<!-- @dsCard group="…" height=N -->`; `var(--token)` values only. For renders, patch `build.py` to inline `hs-<code>.min.webp` as data URIs; for the published preview, emit the CDN URL from `manifest.json`.
- Render every screen light and dark at 2×, look at every PNG yourself, fix, then show. Five lines or fewer per reply. One question at most, then build. Show, don't describe — the founder cannot picture a design from prose.
- If you need a value you do not have, query production read-only through the Supabase MCP (project `stnrfxrxfonwexzcvvpv`; tables `suppliers`, `source_records` + `sources`, `certifications`, `rsc_remediation`; HS lines via `public.supplier_epb_hscodes('<slug>')`). Never invent.
- Publish with the Artifact tool: `root` = scratch dir, `file_path` = one changed file's absolute path, `files` = the rest by `project/...` path.
- Commit to the repo with `device_commit_files` (the folder `E:\SourceBD` is connected; `design/src` and `design/*.md` only).

## 8. Real records (production, read 18 Sep 2026 — supersedes the numbers in the previous hand-off)

- **Aboni Knitwear Ltd** (`aboni-knitwear`) — factory, Savar, Dhaka, est. 1985, 3,314 workers. BGMEA general 3498 · BKMEA 625-B/2002 · EPB BD04293. 11 distinct sources (EPB, RSC · BGMEA, BKMEA, BGAPMEA · GOTS, OEKO-TEX, WRAP · H&M, ASOS, NEXT). Certificates: GOTS-31587 valid to 12 May 2027 (TÜV Rheinland); WRAP 7865 expires 29 Sep 2026 (11 days); OEKO-TEX 32597-100 no expiry on file; GOTS-27605 expired 4 Apr 2026. RSC active, 100 % remediated (initial CAP complete). 12 HS lines: 6102 6103 6104 6105 6106 6107 6108 6109 6110 6111 6114 6115 — photos for all twelve.
- **S M Knitwears Limited** (`sm-knitwear`) — factory, Gazipur, est. 2001, 300 workers. BGMEA 3532 · BKMEA 1092-B/2009 · EPB BD04237. 10 sources. Certificates: GOTS-28946 valid to 24 May 2027; WRAP 124992 expired 21 Jul 2026; OEKO-TEX 9741-100 / STeP / MiG / organic cotton, no expiry on file. RSC: no longer covered (inactive, 42 %). 24 HS lines, 6101–6209 (knitted and woven).
- **Liberty Knitwear Ltd** (`liberty-knitwear`) — factory, Narayanganj, est. 1994, 16,934 workers. BGMEA 3292 · BKMEA 467-A/2000. Sources: EPB, RSC, BGMEA, BKMEA, OEKO-TEX, H&M. Five OEKO-TEX certificates (16474-100/STeP/MiG/organic cotton, 87565-100), no expiry on file. RSC active 100 %. 32 HS lines. Five sister records (Unit-2, Extensions) exist — useful for the "names wrap / sister factories" case.
- **Zaheen Knitwears Limited (Shed - 3, 4, 5, 10, 11, 12, 13) & (Building - Security, ETP and Fire Pump)** — the 101-character name, exactly as stored. Factory, Narayanganj, 1,634 workers, one source (RSC), RSC 75 % behind schedule, no certificates, no register, no HS lines. Use as the **sanctioned sample only** (it is not sanctioned in production; the badge says "Sanctioned · sample").
- **A.R. Fashion** (`ar-fashion`) — buying house, district not on file, one source (BGMEA associate member 330), nothing else on file.
- Photos are keyed to the HS code, not the supplier, so S M and Liberty may show the same 6109 / 6105 photos; the caption always says "illustrative".

## 9. Notes for the founder

- The previous hand-off's "BGMEA 2071 · BKMEA 1187 · RSC 92 %" for Aboni were wrong; production has 3498 · 625-B/2002 · 100 %.
- Supabase advisory seen while querying: ten `public._snapshot_*` / `_tmp_*` tables have RLS disabled and are readable with the anon key. Not design work — worth dropping or locking.
- The 15 v3 components are still published in the artifact. The new set overwrites them under the same names; if the founder wants them gone before that, publish each path as `null` and update the index.
