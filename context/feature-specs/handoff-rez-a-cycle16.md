# REZ-A (the code port of the buyer dashboard v3.2 kit) — hand-off after cycle 16

Supersedes `handoff-rez-a-cycle11.md` for state and order of work, and that
file's "what to do next" is done. `handoff-rez-a-cycle5.md` is still the
reference for the cycle-5 findings and for **"What this kit deliberately does
not carry yet"**, which is where the deferrals live. Read both. Treat
`handoff-rez-a-cycle11.md` itself as a claim about cycle 11's own state, not
as ground truth about anything after it — this file re-verifies rather than
assumes.

---

## Where the work stands in one paragraph

Sixteen audit cycles. The branch is `rez-a-dashboard-kit`; the head is
**`3ff61ae`**. Cycles 12–16 found and repaired thirteen more blocking
findings (five from independent critics, four from a correctness/spec
critic run for the first time since cycle 10, four from a mutation sweep
run to completion for the first time ever), every one with a guard watched
failing under its own revert. All four gates are green on a clean checkout
of the frozen SHA. **Nothing is merged and no promotion has been asked
for.** The loop still has not reached an Acceptance Judge — see "What to do
next" below; that is the immediate next step, not yet taken.

---

## The two things to understand before changing anything

### 1. A guard whose oracle comes from the thing under test — six times now

This is the cycle-9/10/11 lesson and it kept paying out through cycle 15.
Every instance so far: an assertion that requires the exact broken
markup/string to keep existing, so the *correct* repair fails the suite.
Found and fixed: `role="checkbox" tabindex="0"` asserted as keyboard support;
bare `href="#"` skipped as inert; `length >= 10` counted over named `<svg>`
elements instead of the underlying affordance; a literal
`shadow-[inset_...]` string and a literal `<div inert>` string asserted
instead of the property each represents; `aria-current="step"` checked but
no other state-carrying attribute; a state-indicator contrast check that was
a **prefix match** (`--ds-brand` matched `--ds-brand-tint`, 7.87:1 read as
1.07:1).

**A cycle-16 addition to this list, found by a completed mutation sweep
rather than a critic:** a guard can also fail by matching **nothing at all**,
which is quieter than matching the wrong thing because it never shows up in
a diff of the assertion. Four instances, all shipped in earlier cycles and
all silently inert since:

- `dashboard-screens.test.ts`'s "a named `<svg>` with no role" sweep scans
  for `<svg ... aria-label="...">` — but nothing in the gallery renders an
  `<svg>` with `aria-label` directly on it (labelled icons go through
  `marks.tsx`/`photo-tiles.tsx`, which use `<span>`). Zero matches, every
  run, regardless of whether `icons.tsx`'s own `role="img"` branch works.
- The heading-order check in the same test (`levels[i] <= levels[i-1] + 1`)
  was gated behind `if (modal) { ...; continue; }` — so it never ran on any
  of the three sheet screens, which is exactly where a heading-hierarchy
  break would land.
- The "two landmarks share an id" check in the same test compared ids
  **within one screen's own frame**, never across the six frames the
  gallery actually renders side by side — so the historical bug it was
  written for (all six landing on `id="ds-main"`) could not have failed it.
- Every `topbarCaption` test checks the clause's wording, never which
  screens carry it, so hardcoding `drawsRecords = true` (putting "N records
  on this page" on the RFQ list, which draws none) passed everything.

**Count the affordance the fix produces, and prove the check can fail before
trusting that it passed.** A page-level sweep with an early `continue`, a
`.matchAll` that can return zero results, or a per-item comparison where the
real defect is cross-item are the three shapes this took this cycle.

### 2. A commit made from a tree something else is rewriting

Unchanged from cycle 11 — carried forward because the fix is structural and
still load-bearing, not because anything regressed. Three commits early in
this branch's history shipped live mutants because a sweep was rewriting the
same tree a commit was being made from. Both classes (committing from a
tree under mutation, and a sweep running anywhere but its own worktree) are
structurally refused now — see the worktree layout below and
`scripts/mutation/mutate.py`'s four refusals.

---

## What is in the tree

| | |
|---|---|
| Branch | `rez-a-dashboard-kit`, merge base `09ec96b` (`development`) |
| Head | `3ff61ae` — the mutation-sweep gap fixes below; audited by that same sweep, in progress as of this writing (see "What to do next") |
| Size | 162 files, +17,948 / −131 against the merge base, 30 commits |
| Dashboard suite | 512 tests, ~38–41 s — `scripts/mutation/dash-test.sh <root>` |
| Full suite | 1,116 tests, ~12–13 min on this container's 2 vCPUs |
| Lint | 14 warnings, the baseline; none in the kit's own directories |
| Mutation harness | `scripts/mutation/mutate.py`, **182 entries**, all in-repo now (moved from a loose script this cycle) |

### Worktrees on the container

Four, and the separation matters — it is the fix for cause 2 above.

```
/home/claude/sb        the branch; the ONLY tree you commit from
/home/claude/sb-cand   a detached worktree; run the gates here, on the frozen SHA
/home/claude/sb-mut    a detached worktree; the mutation sweep runs here and nowhere else
/home/claude/sb-base   a detached worktree at 09ec96b
```

`node_modules` is hardlinked between them (`cp -al`), so a worktree costs
nothing. **Never run a mutation sweep in `/home/claude/sb`.** Running the
plain test suite there to check a fix before committing is fine and was done
routinely this cycle — it is a *sweep* (rewrites source files under a
`MUTATE_ROOT`) that must never share a tree with a commit in flight.

---

## What to do next, in order

1. **Let the in-flight mutation sweep finish and read its own last line.**
   Frozen at `3ff61ae`, running in `/home/claude/sb-mut`, log at
   `/home/claude/gate/mutations/sweep-c16.log`. Started clean (0 survivors
   for the first ~25 entries when this was written); this container's 2
   vCPUs make the full 182-entry sweep take roughly two hours end to end.
   **Quote its own last line, never a hand-written number** — that line has
   been wrong to trust before (a filtered run that matched zero entries used
   to print a clean-looking "0/0/0/0" until cycle 15 added a warning for it).

2. **If it finishes clean (182 caught, 0 survived, 0 did not compile):**
   assemble the evidence bundle at `3ff61ae` (screenshots, diffs, SQL,
   mutation log) and fan out fresh, independent critics against the frozen
   SHA — truthfulness-against-production, the accessibility/UX boundary,
   guard-adequacy, and correctness/spec-conformance. All four dimensions
   have now been run at least once (correctness was reintroduced this cycle
   after a five-cycle gap; see below), but not all four *together* against
   one candidate since cycle 11. If all come back clean, go to the
   Acceptance Judge. This has never been reached — do not assume a clean
   critic pass is the same thing as it.

3. **If the sweep finds a new survivor:** it is a real gap (every survivor
   found this way so far has been real, never a bad mutation — except the
   one `NOCOMPILE`, see below). Repair it the same way as a critic finding:
   fix, add or repair the guard, verify red under revert, verify green
   restored, commit, then restart the sweep at the new SHA rather than
   trusting the stale run.

4. **Then ask.** AGENTS.md 9a: landing on `development`, promoting to `main`
   and deploying are three separate asks. None has been requested or given.

---

## What changed this cycle (12 through 16), for anyone diffing against cycle 11

- **The composer's rail, footer and preview now read one `missing` list**
  instead of three hand-written literals that could not all be right (cycle
  11's own finding, closed cycle 12) — then that list was found to track
  only four of the spec's six Details fields (`design/dashboard-ux-flow.md`
  §6: name, reply-by date, incoterm, destination, currency, attachments).
  Currency and attachments have no source anywhere in the sample draft, so
  both are carried as missing rather than invented.
- **State is drawn, not only announced**: the current nav item, the pressed
  segmented control, the sanctioned table row and the active RFQ step all
  gained a real ≥3:1 indicator (a `shadow-[inset_...]` rail in the specific
  token actually used, extracted and checked per-instance rather than
  assumed to be `brand`).
- **A modal's background is genuinely inert** (`<div inert>` wrapping the
  shell `Stage` renders behind a sheet or the composer), not merely covered
  by a scrim, and each screen has its own `mainId` instead of six landmarks
  sharing `id="ds-main"`.
- **`placeOf()`** (build-models.ts) stopped silently preferring a resolved
  address over the supplier's own city/district columns — that would have
  moved 5 of 12 fixture records to a head-office locality — and now falls
  back to the address only when both columns are empty.
- **`formatDayRange()`** (facts.ts) replaced three independent
  `Math.max`-shaped "read date" computations (topbar, sheet header, RFQ
  screen) that each stated a maximum as if it were a population fact.
- **The icon test stub renders real `<svg>` markup** instead of `null`,
  which is what let the four cycle-16 gaps above hide for as long as they
  did — nothing could see icon markup to check it.
- Full detail, including the four cycle-16 gaps and the six pinned-defect
  instances, is in the commit log between `659f48e` and `3ff61ae`; every
  commit message states what it found and how it was verified.

---

## How to work in this environment

Nothing builds on the founder's machine (pnpm junctions fail through the
mount, no registry access), so the source is snapshotted into a container.
**Node 22, not 20.**

```
export PATH=/opt/node22/bin:$PATH
cd /home/claude/sb

scripts/mutation/dash-test.sh /home/claude/sb        # 512 tests, ~38-41 s — the loop
pnpm exec tsc -p tsconfig.npm-test.json              # exit 0, no output
pnpm test                                            # ~12-13 min on 2 vCPUs, 1,116 tests — run backgrounded, it will not finish inside a 9-10 min foreground timeout here
pnpm exec next lint                                  # 14 warnings is the baseline

MUTATE_ROOT=/home/claude/sb-mut MUTATE_TEST=/home/claude/sb/scripts/mutation/dash-test.sh \
MUTATE_OUT=/home/claude/gate/mutations \
  python3 scripts/mutation/mutate.py                 # the whole sweep, ~2h on this container
                                                      # pass a substring as argv[1] to filter to one family

PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  ./scripts/gallery/regen.sh
```

**Run both `pnpm test` and a mutation sweep in the background and poll** —
this container has 2 vCPUs, so the two compete and either alone can exceed a
9-10 minute foreground command timeout even when nothing is wrong.

`git push` fails — `origin` here is the snapshot bundle, not GitHub. The
founder pushes.

Production is read-only through the Supabase MCP `execute_sql`, project
`stnrfxrxfonwexzcvvpv`. The container cannot reach Supabase over the
network, so the page renders from fixtures.

### Traps this environment has set

- **Never run a sweep in the tree you commit from.** The harness refuses
  now (dirty tree, wrong tree, and a red baseline are all refused), but the
  three commits that caused this are in the log.
- **A `.matchAll`/`for` loop over zero matches passes silently.** This
  cycle's whole lesson (§1 above). When adding a page-level sweep, prove it
  can fail — apply the defect it is meant to catch and watch it, don't just
  trust the assertion reads correctly.
- **An `if (modal) { ...; continue; }` branch can look like a narrower
  version of the same check and actually be "skip the check."** The
  heading-order gap this cycle was exactly this shape.
- **A within-item comparison cannot catch a cross-item defect.** The
  landmark-id gap this cycle: comparing ids inside one screen's frame
  cannot ever notice that two *different* screens share an id.
- **An anchor goes stale the moment you repair the line it points at**, and
  a duplicated anchor is worse than a stale one. The harness refuses both.
- **A mutation that renames a destructured parameter can trip TypeScript
  before any test runs (`NOCOMPILE`).** That is not a guard catching
  anything — it means the mutation entry itself doesn't test what it claims
  to. `c13-landmarks-share-an-id` was this shape; it was rewritten this
  cycle to mutate an actual call site instead.
- **This container has 2 vCPUs.** A mutation sweep and `pnpm test` running
  at once roughly double each other's wall time. Don't read a slow run as a
  hang; check `ps aux` for competing processes before assuming something is
  stuck.

---

## The guards, and what each is for

Carried forward from cycle 11 with this cycle's additions marked **(c16)**.

| file | what it holds |
|---|---|
| `.github/workflows/ci.yml` | `pnpm test` on Node 22. Before cycle 11, no CI check ran the suite at all. |
| `scripts/mutation/mutate.py` | The positive control, 182 entries, and four refusals: the tree you commit from, a dirty worktree, an anchor that does not appear exactly once, a red baseline. Now in-repo (was a loose script through cycle 11). |
| `fixtures.test.ts` | every field of every row against the checked-in production read, plus: no invented URL host, no shared id, no sanctioned real company, every building name exported, every source code ranked |
| `build-models.test.ts` | the builders, the attribution rules, the register labels, the Locations dedupe, the RFQ row's shapes, the certified scope with a total ordering, **order-invariance** for the factory address, and the columns-first place resolver |
| `render.test.ts` | the boundary — rendered HTML for every screen, the sanction, the long name, ARIA state, unread-is-not-zero, the named meter, **(c16) `Icon`'s own labelled/decorative contract, direct**, **(c16) the sheet's h1/h2 hierarchy, direct** |
| `dashboard-screens.test.ts` | the composition layer, plus page-level sweeps over all six screens at once: no absolute negative over unread registers; no denominator that is not a count of registers holding records; no inert control in the tab order; an action name must be on something actionable; nothing announced unavailable may stay focusable; every screen must be enterable past the sidebar — **(c16) heading order now checked inside modal dialogs too, not skipped**, **(c16) landmark-id uniqueness now checked across the whole gallery page, not just within one frame**; **(c16) the gallery must draw >100 real icons**; **(c16) the RFQ list screen must not carry the "records on this page" clause**; **the Details step must name all six of the spec's fields, not a subset that agrees with itself** |
| `harness.test.ts` | the screenshot harness, that it and the page call the loader identically, and that importing it renders nothing |
| `tokens.test.ts` | the token file: contrast pairs at the threshold each use needs, the ramp, the density stops, the type scale, the radius scale |
| `gallery-data.test.ts` | the loader: RPC argument names, the RFQ aggregation, unknown-vs-zero on every failed read (including NaN/Infinity, a cycle-14 gap), every not-a-count shape, and the read-date range |
| `test-stubs/phosphor-icons-react.cjs` | renders real `<svg>` markup (fixed cycle 11) — which is what made the cycle-16 icon gaps visible enough to find at all |

---

## Known, recorded, and not yet done

From the cycle-10/11 critics, **not independently reverified this cycle**
except where noted. Treat this list as a starting point for the next audit
pass, not as current fact — some entries may already be stale.

**Resolved since cycle 11** (moved out of the open list; kept here so a
future reader doesn't re-file them):
- The composer rail's "2/6" and hand-written missing-fields literals —
  fixed cycle 12, then found to still be short two fields — fixed cycle 16.
- The state-indicator contrast gaps and the modal's live background — fixed
  cycles 13–14.
- The topbar/sheet/RFQ "maximum stated as a range" caption shapes — fixed
  cycle 14, via the shared `formatDayRange` helper.

**Truthfulness, latent or cosmetic — not reverified this cycle**

- Three denominators are constants that are correct today —
  `SOURCES_WITH_RECORDS = 14`, `CERT_REGISTERS = 4`,
  `BRAND_LISTS_WITH_RECORDS = 4`. The day a new source files its first
  record, every "N of 14 sources read" on the site becomes a negative the
  data does not support, silently, with a green suite. Derive them from a
  read, or gate the constant against a live count.
- The RFQ list's "SENT" column prints `created_at`; `rfqs` has no `sent_at`.
- `certScheme` title-cases: "OEKO-TEX Made In Green" where the scheme is
  MADE IN GREEN (71 certificates, as of the cycle-11 count).
- ≤622 published all-caps names carry a 2–3 letter token that is neither a
  word nor in `KEEP_UPPER`: "HKD INTERNATIONAL" → "Hkd International".
- `lib/hs-catalogue.ts`'s `otherExporters` is an unattributed build-time
  constant on a screen whose rule is that every number traces to a
  register.

**Boundary, not blocking — not reverified this cycle**

- **Target size.** 85 interactive targets under 24 px as of cycle 11; not
  rechecked since. `spec-M6` commits the marketing surfaces to 2.2 AA —
  someone should settle which bar applies to the dashboard.
- **`<aside role="dialog">`** is not a permitted ARIA role for `aside` (2
  nodes).
- **The topbar's `role="search"` contains no search facility** — unreachable
  by keyboard, on all six screens.
- **Tables** carry no `<caption>` and no `scope="row"`.
- `hs-photos.test.ts` compares `rarestFirst` against its own output.
- `tierFromSlug()` is dead: the kit ranks from a hardcoded `REGISTRY` while
  production ships a tier on every provenance row. No mismatch across all
  12 fixtures as of cycle 11.
- Dead code as of cycle 11: `formatMonth()`, `buildRfqRow`'s discarded
  `today`, `hsShortLabel`'s second parameter, `gallery-data.ts`'s
  `toast: null` and the `Toast` it feeds. The cycle-16 correctness critic
  did not re-find these, but was not specifically asked to re-check a list
  it hadn't seen — worth a targeted look next cycle.
- The sheet's `summary` is `null` unconditionally, so `design/dashboard-ux-flow.md`
  §4's "summary paragraph" is simply absent; `LockedTable` for saved report
  files is absent too, and neither is on the deferral list.
- Card and sheet render 6 product tiles where the flow doc says 3 and 8; the
  render and the doc disagree — someone should settle which is authoritative.

---

## Promotion gates — none of them has been asked for

AGENTS.md 9a: landing on `development`, promoting to `main`, and deploying
are three separate asks, and approval of one is never approval of the next.
`git push` fails in this environment — the founder pushes.

Committing locally is free. Landing is not.

**Stop at "Ready for human review. Not merged."**
