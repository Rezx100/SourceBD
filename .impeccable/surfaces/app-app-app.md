---
version: 1
slug: "app-app-app"
primary_target: "app/(app)/app"
related_targets: ["components/dashboard"]
---

# Buyer app — craft pass, 27 Sep 2026

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

OWN-WORLD: warm paper canvas, white panels on hairlines, Geist and Geist Mono,
brand green spent only on the primary action, links, active nav and the
logo; motion is one decelerating curve (`cubic-bezier(0.16,1,0.3,1)`) at three
lengths (120 / 200 / 320 ms), entrances only, opacity-led, still under
reduced motion. Spot illustrations are ink line art with one green fill.

STORY: the buyer types, sees suppliers, places and certificates suggested
under the field, opens a record that slides in over the results, and sends an
RFQ; the pages they have not used yet show them what will be there.

FIRST VIEWPORT: the results list with the topbar search live; on a fresh
account, the page's illustration, title and one action centred in the panel.

FORM: an extension of the established world, no seed (surface rounds run
only on a new or replacement world; the founder pinned this one on 18 Sep and
accepted its rendition on 27 Sep).

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.

## Signature interactions

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

- The competitor's sticky record name in the tray bar on scroll (not built).
- Sidebar icon-only collapse at 1024–1279 (`dashboard-ux-flow.md` §8, not built).
