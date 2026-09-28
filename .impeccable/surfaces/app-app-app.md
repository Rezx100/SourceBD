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
  factories apart).
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
PRs 2–6 wait for the decision page.
