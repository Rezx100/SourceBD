# Start here: REZ-C — the company profile, mid-loop at cycle 2

Written 25 Sep 2026. The build is done and twice repaired; the closed loop has
not closed. This is the prompt for the session that finishes it.

## 0. Where things stand, verified

- Branch `rez-c-supplier-record`, HEAD `07f31b5`, **four commits ahead** of
  `origin/development` (`1366220`). Nothing pushed. No PR.
- `development` = `1366220`. `main` = `64c681c`. Neither has any REZ-C code.
- Migration `0105_supplier_record_v32.sql` is **NOT applied**. sha256 (CRLF)
  `0edbaf6a0f81a33320cdf4b21757104ef56c1395f591a944b4fa50c8afe769b0`.
  Evidence and the founder's command: `ops/plans/rez-c-0105-dry-run.md`.
- The working tree holds one untracked file that is the founder's and is not
  ours: a `.mp4` in the repo root. Every commit so far excluded it
  (`git add -A ':!*.mp4'`). Keep doing that.

The commits:

| SHA | What |
| -- | -- |
| `e853d67` | the REZ-C hand-off doc (carried from the REZ-B branch) |
| `b1c33fe` | the build |
| `427f22c` | repairs from audit cycle 1 |
| `07f31b5` | repairs from audit cycle 2 |

## 1. What REZ-C now is

`/app/suppliers/[slug]` is the dashboard kit's `SupplierSheet`. The same
component opens over the results as `/app/discover?record=<slug>`, and a
product line opens as `&line=NNNN` on that same URL — so drilling in never
costs the buyer their search or their bulk selection. `?lines=all` expands the
six-tile grid to every heading. `/app/suppliers/[slug]/lines/[hs]` is the line
as its own page, for deep links.

The sheet has eight sections, all of them real: Overview, Products,
Certificates, Safety, Sources, Locations, Facilities (REZ-73's roll-up is not
landed, so it says the buildings are not on the record yet — never that there
are none), RFQs. A sanctioned record gains a ninth, Sanctions matches, and the
banner links to it.

Migration `0105` adds **one** function, `supplier_contact_counts`. Five of
§4.3's six items are deliberately absent, each with a reason checked against
production and written into the migration header and the evidence report.
§4.5 needed no change: `rfq_create` already refuses a sanctioned target.

## 2. The loop state — this is the important part

`.cursor/rules/sourcebd-closed-loop.mdc` governs. **No Acceptance Judge has
run. The token has not been issued. This work is not done.**

Two full audit cycles have run:

- **Cycle 1** against `b1c33fe`: four critics, all REJECT. Repaired in
  `427f22c`.
- **Cycle 2** against `0e50aa9` (the tree at that point): the requirements and
  adversarial critics returned, both REJECT. **The invariant auditor and the
  test-adequacy critic both died on an API error and never reported.**
  Repaired in `07f31b5`.

So cycle 2 is incomplete, and cycle 3 has not started.

### What cycle 2 taught, and why it matters for how you run cycle 3

Both cycle-2 blockers were defects *in the cycle-1 repairs*, not in the
original build:

- The `inert` wrapper added for accessibility switched between a Fragment and
  a `<div>`, which remounts the React subtree — silently emptying the bulk
  selection, which is the exact thing the sibling repair existed to protect.
- The link repair fixed the two links the finding named and left four
  siblings. One of them hardcoded the full-page URL in the very function that
  had just gained the option to keep the search.

Treat a repair as new code that has never been audited, because it is.

## 3. What to do, in order

### a. Finish cycle 2's audit
Re-run the **invariant auditor** and the **test-adequacy critic** against the
current HEAD. They never ran, so nobody has checked this candidate's
invariants or the adequacy of its guards. The prompts used for them are worth
reconstructing from §8 of the closed-loop rule; the cycle-1 versions of both
found real, distinct defects (the Sources count contradiction on 69 records;
the tautological guard; the confounded SQL experiment).

### b. Run a complete cycle 3
All four roles against one frozen SHA, with a fresh evidence bundle: the diff
against `1366220`, the repair diff since `0e50aa9`, raw output from all four
verification commands, and the 0105 dry run. Hide conclusions, not evidence —
never send a critic your account of what you fixed.

### c. Then the Acceptance Judge
Only it may return `ACCEPTED_FOR_HUMAN_REVIEW`.

### d. Then the three gates, one at a time
Land on `development`; then ask again for `main`; then ask again for the
deploy. Never chain them. The migration goes **before or with** the deploy.

## 4. Verification gate — current numbers

`CLAUDE.md`'s baselines were re-measured during this work; the old ones
described a repo from four months earlier and blamed 31 failures on the wrong
cause. **They need re-measuring once more at the final SHA** — the numbers now
written there (1,479 tests / 223 suites) are from before cycle 1 added tests,
and the adversarial critic was right to call that out as a gate that is wrong
on the commit that writes it.

Last full runs, at `0e50aa9`:

| Command | Result |
| -- | -- |
| `pnpm exec tsc --noEmit` | clean |
| `pnpm exec next lint` | 0 errors |
| `pnpm exec next build` | compiles |
| `pnpm test` | 1,539 tests / 234 suites — 1,538 pass, **1 fail** |
| `ruff check etl ops --no-cache` | 49 on ruff 0.15.13 — at baseline |
| `python -m pytest -q etl/tests` | 1,009 passed, 42 failed, 6 skipped |

At `07f31b5` only the REZ-C subset has been run: **392/392**. `pnpm test` and
`pytest` have NOT been run since. Run them.

The one `pnpm test` failure is **pre-existing and not REZ-C's**:
`lib/rate-limit/limits.test.ts` — `api_export` is not in `rl_check`'s
allow-list, so `/api/v1/discover/export` is never rate limited. REZ-B added
the class without the migration. Verified identical at `1366220`. A separate
task is queued for it.

The 42 pytest failures are all environmental and pre-existing — the merge base
fails 48 of the same. Causes are in `CLAUDE.md`. The 6 skips are this PR's own
`test_supplier_contact_counts_sql.py`, which cannot run until 0105 is applied;
`ops/verify_0105_guards.py` proves its five assertions pass inside a
rolled-back transaction.

## 5. Open findings nobody has resolved

From the cycle-2 requirements critic, still outstanding:

- **§3.3's "more (Report a problem → existing feedback endpoint)" is absent
  and undeclared.** Worth knowing before you decide: `POST /api/v1/feedback`
  exists and `components/feedback/feedback-mount.tsx` exists, but the widget
  **is mounted nowhere in the app** — Phase 7 shipped it orphaned. So "the
  existing feedback endpoint" has no live control anywhere. Either wire the
  control, or declare it and raise the orphaned widget separately.
- The `exporters` rename ("Other exporters of 6105 · 1,633" →
  "Exporters of 6105 · 1,634") is a truth repair — the old count contradicted
  the search the button opens, and the founder's rule of 24 Sep says a
  products count equals its search. But it renames what §3.4 names, and the
  founder has not ratified it.
- Five of §4.3's six items omitted, and `/app/compare`'s deferral, are
  declared but unratified.

## 6. Declared, not built — the founder should know

Written into `context/current-state.md`:

- The **Barikoi map** on Locations and §3.3's **"Map pin"** fact row. Both
  need the old design system's `LocationsSection`, which the rebuild spec puts
  off-limits. The Locations section lists every premises with its marks and
  merged spellings; it has no map.
- **`/app/compare`** — §7 assigns it to REZ-C; the hand-off's own scope does
  not. The action bar renders it explicitly disabled with the reason.
- **§3.5's 10-minute `discover-facets` cache** on `hs_catalogue()`.
  `/app/products` shipped with REZ-B and still pays a 316 ms function scan per
  view.
- The **admin-only contact unlock** the replaced page had. The approved record
  card is counts-only, and an admin reveal inside the one page whose boundary
  test is "no contact value in the HTML" would make that guard conditional. It
  belongs on `/admin/suppliers/[id]`, which has no contact view today.

## 7. Two traps this session hit, so you do not

1. **`\b` written through a shell heredoc becomes a literal BACKSPACE (0x08).**
   It cost four debugging rounds here, and it silently disabled a committed
   REZ-B assertion that had never been able to fail. Write regexes with the
   Write/Edit tools, not through `python - <<'PY'`. Scan with:
   `grep -rlP '[\x00-\x08\x0b\x0c\x0e-\x1f]' --include=*.ts --include=*.tsx .`
2. **`next/link` renders `<a>` in a server component**, so no rendered-HTML
   test can tell a client navigation from a full page load. That is why
   `components/dashboard/links.test.ts` reads source, and why it must stay.

## 8. Hard limits (unchanged)

Never touch `37.49.227.151`; no `ssh`, no `rsync`; never write `.env`; never
apply a migration, run `--apply`, merge or deploy — print the command and
stop. Supabase MCP is read-only. Replies five lines or fewer, plain words.
Every Linear issue, PR and SHA carries a plain description on first mention.

## 9. Prompt for the new session (paste this)

Finish REZ-C — the company profile (supplier record sheet and product line).
The build is done and twice repaired on branch `rez-c-supplier-record` at
`07f31b5`; the closed loop is open. Read
`context/feature-specs/handoff-rez-c-cycle2.md` first, then `AGENTS.md`, the
lean boot set and `.cursor/rules/sourcebd-closed-loop.mdc`. Re-run the full
verification gate at the current HEAD and write the real numbers into
`CLAUDE.md`. Then run a complete audit cycle — all four roles against one
frozen SHA, with an evidence bundle and none of the previous session's
reasoning — repair whatever they find, and keep looping until a separate
Acceptance Judge returns `ACCEPTED_FOR_HUMAN_REVIEW`. Treat every repair as
unaudited new code: both of cycle 2's blockers were defects in cycle 1's
fixes. Then ask me for each of the three gates separately. Never apply the
migration, merge or deploy yourself — print the command for me. Keep every
update to five lines or fewer, in plain words.
