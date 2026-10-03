# Empty-state illustrations — provenance

Six spot illustrations for the buyer app's page-level empty states
(`EmptyState` with `art=` in `components/dashboard/page.tsx`). One object from
the buyer's own desk per feature, single-weight ink line art with one
brand-green fill, no text.

Generated 27 Sep 2026 on Higgsfield, model **Recraft V4.1** (`recraft_v4_1`,
`model_type: vector`, 1:1, 1k, palette `#262B26 #1B5E20 #FFFFFF`, background
`#FFFFFF`). The SVG each job returned was then cleaned by hand: the C2PA
metadata block and the full-canvas white background path removed, `transform`
attributes dropped, every fill snapped to a token (`ink` `#262B26`, `brand`
`#1B5E20`, `surface` `#FFFFFF`; one stray grey per file in `orders` and
`saved` snapped to `quiet.line` `#C1C7B9`), and the root set to
`viewBox="0 0 2048 2048"` with `aria-hidden`. On 4 Oct 2026 (SourceBD v4,
PR B0) the `ink` fills moved from `#262B26` to v4's `ink` `#15181C`; nothing
else in the files changed.
`activity.svg` was further thinned by hand after the finish review (27 Sep): every
second ruled-line path dropped (31 paths to 19) so its stroke mass matches the
other five; nothing was redrawn.

Every prompt shared this tail: *"thin uniform dark charcoal strokes, no text,
no letters, no gradients, no shadows, generous empty margin, centred, pure
white background, clean flat vector icon style like a premium fintech
empty-state spot illustration"*, after *"Minimal single-weight line
illustration,"* and the subject below.

| File | Job | Subject |
| -- | -- | -- |
| `messages.svg` | `1e17eced-52b9-4342-af0b-e16a232881dd` | one open paper envelope seen from the front with a folded letter rising half out of it, one small round postmark stamp filled in dark forest green as the only colour |
| `rfq.svg` | `5c31cdec-3358-49c9-8ef0-dd4a8e73b59a` | one A4 request sheet with three short ruled lines and a small table grid at the bottom, a paper plane lifting away from its top right corner leaving a dotted trail, the paper plane filled in dark forest green as the only colour |
| `orders.svg` | `a1aa1699-8a75-4923-a102-33fb725b967f` | one closed cardboard shipping carton in three-quarter view with a tied string and a small hanging tag, the tag filled in dark forest green as the only colour |
| `saved.svg` | `e90dc74f-7eb0-41d3-a04b-33e268dc6e62` | a neat stack of three index record cards slightly fanned, a ribbon bookmark draped over the top card, the ribbon filled in dark forest green as the only colour |
| `certificate.svg` | `c29106b0-b5e1-4115-a2fe-ca72307d087d` | one certificate document with a decorative border and two ruled lines, a round wax seal with two short ribbon tails at its lower right, the seal filled in dark forest green as the only colour with a small tick mark inside it |
| `activity.svg` | `7c9e22af-be4f-4e13-aad2-a906ae15e1e6` | one open ledger book seen from above with ruled columns on both pages, a small round pocket clock resting on the right page, the clock face filled in dark forest green as the only colour |

Illustrative only. They depict no supplier, no product and no document on
file, so they claim nothing (spec `ds-rebuild-must-stay.md` §2: nothing fake).
