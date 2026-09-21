# REZ-A (the code port of the buyer dashboard v3.2 kit) — hand-off after cycle 19

Supersedes `handoff-rez-a-cycle18.md` for state and order of work.
`handoff-rez-a-cycle5.md` is still the reference for the cycle-5 findings and
for **"What this kit deliberately does not carry yet"**, which is where the
deferrals live — read it before flagging anything in the `/dev/ds` gallery as
dead or unwired; every control there is presentational by design in REZ-A's
scope. Treat `handoff-rez-a-cycle18.md` as a claim about cycle 18's own
state, not as ground truth about anything after it.

---

## Where the work stands in one paragraph

Nineteen audit cycles. The branch is `rez-a-dashboard-kit`; the head is
**`66bb627`**. Cycle 18 froze `74e1d09` and ran all four critic dimensions
against it. Correctness and truthfulness independently confirmed the same
blocking defect (the results-table's own header/footer/caption still named
the wrong population); accessibility found a direct extension gap in its
own cycle-18 fix (main landmarks and skip links) plus a new architectural
finding no prior cycle had raised (three simultaneously-live dialogs each
falsely claiming `aria-modal`); guard-adequacy found two real gaps in
cycle 18's own new test guards, verified with an actual mutation run in an
isolated scratch copy. All five repaired this cycle, each with a guard
verified RED under revert and a mutation-harness entry verified caught by
the real harness. **Nothing is merged and no promotion has been asked
for.**

---

## What the correctness and truthfulness critics found, and the fix

Two independent critics reached the same finding against `74e1d09`: cycle
18's own topbar-caption fix (`e5c399b`) only moved the *topbar's* caption
to the table's wider span once `extra` discovery rows join it — the panel
header, the panel footer and the figure's own caption all still called the
table's rows "the named test records of the rebuild spec" / "the same
named records as the card view", true only against the screenshot
harness's fixture stub (`extra` always empty there), false the moment a
live read's discovery rows fill it. The same "caption states the wrong
population" defect class this project has repeatedly treated as blocking,
this time in three places on one screen instead of one.

Fixed in `713c7f0` by adding `tableSelection(d)`, which states the wider
population whenever `d.rows` outgrows `d.cards`; the card view's own
`SELECTION` constant is unchanged and stays narrow. Guard:
`dashboard-screens.test.ts` — "the table's panel header, footer and figure
caption state the wider population once discovery rows join it — not the
card view's" — verified RED by reverting `tableSelection` to always return
the narrow string. Mutation entry added
(`c18-table-caption-drops-the-extra-rows`).

## What the accessibility critic found, and the fixes

**Extension gap: main landmarks and skip links.** Cycle 18's own
landmark-naming fix (`d5c47f3`) reached `<nav>` and the topbar's search
region and stopped there. Every live `<main>` on the combined gallery page
was still unnamed (three indistinguishable "main" landmarks in a screen
reader's landmark list — landmark names never come from content, only from
an author-supplied label) and every skip link still read the identical
"Skip to content", so the links rotor offered three same-named entries
going to three different places with no way to tell which was about to be
activated.

Fixed in `487bb11`: `<main>` now carries `aria-label={screenLabel}`; the
skip link's text becomes `Skip to content, <label>`. Guard extended
("every screen can be entered past the sidebar"): collects
`mainNames`/`skipLinkNames` the same way `navNames`/`searchNames` already
were, asserts each list is duplicate-free — verified RED two ways
(removing `<main>`'s `aria-label`; hardcoding the skip link's text). Two
mutation entries added (`c18-main-landmark-loses-its-name`,
`c18-skip-link-text-hardcoded`).

**New finding: three dialogs each claimed exclusive modality.** The
gallery renders the supplier sheet, product sheet and RFQ composer side by
side for review, all three live and non-inert relative to each other, and
all three carried `aria-modal="true"` — an attribute that asserts
everything outside the dialog is unavailable, false in both directions at
once for at least two of the three simultaneously-live dialogs. No prior
cycle had raised this; it is a structural property of the gallery's
side-by-side layout, not a regression in any single fix.

Fixed in `135b231`: `Sheet` and `RfqComposer`'s `Dialog` take a new
`assertModal` prop (default `true`, the real single-dialog behaviour the
shipped app always has); the gallery passes `assertModal={false}` on all
three of its instances, since none of them can truthfully claim the other
two — and the three plain screens — do not exist. `role="dialog"` and each
one's own `aria-label` are unaffected either way. Two pre-existing tests
keyed their modal-detection on `aria-modal="true"`, which this removes
from the gallery entirely; both were re-keyed on `role="dialog"` before
running the suite — one of the two was caught by inspection, not by a
failed test run, because it would otherwise have silently stopped
exercising its own assertions (a dialog frame falling into the
plain-screen branch and passing by matching the wrong, inert content)
rather than failing loudly. New guard: "no dialog on the combined gallery
page claims aria-modal, since none of the three is the page's one true
modal" — verified RED three times, once per instance
(`c18-supplier-sheet-claims-exclusive-modal`,
`c18-product-sheet-claims-exclusive-modal`,
`c18-composer-claims-exclusive-modal`).

## What the guard-adequacy critic found, and the fix

Cycle 18's own new loader-level test ("the table's own record span covers
the extra rows; the named span does not") asserted a relative comparison
(`named.recordsRead < withExtra.tableRecordsRead`) and that
`tableRecordsReadOn` was merely truthy — never pinning either to an
absolute value. A shared bug that moved both sides of the comparison
together, or that dropped `tableRecordsReadOn` to something other than
`null`, would have passed silently. The critic verified this was a real
gap with an actual mutation run in an isolated scratch copy, not just an
argument from reading the assertions.

Fixed in `7ffccda`: three absolute counts
(`named.recordsRead === 2`, `named.tableRecordsRead === 2`,
`withExtra.tableRecordsRead === 3`) replace the relative comparison; a new
test pins `tableRecordsReadOn` to the exact range string the stub's
fixtures produce on both the named-only and with-extra reads. Verified RED
two ways — an off-by-one on `read.length`, and `tableRecordsReadOn`
dropped to `null`. Two mutation entries added
(`c18-read-span-count-off-by-one`, `c18-table-read-date-dropped`).

---

## Mutation testing — the positive control

Full sweep at `66bb627` in `/home/claude/sb-mut`: **195 entries, 195
caught, 0 survived, 0 did not compile, 0 skipped** — `mutations/sweep.log`'s
own last line, quoted verbatim. This run also re-validated all 195 anchors
(the harness refuses to start if any anchor is not exactly one match), so
it doubles as proof this cycle's diff — including the three anchors it
staled and I repointed (`66bb627`) — left nothing silently blind.

The 8 new `c18-*` entries were also run alone (`mutate.py c18-`) and
confirmed 8/8 caught before the full sweep ran.

---

## What is in the tree

| | |
|---|---|
| Branch | `rez-a-dashboard-kit`, merge base `09ec96b` (`development`) |
| Head | `66bb627` |
| Dashboard suite | 517 tests (514 at cycle 18, +3 new) |
| Full suite | 1,121 tests (1,118 at cycle 18, +3 new) |
| Mutation harness | `scripts/mutation/mutate.py`, **195 entries** (187 at cycle 18, +8 new) |

Worktrees and the guard table are unchanged from `handoff-rez-a-cycle18.md`
— read that file for those; this one only states what moved.

**One correction to a cycle-18 gate note:** `pnpm exec tsc --noEmit` does
not write to `.tests-build/`. Measuring the dashboard suite requires
running `pnpm exec tsc -p tsconfig.npm-test.json` (the config that emits)
*first*, every time — running the type-check gate alone and then the test
runner against a stale `.tests-build/` directory silently measures an
older commit's tests. This cost one wasted re-run this cycle (514/77
instead of the correct 517/77); caught by the missing new tests in the
count, not by a failure.

Re-confirmed from cycle 18: this container can be reclaimed after roughly
40 minutes of idle time between tool calls, killing any backgrounded
process. **Poll a long-running background job with repeated in-turn
checks, not a scheduled wake-up with a large gap.**

---

## What to do next, in order

1. **Fan out four fresh, independent critics** against the frozen SHA
   `66bb627`. Five real, repaired defects went into this cycle's diff, so a
   full fresh audit is required, not skippable.
2. **If all four come back clean, go to the Acceptance Judge.** This has
   never been reached in this project's history.
3. **Then ask**, one gate at a time, per AGENTS.md 9a. Nothing here is a
   request to land, promote, or deploy.

---

## Known, recorded, and not yet done

**Repaired this cycle** (all five, above): the results-table
population-mismatch (correctness + truthfulness); the main-landmark and
skip-link naming gap (accessibility); the three-dialog `aria-modal`
false-claim (accessibility); the two guard-adequacy gaps in cycle 18's own
new tests.

**New this cycle, not yet repaired, non-blocking:**

*Correctness*
- RFQ-list empty-state caption mismatch — a wording claim not yet checked
  against what the empty state can actually promise.
- Missing Overview summary paragraph — a model field that can be empty;
  not yet confirmed whether production ever leaves it empty.
- Composer cert-line grammar/logic bug — a sentence that can render
  ungrammatically under a specific field combination.

*Accessibility*
- Heading structure issues on one or more screens, not yet isolated to a
  specific element.
- RFQ chip contrast/ARIA state — a chip's contrast ratio or `aria-*` state
  that may not meet the project's own bar.
- Table captions/`scope` attributes on `ResultsTable` — not yet audited
  against the WCAG table-header guidance the rest of the kit follows.
- Source-mark target size — possibly under the accessible minimum
  touch/click target.
- `aria-disabled` pointer activation — an element marked `aria-disabled`
  that may still be reachable by a pointer event.

*Truthfulness*
- `RFQ_TARGETS` fixture-reconciliation risk — the fixture constant used
  across composer tests may drift from what it represents without a test
  noticing.
- rfq-list unattributed corpus counts — a count on the RFQ list screen
  with no visible source attribution.
- S M Knitwears cert-overflow clipping — a certificate card layout that
  may clip content for that specific fixture record.

*Guard-adequacy (pre-existing gaps, not on code added in cycle 18 or 19)*
- `epbExporter.pages` — a guard gap on this field's own test coverage.
- `initials()` fallback — a guard gap on the fallback branch specifically.
- `chapterName` — a guard gap on this helper's own coverage.
- Photo-strip `aria-label` population mismatch — the project's
  most-repeated defect class, not yet confirmed live.

**Reconfirmed, unchanged from earlier cycles:** `otherExporters`
unattributed constant (truthfulness); the Details-step "2/6 spec vs 1/6
code" disagreement; the "6 vs 3/8 product tiles" disagreement;
`factoryAddress()`'s null-fallback gap (correctness, not yet checked
against production); the sidebar "Suppliers" count badge vs. spec text
(founder wording call).

Everything else — the boundary/non-blocking accessibility items carried
since cycle 16, the dead-code list — carries forward unreviewed this
cycle; see `handoff-rez-a-cycle16.md`'s own list for the full text.

**Out of REZ-A's scope, flagged separately, no action taken (carried
forward):** the 10 `_snapshot_*`/`_tmp_*` tables found fully exposed to
`anon`/`authenticated` with RLS disabled (Supabase advisories, cycle 18).
Still not communicated to the founder directly — no founder present in
either cycle's session. Whoever next has the founder's attention should
raise this explicitly; it is unrelated to REZ-A's own scope and should not
block or ride along with this branch's own review.

---

## Promotion gates — none of them has been asked for

AGENTS.md 9a: landing on `development`, promoting to `main`, and deploying
are three separate asks, and approval of one is never approval of the next.
`git push` fails in this environment — the founder pushes.

**Stop at "Ready for human review. Not merged."**
