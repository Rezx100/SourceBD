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
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "{spacing.control}"
  button-default-hover:
    backgroundColor: "{colors.surface-sunken}"
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
    padding: "0 16px"
    height: "{spacing.control-lg}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "{spacing.control}"
  button-ghost-hover:
    backgroundColor: "{colors.surface-sunken}"
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
    width: "880px"
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

The buyer app is a ledger of receipts. Every screen is a page of neutral paper (`canvas`) with white panels laid on it, separated by hairlines rather than shadows, and every fact on the page has room beside it for the mark of the register that filed it. Density is desk-level: 13px labels, 14px body, 36px table rows, 32px controls, a 232px rail and a 56px frosted topbar. Colour is spent like money. The shell is near-monochrome on a neutral grey ramp, the brand green appears only where the buyer acts (the primary button, links, the active nav row, the logo), and status hues (teal-green, amber, red, and the reserved sanction maroon) appear only on facts that carry that status.

The world refuses the competitor's chat-first home and its match-score theatre: there is no score, grade, rating or star anywhere on a buyer surface. It also refuses decoration: the one flourish is the `signal` dot, a bright green point beside a live number or in a toast, and the empty-state spot illustrations, single-weight ink line art with one brand-green fill. Motion is acknowledgement, not spectacle: entrances only, opacity-led, at 120 / 200 / 320 ms, and nothing is lost when the device asks for reduced motion.

**Key Characteristics:**
- Neutral paper canvas, white panels, hairline dividers; depth by tone and border, not shadow.
- Geist for words, Geist Mono for the ledger's stamps (register numbers, column keys, source marks, counts).
- Brand green on the primary action, links, active nav and the logo only; never a badge, never a state.
- Source rank drawn as a neutral lightness ramp, so colour stays free for status.
- Locked contact details are striped, never blurred; empty and unverified are quiet, never alarming.
- Names wrap at every size; nothing truncates a company name.
- Entrances only: fade 200, rise 320, sheet-in 320 over a 200 ms scrim; exits land at once.

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
- **Panel White** (`surface`): cards, the sheet, inputs, the tier-5 mark. `surface-sunken` is filter rails, table headers, the type badge, hover on default and ghost buttons, the locked ground. `surface-inverse` is the toast and dark bands.
- **Ink ramp** (`ink-strong` headings and names, `ink` body, `ink-muted` labels and secondary text, `ink-subtle` captions, placeholders and mono stamps, `ink-disabled` disabled controls only). Every ramp step but `disabled` passes 4.5:1 on canvas, surface, sunken, locked and quiet; `tokens.test.ts` enforces the pairs.
- **Hairlines** (`line-subtle` dividers and card borders, `line` the sheet's left rule and the neutral chip, `line-strong` input and control outlines at 3:1).
- **Locked** (`locked` with `locked-stripe` at 135°, `locked-ink`, `locked-line`): the contact block by default.
- **Tier ramp** (`tier-1` darkest to `tier-5` white with a `tier-5-line` outline): the source mark's fill and the logo tile, darkest is most trusted.

### Named Rules
**The Spent Green Rule.** Brand green appears on four things: the primary button, link text, the active nav row, and the logo. It is never a badge fill, never a chip tone, never a state colour, so it can never be read as "verified".
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
**The Wrapping Name Rule.** A company name, a chip that carries a building's name, and a fact value all set `overflow-wrap: anywhere` and never a fixed height or `text-overflow: ellipsis`. The only truncation in the kit is the topbar search placeholder.
**The Stamp Rule.** Mono is for what a register filed, not for emphasis: reference numbers, codes, counts, column keys, the two-letter marks. Body text is never mono.
**The Light Heading Rule.** Headings and company names are weight 500. Weight 600 appears on the page `h1`, section titles and the remediation figure only; 700 is unused in the app.

## Layout

The shell is a 232px sidebar on `canvas` (hairline right edge), a 56px frosted topbar (`.glass`: surface at 80% with a 16px blur, hairline bottom edge) and a content column capped at 1200px (`max-w-content`). Prose caps at 68ch. Page gutter is 24px at 1024px and up, 16px below; the topbar keeps 16px, stepping to 24px at 640px.

Spacing sits on Tailwind's 4px grid, and the kit uses a small set of stops: 2 / 4 / 6 / 8 / 10 / 12 / 16 / 20 / 24. Card interiors are 12px by 10px (the result card) or 16px by 12px (a panel card, a cert card); a sheet section is 24px by 20px; the lock card is 16px. Fixed heights are the density stops: 32px controls and nav rows, 40px primary actions in the sheet's action bar, 36px dense result rows, 44px relaxed list rows, 28px minimum fact rows, a 52px minimum sheet bar.

The record sheet is an 880px column pinned to the right edge over a 32% `surface-inverse` scrim; it takes full width below that. A fact row is a label column of 150px (160px in `DetailList`) beside a value that wraps, with the source mark and the "checked" caption at the row's end; it stacks below 640px. Stats run four across, two across below 640px. Tables live in a horizontal scroll region with a minimum width (40rem default, 62rem for results) so a phone scrolls them sideways rather than crushing them.

Below 768px the sidebar becomes a horizontal snap-scrolling row of nav items under the logo; the plan block and recent searches hide. The document never goes narrower than 320px.

## Elevation & Depth

Flat by default, tonal in layers. Depth is read from three things: the ground (`canvas` below `surface`, `surface-sunken` inside), a hairline (`line-subtle` for dividers and card edges, `line-strong` for anything a hand touches), and, for the few things that float, one shadow from a four-step ink-tinted vocabulary. Rows and cards in lists carry no shadow. The topbar and the sheet's action bar are frosted glass rather than lifted.

### Shadow Vocabulary
- **xs** (`0 1px 2px 0 rgb(15 19 15 / 0.06)`): the topbar search field on focus.
- **sm** (`0 1px 3px 0 rgb(15 19 15 / 0.08), 0 1px 2px -1px rgb(15 19 15 / 0.05)`): defined, unused in the kit so far.
- **md** (`0 6px 14px -4px rgb(15 19 15 / 0.12), 0 2px 4px -2px rgb(15 19 15 / 0.06)`): overlays (the typeahead list).
- **lg** (`0 16px 32px -8px rgb(15 19 15 / 0.16), 0 4px 8px -4px rgb(15 19 15 / 0.06)`): the record sheet and the toast.
- **bloom** (`0 0 0 4px rgb(63 227 116 / 0.28)`): the signal dot's glow, and nothing else.
- **glass** (`inset 0 1px 0 rgb(255 255 255 / 0.7), 0 1px 3px rgb(15 19 15 / 0.08)`): defined for frosted panels; the kit currently uses `.glass` without it.

### Named Rules
**The Hairline Rule.** Surfaces separate by a 1px `line-subtle`, not a shadow. A shadow means something floats over the page: an overlay takes `md`, a dialog or toast takes `lg`.
**The Tinted Shadow Rule.** Every shadow is `ink-strong` at low alpha. A neutral black shadow is not in the vocabulary.

## Shapes

Softly squared. Controls, chips, badges, marks, result cards and the nav row take a 6px radius (`sm`); panels, cards in a section, the lock card, error notes and the toast take 10px (`md`); the 16px checkbox, skeleton bars, the V2 tag, the small source mark and the `kbd` hint take 3px (`xs`); 14px (`lg`) is defined for dialogs and 20px (`xl`) for marketing frames, neither used in the app. Full radius is for the live dot, the meter, the account initial and the composer's 32px send disc. The sheet is square-cornered and pinned to the viewport edge.

Borders are always 1px. A dashed `quiet-line` border marks nothing on file; a solid `line-strong` outline marks an input or a control; a 1px inset `brand` ring marks the active nav row; a tier-coloured 1px ring frames a register's logo. The locked contact block is filled with a 135° stripe (6px `locked`, 1px `locked-stripe`), never a blur.

## Components

Restrained and tactile: flat, outlined, a 2% press, colour changes on a 120 ms clock.

### Buttons
- **Shape:** softly squared (6px), 32px tall, 12px side padding, 13px medium; `lg` is 40px tall with 16px padding for the sheet's action bar; `icon` makes it a 32px or 40px square.
- **Default:** `surface` fill, `line-strong` 1px outline, `ink` text; hover fills `surface-sunken`.
- **Primary:** `brand` fill and border, `brand-on` text; hover `brand-hover`, pressed `brand-active`; disabled becomes `surface-sunken` with `line` border and `ink-disabled` text. One primary per screen.
- **Ghost:** no outline, `ink-muted` text; hover fills `surface-sunken`.
- **Press / Focus:** every button scales to 0.98 while held (120 ms in and out, still under reduced motion); colour, border and shadow move on the same 120 ms clock; focus is the global 2px `focus` outline offset 2px.
- **Segmented toggle (`Seg`):** the same outline and height, 36px cells divided by `line-strong`; the active cell fills `brand-tint` with `brand-ink` and a 2px inset `brand` rule along its bottom.

### Chips
- **Style:** 26px minimum, 13px medium, 6px radius, 10px side padding; `compact` is 22px and 12px text for a table row. Width is the data's: a chip wraps its text and never truncates.
- **Tones:** `positive` (valid, active), `caution` (expiring, expired, behind schedule), `neutral` (a plain fact, `line` outline on `surface`), `quiet` (dashed `quiet-line`, weight 400, nothing on file), `sanction` (solid maroon, reserved), `on` (`brand-tint-strong`, the active filter only).
- **Badge:** 20px, 12px medium, 6px radius, 7px padding; tones `positive`, `caution`, `type` (sunken grey), `sanction`, `smart`. A certificate state, an RFQ status, a company type.
- **V2 tag:** 10px mono on `smart-tint` with a `smart-line` border, 3px radius. The stamp on every AI-assisted surface.

### Cards / Containers
- **Corner Style:** 10px on a section panel, a stat block, a cert card, the lock card, an error note; 6px on the result card.
- **Background:** `surface` on `canvas`.
- **Shadow Strategy:** none in a list; see Elevation.
- **Border:** 1px `line-subtle`; `locked-line` on the lock card.
- **Internal Padding:** 10px by 12px (result card), 12px by 14px (stat block, cert card), 16px (lock card), 20px by 24px (sheet section).

### Inputs / Fields
- **Style:** 32px tall, `surface` fill, 1px `line-strong` outline, 6px radius, 10px side padding, 13px text; placeholder in `ink-subtle` at full opacity (set once in `ds.css`).
- **Focus:** the outline steps to `brand` and an `xs` shadow appears, 120 ms; keyboard focus adds the global ring.
- **Checkbox:** a 16px `surface` box with a `line-strong` outline and 3px radius; on, it fills `brand` with a white check; mixed shows a 2px dash. Inert boxes are `aria-disabled`, never dead tab stops.
- **Error:** the `ErrorNote` block, `danger-tint` ground, `danger-ink` 13px text, 10px radius, 12px by 16px padding.

### Navigation
- **Sidebar:** 232px on `canvas`, hairline right edge; the logo is a 28px `brand` square with a mono two-letter mark beside the wordmark in Title. Items are 32px rows, 13px medium `ink-muted`, 6px radius, a 16px Phosphor icon and a mono 11px count at the right. Hover fills `surface-sunken` and lifts text to `ink-strong`. The current page fills `brand-tint`, sets `brand-ink` at 600 and a 1px inset `brand` ring; the ring, not the tint, carries the state at 3:1.
- **Topbar:** 56px, `.glass`, hairline bottom edge; the search field (max 360px) and a `Kbd` hint; the account link is a 28px `tier-2` disc with the buyer's initial.
- **Sheet tabs:** 40px tall, 15px medium `ink-muted`, a 2px transparent bottom border that turns `brand` when active with the label in `ink-strong`; a mono count beside the label.
- **Mobile:** below 768px the rail becomes a horizontal snap row; the skip link surfaces on focus as an outlined `surface` pill at the top left.

### Source Mark (signature)
A 20px square (16px beside a single fact, 32px heading a Sources row) with a 6px radius (3px at 16px), filled by rank on the tier ramp, carrying a two-letter mono stamp; tier 5 is white with a `tier-5-line` outline. A register with an approved logo shows it in one colour (`ink-strong` through a mask) in a white frame ringed 1px by rank. Marks row up best-rank-first with a 3px gap and a 12px caption ("11 sources"), and the row wraps. Every mark carries the register's name and tier in its accessible name, and links to the register page when the record has one.

### Record Sheet (signature)
An 880px `surface` column pinned right with a 1px `line` left rule and the `lg` shadow, over a 32% `surface-inverse` scrim. It enters by sliding 32px in from the right (320 ms, `cubic-bezier(0.16, 1, 0.3, 1)`) while the scrim fades (200 ms); closing lands at once. Inside: a 52px bar (title, read range, source count, Share), the record head (48px initials tile on the top source's rank colour, the name in Headline, facts inline, the marks row), tabs, then sections at 24px by 20px each under a hairline. The contact block is a `LockCard`: striped ground, `ink-strong` label, `locked-ink` copy, and a count sentence, never a blurred detail. The action bar at the foot holds one primary `lg` button beside default ones.

### Empty State
Centred in the panel: a 128px spot illustration (single-weight `ink` line art with one `brand` fill, from `public/illustrations/`, rising 8px over 320 ms), a 17px semibold title, one line of 14px `ink-muted` copy, and one action. `compact` drops to an 88px image and 32px vertical padding; `QuietEmpty` inside a sheet is a 36px `surface-sunken` icon disc and a left-aligned title. No warning colour anywhere in an empty state.

### Toast
A `surface-inverse` pill (10px radius, 10px by 14px padding, `lg` shadow) with `ink-inverse` 13px medium text, an 8px `signal` dot with its bloom, and a `brand-ink-inverse` link. It rises in over 320 ms from the bottom centre.

## Do's and Don'ts

### Do:
- **Do** reach every colour through a Tailwind token class (`bg-brand`, `text-ink-muted`); the only place a hex may be typed is `lib/design/tokens.ts`, and `tokens.test.ts` fails the build otherwise.
- **Do** leave room beside every fact for its source mark and a link to the register; a row with no mark reads "source pending" in a caption.
- **Do** let names, chips and values wrap (`overflow-wrap: anywhere`); a fixed height on anything that holds a company's name is a defect.
- **Do** keep entrances on the three lengths: 120 ms for a control's colour and press, 200 ms for a fade or the scrim, 320 ms for a rise or the sheet; opacity leads every entrance and `both` fill keeps the element visible if the stylesheet fails.
- **Do** pair `animate-*` with `motion-reduce:animate-none`; `ds.css` also zeroes every duration under `prefers-reduced-motion`, and nothing depends on a frame arriving.
- **Do** draw the locked contact state with `.locked-pattern` and a count sentence; the card claims only what the count says.
- **Do** use Phosphor regular at 16px (12px inside a chip), taking the text colour beside it, and name it only when it is not decorative.
- **Do** add any new text/background pair to `contrastPairs` before using it; an unlisted pair is unchecked.

### Don't:
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
