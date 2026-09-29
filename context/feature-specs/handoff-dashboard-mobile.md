# Buyer app on a phone — scrolling, trays, alignment, list and cards, touch — hand-off

Written 30 Sep 2026, after the no-slate change went live (`main` `7d46e2b`,
deployed 29 Sep 17:47 UTC). Every file:line below was read at `development`
`cdde378` (the same tree as `main` `7d46e2b`); re-check before you rely on one
(AGENTS 13, 16). The founder sent four phone screenshots of the live build,
then a two-minute screen recording at phone width with narration, and asked
for one hand-off covering both. Everything marked **reproduced** was measured
in Chrome at 390×844 with touch emulation; Appendix A has the script.

The founder builds the recommended default every time ("build the recommended
defaults without asking me"), so the decisions below are decisions, not open
questions. Build them.

## The founder's words (verbatim)

> now write a hand off to fix the mobile alignment, scrolling issue, drop down
> tary issue, size adjustment of the alignment, list view and card view
> resizeing and alingment, touch responsiveness issue and ux.

> here are few more issues to fix , please watch the video and combine these
> with yours on the handoff

The recording's narration (spoken in English; machine transcript, lightly
cleaned; "task" in the raw transcript is "tray", "Movin" is Mobbin):

> 0:13 You can see this card section is not aligned properly. 0:19 If I click
> More and then click Place, this overlaps here. This must be aligned and
> fixed properly, and the tray has to be fixed properly. 0:40 And the card view
> [must] be fixed. The icons, the fonts and everything is very very improper
> here. It must be referenced from Mobbin — see what the big companies are
> doing, then fix it accordingly. 1:01 And if I go to a company profile, it has
> a scrolling issue: it doesn't go down, and the spacing must be fixed. There
> is no compaction at all. 1:26 If I go back and click on RFQ, you see the
> scrolling doesn't work here, and the font and the size and everything isn't
> properly done for the phone view. 1:50 So the phone view is a big issue
> here, and these things need to be properly fixed. The mobile alignment issue
> is a very big problem here. I hope you understand and fix this properly.

Then, while this hand-off was being written (30 Sep), with two screenshots: a
reference bottom tab bar (Feed, Explore, Jobs, Events, Inbox; icons over
labels, the current one filled, a red count on Inbox) and our top strip
("Search", "Suppliers 10,266", "Products", cut at the edge):

> on mobile the navigation must be on the bottom part of the screen so that UX
> is top notch and user find it handy. right now it's set at the top and very
> hard to use.

That settles D9 and moves it forward: it is PR M1, straight after the
scrolling fix.

## What the founder showed

Images are on the screenshot gist
(`https://gist.githubusercontent.com/Rezx100/35359ef770a906fa2c84a9fed2630f10/raw/<file>`).

**Four screenshots**, live build, a phone about 355px wide:

1. `mob-founder-1-results.png` — the search. The filter box has a funnel
   floating alone at the left, mid-height; Product/Certificate, then
   Place/Company type, then More on three rows, indented; the green arrow
   floating at the right; "Sanctioned hidden ×" and "+ Add filter" under them.
   The header: "All published suppliers except sanctioned" on two lines beside
   "10,266 / suppliers · 1– / 25" on three; the toolbar in three right-aligned
   rows (sort; Density + Save search; Export CSV + the view switch). The table
   shows Supplier and Sources only, names cut at ~11 characters ("Modele De
   C…"), the third source mark cut at the screen edge.
2. `mob-founder-2-two-trays.png` — Product's tray open, and Place's tray open
   on top of it.
3. `mob-founder-3-card.png` — a card: actions on their own row under the name,
   "Factory · Dhaka, Naray…" cut, the marks wrapping onto two lines, each chip
   on its own line ("SA8000 expired 23 Jul 2021" wrapping inside its chip), the
   thumbnails cut at the right edge ("6…"), "+7 lines illustration" squeezed.
4. `mob-founder-4-record.png` — the record: "Modele De Capita…" cut after ~15
   characters in the 28px headline; the facts on four lines, each starting with
   a hanging "·"; the marks wrapping; "9 sources" alone on a line; the tabs cut
   at "Safe…" with no sign they scroll; each fact's source mark on a third line
   under the value.

**The recording** (2:12, 532×900, Chrome device mode with touch; frames named
by second):

| Time | What happens | Frame |
| -- | -- | -- |
| 0:05 | The landing's field opens "Recent searches" over "Common searches"; it stays open while the founder taps elsewhere | `mob-video-0005-landing-recent.jpg` |
| 0:20–0:35 | More opens, then Place opens over it; both stay open; taps on the page do not close them; the table scrolls sideways under them and the names slide off the left edge | `mob-video-0025-two-trays.jpg`, `mob-video-0033-table-sideways.jpg` |
| 0:40–1:00 | The card view | `mob-video-0043-cards.jpg` |
| 1:03–1:25 | A record: every swipe does nothing; the page never moves | `mob-video-0075-record-no-scroll.jpg` |
| 1:26–1:45 | Back, Send RFQ: the composer does not scroll either | `mob-video-0095-rfq-no-scroll.jpg` |
| 1:50–2:10 | The nav strip scrolls sideways with a scrollbar showing under it (the thumbnails show one too); back to the list | `mob-video-0115-nav-strip.jpg` |

## What is wrong (causes, most severe first)

**R1. Reproduced: the record and the RFQ composer cannot be scrolled on a
phone at all.** `SheetScroll` (`components/dashboard/sheet.tsx:191`) is
`min-h-0 flex-1 overflow-y-auto overscroll-contain`. From `md` the shell is a
fixed frame (`app-shell.tsx:278` `md:h-dvh`) and this box scrolls itself.
Below `md` the document scrolls instead, so the box grows to its content and
never scrolls. It is still a scroll container, though, and
`overscroll-behavior: contain` stops the swipe from passing to the page. A
touch swipe at 390×844:

| Page | As shipped | SheetScroll `overscroll-behavior: auto` | SheetScroll `overflow-y: visible` |
| -- | -- | -- | -- |
| Record (5,309px tall) | nothing moves | page scrolls 397px | 435px |
| RFQ composer (2,148px) | nothing moves | 451px | 397px |
| Results (the control) | page scrolls 428px | | |

A mouse wheel fails the same way, so a desktop window narrowed below 768px is
stuck too. The comment at `sheet.tsx:181-186` says why `overscroll-contain`
went in (a pane's scroll must not chain into the results beside it): true from
`lg`, wrong below `md`.

**R2. On a phone the record's tabs do nothing when tapped, and never stick.**
`goToSection` (`sheet-tabs.tsx:27-34`) finds `[data-sheet-scroll]`, cancels the
browser's own jump, then scrolls a box that cannot scroll. `sticky top-0`
(`sheet-tabs.tsx:66`) binds to the nearest scroll container, the same box, so
it never sticks. `<main>` (`app-shell.tsx:304`, `overflow-y-auto`) and the
results column (`sheet.tsx:150`, `overflow-y-auto`) are scroll containers that
never scroll below `md` either, which defeats every sticky element inside them:
the selection bar (`selection-bar.tsx:143`) and the filter pane's Apply bar
(`discover-filters.tsx:198`) too.

**R3. Trays: two open at once, none closes on a tap outside, and they run off
the screen.**
- The kit `Menu` (`controls.tsx:403`) is a bare `<details>`: no `name`, no
  Escape, no outside tap. Only its own summary or a navigation closes it.
  Every filter menu, sort, density, per page and the products ⋯ use it.
- Two open trays share `z-overlay` in one stacking context, so the later one
  (Place) paints over More.
- The panel is `absolute … min-w-[12rem] max-w-[calc(100vw-2rem)]`, anchored
  `left-0` (`controls.tsx:421-425`); the filter menus add `min-w-[17rem]`
  (`filter-menus.tsx:84`). Place starts near x=240 on a 355px phone, so its
  tray ends near x=510, clipped by the results column.
- No max-height, no inner scroll, no flip near the bottom; no scrim and no
  scroll lock, so a tap "outside" lands on the link underneath.
- The typeahead closes on a `document` `mousedown`
  (`search-typeahead.tsx:218-221`). iOS sends no mouse events for a tap on
  plain content, so "Recent searches" stays open (recording 0:05).
- Only the account menu closes properly (`account-menu.tsx:51-77`,
  `pointerdown` + Escape). The report ⋯ (`report-problem.tsx:60-74`) closes on
  Escape only; the reason notes (`sheet.tsx:295`) on nothing.
- `role="menu"`/`menuitem` (`controls.tsx:416,456`) promise arrow keys that do
  not exist.

**R4. The phone gets the 960px desktop table.** `view` defaults to the table
with no viewport logic (`lib/discover-v32-state.ts:254-256`); the table is
`min-w-[60rem]` in a `max-xl:overflow-x-auto` region
(`results-table.tsx:154,162`). The compact columns only apply beside an open
pane (`app/(app)/app/discover/page.tsx:291`), which a phone never shows (the
column is `hidden lg:flex`, `sheet.tsx:150`). On 355px: checkbox 0–40,
Supplier 40–220 (the name gets ~104px), Sources 220–372, so the third mark is
cut at 323; Certificates, Export lines, Workers and the row actions
(x 856–960) are off to the right; the whole table scrolls sideways under the
filter box (recording 0:33).

**R5. The filter box is a desktop toolbar squeezed** (`search-composer.tsx`).
The box (`:63`, `flex items-center gap-3`) makes three columns: the funnel
(`:67`), a wrapping middle (`:70`), the arrow (`:188`). `items-center` floats
the funnel and the arrow mid-height; the menus start 42px in; five `h-7`
menus wrap 2/2/1 in the ~247px middle (`filter-menus.tsx:68`); the chips
(`:84`) and "Add filter" (`:106`) start a new row. No breakpoint changes any of
it. The arrow submits a form holding only hidden fields
(`discover/page.tsx:200-213`): on a phone it reloads the same search.

**R6. The results header takes five lines** (`results-panel.tsx:138-190`). The
title and the count share a row that never wraps (`:140`), so the count breaks
inside its range: the en dash in `rangeLabel` (`:51-55`) is a break
opportunity. The toolbar (`:153`, ~590px of controls, `justify-end flex-wrap`)
wraps into three right-aligned rows.

**R7. The card is the desktop card at 195px** (`supplier-result-card.tsx`).
- A side column (checkbox + 48px tile, `:154`, `:159`) leaves the text 195px at
  355 (230 at 390).
- The name claims 192px (`:167`), so the three actions (~207px, `:180`) drop to
  their own row.
- The facts line is one line, cut (`:93`).
- The marks are 24px squares that wrap after seven (`:203`; `marks.tsx:62,122`).
- Four chips, one per line; the compact chip wraps inside itself on purpose
  (`chips.tsx:54-55`).
- Six 48px thumbnails need 328px; "+7 lines / illustration" cannot shrink, so
  two thumbs and a sliver show, in a strip that scrolls without snap
  (`photo-tiles.tsx:240-255`).
- The only breakpoint on the card is `min-[1440px]` (`:196`). The icons and
  type are desktop sizes; "improper" in the founder's words.

**R8. The record is not built for a phone ("no compaction at all").**
- Name: `Heading level="lg"` is 28px at every width, with `truncate`
  (`supplier-sheet.tsx:200-203`; `type.tsx:63-68`): ~15 characters, the full
  name only in `title`, which a phone never shows.
- Facts line (`MetaLine`, `supplier-result-card.tsx:38-44`): each fact after
  the first draws its "·" as a `before:` pseudo-element inside the next fact,
  so a wrap carries the dot to the start of the line.
- The marks row wraps and "9 sources" takes a line of its own
  (`marks.tsx:122,127`); the same count is in the bar and on the Sources tab.
- Fact rows stack the label, the value and then the mark on a third line
  (`sheet.tsx:333,339,387`): ~80px per fact.
- The bar shows "Read 1…", cut (`sheet.tsx:178`;
  `supplier-sheet.tsx:167-174`).
- The tab strip is cut at the right with no sign it scrolls
  (`sheet-tabs.tsx:66`: scrollbar hidden, no fade, no snap).
- The action bar with Send RFQ and Save (`sheet.tsx:950`) is neither sticky
  nor fixed on a phone: it sits at the very end of the record (the comment at
  `:922` says it is pinned; it is not).
- No safe-area padding anywhere, though `viewportFit: "cover"` is set
  (`app/layout.tsx:41`).

**R9. Touch: most controls are too small to hit, and some only work with a
mouse.** Nothing reaches 44px (Apple) / 48dp (Material); several are under
WCAG 2.5.8's 24px.

| Control | Where | Size today |
| -- | -- | -- |
| Row checkbox, select-all | `controls.tsx:295` | 16px; the cell is not clickable |
| Row Save / Open / Send RFQ | `results-table.tsx:313,321,342` | 28px, 2px apart |
| Filter, sort, density menus | `filter-menus.tsx:82`; `results-panel.tsx:155,168` | 28px; items ~32px |
| Chip × | `search-composer.tsx:91` | a bare 12px icon |
| Card chip links, status tabs | `supplier-result-card.tsx:218`; `orders.tsx:211` | 22px, 26px |
| Source marks (links) | `marks.tsx:62,68,122` | 16–24px, 2–3px apart |
| Record tabs | `sheet-tabs.tsx:66,78` | 40px tall with 20px dead gaps |
| Phone nav strip items | `sidebar-nav.tsx:67` | 32px |
| Account button (the only one below `md`) | `account-menu.tsx:28,91` | 28px |
| Record Close / Expand / More | `supplier-sheet.tsx:154,183`; `report-problem.tsx:78` | 32px |
| Pagination | `results-panel.tsx:242,278` | 28px |
| Reason toggles, "Scope" | `sheet.tsx:299,573` | 24px; Scope ~20px |

- Hover-only: the product row actions are `invisible … group-hover:visible`
  (`products.tsx:256`): unreachable on Android, two taps on iOS. The row's
  "Open" word is `opacity-0 group-hover/open:opacity-100`
  (`results-table.tsx:336`).
- `tailwind.config.ts` does not set `future.hoverOnlyWhenSupported`, so hover
  styles stick after a tap: a Save just un-saved still looks saved
  (`controls.tsx:36` vs `save-record-button.tsx:86`). `.link:hover` is plain
  CSS (`app/ds.css:195`).
- Pressed feedback exists only in `buttonClass` (`controls.tsx:32-38`).
  Tailwind's preflight removes the tap highlight, so rows, tabs, chips, menu
  items and the checkbox show nothing when tapped.
- Only in `title`: mark names (`marks.tsx:90,98`), cut names (`type.tsx:38`),
  the card's "+N" (`supplier-result-card.tsx:205,230`), a certificate's state in
  the table (`results-table.tsx:99`), the workers wording
  (`workers-cell.tsx:34`).

**R10. iOS zooms the page when a field is focused.** Safari zooms on any
field under 16px. Inside the app the body type is 15px and small is 14px;
every kit field is `text-base` = 15px (`fields.tsx:14`): the RFQ composer
(recording 1:30), settings, the order and product forms, the supplier picker.
The topbar search inherits 14px (`search-typeahead.tsx:312`,
`app-shell.tsx:179`); also `search-composer.tsx:79`,
`discover-filters.tsx:41`, `save-search-form.tsx:73`, `report-problem.tsx:97`.

**R11. The navigation sits at the top of a phone, out of the thumb's reach**
("very hard to use", the founder). The rail becomes a horizontal strip
(`sidebar-nav.tsx:48`, `flex snap-x gap-1 overflow-x-auto`) of eleven 32px
items across the top, cut at the right edge, with a scrollbar under it once
touched (recording 1:55). It scrolls away with the page, as does the topbar
(`app-shell.tsx:207`, not sticky), so the search field and the navigation are
both gone once the buyer scrolls.

**R12. Scroll position.** Opening a record uses `scroll={false}` and focuses
the pane (`dialog-focus.tsx:54-61`): on a phone the record opens part-way down
the page (in the recording the app's header has scrolled away). Closing lands
at an arbitrary point in the list.

**R13. The RFQ composer on a phone** (`rfq-composer.tsx:363`, `grid gap-6 p-6
xl:grid-cols-[minmax(0,1fr)_300px]`). It does not scroll (R1); its fields zoom
(R10); 24px gutters; the preview column stacks under the form; Send is at the
very end.

## Decisions (build these)

"Phone" means below `sm` (640px) for layout; the scroll model changes at `md`
(768px), where the app frame starts. Test at 360, 390 and 430 (phones), 768
(tablet) and 1280 (regression).

**D1. One scroller on a phone.** Below `md` the window is the only vertical
scroller: `<main>`, the results column and `SheetScroll` take `md:`-prefixed
`overflow-y-auto` and `overscroll-contain`. Sticky elements then stick to the
screen, iOS collapses its toolbars as the page scrolls, and a tap on the status
bar returns to the top. (A phone-sized frame with inner scrollers was rejected:
it fights iOS's moving toolbars and loses tap-to-top.)

**D2. Trays.** One open at a time. A tap outside, Escape or choosing an item
closes it. Below `sm` every tray is a bottom sheet; from `sm` a floating tray
stays inside the screen and scrolls inside itself. References: LinkedIn,
Zocdoc, Best Buy and Tripadvisor filter sheets (Mobbin, at the end).
- `name="sb-menu"` on every menu `<details>`: an exclusive group (Chrome/Edge
  120, Safari 17.2, Firefox 130; older browsers ignore it, and the handler
  below covers them).
- One `MenuDismiss` client component mounted in `AppShell`: `pointerdown` and
  `keydown` on `document`, capture phase. It closes any
  `details[name="sb-menu"][open]` the event is outside of. Escape closes, puts
  focus back on the summary and calls `preventDefault()`, so the record's own
  Escape (`dialog-focus.tsx:52`) does not also close the record. Reuse
  `menuShouldClose` (`account-menu.tsx:51-52`) and move the account menu onto
  it.
- The bottom sheet below `sm`: the panel becomes `fixed inset-x-0 bottom-0
  max-h-[70dvh] overflow-y-auto overscroll-contain rounded-t-lg` with
  `pb-[max(0.75rem,env(safe-area-inset-bottom))]`, and a header row with the
  menu's name and Done. Items are 48px tall. A scrim inside the `<details>`
  (`fixed inset-0 bg-surface-inverse/40 sm:hidden`) takes the outside tap and
  stops the page moving behind. Being `fixed`, the sheet escapes every overflow
  clip. The bounded sheet is the one place `overscroll-contain` belongs.
- From `sm`: `max-h-[min(24rem,70vh)] overflow-y-auto`. On `toggle` (capture
  phase; it does not bubble) measure the open panel; if it would leave the
  screen, anchor it right or open it upward.
- The typeahead closes on `pointerdown`, not `mousedown`.
- Drop `role="menu"`/`menuitem`: a list of links is a disclosure. Implementing
  arrow keys would also be correct; dropping the role is smaller and honest.

**D3. The search on a phone** (Booking.com, Viator, Grab). No boxed card:
full-bleed rows on the canvas with 16px gutters.
- Row 1, three equal 44px buttons: `⇅ Sort` (a sheet of the sort options),
  `Filters · 2` (the full filter pane, which already fills the screen below
  `lg`: `?filters=1`, `search-composer.tsx:102-108`), and the list/cards
  switch.
- Row 2, one horizontally scrolling row (edge fade, snap, no scrollbar): the
  quick menus (Product, Certificate, Place, Company type, More; each opens a
  bottom sheet), then the set filters as removable chips ("knit ×",
  "Sanctioned hidden ×") with a 44px hit area on each ×.
- No green arrow on a phone (it reloads the same search) and no "Add filter"
  (the Filters button is it).
- The header: the title on one line, cut; the count under it on one line
  (`whitespace-nowrap tabular-nums`: "10,266 suppliers · 1–25"); select-all at
  its left with a 44px hit area; a `⋯` at its right holding Save search,
  Density and Export CSV.

**D4. The list on a phone** (Handshake, Nextdoor, Cash App). Below `sm` the
table becomes a list of rows: the same component and the same rows, with the
extra columns hidden, never scrolling sideways.
- Each row: the checkbox (44px hit area), the 40px tile, then the name (one
  line, 16px medium), "qualifier · type · place" (one line, 14px), and a
  metrics line (13px): the source count with the first two marks at 20px, the
  worker figure, and the first certificate's state as a compact chip. About
  88px a row (D10).
- The whole row opens the record (a stretched link with a pressed state).
- The row actions leave the row on a phone: Save and Send RFQ are in the
  record's action bar and in the selection bar.
- From `sm` to `xl` (tablets): hide Certificates and Export lines and lower the
  table's minimum to what the other columns need, instead of a 960px table
  scrolling sideways. From `xl` the full table, as today.

**D5. The card on a phone** (Glassdoor, Booking.com, LinkedIn). One column;
the tile sits beside the name only.
- Top: the checkbox, the 40px tile, the name (one line) and under it the facts
  line wrapping to at most two lines (14px icons, 14px text, `gap-x-3`, no
  dots).
- Full width under it:
  - the marks at 20px on one line with "+N" (a tap opens the record's
    Sources);
  - the "8 registers & certifiers" caption;
  - at most two chips on one line, "+N" for the rest;
  - the thumbnails as a snap strip with a fade at the right edge, and "+24
    lines · illustration" under it.
- Actions in a bottom row: Save (icon, 44px) and Send RFQ. Open goes; the card
  itself opens the record.

**D6. The record on a phone** (LinkedIn, Fresha, Google Maps, Finimize).
- A sticky 48px top bar: `‹ Results` (back, not ×), then Share and `⋯`
  (Report a problem). No read range (it is on the Sources tab) and no Expand
  below `lg`. Once the head scrolls away, the supplier's name appears in the
  bar on one line.
- Head: a 48px tile; the name at 24px on up to two lines, then cut (this
  overturns the One-Line Name Rule for this one place, on phones); the
  qualifier under it; the facts as a wrapping row of icon + value with
  `gap-x-4 gap-y-1` and no dots; the marks on one line at 20px with "+N"; no
  "N sources" caption.
- Tabs: sticky under the top bar, with an edge fade and snap. A tapped tab
  scrolls the page to its section (the window, allowing for the bar and the
  tabs) and scrolls itself into view. The active tab follows the section on
  screen.
- A compact body: 16px gutters, 20px between sections, 14px group headings. A
  fact takes two lines: the icon and the label with the source mark at the
  right of the same line, then the value.
- A sticky action bar at the bottom: Save (icon) and Send RFQ (primary, filling
  the row), with safe-area padding.
- A record opens at its top; closing returns to the row it was opened from,
  in view.

**D7. The RFQ composer on a phone.** One column with 16px gutters; a sticky
header ("× New RFQ") and a sticky footer holding Send RFQ (with the safe area);
every field 16px (D8); the preview behind a "Preview message" disclosure under
the form.

**D8. Touch, everywhere in the app.**
- `future: { hoverOnlyWhenSupported: true }` in `tailwind.config.ts`;
  `.link:hover` inside `@media (hover: hover)`.
- Bigger hit areas, not bigger visuals: a `.hit` utility in `app/ds.css`,
  `@media (pointer: coarse) { .hit { position: relative } .hit::after {
  content: ""; position: absolute; inset: -8px } }` (enough to reach 44px), on
  the checkbox, the marks, the chip ×, the view switch, pagination, the Reason
  toggles and every icon button. Rows and menu items are at least 44px tall on
  phones.
- Pressed feedback: `active:bg-surface-sunken` on rows, tabs, chips, menu
  items and nav items; `touch-action: manipulation` on interactive elements.
- Fields: `@media (pointer: coarse) { [data-shell] :is(input, select,
  textarea) { font-size: max(1rem, 1em) } }`. 16px on touch; the type scale
  stays as it is (`search-filters.test.ts` pins it).
- Nothing only on hover: the products row actions show on touch; the row's
  "Open" is an icon with a screen-reader label on phones (the visible word
  stays on desktop). Title-only text gets the Reason tap pattern where it
  matters; a cut name is whole in the record, and a mark's name is in Sources.

**D9. Navigation at the bottom of a phone** (the founder's reference;
Glassdoor, Handshake, LinkedIn). Below `md`:
- A bottom tab bar, fixed to the bottom edge, 56px plus the safe area
  (`pb-[env(safe-area-inset-bottom)]`), on `surface` with a hairline on top.
  Five tabs, each a full fifth of the width and the full height (well over
  44px): **Search, Saved, RFQs, Messages, More**. Each tab is its `NAV` icon
  (`lib/dashboard/nav.ts:43-59`) at 24px over an 11px medium label (D10).
- The current tab: the icon and label in `ink-strong`, the label at medium
  weight, with `aria-current="page"`. The others are `ink-muted`. There is no
  hue (the state role is greys and near-black since 29 Sep) and no pill behind
  the icon.
- A badge on the icon is for a count that asks for action (unread messages,
  RFQ replies), as the founder's reference shows on Inbox. Totals (10,266
  suppliers, 17 saved, all RFQs) never get one; they belong on their pages.
  Today the shell reads totals only (`load-buyer-shell.ts:97-150`: suppliers,
  RFQs, saved), so the tab gets a `badge` slot and no badge shows until an
  unread count exists.
- More opens a bottom sheet (D2) with the rest of the nav (Suppliers, Products,
  HS headings, Saved searches, Orders, Compliance hub, Settings) and the account
  (name, plan, Sign out). More reads as current when the page is one of them.
- Pressed feedback on every tab (`active:bg-surface-sunken`). The Search tab
  must not prefetch (`/app/discover` is rate-limited; `links.test.ts:281-299`).
- The horizontal strip at the top goes. The topbar (the search field and the
  avatar) stays at the top and sticks there, so the search is always one tap
  away.
- The page is padded for the bar, so nothing hides behind it. Inside a record
  and the composer both the tab bar and the app's top bar hide: the record's
  own bar (`‹ Results`, Share, `⋯`) takes the top edge and its sticky action
  bar the bottom, as Airbnb, Booking.com and LinkedIn detail screens do. Two
  bars stuck to the top would cover each other.
- From `md` the rail at the side, as today.
- Any horizontal strip that remains elsewhere hides its scrollbar and shows an
  edge fade instead.

**D10. Sizes on a phone, taken from the big apps.** The founder: "the icon
sizes and text size of nav band and all other part of the interface must be
fixed and check mobbin and get size idea from the big company mobile app."
These were measured from 3× iPhone screenshots on Mobbin (1179px wide = 393pt;
on a phone one CSS pixel is one point). Figures marked ≈ are read from glyph
heights, so they are within a point.

| Measured (pt) | Expedia | Glassdoor | Handshake | Tripadvisor | Nextdoor | Booking.com |
| -- | -- | -- | -- | -- | -- | -- |
| Tab bar | 49 + 34 home area | 49 + 34 (hairline on top) | 49 + 34 | floating pill | floating pill | |
| Tab icon glyph (in a 24–28 box) | 17–20 | 19–20 | 21–25 | 19 | 18–20 | |
| Tab label | ≈10 | ≈11–12, medium | ≈11 | ≈10 | ≈10 | |
| Icon to label | 12 | 9 | 8 | 8 | 6 | |
| Result title | | ≈19 semibold | 17 medium | | 17 bold | |
| Second line | | ≈13–14 | ≈15 | | ≈14–15 | |
| Row height | | ≈150 (with badges) | ≈110 (four lines) | | 66 (two lines), 94 (three) | |
| Logo | | 32 | 40 | | 40 | |
| Chip / pill height | | ≈24 (badge) | | | | ≈36 |

The platform guides agree. Apple: 44pt minimum targets, body 17pt,
subheadline 15, footnote 13, tab labels 10pt, 16pt margins. Google (Material
3): 48dp targets, a navigation bar of 80dp with 24dp icons and 12sp labels,
list items 56/72/88dp for one, two and three lines, chips 32dp.

The phone scale to build. These apply below `md` to the shell and navigation,
and below `sm` to content; they override any size stated elsewhere in this
file:

| Element | On a phone |
| -- | -- |
| Bottom tab bar | 56px + the safe area; 24px icons; 11px medium labels; 4px from icon to label; a hairline on top |
| Top bar | 52px; the search field 44px tall with 16px text; the avatar 32px in a 44px target |
| Spacing | 16px side gutters; 24px between sections; 12px inside rows and cards |
| Page title | 22px semibold |
| The record's name | 24px medium, two lines at most |
| Section heading | 17px semibold |
| A supplier's name in a list or card | 16px medium |
| Body, a fact's value | 16px |
| Secondary (type, place, qualifier) | 14px |
| Meta, captions, counts | 13px |
| The record's tabs | 44px tall, 15px medium, a 2px underline when current, 24px apart |
| Chips | 32px tall, 13px text, 12px side padding |
| Buttons | 44px tall (48px in the sticky bars), 16px medium text |
| Inline icons (facts, rows) | 18px (16px inside chips) |
| Action icons | 22–24px in a 44px target |
| Initials tile | 40px in lists and cards; 48px in the record's head |
| Source marks | 20px, 6px apart |
| Checkbox | a 20px box in a 44px target |
| Bottom sheet | a 36×4px grab handle; a 56px header at 17px semibold; 52px rows at 16px; 48px footer buttons |
| Result rows | at least 72px for two lines, about 88px for three |

Build it as a phone step in the design tokens, not as one-off classes:
`appFontSize` (`lib/design/tokens.ts`) and the `[data-shell]` font variables
(`tailwind.config.ts`) gain phone values (body 16, title 17, and the headings
above) under `max-width: 639px`. The desktop scale stays exactly as it is
(`search-filters.test.ts:140-144` pins it); the phone values get their own
test. The 16px fields of D8 then fall out of the same step.

## Rules this overturns

Change the record in the same PR as the code, or the next agent restores the
old rule.

| Rule today | Where it lives | Now |
| -- | -- | -- |
| One-Line Name Rule: every name is one line, cut | DESIGN.md (Typography, Named Rules); `type.tsx` `OneLine`; `render.test.ts:102,113` (only `data-name`/`data-line` may truncate; `line-clamp` only on names) | On a phone the record head's name may take two lines, then cut. Lists and cards stay one line. |
| Phones scroll tables sideways (62rem / 30.5rem) | `DESIGN.md:418`; `app/(app)/app/discover/loading.tsx` (`min-w-[62rem]`) | Below `sm` a list of rows; `sm` to `xl` fewer columns; never sideways |
| `<main>` is the scroll region; a pane scrolls itself and contains its overscroll | `handoff-one-viewport-shell.md`; the comments at `app-shell.tsx:295-304` and `sheet.tsx:181-186` | Only from `md`. Below `md` the window scrolls. |
| Known limit: the record's tabs do not stick below 768px | `context/current-state.md` (the names-and-facts line) | Fixed (M0, M4) |
| Menus are ARIA menus | `controls.tsx:416,456` | Disclosures of links |
| The rail is a horizontal strip across the top of a phone | `sidebar-nav.tsx:48`; DESIGN.md Sidebar | A bottom tab bar and a More sheet (M1; the founder asked for it by name) |

## Before you start

- Boot lean (AGENTS 3), then load the impeccable skill (surface
  `app-app-app`, mode Operate). Read `DESIGN.md`,
  `.impeccable/surfaces/app-app-app.md` and `lib/design/tokens.ts`.
- Branch off `development` at `cdde378` or later with a clean tree (AGENTS 11).
- Six PRs, in order, one at a time (AGENTS 2): **M0** the phone scrolls again,
  trays behave, fields stop zooming (small, and it is what the founder hit
  hardest: ship it first); **M1** navigation at the bottom and the phone size
  scale (the founder asked for both by name, and every later PR lays out
  against them); **M2** the search;
  **M3** the list and the card; **M4** the record; **M5** the composer, the
  other pages and the touch sweep.
- Screenshots without a server (the dev server is unusable here; memory "Local
  dev server unusable"): `.impeccable/preview/names30.cjs` holds the views,
  `render-n30.cjs` renders them, and `node .impeccable/preview/build-names30.cjs
  <label> [shot …]` shoots 1280, 1440 and 375 into
  `.impeccable/review/names30/<label>/` (`SHOOT_ONLY=1` re-shoots saved pages).
  These files are gitignored and exist only on this machine. Add 360, 390, 430
  and 768 widths and open the context with `isMobile: true, hasTouch: true`.
  Run `pnpm exec tsc -p tsconfig.npm-test.json --listEmittedFiles` in the
  foreground first (a background run once emitted nothing).
- Traps on this machine:
  - Git Bash heredocs collapse doubled backslashes: a `\b` in a regex became a
    backspace character twice this week. Write patch scripts with the Write
    tool, or edit with the Edit tool.
  - eslint: `ESLINT_USE_FLAT_CONFIG=false node node_modules/eslint/bin/eslint.js <files>`.
  - A new `*.test.ts` goes in `tsconfig.npm-test.json`'s `files`, or it never
    compiles.
  - `gh pr checks` exits non-zero on a failed or pending check: never wrap it
    in `|| echo '[]'` in a watcher, or the watcher goes blind.
  - Before pushing a markup change, grep every `*.test.ts` for the old markup;
    CI went red twice this week on tests outside the targeted files.
  - The guard hook refuses force pushes and `gh workflow run`.
- Appendix B lists the tests that pin today's phone layout. Rewrite them to
  the new rule; do not delete them blindly.

## PR M0 — the phone scrolls again; trays behave; fields stop zooming (ship first)

1. **One scroller (D1).**
   - `SheetScroll` (`sheet.tsx:191`): `min-h-0 flex-1 md:overflow-y-auto
     md:overscroll-contain`.
   - `<main>` (`app-shell.tsx:304`): `md:overflow-y-auto` (keep `isolate`).
   - The results column (`sheet.tsx:150`): `md:overflow-y-auto`.
   - The supplier picker's panel (`supplier-picker.tsx:212`): gate it the same
     way unless it has a bounded height at every width.
   - Rewrite the comments at `sheet.tsx:181-186` and `app-shell.tsx:295-304`
     to say "from `md`".
   - Check no child now widens the page sideways
     (`document.documentElement.scrollWidth <= innerWidth` in Appendix A).
2. **Tabs (R2).** In `goToSection` (`sheet-tabs.tsx:27-34`), when the sheet
   scroller cannot scroll (`scrollHeight <= clientHeight`), scroll the window
   instead: `window.scrollTo({ top: target.getBoundingClientRect().top +
   window.scrollY - offset })`, where `offset` is the height of whatever sticks
   above the section (the tabs now; the bar and the tabs after M4).
3. **Trays (D2, all but the sheet's look).** Add `name="sb-menu"` (controls,
   account menu, report ⋯, reason notes); mount `MenuDismiss`; add max-height
   with an inner scroll, and clamp the panel to the screen; move the typeahead
   to `pointerdown`.
4. **Fields 16px on touch** (the D8 rule), and `hoverOnlyWhenSupported`.

Guards (CI):
- `SheetScroll`, `<main>` and the results column carry `overflow-y-auto` and
  `overscroll-contain` only behind `md:`. A sweep of `components/dashboard`
  refuses a bare `overscroll-contain`, except on elements bounded at every
  width (an allow-list with the reason, e.g. the bottom sheet's
  `max-h-[70dvh]`).
- `goToSection` with a stub scroller whose `scrollHeight` equals its
  `clientHeight` calls `window.scrollTo` with the section's offset; with a
  scrolling stub it scrolls the stub. `pane-stability.test.ts:140-154` has the
  stub pattern.
- Every menu `<details>` in the kit carries `name="sb-menu"`; `AppShell` mounts
  `MenuDismiss` once. The dismiss decision is a pure function, tested like
  `menuShouldClose`: an outside `pointerdown` closes, an inside one does not,
  Escape closes, a closed menu is left alone.
- `app/ds.css` holds the coarse-pointer 16px rule; `tailwind.config.ts` sets
  `hoverOnlyWhenSupported`.

Local check (not in CI): Appendix A at 360×780 and 390×844 on the record, the
composer, the results, the landing, Saved and Settings. Each scrolls at least
300px on a touch swipe and none scrolls sideways.

Screenshots, before and after, at 390 and 768 (and 1280 to show nothing
changed there):
- the record scrolled half-way, with the tabs stuck;
- the composer scrolled to Send;
- a filter tray open, then a second tapped (one open);
- a tap outside closing a tray;
- the sort menu near the bottom of the screen, inside it.

## PR M1 — navigation at the bottom of a phone, and the phone size scale (D9, D10)

The founder asked for this by name: "on mobile the navigation must be on the
bottom part of the screen so that UX is top notch and user find it handy."

- **The phone size scale first (D10)**, in the tokens: the phone type step in
  `lib/design/tokens.ts` and `tailwind.config.ts`, and the target, bar, row,
  chip and sheet sizes as named values. Every later PR lays out against it;
  the tab bar is its first user.
- `sidebar-nav.tsx` and `app-shell.tsx`, below `md`:
  - a `BottomNav` (client, like `SidebarNav`: it marks the current tab from
    `usePathname()` and follows every navigation, as the strip's `NavCurrent`
    does today) fixed to the bottom edge with the safe area, built as D9 says;
  - the tabs and their order come from `lib/dashboard/nav.ts` (`NAV`,
    `navMatch`, `activeNavKey`), with a `phone` subset and the rest under More,
    so the rail and the bar cannot drift;
  - More is a bottom sheet (D2) holding the rest of the nav and the account
    (move the account menu's items into it; the avatar in the topbar keeps its
    menu);
  - the horizontal strip goes (`sidebar-nav.tsx:48` below `md`);
  - the topbar becomes `max-md:sticky max-md:top-0 max-md:z-sticky`;
  - `<main>` is padded for the bar (`max-md:pb-[calc(56px+env(safe-area-inset-bottom))]`);
  - inside a record and the composer the tab bar and the topbar both hide
    below `md` (the pane marks the page, for example `data-detail` on the
    shell, and both bars are `hidden` under it); the record's own bar and its
    sticky action bar take the top and bottom edges (M4, M5).
- The `badge` slot (a near-black dot with a number, capped at "99+") renders
  nothing today: the shell has no unread count (D9). Adding one is its own
  read and its own PR; do not add a query here.
- The Search tab does not prefetch (`links.test.ts:281-299`); the other tabs
  do, as the rail's rows do.
- From `md` nothing changes: the rail at the side.

Guards:
- the phone type step's values (body 16, title 17 and the headings of D10)
  exist and apply only under 640px, while the desktop scale's test still
  passes unchanged;
- the shell renders the bottom bar with exactly five tabs in this order, each
  with a 24px icon and an 11px label, the current one carrying
  `aria-current="page"` and the others not;
- no horizontal nav strip below `md`;
- the Search tab's `prefetch={false}`;
- More holds every `NAV` item not in the bar, plus Sign out;
- the bar is `fixed` with the safe-area padding, and `<main>` carries the
  matching bottom padding;
- rewrite `shell-account.test.ts` (the current row, the account foot) and
  `search-first.test.ts:147-155` (the topbar) for the new shell.

Screenshots at 360, 390 and 430 (and 768 and 1280 to show the rail
unchanged): each tab current; More open; a long page scrolled to its end
(nothing hidden behind the bar); a record open (both app bars hidden, the
record's bar at the top and its action bar at the bottom).

## PR M2 — the search on a phone (D3, and D2's bottom sheet)

- `search-composer.tsx`, below `sm`:
  - no card chrome (`max-sm:bg-transparent max-sm:shadow-none max-sm:p-0`);
  - the funnel becomes the `Filters · N` button;
  - the arrow `hidden sm:grid` (`:188`); "Add filter" `hidden sm:inline-flex`
    (`:106`);
  - the middle (`:70`) one row, `max-sm:flex-nowrap max-sm:overflow-x-auto`,
    with snap, an edge fade (`mask-image` with `black`, not a hex:
    `render.test.ts:136`) and a hidden scrollbar;
  - `filter-menus.tsx:68` gets `sm:flex-wrap`; the chips get `shrink-0
    whitespace-nowrap`, and the chip × gets `.hit`.
- `controls.tsx` `Menu` panel: the bottom sheet below `sm` (D2), with the
  scrim, the header and Done, and 48px items.
- `results-panel.tsx`:
  - the header (`:140`) becomes `max-sm:flex-col` (the title, then the count);
  - the count Caption (`:145`) gets `whitespace-nowrap tabular-nums`;
  - the toolbar (`:153`) gets `max-sm:basis-full`: Sort (the icon and a short
    label), the view switch, and the `⋯` (Save search, Density, Export CSV)
    below `sm`. From `sm` it is unchanged.
  - `render.test.ts:3074-3099` collects the sort items, so render the controls
    once and move them with CSS; do not render a second copy.
- Row 1's Sort is the existing sort `Menu`, so it gets the bottom sheet for
  free.

Guards: class-level render tests for each phone rule: the phone chrome, the
count on one line, the `⋯` holding the three controls, and one set of sort
items.

Screenshots at 360, 390 and 768:
- the results at rest;
- the menus row scrolled;
- each tray as a bottom sheet (Product, Place, More, Sort);
- the Filters pane;
- the `⋯` open.

## PR M3 — the list and the card on a phone (D4, D5)

- `results-table.tsx`:
  - below `sm`, hide columns 3–7 (`max-sm:hidden` on the `<col>`, `<th>` and
    `<td>`; `:169`, `:181-189`, `:266`, `:275`, `:289`, `:301`, `:310`);
  - the minimum width only from `sm` (`:162`); the scroll region only from `sm`
    (`:154`);
  - from `sm` to `xl`, hide Certificates and Export lines and lower the minimum
    to fit (update `RESULTS_MIN_WIDTH` and `pane-stability.test.ts:186-205`);
  - the name cell gets the metrics line, `sm:hidden`, marked `data-line`, not
    `data-name` (`pane-stability.test.ts:212-216` counts the `data-name`
    lines);
  - the whole row is a stretched link below `sm` (`max-sm:after:absolute
    max-sm:after:inset-0` on the name link inside a `relative` cell);
  - the checkbox gets `.hit`.
- `supplier-result-card.tsx`:
  - the phone grid, CSS only: the frame `max-sm:grid
    max-sm:grid-cols-[auto_auto_minmax(0,1fr)] max-sm:items-center`, the text
    column `max-sm:contents`, the body and the thumbnails
    `max-sm:col-span-full`;
  - Open is `max-sm:hidden`; the actions become a bottom row;
  - the facts line is `max-sm:line-clamp-2 sm:truncate` (extend
    `render.test.ts:102`'s `line-clamp` allowance to `data-line`);
  - the chips from the third on are `max-sm:hidden`, with a phone-only "+N";
  - the marks are 20px below `sm`, with "+N" (`marks.tsx`);
  - the thumbnails snap, with an edge fade, a hidden scrollbar and the caption
    under the strip (`photo-tiles.tsx:240-255`);
  - `render.test.ts:166` bans some breakpoint rules on the card: it predates
    cards never appearing beside a pane, so allow `max-sm:`.
- The loading skeleton (`discover/loading.tsx`) matches the new rules.

Guards:
- the phone classes: hidden columns, no bare `min-w-[…]` on the table, the
  metrics line, the stretched link, two chips on a phone, snapping
  thumbnails;
- one checkbox per row and card still holds (`interaction.test.ts:480-518`).

Screenshots at 360, 390, 768 and 1280:
- the list, at rest and scrolled;
- the cards;
- a card's six thumbnails scrolled;
- the tablet list with no sideways scroll.

## PR M4 — the record on a phone (D6, R2, R12)

- **The bar** (`supplier-sheet.tsx`, `sheet.tsx:178`):
  - `max-md:sticky max-md:top-0 max-md:z-sticky bg-surface`;
  - `‹ Results` in place of × below `lg` (reuse the page mode's "Back to
    results", `supplier-sheet.tsx:157-161`);
  - the read range `hidden md:inline`; Expand `hidden lg:inline-flex`; Report
    inside the `⋯`;
  - the name in the bar once the head scrolls out (an IntersectionObserver on
    the head, with the bar's copy `aria-hidden`).
- **The head**:
  - the tile `size-10 sm:size-12`;
  - the name `text-2xl sm:text-3xl` with `max-sm:line-clamp-2 sm:truncate`
    (`OneLine` gains a `lines` prop); `px-4 sm:px-6`;
  - `MetaLine` loses its `before:` dots and gets `gap-x-4 gap-y-1`, each fact
    `whitespace-nowrap`;
  - the marks with `caption="none"`, one line with "+N" below `sm`.
- **The tabs**:
  - `max-md:top-12` under the bar;
  - a `mask-image` fade, `snap-x scroll-px-4`, and `snap-start` on each tab;
  - `aria-current` follows the section on screen (an IntersectionObserver
    over the sections), and a tapped tab scrolls itself into view;
  - the sections get `max-md:scroll-mt-[96px]`.
- **Fact rows**, below `sm`: a grid `grid-cols-[1fr_auto]` (the icon and label,
  then the mark), with the value on the full line under them; the row
  `py-2.5`, the sections `px-4 py-5`.
- **The action bar** (`sheet.tsx:950`):
  - `max-md:sticky max-md:bottom-0 max-md:z-raised
    pb-[max(0.75rem,env(safe-area-inset-bottom))]`, with Send RFQ `flex-1`
    below `sm`;
  - sticky, not fixed: the pane's slide-in animation makes a containing block
    that would trap a fixed bar.
- **Scroll position** (`dialog-focus.tsx`): below `lg` a record opens at its
  top (scroll the window to 0 when the pane mounts); Close focuses the row it
  was opened from without `preventScroll`, `block: "center"`.

Guards:
- rewrite `record-sheet.test.ts:561-562`, `:569` and `:573`;
- `MetaLine` has no `content-['·']`;
- the name's phone clamp;
- the tabs' sticky offset, mask and snap;
- the action bar sticky with the safe area.

Screenshots at 360, 390 and 768:
- the record at its top;
- scrolled into Certificates, with the bar and the tabs stuck and the name in
  the bar;
- the tabs scrolled to Sources;
- the 125-character record in the fixtures, its name on two lines;
- the action bar over the content.

## PR M5 — the composer, the rest of the app, and the touch sweep (D7, D8)

- `rfq-composer.tsx`: D7.
- Every other buyer page at 360 and 390:
  - Saved and Saved searches;
  - Products: row actions visible on touch; the `max-xl:overflow-x-auto` table
    (`page.tsx:215`) becomes rows below `sm`;
  - Orders, the RFQ list and detail, Messages;
  - Compliance hub and HS headings;
  - Settings: its side nav becomes a list on phones;
  - the landing: "Recent searches" closes on an outside tap, and the common
    search cards.
- The touch sweep: `.hit` on everything R9 lists; pressed states;
  `touch-action`; the "Open" label; title-only text made visible or tappable.

Guards:
- a sweep that every icon button, the checkbox, the marks, the chip ×,
  pagination and Reason carry `.hit`;
- no `invisible … group-hover:visible` action without a touch alternative
  anywhere in the kit (widen `search-first.test.ts:182`, which only checks the
  results table);
- the `app/ds.css` rules.

Screenshots: each page at 390, at rest and with one interaction.

## How to check your work

- Per PR: the targeted tests and the new guards locally, the full typecheck,
  eslint on the changed files, one `/code-review` pass on the diff against the
  merge base, fix what it finds, then the PR with `gh pr merge --auto --squash`
  (AGENTS 9a, 16).
- Screenshots in every PR, before and after, at 360, 390 and 768 (plus 1280
  where desktop could move), including the scrolled, tray-open and
  record-open states each PR lists. The screenshot gist above is where the last
  PRs hosted theirs.
- Appendix A on every page the PR touches, at both phone sizes.
- Done means merged by CI after one critic pass. Then a promotion PR from
  `development` to `main` (`gh pr merge --auto --merge`), and the founder
  approves the deploy.

## Founder-only

- The deploy approval in the GitHub `production` environment. Never trigger
  Deploy Production yourself.
- Nothing here touches the database.

## Mobbin references (iOS)

- Bottom tab bars (D9, D10 measured from these): Expedia
  (https://mobbin.com/screens/c9aadfd1-1f9b-469d-926e-156b5bbe4bcd), Tripadvisor
  (https://mobbin.com/screens/c98b2a93-e4bd-4138-90df-5214822df444), Glassdoor
  (https://mobbin.com/screens/b6fac749-1923-43a0-9246-b4283cadec60), Handshake
  (https://mobbin.com/screens/62723691-2eb4-468f-a90d-176fb9f4a50d).
- A scrolling row of filter chips under the field: Viator
  (https://mobbin.com/screens/6452ea9c-166d-45e2-ae65-3bcfc80f0308), Grab
  (https://mobbin.com/screens/76656c88-f2d0-4f17-abcf-a9a7213d4521), Cash App
  (https://mobbin.com/screens/e96aae5c-23c4-4a16-a66a-3156efd8bd19).
- Sort | Filter | Map with removable chips: Booking.com
  (https://mobbin.com/screens/95b3de3f-481b-4fdd-b897-ca8a19869fb9).
- Filter bottom sheets: LinkedIn
  (https://mobbin.com/screens/a02d9cfa-0d2b-4a39-b61c-de6a9c335c89), Zocdoc
  (https://mobbin.com/screens/fd867c2b-ec2a-498f-a5f6-376f353b5b4d), Best Buy
  (https://mobbin.com/screens/b6de0d22-87e1-454d-b189-8146087b4921),
  Tripadvisor (https://mobbin.com/screens/865eea58-646f-4d36-88a5-abc51da9218b).
- Compact result rows: Handshake
  (https://mobbin.com/screens/62723691-2eb4-468f-a90d-176fb9f4a50d), Nextdoor
  (https://mobbin.com/screens/bbdd3368-b9a1-4152-af60-ace6428d6e3c).
- Company rows and a bottom tab bar: Glassdoor
  (https://mobbin.com/screens/b6fac749-1923-43a0-9246-b4283cadec60).
- A profile with scrolling tabs, a compact bar and fact rows: LinkedIn
  (https://mobbin.com/screens/4560c614-6e58-49f1-881e-73bc1c18709e), Fresha
  (https://mobbin.com/screens/e3a593d6-df18-42fe-a403-da9fb695e7d2), Google Maps
  (https://mobbin.com/screens/c8bd1b60-ffb5-4c71-b6f1-73a7b9255aa8), Finimize
  (https://mobbin.com/screens/df1eb679-17d6-4134-9106-e3149d7657c8).

## Appendix A — the touch-scroll check (local, not CI)

Save as `.impeccable/preview/touch-check.cjs` (gitignored) and run
`node .impeccable/preview/touch-check.cjs <label> [view …]` on a harness label.
It opens each saved page at a phone size with touch, swipes up with real touch
events and reports what moved. Two things found while writing it:
- CDP's `Input.synthesizeScrollGesture` does nothing in headless Chrome here;
  raw `Input.dispatchTouchEvent` works.
- A page shorter than the screen is reported as fitting, not failing.

```js
const fs = require("fs");
const path = require("path");
const root = "E:/SourceBD";
const [label, ...only] = process.argv.slice(2);
const dir = path.join(root, ".impeccable/review/names30", label, "html");
const views = only.length ? only : fs.readdirSync(dir).filter((f) => f.endsWith(".html")).map((f) => f.slice(0, -5));
(async () => {
  const { chromium } = require(path.join(root, "node_modules/playwright"));
  const browser = await chromium.launch({ channel: "chrome" });
  let failed = 0;
  for (const [w, h] of [[360, 780], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    for (const view of views) {
      await page.goto("file:///" + path.join(dir, `${view}.html`).split(String.fromCharCode(92)).join("/"));
      await page.waitForTimeout(300);
      const tall = await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 200);
      const x = Math.round(w / 2);
      const from = Math.round(h * 0.8);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: from }] });
      for (let y = from - 15; y >= Math.round(h * 0.3); y -= 15) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
        await page.waitForTimeout(8);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(600);
      const r = await page.evaluate(() => ({ moved: Math.round(scrollY), wide: document.documentElement.scrollWidth - innerWidth }));
      const ok = (!tall || r.moved >= 200) && r.wide <= 0;
      if (!ok) failed++;
      console.log(`${ok ? "ok  " : "FAIL"} ${view} @${w}: swipe moved ${r.moved}px${tall ? "" : " (fits the screen)"}; sideways overflow ${r.wide}px`);
    }
    await context.close();
  }
  await browser.close();
  process.exitCode = failed ? 1 : 0;
})();
```

On today's build it prints `FAIL record` and `FAIL rfq` at both sizes: the
swipe moves 0px.

## Appendix B — tests that pin today's phone layout

Rewrite these to the new rules; do not delete them blindly. Line numbers as
read at `cdde378`.

- **Scroll model**
  - `pane-stability.test.ts:46-49` (`md:overflow-clip`, `lg:overflow-clip`),
    `:140-154` (the stub scroller; it has no case where it cannot scroll),
    `:174` (`scroll-mt-12`).
  - `search-first.test.ts:296-298` (the tabs `sticky`, `pt-2`), `:352` (the
    results column `overflow-y-auto`), `:147-155` (the topbar
    `relative z-raised`).
  - `render.test.ts:744` needs `overflow-y-auto` on `SheetScroll`; its regex
    also accepts `md:overflow-y-auto`.
- **Menus**
  - `craft.test.ts:264-274`; `render.test.ts:876`, `:2948-2976` (the panel
    keeps `left-0`, `sm:left-auto sm:right-0` and a `max-w-[…]`);
  - `shell-account.test.ts:117-125`; `search-first.test.ts:86`;
    `search-filters.test.ts:96`; `links.test.ts:267-269`;
    `record-controls.test.ts:127-157`;
  - `record-sheet.test.ts:671`, `:694`: exact `<details class=…><summary`
    matches that break if an attribute is added.
- **Filter box and header**
  - `render.test.ts:1296-1334` (the `justify-end` group keeps `flex-wrap` and
    `min-w-0`), `:826-844` and `:1279-1293` (the range stays contiguous text:
    add a class to Caption, not a joiner character or a span), `:1882-1918`
    (Export and its status span), `:3074-3099` (the sort items);
  - `search-filters.test.ts:52-59`, `:71-91`; `links.test.ts:57-62` (a new
    plain `<a href>` in `search-composer.tsx` needs an entry);
  - `search-first.test.ts:357-377`; `rfq-rail.test.ts:59-75`.
- **List and card**
  - `pane-stability.test.ts:186-205` (the minimum-width maths), `:212-216`
    (two `data-name` lines per name cell), `:220-253` (the headers fit);
  - `render.test.ts:113` (truncation only on `data-name`/`data-line`),
    `:162-166` (exact card classes and banned breakpoint rules), `:184-187`
    (six thumbs, "+6 lines"), `:337`, `:361-363` (cell heights), `:378`
    (seven headers), `:438` (the name link), `:1927` (the scroll region's
    `overflow-x-auto`), `:2009-2012` (one checkbox, `ml-1`/`mt-4`);
  - `interaction.test.ts:480-518`; `rfq-rail.test.ts:33`, `:52-55`;
    `search-first.test.ts:216-229`; `app/(app)/app/record-routes.test.ts:683-692`.
- **Record**
  - `record-sheet.test.ts:561-562` (stacked facts), `:569` (the tabs), `:573`
    (the action bar's classes);
  - `render.test.ts:102` (`line-clamp` only on names), `:136` (no hex colours),
    `:1527` (the name uses `truncate`);
  - `record-head.test.ts:41` (the `MetaLine` call).
- **Touch**
  - `craft.test.ts:229-233` (`h-7`/`w-7`); `render.test.ts:1981` (the checkbox
    `size-4`);
  - `search-filters.test.ts:158` (the Open tooltip's hover classes), `:120`
    (`.link:hover`), `:140-144` (the type scale: fix the zoom without raising
    it);
  - `links.test.ts:339` (the `inline-flex` + `hover:underline` exemption);
    `search-first.test.ts:182`.
