# REZ-A (the code port of the buyer dashboard v3.2 kit) — hand-off after cycle 18

Supersedes `handoff-rez-a-cycle17.md` for state and order of work.
`handoff-rez-a-cycle5.md` is still the reference for the cycle-5 findings and
for **"What this kit deliberately does not carry yet"**, which is where the
deferrals live — read it before flagging anything in the `/dev/ds` gallery as
dead or unwired; every control there is presentational by design in REZ-A's
scope. Treat `handoff-rez-a-cycle17.md` as a claim about cycle 17's own
state, not as ground truth about anything after it.

---

## Where the work stands in one paragraph

Eighteen audit cycles. The branch is `rez-a-dashboard-kit`; the head is
**`40c4094`**. Cycle 17 froze `75dcd91` and ran all four critic dimensions
against it. Two came back with nothing new (truthfulness reconfirmed one
already-recorded item; guard-adequacy found nothing). Correctness and
accessibility each found one genuine, live, currently-shipping defect — both
repaired this cycle, each with two independent guards verified RED under
revert and two mutation-harness entries verified caught by the real harness.
**Nothing is merged and no promotion has been asked for.**

---

## What the correctness critic found, and the fix

`gallery-data.ts` computed one population-derived topbar caption ("N records
on this page, read ‹range›") over the results-table screen's wider row set
— the four named test records plus up to four "extra" discovery rows that
pad the table view — then shared that single caption across all six
screens, including the four that draw only the named records and never
render the extra rows at all. Confirmed live, not theoretical: querying
`discover_suppliers` read-only via the Supabase MCP with the gallery's exact
filter arguments returned 6 non-named slugs in its top 8, and
`app/dev/ds/page.tsx` calls this against a live Supabase client (the
fixture stub is only used by the screenshot harness).

Fixed in `e5c399b` by splitting the shared computation into a `readSpan()`
helper called twice: `recordsRead`/`recordsReadOn` (the four named records
only) and `tableRecordsRead`/`tableRecordsReadOn` (the table's own wider
span). A new `tableTopbarModel()` builds the results-table screen's topbar
from the wider pair; every other screen keeps the narrower one it always
had. Two guards, both verified RED under a manual revert before being
trusted:

- `gallery-data.test.ts` — "the table's own record span covers the extra
  rows; the named span does not" (loader level).
- `dashboard-screens.test.ts` — "the table's wider record count does not
  travel to the screens that draw only the four named records" (page
  level).

Two mutation entries added (`c17-table-topbar-shares-the-named-span`,
`c17-table-span-uses-the-named-population`). The refactor inside this same
fix (renaming a variable, changing one line of JSX) went on to stale two
pre-existing anchors (`c11-read-date-is-the-newest`,
`c13-landmarks-share-an-id`) — caught immediately by the harness's own
anchor-uniqueness refusal, not by a critic, and repointed the same day
(`1ddd39f`).

## What the accessibility critic found, and the fix

The `/dev/ds` gallery renders several full, non-inert `AppShell` instances
in one accessible tree at once. Every one of them rendered
`<nav aria-label="Primary">` and a topbar `role="search"` region with *no*
`aria-label` at all — so assistive-tech users had no way to distinguish one
screen's primary nav or search region from another's, and the unlabeled
search region had no accessible name whatsoever (landmark roles take their
name only from an author-supplied label, per the ARIA spec, never from
visible text — "Name from: author"). This is the same class of collision
`mainId` was added for earlier in this project (six screens previously
shared `id="ds-main"`), extended here to landmark names.

Fixed in `d5c47f3` by giving `AppShell`/`Sidebar`/`Topbar` an optional
`screenLabel`, producing `aria-label="Primary, <label>"` and `"Quick
search, <label>"`. Every fully-exposed instance on the gallery page
(results list, results table, RFQ list) now gets a distinct label; the
three instances behind modal Stages are wrapped in `inert` and never
simultaneously exposed to assistive tech, so they're left without one.
`rfq-list.tsx`'s own `role="search"` region, which had no `aria-label` at
all, gets one directly ("Search RFQs"). Guard: `dashboard-screens.test.ts`'s
"every screen can be entered past the sidebar" test now collects every live
nav/search landmark's accessible name across all reachable frames and
asserts both a minimum count and uniqueness — verified RED by reverting one
`screenLabel` to duplicate another's ("two live navigation landmarks share
a name: ... 5 !== 4"). Two mutation entries added
(`c17-table-screenlabel-duplicates-results-list`,
`c17-topbar-search-region-loses-its-label`); a third pre-existing anchor
(`c13-landmarks-share-an-id`) went stale under the same `screenLabel`
addition and was repointed in a follow-up commit (`40c4094`).

Both fixes follow the existing codebase convention (small, per-screen model
functions; per-instance disambiguating props) rather than inventing a new
pattern.

## The other two critics: nothing new

**Truthfulness.** Reconfirmed one already-recorded, non-blocking item
(`otherExporters` unattributed constant, on the "known, recorded" list
since cycle 9). Nothing new.

**Guard-adequacy.** Nothing found this round — the tab-order backstop fixed
in cycle 17 held, and no new gap was found in this cycle's own new guards
before they were even written (the mutation sweep below is that check, run
after the fact).

One correctness finding not yet acted on: `factoryAddress()`'s null-fallback
gap. The critic recommended a one-off production check; not yet run, not
blocking, carried forward.

---

## Mutation testing — the positive control

Full sweep at `40c4094` in `/home/claude/sb-mut`: **187 entries, 187
caught, 0 survived, 0 did not compile, 0 skipped** — `mutations/sweep.log`'s
own last line, quoted verbatim. This run also re-validated all 187 anchors
(the harness refuses to start if any anchor is not exactly one match), so
it doubles as proof this cycle's diff — including the three anchors it
staled and I repointed — left nothing silently blind.

Filtered `c17-` runs also confirmed all four new entries caught in
isolation before the full sweep ran.

---

## What is in the tree

| | |
|---|---|
| Branch | `rez-a-dashboard-kit`, merge base `09ec96b` (`development`) |
| Head | `40c4094` |
| Dashboard suite | 514 tests (512 at cycle 17, +2 new) |
| Full suite | 1,118 tests (1,116 at cycle 17, +2 new) |
| Mutation harness | `scripts/mutation/mutate.py`, **187 entries** (183 at cycle 17, +4 new) |

Worktrees and the guard table are unchanged from `handoff-rez-a-cycle17.md`
— read that file for those; this one only states what moved.

**Two environment notes this cycle added to the existing ones:**

1. `scripts/mutation/mutate.py` computes `ROOT`/`OUT`/`TEST_CMD` from
   `os.path.expanduser("~/...")`. In this container `$HOME` is `/root`, not
   `/home/claude` — the worktrees live at `/home/claude/sb-mut` etc. Run it
   with `HOME=/home/claude` set (or `MUTATE_ROOT`/`MUTATE_OUT`/`MUTATE_TEST`
   set explicitly) or it refuses with a confusing "not a git worktree"
   error against a path that isn't even the one you're standing in.
2. `scripts/gallery/regen.sh`'s screenshot step needs
   `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium` in this
   container — the default lookup path
   (`chromium_headless_shell-*/chrome-headless-shell`) isn't what's
   preinstalled here. Do not run `playwright install`.

Re-confirmed from cycle 17: this container can be reclaimed after roughly
40 minutes of idle time between tool calls, killing any backgrounded
process. **Poll a long-running background job with repeated in-turn
checks, not a scheduled wake-up with a large gap.** (A mutation sweep
started against a since-superseded commit was found still alive and
correctly mid-run this cycle — the risk is real but not certain on every
long gap; don't assume either way, check.)

---

## What to do next, in order

1. **Fan out four fresh, independent critics** against the frozen SHA
   `40c4094`. Two real, repaired defects went into this cycle's diff (not a
   documentation-only change like cycle 16→17), so a full fresh audit is
   required, not skippable.
2. **If all four come back clean, go to the Acceptance Judge.** This has
   never been reached in this project's history.
3. **Then ask**, one gate at a time, per AGENTS.md 9a. Nothing here is a
   request to land, promote, or deploy.

---

## Known, recorded, and not yet done

Unchanged from `handoff-rez-a-cycle17.md` except:

- **Repaired this cycle**: the topbar caption/record-count population
  mismatch (correctness), and the duplicate/unlabeled nav+search landmark
  names (accessibility) — both above.
- **Reconfirmed, unchanged**: `otherExporters` unattributed constant
  (truthfulness); the Details-step "2/6 spec vs 1/6 code" disagreement; the
  "6 vs 3/8 product tiles" disagreement; `factoryAddress()`'s null-fallback
  gap (correctness, not yet checked against production); the sidebar
  "Suppliers" count badge vs. spec text (founder wording call).

Everything else — the boundary/non-blocking accessibility items (target
size, table captions/`scope`, `<aside role="dialog">`), the dead-code
list — carries forward unreviewed this cycle; see
`handoff-rez-a-cycle16.md`'s own list for the full text.

**Out of REZ-A's scope, flagged separately this cycle, no action taken:**
10 tables (`_snapshot_*`/`_tmp_*`/one-off analysis tables, not the
buyer-facing schema) were found fully exposed to `anon`/`authenticated`
roles with RLS disabled, via the Supabase MCP's advisories while reading
table metadata for the correctness finding above. Present the remediation
SQL to the founder and let them decide; do not auto-apply.

---

## Promotion gates — none of them has been asked for

AGENTS.md 9a: landing on `development`, promoting to `main`, and deploying
are three separate asks, and approval of one is never approval of the next.
`git push` fails in this environment — the founder pushes.

**Stop at "Ready for human review. Not merged."**
