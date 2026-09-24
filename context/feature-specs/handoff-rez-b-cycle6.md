# REZ-B hand-off — buyer Discover v3.2, after cycle 6

For the next Claude Code session on `github.com/Rezx100/SourceBD`. Written
22 Sep 2026. Everything here is on `rez-b-results-page`, tip `813eb53`,
pushed. Nothing is landed, promoted or deployed.

Read this before touching anything. The short version: the work is in good
shape and **it is not done**. Six review cycles have run. Cycle 6 found nine
blocking, two of which were cycle 5's fixes not working. Expect cycle 7 to
find more; REZ-A took 21 cycles to earn its token.

---

## 1. Where to start

```bash
git fetch origin && git checkout rez-b-results-page
git log --oneline 529434d..HEAD          # 26 commits
git diff --stat 529434d..HEAD            # 63 files, ~6,900 insertions
```

`529434d` is the merge base. The PR is
[#164](https://github.com/Rezx100/SourceBD/pull/164), open as a **draft**,
opened only so CI runs. It is not a merge request.

Read `AGENTS.md` first, then the lean boot set, then
`context/feature-specs/handoff-dashboard-v3.2-implementation.md` — §7 for
this PR's scope, §3.1/§3.3 for the card, §4.1/§4.2 for the SQL. Read the
spec, not this summary of it; it settled two decisions that two sessions had
guessed at.

## 2. Verification state at `813eb53`

- `pnpm exec tsc --noEmit` — exit 0.
- `pnpm exec next lint` — no errors (warnings pre-existing).
- `pnpm test` — **1,235 passing, 0 failing, 181 suites**, one run, ~9 min.
  Node 21+ (24/25 fine). The hand-off before this one reported 957 across 45
  of 47 files and could not finish in one run — that was a sandbox limit, not
  a real one.
- CI on the PR at `813eb53`: all four jobs green — `verify`, `unit-tests`,
  `http-boundary`, `migrations`. The `http-boundary` run has **zero** failing
  cases. One earlier run failed `verify` on `next/font/google` failing to
  parse a Google Fonts response while building `app/global-error.tsx`; it
  passed on the retry and `pnpm build` passes locally, so it is a build-time
  network dependency flaking, unrelated to this change. If it recurs often it
  deserves its own issue.

**The migration is executed now, not read.** `.github/workflows/ci.yml` has a
`migrations` job that replays all 109 migrations into a throwaway Postgres 16
(newest numbered last), then calls the functions and asserts behaviour —
`supabase/ci/`. It has caught four real defects in six runs, three of them in
its own fixture. Do not let it rot.

## 3. The two decisions the founder delegated, and how they were settled

He was asked and said "do what will land exactly what I want from the
dashboard design rebuild" and "do what is best in this scenario". Both were
then settled against the spec and the threat model, not preference. If you
disagree, reopen with him — do not quietly change them.

**Which number is "workers".** Spec §3.1: "no people band (we show the exact
worker count with its source)"; §3.3 puts workers on the meta line "with its
register mark". So the card names the figure, not a narrative. What it covers
is *derived* in `lib/enrich-discover-workers.ts` by comparing the record's own
registry figure with the display roll-up: equal → the record's own; own is
null → the figure is entirely other sites'; otherwise → record plus
buildings. Those are `lib/dashboard/build-models.ts`'s words, on its data.
Two earlier passes got this wrong in opposite directions and both left a
comment asserting composition was unknowable. It is knowable. Do not
reintroduce that comment.

**The anon scan amplification.** `cert_expiry` and `hs_lines` order on a
per-row subquery evaluated over everything that passed the filter, before
LIMIT, on a function PostgREST serves outside the rate limiter. They are now
honoured only for a caller we can see is signed in. Narrowing the anon grant
itself is still open — see §5.

## 4. What is fixed and worth not re-breaking

Every one of these has a guard proved by reintroducing the exact defect and
watching it go red. If you change the code under one, expect it to fail, and
fix the code rather than the guard.

Cycle 5 and 6 between them fixed: the CSV exporting a different worker figure
than it filtered on; saved-search counts printed as live when only ten refresh
per call, and the budget starving the oldest rows forever; placeholder text at
2.54:1; three routes with no responsive layout at all (at 320px the content
column was ~88px); `/app/match` dropping the caller's query because middleware
answered before the route handler; the export's truncation notice being a real
CSV row that imported as a phantom supplier; `withoutFilterFamily` handling
`"sources"` while the SQL emits `"min_sources"`; the kit rail hiding below
`md` and orphaning Products and Compliance hub; the kit shell dropping Orders,
Settings and the account link entirely and reordering the nav against every
other page; out-of-range numeric filters silently returning the whole corpus;
chip React keys colliding when a city and district share a name.

**Two guards of mine were decoration and are worth understanding**, because
the failure mode is subtle and will recur. Both grepped a source file for a
literal, and the *explanatory comment above the code* contained that literal —
so reverting the code kept the guard green, because the prose still matched. I
wrote the comment to explain the bug and the comment then hid it. Both strip
comments before matching now (`lib/design/tokens.test.ts`,
`lib/discover-v32-pii.test.ts`). Check any new text-matching guard for this.

The placeholder guard escaped three times before it held: first reading only
the first matching rule, then losing to a higher-specificity
`input[type="text"]::placeholder` and to an earlier `!important`. It now
asserts **exactly one** placeholder colour rule exists, which removes the
cascade argument entirely. Five attacks on it go red.

## 5. What is still open

### Founder's call, not yours

1. **The anon key's reach.** `discover_suppliers` is granted to `anon` and
   served by PostgREST directly. 0104 widens its return from 18 columns to
   23, adding certificate numbers and issuers, HS headings, registries and
   brand lists. 100 rows a request, `p_offset` unbounded, `total_count` on
   every row, no rate limiter on that origin. At roughly 9.9k published
   suppliers (`ops/plans/address-dedup-baseline.md:16`, a lower bound — no
   saved report states the exact total) that is ~100 requests for the whole
   corpus. Each class was already reachable one supplier at a time; what
   changes is bulk. Narrow the grant, or split a lean anon signature from the
   rich authenticated one — which, and how lean, is a business call.
2. **Whether `/app/products` should count sanctioned suppliers.** It does;
   the search it links to hides them, so the two numbers disagree on one
   click. `hs_catalogue` filters on `is_published` only.

### Blocking-ish, unfixed

3. **The `workers` sort orders on a number the column does not show.** SQL
   orders on `suppliers.employees_total` (the record's own); the column
   renders the enriched roll-up. Two suppliers can appear out of order. The
   per-row label now explains which figure is which, so it is legible rather
   than false — but a buyer who picks "Workers on the register" still sees a
   column that is not monotonic. Fixing it properly means either sorting on
   the displayed value (a per-row roll-up an anonymous caller could hammer —
   rejected twice already, for good reason) or showing the sorted figure.
   Worth putting to the founder with §5.1.
4. **The nav strip clips its own focus ring below `md`.**
   `components/dashboard/app-shell.tsx` — `overflow-x-auto` computes
   `overflow-y: auto`, and outlines are not scrollable overflow, so the
   global `outline-offset-2` ring is cut top and bottom on a 32px-tall strip.
   `py-1 -my-1` on the `<nav>` fixes it. Same class as a finding already
   rated blocking earlier in the kit.
5. **The topbar search input has no `min-w-0`**, so at 320px it and the `⌘K`
   badge spill over the Help button. The form has `min-w-0` so the document
   does not scroll; the overlap is visual.

### Non-blocking, known

- `discover_suppliers_explain` forwards `p_sort` into up to twelve full-corpus
  passes; authenticated-only, so outside the anon fix, but the same shape.
- `hs_catalogue()` is an unbounded full-corpus aggregate with no argument to
  bound it and no cache.
- `supabase/ci/apply-migrations.sh` takes its target from ambient `PG*` env,
  and `.claude/hooks/guard.py` blocks `psql -c` but not `psql -f`. Pointed at
  production it would replay every migration, and
  `00-supabase-bootstrap.sql` `create or replace`s `auth.uid`/`role`/`jwt`.
  It should refuse to run against a non-local host.
- `CSV_CONTACT_HEADERS` misses `contact_name` and `contact_role`, two of the
  four PII columns `agent-brief.md` names. Nothing leaks today —
  `discoverRowHasPii` covers all four upstream and `CSV_COLUMNS` is a closed
  list — but the backstop is narrower than its comment claims.
- `assert-0104.sql`'s explain check is `count(*) >= 1`; eleven of twelve
  dimensions could stop being emitted and it passes. The TypeScript side pins
  the set exactly, but by reading source text.
- The sidebar's "Recent searches" count is a remembered number printed bare —
  the defect `savedCountLabel` fixes one surface over — and records `0` for a
  page past the end.
- `discover_suppliers_explain` never emits `'sanction'`, so a search that
  returns nothing *only* because every match is sanctioned gets no suggestion
  saying so.
- Mixed cert states collapse to "any", widening the query (disclosed in the
  chip).
- `PhotoStrip` clips export-line tiles with no way to reach them, and its
  `+N` control is a button with no handler. Predates this round.
- `⌘K` is advertised in the topbar and no such shortcut exists. The Help
  button has a name and no behaviour. `/app/searches` sets `aria-current` on
  a link pointing at `/app/discover`.
- The whole responsive reflow (`61dc40a`) has no automated test; it was
  verified in a browser against the compiled stylesheet at 320/375/768/1280.
  The kit nav restructure after it was typechecked but **not** re-verified in
  a browser — do that.
- `lib/dashboard/load-buyer-shell.ts` is not in `tsconfig.npm-test.json` at
  all. `POST`/`DELETE` on `/api/v1/saved-searches` have no boundary case.

## 6. How to carry the loop forward

1. Fix what is in §5. Give each fix a guard and **prove it** by reintroducing
   the defect and watching it go red. If it does not go red the guard is
   decoration — that has been true of six guards in this change so far.
2. Freeze a commit. Run five independent reviewers against it — truthfulness,
   correctness, accessibility, guard-adequacy, security — **each in its own
   git worktree** (`isolation: "worktree"`), each given the diff, the spec and
   the code, and none of them given your account of what you fixed.
3. Two process mistakes not to repeat. In cycle 5 I ran all five in one
   worktree and committed with `git add -A` while one was mutating files, so
   two of its mutations were swept into my commits; it caught them and I had
   to revert. And do not let the candidate move under the reviewers — freeze
   it, or their line numbers and findings go stale.
4. Point reviewers at the newest, least-reviewed work rather than the whole
   diff again. The last round's repairs are where the defects were.
5. Repeat until a round returns zero blocking. Only then does a separate
   Acceptance Judge return `ACCEPTED_FOR_HUMAN_REVIEW`. You do not decide
   your own work is done (`AGENTS.md` rule 16).

## 7. The gates

Nothing is landed, promoted or deployed, and none of it may be without the
founder's explicit go-ahead, asked for **one gate at a time**
(`AGENTS.md` 9a):

1. land on `development`
2. promote `development` to `main`
3. deploy to the VPS at `109.104.153.228`

Approval of one is never approval of the next — not from a green CI run, not
from the work being finished, not from an earlier yes.

`0104` is a production migration: drafted, committed, executed only against a
throwaway CI database. `AGENTS.md` rule 15 — the founder applies it, and the
approval attaches to the exact audited migration, so if the file moves the
approval is void. It has moved twice since the last hand-off.

## 8. One thing that is not REZ-B's

The previous hand-off flagged the HTTP-boundary harness's REZ-109 case — a
supplier profile appearing to render facility contact data it should not —
as failing on production `main` and worth its own issue. It is **not
failing now**: the `http-boundary` job at `813eb53` has zero failing cases.
Either the `--build` run does not reproduce what the earlier `--dev` run saw,
or it has been fixed since. Do not carry it forward as a known failure
without re-checking; if you want it tracked, reproduce it first.
