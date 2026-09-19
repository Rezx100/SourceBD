# REZ-A (the code port of the dashboard kit) — hand-off at cycle 5

Written 19 Sep 2026. Read this, then `git log --oneline -8` on branch
`rez-a-dashboard-kit`. Everything below is verified state, not a plan.

## Where the work stands in one paragraph

The kit is built and the six screens render from real data. It has been
through **five adversarial audit cycles**. Cycles 1–4 closed: each found
defects, each was repaired, and candidate 5 (`5835cf6`) passed every
mechanical gate — `tsc` clean, `pnpm test` 770 passed / 0 failed / 105 suites,
`next lint` 14 warnings matching the baseline. **Cycle 5 then rejected it from
three independent critics at once**, and those findings are the real remaining
work. A partial repair is committed on top as `497b8a4`, deliberately
incomplete. Nothing has been pushed, nothing merged, nothing deployed.

## The two commits that matter

- **`5835cf6` — candidate 5.** The last fully green state. `tsc` exit 0,
  770/770 tests, lint at baseline, screenshots regenerated from this SHA.
  If you want a clean base to work from, this is it.
- **`497b8a4` — cycle-5 repairs, WIP.** On top of candidate 5. `tsc` still
  clean, but **7 dashboard tests fail and lint is 18 warnings (4 over
  baseline)**. Both are expected and explained below. Do not treat this as a
  regression to bisect.

## Why candidate 5 is not acceptable despite being green

The closed-loop protocol (`.cursor/rules/sourcebd-closed-loop.mdc`) says a
green suite is evidence, not completion. Cycle 5 proved that precisely. The
test-adequacy critic took a copy of the repo and mutated it eleven times —
removing the sanction warning from the card, the table row and the sheet;
inserting a literal `SourceBD score 92 % match ★★★★` onto three surfaces;
breaking the Safety section's scroll; turning every AI surface back on;
flattening the source-rank colour ramp — and **all 770 tests passed every
time**. The guards that exist pin the exact branches earlier cycles repaired
and nothing adjacent to them.

## The cycle-5 findings, grouped by what they cost

Full text of all three critic reports is in
`/home/claude/gate/audit-cycle-1.md` (append cycle 5 there — it was not
written before the hand-off) and in the session transcript. The condensed,
de-duplicated list:

### Blocking — a screen states something the data does not support

1. **The sanctioned state never reached the RFQ composer or the RFQ list.**
   Two of the six screens have no sanction handling at all: no banner, no
   model field, and "Send RFQ" goes green as soon as four fields are filled.
   `ds-rebuild-must-stay` §2 says the warning appears on every surface and
   cannot be hidden by layout; §3.6 says the composer's Send is disabled until
   every supplier is published and not sanctioned. Cycle 4 fixed this on the
   product sheet and it was not carried across.
2. **Registrations inherited from a parent factory print as the record's own.**
   `v_supplier_registry_ids` unions a parent's pills onto a satellite record
   and marks them `inherited_from`; the kit had no such field and no filter, so
   a satellite showed the parent's EPB and BGMEA numbers with tier-1/tier-2
   marks linking to the parent's register pages. *Partly repaired in `497b8a4`.*
3. **Negatives asserted without a read.** The table row printed "not on EPB
   list" for a record that holds an EPB registration (the card, repaired in
   cycle 4, said the opposite for the same record). A building's registrations
   vanish entirely, producing "not in BGMEA…" on a record whose payload
   carries a BGMEA pill — while the same building's certificate still counts
   toward the source total, so the head shows a GOTS mark above a Certificates
   section reading "No certificate on any register". *Partly repaired.*
4. **A failed `rfq_list` read renders as the fact "you have no RFQs"**, in the
   empty state written to sell the feature. `hscodesError` and `discoverError`
   exist; there is no `rfqError`.
5. **The fixtures were not the production mirror they claimed to be.**
   Repaired in `497b8a4` — see below.

### Blocking — receipts that point at the wrong thing

6. A record with two EPB registrations showed page A's exporter id, page B's
   source mark and the register-wide latest read date, all on one row.
   *Repaired in `497b8a4`.*
7. Source marks linked to agency front pages (`rsc-bd.org`, `bgapmea.org`,
   `bkmea.com`) while their accessible name promises "opens the register page"
   — 43 such anchors in the rendered gallery. *Repaired in `497b8a4` via a new
   `recordPage()` rule, the same rule `lib/epb-hscodes.ts` already applies.*
8. The worker figure is a group sum across the mother and its buildings
   (Aboni: 3,166 = 2,662 + 504) printed bare under a single RSC mark. The
   production profile renders the same number as "3,166 across 2 of 2 sites".
9. The ProductSheet prints "HS nnnn · EPB EXPORT LINE" and stamps a hardcoded
   chapter name with an EPB mark for a record on no EPB register, then
   contradicts itself three rows down with "this line is not on the record's
   EPB page".

### Should fix before review

10. `Certified scope` drops the `Products:` half of the scope string — the
    only part saying what the certificate covers — and truncates 10 operations
    to 3 with no "+N".
11. The HS-lines stat names one chapter taken from the rarest heading; S M
    Knitwears spans chapters 61 and 62, so nine lines are silently unclaimed.
12. An expired certificate disappears from the card and table whenever another
    is expiring (`certTileSubline` returns early).
13. "not on 6 brand lists" counts BRAND_INDITEX and BRAND_PRIMARK, which hold
    zero companies. Verified by SQL 19 Sep: ASOS 43, H&M 199, M&S 67, NEXT 76,
    Inditex 0, Primark 0.
14. The locked contact card and the composer both promise "the supplier's
    reply lands in Messages". Aboni, S M and A.R. Fashion are all unclaimed,
    and §1 says an unclaimed supplier never hears about the RFQ until REZ-D
    ships behind `RFQ_EMAIL_UNCLAIMED`.
15. The pager reads "1–4 of 42 · 25 per page · Page 1 of 2" over a four-row
    panel, with Next enabled and no page 2.
16. `NaN %` and `aria-valuenow="NaN"` when an RSC row omits `progress_pct`
    rather than nulling it; `null suppliers` in the panel header when
    `total_count` is non-numeric and `discoverError` stays false.
17. "Every source mark links to its register page" renders on a record with
    zero source marks (`[].every()` is true).
18. 18 links to `#sources`, `#locations`, `#facilities`, `#rfqs`, `#hidden` —
    anchors that do not exist. The approved fragment uses inert `href="#"`.
19. The six-tile photo strip overflows the 1440 screen by 110px: the sixth
    tile is clipped and the "+N" pill sits on top of it. Visible in
    `shots/results-list.png`.
20. Accessibility: the whole Export-lines column is `title` text on a
    non-interactive span; `role="checkbox"` with no `tabindex` anywhere in the
    kit; two unnamed `<th scope="col">`.
21. `· no expiry on file` — a stray leading middle dot in the certified-scope
    badge and in the composer's supplier-facing preview.
22. Smaller wording: the card says "not in BGMEA or BKMEA" where the sheet
    says four registers (and both omit BTMA, which is read); the sheet button
    reads "Save to list" where §8 settled on "Save"; the photo caption wording
    differs from §6.

### Test guards the audit proved are missing

Each of these is a §16 obligation — a defect a cycle found must leave a guard
that catches its class again. The adequacy critic demonstrated each by
mutation with the suite still green:

- A fixture whose `supplier.is_sanctioned` is genuinely true, rendered through
  the card, the table row and the sheet. *`sanctionedInput()` now exists in
  the fixtures; the tests are not written.*
- The "no score, grade, star or verified badge" assertion on the sheet, the
  table and the product sheet — today it guards the card only.
- `buildProductSheet` with an HS the record does not export (every existing
  call passes "6105", which Aboni does export), so the cycle-4 `exported`
  guard is never executed.
- The RSC read date coming from the row's own `fetched_at`, and no meter when
  progress is unknown — both cycle-4 fixes, both unguarded.
- `SheetScroll`'s `overflow-y-auto` — the cycle-1 Safety fix, unguarded.
- The page-composition layer. `dashboard-screens.tsx`, `AppShell`,
  `PanelHeader`, `PanelFooter` are imported by zero tests. This is the REZ-72
  shape verbatim: the components prove they hide V2 surfaces when the prop is
  false; nothing proves the caller passes false.
- `hscodesError` rendered in HTML (model-level only today).
- The tier colour ramp reaching the DOM.
- The "no photo yet" fallback — that string appears in no test file.
- `gallery-data.test.ts` compares `discoverArgs()` output against
  `discoverArgs()` output; it cannot fail. Renaming `p_min_sources` to
  nonsense keeps it green.
- Untested requirements: the 125-character name (fixture now added), the
  54-code and 39-product lists, the pager, `PanelHeader`'s singular/plural,
  `topbarCaption`, the sidebar plan literal, reduced motion.
- `lib/design/tokens.test.ts` guards the right directories but misses
  `lib/hs-catalogue.ts` and `scripts/`, and has no rule for off-token radii
  (the cycle-1 `rounded-[4px]` defect can return green).

### Evidence reproducibility

`regen.sh`, `render-gallery-fixtures.ts`, `shots.mjs` and
`register-real-icons.cjs` live only in `/home/claude/gate` and are tracked
nowhere, so a fresh clone cannot regenerate the screenshots. `regen.sh`
compiles against `/tmp/tsconfig.render.json` — a file outside the repo — and
swallows compile failures with `|| true`, then stamps the current SHA
regardless of whether the tree was dirty. These four files should move into
the repo (`scripts/` or `design/`), the `|| true` should go, and the stamp
should refuse a dirty tree.

## What `497b8a4` actually changed

**`lib/dashboard/fixtures.ts`, rewritten from production reads taken 19 Sep
2026** via read-only SQL. The old file's header claimed it mirrored
production; it did not. Divergences found: Product list 6 vs 27, Locations 2
vs 9, five provenance rows vs thirteen, one RSC row vs two (the mother plus
"Aboni Knitwear (New Shed)"), a null boiler report that production holds, a
GOTS `document_url` dropped, a certified scope trimmed from ten operations to
three. Worse, four values existed nowhere in production: a mailing address
"HOUSE 12, ROAD 2, DHAKA", Zaheen's RSC id (1188 for the real 24449), Zaheen's
slug (`zaheen-knitwears-…` for the real `zaheen-knitwear-…`), and a BGMEA page
URL on A.R. Fashion whose pill really carries `source_url: null`. Those were
attached to named real companies, which `ds-rebuild-must-stay` §2 forbids
outright. The new file adds `LONG_NAME_125` (a real 125-character record) and
`sanctionedInput()`.

**Builder repairs, all in `lib/dashboard/build-models.ts`:** `ProfilePill`
gains the two inheritance columns and a new exported `ownPill()`;
`allSourceCodes` stops counting a building's certificate; `sourceHrefs`
prefers the record's own pill page and rejects agency homepages through a new
exported `recordPage()`; `hasEpbRecord` ignores inherited pills; `brandLabels`
deduplicates; `epbExporter` returns the read date of the exporter page it
names; `WorkersDisplay` carries `fetched_at`.

**Declared but not wired**, which is where the four extra lint warnings come
from: `MEMBERSHIP_WORDS` (the corrected "not in BGMEA, BKMEA, BGAPMEA, BTMA or
EPB" literal), `certBuildings`, `pillBuildings`, `brandListsChecked`. They are
scaffolding for findings 3, 13 and 22 — wire them or delete them.

## The seven failing tests, and why not to just make them pass

`components/dashboard/render.test.ts` ×1 and `lib/dashboard/build-models.test.ts`
×6. They fail because they assert the old fixture's values. Two of them were
pinning defects the audit named explicitly:

- `render.test.ts` asserts `/Boiler · not on file/`. Production holds a boiler
  inspection URL for Aboni. That assertion was enforcing a fabricated negative
  about a safety register — **delete it, do not restore the null**.
- `build-models.test.ts` asserts the factory address mark is BGMEA. The two
  `factory` rows whose text equals the shown address are BKMEA; the BGMEA row
  carries a different address. The builder was always right; the fixture was
  wrong. **Expect BKMEA.**

The other five (tab counts, fact rows, the almost-empty record, the product
sheet, mark links) need their expected values updated to production's real
numbers — 27 products, 9 locations, GOTS/OEKO-TEX/WRAP marks that now link
because the pills carry document URLs, and the RSC mark which correctly no
longer links because `rsc-bd.org` is a homepage.

## How to work in this environment

The founder's machine mounts `E:\SourceBD`, but its pnpm `node_modules` are
junctions that fail through the mount and it has no registry access, so
**nothing builds there**. All building and testing in this session happened in
a cloud container on a source snapshot:

- Candidate tree: `/home/claude/sb` (branch `master` in the snapshot,
  representing `rez-a-dashboard-kit`, cut from `development` 09ec96b).
- Merge base for review diffs: `680fc2a`.
- Baseline worktree: `/home/claude/sb-base`. Evidence bundle:
  `/home/claude/gate`.
- **Node 22 is required** for `pnpm test` (`export PATH=/opt/node22/bin:$PATH`).
  CLAUDE.md's "Node 20 only" line is stale — Node 20 cannot expand the
  `.tests-build/**` glob.
- Playwright needs `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- The container cannot reach Supabase over the network; production reads go
  through the Supabase MCP `execute_sql` (read-only), project
  `stnrfxrxfonwexzcvvpv`.
- `next build` fails on the baseline *and* the candidate here because other
  pages fetch Google Fonts and there is no route to them. CI has network.
- Several repo files are CRLF: `app/layout.tsx`, `context/current-state.md`,
  `context/feature-specs/active.md`,
  `test-stubs/register-node-test-aliases.cjs`, `tsconfig.npm-test.json`.
  Restore CRLF after editing them or the diff fills with noise.

## Baselines to compare against

| gate | baseline (`680fc2a`) | candidate 5 (`5835cf6`) | WIP (`497b8a4`) |
|---|---|---|---|
| `pnpm exec tsc --noEmit` | exit 0 | exit 0 | exit 0 |
| `pnpm test` | 654 / 86 suites | 770 / 105, 0 fail | 7 failing, on purpose |
| `next lint` | 14 warnings | 14, none in changed files | 18 (4 new, unwired helpers) |
| `ruff check etl ops` | 43 (ruff 0.15.11) | 43 | 43 |
| `pytest -q etl/tests` | 999 pass / 25 fail | identical failing set | unchanged |

The 25 pytest failures are `test_github_https_fetch_auth` — a git-over-HTTP
fixture the container's proxy blocks. Environment, not the change.

## What to do next, in order

1. Read the three critic reports in full before changing anything. They carry
   reproductions; do not re-derive them.
2. Decide the fixture-test question first, because everything else depends on
   the fixtures being trustworthy: update the seven tests to production's
   values, deleting the two assertions that pinned defects.
3. Work the blocking list (1–9). Finding 1, the missing sanction on two
   screens, is the one that would most embarrass a demo.
4. Add the missing guards. Prefer the boundary — rendered HTML — over helper
   assertions, per §14. Verify each guard by reverting the fix and watching it
   fail, the way the adequacy critic did; a guard you have not seen fail is
   not a guard.
5. Move the evidence scripts into the repo and make `regen.sh` refuse a dirty
   tree.
6. Re-run the four gates, regenerate the screenshots from the new SHA, then
   fan out the three critics again on that frozen SHA, then the Acceptance
   Judge. The loop ends only on the literal token
   `ACCEPTED_FOR_HUMAN_REVIEW`.

## Promotion gates — none of them have been asked for

AGENTS.md 9a: landing on `development`, promoting to `main`, and deploying are
three separate asks, and approval of one is never approval of the next. None
has been requested or given. `GITHUB_TOKEN` in this environment is dead, so
the founder pushes. Stop at "Ready for human review. Not merged."
