# Hand-off: production is running REZ-B without its migration

Written 25 Sep 2026, after the deploy session. Supersedes
`handoff-rez-b-deploy.md`, whose §1–§2.3 are now done. Its §2.4 (the
migration), §2.6 (the smoke run) and §2.7 (closeout) are what remain, and
they are restated here with the live numbers. Read this file and
`handoff-rez-b-cycle15.md` §15–§16; nothing else of the older files unless a
finding names it.

## 0. The one thing that matters

**Production serves the REZ-B results page, and migration `0104` is not
applied.** Every signed-in search on the live site fails. The public
`/discover` page is unaffected and works.

Verified 25 Sep against the live database (read-only Supabase MCP) and the
live site:

| Check | Result |
| -- | -- |
| `select count(*) from pg_proc where proname like 'discover_v32%'` | `0` — none of the new helpers exist |
| `select count(*) from pg_tables where tablename='saved_searches'` | `0` — the table does not exist |
| `discover_suppliers` overloads / arity | `1` / `16` args — still 0076's signature, not 0104's 25 |
| `https://sourcebd.net/api/health` | `200`, `commit: 1780c2ca8a7dc92d080fee855a68b4527efdea3e` |
| `https://sourcebd.net/discover?q=knit` | `200`, 24 supplier results, no `email_primary` / `phones` / `contact_name` / `contact_role` in the HTML |
| signed-in `/app/discover?q=knit` | **NOT SEEN** — Chrome refused remote debugging during the session; expected to read "Search is unavailable right now". Verify it before and after the apply. |

## 1. Where the code is (all verified 25 Sep)

- `main` = `1780c2c` (merge of PR [#165](https://github.com/Rezx100/SourceBD/pull/165),
  the promotion of the results page to main). Contains `4f6eff2`.
- `development` = `cfbbf4a` (merge of PR [#164](https://github.com/Rezx100/SourceBD/pull/164),
  the buyer search results page). CI green on all four jobs at both.
- Deployed: `1780c2c`, by Deploy Production run `36035938232`
  (ref `main`, success, 3m45s). An earlier run `36034971555` (ref
  `development`) shipped the same expected commit eight minutes before it.
  Both log `Expected production commit 1780c2ca8a7dc92d080fee855a68b4527efdea3e`;
  `/api/health` agrees. Target host `109.104.153.228` only.
- Acceptance Judge on `4f6eff2`: `ACCEPTED_FOR_HUMAN_REVIEW` (25 Sep). It
  reverted each of the four round-21 repairs in its own worktree and
  confirmed the named guard turned red for each. Gates at `4f6eff2`:
  `tsc` exit 0 · `next lint` exit 0 (two old warnings, untouched files) ·
  `pnpm test` 1456 passed / 0 failed / 217 suites, exit 0 · HTTP boundary
  94/94 · `mutate-c15…c22.cjs` 115 mutations all red · `pytest` 992 passed /
  25 skipped / 32 failed (all 32 are the WSL `bash -c` stub, environmental) ·
  `ruff 0.15.13` 49 findings. Raw files in
  `.claude/rez-b-review-kit/evidence/`.

## 2. Step one — apply `0104`, at a quiet moment

The file: `supabase/migrations/0104_discover_v32.sql`. sha256 on disk (CRLF):
`4f95641b7c8a1956d61d9b866373c963ec7150690afa2a46ff8b96cbbc3e8b47`. **Re-check
it before the apply; if it moved, the approval is void.**

Safe for the code now live: `main`'s three callers of `discover_suppliers`
pass 16 parameters; 0104 keeps all 16 with the same names, types and order and
adds nine that default. Every column the live cards read is still returned.
`p_exclude_sanctioned` defaults to `true`, matching 0076's unconditional
exclusion, so nothing shifts for the pages already live. 0104 drops every
prior `discover_suppliers` signature before recreating, so the return-shape
change is legal. Re-verify with
`git grep -n "discover_suppliers" origin/main -- lib app` before advising.

The founder runs both. The agent runs neither.

Dry run (wrapper already written, outside the repo, at `C:\Users\Hp\0104-dryrun.sql`):
```bash
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f C:/Users/Hp/0104-dryrun.sql
```
Then, with the raw output posted and an explicit yes, one transaction:
```bash
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -1 -f E:/SourceBD/supabase/migrations/0104_discover_v32.sql
```

Hazard: `saved_searches` is `create table if not exists`, so a later edit to
0104 does not update its constraints on a re-run.

Confirm afterwards with the read-only Supabase MCP — the same four counts as
§0, which must become: helpers > 0, `saved_searches` = 1, `discover_suppliers`
arity 25.

Then add the ledger row in `context/current-state.md` — the row is already
there marked "NOT APPLIED"; change it to the date and the sha256.

## 3. Step two — the smoke run

No deploy is needed after the migration: the code is already live. Navigation
by jev-ultrafast (`done` is not proof — check the final URL); anything that
must be seen by browser-harness. If Chrome refuses, the founder clicks Allow
at the `chrome://inspect/#remote-debugging` prompt. Never switch tools
mid-task.

- `curl -sf https://sourcebd.net/api/health` and the same on the IP → 200
- signed out `/discover?q=knit`: a result, and no `email_primary`, `phones`,
  `contact_name`, `contact_role` in the HTML
- signed in `/app/discover?q=knit`: cards, the table view, tick a box, the
  bulk bar, bulk Save, both Exports (full and selected), the Filters stop,
  save a search
- `/app/products`, `/app/searches`; `/app/match` → `/app/discover?ask=1`

Then the deploy summary from `docs/ENTERPRISE_DEPLOYMENT.md`'s template: ref
deployed (`1780c2c`), previous SHA from `/opt/sourcebd/.deploy/previous-sha`
(the founder reads it; the agent never ssh's), scope, backup, CI, smoke, and
the rollback command:
```bash
bash ops/deploy_vps.sh --ref=<previous-sha> --require-git
```
If `/api/health` fails at any point: roll back with that command at once.

## 4. Step three — closeout

In the PR this file arrives in, or a follow-up:
`context/current-state.md` REZ-B line → one "complete" line; move the closeout
detail to `context/archive/state-<period>.md` and the spec entry to
`context/archive/specs-shipped-2026.md`. `pnpm test` fails when
`current-state.md` passes 16 KB or `active.md` 6 KB — archive, never raise.

## 5. Written down, not changed — the follow-up list

None blocks anything live; each is a separate small task. From cycle 20 (§15),
cycle 21 (§16) and the judge:

- The stale line "Selection arrives with the results work" is still on the RFQ
  list page, where it now reads as untrue. **Smallest and most visible; do
  this one first.**
- The public search page's new length caps, and the announcement when the
  selection empties, have no automatic check behind them. Both fail quietly.
- `production_workers_display_batch` answers for an unpublished supplier to a
  caller who already knows its internal id (an older gap, not introduced by
  REZ-B), and takes any number of ids.
- The topbar's supplier count leaves out sanctioned suppliers without saying so.
- Values over the app's caps are dropped without a notice; with nothing
  selected an outcome message stays until the next edit, with no dismiss; a new
  search, sort or page remounts the bar, so a save still running is not
  reported.
- `sbi_total` is a tie-breaker in the anon-callable search ordering, inherited
  verbatim from 0076. The comment on `discover_v32_assert_bounded` reads as if
  every value is bounded; equality-compared lists are not, and need not be.
- Accessibility, none blocking: nothing is announced when the selection empties
  (A11Y-3); a Space keyup toggles a box the keydown did not land on (A11Y-4);
  two published suppliers sharing a name would share a box label, none today
  (A11Y-5); the table's "Registers & certifiers" figure sits beside marks that
  include brand lists (A11Y-7) and the header departs from the spec's
  "Sources".
- `Q_MAX` slices before lower-casing, so 120 dotted capital I's become 240
  characters and a refused search (contrived); the export counts ids before
  dedup (unreachable from the bar).
- `.gitignore` changed from `node_modules/` to `node_modules` inside this
  feature's diff. Harmless, unrelated, revert when convenient.

## 6. Hard limits (unchanged)

Never touch `37.49.227.151` (pixelsport-backend, unrelated apps); no `ssh`, no
`rsync`; never write `.env`; never apply a migration, run `--apply`, merge, or
trigger a deploy — print the command and stop. Supabase MCP is read-only.
Replies five lines or fewer, plain words. Every Linear issue, PR and SHA
carries a plain description on first mention.

## 7. Prompt for the next session (paste this)

Production is running the REZ-B results page (`main` at `1780c2c`) but
migration `0104` was never applied, so signed-in search is broken. Read
`context/feature-specs/handoff-rez-b-live-migration.md` and follow it: §2
first — print me the dry-run command, wait for my output, then print the apply
and wait for my yes. Then §3, the smoke run, and §4 closeout. Use jev-ultrafast
for page navigation checks and browser-harness for anything that must be seen.
Never touch 37.49.227.151, no ssh or rsync, never write `.env`, never apply a
migration or deploy yourself — print the command for me. Keep every update to
five lines or fewer, in plain words.
