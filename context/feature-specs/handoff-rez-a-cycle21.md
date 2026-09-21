# REZ-A (the code port of the buyer dashboard v3.2 kit) — hand-off after cycle 21, superseding cycle 19

Cycle 20 never got its own hand-off commit (the session ran the whole
repair → second critic round → Acceptance Judge sequence back to back);
this doc covers both cycles 20 and 21 and supersedes cycle 19's.

## Where the work stands in one paragraph

The Acceptance Judge has returned `ACCEPTED_FOR_HUMAN_REVIEW` for candidate
`08a7ec3`. All four of cycle 19's BLOCKING findings (2 truthfulness, 2
accessibility — actually 4 accessibility, see below) are fixed and
verified. A first fresh critic round against that repair (`8500e13`) found
two more BLOCKING issues (one accessibility, one guard-adequacy) and two
non-blocking ones; both BLOCKING fixes are in (`56cc824`, `08a7ec3`). A
second fresh critic round against the fully-repaired candidate found **zero
new BLOCKING findings** — two of four critics clean, two independently
confirmed the prior fix sound — which is the closed-loop protocol's own
stopping condition. The Acceptance Judge then independently re-verified
the evidence bundle's claims against the real repo state (byte-identical
diff regeneration, an independent re-run of the test suite, source-level
confirmation of both fixes) before emitting the acceptance token. This
candidate is **ready for human review. Not merged, not promoted, not
deployed** — no promotion gate has been asked for or granted.

## What cycle 19's critics found, and the fix (repairs made this session)

**Truthfulness, both BLOCKING:**

1. `83e4af8` — a saved-search title claimed a certificate state
   (`discover_suppliers` has no such filter parameter); retitled to match
   what the query and composer chip actually say.
2. `633e14a` — the static HS photo catalogue's exporter counts were
   sourced from EPB's wider population, not SourceBD's own (which drops
   records `epb_record_is_foreign_to_host` flags as belonging to a
   different company). Reconciled live against `supplier_epb_hscodes`; 29
   headings were overcounted by 1–2, fixed. Full table:
   `ops/plans/hs-catalogue-exporter-counts.md`.

**Accessibility, all four BLOCKING:**

3. `c816d0f` (F1 part A) — a source mark's tier was carried by fill
   lightness alone (WCAG 1.4.1/1.3.1); both linked and unlinked marks now
   carry the tier name in their accessible name.
4. `c12c3aa` (F2) — the topbar and RFQ-list search boxes carried
   `role="search"` with nothing operable inside them; dropped.
5. `8a269f7` (F3) — the segmented control and the composer's Template
   switch clipped their own `:focus-visible` ring under `overflow-hidden`;
   both now inset the ring.
6. `f200207` (F4) — three live controls used the plain `border-line`
   (1.44:1) for a control outline, short of WCAG 1.4.11's 3:1; switched to
   `border-line-strong` (3.93:1).

**Process:** `8843f76` fixed a lint failure this round's own tests
introduced. `8500e13` closed a gap the cycle-20 mutation sweep itself
found: `c816d0f`'s fix covered both linked and unlinked marks, but every
test targeted linked marks only — the one unlinked-mark test never checked
the tier-name suffix. Strengthened, verified RED under manual revert.

## What the first fresh critic round (against `8500e13`) found, and the fix

Dispatched truthfulness, correctness, accessibility, guard-adequacy —
fresh worktrees, barred from prior hand-off docs (cycle 5's scope section
excepted). Both truthfulness and correctness came back clean; both
self-caught and disclosed that `diff-cycle20.patch` incidentally contained
the full text of the cycle-19 hand-off doc (added whole by one commit),
stopped reading past it, and were not biased by it.

- **Accessibility, BLOCKING** — `SearchComposer`'s Filters/Ask switch
  (gated behind `askEnabled`, not yet reachable on any shipped screen) had
  the same F3/F4 defect: plain `border-line` outline, clipped focus ring.
  Fixed in `56cc824` the same way F3/F4 were. Two mutation entries added
  (`a11y-search-mode-loses-strong-outline`,
  `a11y-search-mode-filters-button-loses-inset-focus-ring`), verified RED.
- **Guard-adequacy, BLOCKING** — the `role="search"` accessibility guard
  in `dashboard-screens.test.ts` matched with a hardcoded closing-tag
  alternation (`(?:div|section|form)`); a `<span role="search">` with
  nothing operable inside it would slip past it (the lazy match runs to
  one of those three tags and can land on an unrelated later element).
  Fixed in `08a7ec3`: extracted into
  `searchLandmarksWithoutAnOperableControl(html)`, using a backreference
  regex scoped to whatever tag actually carries the role, with a dedicated
  test pinning four synthetic fixtures. Test-only — no mutation entry; the
  new test itself is the guard, verified RED by manually reverting the
  regex.
- **Accessibility, non-blocking, open** — `Seg` (the Cards/Table view
  toggle) has no `aria-label` in 5 of its 7 gallery uses, unlike its
  sibling toggles. Needs a founder decision (shared default label, or a
  label prop on every call site) — not fixed unilaterally.
- **Guard-adequacy, non-blocking, open** — the RFQ zero-row caption test's
  own assertion is weaker than its comment claims; the underlying
  guarantee is independently covered by `render.test.ts:729`, so this is a
  comment/clarity fix, not a coverage gap.

## What the second fresh critic round (against `08a7ec3`) found

Same four dimensions, new worktrees, no memory of the first round.

- **Truthfulness** — clean.
- **Correctness** — clean. Independently re-audited source-tiers,
  hs-photos, facts, build-models, results-panel against its own bug-class
  checklist; all sort/dedupe/count paths correct.
- **Accessibility** — independently re-derived the contrast ratios,
  confirmed `56cc824` is correct and complete; swept every other
  `overflow-hidden` + bordered-control combination and found no fourth
  instance missed. No new findings.
- **Guard-adequacy** — adversarially tested the new backreference function
  against nested same-tag markup, multiple `role="search"` elements on one
  page, and a hyphenated custom-element tag; confirmed sound for every
  real markup shape in this codebase (the two theoretical misses it found
  can't occur here — no such markup exists anywhere in the repo). **One
  new non-blocking finding**: this same cycle's own new `render.test.ts`
  assertion (the SearchComposer focus-ring test) scopes its own
  `searchGroup` slice with a naive `indexOf("</span>", ...)`, which
  truncates early at `V2Tag`'s own nested `</span>` — the identical
  closing-tag-guessing pattern that caused the original bug. Confirmed
  harmless today (both assertions read data captured before the
  truncation point), but a latent trap for the next edit. Recommended fix:
  the same backreference technique, not yet applied.

**Net: zero new BLOCKING findings** — the closed-loop protocol's stopping
condition for this repair cycle.

## The Acceptance Judge

A fifth, independent agent judged the evidence bundle itself — not by
re-deriving new findings, but by verifying the bundle's own claims against
the real repo state: SHA identity, raw gate output against the claimed
pass counts, an independently re-run dashboard suite (530/530, matching),
mutation-summary JSON contents, a byte-identical regeneration of both
diff files, source-level confirmation that both BLOCKING fixes are really
in the code (not just claimed), and a spot-check of the most specific,
falsifiable second-round critic claim (the `indexOf("</span>")` finding
above), which held up exactly as described. Returned
`ACCEPTED_FOR_HUMAN_REVIEW`.

## Mutation testing

213 entries (211 + 2 added this cycle for the `SearchComposer` fix). All
213 have a demonstrated RED result: 210 from the full sweep at `8843f76`,
3 re-verified individually filtered at the true candidate SHA `08a7ec3`
(the cycle-20 guard gap, plus the two new cycle-21 entries) — the diff
since the full sweep touches only files those three entries cover, so a
full re-sweep was not re-run (confirmed via `git diff --stat`).

`pnpm test` (whole repo, 1133/1133) last ran in full at `8843f76`; nothing
outside the dashboard-suite glob changed since, so it was not re-run —
the dashboard suite (530/530) covers every file the delta touched.

## What is in the tree

- `/home/claude/gate/cand21/` — the evidence bundle: `EVIDENCE.md` (the
  full narrative above, plus the verification table and both critic
  rounds' reports), `commits.txt`, `diff.stat`/`diff-full.patch`
  (`09ec96b..08a7ec3`), `diff-cycle21.patch` (`8500e13..08a7ec3`), `raw/`
  (tsc/lint/dashboard-test output), `mutations/` (README plus every
  summary JSON), `screenshots/`/`gallery.html`/`ds.css`, `sql/README.md`
  (carried forward unchanged from cycle 20 — no new production query this
  cycle).
- `/home/claude/gate/cand20/` — the prior bundle, for candidate `8500e13`,
  kept as-is (not superseded, since it documents a real intermediate
  state the first critic round reviewed).
- Worktrees: `sb-cand`, `sb-mut`, and the four `sb-critic-*` worktrees are
  all synced to `08a7ec3`. The stale `agent-*` worktrees under
  `.claude/worktrees/` remain pinned at pre-cycle-19 `a4e53be`, unused.

## Known, recorded, and not yet done

- **Guard-adequacy, non-blocking, new**: `render.test.ts`'s `searchGroup`
  slice uses naive `indexOf("</span>", ...)` scoping — same defect class
  as the fixed `role="search"` bug, currently harmless, latent trap.
- **Accessibility, non-blocking**: `Seg` has no `aria-label` in 5 of 7
  uses. Needs a founder decision on the labeling approach.
- **Guard-adequacy, non-blocking**: the RFQ zero-row caption test's
  assertion is weaker than its comment claims (no real gap — comment fix
  only).
- **Accessibility F1 part B** (tier-rank colour-ramp contrast/redesign) —
  carried from cycle 19, needs a founder decision, not a unilateral fix.
- Non-blocking findings from cycle 19's four critics not re-litigated
  here: Correctness F4–F8, Accessibility F5–F11, Truthfulness Non-blocking
  2–4, Guard-adequacy Findings 4 and 6 — see `handoff-rez-a-cycle19.md`.
- Out of REZ-A's scope, still pending founder attention: the
  RLS-disabled `_snapshot_*`/`_tmp_*` tables security advisory.
- **Environment notes for the next session working in this sandbox**:
  (1) this cloud container is reclaimed after an idle gap, which silently
  kills any backgrounded job the moment you schedule a long wakeup and go
  quiet — for a long-running gate or sweep, keep the session active with
  chained polling instead. (2) `git remote origin` here is a local bundle
  file, not a live GitHub remote — pushing a feature branch is
  policy-allowed but not technically possible from this sandbox; commits
  are safe and complete locally regardless. (3) `next build` fails in this
  sandbox on Google Fonts (`app/(auth)/layout.tsx`, `app/global-error.tsx`)
  — confirmed pre-existing across four cycles' evidence bundles and this
  session's own commit history, not a regression, not REZ-A's scope to
  fix; the real CI has normal internet access.

## Promotion gates — none of them has been asked for

This candidate is accepted for human review only. Nothing has been landed
on `development`, nothing promoted to `main`, nothing deployed. Each of
those three gates (AGENTS.md 9a) needs the founder's explicit go-ahead,
asked for one at a time — approval of one is never approval of the next.
