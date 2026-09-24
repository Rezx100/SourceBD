# Hand-off: take REZ-B (the buyer search results page) to the VPS

Written 24 Sep 2026, after cycle 21. This file is the prompt for the session
that ships. `handoff-rez-b-fasttrack.md` (the fast track) and
`handoff-rez-b-cycle15.md` §5 (the gates) and §16 (cycle 21) still hold; read
those two sections there, nothing else of that file unless a finding names it.

## 0. Where things stand (verified 24 Sep, 18:30)

- Branch `rez-b-results-page`, PR [#164](https://github.com/Rezx100/SourceBD/pull/164)
  (draft, base `development`, mergeable). Code candidate **`4f6eff2`**, pushed.
  54 commits ahead of `development`, 0 behind; merge base `7ea98b4`.
- `development` is 2 commits ahead of `main`. Production runs `main` at
  `9b518c5` (Deploy Production run `35637291913`, 21 Sep): the dashboard kit
  only, the OLD search page. Nothing of REZ-B is on the VPS.
- Gate at `4f6eff2`, raw files in `.claude/rez-b-review-kit/evidence/`
  (`gate-4f6eff2…-{tsc,lint,test}.txt`, `http-4f6eff2….txt`,
  `http-mutated-4f6eff2….txt`, `proofs-4f6eff2….txt`):
  - `tsc` exit 0, no output · `next lint` exit 0 (two pre-existing warnings)
  - `pnpm test` 1456 passed / 0 failed / 217 suites, exit 0 (about 25 min;
    one CPU-bound suite near the end takes 25 min on its own — it is not hung)
  - HTTP boundary 94/94 (two new cases: a signed-in supplier gets 403 and no
    rows from the export API; proven red by `http-mutated-…`, where the mock's
    supplier answers "buyer" and exactly those two fail)
  - proofs: `mutate-c15…c22.cjs`, 115 mutations, all red
  - `pytest` 992 passed / 25 skipped / 32 failed — all 32 run a script through
    `bash -c` and are the WSL bash stub, environmental, unchanged since the
    last session · `ruff 0.15.13`: 49
  - CI run `35990993350` at `4f6eff2`: unit-tests, http-boundary, verify,
    migrations all green.
- Round 21 (reviewed `e999f79`): accessibility ACCEPTED; truthfulness,
  correctness, security, guard-adequacy each REJECTED with one major, no
  blockers. All four majors repaired in `77de51a` + `4f6eff2`, each with a
  guard proven red. Details: cycle15 hand-off §16.
- **No Acceptance Judge has run.** Round 21 was not clean, so AGENTS rule 16
  needs either a clean round 22 or the founder's written instruction to judge
  the repaired candidate as is. The founder was asked ("round 22, or ship
  with these written down?") and had not answered when this was written.
- The founder also said "the broken front end must be fixed" without saying
  what is broken. Production's signed-in search (`/app/discover?q=knit`) was
  screenshotted and looked normal: the old page, 4,645 results. The founder
  was asked whether that is the break and had not answered. Do not guess.
- Migration `0104_discover_v32.sql` is NOT applied. sha256 of the file at
  `4f6eff2`: `4f95641b7c8a1956d61d9b866373c963ec7150690afa2a46ff8b96cbbc3e8b47`.
  Without it, every signed-in search says "Search is unavailable right now".

## 1. What the founder must answer first (one message, two questions)

1. Round 22 (about an hour, five reviewers on `4f6eff2`) or judge now with
   the findings written down? Only the founder can shorten the loop.
2. Is production's search page the "broken front end", or something else?
   If something else: fix it on its own branch off `development`, its own
   small loop and gates, never folded into #164.

## 2. Then, in this order, each step asked for separately

### 2.1 Acceptance Judge
Run one Agent (`isolation: "worktree"`) as the Judge on `4f6eff2` (or the
round-22 tip). It gets the primary evidence (the gate files above, the diff
`git diff 7ea98b4 <tip>`, the five round-21 verdicts, cycle15 §15–§16's
written-down list) — never a summary. It alone returns
`ACCEPTED_FOR_HUMAN_REVIEW`. Without that token, nothing below happens.

### 2.2 Gate 1 — land on `development`
Post the raw gate numbers and the token, then ask. The founder does it:
```bash
gh pr ready 164
```
```bash
gh pr merge 164 --merge
```
(`gh pr merge` is blocked for the agent by `.claude/hooks/guard.py`.) Then
`git fetch origin` and confirm `origin/development` contains `4f6eff2`.
Also in this step, the closeout edits: `context/current-state.md` REZ-B line
→ "landed on development <sha>", `active.md` entry likewise.

### 2.3 Gate 2 — promote `development` → `main`
Ask again. Open the PR (free), the founder merges it:
```bash
gh pr create --base main --head development --title "Promote development to main: REZ-B results page" --body "<gate numbers, judge token, 0104 note>"
```
Do not chain this onto gate 1.

### 2.4 Migration 0104 — before or with the deploy, never after
Safe for the code live today: `main`'s callers of `discover_suppliers` pass
only parameters 0104 keeps, all with defaults. **Re-verify this against
`origin/main` before advising** (`git grep -n "discover_suppliers" origin/main -- lib app`).

Dry-run first (safe, needs no approval to prepare; the founder runs it at a
quiet time). Write a wrapper OUTSIDE the repo, e.g. `C:\Users\Hp\0104-dryrun.sql`:
```
begin;
\ir E:/SourceBD/supabase/migrations/0104_discover_v32.sql
rollback;
```
Founder runs:
```bash
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f C:/Users/Hp/0104-dryrun.sql
```
Post the raw output. Then, with the founder's explicit yes, the founder runs
the apply, one transaction:
```bash
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -1 -f E:/SourceBD/supabase/migrations/0104_discover_v32.sql
```
Before the apply, re-check the file's sha256 equals the one in §0. If it
moved, the approval is void. After the apply: add `0104_discover_v32` to the
ledger in `context/current-state.md` with the date and the sha256. Hazard:
`saved_searches` is `create table if not exists`; a later edit to 0104 does
not update its constraints on a re-run. Verify with the read-only Supabase
MCP: `select proname from pg_proc where proname like 'discover_v32%'` and
`select count(*) from pg_tables where tablename='saved_searches'`.

### 2.5 Gate 3 — deploy
Read `.cursor/rules/sourcebd-enterprise-deploy.mdc` and
`docs/ENTERPRISE_DEPLOYMENT.md` in full first. Target is `109.104.153.228`
only. Ask; the founder triggers (`gh workflow run` is blocked for the agent):
```bash
gh workflow run "Deploy Production" --ref main -f ref=<main SHA after gate 2>
```
The workflow needs the GitHub "production" environment approval (manual).
Watch it:
```bash
gh run list --workflow "Deploy Production" --limit 1
```
Read the log line `Expected production commit <sha>` to learn what shipped —
`gh run list` shows the branch, not the input.

### 2.6 After deploy — smoke, then the summary
Navigation by jev-ultrafast (`done` is not proof: check the final URL);
anything that must be seen by browser-harness (it is signed in; open with
`new_tab`, then `capture_screenshot(path)`; `wait_for_load()` can time out
on this site — sleep 4 s and read `page_info()` instead). Never switch tools
mid-task.
- `curl -sf https://sourcebd.net/api/health` and the same on the IP → 200
- signed out `/discover?q=knit`: a result, and no `email_primary`, `phones`,
  `contact_name`, `contact_role` in the HTML
- signed in `/app/discover?q=knit`: cards, the table view, tick a box, the
  bulk bar, bulk Save, both Exports (full and selected), the Filters stop,
  save a search
- `/app/products`, `/app/searches`; `/app/match` → `/app/discover?ask=1`
Then the deploy summary from the doc's template: ref deployed, previous SHA
from `/opt/sourcebd/.deploy/previous-sha` (the founder reads it; you never
ssh), scope, backup, CI, smoke, and the exact rollback command:
```bash
bash ops/deploy_vps.sh --ref=<previous-sha> --require-git
```
If `/api/health` fails: tell the founder to roll back with that command at
once. If a signed-in search says "Search is unavailable right now", 0104 is
not applied — the deploy went before the migration.

### 2.7 Closeout (same PR as gate 1 if possible, else a docs commit)
`current-state.md` → one "complete" line; move the closeout detail to
`context/archive/state-<period>.md` and the spec entry to
`context/archive/specs-shipped-2026.md`. `pnpm test` fails when
`current-state.md` passes 16 KB or `active.md` 6 KB — archive, never raise.

## 3. If the founder chooses round 22

Exactly as the fast track §3 step 2, on `4f6eff2`: `gen-briefs.cjs` with a
new `c22/extra.md` (focus: `git diff e999f79 4f6eff2` first — the two CI SQL
checks, the invoked-tick tests, the rewrite-growth guard, the supplier
session in the boundary mock, the saved-search cap at 6,000, the sentence
join in the bar), five reviewers in worktrees, jev-decide to sort, repair
each major as it lands with a guard proven red in `mutate-c23.cjs`. If a
worktree launch says "git metadata could not be resolved": remove that
worktree (`git worktree unlock`, `remove --force`, delete its branch) and
relaunch that one alone. Then §2.1.

## 4. Traps met this session (on top of the fast track §5)

- The boundary run fingerprints tracked AND untracked files at build start
  and end. Any tracked edit, or a proof script mutating the migration, while
  it builds makes it refuse. Sequence: edit → commit → boundary; proofs only
  when no boundary build and no `pnpm test` is running (they rewrite
  `.tests-build`).
- Never stop a `pnpm test` at ~768 green lines: that is the 25-minute
  dedup-fixture suite, not a hang.
- A killed proof script leaves its mutation in place. If one must die, wait
  for its `node` process to exit on its own (it restores in `finally`), then
  `git status` and rebuild `.tests-build`.
- In PL/pgSQL, a subquery alias that matches a declared variable (`r`)
  resolves to the variable. CI caught it at `77de51a`.
- `git check-ignore -q` takes ONE path.
- jev-decide returned identical answers (same id) for two requests fired in
  parallel from one shell line; run them one at a time.
- `ga-mutate.cjs` / `gr-mutate.cjs` are cycle-12 leftovers needing a missing
  helper; retired, not evidence.
- Two reviewer worktrees remain under `.claude/worktrees/` (harmless; prune
  before a memory-hungry `tsc`).

## 5. Written down for the founder at gate 1

Cycle15 hand-off §15 and §16 "Written down, not changed". None blocks the
deploy; each is a separate small task afterwards.

## 6. Hard limits (unchanged)

Never touch `37.49.227.151`; no `ssh`, no `rsync`; never write `.env`; never
apply a migration, run `--apply`, merge, or trigger a deploy — print the
command and stop; Supabase MCP is read-only; replies five lines or fewer,
plain words; every Linear issue, PR and SHA carries a plain description on
first mention.

## 7. Prompt for the new session (paste this)

Deploy REZ-B (the buyer search results page) to the VPS. Read
`context/feature-specs/handoff-rez-b-deploy.md` and follow it: §1 first (ask
me the two questions in one message and wait), then §2 in order, one gate at
a time, each asked for separately. Use jev-ultrafast for page navigation
checks and browser-harness for anything that must be seen. Never touch
37.49.227.151, no ssh or rsync, never write .env, never apply a migration,
never merge or deploy yourself — print the command for me. Keep every update
to five lines or fewer, in plain words.
