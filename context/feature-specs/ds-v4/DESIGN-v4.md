# SourceBD v4 design system

Written 3 Oct 2026 (S2 part B) from what is in Paper, not from intentions.
Paper file "SourceBD v4" (`01M3Z77QNSZKYX715Y21B8RKC2`). Measured reference and
the reasons behind each choice: `ds-v4-spec.md`. Words: `voice-v4.md` and
`copy-inventory.md`. When this file and Paper disagree, Paper wins and this file is fixed.

## 1. Paper map

| Page | Artboards (node id) |
| --- | --- |
| 01 Foundations `p-2-0` | Colour G9-0 · Type LT-0 · Spacing, radius, elevation OG-0 · Grid SM-0 · Floors UQ-0 · Icons AZ-0 |
| 02 Components `p-3-0` | Buttons WE-0 · Inputs 117-0 · Chips, tabs, segmented 17H-0 · Table 1BU-0 · Overlays 1MO-0 · Feedback 1R6-0 · Phone 1TK-0 |
| 03 Patterns `p-4-0`, row 1 | Source marks 1YB-0 · Fact row 24Z-0 · Certificate row 27E-0 · RSC block 2BL-0 · Sanction banner (sample) 2EF-0 · Locked contact 2G6-0 · Supplier list row 2HA-0 · Quote comparison (sample) 2M2-0 · Order timeline (sample) 2OW-0 · Chat (sample) 2TC-0 · Needs attention 2VT-0 · Locations map 2XB-0 · Statement claim 30L-0 · Exports v2 (sample) 31R-0 |
| 03 Patterns `p-4-0`, row 2 | Shell desktop 1440 352-0 · Shell phone 390 3BO-0 · Shell phone 320 check 3DG-0 · Phone record, action bar up 3FR-0 · Phone navigation (D-3) 3HM-0 |

Clone ids for every reusable piece: `scratchpad/s2a-components.md` (parts A and B).
Clone with `<x-paper-clone node-id="…">`. Clones keep size, not colour.

## 2. Tokens (98 in Paper, Tailwind v4 namespaces)

These names become `lib/design/tokens.ts` in Phase 5.

**Colour (33).** Neutrals: `surface` #FFFFFF, `subtle` #F7F8F9, `sunken` #EEF0F2,
`line` #DDE0E4, `line-strong` #858C96, `disabled` #9AA0A8, `ink-3` #59606A,
`ink-2` #3B4149, `ink` #15181C. Brand: `brand` #1B5E20, `brand-hover` #154A19,
`brand-active` #0F3812, `brand-tint` #E8F2E8, `brand-wash` #F4F9F4. Signals:
`caution` #8A4A00, `caution-icon` #B25E00, `caution-tint` #FFF3DC, `danger` #A8231B,
`danger-solid` #B42318, `danger-tint` #FDECEA, `sanction` #6E0B1C, `sanction-tint`
#F8E5E9, `info` #1C4F8F, `info-tint` #E9F1FB, `scrim` rgb(21 24 28 / 40%).
Certificate aliases: `cert-valid-fg` → ink-2, `cert-valid-edge` → line,
`cert-expiring-fg` → caution, `cert-expiring-bg` → caution-tint, `cert-expired-fg` →
danger, `cert-expired-bg` → danger-tint, `cert-no-expiry-fg` → ink-3,
`cert-no-expiry-edge` → line-strong. All prefixed `--color-`.

**Type.** `--font-sans` "Geist", `--font-mono` "Geist Mono" (founder, 9 Oct 2026; Paper
drew IBM Plex, replaced site-wide). Mono is for what a register filed and for labels of a
few words; a caption that is a sentence is sans at `--text-sm`, never mono.
`--font-weight-regular|medium|semibold` 400/500/600. `--text-xs` 12, `-sm` 13,
`-base` 14, `-md` 16, `-lg` 20, `-xl` 24, `-2xl` 32, `-3xl` 40, each with a line
height 16/18/20/24/28/32/40/48. `--leading-tight` 125%, `-normal` 150%.
`--tracking-tight` -0.01em, `-tighter` -0.02em.
**Marketing display sizes (added 3 Oct 2026, quality round):** `--text-display-1` 72,
`--text-display-2` 56, `--text-display-3` 40 (same size as `--text-3xl`). Used by the
marketing desktop headlines, close titles and the big counts. App screens never use them.
**Paper renamed** `--text-*--line-height` to `--text-*-line-height` (single dash).
Phase 5 restores the double dash in `tokens.ts` so Tailwind v4 pairs size and line height.

**Spacing (23).** `--spacing` 4px; steps 1 4, 2 8, 3 12, 4 16, 5 20, 6 24, 8 32,
10 40, 12 48, 16 64, 20 80. Named: `control-sm` 24, `control` 32, `row-head` 36,
`row` 40, `control-lg` 40, `touch` 44, `input-touch` 48, `row-tall` 56, `topbar` 56,
`tabbar` 56, `action-bar` 64.

**Radius.** `sm` 4 (controls, chips), `md` 6 (tables, source-mark frames), `lg` 8
(panels, dialogs, cards), `full` 9999.

**Breakpoints.** xs 320, sm 640, md 768, lg 1024, xl 1280, 2xl 1440.
**Containers.** sidebar 224, details 344, dialog 480, prose 544, pane 640.
**Opacity.** `disabled` 100% (disabled is a colour, not opacity), `scrim` 40%.

**Not Paper tokens (add in code).** `--shadow-menu` 0 4px 12px rgb(21 24 28 / .12);
`--shadow-dialog` 0 12px 32px rgb(21 24 28 / .18) (dialogs, docked pane, phone sheets);
focus ring 2px brand with 2px offset; danger pressed #861C16 (add `--color-danger-active`).

## 3. Type ramp (as drawn)

12/16 labels, column heads, source lines · 13/18 fact values in chips, mono codes,
captions · 14/20 cells, controls, body · 16/24 prose, phone body, phone rows ·
20/28 section titles, pattern headings · 24/32 page title, record name in the pane ·
32/40 record name on the full page, artboard titles · 40/48 site only.
Weights: 400 body, 500 names and labels, 600 headings and figures that answer the
question. Mono only for certificate, register and HS numbers. Dates in sans, en-GB,
"12 May 2027". Nothing below 12px.

## 4. Components (02 Components, every state drawn)

- **Button** 32 tall: primary (brand, one per region), secondary (white, line-strong
  edge), quiet, danger (confirm dialogs only), link (brand, underlined). States
  default, hover, focus-visible, pressed, disabled (sunken fill, disabled text),
  loading (spinner + "Sending"). Sizes 24 icon, 32, 40 main form action, 48 phone.
  Button text never wraps.
- **Inputs** text, select, combobox, date (en-GB, never mm/dd/yyyy), checkbox, radio,
  switch, upload: default, hover, focus, filled with help, disabled, error (icon +
  words under the field). Phone: 48 tall, 16px text, rows 44+.
- **Chips** 24 tall, 14px icon + words, radius 4, 13/500. Certificate: valid (white,
  check), expiring (caution tint, clock), expired (danger tint, cross), no expiry on
  file (dashed, minus). Fact: stale, sources disagree, source page changed, not
  published. Type, count, removable filter, standing filter ("Hiding sanctioned
  suppliers · Show them").
- **Tabs** 40 tall, 2px brand underline, counts as "Certificates · 4"; overflow goes
  under "More"; the selected tab never hides. **Segmented** 32, two to four options.
- **Table** head 36 (sticky), rows 40, 56 when the name wraps; sortable heads, row
  hover (brand-wash), selected (brand-tint + 2px bar), bulk bar (ink), column chooser,
  empty, loading (skeleton rows, words after 2 s), pagination with a noun.
- **Overlays** docked pane 640 with a resizable divider, confirm dialog 480, form
  dialog, toast (ink, Undo), tooltip, popover (source), menu.
- **Feedback** empty (one sentence that sells, one action), per-field empty, error in
  a section with cause and Try again, error page, skeletons.
- **Phone** tab bar 56 + safe area, sticky action bar 64, refused bar (sanctioned),
  filter sheet, confirm sheet.

One "selected" treatment everywhere (nav, row, conversation, address): brand-tint
fill and a 2px brand bar.

## 5. Patterns (03 Patterns)

**Source marks (S-01).** 24px frame, white, 1px line, radius 6, the one-colour mark
from `public/icons/sources/*` (locked in `logos.lock.md`), then the short name in
13/500 words. Tier order, each group named: Tier 1 "government and RSC" (EPB, RSC),
Tier 2 trade bodies (BGMEA, BKMEA, BGAPMEA), Tier 3 certification bodies (GOTS,
OEKO-TEX, WRAP), Tier 4 brand supplier lists (ASOS, H&M, Next). Brand lists get a
dashed frame with a document glyph: a name, never a logo. Drawn with one source
(A.R. Fashion) and eleven (Aboni Knitwear). The details panel (344) lists every
source with its full name and last-checked date; past 90 days the date turns caution
with a clock. A table cell shows three marks and "8 more sources". Tap: source popover.
*Open item:* logos.lock §1 allows frames 16/20/32 only; v4 uses 24 (S-01). Update the
lock before Phase 5.

**Fact row.** Label (160 wide, 13 ink-3) · value with unit (14/500; mono for codes) ·
source line "From BGMEA · checked 24 Jul 2026" (12 ink-3) · chip at the right only
when something is wrong. States: current (no chip), stale ("Last checked 26 Jun
2026"), contradicted (both figures with their sources, "Sources disagree": 4,200
employees as declared to BGMEA vs 1,230 workers counted by RSC, Mondol Fabrics),
source page changed, not yet sourced ("Source not linked yet. It is one of the 11
sources."), not published ("Ask in your RFQ."). Phone: label above value, 16px.

**Certificate row.** Standard + number (mono) · issued by · state chip with exact
date · "Open certificate". Sort: expired, expiring, valid, no expiry on file. Header
"Certificates · 4 · 2 expired". Within 30 days the chip counts down ("Expires in 5
days · 8 Oct 2026"); 31 to 90 days shows the date only. WRAP shows no level.
Phone: chip first, then name and number, issuer and link.

**RSC block.** RSC mark + "Safety inspections · factory 9342" + state chip (Covered by
RSC: neutral; No longer covered by RSC: caution). Remediation as text ("42% of initial
items fixed"), training, workers counted. Five links: Fire, Electrical, Structural,
Boiler, Corrective action plan; a missing one is a plain ink-3 line ("Boiler: no
report published"). Never a progress bar. Phone: links as 48px rows.

**Sanction banner (sample state).** Solid `sanction` band with an octagon, outside the
scroll area, no close: "On the UFLPA Entity List since [date]." The action bar keeps
Save and replaces Send RFQ with "You can't send this supplier an RFQ." In the list
(only after "Show them") the row says the list name in words; a bulk RFQ drops the
supplier and says so. Drawn with placeholders only: no published supplier is sanctioned.

**Locked contact.** "Email 1 on file · Phone 4 on file" + "Contact details are locked.
Send an RFQ and the supplier replies here." + Send RFQ. Nothing on file: "No email or
phone on file". Phone: one 56 row above the sticky action bar.

**Supplier list row.** Desktop table row 40 (clone of 02's table rows). With the pane
docked the list narrows to 576: name, type, place, first certificate problem, source
count. Phone: name 16/500, "Factory · Dhaka · 11 sources", first certificate problem
with icon and words. The 100-character Zaheen name wraps; nothing truncates.

**Quote comparison (sample state).** Desktop table: supplier, FOB per piece, vs target
("US$0.35 under"), MOQ (caution icon + "above your 10,000" when MOQ > quantity), lead
time, valid until, action. No-reply rows stay ("No reply yet · RFQ sent 18 Jul
2026", Send reminder). Phone: one card per supplier, price 24/600 first, Accept
opens a confirm sheet that repeats price, quantity and total. Every figure carries a
"Sample figures" label; the RFQ title and supplier names are real.

**Order timeline (sample state).** Vertical: done (filled check), now (brand ring),
planned (dashed circle), late planned (caution dashed, "3 days late"). Each item:
name, date, "Logged by you" or the supplier. Phone folds done items into one line.

**Chat (sample state).** Theirs: white bubble with a line, left. Yours: brand-tint,
right. Name and time under each bubble; one date line per day; "Read" once, under your
last message. Attachments as a file chip. Composer pinned: attach (32 / 44 on phone),
field, Send. Phone: composer rides the keyboard; tab bar hidden.

**Needs attention row.** Icon + supplier + what happened with its date + one action
("Ask for the new certificate", "Ask for the renewal"). Real rows: Aboni Knitwear
WRAP 7865 expired 29 Sep 2026; Mondol Intimates GOTS-26992 expires 8 Oct 2026.
Empty: "Nothing needs attention".

**Locations map (RC-10, RC-09).** The real Barikoi capture beside one clean address per
site, synced both ways (selected address: tint + bar; its pin gets a brand ring).
Each address says its kind and precision in words: "Factory · pinned to the
address", "Office · registered and mailing address", "Factory · approximate location"
(geocode confidence under 70, e.g. Mondol Fabrics). Controls: Street/Satellite
segmented, "Show nearby suppliers" off by default. Pin legend: factory (brand fill),
office (ink-2), approximate (white with ink ring). Phone: a map card ("Sites · 3",
Open map) that opens full screen with an address sheet. No spelling variants, no
geocoding at runtime.

**Statement claim to confirm.** In a modern slavery statement draft, an open claim is a
dashed caution chip "[Confirm: …]". A rail lists open claims with Confirm buttons;
"Download statement" stays disabled with the reason "Confirm 2 claims to download."
Confirmed claims read as plain text with a thin underline.

**Exports (v2, sample).** Totals first, each with how many rows it comes from (pieces in
the last 12 months, FOB per piece low to high by HS code, destinations, buyers,
latest export). Table: date, product in plain words + HS code in mono, pieces, FOB per
piece, FOB value, buyer (as filed, minus address fragments), destination, sea/air.
Row detail: customs house and weights. Freshness line on every view: "Bangladesh
customs export records · latest {date}" (the provider, Volza, is named on /legal/data-sources only; founder, 11 Oct 2026). Sister-company rows stay on their
own record; when the buyer's country differs from the destination, both show.
Never: notify party, shipper address, a guessed brand, a score. Real rows live only in
Paper (private); none go in this repo.

## 6. App shell

**Desktop 1440x900.** Sidebar 224 (subtle): wordmark, Search, Saved, Messages ("2
new"), RFQs and quotes, Orders, Compliance ("2 to check"); Products and Settings at
the foot. Topbar 56: the only search box (480, Ctrl K) and the account menu. Body:
list 576 + docked pane 640, each scrolling inside. The pane: name 24/600, one line of
identity, a four-figure summary (certificates, RSC, workers, sources), tabs with
counts, body, and a 64 action bar (contact counts, Save, Send RFQ).

**Phone 390x844 (and 320).** Status bar, a 56 top bar with the page title (24/600)
and the account button (44), content, tab bar **Messages · Quotes · Alerts · Saved ·
Search** (D-3). Settings and Products live in the account sheet. On a record the tab
bar is replaced by the sticky action bar (S-09); with the keyboard up it is hidden.
Back is one pattern: a top-left arrow naming where you came from. The record's first
screen is the summary (certificates "4 · 2 expired", RSC, workers, sites, sources),
then scrolling section tabs.

## 7. Floors (01 Foundations · Floors)

Text never under 12px. Phone targets 44x44, phone inputs 48 with 16px text. Desktop
controls 24 minimum, 32 default, 40 main action; nothing clickable under 24.
Prose at most 544px (about 72 characters). Focus ring 2 + 2, keyboard only. Motion
120ms colour, 200ms pane, 160ms dialog; none under reduced motion; none on data.
15+ results per 1440x900 screen at 40px rows.

## 8. Honesty rules (drawn into every pattern)

- No SourceBD score, grade, rating or star; no bar that fills to 100%.
- Every fact keeps its source in words with a date; an icon alone is not a source.
- A number always has its noun or unit ("3,166 workers", "MOQ 3,000 pieces").
- Each fact once per screen; no spelling variants, no raw ALL-CAPS register text.
- Problems get colour plus icon plus words; normal states stay neutral; green is the
  brand and your own action, never a supplier status.
- Sanctioned, quotes, orders, chat, statement and exports are drawn as labelled
  sample states until real data exists; no invented company, price or testimonial.
- Relative dates only for deadlines within 30 days.

## 9. Known gaps for later steps

- Part A drew 01 and 02 in the system font; text was switched to `--font-sans` in S2b.
- The list table (02) shows employees as declared (3,314 for Aboni); the pane and phone
  show the workers figure the app displays (3,166, RSC). S3 picks one per screen.
- Phone variants of the exports table and the statement editor are left to S3/S6.
