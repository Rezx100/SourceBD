# REZ-B hand-off: finish the results page, then ship it

For the next Claude Code session on `github.com/Rezx100/SourceBD`. Written
24 Sep 2026. This replaces `handoff-rez-b-cycle10.md` as the starting point.
That file is still the history: grep its §11 for any cycle, but don't read it
whole.

Every fact below was checked on 24 Sep against git, GitHub and CI. Treat it
as a hypothesis anyway, and re-check anything you rely on (closed-loop §2).

---

## 0. The short version

- **REZ-B (the buyer Discover results page) is built.** It is not yet
  accepted, landed or deployed.
- Five review rounds ran on 23 Sep (cycles 10 to 14). Every finding was fixed,
  and each fix has a guard proven by putting its defect back and watching it
  go red.
- **Cycle 15 ran on 24 Sep** on `6600786`, after the founder's decisions in
  §2 were built. Its findings and what became of them are in §10.
- Production runs `9b518c5` (`main`, REZ-A only). `development` is 2 docs
  commits ahead of `main`.
- **What stands between REZ-B and the VPS:**
  1. a clean review round, then the Acceptance Judge;
  2. founder gate 1: merge PR #164 into `development`;
  3. founder gate 2: `development` → `main`;
  4. the founder applies migration `0104`;
  5. founder gate 3: deploy.
- "The whole dashboard" is REZ-B **plus seven more issues** (§6). Each has its
  own migration, review loop and three gates.

## 1. State on 24 Sep (verified at `28b4e6a`: tip `6f598cb` plus this hand-off)

A snapshot taken before cycle 15; the tip, the gate and CI have moved since.
Read the tip from `git log -1` and the gate from the newest
`.claude/rez-b-review-kit/evidence/gate-*` files, never from this table.

| Thing | Value |
| --- | --- |
| Branch | `rez-b-results-page`, clean tree, even with `origin` |
| Tip | `6f598cb` ("founder decision — signed-out visitors see all but contact details") |
| Merge base with `development` | `7ea98b4` (`529434d` is the branch's first commit, not its base) |
| Diff | 85 files, +13,220 / −716. No Python (`etl/`, `ops/`) touched |
| PR | [#164](https://github.com/Rezx100/SourceBD/pull/164): draft, base `development`, head `6f598cb` |
| Gate at `6f598cb` | `tsc --noEmit` exit 0; `next lint` exit 0; `pnpm test` **1,422 pass / 0 fail / 210 suites** (Node 25) |
| CI at `6f598cb` | run `35855529976`: verify, unit-tests, migrations, http-boundary all **success** |
| Production | Deploy Production run `35637291913` on 21 Sep: "Expected production commit 9b518c55…" = `origin/main` |
| Migration `0104` | **Not applied** to the live database (no `saved_searches` table, old `discover_suppliers` signature). Hard dependency of this branch |

The four-command gate in `CLAUDE.md` still names 602 tests / 86 suites at
`e15966c`. That baseline is stale for this branch; take the current numbers
from the newest gate files (1,422 / 210 at `6f598cb`).
`pytest` and `ruff` are unaffected, because REZ-B touches no Python. Run them
anyway before gate 1 and paste the raw numbers, since `CLAUDE.md` asks for
all four.

## 2. Founder decisions

**Decided (23 Sep): "A signed-out visitor should see everything but the
contact info of the company."**
- The `anon` grant on `discover_suppliers` and 0104's wide return stay. There
  is no lean anon signature and no paging cap.
- `assert-0104.sql` enforces it in two ways: the declared result of every
  overload, and a row fetched as `anon`, both carry no contact column.
- Recorded in `current-state.md` founder rules.
- Any contact field reaching a signed-out caller is a BLOCKER.

**Decided 24 Sep, all four as recommended.** Do not ask again.
1. `/app/products` counts leave out sanctioned suppliers, so each equals the
   search it links to. Built in `6600786` (0104's `hs_catalogue`).
2. The worker figure is the supplier's own, which the Workers sort uses; the
   profile's figure is a second line when it differs. Built in `6600786`,
   corrected in cycle 15 (§10).
3. No Help button until `/app/help` exists. Built in `6600786`.
4. A paid Supabase branch for a live check: approved, created and deleted on
   24 Sep. It came up empty (MIGRATIONS_FAILED: the live migration history
   does not replay), so there is no live browser check until the founder
   applies 0104. Creating it switched on branching for the project.

Questions for the later issues (spec §8 Q1–Q5) are in §6.

## 3. Finish REZ-B: the loop

Follow `AGENTS.md` rule 16 and `.cursor/rules/sourcebd-closed-loop.mdc`
exactly.

1. **Run the gate first** and paste the raw numbers:
   - `pnpm exec tsc --noEmit`, `pnpm exec next lint`, `pnpm test` (Node 21+);
   - `pytest` and `ruff` before gate 1.
   - Stop any dev server and prune agent worktrees first, or `tsc` runs out of
     memory.
2. **Freeze a commit and run five reviewers**: truthfulness, correctness,
   accessibility, guard-adequacy, security.
   - Run each with `isolation: "worktree"`, and each gets the brief, not your
     summary.
   - The kit is in `.claude/rez-b-review-kit/` (git-ignored, on this machine):
     - `reviewer-brief.md`: the shared brief, with `{{SHA}}`, `{{GATE_DIR}}`
       and `{{EXTRA_FOCUS}}` placeholders. Its "pending decisions" block is
       current as of 24 Sep.
     - `axes.md`: one section per axis. Replace `{{SHA}}` there too.
   - Aim `EXTRA_FOCUS` at the newest commits first: repairs are where defects
     cluster.
3. **Fix every BLOCKER and MAJOR.** Each fix gets a guard, **proven by putting
   the defect back and watching it go red**.
   - The kit's `mutate-r1*.cjs` scripts show the pattern: one mutation at a
     time, recompile the test project for source edits, restore
     byte-for-byte.
   - `ga-mutate.cjs` and `gr-mutate.cjs` are the guard reviewers' own attack
     lists; re-run them.
4. **Commit and push the feature branch** (free), let CI run, and re-run the
   gate.
5. **Repeat until one round returns zero blockers and zero majors on all five
   axes.** Then run a separate **Acceptance Judge**. It gets the primary
   evidence plus the five verdicts, and it alone may return
   `ACCEPTED_FOR_HUMAN_REVIEW`.
6. **Stop and ask for gate 1.** Nothing merges without the founder's
   explicit yes.

**How many rounds are left?** Nobody can say in advance. The rule is "a clean
round", not a count.
- The security axis ACCEPTED in cycles 13 and 14.
- The other four found narrower things each round.
- The cycle-14 fix aimed at the recurring cause: guards that read source
  *text*. `components/dashboard/interaction.test.ts` now invokes the real
  handlers through `hook-harness.ts`.
- Expect one to three more rounds.

### 3.1 Traps this branch has already hit (don't repeat them)

- **Run the ROOT `pnpm exec tsc --noEmit` before every push.** The test
  project's tsconfig is laxer: `d9c9d22` passed locally and failed CI on
  strict index access.
- **CI runs on pull requests** to `development` or `main` (and on pushes to
  those two). Pushing this branch runs CI only through PR #164.
- **You cannot prove CI-only guards red by pushing broken code.** The
  permission system blocks pushing deliberately weakened security code, and
  rightly so.
  - Prove the http-boundary cases locally instead:
    `node scripts/test-profile-http-boundary.mjs --build` with the defect put
    back in the working tree. It is a mocked server, and a Next build takes
    several minutes.
  - The `assert-0104.sql` blocks cannot be run locally (no Postgres, and
    installing one is a new tool). They are proven only by passing CI. Say so
    honestly.
- **Restoring a file:** never run `git checkout -- file` to undo a mutation.
  It also discards your uncommitted work in that file. Copy a backup first
  and `cmp` it after.
- **Quoting:** in bash double quotes, `$$` (SQL dollar quoting) becomes a
  process id. Write SQL fixtures with `printf '%s'` in single quotes.
- **Line endings:** files are CRLF in the working tree (`core.autocrlf=true`).
  - Python rewrites in text mode are fine.
  - Source-text regexes must use `\s*`, never a literal `\n`.
- **Mutations must compile.** A mutation that fails `tsc` proves nothing.
  Rewrite it and re-run.
- **The whole-file walker:** `functionBody()` in `render.test.ts` bounds a
  component by its own braces. Don't go back to slicing up to "the next
  export".
- **Rate limits:**
  - `rl_check` refuses an unlisted bucket, and the app's limiter FAILS OPEN on
    any error. A new rate-limit class needs an `rl_check` allow-list entry.
    `lib/rate-limit/limits.test.ts` holds the two lists together.
  - Only the four known migrations may define, alter or drop `rl_check`.

## 4. Tools that make this faster (founder asked for them, 24 Sep)

### 4.1 Browser: `browser-harness` (default)

- Installed at `C:\Users\Hp\.local\bin\browser-harness.exe`.
- Its `--doctor` on 24 Sep reported that Chrome was not running and the
  daemon was not alive. **Start Chrome or Edge**, then follow its install.md
  to start the daemon, and re-run `--doctor`.
- Use it for real-browser checks: WCAG reflow and focus at 320×256, 375×812
  and 1280×800, and the post-deploy smoke.

### 4.2 Jev (the founder named it on 24 Sep, so these are authorised for this work)

- **`jev-ultrafast`**: the fast goal-driven browsing agent.
  - Run it from `C:\Users\Hp\.cursor\tools\jev-ultrafast`. Its `.env` is
    filled; never print or copy the key.
  - Good for quick walk-throughs of `/discover` (signed out) and
    `/app/discover` (signed in) once 0104 is live, and for the post-deploy
    smoke.
  - Per the user's global `CLAUDE.md`, don't switch between Jev and
    browser-harness mid-task. Pick one per task; if it can't do the job, say
    so and stop.
- **`jev-decide`**: fast typed triage of text. Useful for merging five
  reviewers' findings into one deduplicated list tagged blocker, major or
  minor.
  - It is an aid, never the verdict: every item still needs its evidence
    checked.
  - It never replaces the Acceptance Judge.

### 4.3 Component-level browser repro (works without 0104)

- `.claude/rez-b-review-kit/repro/`:
  - `entry.cjs` builds a Discover results page (provider, header, cards,
    footer, bulk bar) from the COMPILED components in `.tests-build/`;
  - `bundle.cjs` bundles it: change its `root` to `E:/SourceBD`;
  - `serve.cjs` serves it on :3197.
- Steps:
  1. Run `pnpm exec tsc -p tsconfig.npm-test.json`.
  2. Run `node bundle.cjs`.
  3. Generate the CSS with
     `pnpm exec tailwindcss -c tailwind.config.ts -i app/ds.css -o <dir>/ds.css`.
  4. Copy `index.html`, `bundle.js`, `ds.css` and `serve.cjs` into
     `.tests-build/repro13/` (ignored).
  5. Start it with `preview_start` using the `bulkbar-repro` entry already in
     `.claude/launch.json`.
- It must be served over http: the pane loads `file://` pages as inline
  documents, so their scripts don't run.
- Measured 23 Sep: 320×256 bar in flow (no scroll padding); 375×812 sticky,
  101px (12%); 1280×800 sticky, 85px (11%).
- `a11y-rev13/` and `a11y-rev15/` hold reviewer repro scripts (python for
  browser-harness).

### 4.4 Other

- **Supabase MCP**: read-only catalogue queries against project
  `stnrfxrxfonwexzcvvpv` are fine. Never write, never run DDL, never call
  `rl_check` (it writes).
- **Workflow tool**: the founder must opt in explicitly ("use a workflow").
  It can run the five reviewers as one orchestrated fan-out; otherwise use
  five `Agent` calls in one message.

## 5. Shipping REZ-B: the gates, in order, each asked for separately

1. **Gate 1: land on `development`.**
   - Mark #164 ready and merge. The hooks block `gh pr merge`, so the founder
     merges.
   - Only after the Judge's token, and with the raw gate output pasted.
2. **Gate 2: promote.**
   - Open a PR from `development` to `main`.
   - Ask again; don't chain it onto gate 1.
3. **Migration 0104, applied by the founder, before or with the deploy, never
   after.** Code without it breaks every signed-in search: the page says
   "Search is unavailable right now".
   - **0104 is safe for the code live today.** Main's `discover_suppliers`
     callers pass only parameters 0104 keeps, all of which have defaults.
     Re-verify this against `origin/main` before advising.
   - What 0104 does:
     - Redefines `rl_check`: one allow-list entry added. The body is pinned
       to the live 20260725 body by a test.
     - Adds `saved_searches` with a CHECK on names up to 120 characters, a
       state size of at most 8 KB, and a cap of 200 rows per owner (invoker
       trigger).
     - Revokes the default anon and authenticated EXECUTE on every new
       function.
     - Keeps `discover_suppliers` executable by anon (founder decision).
   - **Dry-run for the founder** (post the output first; approval covers
     exactly this file):
     - Create a scratch wrapper outside the repo containing `begin;`,
       `\ir <abs path>/supabase/migrations/0104_discover_v32.sql` and
       `rollback;`.
     - The founder runs
       `psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f <wrapper>` at a
       quiet time.
     - `drop function discover_suppliers` holds a lock until the rollback.
     - The `psql -c` form is blocked by the hooks, and it isn't yours to run.
   - **Apply:** the same command on the migration file itself, with `-1`
     (one transaction).
     - Then update `current-state.md`'s migration ledger.
     - Record the applied file's sha256. If the file changes after approval,
       the approval is void.
   - **Hazard:** `saved_searches` uses `create table if not exists`. If 0104
     changes after it is applied, re-running will NOT update its constraints.
     Freeze 0104 at acceptance.
4. **Gate 3: deploy.**
   - Read `.cursor/rules/sourcebd-enterprise-deploy.mdc` and
     `docs/ENTERPRISE_DEPLOYMENT.md` first.
   - VPS `109.104.153.228` only; never `37.49.227.151`.
   - GitHub Actions → Deploy Production with the `main` SHA. The hooks block
     `gh workflow run`, so the founder triggers it.
   - Smoke checks:
     - `/api/health` on the domain and on the IP;
     - `/discover` signed out: a result, and no contact fields in the HTML;
     - `/app/discover` signed in: cards, table view, select, bulk Save, both
       Exports, the Filters stop, saved searches;
     - `/app/products` and `/app/searches`.
   - Produce the deploy summary from the doc's template, with the rollback
     ref.

## 6. "The whole dashboard": what comes after REZ-B

Spec: `handoff-dashboard-v3.2-implementation.md` §7. **Build order:
A → B → C → D → H → G → E → F → I.** Each is a separate PR to `development`,
branched only after the previous one has landed. Each has its own closed
loop and three gates, and its migration is applied by the founder.

| Issue | What | Migration | Needs from the founder first |
| --- | --- | --- | --- |
| REZ-C | supplier record sheet, product line, compare (`/app/compare`) | `0105` | nothing |
| REZ-D | RFQ composer, list, settings, multi-supplier send (enables the bar's Send RFQ) | `0106` | §8 Q1: may unclaimed suppliers get RFQs by email? §8 Q4: attachments bucket |
| REZ-H | workspaces, members, invites, comments, org-scoped RLS | `0109` | nothing (personal-org backfill is dry-run first) |
| REZ-G | on-demand shipments and US customers (ImportYeti/Volza) | `0108` | §8 Q5: provider and key; buy credits |
| REZ-E | AI foundation, Ask, why-matched | `0107` | §8 Q3: `OPENAI_API_KEY` set by the founder locally and on the VPS |
| REZ-F | AI on the record and the RFQ | none new | REZ-E |
| REZ-I | notes, custom fields, Message button | (per spec) | REZ-H |

- §8 Q2 (the 34 HS photos): files in `design/assets/products/hs/`, or
  allowlist the CDN.
- Ask the §8 questions early; they block D, G and E.

## 7. Production issues found while reviewing (not REZ-B; each filed as its own task chip on 23 Sep)

1. **Ten public `_snapshot_*` and `_tmp_*` tables have RLS off**, and anon
   can SELECT, UPDATE and DELETE them.
   - They hold unpublished supplier names, the admin queue and BGMEA numbers.
   - The fix is a production mutation: founder go-ahead after a dry-run.
   - Also stop ops scripts from creating snapshots in `public` with default
     grants.
2. **The signed-out rate limiter never limits.**
   - Middleware calls `rl_check` with the anon key; `rl_check` refuses anon
     (42501); `lib/rate-limit/check.ts` fails open.
   - About 6,250 of these 401s a day.
3. **`rl_check` is callable by any signed-in user with a chosen ident.** One
   account can exhaust another's bucket.

Also recorded as known and non-blocking: SEC-7, the CI replay guard treats an
empty `public` schema as throwaway. See the cycle-10 hand-off §7 for the
older non-blocking list.

## 8. Hard limits (unchanged)

- Never touch the VPS at `37.49.227.151`.
- No ssh or rsync.
- Never write `.env`.
- Never apply a migration or run `--apply` yourself.
- Never push to `main`.
- Never merge or trigger deploys: the hooks refuse them, so print the command
  for the founder.
- Replies to the founder: five lines or fewer, in plain words, and no
  questions except a gate.

## 9. Session prompt (paste into the new session)

```
Finish REZ-B (the buyer Discover results page) on branch rez-b-results-page and
get it to production, then continue the dashboard build order.

Read first, in order: AGENTS.md, context/agent-brief.md, context/current-state.md,
context/feature-specs/active.md, then context/feature-specs/handoff-rez-b-cycle15.md
in full. Treat every claim in it as a hypothesis and check it against git, CI
and the code.

1. The decisions in handoff §2 are all taken; do not ask them again. Read §10
   for where cycle 15 left off.
2. Run the closed loop exactly as handoff §3 and AGENTS.md rule 16 describe,
   starting with the next cycle on the current tip, using the review kit in
   .claude/rez-b-review-kit/. Five independent reviewers in their own worktrees,
   newest work first; fix everything; every fix gets a guard proven red; push
   and let CI run; repeat until a round has zero blockers and majors, then a
   separate Acceptance Judge. Do not stop between rounds to check in.
3. Use browser-harness for real-browser checks and Jev (jev-ultrafast for fast
   browsing checks, jev-decide to triage reviewer findings) as handoff §4
   describes. Never print keys.
4. Before each round and at the end, paste the raw gate numbers: pnpm exec tsc
   --noEmit, pnpm exec next lint, pnpm test (Node 21+); pytest and ruff before
   gate 1.
5. On ACCEPTED_FOR_HUMAN_REVIEW, ask me for gate 1. Then gate 2, the 0104
   dry-run and exact apply command (handoff §5), and gate 3 — each separately.
   After deploy, run the smoke checks and give me the deploy summary with the
   rollback command.

Hard limits: never touch the VPS at 37.49.227.151, no ssh or rsync, never write
.env files, never apply a migration or an --apply yourself. Keep every update to
me to five lines or fewer, in plain words.
```

## 10. Cycle 15 (24 Sep)

- Reviewed `6600786`. Security ACCEPTED. Truthfulness, correctness,
  accessibility and guard adequacy REJECTED.
- The blocker: the worker figure's words ("across this record and its
  buildings") were inferred by comparing numbers. `production_workers_display_batch`
  prefers RSC, so standalone factories whose RSC headcount differs from their
  register figure were called groups (two reviewers each counted 639 live, by
  read-only query on 24 Sep; no saved script, so treat it as unverified). Repaired at the root: 0104
  now re-creates that function to report `sites` and `includes_root`, the page
  uses only those, and `lib/production-workers-reconcile.test.ts` holds the
  body otherwise identical to the live one.
- Also repaired: the table's supplier name is the row header (WCAG 2.4.4);
  card names are headings; the disabled bulk buttons have one explanation; an
  export for a changed selection is not saved; the Help guard checks every
  topbar control; the CI vacuity check can fail; stale comments.
- Written down, not changed:
  - The product sheet's "Other exporters of <code>" (the HS manifest) and
    `ops/hs_catalogue_exporter_reconciliation.py` still count sanctioned
    suppliers, so one heading can show two exporter counts on two surfaces.
    Regenerate the manifest from the Products population when REZ-C touches
    the sheet.
  - Spec §3.2's sticky table header is not built: inside the horizontal
    scroll container it would stick to the container, not the page.
  - `lib/saved-searches.ts` retries a failed count refresh on every GET (up
    to 10 scans a call), and its 500s return Postgres's message as `detail`.
  - Signed-in suppliers get 401 from `/api/v1/saved` but 403 from the export.
- Local `pytest` loads the live `.env` at import (two test files), so its
  database tests try production. Blank `SUPABASE_DB_URL`, `DATABASE_URL`,
  `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` when running it. With those
  blank: 992 passed, 25 skipped, 32 failed, and all 32 fail because Windows
  runs the WSL `bash` stub. That matches the 1,024 / 25 baseline. Filed as its
  own task. `ruff` 0.15.13: 49.

## 11. Cycle 16 (24 Sep)

- Reviewed `fd826d5`. Truthfulness, accessibility and security ACCEPTED;
  correctness and guard adequacy REJECTED.
- Repaired, each guard proven red (`mutate-c16.cjs`, 23 mutations; the
  cycle-15 sets re-run green-to-red):
  - After a selection change, Export and bulk Save were left busy, so the
    next click did nothing. The reset now frees them, and a stale run no
    longer touches busy. `hook-harness.ts` records effects and their
    dependency lists, so tests run the real reset.
  - The shell guard now requires every link in the topbar and sidebar to
    reach a page that exists and every button to submit its own form. It
    allows no other focusable control and no "help" by any name.
  - The worker basis is tested for a two-building sum that leaves the
    record out, in unit tests and in the CI replay. CI also runs the Workers
    sort and checks the batch's anon and authenticated grants.
  - The headline worker figure is always "on the supplier record": that is
    `suppliers.employees_total`, which comes from the registers or an RSC
    fill (`ops/backfill_rsc_employees.py`). The sort, filter chips, card,
    table and CSV all use those words.
  - The contact-field check is pinned to a literal four-key list and tested
    with array values. The mixed checkbox now shows in forced colors. The
    Products caption is asserted at the HTTP boundary.
- Written down, not changed:
  - `production_workers_display_batch` is anon-callable for any uuid, with no
    published filter and no array cap. That was already true on main; 0104
    adds `sites` and `includes_root` to what it returns. Filtering on
    published would drop every building, because buildings are always
    unpublished. Cap the array when the RPC surface gets its rate limits.
  - A 400 from the export (a hand-edited `ids`) reads "try again".
  - The source-mark links are 20px with a 3px gap (WCAG 2.5.8), from REZ-A.
  - A signed-in supplier gets 403 from the export and 401 from
    `/api/v1/saved`. Suspension relies on the middleware alone.
