---
version: 1
slug: "app-app-app"
primary_target: "app/(app)/app"
related_targets: ["components/dashboard"]
---

# Buyer app — enterprise pass, 27 Sep 2026 (supersedes the craft pass of the same day)

The bar (founder, 27 Sep): buyers who already live in Linear, Airwallex, Ramp,
Stripe and Twenty-class dashboards. The critique of that day
(`.impeccable/critique/2026-09-27T14-19-11Z__app-app-app.md`, 19/40) found four
named defects confirmed: screens read as database dumps, hairlines everywhere,
cheap buttons, and every secondary interface a page jump. The founder picked
the direction once, on the decision page: G1 ledger grid, B1 quiet buttons,
S1 split pane. The founder's walkthrough of the competitor (screen recording,
27 Sep) added the product base (create manually, size chart, BOM, send as an
RFQ) and the composer's anatomy (targets, product, template message with
variables, questions, live preview, save draft).

Scope: every buyer route under `/app` drawn by the dashboard kit
(`components/dashboard/*`). Mode: Operate. The visual world is the locked
system (`ds-rebuild-must-stay.md` §9, `lib/design/tokens.ts`); this pass raises
the interaction and finish quality inside it, taking the founder's reference
(sourceready.com, walkthrough video 27 Sep) as the bar for feel, never for look.

Audience: sourcing and compliance staff at UK/US/EU/CA brands, at a desk, in a
shortlisting session. Job: search, open a record beside the results, save,
send an RFQ. Proof: receipts from named registers. Constraints: no score, no
AI in V1, locked contact state, sanction warning, Tailwind token classes only,
no new packages.

## Direction contract

THESIS: the ledger that answers as you touch it. Every action the buyer takes
is acknowledged by the surface within one frame, and the record arrives beside
the results rather than replacing them. Refused: the competitor's chat-first
home and its match-score theatre.

OWN-WORLD: neutral paper canvas, white panels grouped by tone (a hairline only where two regions meet), Geist and Geist Mono,
brand green spent only on the primary action, links, active nav and the
logo; motion is one decelerating curve (`cubic-bezier(0.16,1,0.3,1)`) at three
lengths (120 / 200 / 320 ms), entrances only, opacity-led, still under
reduced motion. Spot illustrations are ink line art with one green fill.

STORY: the buyer types, sees suppliers in a ledger grid, sorts by a column,
opens a record beside the results, ticks five suppliers and writes one RFQ to
them in the pane beside the list, and lands back on the same search with a
toast. Orders, RFQs, saved suppliers and conversations open the same way:
beside their list, never instead of it.

FIRST VIEWPORT (founder, 28 Sep 2026): the search landing at `/app` — the
rail, and in the middle one large search field with its suggestions, the
one-click filters, the common searches as templates with live counts and the
buyer's saved searches. No supplier is listed until the buyer searches; the
ledger grid is the results. The old Home desk (alerts, activity) is on Saved.

FORM: an extension of the established world, no seed (surface rounds run
only on a new or replacement world; the founder pinned this one on 18 Sep and
accepted its rendition on 27 Sep).

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.

## Signature interactions

- The pane (27 Sep, enterprise pass): one secondary surface for the whole app.
  The record, a product line, the RFQ composer (wide), the filters, save
  search, an order, an RFQ, a record inside a conversation: each opens beside
  the list it came from, carries its state in the URL, closes back to it on
  Escape or Close, and returns focus to the row that opened it. No modal, no
  scrim, no page jump; a page of its own only for a deep link.
- Ledger grid: sortable sticky headers, 36px rows, the open row marked, row
  actions always drawn in their own column (founder, 28 Sep 2026), ↑↓ j k ↵
  Space r s on the keyboard.
- Quiet buttons: four tiers by tone, 28/32/36, six states, one primary per
  screen.
- Product to RFQ: a product from the product base opens the composer
  prefilled; Add suppliers picks from saved suppliers, a search or recent
  RFQs, resolved on the server so a sanctioned one arrives flagged.

- Record pane (27 Sep, one-viewport shell): the record slides in from the
  right edge (320 ms, 32px) beside the results, both live, no scrim; below
  1024px it takes the content region. Close is a navigation back to the
  search and lands at once. The shell is drawn once by the layout and is the
  viewport from 768px; only the content region changes between pages.
- Page change: content fades in under a still rail and topbar (200 ms).
- Search: suggestions listed under the field as the buyer types, four kinds,
  keyboard-complete; the field's outline steps up to brand on focus.
- Press: every button settles 2 % smaller while held.
- Browser surfaces: selection, caret, checkboxes and scrollbars in the palette.

## Unresolved

- "Start with AI" on product creation: V2, gated on AI_ENABLED, absent until then.
- Members and team seats: the page says they arrive with Enterprise.
- Supplier portal and admin still draw the old shell.

- The competitor's sticky record name in the tray bar on scroll (not built).
- Sidebar icon-only collapse at 1024–1279 (`dashboard-ux-flow.md` §8, not built).

## The founder's video, 29 Sep 2026

Hand-off: `context/feature-specs/handoff-dashboard-video-29sep.md`, six PRs.
The founder answered its four questions on 29 Sep, before the decision page:

- **Q1, long names:** wrap between words, never mid-word, and give the name
  column the width. No ellipsis ("Unit 2" and a bracket tell sister
  factories apart). **Superseded the same day** (see "After the video PRs"
  below): one line, the qualifier on the line under it.
- **Q2, product photos:** keep the stock photos, presented differently (not
  removed). The decision page offers how.
- **Q3, "Material":** Material 3's principles (tonal surfaces, state layers,
  colour roles) built into our own tokens. No new package.
- **Q4, a register's own typo** ("Clean Globe Globe"): show it as filed.

PR 1 (stability and speed, no design decision) changed the record here:
the shell root and the list-and-pane frame are `overflow-clip` and a record
tab scrolls only its pane; the columns are sized from measured content and
the supplier column keeps 184px (its longest word) at the table's minimum
width; the record pane is half the region, not 55%; a line has its own
silhouette and one read; every pane-opening link shows a spinner at once.

**The decision page (PR 2), picked 29 Sep 2026.** Page:
https://claude.ai/artifact/8RnQGfi1bnVHnwG1qbaTsQ (option shots from
`.impeccable/preview/decision29.cjs`). The founder took the recommended
option in all seven:

1. **Colour: B Slate** (superseded the same day, below). Green stays on the one primary action and the logo.
   Selection, the active nav row, set filters, links, tabs, focus and the
   ticked box take the `accent` role (slate, `lib/design/tokens.ts`).
   Status hues do not change.
2. **Search field: A filled.** A tonal fill, no outline, no shadow; typing
   turns it white with a thin ink line under it (M3 filled field).
3. **Filters: A a row of menus.** Product, Certificate, Place, Company type,
   More; each opens a short list with production counts; a set filter shows
   its value on its button. Replaces the landing's four pill rows and the
   results' chip bar.
4. **Text size: B one step up**, buyer app only: caption 13, label and table
   14, body 15, title 16, eyebrow 12; the list's initials tile 40px.
5. **Icons: A line.** Fourteen in-repo SVGs on the 24px grid, 1.5px stroke,
   round ends, no package. The source-pending mark is a document with a
   clock, replacing the dashed square.
6. **Record head: A one row of marks.** The facts line is plain text; every
   source appears once, in one row of marks that name themselves on hover.
7. **Product photos: A a list with small photos.** One line per HS heading:
   a 40px photo tagged "illustration", the code, its name.

**Pick 1 superseded (29 Sep 2026, founder, after the names-and-facts deploy):**
"do not use this color but use different shades of black and white to
create visual depth". The `accent` role keeps its name and jobs but has no
hue: hover `surface-sunken`, selected `accent-tint` #E9E9E6, set
`accent-tint-strong` #DADAD6, the mark (focus ring, tab indicator, selected
bar, ticked box) near-black #0F130F. Fact icons are `ink-muted`, a step
behind their `ink-strong` value. Links lost their colour, so a text link
carries a grey underline at rest (`.link`), and names in lists underline on
hover. Green is still the primary action and the logo; status hues are
unchanged. Guard: `components/dashboard/search-filters.test.ts` (no channel
spread over 8 in `accent`).

**PR 3 (the shell), built.** The rail collapses to a 56px column of icons
from a toggle beside the logo (`sb_rail` cookie, read by the layout); its
current row is tinted with a 3px bar (slate then; grey and near-black now); the account corner is one menu (photo
from Settings → Profile, name or the email's name part, Settings,
Subscription, Sign out) on the rail and the topbar; the record pane's bar has
Expand, to the record's own page with "Back to results". The logo and
wordmark are untouched. The type step (pick 4) moved to PR 4, where the list
it mostly changes is rebuilt.

Originally planned: PR 3 (shell) applies 1 and 4 to the shell; PR 4 (search) 2, 3 and the
list's type; PR 5 (record) 5, 6 and 7; PR 6 (RFQ form) the green reduction
there.

**After the video PRs (29 Sep 2026), the founder's instructions and review.**
Hand-off: `context/feature-specs/handoff-dashboard-names-and-facts.md`.
"Company name must not break into a lot of lines, it must be single line,
the way Apple or Microsoft do it": every list, row, card title, menu, picker
and suggestion shows a name on one line cut at the end, the whole name in
`title` and the DOM; the qualifier (`splitQualifier`: "Unit-2", "Extension",
a former name) leads a second line with the type and place, so every row is
two lines and sister factories stay apart; the record's head shows the base
name on one line at heading size with the qualifier under it. DESIGN.md's
Wrapping Name Rule is now the One-Line Name Rule. The rail beside the
composer is one-line header, one-line rows, one-line footer, no controls.
