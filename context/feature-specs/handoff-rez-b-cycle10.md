# REZ-B hand-off — buyer Discover v3.2, mid-cycle 10

For the next Claude Code session on `github.com/Rezx100/SourceBD`. Written
22 Sep 2026, extended 23 Sep (§10, §11). Everything here is on
`rez-b-results-page`, pushed; the tip is `git log -1` — §1–§9 describe the
branch at `b04144a` and are history. Nothing is landed, promoted or deployed.

Read this before touching anything. The short version: the work is in good
shape, **cycle 10 is half-finished**, and one review axis out of five has
reported. Nine and a half review cycles have run. Expect cycle 10's remaining
four reviewers to find more; REZ-A took 21 cycles to earn its token.

---

## 1. Where to start

```bash
git fetch origin && git checkout rez-b-results-page
git log --oneline 7ea98b4..HEAD
git diff --stat 7ea98b4..HEAD
```

`7ea98b4` is the merge base (`git merge-base origin/development HEAD`).
`529434d` is the branch's FIRST commit, not its base — a diff from it
leaves that commit out. The PR is
[#164](https://github.com/Rezx100/SourceBD/pull/164), open as a **draft**,
opened only so CI runs. It is not a merge request.

Read `AGENTS.md` first, then the lean boot set, then
`context/feature-specs/handoff-dashboard-v3.2-implementation.md` — §7 for
this PR's scope, §3.1/§3.3 for the card, §3.10 for the shell, §4.1/§4.2 for
the SQL. Read the spec, not this summary of it.

`handoff-rez-b-cycle6.md` is the previous hand-off and is still worth
reading for §3 (the two decisions the founder delegated) and §4 (guards not
to re-break). Its §5 list is done except for the items in §6 below.

## 2. Verification state at `b04144a`

Local:

- `pnpm exec tsc --noEmit` — exit 0.
- `pnpm exec next lint` — 0 errors (warnings pre-existing).
- `pnpm test` — **1,302 passing, 0 failing, 196 suites**, one run, ~13 min.
  Node 21+ (24/25 fine). Was 1,235 / 181 at the cycle-6 hand-off.

CI, run `35712604573` on `b04144a` — **all four jobs green**: `verify`,
`unit-tests`, `http-boundary`, `migrations`.

The `migrations` job now does two things, and the second is new:

1. Replays all 109 migrations into a throwaway Postgres 16 and runs
   `supabase/ci/assert-0104.sql` against them. Log line: `applied 109
   migrations`.
2. **Runs the script a second time and requires it to refuse.** After step 1
   `public` is populated, so the guard must exit 9. Log line:
   `REPLAY-REFUSED: public already holds 55 relations` → `second replay
   refused as it should, exit 9`.

That second step exists because the guard it proves lives in a SQL string
the unit suite can only read, and a reviewer showed the text assertions could
be satisfied by a query that guarded nothing. This is the executed proof.
Do not let either step rot.

## 3. What cycle 10 is, and where it stopped

Cycle 10 froze candidate `d5501ed` and ran five independent reviewers in
their own worktrees: truthfulness, correctness, accessibility,
guard-adequacy, security.

**Only the security reviewer reported.** Its three BLOCKING findings are
fixed in `a796555`, four mutations red:

- `psql` was called without `-X`, so `~/.psqlrc` or `$PSQLRC` could
  `\set ON_ERROR_STOP 0` and turn the refusal and every migration error into
  exit 0 — a run reporting success having applied nothing.
- The emptiness check counted `public.suppliers` rows, which RLS filters for
  a non-superuser role, so production would answer "0, throwaway".
- `inet_server_addr()` sat in a DECLARE initialiser, evaluated before the
  `set local search_path` meant to protect it.

**The other four reviewers were still running when the session ended and
never reported.** Their transcripts survive; resume them, or re-run them
against a NEW frozen candidate — `d5501ed` is two commits stale.

**Cycle 10 is not complete and must not be treated as a clean round.**

## 4. What pushing bought, and what it cost

The branch had not been pushed since the server-side guard was written, so
no CI run had ever executed it. The first one that did, on `ca199cf`, failed:

```
REPLAY-REFUSED: the server answered from 172.18.0.2, which is not a loopback address
```

GitHub runs the Postgres service on a Docker bridge, so the server answers
from `172.18.0.2` while the runner reaches it on `localhost`. The guard
refused the one job it exists to protect.

`b04144a` removes the address test rather than widening it, and the reasoning
is in the file so nobody adds it back: it failed in both directions. It could
not stop what it was written for — `inet_server_addr()` is null over a unix
socket and reports 127.0.0.1 for a production database reached through an
`ssh -L` tunnel, and PGPORT is deliberately not refused — and it did stop CI.
Accepting RFC1918 would have fixed CI and made it weaker still, because
10/8 and 172.16/12 are exactly where a self-hosted production database lives.

What remains is the check that was always doing the work: `public` must hold
no relations. Catalog data, so RLS cannot soften it, and indifferent to how
the connection was made — the property the address test only pretended to
have.

**The lesson for the next session: push early.** Three rounds of review read
that script; one CI run executed it and found what none of them could.

## 5. The pattern to expect, because it has held for four rounds

Every round since cycle 7, the worst defect has been *in the previous
round's repair*, and usually in `supabase/ci/apply-migrations.sh`:

- cycle 7 wrote a host guard that read `PGHOST`; libpq reads `PGHOSTADDR`,
  `PGSERVICE`, `PGSERVICEFILE` and comma-separated lists. Three reviewers
  broke it within an hour.
- cycle 8 rewrote it and left `guard_status=$?` inside `if ! psql …; then`,
  where `$?` is the status of the negation and is always 0. Four reviewers
  found it. The test blessed it by asserting only `code !== 9`.
- cycle 9 rewrote it again and left `psql` without `-X`.
- cycle 10's fix for that then refused CI itself.

The shape is always the same: the guard reasons carefully about the
variables it enumerated and is silent about the ones it did not. When you
touch that file, assume the same about your own version, and run it against
a real database before believing it.

The second recurring trap is guards that match text. Three times now a guard
stayed green when it should not have: twice because the *explanatory comment
above the code* contained the literal being matched, once because the literal
lived in a **dead string variable** that survived deleting the block that ran
it, and once because a query kept the table name the assertion looked for
while pointing at a schema that does not exist. Strip comments before
matching, pin the predicate and not just the table, and ask what else could
satisfy the assertion.

## 6. How to carry the loop forward

1. Freeze a commit. Run five independent reviewers against it —
   truthfulness, correctness, accessibility, guard-adequacy, security —
   **each in its own git worktree** (`isolation: "worktree"`), each given the
   diff, the spec and the code, and none given your account of what you
   fixed.
2. Their worktree HEAD will be older than your candidate. Tell each one to
   materialise it first (`git checkout <sha> -- .`, then confirm
   `git diff <sha> --stat` is empty) and to junction `node_modules` if the
   worktree has none. Four of five needed this in cycle 10 and worked it out
   themselves; saying it up front saves them the detour.
3. Point them at the newest, least-reviewed commit first, with the older
   range for context. The last round's repairs are where the defects are.
4. Fix what comes back. Give each fix a guard and **prove it** by
   reintroducing the defect and watching it go red. If it does not go red the
   guard is decoration — that has been true of nine guards in this change so
   far, including three of mine that a reviewer had to catch.
5. Push and let CI run before you call a round done. See §4.
6. Re-verify, re-freeze, repeat until a round returns zero blocking. Only
   then does a separate Acceptance Judge return
   `ACCEPTED_FOR_HUMAN_REVIEW`. You do not decide your own work is done
   (`AGENTS.md` rule 16).

Two process mistakes not to repeat. Do not run reviewers in one shared
worktree — in cycle 5 that swept a reviewer's mutations into a commit. And do
not let the candidate move under them.

A practical note on this machine: `tsc` OOMs ("Zone Allocation failed")
when the dev server and several agent worktrees are alive at once. Stop the
preview server and prune worktrees before a full gate run.

## 7. What is still open

### Founder's call, not yours

1. **The anon key's reach.** `discover_suppliers` is granted to `anon` and
   served by PostgREST directly. 0104 widens its return from 17 columns to
   23, adding certificate numbers and issuers, HS headings, registries,
   brand lists, `top_tier` and `is_sanctioned`. 100 rows a request,
   `p_offset` unbounded, no rate limiter on that origin — about **103
   requests drains the published corpus**. Three separate security reviews
   have now raised it. Narrow the grant, or split a lean anon signature from
   the rich authenticated one. `discover_suppliers_explain`,
   `supplier_epb_hscodes_batch` and `hs_catalogue` are all
   authenticated-only, so the `anon` on this one looks copied rather than
   re-decided.
2. **Whether `/app/products` should count sanctioned suppliers.** It does;
   the search it links to hides them, so the two numbers disagree on one
   click.
3. **The `workers` sort orders on a number the column does not show.** SQL
   orders on `suppliers.employees_total`; the column renders the enriched
   roll-up. Fixing it properly means either sorting on the displayed value (a
   per-row roll-up an anonymous caller could hammer — rejected twice) or
   showing the sorted figure. Worth putting to him with §7.1.
4. **The Help button** has an accessible name and no behaviour, because
   `/app/help` does not exist. That is a product decision, not a code fix.
5. **DECIDED 23 Sep: built on this branch — see §10.** Original text kept
   below for the record. **Spec §3.1's selection is unbuilt.** The spec asks for a select-all
   checkbox, a checkbox per card, and a sticky "N selected · Send RFQ · Save
   · Compare · Export" bar. The checkboxes render as `aria-disabled`
   placeholders that cannot be ticked, on every row of a shipped page, and
   the bar does not exist. **This is REZ-B's own scope, not a defect
   introduced by any repair round** — which means the branch is not finished
   against its spec even when the reviewers go quiet. Ask whether he wants it
   built here or split into its own issue. Until it is decided, the dead
   checkboxes are the honest thing to raise first.

### Known, unfixed, non-blocking

- `discover_suppliers_explain` forwards `p_sort` into up to twelve
  full-corpus passes; authenticated-only, but the same shape as §7.1.
- `hs_catalogue()` is an unbounded full-corpus aggregate with no argument to
  bound it and no cache.
- `lib/saved-searches.ts` returns raw Postgres error text as `detail:` in its
  500 bodies, and its count-refresh update omits the owner filter (RLS makes
  it safe; the sibling route explicitly declines to depend on that).
- `saved_searches` has no size or row cap at the RLS layer, so a buyer
  talking to PostgREST directly bypasses the route's 120-char name limit.
- `app/(app)/layout.tsx` trusts `x-sourcebd-pathname` on paths the middleware
  matcher excludes (anything ending `.js`, `.css`, …). The only consequence
  is which shell renders.
- `readRecentSearches` validates `href` and not `label`/`count`; a non-string
  `label` out of localStorage throws and blanks the sidebar.
- Source marks are 20×20 at a 23px pitch (WCAG 2.5.8 wants 24×24 or 24px
  spacing); chip remove links are 12×12.
- "Add filter" is `href="#filters"` pointing at the `<details>` itself, so
  the browser does not expand it.
- Two rail links point at `/app/discover` (Search and Suppliers) and only one
  is announced as current.
- The `⌘K` badge says ⌘ on Windows, where the handler wants Ctrl. Spec §3.1
  specifies that label, so this follows the spec rather than breaking it.
- `assert-0104.sql` has never been executed on this machine — no local
  Postgres. CI's `migrations` job is the only thing that runs it, and it now
  does so on every push.

## 8. The gates

Nothing is landed, promoted or deployed, and none of it may be without the
founder's explicit go-ahead, asked for **one gate at a time**
(`AGENTS.md` 9a):

1. land on `development`
2. promote `development` to `main`
3. deploy to the VPS at `109.104.153.228`

Approval of one is never approval of the next — not from a green CI run, not
from the work being finished, not from an earlier yes. Pushing this feature
branch is free and has been done; that is not gate 1.

`0104` is a production migration: drafted, committed, executed only against a
throwaway CI database. `AGENTS.md` rule 15 — the founder applies it, and the
approval attaches to the exact audited migration, so if the file moves the
approval is void. It has moved again since the last hand-off.

## 9. First actions for the next session

Superseded 23 Sep — see §10.4.

## 10. Session of 23 Sep 2026: selection built, and a deploy-order blocker found

### 10.1 What was built (the founder chose "build §7.5 here")

Spec §3.1 "Selection" on `/app/discover`, cards and table:

- The select-all checkbox and one checkbox per card or row are now real:
  `Checkbox` takes an optional `onToggle`. Without it the old inert shape is
  unchanged (`aria-disabled` + title), which the gallery and the RFQ
  composer still use. With it: tabbable, Space/Enter toggle, no
  `aria-disabled`.
- Selection state: `components/dashboard/selection.tsx` (client context,
  one provider per page load, so selection is "this page" only). Pure math
  is in `lib/dashboard/selection.ts`. Outside a provider (the `/dev/ds`
  gallery) the context is inert, so the gallery is unchanged.
  `SupplierResultCard` and `ResultsTable` are now client components, as spec
  §3 allows for "components that hold selection state".
- The sticky bar: `components/dashboard/selection-bar.tsx`, reading
  "N selected · Send RFQ · Save · Compare · Export · Clear".
  - **Save** posts each selected id to the existing `/api/v1/saved`, then
    refreshes the page. `SaveRecordButton` now syncs to its `saved` prop, or
    a card saved from the bar kept reading "Save".
  - **Export** is the existing CSV route plus `?ids=`. `lib/discover-export.ts`
    re-runs the SAME filter state (never a raw id lookup), keeps only the
    selected rows, and names the file `…-selected-N.csv`. Bad, empty or more
    than 100 ids → 400. `?ids=` present but empty must be refused, not fall
    through to a full export; the first draft did fall through, and a test
    caught it.
  - **Send RFQ** and **Compare** are disabled with a title saying why. Their
    destinations are REZ-D (the multi-supplier composer) and REZ-C
    (`/app/compare`), which do not exist on this branch. The old
    `/app/rfqs/new` takes one supplier only.
  - **Clear** is the one addition beyond the spec's wording.
- `SEND_RFQ_MAX` (50) is read out of `app/api/v1/rfqs/route.ts`'s
  `MAX_TARGETS` by a test, so the two numbers cannot drift.

### 10.2 A guard added for a defect class that has now happened twice

`tsconfig.npm-test.json` lists files explicitly. A `*.test.ts` left off it
is typechecked but **never run**: that hid `load-buyer-shell`'s tests once,
and hid this session's selection tests on their first run. New test in
`scripts/gallery/harness.test.ts`: every `*.test.ts` in the repo (outside
`node_modules`, `.claude`, `etl`, `ops`, …) must be in the list. Proved by
removing `lib/dashboard/selection.test.ts` from the list: red, naming the
file. Restored: green.

### 10.3 Verification, and what is NOT verified

- `pnpm exec tsc --noEmit`: exit 0. `next lint`: 0 errors (warnings
  pre-existing).
- `pnpm test`: **1,319 pass, 0 fail, 198 suites** (Node 25). It was
  1,302 / 196 at `b04144a`.
- **Not checked in a browser.** Reason below.
- Committed 23 Sep as `083130e`; CI run `35820165951` green on it.

**The blocker.** The local dev server reads `.env`, which points at the
**live** Supabase project (`stnrfxrxfonwexzcvvpv`). There,
`discover_suppliers` still has the pre-`0104` signature. A read-only call
with the page's own arguments returns *"Could not find the function
public.discover_suppliers(… p_hs_codes, p_cert_state, p_rsc_state,
p_est_from, p_est_to, p_workers_max, p_districts, p_cities,
p_exclude_sanctioned …)"*. So `/app/discover` on this branch can only render
"Search is under heavy load" against live data. No cards means no
checkboxes, so nothing in this branch's results page can be seen in a
browser until `0104` exists in whatever database the server points at.

Two consequences:

1. **Deploy-order hazard (the one `current-state.md` warns about).** If this
   branch's code ships before `0104` is applied, every buyer's search breaks
   and says "heavy load". This is a gate-3 blocker. `0104` must be applied
   first, or with the deploy.
2. **A false comment.** The header of `lib/discover-v32-rpc.ts` says
   "Extra columns degrade to empty when 0104 is not yet applied — the page
   still renders". Extra *columns* might, but the new *parameters* make
   PostgREST refuse the call outright. Fix the comment, and either make the
   caller fall back or state the dependency. A truthfulness reviewer should
   catch this; it is here so they do not have to.

Also found while trying: `middleware.ts` builds its login redirect from
`NEXT_PUBLIC_SITE_URL`, which is `https://sourcebd.net` locally. So opening
`localhost:3000/app/discover` signed out sends you to the **live** login.
Open `http://localhost:3000/login?next=%2Fapp%2Fdiscover` directly instead.

### 10.4 First actions for the next session

1. Commit this session's work (rule 11), push the feature branch, and let
   CI run.
2. Put the founder's open questions to him **in one message**: §7.1 (the
   anon grant on `discover_suppliers`, which `0104` widens), §7.2, §7.3,
   §7.4, and how he wants the results page checked in a browser before
   `0104` is applied (a Supabase branch with `0104`, or no browser check
   until after).
3. Run cycle 11: five independent reviewers (§6) against the new frozen
   commit, newest work first: the selection bar, the `?ids=` export, and
   §10.3's false comment.
4. Repeat until a round has zero blocking; then the Acceptance Judge.
5. Only then ask for gate 1. `0104` is applied by the founder, after a
   dry-run, and before or with the deploy (gate 3), never after it.

## 11. Review rounds from 23 Sep (cycle 11 onward)

Each round: freeze a commit, five reviewers in their own worktrees
(truthfulness, correctness, accessibility, guard-adequacy, security), shared
brief and axes kept in the session scratchpad, not in the repo.

### Cycle 11 — candidate `083130e`: REJECT (all five)

Gate at `083130e`: tsc exit 0; next lint exit 0; `pnpm test` 1,319 / 0 / 198
suites. CI `35820165951` green.

Found and repaired. 31 in-process mutations went red (corrected 23 Sep by
cycle 12's truthfulness reviewer: this line first said 32). NOT proven red in
cycle 11, only green in CI: the new `assert-0104.sql` blocks, the new
http-boundary cases, and the root-only test-list skip — cycle 12 proved the
last two (below); the SQL asserts remain proven only by passing.

- The false "page still renders" header in `lib/discover-v32-rpc.ts` —
  rewritten as a hard dependency on 0104. The page now says "heavy load"
  only on a statement timeout (57014); a missing function (PGRST202, the
  pre-0104 state) or the contact-field refusal says "unavailable". Guarded
  in unit tests and two new http-boundary cases (mocked PGRST202 / 57014).
- `?ids=` export: the 100-id cap was never tested (malformed fixture ids);
  ids now lower-cased; repeated `ids=` → 400; a selection matching nothing →
  409 with a reason, not an empty file; signed-in non-buyer → 403. Tests pin
  that it re-runs the buyer's own page / per-page / sort. Cap pinned to
  `PER_PAGE`. Dead post-parse contact checks removed (the raw-row check in
  `fetchDiscoverV32` is the live one). http-boundary cases for `?ids=`.
- Bulk Save sent one POST per id against the 30/min write bucket — now one
  request (`supplier_ids`, `lib/saved-suppliers.ts`, one upsert).
- Export ran up to 10 expensive-sort passes under the 120/min read bucket —
  new `api_export` bucket (6/min). It bounds the app's ROUTE only; a
  signed-in PostgREST caller reaches the RPC directly (see cycle 12). **This changes 0104:** it redefines
  `rl_check` (body identical to 20260725 except the one array entry; live
  body checked against `pg_proc.prosrc` 23 Sep) because rl_check refuses an
  unlisted bucket and the app's limiter fails OPEN. `lib/rate-limit/limits.test.ts`
  holds the app's classes to the effective allow-list. `/app/discover` page
  loads now count against `api_read`. Count-only calls (explain, saved-search
  refresh) send the cheap sort.
- `saved_searches` bounds in 0104: name 1–120 chars, state ≤ 8 KB, 500 rows
  per owner (trigger). Executed in `assert-0104.sql`.
- Accessibility: bar reserves its height via `scroll-padding-bottom` (2.4.11);
  Clear moves focus to select-all before unmounting; Space toggles on keyup
  only, Enter does not; select-all is tri-state ("mixed"); bar is a labelled
  group, not a toolbar; visible reason for disabled Send RFQ / Compare; bulk
  Save uses `aria-disabled`, never native `disabled`.
- Selection keyed on the full URL state (Next keeps client state across a
  search-param change); per-row Save hears bulk saves via an event, since
  the `saved` prop may not change.
- Test-list guard skipped `etl`/`ops` at any depth — now root only.
- Boot docs no longer carry a tip SHA; merge base corrected to `7ea98b4`.

Not fixed, recorded: SEC-7 — the replay guard's "empty `public` schema"
test would pass on an empty database of a real cluster reached through a
tunnel (e.g. `PGDATABASE=template1`); theoretical, needs deliberate setup.

### Cycle 12 — candidate `9adebe2`: REJECT (all five)

Gate at `9adebe2`: tsc exit 0; lint exit 0; `pnpm test` 1,355 / 0 / 204.
CI `35824445777` green. (`d9c9d22` before it failed CI's root `tsc`:
tests compiled under the suite's tsconfig but not the root's strict index
access — fixed in `9adebe2`. Lesson: run the ROOT `tsc` before pushing.)

Repaired; 39 in-process mutations red (`mutations-r12` in the session
scratchpad) plus a local `test-profile-http-boundary.mjs --build` run with
three defects put back, which failed exactly the four cases guarding them:

- a11y: the box ticked to make the bar appear could sit under it — the bar
  now re-scrolls the focused element; the count is announced from a live
  region mounted before the first tick.
- Bulk Save: one supplier deleted/unpublished since render sank the whole
  upsert (FK), every retry — ids are now pre-filtered to listed suppliers
  (RLS: published only) and the skipped count is reported.
- Export refusals (429/409/…) replaced the page with raw JSON — both Export
  buttons now download in place (`components/dashboard/export-link.tsx`)
  and say what went wrong; a partly stale selection is named
  `-selected-N-of-M.csv`.
- 0104 security: `revoke … from public` left Supabase's default
  anon/authenticated EXECUTE on every new function — now revoked from
  `public, anon, authenticated` and re-granted; CI bootstrap emulates the
  default privileges and `assert-0104.sql` checks anon cannot execute them.
  `discover_suppliers_explain` no longer forwards `p_sort` (was 12
  expensive passes per call). Cap trigger is SECURITY INVOKER; cap is 200 =
  `LIST_LIMIT`; saved-search refusals are 400/409 with a reason.
- Guards: the bar's logic is now plain functions in
  `lib/dashboard/selection.ts` with behavioural tests (`runBulkSave`,
  `reserveBarSpace`, `clearKeepingFocus`, `selectionValue`); the remaining
  wiring is checked on whole JSX tags; rl_check's 0104 body is pinned to
  20260725's; new http-boundary check for `POST /api/v1/saved`.

For the founder, not fixable by a bucket: any signed-in account can call
`discover_suppliers` (and its expensive sorts) through PostgREST directly,
outside the app's limiter — the same exposure as §7.1, one role up.

Filed separately (pre-existing, not REZ-B): the signed-out rate limiter
never limits in production — `rl_check` refuses anon (42501) and the app
fails open.
