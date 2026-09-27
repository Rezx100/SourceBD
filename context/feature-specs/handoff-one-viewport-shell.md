# Handoff — one-viewport buyer shell (27 Sep 2026)

Branch `redesign-one-viewport` off `development` (`0da5e16`, after PR #187 — the
three quick fixes — merged). Session 1 (cut short) left the WIP committed at
`af13db6`; session 2 (this file's state) finished the "Left to do" list below,
opened the PR to `development` with auto-merge. Founder's ask: ditch the mixed
old/new look, one design system, single-viewport UX, instant page-to-page
navigation, every buyer screen rebuilt, Mobbin as reference. Mobbin patterns
pulled: record as a side pane beside the list (Airwallex, Navattic, Twenty,
Melio), rail foot with account + plan meter (Clay, Air, Clerk), settings rail
(Deel, Laravel Cloud), two-pane inbox (Substack, Zillow).

## Root cause of what the founder saw
Every `/app` page drew its own `AppShell`, so each click tore the rail and
topbar down and rebuilt them (slow, nothing pinnable, shell reads on every
page); Discover carried two `q` inputs (topbar + composer); the record page
was an 880px `absolute` sheet with a left rule floating in a centred box.

## What shipped (session 1, `af13db6`)
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
  — pathname now optional; returns `account` inside the sidebar model), then
  `TourMount`. `template.tsx` fades the content; `kit-loading.tsx` is now
  just `<Page>`. (Session 1 also added a section-level
  `app/(app)/app/loading.tsx`; session 2 removed it — see the CI trap below.)
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
- `app/(app)/app/discover/page.tsx` rewritten: the results column
  (`flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6`,
  `hidden lg:flex` while a record is open) beside `<RecordPane>` holding the
  notices, `ProductSheet` or `SupplierSheet`; the composer form carries a
  hidden `q` and `<SearchComposer … submits>` with no text input.
- Messages list + thread pages: `<Page className="lg:min-h-0 lg:flex-1">` and
  the body wrapper `lg:min-h-0 lg:flex-1`, so the inbox fills the viewport.

## What shipped (session 2)
1. Gallery (`app/dev/ds/dashboard-screens.tsx`): the two record frames are an
   `AppShell className="md:h-full"` holding a `Workbench` (`ResultsColumn` +
   `RecordPane`, both from `sheet.tsx`, the same pair /app/discover draws); `Frame` gives a framed screen a fixed `height` (not a
   minimum) so the panes scroll inside it; every gallery shell passes
   `md:h-full`; the RFQ composer keeps `Stage`/`Scrim`/`assertModal={false}`.
   `components/dashboard/index.ts` exports `RecordPane`.
2. Tests rewritten for the pane (grep the old words if one comes back:
   `SheetFrame`, `aria-modal`, `inert=""`, `role="dialog"` on a sheet,
   `assertModal` on a sheet, `dialog: false`): `kit-shell.test.ts` (the layout
   draws the shell once, no page file does, `drawsKitShell` true for every
   /app route), `record-routes.test.ts` (results column `hidden lg:flex` only
   with a record open, nothing inert, nothing modal; the slow-read state and
   every `loading.tsx` render the content region only), `dialog-focus`,
   `record-controls`, `render` (Sheet: pane by default, page on request, never
   a dialog), `record-sheet` (no width of its own; the pane's clamp is
   `lg:` only), `craft`, `dashboard-screens` (one dialog on the page, the two
   record screens are panes beside live results), `links.test.ts` (the shell's
   rail prefetches, never the search; content links still opt out).
   `record-routes.test.ts` also pins that no `loading.tsx` sits above the
   record or line page (why: the CI trap below).
3. `pnpm exec tsc -p tsconfig.npm-test.json` clean; the dashboard, app and
   lib/dashboard suites green (797 tests); `next lint` clean.
4. Screenshot round (built-in browser over the `static-preview` launch config,
   `http://localhost:8765/.impeccable/preview/<name>-inline.html`): at 1440
   the rail is 232, the results column 544, the pane 664, both scrolling on
   their own, `<main>` never overflowing; at 390 the record takes the content
   region and the rail is the strip. It found one defect, fixed in the same
   round: beside an open record the result card's `sm:`/`lg:` rules still
   fired at 1440 and crushed the name and marks into a ~100px column. The
   card now keys nothing on the viewport: the identity block claims
   `min-w-[min(18rem,100%)]` before the actions share its row, the action
   cluster always wraps, the tiles row wraps and `PhotoStrip` claims 26rem.
   Guard: `render.test.ts` "beside an open record the card wraps…". The
   review PNGs were NOT written to `.impeccable/review/` (the built-in browser
   returns screenshots to the session, it cannot save files).
5. `DESIGN.md`, `.impeccable/design.json` and the surface brief describe the
   pane (no scrim, no 880px, the shell as the viewport); `current-state.md`
   and `active.md` carry one line each.
6. `/code-review` pass (four findings, all fixed: the phone strip follows
   every navigation via `NavCurrent currentKey`; the typeahead's value rule
   is `fieldValue()` so the gallery's field survives hydration; `KitLoading`
   lost its dead props at 21 callers; the results column is one
   `ResultsColumn`), PR to `development`, `gh pr merge --auto --squash`.

## Not started (say so in the PR; each is its own branch)
- Supplier portal + admin still on the old `components/shell` + `components/ui`.
- `/app/help` (no Help button until it exists — founder, 24 Sep).
- The upgrade/plans modal.
- Sidebar icon-only collapse at 1024–1279 (`dashboard-ux-flow.md` §8).
- The competitor's sticky record name in the pane bar on scroll.

## Traps this machine set
- CI's HTTP-boundary guard failed on the first push: a section-level
  `app/(app)/app/loading.tsx` is a Suspense boundary above the record page,
  so the shell streamed first with status 200 and the page's `notFound()`
  (404) and `permanentRedirect()` (308 to the mother company) became
  client-side fallbacks behind a 200. Removed; a route that must answer a
  status code cannot sit under a `loading.tsx`. The routes with their own
  loading state (discover, rfqs, …) never throw a status.
- A Bash heredoc whose body contains an apostrophe dies with
  "unexpected EOF while looking for matching `''" — write scripts with the
  Write tool into the scratchpad and run them with `python <path>`. Source
  files are CRLF: an edit script must convert its `\n` to `\r\n` first.
- The Write tool refuses to overwrite a file not opened with the Read tool
  first (reading it via `sed`/`cat` does not count).
- A background `tsc` reported exit 0 and emitted nothing; `.tests-build` was
  four hours stale and the tests ran against old code. Run `tsc` in the
  foreground with `--listEmittedFiles` when a result looks impossible.
- `.impeccable/preview/build.sh <name> <module.cjs>` always needs a module:
  `screens.cjs` renders the gallery, `pages.cjs` takes `PAGE=home|rfqs|saved|
  discover|record`. `render.cjs` swallows a module's throw and renders the
  gallery instead (it now prints the error first). A `RecordPane` with
  `closeHref` mounts `DialogFocus`, which needs Next's router and throws in a
  static render — the harness passes no `closeHref`.
- The built-in browser cannot open `file://` URLs; the `static-preview` launch
  config serves the repo root on 8765. Its pane is ~800px wide, so a 1440
  viewport is cropped: set `document.documentElement.style.zoom = "0.55"`
  through the javascript tool to see the whole frame.
- The local dev server is unusable (memory: 11-minute compiles, no DB); the
  static harness in `.impeccable/preview` is how screens get screenshotted.
