# Spec R1 — Responsive foundation

> First spec in the R-series. **Additive only**: builds the shared primitives every later R-spec consumes. Touches **zero** live routes; `routes-manifest.json` must stay at 64.

## 1. Goal
Make `sourcebd.net` enterprise-grade responsive (320 → 1440+, portrait + landscape, phone / tablet portrait / tablet landscape / desktop / large desktop). R1 ships the foundation only. R2 wires it into the app shell; R3–R6 consume it surface by surface.

## 2. Dependencies
- **None inbound.** R2 / R3 / R4 / R5 / R6 all depend on R1.
- R3 depends only on R1 (independent of R2).
- R4 / R5 / R6 depend on R2.

## 3. Hard rules carried in from AGENTS / the brief
- **No new tools / deps.** Native CSS, native `<dialog>`, the existing Tailwind 3.4.19 + cva + Radix Slot + Phosphor stack only. The `@tailwindcss/container-queries` plugin was considered and rejected in favour of one hand-rolled container-query section in `app/globals.css` (revisit only if `@container` usage exceeds ~5 components).
- **No edits to live components on routed pages** (no edits to `components/discover/filter-rail.tsx`, `components/shell/sidebar.tsx`, `components/shell/topbar.tsx`, `app/(app)/layout.tsx`, any `app/**/page.tsx`). R1 builds *new* siblings that R2/R3 will swap in.
- Responsive logic on `force-static` / ISR pages must be **CSS-only**. Any `'use client'` hook lives in an island, never in a static page (flipping static → dynamic is a hard fail).
- Flip **zero** caching directives. All 79 stay.
- I-033 session swap, I-034 redirects, B6 Realtime + decrypt, S2 register-PII allow-list, SBI admin-only — untouched.
- Marketing `[data-surface="marketing"]` tokens stay unpolluted. `.safe-*` go in unscoped `@layer utilities`.

## 4. Tier contract (locked for R2 to consume)
One primary nav per device class — no overlap.

| Device class | Width | Primary nav |
|---|---|---|
| Phone (`<md`, `<768`) | 320–767 | `BottomTabBar` (4–5 slots from current `*_SECTIONS` IA) + `MobileDrawer` hamburger for the full sidebar |
| Tablet (`md..<lg`, 768–1023) | 768–1023 | `SidebarRail` icon-only collapsed sidebar **only**. No bottom-tab, no drawer. |
| Desktop (`≥lg`, ≥1024) | 1024+ | Full `Sidebar` (current implementation) |

## 5. Deliverables

### 5.1 Tailwind config — `tailwind.config.ts`
- Add `theme.extend.screens.xs = '360px'` so XS phones (iPhone SE, small Androids) can be targeted distinctly from `sm` (640).
- No other token changes.

### 5.2 `app/globals.css` base additions
1. New `@layer utilities` block:
   - `.safe-pt`, `.safe-pb`, `.safe-pl`, `.safe-pr` → `padding-{side}: env(safe-area-inset-{side}, 0px);`
   - `.safe-px`, `.safe-py` shorthands.
   - `.safe-mt`, `.safe-mb` (margins, for offsetting fixed elements).
   - `.safe-bottom-0` → `bottom: max(0px, env(safe-area-inset-bottom, 0px));` for sticky bottom nav.
2. Mobile input 16px baseline (iOS focus-zoom kill). MUST NOT downgrade larger fields:
   ```css
   @media (max-width: 767px) {
     /* R1: iOS focus-zoom kill. Excludes any input/select/textarea that
        explicitly opted into ≥16px via a Tailwind text-* utility, so the
        rule never downgrades a deliberately-larger field. */
     input:not([type="checkbox"]):not([type="radio"]):not(.text-base):not(.text-lg):not(.text-xl):not(.text-2xl):not(.text-3xl):not(.text-4xl):not(.text-5xl):not(.text-6xl),
     select:not(.text-base):not(.text-lg):not(.text-xl):not(.text-2xl):not(.text-3xl):not(.text-4xl):not(.text-5xl):not(.text-6xl),
     textarea:not(.text-base):not(.text-lg):not(.text-xl):not(.text-2xl):not(.text-3xl):not(.text-4xl):not(.text-5xl):not(.text-6xl) {
       font-size: 16px;
     }
   }
   ```
   Specificity (0,3,1) on the input arm beats `text-sm` (0,1,0) so 14 px fields get bumped; explicit `text-lg`/`text-xl`/etc. inputs are simply not matched.
3. Reserved labelled section header `/* ============================================================ R1 container queries — keep all @container rules below this banner. ============================================================ */` near end of file. Container-type wrappers (`container-type: inline-size`) added per component as those components ship (see §5.3).

### 5.3 New primitives (10 files, all server-safe by default; client island only where interaction requires it)

| File | Kind | Purpose |
|---|---|---|
| `components/ui/responsive-table.tsx` | server | `<ResponsiveTable<TRow>>` with `mode="stacked" \| "priority" \| "swipe"`. Stacked = desktop `<table>`, mobile per-row label/value cards. Priority = 2–3 cols always visible, rest in `<details>` row detail. Swipe = horizontal scroll + sticky first column + edge-fade. CSS-only mode switch. Generic over row type. |
| `components/ui/sheet.tsx` | `'use client'` | Bottom-sheet / centered-modal built on native `<dialog>` + `showModal()`. Inset-aware (`.safe-pb`), backdrop tap-to-close (native `::backdrop`), `inert` on background nodes, body scroll-lock via `data-scroll-lock` attribute, focus-restore-on-close (native dialog gives focus containment + Esc for free), swipe-down close on bottom-sheet variant. **No hand-rolled focus trap.** |
| `components/ui/mobile-drawer.tsx` | `'use client'` | Off-canvas left/right drawer built on the same native `<dialog>` mechanism; one prop different from `Sheet`. |
| `components/shell/bottom-tab-bar.tsx` | server | Fixed `position: fixed; bottom: 0; left: 0; right: 0;` with `.safe-bottom-0` + `.safe-pb`, role-aware slots (top 4–5 from existing `BUYER_SECTIONS` / `SUPPLIER_SECTIONS` / `ADMIN_SECTIONS`), 56 px tall, visibility `md:hidden`. **Wired in R2.** |
| `components/shell/sidebar-rail.tsx` | `'use client'` | Standalone icon-only collapsed sidebar. New file; does **not** edit the live `components/shell/sidebar.tsx`. Slots reuse `BUYER_SECTIONS` / `SUPPLIER_SECTIONS` / `ADMIN_SECTIONS` constants — must export them from `components/shell/sidebar.tsx` if not already, or re-declare from the same shape. Visibility (when R2 wires it): `hidden md:flex lg:hidden`. |
| `components/ui/master-detail.tsx` | server + tiny island for scroll restore | Wide: list + detail side-by-side flex. Narrow: single pane with explicit back nav. Pure CSS for the layout swap; scroll-position restore via a `'use client'` `<MasterDetailScrollRestore>` sibling that runs `useLayoutEffect`. |
| `components/ui/wizard.tsx` | server (steps content) | `<Wizard steps={[...]} current={n}>` renders a stepper. Desktop: full horizontal stepper. Mobile: compact "Step N of M" + segmented bar. Pairs with `<StickyActionBar>`. |
| `components/ui/sticky-action-bar.tsx` | server | Reusable bottom sticky bar; mobile = full-width, inset-aware (`.safe-pb`); desktop = inline footer. Used by wizards, long forms (S2 profile editor), MSA generator, etc. |
| `components/ui/form-grid.tsx` | server | `<FormGrid cols={1\|2\|3\|"profile"}>` standardises the ~20 forms hand-rolling `grid-cols-1 sm:grid-cols-2/3`. |
| `components/ui/chip.tsx` | server | Dismissible chip primitive (label + optional × button) for FilterRail "applied filters" rail. |
| `components/discover/filter-rail-responsive.tsx` | `'use client'` for the Sheet trigger | Mobile composition: button "Filters (N)" → `Sheet` containing the existing FilterRail form fields; applied filters appear as `<Chip>` row above results. Desktop falls through to the existing horizontal FilterRail. **Wired in R3/R4.** |

### 5.4 `/dev/components` showcase additions
Extend `app/dev/components/page.tsx` (already double-gated: prod → 404, non-admin → 404) with one section per primitive. Each section renders the primitive at **xs / sm / md / lg / xl** simulated widths (use `max-w-[360px]` / `max-w-[640px]` / etc. wrappers + label) so reviewers can eyeball every breakpoint without resizing the browser.

## 6. Smoke — `ops/_r1_smoke.py`
Disk-based (per `/memories/scraping-ops.md`):
1. `tailwind.config.ts` source contains the literal substring `xs: "360px"` (or `'360px'`).
2. `app/globals.css` contains the `.safe-pt`, `.safe-pb`, `.safe-pl`, `.safe-pr`, `.safe-px`, `.safe-py`, `.safe-bottom-0` declarations.
3. `app/globals.css` contains the `@media (max-width: 767px)` block AND the inline `font-size: 16px` AND each of `input:not(`, `select:not(`, `textarea:not(` exclusion arms.
4. Each of the 10 new files in §5.3 exists on disk and has non-zero size.
5. `app/dev/components/page.tsx` imports each new primitive (regex scan for the import paths).
6. `pnpm build` artefact `.next/routes-manifest.json` exists; `staticRoutes.length + dynamicRoutes.length == 69` (the HEAD-as-of-2026-06-08 baseline — H1 cited 64; the +5 delta landed via debug batches I-001..I-010 + I-033 between H1 and today, all pre-R1 HEAD additions). R1 ships only non-page primitives + the `/dev/components` showcase + 6 spec MD files — zero new routes by construction.
7. `pnpm build` artefact `.next/BUILD_ID` exists + non-empty.
8. Forbidden-token scan (M5 set) of each new file — diff must be `[]`.

Print `R1 smoke PASSED — 8/8 checks, route count 64 unchanged.` on success.

## 7. Validation
- `pnpm typecheck` clean.
- `pnpm lint` clean (no new warnings; pre-existing unused-`_` warnings in `lib/email/templates/*` excluded).
- `pnpm build` green; route count must equal the baseline 64.
- `python ops/_r1_smoke.py` → PASS.
- Manual QA checklist (handoff in PR description): one row per primitive × breakpoint, verified by eye in `/dev/components`. Disk smoke cannot see horizontal overflow or tap-target size.

## 8. Out of scope (deferred to R2+)
- Editing `components/shell/sidebar.tsx`, `components/shell/topbar.tsx`, `app/(app)/layout.tsx`.
- Editing `components/discover/filter-rail.tsx`.
- Editing any `loading.tsx`. Skeleton parity with new responsive layouts is handled in the surface spec (R3 / R4 / R5 / R6) that introduces the new layout.
- Editing the marketing top-nav (R3 will add the hamburger drawer).

## 9. Architectural decisions to log on completion
1. Native `<dialog>` + `showModal()` over Radix Dialog or a hand-rolled focus trap — Radix Dialog is not in `package.json` (AGENTS rule 4) and the native element already provides focus containment + Esc + `::backdrop`.
2. Container queries hand-rolled, no `@tailwindcss/container-queries` dep — keeps the dep surface clean for the three components that need it.
3. `:not(.text-base):not(.text-lg)...` exclusion ladder on the 16 px input rule — specificity (0,3,1) beats `text-sm` (0,1,0) so sub-16 inputs get bumped, while inputs that opt into ≥16 via a utility class are simply not matched (no downgrade).
4. R1 ships `SidebarRail` and `FilterRailResponsive` as **new files**, not edits to the live ones — keeps R1 strictly additive and lets the swap-in live in the surface spec where the visual rewire is reviewed.
5. `BottomTabBar` slot source is the existing `*_SECTIONS` constants — invent no new destinations (matches user instruction d).
