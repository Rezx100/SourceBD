# Hand-off: SourceBD v4, built from Paper and put live (Phase 5)

Written 3 Oct 2026. The founder wants the new design in production. Everything
is drawn in Paper and reviewed. This hand-off takes it from the Paper file to
the live site, PR by PR, across as many sessions as it needs. It replaces
section 6 of `handoff-ds-v4-paper-first.md` for the build; that file's other
sections still hold (the bar in section 7, the marketing routes in section 5,
onboarding in section 4).

**Done means:** every buyer, onboarding, marketing and public page serves the
v4 design in production, the old kit is deleted, and the bar in section 7 of
the paper-first hand-off is met on the built pages. The last step is the
founder's click on Deploy Production; nothing before it needs the founder
except the decisions in section 8 and the 0109 apply.

---

## 1. Where things stand (checked 3 Oct)

- **Paper file:** "SourceBD v4", id `01M3Z77QNSZKYX715Y21B8RKC2`, about 450
  boards. Pages: `01 Foundations`, `02 Components` (7 boards, every state:
  default, hover, focus-visible, pressed, disabled, loading), `03 Patterns`,
  `10`/`11` App desktop/phone for four flows, `20 Onboarding`, `30`/`31`
  Marketing, `90 Built` (empty, for proof). 98 tokens.
- **The written system:** `context/feature-specs/ds-v4/DESIGN-v4.md` (map of
  the file, tokens, components, patterns, shell, honesty rules, known gaps).
  Words: `voice-v4.md` and `ds-v4/copy-inventory.md`. Decisions and the open
  design debt: `ds-v4-progress.md` ("What is left").
- **Code today:** Tailwind **3.4** (`tailwind.config.ts`, `app/ds.css`,
  `lib/design/tokens.ts`, `lib/design/tokens.test.ts`), Next 15, React 19,
  `@phosphor-icons/react` installed (Paper's icons are Phosphor paths).
  Buyer app under `app/(app)/app/*`, admin and supplier portal under
  `app/(app)/(old-shell)/*`, marketing `app/(marketing)`, public supplier page
  `app/(public)/suppliers/[slug]`, auth `app/(auth)`.
- **CI** runs only for PRs into `main` and `development`
  (`.github/workflows/ci.yml` lines 3-7).
- **Database:** `0109_buyer_onboarding_answers.sql` (the onboarding answers:
  job role, terms, company country, HS headings, required certificates,
  markets; `onboarding_save_buyer` / `onboarding_get_buyer`) is on
  `development` via PR #231. **Not applied to production.** Dry run clean:
  `ops/plans/0109-dry-run.md`.
- **"Fix now" list** (`ui-issue-register-oct-2026.md`, top section): T-01
  (Modern Slavery statement) and T-02 (expired certificates in the watch) are
  on `development` (#226, #228). The rest were not checked: verify each before
  starting it.

---

## 2. Decisions already made (do not reopen)

- **Paper is the source, used as it is.** Every colour, size, gap, border,
  radius, font size and state comes from Paper's own export (`get_jsx`,
  `get_tokens`, `get_computed_styles`). Never from a screenshot, never by eye,
  never from the old components' classes. Screenshots are for checking only.
- **What the build adds, and only this:** real elements where Paper has boxes
  (`button`, `a`/`Link`, `input`, `label`, headings, lists, `table`); live data
  where Paper has sample text; one responsive page where Paper has separate
  1440/390/320 boards (each width must match its board); the phone mock
  status bar and home indicator removed; focus, keyboard and the few undrawn
  loading/error states made from existing tokens only (section 6).
- **Tailwind stays on 3.4** (founder, 3 Oct). Paper exports Tailwind 4
  classes; a script translates them (section 4). No Tailwind 4 upgrade.
- **"Design only" screens are not built.** Roles and invites, two-step sign-in
  and sessions, the buyer audit log and the evidence-pack export are drawn and
  labelled "Design only · not built". Leave them out. Where a page has a real
  part (the Members page shows the one real member; Security has the existing
  change-password form), build the real part from the board and drop the rest.
  Onboarding steps 8-10 (invite teammates) wait for the workspaces spec.
- **Pricing:** "Free during the beta" and "Enterprise · talk to us", no prices
  (D-6). **Sign-in:** email and password or a magic link, no Google/Microsoft
  (D-5). **Phone tabs:** Messages · Quotes · Alerts · Saved · Search (D-3).
  **No result cards** (D-7). **Type:** IBM Plex Sans and Plex Mono (D-2).
- **Branching** (must-stay section 1, "one switch at the end, old and new never
  run together"): integration branch `ds-v4` off `development`; every PR in
  this hand-off targets `ds-v4`; the switch is one PR `ds-v4` → `development`.

---

## 3. Rules for every session

1. Boot as AGENTS.md rule 3 says, then read this file and `DESIGN-v4.md`.
   Read `handoff-ds-v4-paper-first.md` sections 4, 5 and 7 only when the PR
   needs them.
2. **Still off-limits for looks:** `DESIGN.md` (old), `.impeccable/design.json`,
   `.impeccable/surfaces/*`, `context/frontend-design-spec.md`,
   `context/archive/old-design/*`, `ds-rebuild-must-stay.md` section 9.
   Old components (`components/dashboard/*`, `components/ui/*`) may be read
   for **data and behaviour only** (which RPC, which props, which server
   action, what is gated), never for classes or values.
3. One PR, one scope. Run only the test file that covers it; CI runs the rest
   (`pnpm test` takes ~25 min locally). Before pushing a markup change, grep
   `*.test.ts` for the old markup (it turned CI red twice).
4. Every PR: one `/code-review` against the merge base, fix the real findings,
   then `gh pr merge --auto --squash`. Anything a buyer observes (a rendered
   value, a status code, a redirect) gets a test at that boundary.
5. Server enforces auth and ownership; contact fields stay gated server-side;
   no SBI or score-like values on buyer surfaces (agent-brief non-negotiables).
6. The local dev server is unusable (11-minute compiles). Prove pages with the
   static harness (section 7).
7. Paper is read-only for the build, except the `90 Built` page.
8. Each PR appends one line to section 10. Reply to the founder in plain
   words, five lines or fewer.

---

## 4. From Paper to code: the pipeline (PR P1)

Paper desktop must be open with the v4 file. `get_jsx` works on pages the
founder is not viewing (checked 3 Oct); boards with `fit-content` simply carry
no fixed height, which is correct.

**4a. Pull.** Write `.impeccable/preview/paper-import/pull-jsx.cjs` (the kit
folder is gitignored; `push.cjs` there already speaks to Paper's local MCP
endpoint `http://127.0.0.1:29979/mcp`). For every artboard on pages 02, 03,
10, 11, 20, 30, 31: call `get_jsx` (format `tailwind`) and save to
`.impeccable/paper-export/<page>/<board name>.tsx`, plus `get_tokens`
(format `tailwind`) to `.impeccable/paper-export/tokens.css`. Reads only.
Do not pull through chat: 450 boards would flood the context.

**4b. Translate (Tailwind 4 → 3.4).** A script beside it
(`translate.cjs`), run over the pulled files, with a self-check that fails on
any class it does not know. Known cases from the export:

| Paper (v4) | Code (3.4) |
| --- | --- |
| `[color:var(--color-ink-2)]`, `[border-color:var(--color-line)]` | `text-ink-2`, `border-line` |
| `[height:56px]` | `h-14` (or the token: `h-topbar`) |
| spacing numbers off the 3.4 scale (`w-97.5`, `h-211`, `w-42`) | exact px: `w-[390px]`, `h-[844px]`, `w-[168px]`; drop board-frame sizes entirely |
| `rounded-[calc(infinity*1px)]` | `rounded-full` |
| `wrap-anywhere` | `[overflow-wrap:anywhere]` |
| `basis-[0%] grow` | `flex-1` |
| `border-solid`, `border-t-solid` | drop (3.4 default) |
| `text-xs/4` style size/leading | keep (3.4 supports it) once fontSize tokens are in the config |
| inline Phosphor `<svg>` | the matching `@phosphor-icons/react` component, size and colour from the export |
| status bar block (`9:41`, battery), home indicator | delete |

**4c. Tokens (PR B0).** The config takes the tokens with Paper's names and
values: colours (33, including the cert aliases), `fontSize` with each
line-height (3.4's defaults differ: its `text-sm` is 14px, Paper's is 13px, so
**override, do not extend** fontSize), spacing tokens (`control`, `row`,
`touch`, `topbar`, `tabbar`, `action-bar`...), radius, containers
(`sidebar` 224, `details` 344, `dialog` 480, `prose` 544, `pane` 640),
breakpoints (320/640/768/1024/1280/1440). Paper renamed
`--text-*--line-height` to `--text-*-line-height`; restore the double dash in
`tokens.ts`. Paper has no shadow tokens; add only what the boards use.
Plex through `next/font`. Regenerate the contrast fixture in
`tokens.test.ts`; add the lint rule "no hand-typed colour outside the token
file".

---

## 5. The PRs, in order (all into `ds-v4` unless said)

| PR | Scope | Paper source | Done when |
| --- | --- | --- | --- |
| F | "Fix now" items still open, small PRs into **`development`** (they fix the live site meanwhile) | register | each verified open first; skip any v4 replaces before it ships, saying so |
| P0 | Create `ds-v4` off `development`; add `ds-v4` to both branch lists in `ci.yml` | — | a test PR into `ds-v4` runs CI |
| P1 | `pull-jsx.cjs`, `translate.cjs` with its self-check (local, gitignored); commit only a short README of the recipe under `context/feature-specs/ds-v4/` | all | every board pulled; translator knows every class |
| B0 | Tokens, font, contrast fixture, colour lint rule (4c) | `get_tokens` | old pages still compile; `/dev/ds` shows the v4 values |
| B1 | Kit primitives in `components/kit/`: button, input, select, checkbox, switch, chips, tabs, segmented, table, dialog, sheet, drawer, toast, empty, error, skeleton, tab bar, action bar. Every drawn state; shown in `/dev/ds` | `02 Components` | each state matches its cell on the board |
| B2 | SourceBD patterns: source marks, fact row, certificate row, RSC block, sanction banner, locked contact, supplier row, quote comparison, timeline, chat, needs attention, locations map, statement claim, exports | `03 Patterns` | same |
| B3 | Shell: desktop sidebar (64px rail under 1440), topbar, list + pane (pane becomes a drawer under 1280); phone tab bar and account sheet | `03 Patterns` shells | 1440, 1280, 390, 320 match |
| B4 | Search and the supplier record (results, record pane and full page, sites/map, product lines, all states) | `10`/`11` Search & record | section 6 checks pass |
| B5 | RFQs, quotes, orders | `10`/`11` RFQs, quotes, orders | same |
| B6 | Messages, saved, compliance (expiry, UFLPA, Modern Slavery statement) | `10`/`11` Messages, saved, compliance | same |
| B7 | Products, settings (real parts only, section 2) | `10`/`11` Products, settings | same |
| B8 | Onboarding and auth: sign-up, verify, about you, company, what you source, first results, checklist; sign-in, reset, magic link, expired/sent links, signed out, suspended, not found, error; supplier claim track. Writes through `onboarding_save_buyer`. Steps 8-10 left out | `20 Onboarding`, `ds-v4/onboarding-data-map.md` | 0109 applied before this reaches production (section 9) |
| B9 | Marketing and the public supplier page: home story, the 17 pages, nav, mega footer, cookie banner ("Reject non-essential" styled like "Accept all"); new routes from paper-first section 5 | `30`/`31` | every claim on the page is one Paper kept (it dropped the unverifiable ones) |
| B10 | Admin and supplier portal on the v4 kit (section 8, question 1) | none drawn: kit + patterns only | no old-kit import left there |
| B11 | Delete the old kit (`components/dashboard/*` primitives, `components/ui/*`, old shell, old tokens) as the last importer goes | — | nothing imports them; build green |

### 5a. Which model runs which PR (founder, 4 Oct)

**Opus 5.5** runs the PRs where one mistake reaches every page or touches
accounts: **B0** (tokens), **B3** (shell), **B8** (onboarding and auth),
**B11** (deleting the old kit) and **section 9** (the switch and go-live).
**Sonnet 5.5** runs everything else: **F, P0, P1, B1, B2, B4, B5, B6, B7, B9,
B10**.

The order is fixed by what each PR needs, so the models take turns:

```
Sonnet  F, P0, P1
Opus    B0
Sonnet  B1, B2
Opus    B3
Sonnet  B4, B5, B6, B7
Opus    B8
Sonnet  B9, B10
Opus    B11, then section 9
```

Each session starts by reading section 10 to see the last PR that landed, does
the next PR(s) in its own list, and stops when the next one belongs to the
other model, leaving a line in section 10 saying so. A Sonnet session also
stops and hands to Opus, with a line in section 10 naming the PR and the
failure, when: the same PR's CI goes red three times; a change would touch
auth, RLS, an RPC's SQL, a migration, the token file or the shell; or the
translator's self-check meets a class it cannot map. It never works around
the problem.

Prompts to start a session (paste one into a new session, pick the model
first):

- Sonnet: `Follow context/feature-specs/handoff-ds-v4-build.md as the Sonnet
  model (section 5a). Read section 10, do the next PRs on the Sonnet list, stop
  at the next Opus PR.`
- Opus: `Follow context/feature-specs/handoff-ds-v4-build.md as the Opus model
  (section 5a). Read section 10, do the next PR on the Opus list, and fix any
  hand-back a Sonnet session left there first.`

Split any flow PR that grows past about 1,500 changed lines into one PR per
screen group. Data and behaviour come from today's pages: same RPCs, same
server actions, same gating. A Paper board with "Sample state" shows the
layout; the built page shows live rows.

---

## 6. What Paper does not give you (build it from tokens, do not invent looks)

- **Focus and keyboard.** Focus-visible rings exist on the `02 Components`
  board; use them everywhere. Keyboard path list → pane → back on desktop
  (undrawn; arrow keys move the row, Enter opens the pane, Escape closes it).
- **Undrawn states:** loading and error for Quotes, Orders, Record, HS codes.
  Compose them from the kit's skeleton and error components.
- **Numbers that disagreed across boards** (`ds-v4-progress.md`, "Open"): the
  Compliance badge ("2 to check" vs "8 to check") and "See all 9" vs
  "Expired · 7". Built pages read live counts from one function each, so they
  agree by construction; add a test that the badge and the page use the same
  source.
- Real-data checks every flow PR runs (must-stay section 6): 100- and
  125-character names, 1 and 11 sources, 54 HS codes and 39 products, the
  sanctioned sample state, `ar-fashion` everywhere, 320 and 1280 widths, no
  text under 12px, phone controls 44px, desktop targets 24px.

---

## 7. Proof on every UI PR

- Shoot the built pages with the static harness: desktop `build-ent.cjs`,
  phone `build-mobile.cjs` and `touch-check.cjs` (all in `.impeccable/preview/`;
  recipes in the founder's memory notes "static harness to PNG" and "phone
  harness and gist").
- Import them into Paper's `90 Built` page with the paper-import kit
  (`render-all.cjs`, `convert.cjs`, `push.cjs`; `PHONE=1` for phone) beside the
  design, and record the pixel difference `convert.cjs` reports.
- Attach both to the PR (images go to the gist; it is near its quota).

---

## 8. Questions for the founder (recommended default first; build the default unless told otherwise)

1. **Admin and supplier portal have no Paper boards.** Must-stay section 1
   says no page keeps the old styling. Default: rebuild them with the v4 kit
   and patterns, no new drawings (PR B10), because both are low-traffic and the
   kit covers tables, forms and threads. Alternative: draw them in Paper first,
   which delays the switch.
2. **The live-site errors Paper found** (pricing FAQ says Supabase Singapore,
   the project is AWS us-west-1; "48 districts" should be 47) disappear with
   B9. Default: leave them until then. Alternative: a small fix PR now.

---

## 9. The switch and going live

1. Before the switch PR, on `ds-v4`: typecheck and tests green; every check in
   section 6; `/impeccable critique` on the built desktop and phone screens
   meets the bar (paper-first section 7: 30+/40 on each).
2. **Apply 0109 first** (it is additive, no page breaks without it, but B8's
   onboarding cannot save without it). The founder says "apply 0109"; the
   agent re-runs the dry run in `ops/plans/0109-dry-run.md` and applies through
   the Supabase MCP `apply_migration`, as 0107 was. Never without that go-ahead.
3. Bring `ds-v4` up to date with `development`, then one PR `ds-v4` →
   `development`, `gh pr merge --auto --squash`.
4. PR `development` → `main`, `gh pr merge --auto --merge` (a merge commit,
   never a squash).
5. CI on `main` starts Deploy Production, which waits for the founder's
   approval in the GitHub `production` environment. Never run it yourself.
   After deploy, read the log line "Expected production commit" to confirm what
   shipped, then check the live pages at 1440 and 390.
6. Update `current-state.md` (one line) and move this spec to
   `archive/specs-shipped-2026.md`.

---

## 10. Progress (each PR appends one line)

- 3 Oct · Hand-off written. 0109 on `development` (#231), not applied.
- 4 Oct · Model split added (section 5a). Next: Sonnet, PR F.
- 4 Oct · Sonnet, PR F: verified each open item on `development`. Opened #233 (T-03, RSC words), #234 (A-01, row focus ring), #235 (T-04 and T-09, copy), #236 (RQ-07, no Send with a [bracket]), #237 (OR-02, no cancel after shipping), #238 (PR-02, Send RFQ only when active). **Skipped:** RC-09 and RC-10 (address once, map on the record), because B4 rebuilds the record and Locations; B4 must carry both. **Handed to Opus:** ST-03 (current password on change), because it touches auth. T-01 and T-02 were already on `development`.
- 4 Oct · Sonnet, PR P0: `ds-v4` added to both branch lists in `ci.yml`; branch created off `development` once this lands.
- 4 Oct · Sonnet, P0 done: #233 to #239 all merged into `development`; `ds-v4` created off `development` (6315d97) with CI on for PRs into it.
- 4 Oct · Sonnet, PR P1: all 431 boards pulled and translated, self-check passes (0 unknown classes, 0 parse errors); recipe and the list of tokens B0 must supply are in `ds-v4/paper-pipeline.md`. **Stopped here: next is Opus, PR B0 (tokens).** Also for Opus: ST-03 (ask for the current password when it changes) was left because it touches auth.
- 4 Oct · Opus, hand-backs: PR #241 (caption "a a", green), PR #242 (ST-03, Settings asks for the current password; the reset-link page works only within 15 minutes of the link) and PR #243 (OR-02 server half: migration `0110` makes `order_cancel` refuse shipped and in-transit orders, **not applied**, dry run clean in `ops/plans/0110-dry-run.md`, waits for "apply 0110"; the cancel confirmation names the PO), all into `development`.
- 4 Oct · Opus, B0 (tokens): Paper's 33 colours (plus `danger-active`), type, tracking, named spacing, containers, breakpoints and radius are the values in `lib/design/tokens.ts`; old names stay as `legacy` until B11, and where a name is in both, v4 wins. Colours are flat keys in the config so `theme(colors.line-strong)` resolves; 776 of 776 board classes compile (`check-config.cjs`). Plex through `next/font/google`. The buyer shell's "one size up" (`[data-shell]` font variables) is gone: Paper sizes each width itself. Hand-typed colours are refused repo-wide except 56 listed old files, a list that can only shrink. **For B3:** `app/ds.css` still remaps `--ds-brand-tint`, `--ds-brand-ink` and `--ds-focus` to greys inside `[data-shell]`; the v4 shell must not carry `data-shell`, or v4's `brand-tint` turns grey. **For B1:** `#C9CDD2` (text on a dark panel, one board) has no token; name it or drop it. Next: Sonnet, B1.
- 4 Oct · Sonnet, PR B1 (kit primitives): `components/kit/` has buttons (five kinds, six states, loading), fields (input, select, checkbox, radio, switch), chips, tabs and segmented, table, dialog, sheet, drawer, menu, popover, tooltip, toast, empty, error, skeleton, tab bar and action bar, all shown in `/dev/ds`; test `app/dev/ds/v4-kit.test.ts`. **Not in B1, left for the page that needs it:** combobox (B4's typeahead), date picker, file upload, column chooser, resizable pane divider (B3). **Not done:** the import into Paper's `90 Built` (the import kit is wired to the old Paper file and old tokens); proof is PNGs from `.impeccable/preview/b1-kit.cjs` + `b1-shoot.cjs` compared by eye with the boards. `#C9CDD2` appears on no `02` board, still unnamed (B2/B9).
- 4 Oct · Sonnet, PR B1 landed (#245, three CI rounds: a test that pinned the old button markup, a client-only module and a Phosphor client entry imported into the server page `/dev/ds`; lesson for B2 on: class strings shared by server files live in `components/kit/classes.ts`, server files import icons from `@phosphor-icons/react/dist/ssr`, and the test build is not strict, so discriminate unions with an explicit field).
- 4 Oct · Sonnet, PR B2 (patterns): `components/patterns/` has source marks, fact row, certificate rows, RSC block, sanction banner and notes, locked contact, supplier rows (pane and phone), quote comparison, order timeline, chat bubbles, needs attention, site list and pin legend, statement claims, exports; the words (certificate chips, vs target, MOQ, late, approximate) are pure functions in `patterns/words.ts` with tests; gallery in `/dev/ds`. Presentational: each takes props, the page supplies data (B4 to B7). **Not in B2:** the map itself and its two-way selection (B4, RC-09 and RC-10), the chat composer (B6), real quote or order data (B5), the shell boards (B3). Proof: PNGs at 1440 and 390 from `.impeccable/preview/b2-patterns.cjs` and `b2-shoot.cjs`. **Stopped here: next is Opus, PR B3 (shell).**
- 4 Oct · Opus, B3 (shell): no Sonnet hand-back was open. `components/frame/` is the v4 frame and the buyer layout draws it: sidebar 224 from 1440 and a 64 icon rail under it (a count becomes a dot), topbar with the one search box (480, Ctrl K) and the Account menu (Settings, Plan, Sign out), phone top bar with Paper's page titles (`lib/frame-nav.ts`) and the 44 account button opening the account sheet, the D-3 tab bar, and `ListPane` (list + 640 pane from 1280, the kit drawer under it, Escape and Close go to `closeHref`). Test `components/frame/frame.test.ts`; proof PNGs from `.impeccable/preview/b3-frame.cjs` + `b3-shoot.cjs` at 1440/1280/390/320. **For B4–B7:** wrap list pages in `ListPane`; the phone title is the frame's, so a page drops its own on phones; a record or thread keeps `data-detail` to hide the phone bars; the topbar field is a plain form, B4 adds the typeahead. **For B6:** the Messages ("2 new") and Compliance ("2 to check") badges take `{ text, tone }` through `AppFrame`'s `badges`; nothing feeds them yet (no unread data exists; the compliance count must come from the one function the page uses, section 6), and the layout still calls the old `loadBuyerShell`, whose three counts the frame no longer shows. **For B11:** the frame still imports `SearchCarry`, `SearchShortcut`, `topbar-search-slot` and `MenuDismiss` from `components/dashboard/` (behaviour only); move them before deleting. Next: Sonnet, B4.
- 4 Oct · Sonnet, PR B4a (search landing and results): `components/search/` is the landing (needs attention from one function, `lib/dashboard/needs-attention.ts`, whose `total` B6 must feed the Compliance badge and page), the table, the narrow list beside a pane, the phone's rows and bar, the bulk bar, and the empty, error and loading states; no result cards (D-7). The record, RFQ composer, filter pane and save pane still draw their old contents inside `PaneFrame` (B4b filters, B4c record, B5 composer, B6 save). Tests that read the old page were rewritten at the same boundaries; `?view=` and `?d=` are read and ignored. **Left for others:** the topbar field still has no suggestions (typeahead, own PR); **for Opus (shell):** Paper's phone results board has no top bar but `phoneTitle("/app/discover")` draws "Search" plus the account button, and on the desktop landing `OWN_FIELD_PATHS` in `topbar-search-slot.tsx` still hides the topbar field (Paper shows it); I left both. **Decisions to confirm:** "Ask for the new certificate" opens the RFQ composer for that supplier (the only channel a supplier answers on); the Sources column shows registers and certifiers (the figure the sort uses), the record's own count may be higher. Proof: `.impeccable/preview/b4a-search.cjs` + `b4a-shoot.cjs` PNGs at 1440, 1280, 390, 320; not imported into Paper's `90 Built` (kit still wired to the old file).
- 4 Oct · Sonnet, PR B4c (the supplier record): `components/record/` is one view for the pane and the full page: header (name, sub-line, Open full page, Save, Send RFQ or the refusal, Close), the five-cell summary (sanctions, certificates, RSC, workers, sources; on a phone five rows), six tabs as links (`?tab=`, kept through the search, the composer and a line), panels for Overview (needs a look, key facts, your RFQs), Certificates, Safety, Sites, Sources and Products, the 344 column (contact, sources) on the page from 1024, the foot line of what is locked, and the phone's sticky action bar or refusal bar. Same loader and model as before; the old `SupplierSheet` stays for `/dev/ds` and its tests until B11. Record-routes assertions were rewritten at the same boundaries (contact counts, PII, status codes, lines=all, sanctions, buildings, addresses); `components/record/record.test.ts` is new. Back from a line now lands on the Products tab. **Differs from Paper, for you to decide:** the summary has no "6 lists · oldest checked" under Sanctions (the model holds no screening dates), the Products tab lists the items as filed with no "N entries" grouping (the model has none), the contact block shows email and phone counts only (website and representatives counts are no longer drawn), the full page header is not the collapsing one Paper draws when scrolled, and Zaheen's "may be the same company" hint has no data behind it. **For B4d:** the Sites tab is a plain list of premises and buildings (no map, no pins, no approximate/exact words, because nothing in the model says which a site is); RC-09 and RC-10 are still to carry; the line sheet and the exports tab are still the old kit. Also changed: `RscBlock` takes a null factory id, no head count and no date (the row is left out instead of "not published"); `CertTable` has `compact` for the 640 pane and a row `anchor` (the Compliance hub's `#cert-…` links); `SourceList` takes a label and a full name. Proof: PNGs from `.impeccable/preview/b4c-record.cjs` + `b4c-shoot.cjs` at 1440, 1280, 390, 320; not imported into `90 Built`.
- 4 Oct · Sonnet, PR B4b (filter pane): `components/search/filters.tsx` and `filter-panel.tsx` replace `DiscoverFilters` inside `PaneFrame`: the applied chips, Paper's groups (Certificates with their status, Location, Company type, HS code, Member of, Brand lists, Workers and founding year, sources), the RSC and sanctioned switches, Clear all, and "Show N suppliers" as a live count (server action `countSuppliers`: signed-in only, 300 ms after the last change, the same smart-query read as the results). Same URL filters; the draft passes through `parseDiscoverState`, so the count and the opened search are one thing. Tests in `search.test.ts` and `record-routes.test.ts`. **Differs from Paper:** "Expiring or expired" is not one `p_cert_state` (one state for every certificate), so the status is Any / Valid / Expiring / Expired; on a phone the pane is the frame's right-hand drawer, not Paper's bottom sheet, and its rows open in place (Paper draws no sub-picker); Paper's phone lists "Certificate status" and "RSC safety programme" as rows of their own, mine keeps the status inside Certificates and RSC as a switch. **For Opus (shell):** `ListPane` docks the pane at 640, Paper draws Filters as a 360 panel over the full-width table; and a phone sheet would need `ListPane` to open the drawer from the bottom. Kit `Segmented` gained `onValueChange`. Proof: PNGs from `.impeccable/preview/b4b-filters.cjs` + `b4b-shoot.cjs` at 1440, 1280, 390, 320; not imported into `90 Built`.
- 4 Oct · Sonnet, PR B4d-1 (fixes 1 and 2 of `handoff-ds-v4-b4-fixes.md`, one PR because they share the record view): the contact block prints all four counts the model holds, in the order `Email 1 on file · Phone 6 on file · Website on file · Contact person 2 on file` (the founder asked for all four; Paper's board still draws two, so the board is behind the build). The Sites tab is the map beside one card per premises: `components/record/sites-view.tsx` (client) reuses `MapWidget` and a new `useNearbyLayer` from `components/supplier/locations-map.tsx` (the old profile still uses them); pins come from `address_geocodes` through the existing server-only `geocodeTargets` in `lib/barikoi.ts` (service role, as the old buyer profile read them), only when the Sites tab is open, with no RPC, policy or migration. A card says pinned to the address, approximate (confidence under 70 or none) or not pinned yet; pinned sites are numbered first so a card's number is its pin's; `?site=2` selects, with no script the cards are links. RC-09: "Also filed as" is gone and the Overview drops its Address row when the record has sites. Left for B4d-2: the Overview's map column (Mondol board), the phone full-screen map and `Open map`, the v4 pin art (the map still draws the old forest-green pins), and the RSC buildings cards under the map; exports and product line are untouched. Proof: `.impeccable/preview/b4d-sites.cjs` + `b4d-shoot.cjs` draw the Sites tab with the map as an empty frame; the live map was not seen in a browser (no dev server here). The `Paper 90 Built` import is still not wired.
- B4 fixes 3 and 4 (the filter pane's frame): `ListPane` takes `presentation` (`docked` | `overlay`). Records, the composer and Save stay docked (640 beside the list, a drawer under 1280). Filters are `overlay`: from 1280 a panel laid over the full-width results, absolute right 0 under the topbar, 360 wide, left edge, `shadow-dialog` (the board's `#15181C2E 0 12px 32px`), with no scrim, no `inert` and no `aria-modal`, so the results stay live and keep their own bar and table; 768 to 1279 keep the right drawer (Paper draws nothing at that width); under 768 the kit `Sheet` (new `flush` body, so the form keeps its own footer). 360 is a new container token, `panel` (`w-panel`), not 344. The drawer's body is now a column like the docked pane, which removed the filter form's `max-xl:min-h-[calc(100dvh-4rem)]`; the panel's own title and close show only where the frame draws none (`usePaneTitled`), replacing the `hidden xl:flex` header. Phone rows still open their controls in place. Proof: `.impeccable/preview/b4f-filters.cjs` + `b4f-shoot.cjs` (1440, 1280, 1024, 390, 320) against `DQG-0`, `7UZ-0`, `81K-0`: panel measured 360 x 844 at top 56, no text under 12px, phone controls 44 or taller. The `Paper 90 Built` import is still not wired.
- 4 Oct · Sonnet, topbar typeahead (the "Then" item of `handoff-ds-v4-b4-fixes.md`): `components/search/typeahead.tsx` is one combobox (`aria-activedescendant`, arrows, Enter, Escape closes only the list) over the existing `lib/search-suggest.ts` and `/api/discover/suggest`; the pure half (rows, links, keys, each row's two lines) moved to `lib/search-suggest-ui.ts`, which the old `search-typeahead.tsx` re-exports until B11. It draws the topbar field's list and, on a phone, the landing's and the results bar's list (rows 44 tall, 16px field). A supplier opens `?record=` beside the results, keeping the search and filters (and dropping the old `tab`, `site`, `line`). **Paper has no typeahead board:** the only drawn list is the "Supplier" combobox on `02 Components` · Inputs (row padding 6 8, name 14/20 medium, 12/16 line, brand-wash active row, footer "Enter to open · arrows to move · Esc to close", names wrap), so the build follows that; the kind line under each name ("Product category · HS 6105", "Supplier · Dhaka") and the recent-searches rows are mine. No frame change beyond the topbar's field. Proof: `.impeccable/preview/b4t-typeahead.cjs` + `b4t-shoot.cjs` at 1440, 1280, 390, 320 (measured: no text under 12px, phone rows 44, list z 400 over the filter panel's 200); the keys are tested through the component's own handlers, not seen in a live browser (no dev server). `Paper 90 Built` import still not wired.
- 4 Oct · Sonnet, PR B5a (RFQ list, RFQ pane and page, accept): `components/rfqs/` is the v4 RFQ list (Paper's table with the best quote against the target, drafts as rows, tabs All/Draft/Waiting/Quoted/Accepted/Closed, `?sort=ship_by`), the RFQ in the pane beside a narrow list (drawer under 1280) and as `/app/rfqs/[id]`, the Quotes tab on a phone, and Accept as a dialog (a sheet on a phone). Same RPCs; the best quote is a plain `rfq_quotes` read under the buyer's session (no RPC, policy or migration). **Differs from Paper, for you to decide:** the column says "Price per piece", not "FOB per piece" (a quote does not say its incoterm); no Send reminder, no source counts under Sent to, no "..." menu (nothing behind them); the tab is "Closed" (it holds closed and cancelled; no RPC cancels an RFQ); a draft row is in the list as Paper draws it; accepting says it closes the RFQ and the order is the next step (Paper says it starts an order, but today Create order is a separate step); quotes in another currency are listed after the rest and not set against the target. Proof: `.impeccable/preview/b5a-rfqs.cjs` + `b5a-shoot.cjs` at 1440, 1280, 390, 320 (no text under 12px, phone controls 44, no sideways scroll); not imported into `90 Built`. Code review found three real things, fixed with tests: a supplier saw the buyer's Create order, mixed currencies, a possibly cut quote read. Kit `Th` gained an `inner` prop.
- 4 Oct · Sonnet, PR B5b (the RFQ composer): `components/rfqs/composer.tsx` is Paper's composer, one component for `/app/rfqs/new` (a page with the preview beside it from 1280) and the pane beside the results or a record: the suppliers (named up to five; a summary with "Review all N" beyond, a dialog with search and Remove), the fields in Paper's order, questions as removable rows, "What <supplier> gets" with the template message and an Edit, the sanction banner, and a footer that says what is missing, saves a draft and sends (Ctrl+Enter). `picker.tsx` is the "Add suppliers" dialog (saved, search, recent RFQs), same reads as before; `composer-model.ts` holds the words, tested. `/app/rfqs/new` with no supplier now opens an empty composer (the list's New RFQ lands there) instead of redirecting to the search. **Differs from Paper, for you to decide:** no "Share target price" switch and no "Attach a tech pack" (a supplier sees the target in `rfq_get` and no file is stored, so the form says "Suppliers see your target price." instead of a promise it cannot keep); a sanctioned supplier stays listed with the banner until removed (Paper removes it for you; the model holds no list name or date); no "6 have an expired certificate" line or source counts (the targets carry neither); the phone shows Questions and the message as plain sections, not Paper's chevron rows. Proof: `.impeccable/preview/b5b-composer.cjs` + `b5b-shoot.cjs` at 1440, 1280, 390, 320 (no text under 12px, phone controls 44, no sideways scroll); not imported into `90 Built`.
- 4 Oct · Sonnet, PR B5c (orders: list, pane, page, New order, cancel): `components/orders/` is the v4 orders list (tabs All/Draft/In progress/Delivered/Cancelled; `?status=active` still opens In progress), the order in the pane beside a narrow list (drawer under 1280) and as `/app/orders/[id]`, Add update and Edit details and Cancel as dialogs (sheets on a phone), and `/app/orders/new` as a supplier chooser (the suppliers you asked for a price, then saved ones, then a search) followed by the form, or straight to the form from an accepted quote. Same RPCs; no new RPC, policy or migration. A failed list is an error, never "No orders yet"; an order that cannot be read is a notice in the pane and a 404 on its page, but a failed read (even with the list unreadable too) is not a 404. **Differs from Paper, for you to decide:** no planned steps and no "Trims in house: 3 days late", because the data holds only logged steps, so lateness reads "Ship by date passed: N days late" on a draft or an order in production; the Supplier column is the name only (the list has no type or place) and no port lines (the list has no ports); the empty state drops Paper's sample timeline (it would teach planned steps that do not exist); the chooser has no arrow-key movement inside the list and no supplier count in "Type to search all suppliers"; Message is "Message <supplier>" and only shown when a conversation exists; Cancel is hidden once an order has shipped, **but migration `0110` (the server refusing it too) is not applied, so until you say "apply 0110" a direct call can still cancel a shipped order**. Proof: `.impeccable/preview/b5c-orders.cjs` + `b5c-shoot.cjs` at 1440, 1280, 390, 320 (no text under 12px, phone controls 44, no sideways scroll); not imported into `90 Built`. Code review found real things, fixed with tests: an outage on both reads became a 404, a 200 with no order id failed silently, a saved `?from_quote=` link made a twin order, Edit details posted every field (a stale status could be written back), an old `?open=` link on an empty list drew a pane. Also: `useIsPhone` is now one hook in `components/kit/use-phone.ts`, used by the accept dialog too.
- 4 Oct · Sonnet, PR B6a (Messages): `components/messages/` is the v4 inbox and conversation. `/app/messages` is the 360 list (the whole width on a phone) with a search and an All tab; `/app/messages/[thread]` is the conversation beside it: name and RFQ, the strip of the RFQ's four facts (read with `rfq_get`), Paper's bubbles with a day line each, the composer (Ctrl or ⌘ + Enter, grows to six rows, count from 7,000), and the record in Paper's 344 column from 1280 (`?record=`; a drawer to 1279, a sheet on a phone), built from the same record model as the pane, counts only, no contact value. Same RPCs and transport (Realtime refetch, `POST /api/v1/messages`); no new RPC, policy or migration. The list moved into `messages/(list)` so a conversation that is not yours is a real 404 (it was a notice under a loading state); a failed list or message read is an error, never "no conversations" or "No messages yet". **What the data does not hold, so the build leaves it out (for you to decide):** no unread dots, no "Unread · 2" tab and no "2 new" badge on Messages (`thread_list` and `thread_messages` carry no read state, so the frame's Messages badge stays empty); no "Read" ticks under your messages; no paperclip, file chips or "Tech pack.pdf" (no file is stored); no "Sample messages" chip (it is sample state). `thread_list` carries no text, so each row's last line is one `thread_messages(limit 1)` call for the 30 newest conversations; "No reply yet" (the newest message is yours) is counted and its tab drawn only when every conversation was read, otherwise the tab is left out. Times are UTC, as before. A `?record=` for another company than the conversation's is a notice, not read. Code review findings are in the PR. Proof: `.impeccable/preview/b6a-messages.cjs` + `b6a-shoot.cjs` at 1440, 1280, 390, 320 (no text under 12px, no sideways scroll; phone controls 44 except the certificate "Open certificate" links the B2 table draws at 18); not imported into `90 Built`. Next: B6b (Saved, saved searches, the Save-this-search pane).
- 4 Oct · Sonnet, PR B6b-1 (Saved and saved searches; the Save-this-search popover and sheet are B6b-2): `components/saved/` is the v4 `/app/saved`: header with "N saved suppliers · only you see this list", Sort menu, the two tabs (Suppliers · N, Saved searches · M; a two-part switch on a phone), the table (select, Supplier, Type and district, Workers with the second figure, Sources, First certificate to check, Saved on, a row menu), the ink bulk bar when something is ticked (Remove from saved, Send one RFQ to N suppliers up to 50) and the phone's rows with a 44 tick and an action bar. Removing is not asked about: a toast with Undo (`POST /api/v1/saved` puts them back). `?open=<slug>` draws the record in the pane beside a narrow list (drawer under 1280); `?sort=` and `?page=` as before. `/app/searches` is the second tab: each search with its filters in words, the remembered count and when it was taken, Run search, and a menu with Delete (a dialog; a sheet on a phone). Same reads and the same `DELETE`/`POST` routes; no new RPC, policy or migration (the saved-search count for the tab is a plain count under the buyer's session, filtered to the owner). A failed list is an error, never "No saved suppliers yet"; a failed count is left off the tab, never 0. **Differs from Paper, for you to decide:** no "Download CSV" (no export exists for the saved list; the search's export is of search results); no "Email me new matches" switch and no "Save your last search?" row (no alert is stored or sent, and no last search is kept); "First certificate to check" lists only certificates that are expired or lapse inside 90 days (the two compliance reads), so a supplier with neither says "Nothing to check" where Paper prints a valid certificate; the desk of certificate alerts and recent activity that sat above the list is gone (Paper has none; the certificates are in that column and in Compliance, B6c); a saved search has no rename. **Needs "apply 0108":** until the migration is applied `compliance_expired_certs` does not exist, so every supplier not lapsing inside 90 days reads "Not read just now" instead of "Nothing to check" (the cell never claims what it did not read). Proof: `.impeccable/preview/b6b-saved.cjs` + `b6b-shoot.cjs` at 1440, 1280, 390, 320 (no text under 12px, no sideways scroll, phone controls 44); not imported into `90 Built`.
- 4 Oct · Sonnet, PR B6c-1 (Compliance hub, certificate expiry, UFLPA checks, and the sidebar badge; the Modern Slavery statement editor is B6c-2): `components/compliance/` is the v4 `/app/compliance`: header "Certificates, forced-labour checks and your modern slavery statement for N saved suppliers", the certificates that need a look (Paper's pattern: expired first with "No renewal on file", then those lapsing inside 90 days, one ask each through an RFQ) and a 344 column (UFLPA counts, the statement, the expiry dates); `/app/compliance/expiry` (three groups under All · Expired · Within 30 days · 31–90 days via `?show=`, a table from 768, rows with a 48 Ask on a phone); `/app/compliance/uflpa` (three counts and one row per supplier; "No link found" says it is not a clearance). **The badge:** the layout now passes `badges={{ compliance }}` to `AppFrame`, the hub's own count (`attentionOf` in `lib/dashboard/needs-attention.ts`, the one function behind the landing's block, the hub's heading and the badge); read beside the shell, 1.5 s at most, so a slow or failed list draws no badge, never a 0; a test pins that the badge and the hub say the same number. Messages has no badge (no read state, B6a). Same four RPCs, each read on its own; no new RPC, policy or migration. **Differs from Paper, for you to decide:** the hub heading counts 90 days (Paper: "8 need a look" with the within-30-days split and a "Coming up in 31–90 days" card), because the landing, the heading and the badge must be one number; no "Download evidence (CSV)" or "Download CSV" (no export exists); no "None of the 11 is on the lists we read" sanctions block (no read gives a lists-last-read date for the saved list); no "Follow-up: Not asked yet" column (nothing records that a supplier was asked); no "our copy of the list: 14 May 2026 · 160 entries" (the tracker carries neither, so the page says entries added since our last read are not checked, and links to dhs.gov); no "Draft · 3 claims to confirm" chip (the statement is composed in the browser and nothing is stored). **For Opus (shell):** a two-digit badge wraps in the 224 sidebar ("14 to / check"); `FrameSidebar`'s badge needs `whitespace-nowrap` (or a shorter word). `/app/compliance/msa` is still the old kit until B6c-2. Proof: `.impeccable/preview/b6c-compliance.cjs` + `b6c-shoot.cjs` at 1440, 1280, 390, 320.
- 4 Oct · Sonnet, PR B7a-1 (the Products list; the product form and the start choice are B7a-2): `components/products/` is the v4 `/app/products`: header "N products · only you see these", Add product, the tabs All · Active · Draft · Archived with their counts (chips on a phone), a table of Product (name, "Style NW-701 · category"), Target price ("US$4.20 per piece"), MOQ, Status (plain, dashed for a draft, quiet for archived) and Updated, and a menu per row (Open, Send an RFQ for an active product, Archive or Restore, Delete); the empty teaching state, the failed read (an error with Try again, never "Keep your products here" or a 0) and the skeleton. Archive and Restore are done and then said, with Undo; Delete asks once (a dialog; a sheet on a phone). Same `buyer_product_list` read and `POST`/`DELETE /api/v1/products`; no new RPC, policy or migration. The list is in `products/(list)`, as before, so an unknown product id stays a real 404. **Differs from Paper, for you to decide:** no HS code and no RFQs column (the list returns neither; the category stands where the HS code would, and a count of RFQs per product needs a read that does not exist); no "Sample state" strip (that is the sample); the price and MOQ are in US dollars and pieces because the form only takes those; a stored 0 reads "No price yet". The old `ProductList` is deleted from `components/dashboard/products.tsx` (the start choice stays until B7a-2). Proof: `.impeccable/preview/b7a-products.cjs` + `b7a-shoot.cjs` at 1440, 1280, 390, 320 (no text under 12px, no sideways scroll, phone controls 44); not imported into `90 Built`.
- 4 Oct · Sonnet, PR B6c-2 (the Modern Slavery statement editor): `components/statement/` is Paper's editor on `/app/compliance/msa`: the seven sections on the left (each with "N claims to confirm"), the draft as a document in the middle (headings, paragraphs and bullets, every claim only you can answer drawn dashed amber until you answer it, underlined after), and a rail on the right: "Before you download · N claims to confirm", a Fill in for each (an inline field; the four details open the details card instead), Download held until none is open with "Confirm N claims to download.", Copy draft, the format and the approval note. On a phone the claims come first, then "Read the whole draft". The text is still composed in the browser from `buildStatement` (`lib/msa-statement.ts`, which now exports `draftNote`, `typed` and the title line so the editor shares them); a fill replaces its claim in the text that downloads, a typed bracket made round, and the DRAFT note recounts what is left. Same two RPCs; nothing is uploaded or stored; no new RPC, policy or migration. **Differs from Paper, for you to decide:** the file is Markdown only (no PDF or Word: no document library is installed, so the rail says to open it in Word or Google Docs); no "Versions" and no saved drafts (nothing is stored, so a reload starts again; the draft lives in the page); rail labels are the first clause of the claim's own sentence, not Paper's hand-written short lines ("What your organisation does", not "Your organisation's legal name"); a claim repeated in the text is asked once; Download is now held until every claim is answered (it used to download a draft with gaps; Copy draft still works with gaps and says how many remain); the old "Your supplier footprint" list is gone (its figures are in the draft). `components/msa-generator-form.tsx` is now unused (B11). **B6 is done with this PR; next is B7 (Products, settings) for the Sonnet list.** Proof: `.impeccable/preview/b6c2-statement.cjs` + `b6c2-shoot.cjs` at 1440, 1280, 390, 320.
