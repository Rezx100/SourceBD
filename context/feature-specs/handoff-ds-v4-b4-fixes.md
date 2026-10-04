# Hand-off: four fixes the founder asked for after B4b and B4c (4 Oct 2026)

Read first: `handoff-ds-v4-build.md` sections 2, 3, 5a, 6, 7 and 10 (the B4b and B4c
lines say what was built and what differs from Paper). This file only adds the
four fixes. Paper file id `01M3Z77QNSZKYX715Y21B8RKC2`; translated boards are in
`.impeccable/paper-export-34/`.

**State when this was written:** B4b (filter pane) is merged into `ds-v4` (#249).
B4c (the supplier record) is PR #250 into `ds-v4`, auto-merge on, CI running when
this was written. Check `gh pr view 250` first; B4d work branches off `ds-v4`
**after** #250 has merged (it touches `components/record/`). If #250 is red, read
`gh run view --log-failed` and fix that before anything else.

The working tree has untracked files that are not yours (`.agents/`,
`.cursor/mcp.json`, `.mcp.json`, `skills-lock.json`, `volza payment.jpg`). Leave them.
This hand-off file is untracked too: commit it with the first PR below.

## Who does which (section 5a)

| # | Fix | Model | Why |
| --- | --- | --- | --- |
| 1 | Contact block shows all four counts | Sonnet | Patterns and the record only. |
| 2 | Sites tab: the map, RC-09, RC-10 (this is B4d's first scope) | Sonnet, unless the geocodes need an RPC or a policy (then stop, hand to Opus) | Reads only, unless the data is not reachable from a buyer. |
| 3 | Phone filter as a bottom sheet | **Opus** | Changes `components/frame/list-pane.tsx` (the shell). |
| 4 | Docked filter pane 360 wide, over the list | **Opus** | Same file, same PR as 3. |

Do 1, then 2. Opus does 3 and 4 as one PR (they are one change to `ListPane`).
Each PR: one `/code-review`, then `gh pr merge --auto --squash`, one line in section 10 of
`handoff-ds-v4-build.md`, reply to the founder in five lines or fewer.

---

## Fix 1. The contact block shows email and phone counts only

**What is wrong.** The model holds four counts and the v4 contact block draws two.
`ContactCounts` in `lib/dashboard/models.ts` is `{ emails, phones, representatives, website }`
(read by `supplier_contact_counts`, 0105, counts only, never a value). The old record
printed all four ("Email: 1 on file", "Phone: 6 on file", "Website: on file",
"Contact person: 2 on file"). `components/patterns/contact.tsx` (`onFileWords`,
`LockedContact`, `LockedContactRow`) takes only `emails` and `phones`, so the record's
contact column, foot line and phone row drop website and representatives.

**Do.**
- Extend `onFileWords` and the two components with `website: boolean` and `representatives: number`.
  Words, in this order, only the kinds that exist: `Email 1 on file · Phone 6 on file · Website on file · Contact person 2 on file`
  (plural: "Contact people 2 on file" is wrong; keep "Contact person 2 on file" like the other kinds, a count with its noun).
- Pass them from `components/record/record-view.tsx` (the `Contact` function, the `locked` foot line, and the phone row).
- Keep every guard: counts only, a count that could not be read (`counts === null`) claims nothing,
  nothing on file says "No email or phone on file" only when the counts were read and are all zero.
- Update tests at the same boundaries: `components/record/record.test.ts` ("says the details are locked"),
  `app/(app)/app/record-routes.test.ts` ("the counts reach the locked card", it asserts the exact words),
  `app/dev/ds/v4-patterns.test.ts` and the `/dev/ds` gallery if they print the block.
- Add one case with website true and two representatives.

Paper only draws "Email 1 on file · Phone 6 on file". Say in the section 10 line that the
founder asked for all four, so Paper's board is now behind the build.

---

## Fix 2. The Sites tab: the map, RC-09, RC-10 (B4d, first scope)

**What is wrong.** B4c's Sites tab (`SitesPanel` in `components/record/panels.tsx`) is a plain list.
No map, no pins, no "exact or approximate" words (the model does not say which a site is). It also
still prints "Also filed as …" (the spelling variants) under each address, which the founder said
must not appear on buyer surfaces (RC-09). Remove that line first, it is a bug against a decision.

**The two register entries** (`ui-issue-register-oct-2026.md`, search `RC-09` and `RC-10`):
- RC-09: show each premises **once**, one clean address, no registry spellings, no "· registry spellings merged".
  Overview must not repeat the address the Sites tab shows (the Overview "Address" row is the register's ALL-CAPS text).
  Follow the boards: Aboni's Overview has no address row; A.R. Fashion's does ("Registered office").
  Rule to apply: drop the Overview address row when the record has sites to show on the Sites tab.
- RC-10: the Barikoi map must be on the buyer's record. It is built: `components/supplier/locations-map.tsx`
  (client, bkoi-gl/MapLibre, 52 KB: satellite/street toggle, pins by kind, a lighter style for approximate
  geocodes, near-duplicate pins fanned out, GeoJSON export, `?site=` deep links, arrow-key cycling, zero
  geocoding calls at runtime). Data: `address_geocodes` (migration `0077_address_geocodes.sql`),
  read through `lib/geo.ts`, `lib/barikoi.ts`, `lib/nearby-suppliers.ts` and the public profile page.
  **Find out first how the public profile reads it and whether a signed-in buyer can read it the same way.**
  If it needs a new RPC, a policy or a migration: stop and write a hand-back line for Opus. Never apply a migration.

**Paper boards to match** (`10-App-Desktop-Search-record`):
`Record-full-page-Aboni-Knitwear-Sites-map-one-address-per-site-desktop [9NZ-0]`,
`Record-full-page-Liberty-Knitwear-Sites-3-sites-5-RSC-buildings-desktop [9R8-0]`,
`Record-full-page-Mondol-Fabrics-Overview-2-sources-differ-approximate-site-desktop [9TE-0]`
(map in the right column with "Sites · 2 / Open map" and the site cards under it), and on the phone
`Map-full-screen-Mondol-Fabrics-phone [AV8-0]` and `-320 [B7O-0]`, `Record-Aboni-sites-phone [9Q6-0]` and `-320 [AIL-0]`,
`Record-error-sites-phone [FL8-0]`. Pull `get_screenshot` first, read the JSX only where unclear.

**Patterns already built (B2), take props, no data:** `components/patterns/locations.tsx`
(`Pin`, `SiteList` with `selected` and `href` per site, `PinLegend`, `MapCard` for the phone) and
`words.ts` (`SITE_WORDS`, `SiteKind`, `isApproximate`: confidence below 70 or missing). Two-way selection:
the selected address is tint plus a 2px brand bar, its pin gets a brand ring; a site is a link (`?site=2`),
so it works with no script; the map reports a pin click by changing the same address.

**Also in B4d** (the user's original list): exports (the "Exports v2 · Sample" tab: `Exports-12-month-view-…-Sample-state`
boards `[FN3-0]`, `[9VK-0]`, phone `[D5O-0]`, `[CGG-0]`; pattern `components/patterns/exports.tsx`),
the product line and HS code pages (`Product-line-Aboni-Knitwear-HS-6105 [EMB-0]`, phone `[D6L-0]`;
today `ProductSheet` from `components/dashboard/product-sheet.tsx`, the old kit). "Sample state" boards show the layout;
the built page shows live rows. The line pages' Back already goes to the record's Products tab (B4c).
Split B4d into one PR per screen group if it passes about 1,500 changed lines (map first, then exports, then product line).

**Real-data checks** (section 6): `ar-fashion` (one site, no certificates), a record with 3 sites and 5 RSC
buildings, a record with an approximate site, 125-character names, 320 and 1280 widths, no text under 12px,
phone controls 44px. Fixtures: `lib/dashboard/fixtures.ts` (`aboniInput`, `arFashionInput`, `longestNameInput`, `smKnitwearInput`).

---

## Fixes 3 and 4 (Opus). The filter pane's frame: a 360 panel over the list, and a bottom sheet on a phone

**What the build does now.** The filter pane (`components/search/filters.tsx` and `filter-panel.tsx`, B4b) is the
body of `ListPane`'s pane. `components/frame/list-pane.tsx` docks every pane at `w-pane` (640) beside the list from
1280, and under 1280 (a phone included) opens the kit `Drawer`: a full-height panel from the right, `w-pane max-w-full`.

**What Paper draws.**
- Desktop, `Filters-panel-open-live-count-desktop [DQG-0]`: the list stays full width and the panel is **absolute,
  right 0, top 56 (under the topbar), 360 wide, 844 tall, left border, shadow `#15181C2E 0 12px 32px`**, over the table.
  Nothing is squeezed. 360 is not a token (containers: `details` 344, `pane` 640): add one in the token file
  (Opus's) or use 344, and say which.
- Phone, `Filters-sheet-phone [7UZ-0]` and `-320 [81K-0]`: a **bottom sheet**, 12px top radius, 36x4 handle, scrim, a 16px gap
  above it, rows of 56 with their value beneath, a footer `Clear all` + `Show N suppliers`. The kit already has it:
  `Sheet` / `SheetPanel` in `components/kit/overlay.tsx` (`max-h-[90dvh]`, handle, title with a 44 close, footer slot).

**Do (one PR, `components/frame/list-pane.tsx` plus the filter panel's two layout hooks).**
- Let a page say how its pane is presented: for example `ListPane` takes `presentation?: "docked" | "overlay"`.
  Records, the composer and Save keep `docked` (640, beside the list). Filters use `overlay` at 1280 and over;
  at 768 to 1279 keep the right drawer (nothing is drawn there; say so); under 768 use the kit `Sheet`.
- Keep what `ListPane` guarantees: the pane is in the URL, Close and Escape go to `closeHref`, focus moves into the pane,
  Escape inside an input does not close it, the list stays live (no `inert`, no `aria-modal` beside a docked pane;
  an overlay panel over live results that is not modal must not claim to be).
- In `filter-panel.tsx`: remove the hacks that exist only because the drawer does not stretch it
  (`max-xl:min-h-[calc(100dvh-4rem)]` on the form, the `hidden xl:flex` header). In a `Sheet` the title and close are the sheet's;
  in the overlay the panel draws its own header (title, close). `defaultOpen` and `useDesktop` (768) already handle phone rows.
- Phone rows open their controls in place (Paper draws no sub-picker); keep that.

**Tests to keep green or rewrite at the same boundary:** `components/frame/frame.test.ts`,
`components/search/search.test.ts` ("the filter pane (B4b)"), `app/(app)/app/record-routes.test.ts`
("`?filters=1` opens the filter pane…", "an open record sits BESIDE the results…").
**Proof:** `.impeccable/preview/b4b-filters.cjs` + `b4b-shoot.cjs` (mimics the drawer; change it to mimic the new frame),
compare with `get_screenshot` of `DQG-0`, `7UZ-0`, `81K-0`.

---

## Rules that still bind (from this session, so you do not pay for them again)

- Never `cd` in Bash (the guard hook breaks), and Bash has no `git`/`gh` here: use PowerShell with absolute paths.
- Do not edit UTF-8 files with PowerShell `Get-Content`/`Set-Content` (mojibake and a BOM). Use the Edit tool, or
  `[IO.File]::ReadAllText(p, UTF8)` / `WriteAllText(p, s, UTF8Encoding($false))`. Commit and PR text go in a scratchpad file
  (`git commit -F`, `gh pr create --body-file`), written without a BOM.
- Tests: `pnpm exec tsc -p tsconfig.npm-test.json` (about 2 min), then
  `node --require ./test-stubs/register-node-test-aliases.cjs --experimental-websocket --test <file under .tests-build>`.
  Also `pnpm exec tsc --noEmit` (40 s to 10 min, depends on the machine), and lint with
  `ESLINT_USE_FLAT_CONFIG=false node node_modules/eslint/bin/eslint.js <paths>`. New test files go in `tsconfig.npm-test.json`.
- Server files must not pass icon components to kit client components (use `buttonClass` on `Link`/`button` with
  `@phosphor-icons/react/dist/ssr`). Never put a custom text size (`text-md`) and a colour (`text-ink`) in one `cn()`:
  the merge reads the size as a colour.
- Do not touch tokens, auth, RLS, RPC SQL or migrations (stop and write a hand-back). Contact values stay server-gated; no score on a buyer surface.
- Before a push, grep `*.test.ts` for the old markup you replaced (CI went red on it twice). Tests that pin the old record
  (`components/dashboard/*.test.ts`) stay valid: the old `SupplierSheet` and `ProductSheet` remain until B11.
- Proof for UI PRs: copy `.impeccable/preview/b4c-record.cjs` + `b4c-shoot.cjs` (record) or `b4b-*` (filters); the import into
  Paper's `90 Built` page is still not wired (the kit is wired to the old Paper file); say so in the section 10 line.

## Then

After these: the topbar typeahead (its own small PR), then B5 (RFQs, quotes, orders), B6, B7. Stop at B8 (Opus).
