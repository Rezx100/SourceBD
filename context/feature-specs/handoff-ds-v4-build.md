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
