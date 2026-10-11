# Rules for building a screen from a Paper board (phone redesign, 11 Oct 2026)

You build part of the SourceBD buyer phone redesign from Paper boards, in your OWN git worktree,
on your OWN branch. The lead merges your branch into a PR later. You do NOT push, open PRs, or
touch other worktrees. Commit on your branch when done (several commits are fine). End commit
messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Hard rules (the repo's, plus this job's)

- **Never `cd` in Bash.** A guard hook runs relative to the shell's cwd (E:\SourceBD) and every
  Bash call fails after a `cd`. Use absolute paths, `git -C <worktree>`, the Read/Edit/Grep tools,
  or PowerShell `Push-Location` (PowerShell has its own cwd). Never quote guard-forbidden text in a
  command (pushes, `gh pr merge` by hand, `--apply`, ssh, `psql -c`, writing `.env`).
- No new packages, no new design tokens, no migrations, no `loading.tsx` on detail routes
  (`suppliers/[slug]`, `messages/[thread]`, `rfqs/[id]`, `orders/[id]`, `products/[id]`, any `new`
  route — tests forbid it so 404s keep real status codes).
- **Phone only.** Desktop layouts must render exactly as today. Change phone styling with
  `max-md:` variants, or render a phone block with `md:hidden` next to the desktop block with
  `max-md:hidden` — whatever the existing component already does. Keep every handler, server
  check, form action, auth/ownership read and existing copy unless the board changes the copy.
- Server enforces auth; never move a check into the client.
- Every tappable row, card and button is a `next/link` `<Link>` or a kit button. Never navigate
  with `onClick` + `router.push`. Every tappable thing gets a pressed state: `active:bg-sunken`
  (on a surface that is already `bg-sunken`, use `active:bg-line`). Put `<LinkPending />`
  (`components/patterns/link-pending.tsx`) inside list-row links that lead to a detail route, so
  the tap shows a spinner at once. Do not add `prefetch={false}` to new links.
- Use the kit where it exists: `components/kit` (tabs, chip, button, fields, phone `ActionBar`,
  `RefusedBar`, overlay/sheet) and `components/patterns`. The generated classes tell you which
  variant to pick. The frame (`components/frame/phone.tsx`) already draws the top bar (`PhoneBar`,
  page title + account button) and the tab bar (`PhoneTabs`) — do not draw them again. A board's
  "Page head" duplicates `PhoneBar` on tab screens: keep only one (prefer the frame's; if the board's
  head has extra content, put that content below the frame bar).
- Map Paper colour tokens onto existing Tailwind tokens (`tailwind.config.ts`, `lib/design/tokens.ts`).
  The converter already does `var(--color-x)` → `text-x`/`bg-x`/`border-x`. If a class it emits does
  not exist in the Tailwind config, or the board uses a raw hex with no token, STOP on that item and
  report it in your final message — never invent a token.
- Data facts (production, 11 Oct): UFLPA list WAS read on 8 Oct 2026 (253 entries, 0 suppliers
  matched). Never write "UFLPA list is not read yet"; say "No link found · not a clearance · read
  8 Oct" (from the data, not hard-coded where the route has a date). Customs data is per supplier
  and per market, never per HS code. `/compliance/msa` drafts the buyer's own statement. Saved-search
  alerts are one weekly on/off switch (`saved_searches.alert_weekly`). New order ends "Cancel /
  Create order". Sample names/numbers on boards are sample copy — replace with route data.

## Paper → app pipeline (already pulled; do not re-pull unless a board is missing)

- Scripts: `plugins/paper-to-app/scripts/` (`convert.cjs`, `check.cjs`, `pull.cjs`, `convert.test.cjs`).
- Page 36 pulls: `plugins/paper-to-app/boards/page-36/<name>.{jsx,inline.jsx,tree.txt,paper.jpg}`.
  Page 35 (supplier drawer) pulls: `plugins/paper-to-app/boards/page-35/`.
- Already converted TSX: `plugins/paper-to-app/boards/tsx36/<name>.tsx` and `tsx35/`. Read these first:
  they are pixel-exact against Paper (layer names become `{/* comments */}`; a renamed text layer
  marks a data slot). `.paper.jpg` is the board picture; read it with the Read tool to see it.
- Use `.inline.jsx` for exact values when in doubt. Never read sizes or colours off a screenshot.
- Paper desktop answers at `127.0.0.1:29979/mcp` if you must re-pull (`node pull.cjs <outDir>
  <nodeId>=<name>`). File "SourceBD v4" `01M3Z77QNSZKYX715Y21B8RKC2`, page 36 `p-L-0`, page 35
  `p-K-0`, page 33 `p-I-0` (what's shipped today).

## Workflow per screen

1. Read the converted TSX + board picture, then the route and the components it renders.
2. Rework the existing phone rendering to match the board, with route data. Reuse kit pieces.
3. Grep every `*.test.ts` under `components lib app` and `scripts/test-profile-http-boundary.mjs`
   for markup/copy you changed or removed; update those tests in the same branch.
4. Anything an outside caller can see that you changed (rendered copy like the UFLPA line or the
   "no customs records" state) gets a test at the boundary: a route/page render test (routes are
   rendered in tests with `prerenderToNodeStream`; copy the pattern from the nearest existing
   `*.test.ts` for that route) or a `CASES` entry in `scripts/test-profile-http-boundary.mjs`.
   A new `*.test.ts` only compiles if listed in `tsconfig.npm-test.json` `files`.

## Checking your work

- Build the test output once per worktree (40–70 s): in PowerShell
  `Push-Location <worktree>; pnpm exec tsc -p tsconfig.npm-test.json; Pop-Location`. Then run only
  the test files that cover your change:
  `node --require ./test-stubs/register-node-test-aliases.cjs --test .tests-build/<path>.test.js`
  (from the worktree, in PowerShell). Do NOT run the whole suite (CI does).
- Type-check strictly: `pnpm exec tsc --noEmit -p tsconfig.json` from the worktree (CI runs this;
  slow but required once before you finish). Lint changed files:
  `$env:ESLINT_USE_FLAT_CONFIG='false'; node node_modules/eslint/bin/eslint.js --no-ignore <files>`.
  JSX text needs `&apos;`/`&quot;` for quotes.
- Screenshot at 390 px with the phone harness: set `$env:SOURCEBD_ROOT='<your worktree, forward
  slashes>'` then `node .impeccable/preview/build-mobile.cjs (founder machine only; gitignored) <label> <shot>` with
  `WIDTHS=390` (see the top of that file and `real-pages.cjs` for shot names; add a shot case in
  `real-pages.cjs` only if needed — that folder is gitignored and shared, so add, never change
  existing cases). Output lands in `<worktree>/.impeccable/review/mobile/<label>/`. Compare with the
  board's `.paper.jpg`, fix what differs in ONE batch, then stop. If the harness cannot render a
  route, say so in your report rather than sinking time into it.

## Final message to the lead (short)

Branch name, commit SHAs, the boards done, test files run and their result, any token/hex you
stopped on, anything not done and why, and the paths of your 390 px screenshots.
