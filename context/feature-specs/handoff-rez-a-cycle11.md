# REZ-A (the code port of the buyer dashboard v3.2 kit) — hand-off after cycle 11

Supersedes `handoff-rez-a-cycle9.md` for state and order of work, and that
file's "what to do next" is done. `handoff-rez-a-cycle5.md` is still the
reference for the cycle-5 findings and for **"What this kit deliberately does
not carry yet"**, which is where the deferrals live. Read both.

---

## Where the work stands in one paragraph

Eleven audit cycles. The branch is `rez-a-dashboard-kit`; the head is
**`f250cdc`**. Cycles 10 and 11 ran nine independent critics between them and
found twelve blocking defects, every one repaired with a guard that was
watched failing under its own revert. All four gates are green on a **clean
checkout of the frozen SHA** — which is new, and is how the worst finding of
these two cycles was caught. **Nothing is merged and no promotion has been
asked for.** The loop ends only when an Acceptance Judge returns the literal
token `ACCEPTED_FOR_HUMAN_REVIEW`; it has still never been reached.

---

## The two things to understand before changing anything

### 1. A guard whose oracle comes from the thing under test

This was cycle 9's lesson and it kept paying out. Cycle 10 found five
assertions that **pinned the defect and described it as the fix**:
`render.test.ts` asserted `role="checkbox" tabindex="0"` with the comment "a
checkbox role with no tabindex cannot be reached by keyboard", over 34
controls that announced as operable and swallowed Space;
`dashboard-screens.test.ts` skipped bare `href="#"` as "the approved
fragment's inert form". Cycle 11 found one I had written *that cycle*: a
backstop of `length >= 10` counted over named `<svg>` elements, which meant
the correct repair took the count to zero and failed the suite.

**A `length >= N` counted over the exact markup a repair would change is a
pinned defect.** Count the affordance, not its current shape.

### 2. A commit made from a tree something else is rewriting

Three commits on this branch — `109f71b`, `718d728`, `5452dab` — were authored
while a mutation sweep was mutating the same working tree. Each swept up the
live mutant along with the markdown it meant to change. Two of them shipped
it, so the "frozen candidate" the previous hand-off named was failing nine of
its own tests, and a `mailing` address was being promoted to the factory
address and stamped with the register that filed it — 4,456 published records
reach that attribution, 197 would have shown the wrong address.

Nobody saw it because **CI never ran the test suite.** It ran `tsc`, `lint`,
`build` and one HTTP probe. The whole `node --test` suite ran on one machine.

Both classes are now structurally prevented; see the guard list below.

---

## What is in the tree

| | |
|---|---|
| Branch | `rez-a-dashboard-kit`, merge base `09ec96b` (`development`) |
| Head | `f250cdc` — cycle-11 repairs, **not yet audited** |
| Rejected candidates | `03d59ab` (cycle 11, ×2) · `0a56d0f` (cycle 10, ×3) · `0fbf986` (cycle 8, ×4) · `289f5c0` (cycle 7, ×4) · `aa35ae3` · `5835cf6` |
| Size | 161 files, +17,089 / −129 against the merge base |
| Dashboard suite | 499 tests, ~35 s — `scripts/mutation/dash-test.sh <root>` |
| Full suite | 1,100 at `77c87cb` |
| Lint | 14 warnings, the baseline; none in the kit's own directories |
| Mutation harness | `scripts/mutation/mutate.py`, 158 entries |

### Worktrees on the container

Three, and the separation matters — it is the fix for cause 2 above.

```
/home/claude/sb        the branch; the ONLY tree you commit from
/home/claude/sb-cand   a detached worktree; run the gates here, on the frozen SHA
/home/claude/sb-mut    a detached worktree; the mutation sweep runs here and nowhere else
/home/claude/sb-base   a detached worktree at 09ec96b
```

`node_modules` is hardlinked between them (`cp -al`), so a worktree costs
nothing. **Never run the gates in `/home/claude/sb`** — that is how a tree
with uncommitted repairs measured green while the committed SHA was red.

---

## What to do next, in order

1. **Freeze `f250cdc` and audit it.** It carries a whole cycle of repairs no
   critic has seen. Run the four gates in `sb-cand`, regenerate the
   screenshots, run the sweep to completion in `sb-mut`, build the bundle,
   then fan out fresh critics and the Acceptance Judge.

2. **Finish the mutation sweep.** A run was in flight at `77c87cb` when this
   was written (`/home/claude/gate/mutations/sweep-c11.log`) and is now stale
   — `f250cdc` changed source. Restart it at the frozen SHA. 158 entries,
   ~65 s each, so allow three hours; run it in the background and do the
   bundle while it runs. **Quote its own last line, never a hand-written
   number.**

3. **Work the non-blocking findings below.** Nine critics have now looked at
   this kit; what is left is listed at the end of this file and nobody has
   worked it.

4. **Then ask.** AGENTS.md 9a: landing on `development`, promoting to `main`
   and deploying are three separate asks. None has been requested or given.

---

## How to work in this environment

Nothing builds on the founder's machine (pnpm junctions fail through the
mount, no registry access), so the source is snapshotted into a container.
**Node 22, not 20.**

```
export PATH=/opt/node22/bin:$PATH
cd /home/claude/sb

scripts/mutation/dash-test.sh /home/claude/sb        # 499 tests, ~35 s — the loop
pnpm exec tsc --noEmit                               # exit 0, no output
pnpm test                                            # ~17 min, 1,100 tests
pnpm exec next lint                                  # 14 warnings is the baseline

MUTATE_ROOT=/home/claude/sb-mut MUTATE_TEST=$PWD/scripts/mutation/dash-test.sh \
  python3 scripts/mutation/mutate.py                 # the whole sweep
                                                     # add `c10-` for one family

PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  ./scripts/gallery/regen.sh
```

**`pnpm test` needs Node 21 or newer.** On Node 20, `node --test` reads the
script's `".tests-build/**/*.test.js"` as a literal filename, prints "Could
not find" and exits 1 with nothing run. CLAUDE.md said "Node 20 only" for
months and the first CI job was written against that note.

`next build` fails on the baseline and the candidate alike: other pages fetch
Google Fonts and the container has no route to `fonts.googleapis.com`.

`git push` fails — `origin` here is the snapshot bundle, not GitHub. The
founder pushes.

Production is read-only through the Supabase MCP `execute_sql`, project
`stnrfxrxfonwexzcvvpv`. **Use it.** Of the twelve blocking findings in cycles
10 and 11, seven were established by writing a query. The container cannot
reach Supabase over the network, so the page renders from fixtures.

### Traps this environment has set

- **Never run a sweep in the tree you commit from.** The harness refuses now,
  but the three commits that caused this are in the log.
- **A Python `rep()` script that asserts mid-way aborts before writing**,
  silently discarding every earlier edit in the same script. Re-grep after any
  failure. This still bit twice this cycle.
- **`pkill -f mutate.py` matches your own shell** and kills the tool call.
  Match on `ps -eo pid,cmd | awk '$2=="python3" && $3 ~ /mutate/'`.
- **A revert that changes no behaviour scores a false RED.** Five have been
  found and repointed.
- **An anchor goes stale the moment you repair the line it points at**, and a
  duplicated anchor is worse than a stale one. The harness refuses both now.
- **`_gallery-out/` is a build artifact, not state.** Running the test suite
  used to overwrite `gallery.html` — the page the evidence screenshots come
  from — as a side effect of importing the harness.

---

## The guards, and what each is for

| file | what it holds |
|---|---|
| `.github/workflows/ci.yml` | **`pnpm test` on Node 22.** Before this, no CI check ran the suite at all, which is why two red commits passed every check. |
| `scripts/mutation/mutate.py` | The positive control, and four refusals: the tree you commit from, a dirty worktree, an anchor that does not appear exactly once, a red baseline. `scripts/mutation/README.md` says why each exists. |
| `fixtures.test.ts` | every field of every row against the checked-in production read, plus: no invented URL host, no shared id, no sanctioned real company, every building name exported, every source code ranked |
| `build-models.test.ts` | the builders, the attribution rules, the register labels, the Locations dedupe, the RFQ row's shapes, the certified scope, and **order-invariance**: the factory address and its receipt must not depend on the order the RPC returned its rows |
| `render.test.ts` | the boundary — rendered HTML for every screen, the sanction, the long name, ARIA state, unread-is-not-zero, the named meter |
| `dashboard-screens.test.ts` | the composition layer, plus **seven page-level sweeps over all six screens at once**: no absolute negative over unread registers; no denominator that is not a count of registers holding records; no inert control in the tab order; an action name must be on something actionable; nothing announced unavailable may stay focusable; every placeholder link must say it goes nowhere; every screen must be enterable past the sidebar (one `main`, a skip link, an `h1`, no skipped heading level) |
| `harness.test.ts` | the screenshot harness, that it and the page call the loader identically, and that importing it renders nothing |
| `tokens.test.ts` | the token file: 67 contrast pairs at the threshold each use needs (4.5 text / 3 controls / 7 sanction — **not** AAA, whatever earlier notes said), the ramp, the density stops, the type scale, the radius scale |
| `gallery-data.test.ts` | the loader: RPC argument names, the RFQ aggregation, unknown-vs-zero on every failed read, every not-a-count shape, and the read-date range |
| `test-stubs/phosphor-icons-react.cjs` | it rendered `null`, so **no test in the suite could see any icon's markup**. It emits the real `<svg>` now — which immediately exposed five assertions that were only passing because icons were invisible. |

---

## Known, recorded, and not yet done

From the cycle-10 and cycle-11 critics. All **non-blocking**: none makes a
screen state something false.

**Truthfulness, latent or cosmetic**

- Three denominators are constants that are correct today — `SOURCES_WITH_RECORDS = 14`,
  `CERT_REGISTERS = 4`, `BRAND_LISTS_WITH_RECORDS = 4`. The day DIFE, RJSC,
  BEPZA, Inditex or Primark files its first record, every "1 of 14 sources
  read" on the site becomes a negative the data does not support, silently,
  with a green suite. Derive them from a read, or gate the constant against a
  live count.
- The sheet's "Read 18 Sep 2026 · 11 sources" is the same maximum-as-property
  shape the topbar had, for one record: one of Aboni's eleven sources was read
  that day, and NEXT was read 18 May. Mitigated — the same screen prints all
  eleven read dates.
- RSC's read date appears as two different days on one screen (the Safety
  block's `rsc_remediation.fetched_at`, 30 Jul, and the read-dates line's
  `source_records.fetched_at`, 18 Sep). Both true of their own object.
- The RFQ list's "SENT" column prints `created_at`; `rfqs` has no `sent_at`.
- The RFQ composer's rail says "2/6" and "Reply-by date and destination
  missing" while its own footer says "4 fields missing — target price,
  reply-by date, incoterm, destination". Both are hand-written literals in
  `dashboard-screens.tsx`; at most one can be right.
- `certScheme` title-cases: "OEKO-TEX Made In Green" where the scheme is MADE
  IN GREEN (71 certificates).
- ≤622 published all-caps names carry a 2–3 letter token that is neither a
  word nor in `KEEP_UPPER`: "HKD INTERNATIONAL" → "Hkd International".
- The screenshots' countdowns are pinned to `TODAY = 2026-09-18`; the bundle
  is produced later, so "expires in 11 days" is 9 by then. The live loader
  passes `new Date()`, so this is the evidence artifact, not the product.
- `lib/hs-catalogue.ts`'s `otherExporters` is an unattributed build-time
  constant on a screen whose rule is that every number traces to a register.
  (Its `exporters` counts were re-derived against production this cycle and
  all 46 match, so the earlier "several are off by one" note is wrong.)

**Boundary, not blocking**

- **Target size.** 85 interactive targets under 24 px (the source marks are
  20 px at `gap-[3px]`); axe confirms 17 as WCAG 2.2 AA failures. The
  dashboard spec names only contrast and keyboard, but `spec-M6` commits the
  marketing surfaces to 2.2 AA — someone should settle which bar applies.
- **`aria-modal="true"` over a live background.** 56 focusable elements behind
  the scrim on each of the three sheet screens; no `inert`. Declarative
  `inert` on the stage would close it.
- **`<aside role="dialog">`** is not a permitted role for `aside` (2 nodes).
- **Selected/current state fills** are ~1.1:1 against their neighbour
  (`brand-tint` on `canvas` 1.07, on `surface` 1.15), and none of those pairs
  is in `contrastPairs`, which only ever tests foreground-on-background. WCAG
  1.4.11 asks 3:1 for state. The sheet's tabs get this right.
- **The topbar's `role="search"` contains no search facility** — an icon, a
  span and a `⌘K` hint, unreachable by keyboard, on all six screens. rfq-list
  has two unnamed `search` landmarks.
- **Tables** carry no `<caption>` and no `scope="row"`.
- **The icon stub is one component for all 3,043 exports**, so a wrong icon
  *mapping* — `warn: CheckCircle` — passes the whole suite. Proven by
  experiment. The glyph beside "Sanctioned" is a `warn`.
- `hs-photos.test.ts` compares `rarestFirst` against its own output.
- `buildProductSheet` is only built for two records, so `epbExporter().pages`
  is never exercised and the "+1 more exporter page" line can be deleted
  invisibly.
- 20 of the 31 `REGISTRY` codes have no stamp or label guard.
- `app-shell.tsx` and `search-composer.tsx` have thin coverage.
- `tierFromSlug()` is dead: the kit ranks from a hardcoded `REGISTRY` while
  the database ships a tier on every provenance row, and the production
  profile reads that tier. Two surfaces, two sources of truth. No mismatch
  today across all 12 fixtures.
- Dead: `formatMonth()`, `buildRfqRow`'s discarded `today`, `hsShortLabel`'s
  second parameter, `gallery-data.ts`'s `toast: null` and the `Toast` it feeds.
- `chapterName` maps 6 chapters; the 54-code fixture spans 52, 55 and 59 as
  well, so a fact row reads "52 · HS chapter".
- The sheet's `summary` is `null` unconditionally, so `design/dashboard-ux-flow.md`
  §4's "summary paragraph" is simply absent; `LockedTable` for saved report
  files is absent too, and neither is on the deferral list.
- Card and sheet render 6 product tiles where the flow doc says 3 and 8; the
  sixth is clipped at 1440. The approved render also shows six, so the render
  and the doc disagree — someone should settle which is authoritative.

---

## Promotion gates — none of them has been asked for

AGENTS.md 9a: landing on `development`, promoting to `main`, and deploying are
three separate asks, and approval of one is never approval of the next.
`GITHUB_TOKEN` in this environment is dead and `origin` is a local bundle, so
the founder pushes.

Committing locally is free. Landing is not.

**Stop at "Ready for human review. Not merged."**
