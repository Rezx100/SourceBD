# Start here: REZ-C — the company profile, from audit cycle 13 to production

Written 27 Sep 2026. Replaces `handoff-rez-c-cycle4.md` as the entry point;
`handoff-rez-c-start.md` is still the scope. This is the prompt for the session
that ships REZ-C and files what is left.

## 0. Where things stand, verified at the end of this session

- Branch `rez-c-supplier-record`, **21 commits ahead** of `origin/development`
  (`1366220`) before this hand-off's own commit. **Nothing pushed. No PR.**
- `origin/development` = `1366220`, `origin/main` = `64c681c`. Neither has any
  REZ-C code.
- Last code commit: `9a715fd` (cycle-13 repairs). **Its full gate has NOT been
  run** — only tsc (0) and the six affected suites (contact-text 213/213,
  record-routes 55/55, discover-v32-state 33/33, build-models 135/135, render
  152/152, record-controls 16/16). The last full gate was at `702f22d`: tsc 0,
  lint 0, build 0, ruff 0.15.13 49, pnpm test 1,840/250 with the one known
  failure (`api_export` rate-limit), pytest without the DB 1,000 / 36 / 21.
- Migration `0105_supplier_record_v32.sql` — **NOT applied, and its dry run is
  stale.** Cycle 13 changed how it counts phones (one number with and without
  +880 is one). sha256 (CRLF) now
  `b6fd758a08f63f8b7abc9a65479c819cf47d30e1a4bb151988de44e43207b465`. The last
  clean dry run was at `4b2dfb8c…` on 25 Sep. The new expression was checked
  read-only over every published record: 4 records drop by one phone.
  Detail: `ops/plans/rez-c-0105-dry-run.md`.
- **The Supabase connection pooler has timed out from this machine since about
  10:17 UTC 25 Sep** (TCP connects, psycopg hangs; ports 6543 and 5432). The
  database itself is healthy: the Supabase MCP answers. So no DB-backed pytest,
  `ops/verify_0105_guards.py`, `ops/verify_contact_text.py` or 0105 dry run has
  run since. A reviewer also saw one large read-only MCP query fail with
  "No space left on device" (pgsql_tmp). **Ask the founder to check Supabase →
  Database → Network bans and disk usage before anything that needs the DB.**
- The code is safe to deploy BEFORE 0105: `fetchContactCounts`
  (`lib/dashboard/load-record.ts`) returns null when the function is missing,
  and the locked contact card then shows no counts. Nothing breaks.

## 1. The founder's instruction, and what it does and does not authorise

27 Sep, verbatim: *"write a handoff for new session so that it deploys the code
and check issues later"*.

Read as: **stop the audit loop at cycle 13, ship this candidate, and file the
remaining review findings as follow-up work instead of fixing them first.**
Every finding left open is a text shape that no live row holds (see §4); the
population guard has passed over every published text in every cycle.

It does **not** override:
- **AGENTS 9a** — the three promotion gates are still asked for one at a time:
  land on `development`, then `development` → `main`, then deploy. Applying
  0105 is its own yes. "Deploy the code" is the goal, not four approvals.
- **AGENTS 16** — the loop closes only on a separate Acceptance Judge's
  `ACCEPTED_FOR_HUMAN_REVIEW`. The founder's instruction is what the Judge is
  told: judge this candidate as is, with the §4 findings deferred by the
  founder. If the Judge rejects on something a buyer can see TODAY (a live
  row, a broken route), stop and tell the founder; do not quietly fix and
  re-judge, and do not ship over it.
- **The guard hook** — the agent cannot `gh pr merge`, `gh workflow run`,
  `--apply`, push to `main`, or run SQL writes. Print those commands for the
  founder.

If any of that reading is wrong, ask the founder ONE question up front and
wait. Otherwise proceed.

## 2. The work, in order

### 2.1 Boot and verify (no approval needed)
Read `AGENTS.md`, `context/agent-brief.md`, `context/current-state.md`,
`context/feature-specs/active.md`, then this file. Check: `git status` clean,
`git log --oneline -1`, `git rev-list --count origin/development..HEAD`.
Node 21+ (`node --version`; measured on 25.4.0), `pnpm`, not npm.

### 2.2 Full gate at HEAD (no approval needed, ~25 min)
Run in sequence, not in parallel (a build beside pytest once died with exit
127 and no message). Save raw output to `.claude/rez-c-review-kit/judge/`:
```bash
pnpm exec tsc --noEmit
```
```bash
pnpm exec next lint
```
```bash
ruff check etl ops --no-cache
```
```bash
pnpm exec next build
```
```bash
pnpm test
```
```bash
python -m pytest -q etl/tests
```
(With the pooler down, run pytest with `SUPABASE_DB_URL=` and
`FIRECRAWL_API_KEY=x`; expect 1,000 passed / 36 failed / 21 skipped, the 36
all in `test_github_https_fetch_auth.py`, `test_queue_decide_rpc_live.py`,
`test_deploy_production_smoke.py`.) Expected: pnpm test ≈ 1,860 tests with the
one known `api_export` failure — the exact number is new; if it passes, write
it into `CLAUDE.md`'s baseline line and commit. Any other failure: stop, fix,
re-run; that is a repair, and the Judge must see it.

### 2.3 The database, if it answers
Try once: `python ops/verify_0105_guards.py` (a 25-second timeout is enough to
know). If it answers, run, in this order, and save the raw output:
`python ops/verify_0105_guards.py`, `python ops/verify_contact_text.py`,
`python -m pytest -q etl/tests` (with the DB), and
`python ops/dry_run_0105_supplier_record.py` — then replace the raw output in
`ops/plans/rez-c-0105-dry-run.md` and remove its "RE-RUN BEFORE APPLYING"
section. If it does not answer, say so in the Judge's evidence as "not
gathered"; the code can still ship (§0), 0105 cannot.

### 2.4 Acceptance Judge
`.cursor/rules/sourcebd-closed-loop.mdc` says how. Build a bundle in
`.claude/rez-c-review-kit/judge/` the way `c13/` was built (the kit's
`brief.md`, `issue.md`, `snapshot.txt`, `diff.patch` = `git diff 1366220
HEAD` minus `context/feature-specs/handoff-rez-c-*.md`, `population-guard.txt`,
the gate files), plus: all four cycle-13 verdicts (substance in
`.claude/rez-c-review-kit/c13/prior/*.md`, and the cycle-13 repair commit
`9a715fd` that answers them), this file's §1 and §4 as the founder's decision,
and the evidence not gathered. Launch ONE Judge agent in its own worktree.
Only the literal token `ACCEPTED_FOR_HUMAN_REVIEW` lets §2.5 start.

### 2.5 Push and PR (free — no approval needed)
```bash
git push -u origin rez-c-supplier-record
```
Open a **draft** PR to `development` with `gh pr create --draft --base
development`. Body: what REZ-C is, the gate numbers, the Judge token, 0105's
state (not applied, dry run owed or done), the §4 deferred list, and the
attribution line. Name issues in plain words on first mention.

### 2.6 Gate 1 — land on `development` (ask)
Post the raw gate numbers and the token, then ask. The founder runs:
```bash
gh pr ready <PR>
```
```bash
gh pr merge <PR> --merge
```
Wait for CI on `development`. A green CI run is evidence, not permission.

### 2.7 Gate 2 — `development` → `main` (ask again, separately)
```bash
gh pr create --base main --head development --title "Promote development to main: REZ-C company profile" --body "<gate numbers, judge token, 0105 note>"
```
The founder merges it. Never chain this onto gate 1.

### 2.8 Gate 3 — deploy (ask again, separately)
Read `.cursor/rules/sourcebd-enterprise-deploy.mdc` and
`docs/ENTERPRISE_DEPLOYMENT.md` in full first. Target `109.104.153.228` only;
never `37.49.227.151`. The founder triggers:
```bash
gh workflow run "Deploy Production" --ref main -f ref=<main SHA after gate 2>
```
It needs the GitHub "production" environment approval. Watch it with
`gh run list --workflow "Deploy Production" --limit 1`, and read the log line
`Expected production commit <sha>` — `gh run list` shows the branch, not what
shipped.

### 2.9 Migration 0105 (its own yes, only when the DB answers)
Only after §2.3's dry run ran at the CURRENT sha256 and its output is posted.
Re-check `sha256sum supabase/migrations/0105_supplier_record_v32.sql` equals
the one the dry run printed; if it moved, the approval is void. `psql` is not
installed on this machine; the command in `ops/plans/rez-c-0105-dry-run.md`
(`psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -1 -f …0105…`) is the founder's
to run where psql exists. After: add 0105 to the ledger in
`context/current-state.md` with the date and sha, and confirm read-only via
the MCP that `supplier_contact_counts` exists and `anon` cannot execute it.

### 2.10 Smoke after deploy
Browser work by `browser-harness` (signed in); navigation-only checks may use
`jev-ultrafast`. Never switch tools mid-task.
- `curl -sf https://sourcebd.net/api/health` → 200.
- `/app/suppliers/aboni-knitwear`: the sheet, eight tabs, the locked contact
  card with no email / phone / name values in the HTML.
- `/app/discover?q=knit` → click a name: the sheet opens over the results;
  tick two rows first and check the selection survives open and close.
- `/app/suppliers/aboni-knitwear/lines/6105` and `?lines=all`.
- jk-fabrics shows no women/men split; a sanctioned sample (if one exists)
  shows the banner and no live Send RFQ.

### 2.11 File the follow-ups ("check issues later")
One Linear issue per group in §4, each with a plain description and the
evidence file. Then update `context/current-state.md` (REZ-C done, one line;
detail to a new `context/archive/state-2026-sep.md`) and `active.md` in the same PR
as the deploy notes.

## 3. How the loop went, for the Judge and for the record

| Cycles | What they found | Now |
| -- | -- | -- |
| 1–6 | shell remounts, contact text in addresses, RPC args, facilities, splits | repaired |
| 7 | women/men split invented from a family total (jk-fabrics) | repaired |
| 8–12 | the contact stripper: each repair reopened a neighbouring name shape | repaired, pinned |
| 11 | a failed search re-run dropped the buyer's bulk selection | repaired |
| 12 | cycle 11 copied a surviving mutant into the source as "redundant" — reopened a leak | restored; rule: a surviving mutant gets a TEST, never the source |
| 13 | 0105 counted one phone twice (4 live records); guard over-strip hid runs; GM-as-grams in addresses | repaired in `9a715fd`, not yet re-audited |

Requirements critic accepted cycles 8, 10, 11, 12, 13. The other three have
rejected every cycle, since cycle 8 on contact-text shapes with **0 live rows**
each time. Review kits: `.claude/rez-c-review-kit/c7` … `c13` (ignored by git).

## 4. Deferred by the founder — file these, do not fix before shipping

All latent: 0 live rows today, and the population guard flags each shape for
review when one appears.
1. **Contact stripper shapes still kept or over-cut.** Kept: "(Prop.)",
   "(Proprietress)", "(Partner)", "(Chairperson)", "(Executive Director)",
   "M.D. Abdul Karim", "Director Abdul Karim", "Managing Director Karim
   Uddin", "Abdul Karim MD, Dhaka", "Karim, Proprietor", "Abdul Karim (MD)
   Plot 5", "Abdul Karim - MD. Mirpur" (left to review by design). Over-cut:
   a sentence before a name ("Plot 5, Dhaka. Abdul Karim (Owner). Mirpur" loses
   "Dhaka"), "Nur Mansion (MD)" / "Kalurghat (Chairman)" lose their place.
2. **The guard runs only by hand** (`ops/verify_contact_text.py`); nothing in
   CI runs it over live rows.
3. **0105 phones**: 15 records hold two numbers sharing their last ten digits
   ("09611949494" vs "029611949494") — not provably one number, left as filed;
   64 entries run numbers together and count as one.
4. **Anon can execute** `buyer_supplier_profile`, `buyer_supplier_facility_panel`,
   `supplier_epb_hscodes`, `rfq_create` (pre-existing; a task chip was
   raised).
5. **Cost**: opening a line in the overlay builds the whole record sheet too,
   and every open/close re-runs the search (profile ×2, hscodes ×2, workers ×3).
6. **Small UX**: a line whose read times out returns to the record with no
   message; `line=abc` stays in the URL; the report menu stays open on an
   outside click; the Certificates tab counts only the record's own
   certificates while building cards show below; after a failed EPB read a
   catalogued heading still offers Send RFQ; focus after "Open the company's
   record"; a dead ternary in `supplier-sheet.tsx`.
7. **Spec wording**: no intercepting route (`?record=` instead, reasoned in
   `discover/page.tsx`'s header); "Product list" vs "BGMEA product list";
   action-bar caption; "Capacity, as filed"; read-date range.
8. **Carried from before REZ-C**: `api_export` is not in `rl_check`'s
   allow-list, so `/api/v1/discover/export` is never rate limited;
   `test_rfq_create_sanctioned_sql.py` accepts a vague error message.

## 5. Things that trip an agent here

- The Bash tool eats backslashes in heredocs and inline scripts: `'\\b'`
  reaches Python as a backspace. Edit regex-bearing files with the Edit tool.
- `pnpm test` sits minutes on one CPU-bound suite near the end; not a hang.
- Mutation scripts in the scratchpad rewrite source files while they run and
  restore them; do not edit the same files concurrently, and check
  `git status` after.
- Auditor worktrees under `.claude/worktrees/` hold a `node_modules`
  junction: remove it with `cmd //c rmdir node_modules`, never `rm -rf`.
- Replies to the founder: five lines or fewer, plain words, issues and SHAs
  described on first mention.
