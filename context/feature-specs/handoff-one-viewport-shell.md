# Handoff — one-viewport buyer shell (27 Sep 2026, session cut short)

Branch `redesign-one-viewport` off `development` (`0da5e16`, after PR #187 — the
three quick fixes — merged). WIP is committed locally at the end of this
session; nothing pushed, no PR. Founder's ask: ditch the mixed old/new look,
one design system, single-viewport UX, instant page-to-page navigation, every
buyer screen rebuilt, Mobbin as reference. Mobbin patterns pulled: record as a
side pane beside the list (Airwallex, Navattic, Twenty, Melio), rail foot with
account + plan meter (Clay, Air, Clerk), settings rail (Deel, Laravel Cloud),
two-pane inbox (Substack, Zillow).

## Root cause of what the founder saw
Every `/app` page drew its own `AppShell`, so each click tore the rail and
topbar down and rebuilt them (slow, nothing pinnable, shell reads on every
page); Discover carried two `q` inputs (topbar + composer); the record page
was an 880px `absolute` sheet with a left rule floating in a centred box.

## Done, in the tree
- `lib/dashboard/nav.ts`: NAV / navMatch / activeNavKey moved out of app-shell.
- `components/dashboard/sidebar-nav.tsx` (client): marks the current item from
  `usePathname()`; `active` still accepted as an override (gallery, tests).
  Prefetch on every rail link except the search (rate-limited).
- `components/dashboard/search-carry.tsx` (client): on `/app/discover` the
  topbar search form carries the current filters as hidden fields.
- `components/dashboard/app-shell.tsx` rewritten: root `md:h-dvh md:overflow-hidden`,
  rail `md:h-full md:overflow-y-auto`, `<main>` is the scroll region
  (`flex min-h-0 flex-1 flex-col overflow-y-auto`, no padding), account block
  (initial · name · email → /app/settings) at the rail foot above the plan,
  `inert`/`overlay` props gone, new `className` prop (gallery passes
  `md:h-full`). Typeahead + SearchCarry sit in a `<Suspense>`.
- `app/(app)/app/layout.tsx` draws `AppShell` once (`loadBuyerShell(supabase)`
  — pathname now optional; returns `account`), then `TourMount`.
  `template.tsx` fades the content; `loading.tsx` = section skeleton;
  `kit-loading.tsx` is now just `<Page>` (old `path`/`screenLabel` props
  accepted and ignored, so the 14 route `loading.tsx` files still compile).
- `components/dashboard/page.tsx`: new `Page` frame (max-w, gutter, gap-4).
  All 24 pages no longer render `AppShell`: 18 migrated by script to
  `return <Page>{await Body(props)}</Page>`, plus by hand: record page
  (`<SupplierSheet mode="page">`, timeout states in `<Page>`), lines page
  (`<ProductSheet mode="page">`), products, searches, searches/new.
- `components/dashboard/sheet.tsx`: `Sheet({ label, mode: "pane" | "page" })`
  — no `role="dialog"`, no `aria-modal`; pane carries `data-record-pane=""`
  and `tabIndex={-1}`; `RecordPane` (from `lg`: `w-[clamp(480px,55%,760px)]`
  with a left hairline beside the results; below `lg` it fills `<main>`);
  `SheetFrame` deleted; `SheetScroll({ measure })` centres a 1120px body on
  the page. `Stage`/`Scrim` kept for the gallery's RFQ composer.
  `supplier-sheet.tsx` / `product-sheet.tsx` take `mode`; their two-column
  grids wait for `2xl`/`xl` in a pane, `lg`/`md` on the page.
  `dialog-focus.tsx` targets `[data-record-pane]`.
- `search-composer.tsx`: `submits` prop — go disc submits and Add filter is a
  link without a text input. `inbox.tsx` fills `lg:min-h-0 lg:flex-1`.
- `.impeccable/design.json`, `DESIGN.md` untouched this session (the visual
  world is unchanged; only the frame and page structure moved).

- `app/(app)/app/discover/page.tsx` rewritten: the results column
  (`flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6`,
  `hidden lg:flex` while a record is open) beside `<RecordPane>` holding the
  notices, `ProductSheet` or `SupplierSheet`; the composer form carries a
  hidden `q` and `<SearchComposer … submits>` with no text input; no
  `AppShell`, no `loadBuyerShell`, no `SheetFrame`.
- Messages list + thread pages: `<Page className="lg:min-h-0 lg:flex-1">` and
  the body wrapper `lg:min-h-0 lg:flex-1`, so the inbox fills the viewport.

Nothing has been compiled or tested yet: `tsc` has not run on this tree.

## Left to do, in order
1. `app/dev/ds/dashboard-screens.tsx`: the SupplierSheet and ProductSheet
   frames use `Stage`/`Scrim` + `assertModal` (gone) — replace each with
   `<AppShell className="md:h-full" …><div className="flex min-h-0 flex-1 lg:flex-row">
   results column + <RecordPane>sheet</RecordPane></div></AppShell>`; pass
   `className="md:h-full"` on every gallery AppShell; RfqComposer keeps
   `Stage`/`Scrim`/`assertModal`. Also `components/dashboard/index.ts` still
   exports `Stage`; add `RecordPane`, drop nothing else.
2. Tests to update (grep the old words: `SheetFrame`, `aria-modal`, `inert=""`,
   `role="dialog"`, `assertModal`, `dialog: false`):
   - `lib/dashboard/kit-shell.test.ts`: now asserts NO page file renders
     `<AppShell` and `app/(app)/app/layout.tsx` does; `drawsKitShell` true
     for every /app route.
   - `app/(app)/app/record-routes.test.ts`: drop the `data-plan` assertion
     (~208, the shell is the layout's now); `role="dialog"` → `data-record-pane`
     at ~377/386/685/832; the inert/aria-modal tests (~399–438, 691, 697, 898)
     become: results column carries `hidden lg:flex` when a record is open
     and not otherwise, no `inert`, no `aria-modal` anywhere.
   - `components/dashboard/dialog-focus.test.ts` 31–40: `<RecordPane` frames
     carry `openKey=`; `data-record-pane=""[^>]*tabIndex={-1}`.
   - `components/dashboard/record-controls.test.ts` ~253: selector
     `[data-record-pane]`.
   - `components/dashboard/render.test.ts` 335–352: SupplierSheet/ProductSheet
     default (pane) has `data-record-pane` and no dialog role; `mode: "page"`
     has neither. RfqComposer case unchanged.
   - `components/dashboard/record-sheet.test.ts` 430–449: `dialog: false` →
     `mode: "page"`, `role="dialog"` → `data-record-pane`.
   - `app/dev/ds/dashboard-screens.test.ts` 501–547 (`modals === 1`, only
     "New RFQ" is a dialog) and 740–754 (the two sheet frames now fall into
     the plain-screen branch).
   - `components/dashboard/craft.test.ts` 58–69 should still pass
     (`defaultValue` wins with no router).
3. Build the test tree once — `pnpm exec tsc -p tsconfig.npm-test.json` — then
   `node --require ./test-stubs/register-node-test-aliases.cjs --experimental-websocket --test`
   the touched files under `.tests-build/`. Run `pnpm exec next lint` for
   unused imports (`createSupabaseServerClient`, `Caption`, `Title` may be
   unused in a page or two after the script). CI does the rest.
4. Screenshots: `.impeccable/preview/pages.cjs` `shell()` must match the new
   `AppShell` props (add `account`, drop `mainId`/`screenLabel` if wanted) and
   gain `discover` (results + RecordPane) and `record` (mode="page") cases;
   `build.sh <name> pages.cjs`, then open `<name>-inline.html` in the built-in
   browser at 1440 and 390 and save to `.impeccable/review/`. Then
   `/code-review`, PR to `development`, `gh pr merge --auto --squash`.
5. Not started (say so in the PR): supplier portal + admin still on the old
   `components/shell` + `components/ui`; `/app/help`; the upgrade/plans
   modal; sidebar icon-only collapse at 1024–1279.

## Traps this machine set
- A Bash heredoc whose body contains an apostrophe dies with
  "unexpected EOF while looking for matching `''" — write scripts with the
  Write tool into the scratchpad and run them with `python <path>`.
- The Write tool refuses to overwrite a file not opened with the Read tool
  first (reading it via `sed`/`cat` does not count).
- The local dev server is unusable (memory: 11-minute compiles, no DB); the
  static harness in `.impeccable/preview` is how screens get screenshotted.
