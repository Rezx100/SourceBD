# REZ-A (the code port of the buyer dashboard v3.2 kit) — hand-off after cycle 17

Supersedes `handoff-rez-a-cycle16.md` for state and order of work.
`handoff-rez-a-cycle5.md` is still the reference for the cycle-5 findings and
for **"What this kit deliberately does not carry yet"**, which is where the
deferrals live — read it before flagging anything in the `/dev/ds` gallery as
dead or unwired; every control there is presentational by design in REZ-A's
scope. Treat `handoff-rez-a-cycle16.md` as a claim about cycle 16's own
state, not as ground truth about anything after it.

---

## Where the work stands in one paragraph

Seventeen audit cycles. The branch is `rez-a-dashboard-kit`; the head is
**`5837949`**. Cycle 16 froze `0710133` (182/182 mutation entries caught,
the first clean end-to-end sweep this project has had) and, for the first
time since cycle 11, ran all four critic dimensions together against one
candidate: truthfulness-against-production, the accessibility/UX boundary,
guard-adequacy, and correctness/spec-conformance. Three came back with
nothing new — either a reconfirmation of an already-recorded, non-blocking
item, or (three of the accessibility critic's six findings) a control this
project already declared out of scope for REZ-A in the cycle-5 hand-off's
"Interaction" deferral. The guard-adequacy critic found one live gap, now
repaired. **Nothing is merged and no promotion has been asked for.**

---

## What the guard-adequacy critic found, and the fix

`dashboard-screens.test.ts`'s "no control is in the tab order that cannot be
operated" backstopped its `.matchAll` loop with
`assert.ok(galleryData().cards.length >= 4, ...)` — a fact about the record
list, not about inert controls. Every sibling backstop in the same file (the
state indicators at `>= 8`, the named affordances at `>= 10`) counts the
loop's own match population; this one counted something else, so it would
have stayed green even if the `role="checkbox|radio|switch|menuitem|tab|
option"` regex above it matched nothing at all — the same "a guard that
matches nothing" class the cycle-16 mutation sweep found four live instances
of.

Fixed in `5837949` by collecting the loop's own matches into `inert[]` and
flooring its length at 20 (the real count today is 29 — 34 originally
shipped with this defect, less the five that were the composer's required
questions). Verified both directions:

- Reverting the regex to a role that cannot match anything drops the count
  to zero and the new backstop fails — the old one would not have.
- Reverting `Checkbox`'s `role="checkbox"` to `role="presentation"` in
  `components/dashboard/controls.tsx` (a real production regression, not a
  synthetic one) also now fails on the backstop. Added as
  `c16-checkbox-role-dropped` in `scripts/mutation/mutate.py` and confirmed
  caught by the harness itself, not just by hand.

## The other three critics: nothing new

**Accessibility/UX boundary.** Six findings; three are covered by the
cycle-5 hand-off's "Interaction" deferral, which says every control in the
`/dev/ds` gallery — "the toggles, checkboxes, tabs, pagination and Send RFQ"
— is presentational for REZ-A's scope, and that only controls whose *target
does not exist* are individually marked as such:

- The sheet's Close button (`<Button variant="ghost" icon aria-label="Close">`
  in `supplier-sheet.tsx`/`product-sheet.tsx`) has no `onClick`. Correctly
  observed; not a new defect — REZ-D wires interaction, and
  `design/dashboard-ux-flow.md`'s "closes with Esc or the ✕" is a spec
  requirement for that later work, not a REZ-A regression.
- The topbar's `role="search"` with no input, and the composer's "Add
  filter"/Search buttons being no-ops, are the same deferral.

The other three are already-recorded, non-blocking "boundary" debt, carried
forward unchanged: target size (85 sub-24px targets as of cycle 11, not
rechecked), table captions/`scope`, `<aside role="dialog">`.

**Truthfulness.** Two findings, both already on the known-and-recorded list:
the hardcoded source/register denominators, and `certScheme`'s title-casing
of "MADE IN GREEN". Nothing new.

**Correctness/spec-conformance.** One genuine, currently-live finding — see
below. It also reconfirmed the cycle-16 repair holds (duplicated-logic
drift, unsafe casts, the loader's unknown-vs-zero handling) and flagged that
commit `3ff61ae`'s message said the c13 entry and its positive controls were
"the next commit" when they were already in that same commit's diff. Correct
on content, wrong on sequencing — noted here since no other commit has
corrected it.

### Details step: the spec's own stated fact and the code structurally disagree

`design/dashboard-ux-flow.md` states in its preamble "every count below is
production, 18 Sep 2026" and gives the RFQ composer's Details step as
"Details 2/6". `composerModel()` (`app/dev/ds/dashboard-screens.tsx`) now
correctly names and counts all six spec fields (fixed cycle 16), but for the
one sample draft the composer is built from (`d.records.aboni`), five of the
six — reply-by date, incoterm, destination, currency, attachments — have no
source anywhere in the fixture and are hardcoded as missing, per the
cycle-16 comment beside them. The count this produces is **1/6**, and it can
never be anything else for this fixture: there is no data path by which a
second field becomes "filled" without inventing one.

This is the same class of disagreement already on record two paragraphs
below: "Card and sheet render 6 product tiles where the flow doc says 3 and
8". Either the spec's "2/6" describes a different real RFQ than the one this
sample draft mirrors, or the sample draft is missing a field the real record
has. Inventing a second filled field to force a match would violate "nothing
fake" (`ds-rebuild-must-stay.md` §2); recorded here as a founder decision,
not fixed in code.

---

## Mutation testing — the positive control

`5837949` re-ran the full sweep (183 entries — the 182 from cycle 16 plus
`c16-checkbox-role-dropped`) in `/home/claude/sb-mut`. The filtered run
against the new entry alone caught it first (`1 caught / 0 survived`,
confirming the fix by hand); the full sweep then confirmed it along with
every pre-existing entry: **183 caught / 0 survived / 0 did not compile / 0
skipped, of 183** — `mutations/sweep-c17.log`'s own last line, quoted
verbatim. This run also re-validated all 182 pre-existing anchors (the
harness refuses to start if any anchor is not exactly one match), so it
doubles as proof this cycle's diff left nothing stale. It ran the first ~13
minutes concurrently with a `pnpm test` pass for the evidence bundle — the
full suite finished clean (1,116/1,116) partway through — without disturbing
the sweep.

---

## What is in the tree

| | |
|---|---|
| Branch | `rez-a-dashboard-kit`, merge base `09ec96b` (`development`) |
| Head | `5837949` |
| Dashboard suite | 512 tests — unchanged count, one assertion inside an existing test rewritten |
| Mutation harness | `scripts/mutation/mutate.py`, **183 entries** |

Worktrees, environment quirks, and the guard table are unchanged from
`handoff-rez-a-cycle16.md` — read that file for those; this one only states
what moved.

**One addition to the environment notes cycle 16 didn't have:** this
container can be reclaimed after roughly 40 minutes of idle time between
tool calls, which kills any backgrounded process (including
`nohup ... & disown`) while leaving disk state intact. A mutation sweep left
running across a scheduled check-in gap died mid-mutation this way once,
leaving `sb-mut` dirty with one mutation applied and never reverted (found
via `git status`, cleaned by resetting the worktree and restarting the
sweep). **Poll a long-running background job with repeated in-turn checks,
not a scheduled wake-up with a large gap.**

---

## What to do next, in order

1. **Read the sweep's own last line** in `mutations/sweep-c17.log` once it
   finishes. If clean, the mutation-testing gate is satisfied for `5837949`.
2. **Assemble the evidence bundle** at `5837949` (`/home/claude/gate/cand17`)
   — screenshots, diffs against `0710133` and against the merge base, raw
   gate output, the sweep log.
3. **Fan out four fresh, independent critics** against the frozen SHA. The
   diff since the critics last saw a candidate (`0710133`) is small — one
   test file, one mutation entry — but the protocol doesn't have a "small
   diff" exception; every defect needs a guard watched failing under its own
   revert, and every candidate needs its own audit before Acceptance Judge.
4. **If all four come back clean, go to the Acceptance Judge.** This has
   never been reached in this project's history.
5. **Then ask**, one gate at a time, per AGENTS.md 9a. Nothing here is a
   request to land, promote, or deploy.

---

## Known, recorded, and not yet done

Unchanged from `handoff-rez-a-cycle16.md` except:

- **Added**: the tab-order guard's backstop (fixed this cycle, see above).
- **Added**: the Details-step "2/6 spec vs 1/6 code" disagreement (above),
  alongside the existing "6 vs 3/8 product tiles" item — both are
  spec-vs-render disagreements needing a founder decision, not a code
  defect.
- **Added**: the minor `3ff61ae` commit-message sequencing inaccuracy
  (content was right; "next commit" framing was wrong).
- The three accessibility findings this cycle resolved as **already
  correctly scoped out** (Close button, `role="search"` with no input,
  Add-filter/Search no-op) are not added to this list — they are not
  defects, recorded or otherwise. Worth keeping in mind so a future critic
  doesn't re-flag them without this context.

Everything else — the truthfulness items, the boundary/non-blocking
accessibility items, the dead-code list — carries forward unreviewed this
cycle; see `handoff-rez-a-cycle16.md`'s own list for the full text.

---

## Promotion gates — none of them has been asked for

AGENTS.md 9a: landing on `development`, promoting to `main`, and deploying
are three separate asks, and approval of one is never approval of the next.
`git push` fails in this environment — the founder pushes.

**Stop at "Ready for human review. Not merged."**
