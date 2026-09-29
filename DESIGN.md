---
name: SourceBD buyer app
description: A ledger of verified Bangladesh RMG suppliers; neutral paper, hairlines, green spent only where the buyer acts.
colors:
  canvas: "#F7F7F6"
  surface: "#FFFFFF"
  surface-sunken: "#EEEEEC"
  surface-inverse: "#111411"
  surface-inverse-raised: "#181C18"
  ink-strong: "#0F130F"
  ink: "#262B26"
  ink-muted: "#545C54"
  ink-subtle: "#626B62"
  ink-disabled: "#9AA39A"
  ink-inverse: "#F2F4EE"
  ink-inverse-muted: "#A9B1A8"
  ink-inverse-subtle: "#8A938A"
  line-subtle: "#E7E7E4"
  line: "#D8D8D4"
  line-strong: "#79837A"
  line-inverse: "#2B302B"
  brand: "#1B5E20"
  brand-hover: "#17511B"
  brand-active: "#113E15"
  brand-on: "#FFFFFF"
  brand-tint: "#E6F2E6"
  brand-tint-strong: "#CFE6D0"
  brand-ink: "#1B5E20"
  brand-ink-inverse: "#8BE39A"
  focus: "#2E7D32"
  accent: "#3B5A70"
  accent-on: "#FFFFFF"
  accent-ink: "#2C4E66"
  accent-tint: "#E6EDF2"
  accent-tint-strong: "#D3DFE8"
  signal: "#3FE374"
  signal-on: "#0F130F"
  signal-deep: "#12903F"
  positive: "#0B7A5C"
  positive-ink: "#075C45"
  positive-tint: "#E1F4EC"
  positive-line: "#9EDCC6"
  caution: "#A65A05"
  caution-ink: "#7A4300"
  caution-tint: "#FDF3DE"
  caution-line: "#F3C77E"
  danger: "#D92D20"
  danger-ink: "#B42318"
  danger-tint: "#FDF2F0"
  danger-line: "#FDA29B"
  sanction: "#8F1711"
  sanction-on: "#FFFFFF"
  sanction-tint: "#FAE6E3"
  locked: "#EEEEEC"
  locked-stripe: "#DDE0D5"
  locked-ink: "#545C54"
  locked-line: "#C1C7B9"
  quiet: "#F7F7F6"
  quiet-ink: "#545C54"
  quiet-line: "#C1C7B9"
  smart: "#6B3FA0"
  smart-tint: "#F1E8FA"
  smart-line: "#D6C2EE"
  skeleton: "#E7E7E4"
  tier-1: "#0F130F"
  tier-2: "#262B26"
  tier-3: "#545C54"
  tier-4: "#DDE0D5"
  tier-5: "#FFFFFF"
  tier-5-line: "#79837A"
typography:
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 500
    lineHeight: "1.875rem"
    letterSpacing: "-0.015em"
  headline-lg:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 500
    lineHeight: "2.25rem"
    letterSpacing: "-0.02em"
  headline-sm:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: "1.625rem"
    letterSpacing: "-0.01em"
  page-title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.625rem"
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: "1.375rem"
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.375rem"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  caption:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
  code:
    fontFamily: "Geist Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  eyebrow:
    fontFamily: "Geist Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: "1rem"
    letterSpacing: "0.08em"
  stat:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 400
    lineHeight: "1.875rem"
    letterSpacing: "-0.015em"
rounded:
  xs: "3px"
  sm: "6px"
  md: "10px"
  lg: "14px"
  full: "9999px"
spacing:
  "0.5": "2px"
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "2.5": "10px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  control: "32px"
  control-lg: "40px"
  row-dense: "36px"
  row-relaxed: "44px"
  fact-row: "28px"
  topbar: "56px"
  sidebar: "232px"
components:
  button-default:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "{spacing.control}"
  button-default-hover:
    backgroundColor: "{colors.line}"
    textColor: "{colors.ink-strong}"
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-on}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "{spacing.control}"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
  button-primary-active:
    backgroundColor: "{colors.brand-active}"
  button-primary-lg:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-on}"
    padding: "0 14px"
    height: "36px"
  button-sm:
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "28px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "{spacing.control}"
  button-ghost-hover:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink-strong}"
  button-danger:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "{spacing.control}"
  button-danger-hover:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.danger-on}"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "{spacing.control}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "32px"
  nav-item-hover:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink-strong}"
  nav-item-active:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand-ink}"
  chip-neutral:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "1px 10px"
  chip-positive:
    backgroundColor: "{colors.positive-tint}"
    textColor: "{colors.positive-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "1px 10px"
  chip-caution:
    backgroundColor: "{colors.caution-tint}"
    textColor: "{colors.caution-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "1px 10px"
  chip-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.quiet-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "1px 10px"
  chip-sanction:
    backgroundColor: "{colors.sanction}"
    textColor: "{colors.sanction-on}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "1px 10px"
  chip-on:
    backgroundColor: "{colors.brand-tint-strong}"
    textColor: "{colors.brand-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "1px 10px"
  badge:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "0 7px"
    height: "20px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  result-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    width: "clamp(480px, 50%, 760px)"
  sheet-wide:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    width: "clamp(640px, 68%, 1100px)"
  table-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    height: "{spacing.row-dense}"
  table-row-current:
    backgroundColor: "{colors.brand-tint}"
  toast:
    backgroundColor: "{colors.surface-inverse}"
    textColor: "{colors.ink-inverse}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  lock-card:
    backgroundColor: "{colors.locked}"
    textColor: "{colors.locked-ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  source-mark:
    backgroundColor: "{colors.tier-1}"
    textColor: "{colors.surface}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.sm}"
    size: "20px"
---

# Design System: SourceBD buyer app

Scope: the buyer app under `/app/*` as drawn by `components/dashboard/*`, with every value read from `lib/design/tokens.ts`. The marketing site, supplier portal and admin still run on the older `components/ui/*` system and are not described here.

## Overview

**Creative North Star: "The Ledger That Answers"**

The buyer app is a ledger of receipts. Every screen is a page of neutral paper (`canvas`) with white panels laid on it, grouped by tone and spacing rather than boxed, and every fact on the page has room beside it for the mark of the register that filed it. Density is desk-level: 13px labels, 14px body, 36px table rows, 32px controls, a 232px rail and a 56px frosted topbar. Colour is spent like money. The shell is near-monochrome on a neutral grey ramp, the brand green appears only where the buyer acts (the primary button, links, the active nav row, the logo), and status hues (teal-green, amber, red, and the reserved sanction maroon) appear only on facts that carry that status.

The world refuses the competitor's chat-first home and its match-score theatre: there is no score, grade, rating or star anywhere on a buyer surface. It also refuses decoration: the one flourish is the `signal` dot, a bright green point beside a live number or in a toast, and the empty-state spot illustrations, single-weight ink line art with one brand-green fill. Motion is acknowledgement, not spectacle: entrances only, opacity-led, at 120 / 200 / 320 ms, and nothing is lost when the device asks for reduced motion.

**Key Characteristics:**
- Neutral paper canvas, white panels, depth by tone and spacing; a hairline only where two regions meet (a row and the next, a header and its body, the list and the pane).
- Geist for words, Geist Mono for the ledger's stamps (register numbers, column keys, source marks, counts).
- Brand green on the primary action, links, active nav and the logo only; never a badge, never a state.
- Source rank drawn as a neutral lightness ramp, so colour stays free for status.
- Locked contact details are striped, never blurred; empty and unverified are quiet, never alarming.
- Names wrap at every size; nothing truncates a company name.
- Entrances only: fade 200, rise 320, sheet-in 320; exits land at once. The record opens beside the results, both live: no scrim, nothing modal.
- Everything secondary opens in the pane beside the list it came from: the record, a product line, the RFQ composer, the filters, save search, an order, an RFQ. The shell and the buyer's search never move; Close returns to them. A page of its own exists only for a deep link.
- The app opens on the search landing (`/app`): one large field, one-click filters, the common searches as templates with live counts, the buyer's saved searches, and no supplier listed until the buyer asks (founder, 28 Sep 2026). The desk that was Home (certificate alerts, recent activity) sits at the top of Saved.
- The list is a ledger grid first: 40px rows, sortable sticky headers that meet the top of their scroll region, row actions always drawn in a column of their own, and the keyboard. The thumbnail cards are the other stop of the switch.

### Decided 29 Sep 2026 (colour, search field, filters and type built in PR 4; icons, record head and photos land in PR 5)

The founder's video (hand-off `context/feature-specs/handoff-dashboard-video-29sep.md`) overturns parts of this document; the decision page's picks are below, and each section here is rewritten as its PR lands. Until then the sections describe what is built.

- **Colour.** Green is spent on the one primary action and the logo only. Selection, the active nav row, set filters, links, tabs, focus and the ticked box take **Slate** (`accent`: `#3B5A70`, ink `#2C4E66`, tint `#E6EDF2`, strong tint `#D3DFE8`). This replaces the Spent Green Rule below.
- **Search field.** Filled: a tonal fill with no outline and no shadow; while typing it turns white with a thin ink line under it. No green ring.
- **Filters.** One row of menus (Product, Certificate, Place, Company type, More), each a short list with counts; a set filter shows its value on its button.
- **Type.** One step up in the buyer app: caption 13, label and table 14, body 15, title 16, eyebrow 12; the list's initials tile 40px.
- **Icons.** A custom line set in the repo (24px grid, 1.5px stroke, round ends). The source-pending mark is a document with a clock, not a dashed square.
- **Record head.** Facts as plain text; each source once, in one row of marks.
- **Product photos.** A list: a 40px photo tagged "illustration", the HS code and its name, one line per heading.
- **Locked stripes** go (`.locked-pattern`); a locked field is the plain locked ground.

## Colors

A neutral ramp carries the shell; one brand green is the action colour; four status hues sit on facts; one violet is reserved for AI-assisted surfaces that do not yet exist in V1.

### Primary
- **Forest Green** (`brand`): the primary button fill, link text (`brand-ink`), the logo square, and the active nav row's hairline ring. Hover and active steps darken it (`brand-hover`, `brand-active`); `brand-tint` is the active nav row's fill and `brand-tint-strong` the selected row, the active filter chip and text selection. On a dark band, links use **Spring Green** (`brand-ink-inverse`).
- **Focus Green** (`focus`): the 2px keyboard focus outline, offset 2px, on every focusable element via `:focus-visible`. Native checkboxes, radios and the text caret also take brand green through `accent-color` and `caret-color`.

### Secondary
- **Signal Green** (`signal`): the live dot beside a live count and inside a toast, always icon-sized (6 to 8px) and always with its `bloom` glow. Never text, never a status. `signal-deep` is the same idea as a stroke on a light ground.

### Tertiary (status, on facts only)
- **Verified Teal** (`positive` / `positive-ink` on `positive-tint`): a valid certificate, an active listing, the remediation meter's bar. Deliberately a teal so it cannot be mistaken for brand.
- **Amber Caution** (`caution` / `caution-ink` on `caution-tint`): expiring, expired, contradicted, behind schedule, missing-field notes.
- **Error Red** (`danger` / `danger-ink` on `danger-tint`): a read that failed, a form error. Never a sanction.
- **Sanction Maroon** (`sanction`, `sanction-on`, `sanction-tint`): a sanctioned supplier. Reserved; held to 7:1 in the contrast test; drawn as a solid chip and a left rule on the result card. No other role may use it.
- **Ask Violet** (`smart` on `smart-tint`, `smart-line`): AI-assisted surfaces only, always with the V2 tag. Never on a fact.

### Neutral
- **Paper** (`canvas`): the page and the sidebar rail; also the `quiet` ground for unverified and empty.
- **Panel White** (`surface`): panels, the sheet, inputs, table headers, the tier-5 mark. `surface-sunken` is the secondary button's fill, a row's hover, the type badge, the composer's target list and preview, the locked ground; `line` is the secondary button's hover. `surface-inverse` is the toast and dark bands.
- **Ink ramp** (`ink-strong` headings and names, `ink` body, `ink-muted` labels and secondary text, `ink-subtle` captions, placeholders and mono stamps, `ink-disabled` disabled controls only). Every ramp step but `disabled` passes 4.5:1 on canvas, surface, sunken, locked and quiet; `tokens.test.ts` enforces the pairs.
- **Hairlines** (`line-subtle` dividers and card borders, `line` the sheet's left rule and the neutral chip, `line-strong` input and control outlines at 3:1).
- **Locked** (`locked` with `locked-stripe` at 135°, `locked-ink`, `locked-line`): the contact block by default.
- **Tier ramp** (`tier-1` darkest to `tier-5` white with a `tier-5-line` outline): the source mark's fill and the logo tile, darkest is most trusted.

### Named Rules
**The Spent Green Rule** (rewritten 29 Sep 2026, founder's video). In the buyer app, solid brand green appears on two things: the primary action and the logo. Selection, the current nav row, a set filter, links, tabs, focus and the ticked box are **Slate** (`accent`); inside `[data-shell]` the green tints and link ink (`brand-tint`, `brand-tint-strong`, `brand-ink`) and `focus` are remapped to it in `app/ds.css`, so older classes follow. Green is never a badge fill, a chip tone or a state colour, so it can never be read as "verified".
**The Reserved Maroon Rule.** `sanction` is used for a sanctioned supplier and nothing else. Errors use `danger`; the two are never interchanged.
**The Quiet Absence Rule.** No proof is not a warning. Unverified facts and empty lists sit on `quiet` with `quiet-ink` and a dashed `quiet-line`; they never take caution or danger.
**The Monochrome Rank Rule.** Source trust is drawn in lightness on the ink ramp, never in hue. The mark's accessible name carries the tier in words.
**The One File Rule.** Every colour in the app is a token from `lib/design/tokens.ts`, reached through a Tailwind class. Tailwind's stock palette is replaced, not extended; a hand-typed hex or rgba in a component is a defect.

## Typography

**Display Font:** Geist (variable, self-hosted; falls back to ui-sans-serif, system-ui)
**Body Font:** Geist
**Label/Mono Font:** Geist Mono (variable, self-hosted; falls back to ui-monospace, Menlo, Consolas)

**Character:** One quiet grotesk for everything a person reads, and its mono sibling for everything a register stamped: reference numbers, HS codes, column keys, counts, the two-letter source marks. Every number in either face sets tabular figures (set once on `body`). Weights stay light for the size: headings at 500 because Geist at 600 reads heavy; 600 is reserved for the page title, section titles and key figures.

### Hierarchy
Inside the buyer app (`[data-shell]`) the five small steps are one size up (founder, 29 Sep 2026): eyebrow 12, caption 13, label and table 14, body 15, title 16 (`appFontSize`, through CSS variables, so the marketing site keeps the sizes below). The list's initials tile is 40px beside a 15px name.
- **Headline** (500, 22px / 30px, -0.015em): `Heading` default; the sheet's record name sits above it at the same weight.
- **Headline-lg** (500, 28px / 36px, -0.02em): `Heading level="lg"`; a page-level statement.
- **Headline-sm** (500, 18px / 26px, -0.01em): `Heading level="sm"`; every section inside the record sheet.
- **Page title** (600, 18px / 26px, -0.01em): the page's one `h1` in `PageHeader`; the sheet's tabs use the same size at 500.
- **Title** (500, 15px / 22px, -0.005em): a card's name, a tab, the wordmark, the logo tile's initials. Wraps at any length.
- **Body** (400, 14px / 22px): the default text; fact values; empty-state copy at 14px in `ink-muted`.
- **Label** (500, 13px / 20px): buttons, nav items, fact labels, table cells, chips.
- **Caption** (400, 12px / 16px, `ink-subtle`): notes, read dates, "source pending", badge text.
- **Code** (400, 13px / 20px, mono): register and certificate numbers, HS codes.
- **Eyebrow** (500, 11px / 16px, +0.08em, mono, uppercase, `ink-subtle`): a column key or a stat's label ("HS LINES", "PRODUCT LIST"), table headers. Also the 11px mono `Count` beside a nav label or a tab.
- **Stat** (400, 22px / 30px): the big figure in a stat block, weight 400 so the number is large without being loud.

### Named Rules
**The Wrapping Name Rule.** A company name wraps between words, never inside one, and is never cut (founder, 29 Sep 2026: "Unit 2" and a bracket are often all that tells sister factories apart, so no ellipsis). Every column that holds a name keeps room for its longest word at the table's minimum width (the supplier column: 184px, "MANUFACTURING" at 14px plus the tile), and below that width the table scrolls sideways. A name, a chip that carries a building's name and a fact value still set `overflow-wrap: anywhere`, but only as the last resort for a single token wider than its whole column; never a fixed height or `text-overflow: ellipsis`. The only truncation in the kit is the topbar search placeholder.
**The Stamp Rule.** Mono is for what a register filed, not for emphasis: reference numbers, codes, counts, column keys, the two-letter marks. Body text is never mono.
**The Light Heading Rule.** Headings and company names are weight 500. Weight 600 appears on the page `h1`, section titles and the remediation figure only; 700 is unused in the app.

## Layout

The shell is a 232px sidebar on `canvas` (hairline right edge), a 56px frosted topbar (`.glass`: surface at 80% with a 16px blur, hairline bottom edge) and a content column capped at 1200px (`max-w-content`). Prose caps at 68ch. Page gutter is 24px at 1024px and up, 16px below; the topbar keeps 16px, stepping to 24px at 640px.

Spacing sits on Tailwind's 4px grid, and the kit uses a small set of stops: 2 / 4 / 6 / 8 / 10 / 12 / 16 / 20 / 24. Card interiors are 12px by 10px (the result card) or 16px by 12px (a panel card, a cert card); a sheet section is 24px by 20px; the lock card is 16px. Fixed heights are the density stops: 32px controls and nav rows, 40px primary actions in the sheet's action bar, 36px dense result rows, 44px relaxed list rows, 28px minimum fact rows, a 52px minimum sheet bar.

From 768px the shell is the viewport: the page never scrolls, the rail and the content region scroll on their own, and a workbench page (the search, Saved, orders, RFQs) fills the region with panes that scroll themselves. The shell root and the workbench frame (`Workbench`) are `overflow-clip`, never `overflow-hidden`: hidden still yields to a followed fragment, a `scrollIntoView` or a focus call, and a record tab once slid the whole search under the topbar that way (founder, 29 Sep 2026); only the list and the pane scroll, and a record tab scrolls only its pane. The record is such a pane, beside the results from 1024px: `clamp(480px, 50%, 760px)` of the content region with a 1px `line` left rule, the results keeping the rest behind a 16px gutter; below 1024px it takes the whole region and the results wait in the URL for Close. As a page of its own (`/app/suppliers/[slug]`) the same sheet centres an 1120px measure. A fact row is a label column of 150px (160px in `DetailList`) beside a value that wraps, with the source mark and the "checked" caption at the row's end; it stacks below 640px. Stats run four across, two across below 640px. Tables live in a horizontal scroll region with a minimum width (40rem default, 60rem for the results, 30rem beside a pane) so a phone scrolls them sideways rather than crushing them; from 1280px their headers stick to the top of the column's own scroll. A secondary form (the RFQ composer) takes the wide pane, `clamp(640px, 68%, 1100px)`, with its preview beside the fields from 1280px. Beside any pane the results table narrows to its three essential columns (supplier, sources, workers). Every column is sized from its content measured in Geist, never guessed (`RESULTS_COLUMNS`, 29 Sep 2026): nothing in a cell may run into the next one.

Below 768px the sidebar becomes a horizontal snap-scrolling row of nav items under the logo; the plan block and recent searches hide. The document never goes narrower than 320px.

## Elevation & Depth

Flat by default, tonal in layers. Depth is read from the ground first (`canvas` below `surface`, `surface-sunken` inside), then spacing and grouping; a hairline (`line-subtle`) draws only where two regions meet, and `line-strong` outlines only what a hand types into. A panel on the canvas carries no border: at most the `edge`, a 1px inset of `line` at 70 %, where a white panel sits on another white surface or a tone control must read as a control. For the few things that float, one shadow from the ink-tinted vocabulary. Rows and cards in lists carry no shadow. The topbar, the sheet's action bar and the composer's footer are frosted glass rather than lifted.

### Shadow Vocabulary
- **xs** (`0 1px 2px 0 rgb(15 19 15 / 0.06)`): the topbar search field on focus.
- **sm** (`0 1px 3px 0 rgb(15 19 15 / 0.08), 0 1px 2px -1px rgb(15 19 15 / 0.05)`): defined, unused in the kit so far.
- **md** (`0 6px 14px -4px rgb(15 19 15 / 0.12), 0 2px 4px -2px rgb(15 19 15 / 0.06)`): overlays (the typeahead list, a `Menu`, the bulk bar).
- **lg** (`0 16px 32px -8px rgb(15 19 15 / 0.16), 0 4px 8px -4px rgb(15 19 15 / 0.06)`): the record sheet and the toast.
- **edge** (`inset 0 0 0 1px rgb(216 216 212 / 0.7)`): the soft edge of a secondary button, a segmented control, the results panel and an `outlined` section. Not a border: it takes no layout and draws inside the box.
- **bloom** (`0 0 0 4px rgb(63 227 116 / 0.28)`): the signal dot's glow, and nothing else.
- **glass** (`inset 0 1px 0 rgb(255 255 255 / 0.7), 0 1px 3px rgb(15 19 15 / 0.08)`): defined for frosted panels; the kit currently uses `.glass` without it.

### Named Rules
**The Tone First Rule.** Regions separate by tone and spacing; a 1px `line-subtle` draws only where two regions truly meet (row and row, header and body, list and pane). A box inside a box is a defect: a section's panel is `surface` on `canvas` with no border, and the things inside it (tiles, stats, chips, buttons) take tone, not outlines. A shadow means something floats over the page: an overlay takes `md`, the toast `lg`.
**The Tinted Shadow Rule.** Every shadow is `ink-strong` at low alpha. A neutral black shadow is not in the vocabulary.

## Shapes

Softly squared. Controls, chips, badges, marks, result cards and the nav row take a 6px radius (`sm`); panels, cards in a section, the lock card, error notes and the toast take 10px (`md`); the 16px checkbox, skeleton bars, the V2 tag, the small source mark and the `kbd` hint take 3px (`xs`); 14px (`lg`) is defined for dialogs and 20px (`xl`) for marketing frames, neither used in the app. Full radius is for the live dot, the meter, the account initial and the composer's 32px send disc. The sheet is square-cornered and pinned to the viewport edge.

Borders are always 1px, and rare. A dashed `quiet-line` border marks nothing on file; a solid `line-strong` outline marks an input, a select or a checkbox; a 1px inset `brand` ring marks the active nav row; a tier-coloured 1px ring frames a register's logo. The locked contact block is filled with a 135° stripe (6px `locked`, 1px `locked-stripe`), never a blur.

## Components

Restrained and tactile: flat, tonal, a 2% press, colour changes on a 120 ms clock.

### Buttons (the quiet system, 27 Sep 2026)
Four tiers drawn by tone, never by outline; three sizes; six states on every tier.
- **Primary:** `brand` fill, `brand-on` text; hover `brand-hover`, pressed `brand-active`. One per screen: on the results it lives in the pane (the record's Send RFQ, the composer's Send), never on every row.
- **Secondary (`default`):** `surface-sunken` fill with the `edge`, `ink` text; hover fills `line` and lifts the text to `ink-strong`. The workhorse: Save, Open, Save search, Export, a row's RFQ.
- **Tertiary (`ghost`):** text only, `ink-muted`; hover fills `surface-sunken`. Close, Back, a menu's summary, Clear.
- **Danger:** `danger-tint` fill, `danger-ink` text; hover fills `danger` with `danger-on`. Delete, Cancel order, and only inside an inline confirm.
- **Sizes:** `sm` 28px (12px text, 8px padding) in table rows and panel headers; `md` 32px (13px, 12px padding) everywhere else; `lg` 36px (13px, 14px padding) in a sheet's action bar and a form's footer. `icon` makes any size square and requires an accessible name.
- **States:** pressed scales to 0.98 while held (120 ms, still under reduced motion); focus is the global 2px `focus` outline offset 2px; disabled drops to `ink-disabled` on the tier's own ground with no press and a `not-allowed` cursor, and a disabled control carries its reason in visible text beside it, never only in a `title`; loading swaps the leading icon for a spinning `CircleNotch`, sets `aria-busy` and disables the control without changing its width.
- **Icons:** a leading 16px Phosphor icon only where the verb has one (send, save, create, delete, download); none on a plain text action; an icon-only control carries its name.
- **Segmented control (`Seg`):** one component for every switch (table | cards, a template, a density): 32px on `surface` with the `edge`, stops divided by `line`, icon stops 36px square or text stops with 10px padding; the active stop fills `brand-tint` with `brand-ink` and a 2px inset `brand` rule along its bottom; every stop insets its focus ring.
- **Menu:** a ghost summary with a caret that turns when open; the panel is `surface` with a `line` border and the `md` shadow, rows 32px with a check beside the active one. Sort, density, rows per page, a row's more actions.

### Chips
- **Style:** 26px minimum, 13px medium, 6px radius, 10px side padding; `compact` is 22px and 12px text for a table row. Width is the data's: a chip wraps its text and never truncates.
- **Tones:** `positive` (valid, active), `caution` (expiring, expired, behind schedule), `neutral` (a plain fact, `line` outline on `surface`), `quiet` (dashed `quiet-line`, weight 400, nothing on file), `sanction` (solid maroon, reserved), `on` (`accent-tint-strong`, slate, the active filter only).
- **Badge:** 20px, 12px medium, 6px radius, 7px padding; tones `positive`, `caution`, `type` (sunken grey), `sanction`, `smart`. A certificate state, an RFQ status, a company type.
- **V2 tag:** 10px mono on `smart-tint` with a `smart-line` border, 3px radius. The stamp on every AI-assisted surface.

### Panels and sections
- **Section (`PageSection`):** a heading row (15px semibold title, a caption, an action) above a `surface` panel on the `canvas`: no border, 10px radius. `outlined` adds the `edge` where the panel sits on white; `bare` drops the panel for content that brings its own.
- **Inside a panel:** tone, not boxes. A tile or a stat is `canvas` on the white panel; a chip in a list is `surface-sunken`; a cert card keeps its 1px `line-subtle` because it is a record of its own.
- **Shadow Strategy:** none in a list; see Elevation.
- **Internal Padding:** 10px by 12px (result card), 12px by 14px (stat block, cert card), 16px (lock card, a panel's body), 20px by 24px (sheet section).

### Inputs / Fields
- **Style:** 32px tall, `surface` fill, 1px `line-strong` outline, 6px radius, 10px side padding, 13px text; placeholder in `ink-subtle` at full opacity (set once in `ds.css`).
- **Focus:** the outline steps to `brand` and an `xs` shadow appears, 120 ms; keyboard focus adds the global ring.
- **Checkbox:** a 16px `surface` box with a `line-strong` outline and 3px radius; on, it fills `brand` with a white check; mixed shows a 2px dash. Inert boxes are `aria-disabled`, never dead tab stops.
- **Error:** the `ErrorNote` block, `danger-tint` ground, `danger-ink` 13px text, 10px radius, 12px by 16px padding.

### Navigation
- **Sidebar:** 232px on `canvas`, hairline right edge; the logo is a 28px `brand` square with a mono two-letter mark beside the wordmark in Title. Items are 32px rows, 13px medium `ink` with a 16px `ink-muted` Phosphor icon, 6px radius, and a mono 11px count at the right. Hover fills `surface-sunken` and lifts text to `ink-strong`. The current page fills `accent-tint`, sets `accent-ink` at 600 and a 3px `accent` bar at the row's start; the bar, not the tint, carries the state at 3:1 (founder's video, 29 Sep 2026: the green tint and ring went). The toggle beside the logo collapses the rail to a 56px column of icons (each named on hover and to a screen reader); the `sb_rail` cookie keeps it that way, read by the server so it never flashes open. The account menu sits at the foot: photo, name (or the email's name part), Settings, Subscription, Sign out; collapsed, it is the photo alone.
- **Topbar:** 56px, `.glass` with `z-sticky` (the frosted glass is a stacking context; without the z-index its suggestion list painted under the page), hairline bottom edge; the search field (max 420px) and the shortcut hint in the buyer's own keys ("Ctrl K", "⌘K" on a Mac); the account menu, the same as the rail's, behind a 28px disc with the buyer's photo (the `tier-2` disc and initials when there is none). On the search landing the page's own large field replaces the topbar's.
- **Search field:** filled (founder's pick, 29 Sep 2026): a `surface-sunken` fill with no outline and no shadow, a step darker (`line-subtle`) under the pointer, and while typing `surface` with a 1px `line` edge and a 2px `ink-strong` line under it; the input inside draws no focus ring of its own. Suggestions list the words typed first ("Search “shirt”", Enter), then Product categories (HS headings, matched on buyers' words too), Products as filed, Certificates, Places, and last Suppliers whose name matches; mono eyebrow group headings, the typed part of each word in semibold. An empty focused field lists recent searches. A supplier opens beside the results.
- **Sheet tabs:** 40px tall, 15px medium `ink-muted`, a 2px transparent bottom border that turns `brand` when active with the label in `ink-strong`; a mono count beside the label.
- **Mobile:** below 768px the rail becomes a horizontal snap row; the skip link surfaces on focus as an outlined `surface` pill at the top left.

### Source Mark (signature)
A 20px square (16px beside a single fact, 32px heading a Sources row) with a 6px radius (3px at 16px), filled by rank on the tier ramp, carrying a two-letter mono stamp; tier 5 is white with a `tier-5-line` outline. A register with an approved logo shows it in one colour (`ink-strong` through a mask) in a white frame ringed 1px by rank. Marks row up best-rank-first with a 3px gap and a 12px caption ("11 sources"), and the row wraps. Every mark carries the register's name and tier in its accessible name, and links to the register page when the record has one.

### Ledger Grid (signature)
The working view of every list, and the default of the search. One `DataTable` grammar: a header row of 12px medium `ink-muted` labels on `surface`, sticky to the top of the column's scroll from 1280px; sortable headers are links with `aria-sort` and a caret on the active column; rows 40px (`compact` 36, `comfortable` 48) divided by `line-subtle`, names at 14px and source marks at 20px; numbers right-aligned and tabular; the whole row lit `surface-sunken` on hover and on keyboard focus; the row open in the pane marked `brand-tint` with `aria-current`; a selected row carries a 2px inset `brand` rule, a sanctioned one the 3px `sanction` rule and the word under its name. A row's actions (Save, Open beside, RFQ) are always drawn, in a column of their own at the row's end, as 28px ghost icon buttons with their names: shown only under the pointer they read as missing, and when they appeared they pushed the name onto three lines (founder, 28 Sep 2026). The keyboard: ↑ ↓ (or j k) move between rows, ↵ opens the record, Space selects, r opens the RFQ composer for the row, s saves. Export lines read as codes in mono; certificates as up to two one-line pills (the scheme, its state as an icon, and only "17 d" or "expired" in words) and a count; workers as the record's own figure with the profile's under it wherever the two differ, the same pair on Saved, the second figure breaking from its words ("11,119" over "with buildings") where the column is narrow rather than running under the row's icons; a name wraps between words and never ellipsises. Beside a pane the sources column is the count and the best mark, headed "Sources". The columns, in px: 40 · supplier · 160 · 212 · 112 · 144 · 104, and beside a pane 36 · supplier · 76 · 104 · 66. Every link that opens something beside the results says it heard the click at once: a spinner after the name, or in place of an icon-only button's icon, while the server answers.

### Record Sheet (signature)
A `surface` pane beside the results, both live: from 1024px it is `clamp(480px, 50%, 760px)` of the content region with a 1px `line` left rule, below that the whole region. While a record or a line is read the pane shows that thing's own silhouette: the record's, or a line's (its bar, photo and fact rows), never the whole record's on the way to a line; the RFQ composer has its own too. Nothing modal, no scrim, no shadow. It enters by sliding 32px in from the right (320 ms, `cubic-bezier(0.16, 1, 0.3, 1)`); closing is a navigation back to the search and lands at once. Expand (the bar's last control) opens the record's own page over the whole content region, carrying the list in `?back=` so "Back to results" returns to it with the record open; with the rail collapsed that is the full-screen view. Inside: a 52px bar (title, read range, source count, Share), the record head (48px initials tile on the top source's rank colour, the name in Headline, facts inline, the marks row), tabs that stick to the top of the pane's scroll, then sections at 24px by 20px each under a hairline; Sources, Locations, Facilities and RFQs fold behind their heading. The Overview groups its facts under mono eyebrows (Company, Location, Workforce and capacity, Registrations) at the pane's full width; the registers are a list, one registration a line with its register's square. A fact without a per-field mark carries a dashed empty square in the mark column, named "Source pending", and one legend under the facts says what the square means. A certificate's scope is laid out as the register's own labelled parts (Operations, Products), and the product list merges spellings, sorts and folds after eight. The contact block is a `LockCard` strip under the facts, never a column beside them: striped ground, `ink-strong` label, `locked-ink` copy, and the count per kind of contact on file (email, phone, website, contact person) inline, never a value and never a blurred detail. The action bar at the foot holds one primary `lg` Send RFQ, which opens the composer in the same pane, beside a secondary Save.

### RFQ Composer (signature)
The one place a buyer writes to suppliers, opened inside the shell: in the wide pane beside the results (`?rfq=` on the search, carrying one supplier or the ticked selection, up to 50), beside a record (with Back to it), or as the content region of `/app/rfqs/new` for a deep link or a saved draft. A 52px bar (Back, "New RFQ", who it goes to, Draft saved, Close); then the targets on `surface-sunken` with their marks and a remove each; the product (title, description, quantity, unit, target price, currency, ship to, ship by: selects where the answer is a list); the message, filled from the workspace's template with its facts, a missing fact shown in brackets and named under the field; the questions, ticked on by default, removable, with an add field. Beside the fields from 1280px, the preview of what the RFQ carries on `surface-sunken`. A frosted footer names what is still needed in caution ink, or the sanction in maroon, holds Save draft (secondary) and Send RFQ (primary, with its ⌘↵ hint), and Send stays disabled until nothing is missing and no target is sanctioned; the server refuses a sanctioned target too. On send the pane closes onto the search it sat beside, and a toast says "RFQ sent" with a link to it.

### Filter pane
**Filter menus** (29 Sep 2026): under the landing's field and over the results, one row of menus (Product, Certificate, Place, Company type, More), each a list of links that toggle one value, a check on the set ones; a menu with a value set is filled `accent-tint-strong` and names the value (or "2 selected") on its button; on the landing each option carries how many published suppliers it finds. A filter a menu holds is not drawn again as a chip; the rest (the query, a register, a brand list, a range, Sanctioned hidden) stay chips. The pane holds every filter.

Add filter opens the filters in the pane beside the results, one GET form grouped the way a sourcing manager thinks: what it exports (HS heading with the catalogue's suggestions), what it holds (certificate and its state, RSC), who filed it (registers as ticks, a minimum count), who lists it (brands as ticks), where it is, what kind of company. Selects and ticks, never a typed syntax. Apply is the pane's one primary; each chip in the search bar removes one filter.

### Lists with a pane (orders, RFQs, saved, messages)
Every list works like the search: the ledger on the left, the thing opened from it beside it (`?open=<id>` on orders, RFQs and saved suppliers; `?record=<slug>` on a conversation), Close back to the same list, focus returned to the row that opened it. A deep link to one order or RFQ still has a page of its own, drawn inside the shell, never under a loading screen that would hide a 404. A quote is accepted from the RFQ pane in place; an order's milestones read as a dated list, newest first.

### Product base
The buyer's own products, the thing an RFQ is about. The list is a ledger with a photo tile, number, category, price, MOQ and state, tabbed Draft, Active and Archived. New product asks once how to start: "Start manually" (the default: only the name is required) or "Start with AI", which exists only behind the AI flag and says it arrives with V2 until then. The form is sections on tonal panels: Basic, Classification, Media, Variants (options and every combination), Size chart (points of measure with tolerances), BOM, Production, Tech pack. A saved product carries "Send RFQ", which opens the composer prefilled from it; suppliers are added there from saved suppliers, a search, or recent RFQs.

### Settings
One content region with a section list: Workspace (company facts the RFQ template reads), Subscription (the plan and what it unlocks, no fake checkout), Members (arrives with Enterprise, said plainly), Inquiry (the default questions and the message template, with its variables named), Profile, Notifications. Each section saves in place with a toast; nothing is a modal.

### Empty State
Centred in the panel: a 128px spot illustration (single-weight `ink` line art with one `brand` fill, from `public/illustrations/`, rising 8px over 320 ms), a 17px semibold title, one line of 14px `ink-muted` copy, and one action. `compact` drops to an 88px image and 32px vertical padding; `QuietEmpty` inside a sheet is a 36px `surface-sunken` icon disc and a left-aligned title. No warning colour anywhere in an empty state.

### Toast
A `surface-inverse` pill (10px radius, 10px by 14px padding, `lg` shadow) with `ink-inverse` 13px medium text, an 8px `signal` dot with its bloom, and a `brand-ink-inverse` link. It rises in over 320 ms from the bottom centre.

## Do's and Don'ts

### Do:
- **Do** reach every colour through a Tailwind token class (`bg-brand`, `text-ink-muted`); the only place a hex may be typed is `lib/design/tokens.ts`, and `tokens.test.ts` fails the build otherwise.
- **Do** leave room beside every fact for its source mark and a link to the register; a row with no mark carries the dashed pending square, and the legend under the facts says "source pending" once.
- **Do** let names, chips and values wrap (`overflow-wrap: anywhere` as the last resort), between words: give a name's column the width of its longest word; a fixed height on anything that holds a company's name is a defect.
- **Do** keep entrances on the three lengths: 120 ms for a control's colour and press, 200 ms for a fade or the composer's scrim, 320 ms for a rise or the sheet; opacity leads every entrance and `both` fill keeps the element visible if the stylesheet fails.
- **Do** pair `animate-*` with `motion-reduce:animate-none`; `ds.css` also zeroes every duration under `prefers-reduced-motion`, and nothing depends on a frame arriving.
- **Do** draw the locked contact state with `.locked-pattern` and a count sentence; the card claims only what the count says.
- **Do** use Phosphor regular at 16px (12px inside a chip), taking the text colour beside it, and name it only when it is not decorative.
- **Do** add any new text/background pair to `contrastPairs` before using it; an unlisted pair is unchecked.
- **Do** format every date, time, amount and quantity through `lib/dashboard/facts.ts` (`formatDay` "12 May 2027", `formatTime` "12 Sep 2026, 14:30", `formatRelative` for a secondary caption only, `formatMoney` "6.15 USD", `formatQuantity` "12,000 pcs"); a locale-dependent `toLocaleDateString` is a defect.

### Don't:
- **Don't** open a secondary interface as a page jump or a modal over the shell: it opens in the pane beside where the buyer is, and Close returns there.
- **Don't** put a border round a panel on the canvas, or a box inside a box; group by tone and spacing.
- **Don't** put a primary button on every row of a list; the one primary lives in the pane.
- **Don't** show a score, grade, rating, star or percentage of fit on a buyer surface; the remediation percentage is a filed figure with its source, not a judgment.
- **Don't** put brand green on a chip, badge, state, or fact; verified is `positive` teal, and the only green fills are the primary button, the logo, and the active nav row's tint.
- **Don't** reuse `sanction` for an error, or `danger` for a sanction.
- **Don't** blur, pixelate or grey out locked data; stripe the block and say what is held.
- **Don't** colour an empty or unverified state with caution or danger; it sits on `quiet`.
- **Don't** put a shadow on a row or a card in a list, or type a shadow by hand; the four-step ink-tinted vocabulary is the whole set.
- **Don't** animate an exit or a loop for decoration; a close, a navigation and a dismiss land at once.
- **Don't** truncate a name with an ellipsis, cap a chip's height, or set `white-space: nowrap` on anything that carries a register's text.
- **Don't** set mono on body text, or 600 on a heading that the `Heading` component draws at 500.
- **Don't** add a package for anything the kit already draws (icons are Phosphor, fonts are self-hosted Geist, illustrations are cleaned SVGs in `public/illustrations/`).
