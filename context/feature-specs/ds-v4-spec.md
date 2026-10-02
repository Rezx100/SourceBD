# SourceBD v4 design system: measured reference and recreation (S1)

3 Oct 2026. D-1 Vanta, D-2 IBM Plex Sans + Plex Mono (both defaults, kept on the
scores below). Board: Paper "SourceBD v4", page 00 Reference. Vanta sizes are
measured from Mobbin captures (1440x900 viewport, image px x 0.75). We copy
structure only: never Vanta's logo, purple, illustrations, typeface or words.

## D-1 scores (0-3: domain, tables, side pane, evidence, expiry, admin, phone, site)

Vanta 3,3,2,3,3,2,0,3 = **19**. Airwallex 2,2,3,2,1,2,3,2 = 17. Remote
1,2,1,2,2,2,1,2 = 13. 7shifts 0,1,1,1,2,2,3,1 = 11. Drata is not on Mobbin.
Vanta has no iOS app on Mobbin; the phone borrows patterns from Brex
([timeline](https://mobbin.com/screens/fdf16c74-5c67-4189-9ffb-4d2b83819811)),
Revolut Business ([grouped facts](https://mobbin.com/screens/6f7fb922-9411-4d6b-8d18-4a54e315882e))
and Grailed ([sticky action](https://mobbin.com/screens/d81c3fa3-8eb7-4e3e-b88a-e71b77d2b26a)).
64 Vanta screens, 13 site sections and 10 flows are in `.impeccable/review/mobbin/`.

## Measured reference: what we keep, what we change

| Item | Vanta (measured) | SourceBD v4 | Why |
| --- | --- | --- | --- |
| Shell | Topbar 56, sidebar 216, gutter 24 ([vendors](https://mobbin.com/screens/995e29ec-7ba8-4161-b4a1-ba8f9ec25bd9)) | Keep 56 / 224 / 24; one search box in the topbar | S-13: one search only |
| Breakpoints | Desktop only | 320 · 640 · 768 · 1024 · 1280 · 1440 | must-stay: 320 to 1440 |
| Spacing | 4px steps: 8, 12, 16, 24, 32 | Same 4px base; 2 to 80 | Proven rhythm |
| Page title | about 24/600 | 24/32 600, -0.01em | Fixes S-04 flat hierarchy |
| Table | Head 40, rows 60, density menu ([policies](https://mobbin.com/screens/7f317ce6-2e6e-4fb2-929d-c8de5b2c2f75)) | Head 36, row **40**; 56 when the name wraps; density and column menus kept | Bar: 15+ results per 1440x900 |
| Filters | Search 32x200 plus text dropdowns in one row | Keep; button shows its value ("Certificate: GOTS"); Clear all | S-19 |
| Bulk | Selection bar replaces filters ([docs](https://mobbin.com/screens/b1bd05de-af78-4d8e-8cb2-e6326fb1278c)) | Keep: Save, Send RFQ, Export | S-21 |
| Pagination | "1-10 of 15 results", per page, Previous/Next | Keep, with a noun: "1-25 of 10,266 suppliers" | Number with a label |
| Side pane | Drawer 640 over the list ([controls](https://mobbin.com/screens/a31c2c1c-11e7-468f-8751-16bc93561d89)) | Docked pane 640; list drops to name, type and place (576) | PRODUCT 4; S-11 |
| Record | Tabs + right details pane 344 ([vendor](https://mobbin.com/screens/f6a51d82-c6e3-45b5-9f5d-a5927560548f)) | Keep 344 for sources and contact | Fact and source side by side |
| Evidence | Files table: name, source, date ([review](https://mobbin.com/screens/79315542-ee5f-4572-a067-441e3f84d10b)) | Every fact row: value, state, "Source: X", date read | Receipts |
| Dashboard | Cards "Needs attention N" with bar ([home](https://mobbin.com/screens/d1ac04dd-3d3a-4a00-a27e-2660a267f7eb)) | Keep the counts; **no progress bars** | A bar to 100% reads as a score |
| Dialog | 480 wide, footer right, Cancel + primary ([invite](https://mobbin.com/screens/f85bbe62-560a-401f-ae1a-936a6aa32a73)) | 480 confirm, 640 form | Keep |
| Toast | Dark, bottom centre, icon + words ([tests](https://mobbin.com/screens/d33c50cb-a1db-4dbd-a420-49bbf678ba3d)) | Ink, bottom centre, 5 s, Undo when possible; errors stay inline | Keep |
| Empty | Title, one line, actions ([document](https://mobbin.com/screens/b23f35c2-86cf-49b4-8710-b47215063fa5)) | Left-aligned where the content would be; one sentence that sells; one action | S-18 |
| Tabs | 14px, 2px underline, count pill | Keep; underline in brand | One tab style |
| Settings | Sub-nav, users table, role select ([users](https://mobbin.com/screens/ebd97ad0-d4a6-4c68-9ceb-d275f0d3fce5)) | Keep for roles, invites, audit log | Register E |
| Onboarding | Split form, dot stepper, checklist guide ([flow](https://mobbin.com/flows/f060e178-6956-4685-b727-d9111d2c182c)) | Keep the structure; our words; no mascot | S7 |
| Site | Hero with product shot, accordion ([hero](https://mobbin.com/sites/sections/09afd018-1fc1-46d7-96b8-47ab66cba532)) | Same family; no logo wall or badges we lack | Honesty rules |

## Density and controls

Desktop controls 32 by default, 24 minimum (icon buttons in rows, with a 24x24
hit area), 40 for the main form action. Phone: every target 44x44, inputs 48 tall
with 16px text, tab bar 56 plus safe area, one sticky action bar (64) above it.
Prose at most 34rem (about 72 characters at 15px). Text never below 12px.
A number always carries its label or column head.

Buttons: primary (brand fill, white text, one per region); secondary (white,
line-strong edge, ink); quiet (no edge, ink-2, sunken on hover); danger (danger
fill, confirm dialogs only); link (brand, underlined). Disabled: sunken fill,
disabled text, not-allowed cursor. This fixes S-05 (one grey for every button).

Selected: one treatment everywhere (nav, list row, conversation): brand-tint fill
and a 2px brand bar. Tabs use the brand underline. This fixes S-06.

Forms: label above (13/500), help below (12), error below with icon (13, danger).
Field widths follow the content: 96, 200, 320, 480; one column, max 480.

## Status grammar

A chip is a 14px icon plus words, 24 tall, radius 4, 13/500. Normal states stay
neutral; colour is spent on problems. "Not on file" uses a dashed edge.
Certificates (S-07, never hue alone):

| State | Look | Words |
| --- | --- | --- |
| Valid | white, line edge, check (ink-2) | Valid until 12 May 2027 |
| Expiring (90 days) | caution tint, solid edge, clock | Expires 5 Oct 2026 · in 2 days |
| Expired | danger tint, solid edge, cross | Expired 29 Sep 2026 |
| No expiry on file | white, dashed edge, minus | No expiry date on file |

Facts: current (no chip), stale (caution, clock), contradicted (danger, "Sources
disagree"), source changed (info). Sanctioned: a solid sanction band with an
octagon icon at the top of every surface, never a chip; Send RFQ is refused.

## Colour (only #1B5E20 is carried over)

Brand: `#1B5E20` buttons, links, focus; hover `#154A19`; active `#0F3812`; tint
`#E8F2E8` selected; wash `#F4F9F4` hover on actionable rows. No supplier status
is green. A success toast uses brand, because it confirms the buyer's action.
Neutrals: ink `#15181C`, ink-2 `#3B4149`, ink-3 `#59606A`, disabled `#9AA0A8`,
line-strong `#858C96`, line `#DDE0E4`, surface `#FFFFFF`, subtle `#F7F8F9`, sunken
`#EEF0F2`. Signals: caution `#8A4A00` on `#FFF3DC` (icon `#B25E00`); danger
`#A8231B` on `#FDECEA`, solid `#B42318`; sanction `#6E0B1C`, tint `#F8E5E9`; info
`#1C4F8F` on `#E9F1FB`.

WCAG 2.2 ratios (`.impeccable/review/ds-v4/s1/contrast.py`; text needs 4.5, edges and icons 3):
ink on white 17.81, subtle 16.75, sunken 15.59, brand-tint 15.52 · ink-2 on white
10.30, subtle 9.69, sunken 9.02 · ink-3 on white 6.35, subtle 5.97, sunken 5.56,
wash 5.96 · brand on white 7.87, subtle 7.40, tint 6.86, wash 7.38 · white on
brand 7.87, hover 10.37, active 13.17 · caution 6.24 on its tint, 6.86 on white;
icon 4.25 · danger 6.29 on tint, 7.19 on white; white on danger solid 6.57 ·
sanction 10.06 on tint, white on sanction 12.16 · info 7.19 on tint, 8.19 on white
· line-strong 3.39 on white, 3.19 on subtle · disabled 2.64 (exempt).

## Type (D-2: IBM Plex Sans + IBM Plex Mono)

Measured in Chromium with the Google Fonts files, same strings, nowrap (Plex vs
Inter): results row at 14px 476 vs 511px (6.8% narrower); fact row at 13px
610 vs 649 (6.0%); the 100-character Zaheen name at 14/500 633 vs 673, 3 lines at
300px in both; x-height 0.52 vs 0.55 em. The monos are the same width (0.6 em).
Plex wins on density, keeps I, l and 1 apart, and has tabular figures, so it is
chosen. Script: `.impeccable/review/ds-v4/s1/typetest.cjs`.

Ramp (size/line, weight): 12/16 labels and column heads; 13/18 fact rows, chips,
mono codes; 14/20 cells, controls, body; 16/24 prose and phone body; 20/28 section
title; 24/32 page title; 32/40 record name on the full page; 40/48 site headings.
Weights 400, 500 (names, labels), 600 (headings). Tracking -0.01em at 24 and up,
-0.02em at 32 and up. Mono for certificate, register and HS numbers; dates stay
in sans with tabular figures, "12 May 2027" everywhere (S-22).

## Shape, icons, motion

Radius 4 (controls, chips), 6 (tables, cards), 8 (panels, dialogs): three, down
from twelve. Borders 1px; focus ring 2px brand with a 2px offset. Cards have no
shadow; menus `0 4px 12px rgb(21 24 28 / .12)`; dialogs and the docked pane
`0 12px 32px rgb(21 24 28 / .18)`. Phosphor Regular at 16 (in 14px rows), 20
(nav, buttons), 24 (phone tabs, empty states); Fill only for status icons.
Motion: 120ms colour on hover and press, 200ms pane slide, 160ms dialog fade;
nothing under reduced motion; no motion on data.

## Tailwind v4 token names (S2 sets them in Paper and code)

`--color-brand`, `-brand-hover`, `-brand-active`, `-brand-tint`, `-brand-wash`,
`--color-ink`, `-ink-2`, `-ink-3`, `-disabled`, `-line`, `-line-strong`,
`-surface`, `-subtle`, `-sunken`, `-caution`, `-caution-icon`, `-caution-tint`,
`-danger`, `-danger-solid`, `-danger-tint`, `-sanction`, `-sanction-tint`,
`-info`, `-info-tint` · `--font-sans`, `--font-mono` · `--text-xs` 12, `-sm` 13,
`-base` 14, `-md` 16, `-lg` 20, `-xl` 24, `-2xl` 32, `-3xl` 40, each with
`--text-*--line-height` · `--font-weight-regular|medium|semibold` ·
`--leading-tight|normal` · `--tracking-tight` -0.01em, `-tighter` -0.02em ·
`--spacing` 4px plus `--spacing-row` 40, `-control` 32, `-control-sm` 24,
`-touch` 44 · `--radius-sm|md|lg` · `--breakpoint-xs` 20rem, `-sm` 40rem,
`-md` 48rem, `-lg` 64rem, `-xl` 80rem, `-2xl` 90rem · `--container-prose` 34rem,
`-dialog` 30rem, `-pane` 40rem, `-details` 21.5rem, `-sidebar` 14rem ·
`--opacity-disabled` 100% (a colour, not opacity) · `--shadow-menu`, `-dialog`.
