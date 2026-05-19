# SourceBD — UI Context

> The visual language. Tokens here drive `tailwind.config.ts`. Source of truth: the v4 HTML mockup at `C:\Users\Hp\Downloads\SourceBD_Platform_v4(1).html`.

## Theme
- **Mode**: Light only in v1 (dark mode is v2).
- **Voice**: Confident, professional, intelligence-product. Not playful, not corporate-bland.

## Color tokens (CSS vars + Tailwind aliases)
```
--bg     #F2F0EA   page background (warm cream)
--sf     #FFFFFF   surface (cards)
--sb     #0D1C16   sidebar (deep forest)
--pri    #0D6B49   primary action (deep green)
--acc    #16B87A   accent (vivid green)
--acc2   #E8F8F0   accent tint (badges/hover)
--tx     #1A1812   primary text
--tx2    #6B6760   secondary text
--tx3    #A09D97   tertiary text / placeholders
--bor    rgba(0,0,0,.08)
--bor2   rgba(0,0,0,.13)

Status:
--sa  #ECFDF5  / --sac #047857   success
--sb2 #FFFBEB  / --sbc #B45309   warning
--sc  #FEF2F2  / --scc #B91C1C   danger
```
Tailwind aliases: `bg-bg`, `bg-sf`, `bg-sb`, `text-tx`, `text-tx2`, `text-tx3`, `bg-pri`, `bg-acc`, `border-bor`, etc.

## Typography
- **Display** (headings, score numbers, stat values): `Bricolage Grotesque` (700/600).
- **Body**: `Plus Jakarta Sans` (400/500/600).
- Scale: `text-xs` 11px · `text-sm` 12.5px · base 14px · `text-lg` 18px · `text-xl` 22px · `text-2xl` 28px · `text-3xl` 34px.
- Letter spacing: `-0.5px` on display headings.

## Radius & shadow
- `--r` 12px (cards), `--rs` 8px (buttons/inputs), `rounded-full` for avatars + score rings.
- `--sh` baseline `0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)`.
- `--shm` hover `0 4px 20px rgba(0,0,0,.1)`.

## Spacing scale
4px grid. `space-1` = 4 · `space-2` = 8 · `space-3` = 12 · `space-4` = 16 · `space-5` = 20 · `space-6` = 24.

## Iconography
- **Phosphor Icons React** (`@phosphor-icons/react`). Default weight: `regular`. Use `bold` only inside filled circular badges.
- Icon size matches text height: `text-sm` → 14px, base → 16px.

## Component primitives
- shadcn/ui base (Button, Card, Dialog, Tabs, Toast, Tooltip, Sheet, Select, Input, Label, Switch, Avatar, Badge, Separator).
- **Wrap** every shadcn component in a SourceBD variant where needed; do not edit shadcn primitives directly.

## Layout language
- **Sidebar**: 252px fixed, dark forest (`--sb`), white logo with green icon. Collapses to drawer at <860px.
- **Topbar**: 57px sticky, blurred cream, search input centered, notif bell + help + avatar on right.
- **Page container**: `padding: 24px 27px` desktop, `14px 15px` mobile.
- **Page header**: 22px Bricolage title + 12.5px subtitle, action buttons right-aligned.

## Score Ring (signature element)
- SVG circle, stroke-linecap round, animated `stroke-dashoffset`. Sizes: 40/46/56/120px.
- Colors by grade: A (≥80) `#047857` · B (60–79) `#B45309` · C (40–59) `#B91C1C` · D (<40) `#7F1D1D`.
- Center label: number in Bricolage 700 + grade letter below.
- **The ring IS the brand.** Used everywhere a supplier appears.

## Buttons
- `.btn` base → `inline-flex` + 9px 16px padding, 8px radius, 13px medium.
- Variants: `bp2` primary (deep green), `ba2` accent (vivid green), `bo` outline, `bsm` small.
- Always include icon + label gap of 7px. Icons inherit text color.

## Tags & badges
- Tags `.tag`: 11px, 5px radius, soft category color (knitwear=green, woven=amber, denim=blue, sweater=purple, factory=green, buying-house=orange).
- Badges `.badge`: 10.5px bold, 6px radius, status-colored pill.
- "SBI Verified" tag uses gradient `#E8F8F0 → #D1FAE5` with seal-check icon.

## Visual rules (non-negotiable)
- **No raw hex** in component code — tokens only.
- **No drop shadows on flat elements** (lists, table rows). Cards yes, rows no.
- All interactive elements have focus-visible ring (`ring-2 ring-acc/30 ring-offset-2`).
- All interactive elements have a hover state.
- Keyboard accessible: tab order, ESC closes modals, ENTER submits forms, arrow keys in lists.
- Touch targets ≥ 44×44px on mobile.
- All images have `alt`. All form inputs have `<label>`.
- Contrast: meets WCAG AA against the cream background.
- Loading states: skeleton boxes (not spinners) for >300ms operations.
- Empty states: illustrated (Phosphor icon at 38px) + helpful copy + primary CTA.
- Error states: red banner with icon + plain-English fix.

## Data sensitivity in UI
- Contact details (email/phone) shown blurred (`filter: blur(5px)`) for free / un-upgraded users with an "Upgrade to view" lock CTA.
- Server still doesn't send the value — blur is a fallback, not a control.
- Sanctioned suppliers show a red top-banner across the whole profile + score = 0.

## Data completeness transparency (authenticity moat)
We never hide records with sparse data — surfacing the gap is the trust signal.
- **Completeness badge** on every supplier card + profile header. Pill, 11px, neutral grey background.
  - `≥80%` → no badge (clean profile)
  - `40–79%` → amber pill: `Partial profile · 62%`
  - `<40%` → grey pill: `Limited data · last source update <year>`
- **"Why is data limited?" tooltip** on the badge — plain-English explainer:
  > *"This member's BKMEA register entry has limited contact data. SourceBD will auto-update when richer data appears in any verified source (brand supplier list, RSC, RJSC, or supplier self-claim)."*
- **Field-level placeholders** for blanks — never empty cells. Show `Not on register` in `text-tx3` italic instead of `—` or blank.
- **Sort & filter defaults** push low-completeness records below high-completeness ones, but they remain findable by name / reg number search.
- **Supplier-claim CTA** appears on low-completeness profiles: `Are you [Company]? Claim this profile to add contact details →`.
- **Data provenance line** at the bottom of every profile: `Source: BKMEA register (last verified <date>) · BGMEA · RSC · …`. Click → opens "Data sources" modal listing every source row with tier badge + fetched-at timestamp.
- This is the brand's authenticity wedge: *we show what the source shows, gaps and all*.

## Marketing site additions
- Live counter ("2,159 verified suppliers indexed") increments on data updates.
- Trust logo strip: RSC, BGMEA, BKMEA, WRAP, OEKO-TEX (logos used in nominative-fair-use mode, ≤80px tall, monochrome).
- "Built by a Bangladeshi founder" callout on About page (founder photo, story, signature).
