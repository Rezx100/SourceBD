# REZ-A (the code port of the buyer dashboard v3.2 kit) — hand-off after cycle 9

Supersedes `handoff-rez-a-cycle5.md` for state and order of work. That file is
still the reference for the cycle-5 findings and for **"What this kit
deliberately does not carry yet"**, which has been extended twice since and is
where the deferrals live. Read both.

---

## Where the work stands in one paragraph

Nine audit cycles. The branch is `rez-a-dashboard-kit`; the last frozen
candidate is **`8c087c6`**, which has not yet been audited. `0fbf986` (cycle 8)
was rejected by all four critics, and every one of their blocking findings is
repaired in `8c087c6`, each with a guard that was watched failing under its own
revert. All four gates are green. **Nothing is merged and no promotion has been
asked for.** The loop ends only when an Acceptance Judge returns the literal
token `ACCEPTED_FOR_HUMAN_REVIEW`; it has never been reached.

---

## The one thing to understand before changing anything

Every cycle since 6 has been rejected for the same underlying reason, in a new
place each time: **a screen states something the data does not support, and the
test that was supposed to catch it was checking the wrong thing.**

- Cycle 7 compared row *counts*, so three fixtures showed "no lines on the EPB
  page" over records holding 14, 34 and 18 — and the test recorded the
  fixture's own zero as production's number.
- Cycle 8 shipped screenshots the page could not produce: the harness passed a
  third argument to the loader that `page.tsx` did not, so the evidence showed
  supplier names the real screen never renders.
- Cycle 8 also carried seven RFQs from three buyers as one account's list, and
  drew every RFQ target one trust rank too high from a hand-written literal.

The pattern to watch for is a guard whose oracle comes from the thing under
test. `fixtures.test.ts` now compares against a checked-in production read;
`tokens.test.ts` no longer generates its contrast suite from the table it
checks; `harness.test.ts` parses both call sites rather than trusting either.
When you add a guard, ask where its expected value came from.

---

## What is in the tree

| | |
|---|---|
| Branch | `rez-a-dashboard-kit`, merge base `09ec96b` (`development`) |
| Last commit | `8c087c6` — **not yet audited** |
| Previous candidates | `0fbf986` (cycle 8, rejected ×4) · `289f5c0` (cycle 7, rejected ×4) · `aa35ae3` · `5835cf6` |
| Dashboard suite | 473 tests, ~13 s — `/home/claude/dash-test.sh` |
| Full suite | 1,048 at `0fbf986`; re-run needed at `8c087c6` |
| Lint | 14 warnings, the baseline; none in the kit's own directories |
| Mutation harness | `/home/claude/mutate.py`, 144 entries |

### The files the kit is

```
lib/dashboard/
  fixtures.ts               the production mirror everything renders from
  fixtures.production.json  the READ — written straight out of the RPCs
  fixtures.test.ts          reconciles the two, field by field, row by row
  build-models.ts           the builders (largest file; read its comments)
  facts.ts  source-tiers.ts  models.ts  gallery-data.ts  hs-photos.ts
lib/design/tokens.ts        the only place a colour is written
components/dashboard/*      the kit
app/dev/ds/page.tsx         the page that ships
app/dev/ds/dashboard-screens.tsx   the composition layer
scripts/gallery/            the screenshot harness, and its own test
```

---

## What to do next, in order

1. **Freeze `8c087c6` and audit it.** It carries a whole cycle of repairs that
   no critic has seen. Run the four gates, regenerate the screenshots, build
   the bundle, then fan out four fresh critics and the Acceptance Judge.

2. **Finish the mutation sweep.** A clean end-to-end run was in flight when
   this hand-off was written — `/home/claude/gate/mutations/sweep-final.log`,
   144 entries, ~60 min at the suite's current size. It is the first run with
   every anchor current, so it is the one to quote. If it did not finish,
   restart it; do not quote the earlier logs (`sweep9.log` used a pre-edit
   anchor list and reports SKIPs that were already repaired).

   Individually verified RED after their guards landed, so the sweep should
   confirm rather than discover: all 33 `c9-*` entries, and the five anchors
   repointed this cycle — `f8-workers-no-coverage`,
   `f12-cert-subline-early-return`, `f17-every-mark-links-on-zero`,
   `c8-rfq-row-drifts`, `c8-locations-counts-rows`.

3. **Ship the sweep's own output.** The cycle-8 bundle reported "0 skipped"
   while its log said 2, and shipped a one-row `summary.json` — a filtered run
   had overwritten it. That is fixed (filtered runs write
   `summary-<filter>.json`), but the rule now is: run the sweep end to end and
   ship the log and summary **that run produced**, with the numbers quoted from
   them. Do not hand-write the headline.

4. **The non-blocking findings nobody has addressed yet.** Listed at the end of
   this file. None is a lie on a screen; several are guards that do not
   discriminate.

---

## How to work in this environment

Nothing builds on the founder's machine (pnpm junctions fail through the mount,
no registry access), so the source is snapshotted into a container and worked
on there. **Node 22, not 20** (`export PATH=/opt/node22/bin:$PATH`).

```
cd /home/claude/sb
export PATH=/opt/node22/bin:$PATH
/home/claude/dash-test.sh              # 473 tests, ~13 s — use this loop
pnpm exec tsc --noEmit                 # must be exit 0, no output
pnpm test                              # ~15 min; the address-dedup fixture is ~8 of it
pnpm exec next lint                    # 14 warnings is the baseline
python3 /home/claude/mutate.py         # the whole sweep, ~25 min
python3 /home/claude/mutate.py c9-     # one family
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  GALLERY_OUT=/tmp/yours ./scripts/gallery/regen.sh
```

`next build` fails on the baseline and the candidate alike: other pages fetch
Google Fonts and the container has no route to `fonts.googleapis.com`. CI has
network.

Production is read-only through the Supabase MCP `execute_sql`, project
`stnrfxrxfonwexzcvvpv`. **Use it.** Every number a screen states should be
re-checked against it; three cycles of findings came from doing that and two
came from not doing it. The container cannot reach Supabase over the network,
so the page renders from fixtures.

### Traps this environment has set before

- **The mutation runner compiles before it tests** (`tsc || exit 1`), so a
  mutation that does not type-check exits non-zero with no test having run.
  That is the compiler, not a guard. The harness reports `NOCOMPILE`
  separately — do not let it score as caught.
- **An interrupted sweep used to leave a source file mutated**, and the next
  run then measured a tree that was not the candidate. The harness restores on
  SIGINT/SIGTERM/SIGHUP now, but check `git status` after any interruption.
- **A Python `rep()` script that asserts mid-way aborts before writing**,
  silently discarding every earlier edit in the same script. Re-grep after any
  failure.
- **A revert that changes no behaviour scores a false RED.** Four have been
  found and repointed. When you add a mutation, confirm it actually changes
  rendered output.
- **Never edit `mutate.py` while a sweep is running.** Python has already read
  the list, so your repointed anchors are not used and the run reports SKIPs
  you have just fixed. Two sweeps were wasted this way.
- **An anchor goes stale the moment you repair the line it points at.** After
  any repair, re-run the families that touch that file before trusting a
  headline. `grep -c '^ ("' /home/claude/mutate.py` is the entry count; the
  sweep's own summary line is the only number to quote.

---

## The guards, and what each is for

Read these before adding another; most classes are already covered.

| file | what it holds |
|---|---|
| `fixtures.test.ts` | every field of every row against the production read, plus: no invented URL host, no shared id, no sanctioned real company, every building name exported, every source code ranked |
| `build-models.test.ts` | the builders, the attribution rules, `recordPage`'s false positives, the register labels, the Locations dedupe, the RFQ row's shapes |
| `render.test.ts` | the boundary — rendered HTML for every screen, the sanction, the no-score sweep, the long name, ARIA state, unread-is-not-zero |
| `dashboard-screens.test.ts` | the composition layer: what the page hands the components, the AI switches, the anchors, the frame width |
| `harness.test.ts` | the screenshot harness, and that it and the page call the loader identically |
| `tokens.test.ts` | the token file: 67 contrast pairs, the ramp, the density stops, the type scale, the radius scale, the CSS variable names |
| `gallery-data.test.ts` | the loader: the RPC argument names, the RFQ aggregation, unknown-vs-zero on every failed read |

---

## Known, recorded, and not yet done

These came from the cycle-8 critics and are all **non-blocking**. None makes a
screen state something false; each is either a guard that cannot discriminate
or a small wording matter.

**Guards that cannot fail, or subjects that cannot discriminate**

- `hs-photos.test.ts` compares `rarestFirst(codes, 3)` against its own output,
  and its "collapses 6-digit codes" case passes whether the code collapses or
  is discarded.
- `recordPage`'s empty-path early return is unreachable from the test list; the
  distinguishing shape is a root URL carrying a query (`https://x.org/?id=71`).
- `buildProductSheet` is only built for Aboni and A.R. Fashion, so
  `epbExporter().pages` is never exercised — the "+1 more exporter page" line
  (14 published records) can be deleted invisibly.
- No fixture reduces to one non-stopword token, so `initials()`'s documented
  fallback for 256 published names is unguarded.
- 20 of the 31 `REGISTRY` codes have no stamp or label guard.
- `sourceHrefs`' "a pill's URL wins over the provenance row's" has no guard.

**Wording and small arithmetic**

- `certScheme` title-cases: "OEKO-TEX Made In Green" where the scheme is MADE
  IN GREEN (71 certificates). `STeP` is special-cased correctly.
- ≤622 published all-caps names carry a 2–3 letter token that is neither a word
  nor in `KEEP_UPPER`: "HKD INTERNATIONAL" → "Hkd International". Cosmetic.
- "Nothing else on file · 1 of 25 sources" counts 25 configured sources, 11 of
  which hold no records for anybody — the same standard that made the brand
  negative say "4 brand lists read" rather than 6.
- The topbar's "records read 18 Sep 2026" is `max(last_seen_at)` over the four
  records on the page, printed beside "10,266 published suppliers".
- `lib/hs-catalogue.ts`'s `exporters` counts were read 18 Sep and several are
  off by one today; `otherExporters` is an unattributed build-time constant on
  a screen whose rule is that every number traces to a register.
- `factoryAddress` has no tie-break when two `factory` rows are both strict
  supersets of `address_raw` (15 published records, ~5 materially different).
- The card's "+N more" chip links and `LockCard`'s "What is hidden" are
  `href="#"` with no `aria-disabled`, unlike the sheet tabs and the composer
  rail.
- `app-shell.tsx` and `search-composer.tsx` have thin coverage.

---

## Promotion gates — none of them has been asked for

AGENTS.md 9a: landing on `development`, promoting to `main`, and deploying are
three separate asks, and approval of one is never approval of the next. None
has been requested or given. `GITHUB_TOKEN` in this environment is dead, so the
founder pushes.

Committing locally and pushing a feature branch are free. Landing is not.

**Stop at "Ready for human review. Not merged."**
