# SourceBD - Current State

Last compacted for agent-token efficiency: 30 Jun 2026.

## Phase
Phase 7 - Public Beta launch prep.

## RSC is an unused independent workforce referee — REZ-101 filed
5 Aug 2026 — found while auditing the founder's `KNIT BAZAAR (PVT.) LTD.`
report (publishes 290 production workers; its own RSC card shows 1,350).

**RSC never competes for `employees_total`.** Source-exclusivity in
`ops/backfill_profile_columns.py` is BGMEA + BKMEA. `rsc_remediation.workers_count`
enters only via `ops/backfill_rsc_employees.py`, which is COALESCE fill-only —
so the moment either association reports anything, an audited third-party
headcount is discarded. **802 published suppliers publish fewer workers than a
single RSC-audited building holds** (305 publish less than half).

**Decision: RSC is a FLOOR, not an outright winner.** `workers_count` is
per-factory and RSC coverage is partial, so publishing *more* than RSC is
usually a company larger than its audited building — only publishing *less* is
proof of error. A straight win was rejected: it would cut 693 suppliers, 148 by
more than half. Use `active` factory rows only (626 rows are inactive; the
affected set drops 828 → **606**). When RSC wins, the gender split is blanked —
RSC publishes no gender breakdown. **Once facilities roll up (REZ-71, REZ-92)
the floor must be computed at group level**, or a merged mother is floored by
one building's audit.

**This vindicates REZ-95 independently.** Across 618 suppliers with both a BGMEA
cohort payload and an RSC count, `Male + Female` is closer to RSC on 398 vs 101
for the management-inclusive figure; median ratio **1.022** vs **1.629**. It
also **contradicts REZ-96**, whose exceeds-band is not understated (94 of 103
favour `Male + Female`) — flagged on that issue, re-scope before starting.

Context: **2,596** published suppliers hold a BGMEA `employees` payload with
`Management` populated and both worker cohorts blank, so BGMEA contributes no
workforce figure at all for them post-REZ-95.

## Repair script on the A8 rule + field locks — REZ-89 (A8b) COMPLETE
5 Aug 2026 — code correctness only; **the repair was NOT run against
production** and the `--apply` gate stays closed. `ops/repair_bgmea_conflations.py`
held a second implementation of the profile projection rules and had not been
updated by A8 (REZ-68), A6 (REZ-66) or REZ-95, so a rerun would have undone all
three at once.

- **Numerics are now the A8 rule**, not max-merge: highest `source_tier` with a
  non-zero value, then most recent `fetched_at`, then lower `source_records.id`.
  `_numbers_from_record` now takes the whole record (it needs tier/fetch/id) and
  returns `NumericCandidate`s rather than ints, which makes the old `max()`
  merge unexpressible at the call sites.
- **Both callers changed.** `_recompute_parent` picks the winner over the
  parent's remaining records. `_merge_into_profile` now recomputes over every
  active BGMEA/BKMEA record the *destination* holds, including the one just
  moved in — a lone record cannot be ranked against a stored column, because the
  column carries no provenance. Consequence: the projection can now lower a
  destination's value. That is A8 working, not a regression.
- **`employees_total` is `Employee Male + Employee Female`** (REZ-95 parity).
  The old code max()'d *every* value in the BGMEA `employees` payload into
  `employees_total`, `Management` included — on the 227-record band where the
  first column exceeds the whole worker count, an apply would have published the
  management figure under the "Production workers" label.
- **A6 locks now hold.** `_locked_columns` filters both `rest.patch("suppliers")`
  bodies; `bgmea_reg_numbers` (added to the recompute body by REZ-98) is
  lock-checked like any other column, and a fully-locked supplier is not patched
  at all rather than sent an empty body.
- **Non-goals honoured:** `_compatible` / conflation detection untouched
  (REZ-87), array-union and fill-only scalars untouched, and REZ-98's
  backed-set recompute for `bgmea_reg_numbers` is unchanged.

**Standing proposal, deliberately NOT implemented.** The projection helpers are
still duplicated between this script and `ops/backfill_profile_columns.py` —
that duplication is the root cause of all three defects, and it will drift
again. Extracting them into one importable module (e.g. `etl/core/`) is the
right fix but wider than REZ-89 authorises; a direct import is not a substitute,
because `backfill_profile_columns` imports `psycopg` at module scope and the
repair script exists precisely because the pooler is unreachable. Raised for a
separate issue.

**Residual divergence, known and left alone:** the canonical script gates BGMEA
`num_machines` on `entity_type = 'factory'`; the repair script gates only on the
`_CAPS` range. Narrowing it is a behaviour change beyond this issue.

Tests: pytest 764 (749 baseline + 15), ruff at the 44 pre-existing baseline,
`npx tsc --noEmit` and `npm test` clean.

## BGMEA reg-number array provenance — REZ-98 (option (a) shipped; array repair follows)
5 Aug 2026 — **founder decision: option (a), backed-only display.** Migration
`20260805_rez98_registry_ids_bgmea_backed_only.sql` **APPLIED to production
5 Aug 2026**; the live view returns 5,970 numbers / 5,740 suppliers / 199
multi-number, matching the dry-run exactly. Plus two append-path guards.
Read-only
`ops/report_bgmea_array_provenance.py` + pins in
`etl/tests/test_bgmea_array_provenance.py` and
`etl/tests/test_bgmea_backed_only_display.py`.

**The display rule.** The view's BGMEA branch now requires the supplier to hold
an active BGMEA record for that number (`source_ref = 'general:'||value`, or
the payload field for `member:{id}`-keyed rows). Every other branch is
unchanged. Dry-run as a SELECT against production, the predicate reproduces
exactly: **6,775 → 5,970 rows, 5,801 → 5,740 suppliers, 664 → 199
multi-number**. Option (b) was rejected — a registration belonging to another
company is not "unverified", it is wrong, and relabelling keeps a false
identity claim in softer wording.

**The guards.** `_apply_source_specific` now refuses to append a number whose
active record sits on a *different* supplier (`_bgmea_reg_held_elsewhere`),
logging `bgmea.reg_append_refused`; the other fragments still write, so only
the disputed number is withheld. `repair_bgmea_conflations::_recompute_parent`
now recomputes `bgmea_reg_numbers` from the parent's remaining active records
the same way it already recomputes the numerics — dropping only elements
nothing backs. That omission is what stranded the 805. Kept here rather than in
REZ-89, whose non-goals explicitly protect the array-union behaviour of
`_merge_into_profile` (a different function on the destination side).
**Honest limit:** the append guard closes the cross-holder assertion, not the
false attach that put the record there — that is `_find_existing`'s job
(REZ-90).

**SBI contamination — the founder's catch, and it is worse than the array.**
`etl/scoring/sbi.py` Pillar 1 grants +5 on `_has_tag("BGMEA") or
inputs.bgmea_reg_numbers`, plus a register-coverage +4. Measured (scorer NOT
changed):

- 5,740 of 5,801 hold at least one backed number → **no SBI change**. The
  contamination is confined to the **61** entirely-unbacked suppliers.
- **All 61 also carry the `BGMEA` source_tag, and none holds any active BGMEA
  source record.** `source_tags` is unioned append-only by `_enrich_supplier`
  exactly like the array, so the tag is a *second* residue carrying the same
  false claim. **Repairing only the array would not move a single score** —
  the `or` short-circuits on the tag. The repair must clean `source_tags` too,
  or the scorer must key on records.
- **5** of the 61 hold no other register, so they also carry the +4
  coverage bonus: **+9 of Pillar 1 (max 25) on no BGMEA evidence at all.**

**Known limit, accepted:** per-number verification is not currently possible —
190 citable `bgmea_reg_number` claims against 6,775 displayed numbers.
Backed-only is the interim proxy for provenance.

**Mechanism (read from the writers, not inferred).** BGMEA is the only register
in `v_supplier_registry_ids_direct` whose pill comes from a denormalised column
— `unnest(suppliers.bgmea_reg_numbers)`. EPB, BGAPMEA and BTMA all derive from
`source_records`, RSC from `rsc_remediation`, certs from `certifications`
(verified against the LIVE `pg_get_viewdef`, not just the migration file). An
entry arrives in **two steps, both required**:

1. `etl/core/upsert.py::_apply_source_specific` appends the scraped number with
   `distinct unnest(existing || ARRAY[reg])` after `_find_existing` attaches
   another company's record on a partial (contact) match. Arbella Fashion and
   Avant Garments share `arif@arbellafashion.com` and one Gulshan mailing
   address — that is the Pass 2/3 pre-31-Jul contact-overlap class.
2. `ops/repair_bgmea_conflations.py` (applied 4 Aug, 808 stowaways, ~790 records
   moved) later moves the record to the right supplier, but `_recompute_parent`
   rebuilds only the numeric `DERIVED_COLUMNS`. **The record leaves; the number
   stays.**

**No writer ever removes an element.** All four union: `upsert.py`,
`merge_duplicate_suppliers.py` (`ARRAY_COLUMNS`), `fix_quality.py`,
`repair_bgmea_conflations.py::_merge_into_profile`. The array is append-only
with no compensating delete on any split, move or record-delete path.

**Still growing?** Only on new false matches. `_source_record_unchanged`
returns early on an unchanged re-scrape, and Pass 0 pins an already-ingested
`general:{reg}` to whoever holds it now, so repaired records will not re-append
to the old host — the existing residue is frozen. `bgmea_web` has **no
`etl_schedules` row** (last success 24 Jul 2026, 4,285 records), so growth is
manual-run only. The append path itself is live and unguarded.

**Measured in production (5 Aug 2026).** 5,801 published suppliers display
6,775 BGMEA numbers; **805 are unbacked**.

| class | suppliers |
| -- | -- |
| >1 number (the REZ-98 class) | **664** |
| — every number backed | 165 |
| — some unbacked | **493** |
| — entirely unbacked | 6 |
| single number, that one unbacked | **55** |
| >1 active source record (REZ-88) | 199 — a strict subset of the 664 |

**All 805 unbacked numbers are live active records on a different supplier.
Zero phantoms, zero inactive-only.** So this is a data repair, not a purge —
nothing was fabricated. 666 of the 805 point at a supplier created on
2026-08-03, the conflation-repair burst (666 suppliers created 21:19–22:07).

**Display-rule options (founder decision, NOT taken).** Option (a) backed-only
removes 805 numbers from 554 suppliers, drops the BGMEA pill entirely for 61,
and takes 459 from multi to single — leaving **exactly 199** still multi, i.e.
precisely REZ-88's population. Option (b) honest per-number provenance removes
nothing and relabels 805.

**Per-number verification is not currently possible.** `bgmea_verified` is one
supplier-level boolean applied to every element. The citable substrate is
**190 active `bgmea_reg_number` evidence claims against 6,775 displayed
numbers (2.8%)**, all minted in a 12-minute window on 30 Jul 2026. Contrast
`bkmea_reg_number`: 2,578 active claims for 2,578 published numbers — 100% —
because the scalar column is **overwritten** rather than unioned. Overwrite
self-heals; append-only union accumulates residue. The only per-number oracle
in use, `ops/_tmp_bgmea_live_members.json` (4,285 members), is gitignored under
`ops/_*` and therefore not reproducible in CI.

Did NOT touch: REZ-88's detector, REZ-90's plan, `employees_total`, any array,
any supplier split/merge/publish state.

## Production workers projection — REZ-95 COMPLETE (REZ-91 ROLLED BACK + RE-DERIVED)
5 Aug 2026 — `employees_total` is **production workers** = `Employee Male +
Employee Female`. REZ-91's `sum()` over BGMEA's three employees keys was a
regression: its `max()` **diagnosis** was right, the `sum()` **remedy** was
wrong, because BGMEA's first column (`Management`) does not reliably mean
management. On `fakir-fashion` it reads 18,547 while Male 9,274 + Female 9,273 =
18,547 exactly — it is restating the total.

**The argument is definitional, not statistical. Lead with this.** BKMEA's
schema holds only `bkmea_employees_male`, `bkmea_employees_female` and
`bkmea_employees_total` — **there is no management key in it at all** — and the
total equals `male + female + others` on **4,037 of 4,039** records (`others` is
~always absent, so it equals `male + female` too). The comparison registry's
total *is* a sum of gendered worker cohorts by construction, so
`Employee Male + Employee Female` is the **identical quantity**, not the nearest
approximation. Any formula adding a third figure leaves the definition the two
registries share. Founder-verified independently.

Supporting evidence, in that order of weight:

*Band comparison* — 198 suppliers hold both a BGMEA cohort payload and an
independent `bkmea_employees_total`. `Male + Female` wins every band, 163 to 35
overall:

| band | n | M+F closer | sum closer | mean err M+F | mean err sum |
| -- | -- | -- | -- | -- | -- |
| `Management` ≥ workers | 55 | **46** | 9 | **686** | 2,064 |
| `Management` 50–95% | 27 | **23** | 4 | 1,357 | 2,862 |
| `Management` under 50% | 116 | **94** | 22 | 860 | 979 |

*Inflation bands* — over the 1,607 active BGMEA records holding both worker
cohorts (`Employee Male` + `Employee Female` > 0), reproduced before any code
change:

| band (`Management` vs Male+Female) | records | changed by REZ-91 | mean inflation |
| -- | -- | -- | -- |
| exactly equals | 192 | 165 | **2.0000×** |
| exceeds | 227 | 202 | 1.6656× |
| 50–100% | 254 | 223 | 2.3147× |
| under 50% | 934 | 812 | 1.7877× |

The exact-equality band's **2.0000×** is a pure doubling. 165 + 202 + 223 =
**590 suppliers inflated**. The `changed` column sums to REZ-91's 1,390 rows,
which is what ties the bands to the apply.

Corroboration, weaker and deliberately labelled as such:
- **BRAND_NEXT** (Tier 4, n=31) publishes *point-value* `male_workers` /
  `female_workers`. M+F closer on **27 of 31**, mean error 1,184 vs 2,162.
- **BRAND_HM** bracket containment (n=57): M+F inside the disclosed range on
  **33**, sum on 27.

Neither is decisive; BKMEA remains the load-bearing evidence. Brand workforce
fields hold *ranges* (`1001-2000 Workers`, `>4000`); never
`regexp_replace(v,'[^0-9]','','g')` them, which concatenates the bounds into a
plausible-looking integer. `BRAND_NEXT` is the exception — point values with
thousands separators, safe to digit-strip.

**Step 1 rollback — APPLIED to production 5 Aug 2026 and verified.**
`ops/rez95_rollback_employees_total.sql` (Supabase SQL API; psycopg is
protocol-blocked from the dev machine). 1,390 rows restored from
`public._rez91_employees_total_snapshot_20260805`; **10,912 / 10,912**
suppliers now match the snapshot, **0** still differ, **0** sibling-column
movement. Doubled examples restored: `zaber-and-zubair-fabrics` 18,682→9,341,
`momo-fashions` 15,000→7,500, `sterling-denims` 7,404→3,702, `odyssey-craft`
14,000→7,000, `pandora-sweater` 8,600→4,300, `akm-knitwear` 32,677→16,815,
`coast-to-coast` 1,360→650. The restored values are still the old `max()`
cohort — wrong in a known way, which beats inflated figures live in front of
buyers.

Founder decisions (do not re-ask): publish **production workers** =
`Employee Male + Employee Female`; rename the field to **"Production workers"**
on the hero card and the Capacity tab and drop the "workers + staff" subtitle,
**in the same PR as the data change**; **never render** the first-column
figure — keep it in the payload, no placeholder row.

**Step 2 re-derive — APPLIED to production 5 Aug 2026 and verified row for
row.** `ops/rez95_apply_production_workers.sql` (the statement from
`ops/backfill_profile_columns.py` verbatim, run via the Supabase SQL API).
`ops/backfill_profile_columns.py` now carries
`BGMEA_WORKER_COHORT_KEYS = {Employee Male, Employee Female}` plus
`BGMEA_NON_WORKER_EMPLOYEE_KEYS = {Management}` — recognised-but-excluded, so
`Management` is not summed *and* is not reported as an unknown key. SQL `v.key
in (...)` and the Python mirror `_bgmea_production_workers` both changed.

**1,232 rows changed — 1,030 up, 202 down**, 0 fills-from-null, all via BGMEA,
0 via BKMEA, 0 blocked by the 200k cap; matching the dry-run exactly. Verified
against `public._rez95_production_workers_expected_20260805`, materialised
before the write: **1,232 / 1,232** rows at their expected value, **0**
mismatched, **0** rows changed outside the expected set, **0** sibling-column
movement. Largest downward: `saturn-textiles` 27,772→4,326, `eastern-knitwear`
10,000→500. `coast-to-coast` reads **710**.

**Composition of the 202 downward rows** — the count matches the exceeds band's
202 *records*, but the sets are not identical, and the earlier "same 202
suppliers" framing was wrong. Per *supplier* the exceeds band is 199, all 199 of
which are in the downward set, plus **3** others:
`alpha-product-development-company-bd` 475→210, `fm-fashion-wear` 275→165,
`mass-fashion-bd` 264→90. Each holds two BGMEA records where the data is split —
one with `Management` populated and both cohorts empty, one with the cohorts
populated. Under `max()` the management-only record won and published a
management figure as the workforce total; under the new formula it yields no
candidate at all, so the win passes to the cohort-bearing record. Correct
behaviour, and a strict improvement.

**The gender-split guard resolved itself, at scale.** Of the 3,205 suppliers
holding both cohorts, **2,056** rendered a split before the apply and **3,198**
after — **1,142 newly rendering, 0 newly suppressed**. Those 1,142 profiles were
withholding a split they had the data for, because the inflated total
contradicted it. The 7 still suppressed are the genuine cross-source mismatches
the guard exists for.

**Honest limit on the evidence:** it establishes `Male + Female` as the best of
the three candidate formulas and the definitional match to BKMEA — not that it
is *accurate*. Where the first column is a large round number and the gendered
cohorts are small, the published figure may understate a real workforce. Filed
as **REZ-96** (224 suppliers, mean 1.91× gap, 154,648 headcount in dispute);
within that band BKMEA reads *higher* than what we now publish on 17 of the 25
corroborated cases, so it is a real question rather than a theoretical one. It
is a data-quality question about BGMEA's own form, not a formula question.

**Step 3 rename — shipped in the same PR.** Hero card
(`components/supplier/company-profile-header.tsx`) "Employees" → "Production
workers"; Capacity tab (`components/supplier/profile-capacity-tab.tsx`) "Total
workforce" → "Production workers" and the `"workers + staff"` subtitle removed
from both the total and the "Male workers" KPI. Nothing renders the
first-column figure — the profile reads only `suppliers.employees_*` columns,
never the raw BGMEA `employees` payload, so Step 4 needed no removal.

**Gender-split guard — deliberate, keep it (Step 5).** `pickWorkforce` in
`components/supplier/profile-capacity-tab.tsx` withholds the split when
`(male + female) / total` falls outside 0.9–1.1 and sets the card meta to
"gender split unavailable". It is load-bearing and must survive: each numeric
column picks its A8 winner *independently*, so `employees_total` can come from
BKMEA while `employees_male/female` come from BGMEA. It is what suppressed
`coast-to-coast`'s split while the total was inflated to 1,360 against
510 + 200 — it caught the REZ-91 regression that the data layer did not. Post
apply its total is 710 = 510 + 200, ratio 1.0000, and the split renders again on
its own. Documented in-place; no new guard added.

**Consistency is not accuracy** — the corollary, and it matters for REZ-96.
Because the total is now *derived from* the two cohorts, the ratio is 1.0 by
construction wherever BGMEA is the winning source, so this guard can no longer
detect a wrong workforce figure from that source. It only catches cross-source
mismatches now.

**BGMEA labelling question (Step 6, report only — scraper untouched).** Not a
per-member-type markup difference: all 1,607 records carrying worker cohorts
are the single member type `general_manufacturer`, and *within* it 11.9%
restate the total and 14.1% exceed the whole worker count. The parser is
positional — `_parse_inner_kv_table` / `_parse_directors` in
`etl/scrapers/bgmea_web.py` zips the inner table's `<th>` headers to its `<td>`
cells by index — but all 4,238 payloads carry exactly the three expected keys
and no `col{i}` fallback keys, so header/cell counts always matched. That
leaves inconsistent per-factory data entry as the explanation, not a parsing
misalignment. **Cannot be closed from stored evidence:** there are no BGMEA
member-detail evidence documents and no raw HTML mirror (only 1
`bgmea_buying_house` doc, no mirror), and no BGMEA `employees` evidence claims
exist, so confirming the live markup needs a fresh fetch — a separate issue.

**Known remaining defects, not this issue's scope:**
- `coast-to-coast` will read **710, not 3,450**, because `general:2768` (a
  different company) still wins the record competition on a six-second recency
  margin. **REZ-90.** Not a regression of this fix.
- `ops/repair_bgmea_conflations.py` `_numbers_from_record` still max()s *every*
  `employees` value into `employees_total` (including `Management`). It is a
  second write path that pre-dates REZ-91 and was never updated by it; an
  `--apply` run would re-introduce the defect this issue fixes. Left untouched
  deliberately — **REZ-89** was extended to cover it. Do not open a new issue.
- The 224 suppliers whose first column exceeds their whole worker count may now
  publish a figure that understates a real workforce; they need corroboration or
  suppression. **REZ-96.** Do not act on it inside REZ-95's PR.
- Two other surfaces still label the figure loosely: the discover result card
  ("N employees") and the overview narrative ("workforce of ~N"). REZ-95 named
  only the hero card and Capacity tab, so they were left alone; they need a
  founder call.

**Process rule this cost us:** REZ-91's dry-run was verified for arithmetic and
mechanics and every one of those checks passed. What went unchecked was whether
the three keys mean what their headers say. A dry-run that matches expectations
exactly still cannot tell you the formula was right — any future numeric
projection change must include a cross-source sanity test against an
independent total wherever one exists, **before** apply.

## Workforce projection + facility roll-up — REZ-91 ROLLED BACK (see REZ-95 above)
5 Aug 2026 — founder spotted `COAST TO COAST (PVT.) LTD.` publishing the wrong
workforce and asked what happens to an extension's data when it joins its
mother. Investigation found two unrelated defects and one architectural gap.

**REZ-91 (P0) — `employees_total` is the max cohort, not the sum.** The apply
below was **reverted by REZ-95**; the section is kept for the diagnosis and the
snapshot/rollback path. COMPLETE.
Merged PR #101 into `development`. **APPLIED to production 5 Aug 2026**
(founder-approved). Branched from `origin/development` @ `b7de8dd`. BGMEA
workforce cohorts `{Management, Employee Male, Employee Female}` are now
**summed** within one record (SQL + Python mirror); unrecognised keys skipped
and reported. Cross-record A8 winner rule unchanged. Pre-flight reproduced
4,247 / 1,604 / 1,594 / 1.88× / Management 625. Q1: no explicit Total key.
Q2: BKMEA uses explicit `bkmea_employees_total` — untouched. Q3: max sum
37,094 under 200k cap.

Apply matched dry-run row for row: **1,390** `employees_total` upward, **0**
downward, **0** sibling-column movement. `akm-knitwear` 16815→32677.
`square-fashions` / `fakir-fashion` (4858 / 18902) are BKMEA A8 wins — correctly
unchanged here; their BGMEA sums 31051 / 37094 are REZ-94 scope.

Rollback: `public._rez91_employees_total_snapshot_20260805` (all six numeric
columns × 10,912 suppliers, pre-apply). Expected set also kept as
`public._rez91_employees_total_expected_20260805` (1,390 rows). Apply via
Supabase SQL API (psycopg protocol-blocked from dev machine). REZ-94 must not
be folded into this PR.

**No facility roll-up exists at all.** Verified 5 Aug: `facility_of` is set on
**0 suppliers** and **no view or function in the database references it**. Both
extension paths lose the building's contribution, by different mechanisms:
- *merge* re-points source records / evidence / claims / certifications to the
  survivor, so documents live on, but numerics **compete** (A8 tier-then-recency)
  and never sum — the extension's headcount is discarded, or *replaces* the
  parent's if it is more recent.
- *facility attach* leaves numerics and RSC docs stranded on a row that A2's
  trigger forces `is_published = false`. Nothing surfaces them on the parent.

Founder decisions 5 Aug:
- **Show both numbers** — parent's own figure plus a separate labelled group
  total across N facilities. Never fold facilities into the headline; that
  destroys the distinction between verified-at-this-address and inferred-across-
  buildings. Derived only, never written back to `suppliers.*` (REZ-92).
- **Surface facility RSC/evidence on the mother, attributed to the building**,
  keeping the `(Extension)` / `Unit-2` suffix as the label. RSC inspects
  buildings, so hiding a facility hides real safety evidence — a compliance
  loss, not a cosmetic one. Read-path only; do NOT re-point rows, that destroys
  attribution (REZ-93).
- Certification inheritance is **undecided** — an entity-level cert may cover all
  buildings where an RSC inspection never does. REZ-93 must report and ask.

**REZ-71 (B1) bulk facility attach is BLOCKED** until REZ-91 → REZ-92 → REZ-93
land, because attaching today makes mother profiles thinner, not richer.
Detection/reporting half of B1 is still safe; only `--apply` is blocked.
REZ-91 applied; REZ-92 / REZ-93 still required before B1 `--apply`.

`coast-to-coast` is additionally a three-ref conflation (`general:1081` =
the real company per BGMEA, `2768` = Coast To Coast Fashion, `3070` = Coast To
Coast Apparels). Its published numbers came from `2768`, a different company.
That is REZ-90's scope, not REZ-91's.

## Entity Resolution Core — SPECIFIED, NOT STARTED
4 Aug 2026 — spec written, no code. `context/feature-specs/spec-resolution-core.md`.
Replaces the `_find_existing` decision in `etl/core/upsert.py` (five passes,
first match wins, trigram prefilter capped at 50, no score retained, no memory
of human rulings) with a batch resolution stage.

Founder decisions recorded 4 Aug, both required before implementation:
- **Hard Rule 4 tool approval**: an LLM adjudicator is approved for the
  **review band only** — never auto-merge, never overriding a human ruling,
  rationale persisted alongside the feature vector. Firecrawl `/v2/extract` is
  **NOT** approved; parsing stays deterministic (Hard Rule 5).
- **Placement**: resolution is a **separate batch stage** over immutable
  `staging_records`, with upsert consuming its decisions. Inline resolution was
  rejected because it cannot be shadow-run.

Three new tables: `staging_records` (immutable landing, traceable to an
`evidence_document_id`), `record_identity` (one shared identity computation, so
the definitions stop drifting between upsert / audit / repair scripts), and
`resolution_decisions` (append-only, features + band + policy version).
`resolution_edges` from A3 is NOT duplicated — it stays the human-ruling table
and acts as a hard override.

Measured findings that shaped the design (production, 4 Aug 2026):
- **Replay needs zero re-scraping.** 6,374 evidence documents with 100% raw
  payload coverage (4,407 `raw_html_mirror_url` + 1,967 `file_mirror_url`);
  20,224 source records, all with non-empty `fields`, 13 May – 2 Aug.
- **BGMEA registration equality is NOT decisive** — 1,196 reg numbers appear on
  more than one published supplier and 664 suppliers hold more than one number
  (reg 2571 = Opex Designers + Opex International; 641 = Shamoli Garments +
  YSG Bangladesh; 6699 = Chorka Apparels + CHORKA TEXTILE). BKMEA's IS decisive
  (4 collisions). Treating BGMEA reg as identity would merge sister companies.
- **Shared address is a group / anti-merge signal, not identity** — 479
  normalised address keys shared by 1,752 published suppliers, largest cluster
  69.
- **`suppliers.lat` / `lng` are populated on ZERO rows.** Coordinates live only
  in `address_geocodes` (17,973 rows, all with coords); geo blocking reaches
  90.6% but only via that join. `address_status = 'ok'` matches zero rows — do
  not filter on it.
- Single-source rate 7,947 / 10,845 published (73.3%); zero-source 0.
- 6,970 published suppliers (64.3%) hold zero active evidence claims — this is
  the D1 figure Linear REZ-82 asks for, measured here so both efforts share one
  number.

Prerequisite: the Guardrails epic (Linear REZ-57) must merge first, and the
Extensions epic (REZ-58) should be applied so facility rows are not scored as
candidate companies. Phases R0–R6 with per-phase acceptance criteria and the
R4 cutover gate are in the spec.

## Production Migration Ledger (authoritative)
Migration headers say "NOT applied to production in this session" — that line
records the state at authoring time and is NOT a live status. Check here, or
query `to_regclass` / `information_schema` directly, before assuming.

| Migration | Applied to production | Notes |
| -- | -- | -- |
| `0091_supplier_facility_of` | 4 Aug 2026 | `suppliers.facility_of` live; 0 rows set |
| `0092_enforce_publish_tier_facility_guard` | 4 Aug 2026 | trigger fires on `is_published` + `facility_of` |
| `0093_resolution_edges` | 4 Aug 2026 | table live, 0 rows (A5 `--apply` not yet run) |
| `0094_supplier_field_locks` | 5 Aug 2026 | table live, 0 rows; `column_name` trigger verified |

Production baseline after all four: 10,845 published of 10,912 suppliers
(unchanged by every migration above — all additive, no row writes).

Deploy-order hazard, twice hit: A4 and A6 query `resolution_edges` /
`supplier_field_locks` unconditionally with no missing-table guard, so
shipping that code before its migration crashes every ETL run. Apply the
migration before or with the deploy.

## Guardrails Epic — extension-name Python unify (REZ-87 / REZ-57 A7b)
5 Aug 2026 — COMPLETE. PR #98 merged into `development` (`06ca631`). This
unblocks REZ-90 (multi-ref plan revision). Founder decision on Linear: **Option 1 scoped to Python only**
— do NOT retire or modify `public.rsc_extension_base_name` (IMMUTABLE
indexes 0055/0056; buyer profile timeout risk; ≥8 views; B4 owns SQL).
SQL and Python are different jobs (view-side inheritance vs match/detector
classification) and are allowed to differ.

Shipped intent: `extension_base_name()` is the Python source of truth;
`_compatible` delegates the extension class to it and drops
`_MIN_PREFIX_LEN` (that constant gated only the extension prefix guard).
Direction B patterns added (`(U-2)`, `Unit-II`, `Ltd.-2`, `(Woven Unit)`,
`(Sw Unit)`, square brackets, undelimited Extension Building, glued
LimitedNew Buildings, doubled parens, etc.). Production fixture
`etl/tests/fixtures/extension_base_name_production.json` pins 609 hits +
25 Direction A pairs + critical negatives. Critical negative
`N. T. APPARELS UNIT-2 LIMITED` → None held. **Direction A = 25 current
false positives fixed** — detector reports up to 25 fewer conflations
(correctness gain). Unblocks REZ-90. Did not touch REZ-89 /
`_numbers_from_record`. Parent epic: Linear REZ-57.

## Guardrails Epic — multi-member-ref detector (REZ-88 / REZ-57)
5 Aug 2026 — detector COMPLETE, merged via PR #95 into `development`
(`a7695bc`). Detection + plan only; **no mutations** (production verified
unchanged at 10,912 suppliers / 10,845 published). Branched from
`origin/development` @ `7c13599`.

Production reproduction (Supabase REST; psycopg pooler blocked from this
host): **199** BGMEA-sourced suppliers hold >1 distinct active member
`source_ref`; **230** excess refs; all 199 lack `scraped_company_name`
(pre-REZ-56 `bgmea_web`), so the name-based BGMEA scan was blind.

Shipped: `multi_member_ref` signal class in
`ops/check_supplier_conflations.py` (structural; ignores BKMEA `:detail`
and same-`source_ref` re-scrapes); `--rest` transport; planner
`ops/plan_multi_member_refs.py`; plan
`ops/plans/rez-88-multi-ref-plan.md`. Classification of 230 excess refs:
split 164 / attach-as-facility 3 / merge 60 / unresolved 3. Did not touch
REZ-89 / REZ-87 / `_compatible` / projection rules.

**The detector is accepted. The plan is REJECTED — do not execute
`ops/plans/rez-88-multi-ref-plan.md`.** Review found three defects
(tracked as Linear REZ-90, blocked by REZ-87):

1. **Five false merges.** Alpha/Gaya, Azim/Aziz, Dressmen/Dressen,
   Eastern/Western Dresses, New Wave Group AB/SA — all score 89–96 after
   normalisation, *higher* than some correct merges, because the strings
   are long and differ by one or two characters. Azim/Aziz is the
   CORNY/CRONY shape the founder already ruled `different`. **Similarity
   score cannot discriminate here.** The rule that works: after stripping
   legal suffixes and punctuation, root tokens must be identical
   (pluralisation allowed). That splits the 60 merges into 50 byte-identical
   + 4 plural-only (safe) + 6 needing human review.
2. **Ten buildings classified `split` instead of facility** — `(U-2)`,
   `Unit-II`, `-2`, `(Woven Unit)`, `(Sw Unit)`. Inherited from
   `extension_base_name` not recognising these (REZ-87 Direction B), so
   REZ-87 must land first. Two of the ten are inverted: the *host* is the
   building and the excess ref is the parent (`intramex-knitwear-ltd-unit-2`,
   `mark-fashion-wear-pvt-ltd-u-2`), a case the plan has no class for.
3. **Inverted keeper selection.** On `western-dresses` the host is named
   "Western Dresses Ltd" but the keeper chosen was the "Eastern Dresses Ltd."
   ref, so the plan would keep the intruder. Keeper must prefer the ref
   matching the host's stored `company_name`.

Also note: 164 splits implies ~154 new published supplier rows. That must
be a deliberate decision, not a side effect.

Parent epic: Linear REZ-57.

## Guardrails Epic — multi-member-ref plan revision (REZ-90 / REZ-57)
5 Aug 2026 — COMPLETE in the working tree. Branched from `development` @
`6884e67`. **Still plan-only; no mutations.** Detector and its tests
untouched. New plan `ops/plans/rez-90-multi-ref-plan.md`; the rejected
`rez-88-multi-ref-plan.md` stays in the tree as evidence and as the fixture
the merge rule is measured against.

Reproduced 199 suppliers / 230 excess refs. **No member pages re-fetched** —
the 4 Aug member snapshot plus the associate PDF reproduce all 230 recovered
names byte-identically to the REZ-88 fetch, now checked in as
`ops/plans/rez-90-ref-names.json` (426 refs) so the plan regenerates without
the gitignored `ops/_tmp_*` snapshot.

Revised classes: split **141** / attach-as-facility **11** /
attach-host-as-facility **2** / merge **54** / review **19** / unresolved 3.
Transitions from the rejected plan: 8 split→attach-as-facility (REZ-87's
Direction B patterns, no new definition written), 2 split→attach-host-as-
facility, 6 merge→review, 13 split→review (the no-host-match gate below),
7 keeper changes.

Three rules, each replacing a defect:

1. **Merge is gated on root tokens, never on a similarity score.** After
   stripping legal form, incorporation and country words (`ltd`, `pvt`,
   `int'l`, `bd`, `bangladesh`, `the`…), punctuation and repeated spaces,
   the surviving tokens must be identical — pluralisation and initial
   spacing aside. Measured against the rejected plan's own 60 merges this
   gives exactly **50 identical / 4 plural / 6 root-differs**, and the 6 are
   precisely Alpha/Gaya, Azim/Aziz, Dressmen/Dressen, Eastern/Western,
   New Wave AB/SA, Europtex/Eurotex. Pinned in
   `etl/tests/test_multi_ref_classification.py`.
2. **Keeper = the ref bearing the host's own `company_name`**, ranked exact
   name → root form → pluralisation → `_names_compatible`, with `general:`
   only as a tie-break. Rank "exact name" is load-bearing: root form
   deliberately discards `International`, so without it `Axon Fashion
   International` and `Axon Fashion Limited` tie and the `general:`
   tie-break silently decides which company the row is. **9 hosts match no
   ref at all** (`dk-knitwear`, `jm-knitwear`, `ra-apparels`…) — reported as
   separate corruption, not resolved here.
   **Founder-required change (5 Aug, approval condition):** all **13** excess
   refs on those 9 hosts are forced to `review` by `classify_excess(...,
   host_matched=False)`, ahead of every other verdict. The keeper there is an
   arbitrary choice among strangers, so a split would leave `DK KNIT WEAR LTD`
   holding `DK Design Ltd.` — the pathology REZ-98 removed. Pinned by
   `TestHostMatchingNoRefCannotResolve`; the gate outranks merge and facility
   too, and only `unresolved` (no name recovered) precedes it. Follow-up
   filed as **REZ-102**.
3. **A building can be on either side.** `extension_base_name` (REZ-87,
   single definition) is asked about the excess and about the host; when the
   host row is the unit, the excess is the parent and the host becomes its
   `facility_of` child.

**Published-row cost: 130 new rows, not ~154.** 11 of the 141 splits name a
company that already has a supplier row and should be re-pointed. (Before the
no-host-match gate this read 142 of 154 splits with 12 re-points; one of the
13 gated rows had an existing target.) An earlier
pass put this at 93 by also treating "another supplier publishes this reg
number" as a target — **that is wrong and was removed.** REZ-98 proved every
unbacked BGMEA number is a live record sitting elsewhere, so a supplier
carrying the reg while the host holds the record is a *former* false attach,
not the owner; re-pointing there would repeat the original mistake. Those
**76** rows are reported as a cross-check only.

REZ-98 validation set: the 61 entirely-unbacked suppliers reproduce exactly,
are disjoint from the 199 (necessarily — a row holding two records cannot
hold none), and only **2** stranded numbers point at a multi-ref host
(`iqbal-knitwear`→`ra-apparels`, now `review` under the no-host-match gate;
`speedwell-apparels`→`ritzy-apparels` `merge`). Both agree with REZ-98's
adjudication. **The 61 are a different population; this plan does not repair
them — that stays REZ-99.**

None of the 6 root-differs review counterparties exists as its own supplier
row, so a merge would erase them with nothing to recover from.

Verification: pytest **804** (764 baseline + 40), `ruff check etl ops
--no-cache` **44** (baseline; none in the touched files), `npx tsc --noEmit`
clean, `npm test` 336/336. Parent epic: Linear REZ-57.

## Guardrails Epic — profile numeric projection (REZ-68 / REZ-57 A8)
5 Aug 2026 — COMPLETE, merged via PR #93 into `development` (`2f803c1`) and
deployed to the VPS. Code-only; no migration. **APPLIED to production
5 Aug 2026** (founder-approved). Branched from `origin/development` @
`2f3599b`.

Apply result — matched the dry-run row for row: `employees_total` 246
changed / 244 down, `employees_male` 147 / 147, `employees_female` 124 /
124, `production_capacity_pcs_day` 18 / 18, `machines_sewing` 255 / 255,
`production_capacity_dozen_yearly` 16 / 14. **806 changed, 802 downward,
4 NULL fills, 0 upward, 0 set to NULL.** Published count unchanged at
10,845 / 10,912. KNIT GUARD `machines_sewing` 150 → 36.

Rollback path: `public._a8_numeric_snapshot_20260805` holds all six columns
for all 10,912 suppliers as of immediately pre-apply. Drop it once the
numbers have been eyeballed on the front end.

Apply mechanism: the script's `--apply` (psycopg) **cannot run from the dev
machine** — TCP connects on both `:6543` and `:5432` but the Postgres
handshake times out on every pooler IP, so this is protocol-level blocking,
not a bad DSN. The six numeric statements were executed verbatim via the
Supabase SQL API instead. Any future apply needs the VPS or the SQL API. Replaces `greatest()` /
`where x.val > coalesce(...)` in `ops/backfill_profile_columns.py` with
highest-`source_tier` then most-recent-`fetched_at` (`distinct on`,
explicit tier→int map). `nullif(..., 0)` kept load-bearing (zeros reach
payloads — pre-flight). Shared columns (employees_*, machines_sewing)
merged to one UPDATE each so cross-source ranking works; A6 lock
predicates preserved on every UPDATE (13 → 9 statements). Arrays /
established_date / source→column exclusivity untouched. Dry-run is
default (REST); `--apply` via psycopg awaits founder approval. Dry-run
posted on Linear REZ-68: 802 downward corrections; KNIT GUARD
machines_sewing 150 → 36. Parent epic: Linear REZ-57.

## Guardrails Epic — extension facility attach (REZ-67 / REZ-57 A7)
5 Aug 2026 — COMPLETE, merged via PR #91 into `development` (`caa036a`).
Code-only; no migration. `extension_base_name()` in `etl/core/normalize.py` ports
`public.rsc_extension_base_name` (migration 0014) exactly, plus
production extras `(Extension 2|area|buildings)`, annex, `(Ext)`,
parenthesized units, and multi-pass for stacked suffixes. Critical
negative pinned: `N. T. APPARELS UNIT-2 LIMITED` → None. Upsert create
path (`upsert_supplier_with_source`) sets `facility_of` when an exact
slug or squash parent exists; no fuzzy; no `_find_existing` change; no
SQL function change; no retro-backfill (B1). A2 trigger keeps facility
rows unpublished. Drift vs `ops/repair_bgmea_conflations._compatible`
prefix guard reported on Linear REZ-67 (not unified). Detector
`ops/check_supplier_conflations.py` timed out on pooler :6543 from this
machine — substituted full pytest green (code-only change). Unblocks
cleaner B1 intake. Parent epic: Linear REZ-57.

## Guardrails Epic — field locks (REZ-66 / REZ-57 A6)
4 Aug 2026 — COMPLETE, merged via PR #89 into `development` (`41a1a1a`) and
deployed to the VPS. Migration `0094` APPLIED to production 5 Aug 2026.
Migration `0094_supplier_field_locks.sql`
creates `public.supplier_field_locks` (live unique on `(supplier_id,
column_name) WHERE released_at IS NULL`, RLS with no anon/auth
policies, trigger validating `column_name` against
`information_schema.columns` for `public.suppliers`). Enforcement in
`etl/core/upsert.py` (`_locked_columns` once per
`_enrich_supplier` / `_apply_source_specific`) and all **13** UPDATEs
in `ops/backfill_profile_columns.py`. No admin UI, no lock backfill, no
generic BEFORE UPDATE on `suppliers`. Third ETL writers
(`rsc_crosslink`, `contact_merge`, `address_norm`) STOP-AND-ASK'd on
REZ-66 and left alone this PR. Verification: pytest 641 (+9);
ruff 44 pre-existing (0 new on changed files); `npx tsc --noEmit`
clean; `npm test` 336/336. Parent epic: Linear REZ-57.

## Guardrails Epic — resolution_edges seed (REZ-65 / REZ-57 A5)
4 Aug 2026 — IN PROGRESS (script + tests; production dry-run only).
`ops/seed_resolution_edges.py` backfills founder rulings into
`public.resolution_edges` via Supabase REST (service-role; no psycopg).
Dry-run by default; `--apply` required to write. Encodes exactly:
`sarada-knitwear` ≠ `sarada-fashions` (different), `corny-fashion` ≠
`crony-fashion` (different). The `sarada-knitwear` = `sarda-knitwear`
same-ruling is reported as structurally satisfied — loser tombstoned by
the completed seeded merge; FK correctly rejects insert. Undecided and
NOT encoded: 3 ambiguous BGMEA stowaways, the other 9 shared-ref
ownership questions (of the 10 standing; CORNY/CRONY ref 377 was the
one encoded from the issue table), and `crony-fashions` vs corny/crony
(founder has not ruled). Verification: pytest 632 (+5);
ruff 44 pre-existing (0 new on seed files); `npx tsc --noEmit` clean;
`npm test` 336/336. Production `--apply` waits on founder approval.
Parent epic: Linear REZ-57.

## Guardrails Epic — resolution_edges matcher (REZ-64 / REZ-57 A4)
4 Aug 2026 — COMPLETE (merged via PR #82 into `development`).
Makes `resolution_edges` load-bearing without changing pass order or
thresholds (`92` / `85` / `3`). Positive hook only in `_find_existing`:
after any pass finds a candidate, `apply_same_edge_canonical` rewrites to
the sole published survivor of a live `same` edge; if both sides are
published, logs `resolution.same_edge_both_published` and returns the pass
result unmodified (never silently picks). Live edges loaded once per
process (`etl/core/resolution_edges.py`; staleness = one scraper run).
Negative (`different`) guards live only in ops — incoming records have no
second supplier id at match time: `merge_duplicate_suppliers` SKIPPED +
rationale; audit excludes from every signal class + "RULED DIFFERENT BY
HUMAN" section; `check_supplier_splits` same exclusion. Empty table is a
provable no-op. Verification: pytest 627 (+7 in
`test_resolution_edges_matcher.py`; dedup guards unchanged); ruff 44
pre-existing (0 new); `npx tsc --noEmit` clean; `npm test` 336/336.
Code-only; deployed to the VPS 5 Aug 2026 (needs `0093` live — applied
4 Aug). Unblocks A5. Parent epic: Linear REZ-57.

## Guardrails Epic — resolution_edges schema (REZ-63 / REZ-57 A3)
4 Aug 2026 — COMPLETE (merged via PR #79 into `development` / `main`).
Schema-only migration `0093_resolution_edges.sql`: table
`public.resolution_edges` for sticky always-same / never-same pair
rulings. Columns: `supplier_a`/`supplier_b` (FK cascade), `verdict`
(`same`|`different`), `decided_by`, `decided_at`, `rationale`,
`evidence_note`, `superseded_at`/`superseded_by`. Canonical pair order
enforced by CHECK `supplier_a < supplier_b` (no silent-swap trigger);
also CHECK not-self; partial unique
`idx_resolution_edges_pair_active` (one live ruling per pair); read-path
partial indexes on each side; RLS enabled with zero anon/authenticated
policies. No rows inserted; no `upsert.py` / view / RPC / TS changes.
APPLIED to production 4 Aug 2026. Parses under libpg_query (15 statements;
95/95 migrations valid). Verification: pytest 620 passed (+13 in
`etl/tests/test_resolution_edges_schema.py`); `npx tsc --noEmit` clean;
`npm test` 336/336; ruff 44 pre-existing (0 new from this change).
Unblocks A4 / A5 / C3. Parent epic: Linear REZ-57.

## Guardrails Epic — facility publish refuse (REZ-62 / REZ-57 A2)
4 Aug 2026 — COMPLETE, merged via PR #77 into `development`.
Migration `0092_enforce_publish_tier_facility_guard.sql` redefines
`enforce_publish_tier()`: when `NEW.facility_of IS NOT NULL`, silently
coerce `NEW.is_published := false` and return (chosen over raise so B1
backfill and `_maybe_publish()` do not churn exceptions). Existing Tier
1–3 check, message, and `errcode = 'check_violation'` preserved exactly
for non-facility rows. Trigger `trg_suppliers_publish` widened to
`before insert or update of is_published, facility_of`. No row values;
no `upsert.py` / view / RPC / TS changes. APPLIED to production 4 Aug 2026
(verified: trigger fires on both `is_published` and `facility_of`; Tier 1–3
check and `check_violation` errcode preserved in the installed function).
Parses under libpg_query (3 statements; 94/94 migrations valid).
Verification: pytest 607 passed (+9 in
`etl/tests/test_facility_publish_guard.py`); `npx tsc --noEmit` clean;
`npm test` 336/336; ruff 44 pre-existing (0 new from this change).
Unblocks B1. Parent epic: Linear REZ-57.

## Guardrails Epic — facility_of schema (REZ-61 / REZ-57 A1)
4 Aug 2026 — COMPLETE, merged via PR #75 into `development`.
Schema-only migration `0091_supplier_facility_of.sql`: nullable self-FK
`suppliers.facility_of` → `suppliers(id) on delete set null`, partial
index `idx_suppliers_facility_of`, CHECK `chk_suppliers_facility_not_self`,
column comment. No row values; no `enforce_publish_tier()` / `upsert.py` /
view / RPC / TS changes. APPLIED to production 4 Aug 2026. Parses under
libpg_query (5 statements; 93/93 migrations valid). Verification: pytest
598 passed; `npx tsc --noEmit` clean; `npm test` 336/336; ruff unchanged
vs HEAD (44 pre-existing in ops/`etl/logs`, none from this change).
Unblocks A2, A7, B1. Parent epic: Linear REZ-57.

## Cross-Register Audit + Split-Evidence Duplicate Repair (REZ-56)
3 Aug 2026 - FULLY COMPLETE in production (main `ed84bef`, PRs #70-72; VPS
at `ed84bef`). Spec: `context/feature-specs/spec-cross-register-audit.md`.
**Production apply (3 Aug 2026): all 37 certain merge groups merged** in one
transaction — 10,213 → 10,176 published suppliers; 49 source_records
re-pointed (7 redundant register pointers dropped, newest kept), 168
evidence_claims re-pointed + 30 same-doc subject-citation dupes deduped, 33
certifications re-pointed (3 dupes dropped), 37 loser sbi_scores rows
dropped (winners' recomputed nightly), 9 verification_queue rows moved.
Post-runbook executed in order: backfill_profile_columns,
repair_bkmea_registry_display --apply (0 changes — merge already reconciled
canonically), backfill_supplier_identity --apply (521 identity updates over
3 passes; 6 slug-blocked pairs remain, all with unpublished holders:
GLITTER/CHORKA/NAFISA + Paramount/SHASHA DENIMS/SHEPHERD INDUSTRIES PLC
pairs — follow-up candidates), re-audit: **0 certain merge groups**, 311
fuzzy reported-only, 29 extension clusters excluded; detector: **OK, no
certain split-evidence duplicates** (10 ownership questions standing,
report-only). Smoke: FOUR H APPARELS unified (BGMEA+BKMEA+EPB+GOTS+OEKO_TEX
+RSC on one profile, completeness 73%), RSC extension rows (New Building,
Unit 1) correctly untouched, 0 orphan claims.

Two apply-time constraint fixes shipped as hotfixes (each caught by the
transactional rollback, zero partial writes): `sbi_scores` PK is a singleton
constraint on the supplier column itself (`6d0790c`); same-doc
subject-citation dupes on shared-register-ref groups needed pre-dedupe
before subject re-pointing (`a2f57f0`). Ops note: psycopg3 ignores
PGOPTIONS — long audit queries need an in-process `set statement_timeout`
wrapper under evening DB load.

Follow-on work queued from the founder's Sarada review (same day):
`--pair` seeded merge mode committed on development (`33d0506`)
for founder-confirmed pairs no audit signal links (Sarada Knit Wear Ltd.
[BGMEA] vs SARDA KNITWEAR LTD [BKMEA] — same premises + owner, verified).
Sarada Fashions' missing EPB row traced to scraper scope, not matching: EPB
exporter 4083 IS "SARADA FASHIONS LIMITED." (live-verified, reg BD05918)
but carries no BGMEA/BKMEA association flag, and `epb_web` only enumerates
flagged exporters (541 of 5,939; we hold 539 = full flagged coverage).
~5,398 unflagged exporters incl. RMG-category rows invisible.

**Follow-ups shipped 4 Aug 2026** (development, PR pending; founder decisions
B/C/D/E taken this session):
- **Sarada seeded merge applied in production**: `--pair
  sarada-knitwear,sarda-knitwear` — the loser's BKMEA rows (1010 +
  1018:detail) moved to the BGMEA-side winner, `bkmea_reg_number` =
  `1010 - C/2009` (canonical rule), loser tombstoned; 10,176 → 10,175
  published; detector still OK; profile renders on sourcebd.net.
  `sarada-fashions` deliberately untouched (sister company, different
  premises).
- **B — audit-v2 variant signal** (REPORT class, never auto-merge):
  `variant_pairs()` in the audit folds in the 3 Aug ad-hoc scan — 4-gram
  index over space-stripped recomputed norms (grams shared by >40 suppliers
  dropped), char `fuzz.ratio` ≥ 86, min squashed length 10, fragmented Tier
  1-3 sets required, address corroboration (street-number agreement for the
  strong band; city tokens excluded; a number CONFLICT demotes — the
  sister-company class). The certain-review band is the founder's
  seeded-merge review list, never `certain_merge_groups` input. The detector
  prints the counts informationally; it still fails only on certain
  split-evidence groups.
- **C — matcher squash-equality pass**: `_find_existing` Pass 1.5 matches on
  `replace(company_name_norm, ' ', '')` equality, so future WEST
  KNITWEAR-class spellings attach instead of minting twins. Exact equality,
  no threshold — no conflation surface beyond Pass 1. Functional index
  deferred (a schema migration needs the founder's explicit go-ahead; the
  per-record seq scan at ~10k rows is acceptable meanwhile).
- **D — EPB category-scoped enumeration, attach-only**: `epb_web` runs a
  second pass over the RMG category ids (2/3/8/24 + stock-lot 16/23/30,
  live-verified 3 Aug) after the association pass. Category-pass records
  carry the new `ScrapedRecord.enrich_only`: the upsert enriches an existing
  match but NEVER creates (unmatched → skipped, logged
  `supplier.enrich_only_unmatched`). Covers the unflagged RMG majority
  (SARADA FASHIONS = exporter 4083) without minting single-source EPB
  profiles. The association pass keeps full-create; one exporter is yielded
  once per run (shared `seen_ids`).
- **E — `--pair` loads unpublished losers**: `_fetch(extra_slugs=…)` widens
  the merge script's seeded fetch (`is_published or slug = any(…)`); the
  audit/detector universe stays published-only, and publication status prints
  on every merge-plan member. Unblocks the 6 slug-blocked identity-backfill
  pairs (GLITTER/CHORKA/NAFISA + Paramount/SHASHA/SHEPHERD PLC) for
  founder-reviewed seeded merges.

Tests: pytest 591 passed (28 variant-signal + 37 squash/dedup-guard + 7
EPB-category + 2 seed-fetch new); ruff clean; no schema migration. Residual:
Linear REZ-56 closeout comment STILL not posted (Linear MCP unavailable
again 4 Aug) — summary text ready for manual posting.

## BGMEA Conflation Repair (founder review, 4 Aug 2026)
4 Aug 2026 - APPLIED in production (development, PR pending). The founder's
EPB review exposed a second population from the pre-31-Jul contact-overlap
dedup defect: BGMEA general-member records merged into sister-company
suppliers (3S International inside 3S TEXTILE, AKH Knitwear inside AKH
Apparels, Aman Sweaters inside Aman Knittings, Ananta Sportswear inside ABM
Fashions). The 31 Jul repair + daily detector were BKMEA-only because BGMEA
records stored no scraped name — the blind spot itself.

- **`ops/repair_bgmea_conflations.py`** (new, REST transport — pooler ports
  unreachable from the dev machine): name oracle = 4 Aug snapshot of BGMEA's
  live member list (4,285 members by reg); flags a record whose member name
  fails `_names_compatible` + prefix guard against its host. 808 stowaways
  found. Join only on EXACT recomputed identity (slug/squash equality —
  Pass 1/1.5 bars); fuzzy-only candidates deliberately NOT joined (dry run
  proposed Anika→ANITA, Bando→BRAND — re-conflations) — they get their own
  supplier and surface in the audit variant signal. Applied: ~790 records
  moved with their evidence claims, ~630 new suppliers created + published,
  ~120 joined an existing exact twin, 3 ambiguous skipped for a human,
  former hosts' derived columns recomputed from REMAINING records only.
  Re-scan: 0 stowaways beyond the 3 ambiguous. All four founder cases
  live with full profiles.
- **Profile projection**: the repair projects the moved record's stored
  fields (employees/machines/capacity/established/factory_types/
  principal_products/contacts) onto the destination with
  `backfill_profile_columns.py` semantics — arrays union, scalars fill-only,
  numerics resolved per the rule below. Genesis Fashion class (bare created
  profiles) converged this way.
  **The numeric rule changed on 5 Aug 2026.** It was the founder's 4 Aug
  rule — the HIGHEST value across sources, never summed. A8 (REZ-68)
  superseded the "highest" half: numerics now take the highest-trust
  `source_tier` reporting a non-zero value, then the most recent
  `fetched_at`, then the lower `source_records.id`. **Never summed across
  records still holds** and is unchanged. The practical difference is that a
  register may now correct a figure *downwards*; the old rule made published
  numbers high-water marks. Within one BGMEA record, `employees_total` is
  `Employee Male + Employee Female` (REZ-95) — that intra-record sum is a
  different thing from summing across records, which remains forbidden.
  `ops/repair_bgmea_conflations.py` was brought onto the A8 rule by REZ-89
  (5 Aug 2026); before that it still max-merged and contradicted the
  canonical script.
- **`bgmea_web` now stores `scraped_company_name`** (uncitable) so future
  BGMEA records are detector-visible; `ops/check_supplier_conflations.py`
  widened to scan BGMEA general records via that field.
- Ops scar: an interrupted apply's python child survived the shell kill and
  raced the real run, minting 651 empty unpublished `-2` duplicates — all
  verified record-less/claim-less and deleted. Kill the PID, not the shell.

Tests: pytest 598 passed (7 new in test_bgmea_conflation_repair.py);
ruff clean.

Architectural decisions:
- Merge eligibility is per-member over "certain edges", not per-cluster:
  recomputed-slug equality, or shared ref + names clearing the matcher bar +
  (non-BKMEA ref | BKMEA shadow whose entire ref set duplicates the other
  side). BKMEA memberships on two substantive suppliers (CORNY/CRONY) are
  ownership questions for a human — never auto-merged. Fuzzy-only members of
  a mixed cluster (Eon Fashion in the EMON cluster) are excluded from its
  merge group.
- Merge re-points every supplier-referencing column ENUMERATED from
  information_schema at runtime (FKs + non-FK supplier_id columns; views
  excluded — they follow via source_records), reconciles columns (arrays
  union, verified flags OR, bkmea_reg_number by the 3 Aug
  newest-valid-detail canonical rule, other scalars coalesce), then deletes
  the loser after a zero-reference check (spec08 tombstone convention).
  Unique-constraint collisions: source_records keeps the newest-fetched
  pointer with citations re-pointed; singleton constraints (sbi_scores PK)
  drop the loser's derived row; other tables drop the loser's
  byte-equivalent duplicate.
- `suppliers.slug` UNIQUE means stored-slug grouping can never see the
  duplicate class — identity is always RECOMPUTED with the ETL's own
  `make_slug`/`normalize_company_name`, never reimplemented in ops scripts.

## ETL Change-Skip + BKMEA source_records Split (REZ-36 Spec A)
2 Aug 2026 - FULLY COMPLETE in production (main `948e0b6`, PRs #64 + #66;
VPS `109.104.153.228` at `e482bd1`). Spec:
`context/feature-specs/spec-etl-change-skip.md`.

Production verification (2 Aug 2026, VPS): rekey applied first —
2,628 `source_records` rows rekeyed detail-id → membership-int, 152
duplicate re-listing rows merged away (FK refs re-pointed), 0 collisions, 15
multi-supplier memberships reported-not-merged (incl. the stranded 376/CRONY
FASHION row). Controlled runs: `bkmea_web` seen=2,783 / upserted=766 /
**skipped=2,017 (72% hash-skip)**, 3 credits; `bkmea_detail` run 1
seen=2,632 / upserted=2,632 (expected one-time `:detail` backfill, 2,632
credits, 0 failures); **run 2 acceptance: seen=16, upserted=0, skipped=16,
16 credits** — the gate cut targets 2,636 → 16 (−99.4%) and hash-skip caught
100% of what was fetched. Residual: ~16 members holding multiple BKMEA list
rows (multi-supplier memberships, dual memberships) re-target every run
because one `enriched_from_list_hash` cannot match two list rows — they
always hash-skip, ~16 credits/run, Spec B material. The founder declined the
`--full-refresh` proof run (credit cost; mechanism already proven 16/16 +
unit tests).

Follow-up defect found by the founder's review-queue complaint and fixed in
the same session (PR #66): `supersede_claims` used `url_hash` as the proxy
for "two sources disagree", so a source MOVING its page (BKMEA re-listings)
filed its own update as `contradicted` — run 1 minted 396 such claims across
65 suppliers. The `case` now classifies same-scraper replacement as
`superseded` whatever the URL; `contradicted` is reserved for cross-scraper
disagreement (bkmea_web vs bkmea_detail remain distinct codes, so
list-vs-detail disagreement still surfaces). Backlog repaired by
`ops/reclassify_same_source_contradicted.py` (dry-run → apply): 422 claims
reclassified to `superseded`; the worklist dropped from 442 claims / 75
suppliers to **20 claims / 10 suppliers, all genuine** list-vs-detail
membership-number disagreements (the Phase D dual-membership class).

## Registry Display Precedence (founder rule, 3 Aug 2026)
3 Aug 2026 - COMPLETE in production (main `4727185`, PR #67; VPS at
`4727185`). Founder rule: cert/reg provider data is the source of truth and
the last scraped value must show without a review round-trip; within-provider
conflicts are sorted at the root, never reviewed.

Root causes found + fixed:
- `suppliers.bkmea_reg_number` was `coalesce(existing, new)` — first-writer-
  wins, frozen forever. 73 suppliers displayed numbers BKMEA had long since
  corrected (KHADIZA KNITWEARS showed 642 - B/2008; BKMEA says 503 - C/2000
  on both list and detail). Now the canonical record
  (`ScrapedRecord.canonical_registry`, set by bkmea_detail) OVERWRITES the
  column; the list only fills a NULL. Blank memberships ("- C/2009") are
  junk-guarded out of the parser payload and the column.
- bkmea_web and bkmea_detail both CLAIMED the membership fields, so a
  list-vs-page disagreement became a `contradicted` review item. The list no
  longer claims detail-owned fields when a detail page exists — one canonical
  citation per provider, within-provider review items structurally impossible.
- ~48 suppliers legitimately hold 2+ current BKMEA memberships (BKMEA never
  dedupes re-registrations). Displayed value = newest-fetched valid detail
  value; stable across runs (fixed gate order + hash-skip), moves only when
  the provider's data changes.

Backlog repaired by `ops/repair_bkmea_registry_display.py` (two passes: 48 +
25 columns; 20 contradicted claims resolved — 10 self-resolved, 10 canonical-
won; KNIT FASHION's blank-page junk claim superseded, its list citation
reactivated). Worklist: **zero** unreviewed stale/contradicted.

False alarms cleared for the record: "Apparel Today Ltd." WAS current
(2638 - C/2026 scraped 2 Aug from the current detail page 2842; the
983 - B/2009 the founder saw is BKMEA's own stale 2009 page 8817, no longer
cited anywhere). "APPAREL TODAY" (membership 2640) is not missing — it does
not exist on BKMEA's live register (verified by direct full-register fetch,
2,784 rows, zero credits); it was briefly listed and removed. Latent risk
noted for Spec B: `make_slug` erases the LTD distinction, so a reappearing
"APPAREL TODAY" (2640) would Pass-1-merge into "Apparel Today Ltd." — needs
a same-name-different-membership guard.


Architectural decisions worth keeping:

- **The change-skip lives in `upsert_supplier_with_source` — one code path,
  every scraper.** `_source_record_unchanged` looks up the stored
  `source_records` row by `(source_id, source_ref)`; a matching `raw_hash`
  returns `None` from the upsert, which means: no enrich, no source-record
  rewrite beyond `fetched_at` (freshness monitoring keys off that column — a
  verified record must not false-age), no evidence, no per-record downstream
  writes. Callers count `records_skipped`. A ref matching rows on MORE THAN
  ONE supplier never skips — skipping on an ambiguous ref could freeze the
  wrong supplier's row, so the full upsert's Pass 0 resolves it
  deterministically. All 7 upsert call sites (`BaseScraper.run` + 6 custom
  `run()` overrides) handle the `None`.
- **`bkmea_detail` writes its own `{detail_id}:detail` source_records row.**
  Sharing the list row's ref made `raw_hash` flip-flop between list-hash and
  detail-hash on alternating runs, so hash-skip was impossible. The detail
  row carries `enriched_from_list_hash` (the list row's `raw_hash` at
  enrichment time) in its `fields` — the pre-fetch gate's input — and the
  list row's ref rides in the new `ScrapedRecord.alias_refs`, so Pass 0 still
  resolves the detail record to the same supplier (zero new suppliers, pinned
  by test). No new source code — that would ripple into the SQL allow-list
  and tier map.
- **The pre-fetch gate is a pure function, not a SQL predicate.** The old
  `_load_targets` predicate (`email_primary IS NULL OR address_raw IS NULL`)
  never cleared — BKMEA rarely publishes email — so the whole ~590-member
  register was re-scraped every run at ~1 Firecrawl credit each. The gate is
  now `_needs_enrichment(...)`: never-enriched OR list-hash-moved OR
  unreviewed-stale-claim (that branch kept exactly), with `--full-refresh`
  bypassing (founder knob; queue-dispatched runs always gate). The SQL only
  fetches candidates — the REZ-34 lesson (mocked cursors never parse SQL) is
  why the predicate is testable Python.
- **`bkmea_web` keys `source_ref` on the membership integer, never the
  detail-page id.** BKMEA re-lists members on new detail ids under the same
  membership number; preferring `detail_id` minted a new `source_records` row
  per re-listing (the REZ-34 Phase D treadmill).
  `ops/rekey_bkmea_source_refs.py` (dry-run default) rekeys existing rows:
  per `(supplier_id, membership_int)` group the freshest row wins, losers'
  FK references are re-pointed and the losers deleted; multi-supplier refs
  (the stranded CRONY FASHION duplicate) are reported, not merged.

Tests: 29 new — `etl/tests/test_change_skip.py` (hash-skip idempotency,
`fetched_at` touch, changed/NULL-hash fallthrough, multi-supplier
fallthrough, run-level skip counting vs failures, no evidence on skip) and
`etl/tests/test_bkmea_detail_gate.py` (gate predicate truth table, candidate
SQL shape, `_load_targets` wiring, `{detail_id}:detail` ref + alias linkage
with zero new suppliers, second-run hash-skip, `--full-refresh` CLI wiring +
rejection on other scrapers, queue-default gate-on), plus one `bkmea_web`
ref-stability pin. Shared fakes live in `etl/tests/conftest.py`. pytest 517
passed; ruff clean on touched files; `npx tsc --noEmit` clean; `npm test`
336/336; no schema migration (data rekey only) — 92/92 migrations still
parse.

## SBI Recompute Restored + Pillar 2 Re-spec (REZ-33)
2 Aug 2026 - FULLY COMPLETE in production (main `645dc19`, PR #62; VPS
`109.104.153.228`). `sbi_scores` was written exactly
once (Spec-11 backfill, 21 May 2026): 98 of 10,284 suppliers had no score row
at all while Discover's default ranking joins `sbi_scores`, and Pillar 2 ran
on two `null::numeric` stubs — the old fire/structural inputs are dead
upstream (the RSC/Accord API returns only overall `progress`; migration 0002
recorded this, and `rsc_remediation` has no fire_pct/structural_pct columns at
all). Production pillar2_safety had exactly two values: 5 (the fake "DIFE
default") and 0. There was also no recompute job: `sbi` existed only as a CLI
command, absent from all three synced registries and from `etl_schedules`.

Architectural decisions worth keeping:

- **Pillar 2 is re-spec'd on the one real signal.** Approved shape (founder,
  2 Aug 2026): coverage base 5 for an ACTIVE `rsc_remediation` row — the
  honest re-label of the old DIFE default, which credited the same 5 points
  for a source that was never wired up — plus a ladder over `progress_pct`
  (>=95→25, >=80→20, >=60→14, >=40→8, >0→3, 0→0), min(30, base+ladder); no
  active row still scores 0 (gate unchanged). Production impact on the 1,615
  active-row suppliers (2 Aug 2026 buckets, all flat 5 today): p=0: 45→5 |
  0–40: 38→8 | 40–60: 103→13 | 60–80: 140→19 | 80–95: 274→25 |
  >=95: 1015→30 (762 at exactly 100).
- **`_formula_version` (now 2) is what recomputes the world.** It rides in
  the hashed payload, so bumping it invalidates every stored inputs_hash and
  a plain (non-force) runner pass recomputes all rows exactly once — no
  backfill script, no `--force` flag day. It is a module constant so the
  invalidation is pinned by a monkeypatch test.
- **The recompute is a JOBS entry, not a scraper.** `SbiRecomputeJob`
  (`etl/scoring/job.py`) mirrors `VerifyEvidenceJob`: code `sbi_recompute`,
  `source_code = ""`, `transport = "direct"`, no-arg constructor, opens an
  `etl_runs` row, maps runner counters to the queue's
  seen/upserted/skipped/matched keys (`computed` rides along for metadata).
  Registered in `JOBS` (never `SCRAPERS` — no transport, no evidence), the
  TS catalog (plus its exhaustive transport map, "job"), and the SQL
  allow-list (migration 0090, widening only — CHECK re-validates on
  INSERT/UPDATE, existing rows unaffected).
- **The runner heartbeats per committed 500-row batch.** `runner.run()`
  gained an optional `progress_callback` fired after each full upsert batch;
  the job translates it into the queue event shape and is a no-op when None
  (CLI). REZ-31's reaper kills any job that never heartbeats, and a full
  recompute walks 10k+ suppliers. The `etl sbi` CLI is unchanged — the new
  kwarg defaults to None.
- **The three-way sync test reads the LATEST allow-list definition.**
  `test_runnable_registry_sync.py` read 0084's file only, and that pointer
  went stale the day 0086 renamed `bgmea_pdf` — the stale pointer WAS the
  pre-existing `bgmea_buying_house` failure at HEAD. `_sql_codes()` now reads
  the highest-numbered migration defining
  `admin_etl_allowed_scraper_codes()` (what production actually enforces:
  zero-padded prefixes sort lexicographically), so later re-definitions can
  never silently drift from Python/TS again.
- **architecture.md line 24's Inngest "nightly score recompute" claim was
  false** (flagged as doc debt by REZ-32); it now states the real mechanism —
  the `sbi_recompute` JOBS entry on `etl_schedules`, dispatched by the
  minutely queue cron. Line 33's Inngest mention remains as noted doc debt.

Tests: 17 new — pillar-2 ladder boundaries (0/1/39/40/60/80/94/95/100) plus
base-only/gate/cap, formula-version invalidation, dead-inputs rejection,
runner `_FETCH_SQL` string assertions (progress_pct present, no
`null::numeric as rsc_` stub, `r.active is true` join kept — mocked cursors
never parse SQL, the REZ-34 lesson), Decimal→float mapping, per-batch
heartbeat + hash-skip idempotency under a fake cursor, and the job registry
shape / queue-key mapping / failure-close / heartbeat-no-op tests. pytest
488 passed (the pre-existing `bgmea_buying_house` sync failure is resolved
by the latest-definition fix above); ruff clean on touched files; `npx tsc
--noEmit` clean; `npm test` 336/336; 0090 parses under libpg_query.

**Session 2 (2 Aug 2026, ~01:02 UTC) — production rollout complete.** PRs
#59–#61 had already landed the REZ-31/32/34 backlog on main, so PR #62
carried only `303d2f3`; merged main = `645dc19`. Migration 0090 applied via
the Supabase MCP: allow-list now 29 codes with `sbi_recompute` present and
`bgmea_buying_house` carried forward (0089 was already applied — REZ-32's
session, untouched here). Deployed via the manual SSH path in tmux (GitHub
Actions still cannot reach the VPS — dial tcp timeout); BOTH `sourcebd-web`
and `sourcebd-etl` tags rebuilt; rollback ref `.deploy/previous-sha` =
`e8b1b3f`. First controlled recompute (`docker compose run --rm etl sbi`, no
--force): seen=10,284, upserted=10,284, skipped_hash=0 — the
`_formula_version` bump recomputed the world exactly once. Post-recompute
truth: pillar2 distribution 0: 8,669 | 5: 45 | 8: 38 | 13: 103 | 19: 140 |
25: 274 | 30: 1,015 — non-zero total exactly 1,615 (= active RSC rows), 7
distinct values (was 2), zero unscored suppliers (was 98), max(computed_at)
= 2 Aug; spot-checks progress_pct=100 → 30 and inactive RSC row → 0 both
hold; `trg_sbi_zero` / `enforce_sanctions_zero` present, 0 sanctioned rows.
Nightly schedule inserted via direct SQL (1440 min); the minutely cron
enqueued it 5 min later and that queued run is the idempotency proof:
success, seen=10,284, upserted=0, skipped_hash=10,284 in 4s, `next_run_at`
advanced +24h. Note: the per-batch heartbeat callback fires only when an
upsert batch commits, so a full hash-skip run emits no progress events —
expected; claim/finish heartbeats bound the short run. Smoke:
`/api/health` 200 on domain + IP at `645dc19`; `/discover?q=knit` renders
24 results with zero pillar/sbi/total score fields in the payload;
`/admin/sources` auth-gates anon (307) — schedule + run history verified at
the DB level. Rollback: `bash ops/deploy_vps.sh --ref=$(cat
/opt/sourcebd/.deploy/previous-sha) --require-git`. Next-day check owed:
confirm the first unattended nightly cycle (3 Aug ~01:02 UTC) succeeds with
skipped_hash≈all and no reaper events.

## Sanctions Screening Both Directions (REZ-32)
2 Aug 2026 - FULLY COMPLETE in production (VPS `e8b1b3f`, migration 0089
applied, backfill run, end-to-end proof passed; Linear moved to Done).
Screening was one-directional:
`_match_and_screen` fired only when a list entry was ingested, so the 67
suppliers created since OFAC's last refresh had never been screened against
the 13,366 stored entries (production: 3 screening rows ever, 0 active, last
touched 14 May). The downstream mechanism (`trg_sanc_propagate` flipping
`suppliers.is_sanctioned` + zeroing `sbi_scores.total`) worked — it was just
never triggered for new suppliers.

Architectural decisions worth keeping:

- **One pair-level predicate decides both directions.** `_pair_matches` in
  `etl/core/sanctions.py` is the single rule — `_is_screenable` on BOTH sides,
  >=2 literally shared significant tokens, `token_sort_ratio >= 95`, and
  `_names_compatible` reused from supplier dedup. Entry side
  (`_match_and_screen` at list ingest) and supplier side
  (`screen_supplier_against_entries` at upsert) both call it, so detection
  cannot drift (same principle as `ops/check_supplier_conflations.py` reusing
  `_names_compatible`). The order-sensitive guard is load-bearing, not
  redundant: token_sort_ratio scores the word-order permutation COTTON FAIR /
  FAIR COTTON at 100 and the initials swap A. B. / B. A. KNITWEAR INDUSTRIES
  at 95.5 — both over threshold, both different companies, and here a false
  positive brands a real factory as sanctioned. Both directions also insert
  through one helper (`_insert_screening_row`), so the `details` jsonb shape
  cannot drift either.
- **Supplier-side screening is in-transaction, not post-commit.**
  `screen_supplier_against_entries` runs inside `upsert_supplier_with_source`
  after `_refresh_completeness`, before `commit()` — screening is the P0
  invariant, not enrichment, so a failure raises and rolls the supplier record
  back rather than publishing an unscreened supplier. `BaseScraper.run`'s
  per-record try/except contains that as `records_skipped`: loud, and
  self-healing on the next ingest. The post-commit block stays best-effort
  enrichment only.
- **`on conflict do nothing` had nothing to conflict on.** Both directions
  inserted with that clause, but `sanctions_screening` had no unique
  constraint over the match identity — re-ingests would have minted duplicate
  active rows per match, each re-firing the trigger. Migration 0089 adds the
  partial unique index `(supplier_id, list, coalesce(list_entry_ref, ''))
  where active`. Applied to production 2 Aug 2026 via the Supabase MCP
  (`20260801234013`), definition verified in `pg_indexes`.
- **Supplier-side prefilter is best-first.** `entity_name_norm %% %s` over the
  existing GIN index `idx_sle_name_trgm`, ordered by `<->` distance so a true
  match survives `limit 50` even when many OFAC entries trigram-match a short
  BD factory name. (Entry side's prefilter left as-is — no drive-by.)
- **architecture.md claimed screening "runs as an Inngest job" — false** (no
  Inngest code exists in the repo); rewritten to describe the real mechanism.
  Lines 24/33 still mention Inngest as an approved background-job tool —
  adjacent doc debt, deliberately out of scope, noted here.

Tests: 23 new in `etl/tests/test_sanctions_screening.py` pinning both
directions against the real observed pairs (permutations / initials swaps
rejected, true variants match, "M S D"-class names unscreenable on both
sides, one active row per match, re-screening idempotent under the 0089 key).
pytest 471 passed + same 1 pre-existing failure (`bgmea_buying_house` absent
from the SQL allow-list, unrelated); ruff clean on touched files; `npx tsc
--noEmit` clean; `npm test` 336/336.

Session 2 production outcome (2 Aug 2026, VPS `109.104.153.228`):

- **Deploy `e8b1b3f` via manual SSH path** (GitHub Actions still cannot reach
  the VPS — the REZ-31 runner-network issue), both `sourcebd-web` and
  `sourcebd-etl` images built (the 31 Jul lesson: the fix is ETL code baked
  into the etl image). Smoke green: `/api/health` 200 reporting `e8b1b3f`,
  `/admin/sources` 200, `run-queue --limit 0` → processed 0 / failed 0.
  Rollback ref `42da527` (`.deploy/previous-sha` +
  `sourcebd-web:rollback-42da527...`).
- **Backfill `ops/sanctions_rescreen.py` run supervised in tmux** (~2h27m,
  one-off; never cron it — a crash between clear and rebuild leaves
  sanctioned suppliers clean): `rescreen.before` 0 active / 0 flagged →
  `rescreen.done` 13,366 entries processed, **0 new matches** (`by_list {}`),
  0 active / 0 flagged after. Every current supplier — including the 67
  never-screened — is now verified clean against the 13,366 stored entries
  under the shared `_pair_matches` predicate. The 3 historical (inactive,
  14 May) screening rows are preserved as audit.
- **End-to-end proof on real Postgres in a rolled-back transaction** (the
  REZ-31/34 lesson: mocked-cursor SQL is unverified SQL). Against published
  supplier Pack & Trim Collections (`000828ed`, SBI total 3): inserting an
  active `ofac_sdn` screening row flipped `is_sanctioned` to true and zeroed
  `sbi_scores.total` with `sanctioned_zero = true` (proves
  `trg_sanc_propagate` fires); re-inserting the same
  `(supplier_id, list, list_entry_ref)` raised a unique violation from
  `idx_sanc_screening_unique_active` (proves the 0089 idempotency guard).
  Rolled back — verified afterwards: 0 probe rows, supplier and score
  untouched.
- Later the same session window: REZ-33 (`303d2f3`) and REZ-36 Spec A
  (`8e9af23`) deployed after this one, moving the VPS to `8e9af23`, which
  carries REZ-32; REZ-32 is also in `main` (`e8b1b3f` is an ancestor via the
  merged development→main PRs #63/#64).

## Shipped Baseline
- Phase 0 data moat and Phases 1-5 are shipped in the codebase.
- Phase 6 hardening H1-H8 is shipped in codebase.
- FE-SITEWIDE design conformance pass is complete enough to be the current visual baseline.
- P1 deploy artefacts and Phase 7 P2-P4 beta surfaces are reported as landed.

## Current Goal
Launch-readiness closeout:
- Deploy to VPS `109.104.153.228`.
- Apply migrations 0048-0049 and 0060 to production Supabase.
- Run the 30-day zero P1/P2 Sentry incident window before calling beta fully live.

## ETL Zombie Reaper + Universal Heartbeats (REZ-31)
2 Aug 2026 - FULLY COMPLETE in production (reaper core VPS `9591e41`, manual
escape hatch VPS `42da527`, PR #59 development→main unmerged; Linear issue
moved to Done). Workers are ephemeral `docker compose run`
containers; one dying between `_open_run()` and `_close_run()` left its job
and run `running` forever, and the schedule skip-slide then ate every
interval the zombie blocked.

Architectural decisions worth keeping:

- **The reaper is the top of `run_queue()`, one transaction, and raises.**
  `reap_stale(stale_after_hours)` in `etl/jobs/scraper_queue.py` fails stale
  `running` jobs (`coalesce(heartbeat_at, started_at, requested_at)` older
  than `ETL_REAP_STALE_HOURS`, default 3), writes one `etl_job_events`
  `failed` row per job, fails runs linked from reaped jobs, then fails
  orphaned `running` runs. The orphan predicate's `NOT EXISTS`
  (pending/running job with `etl_run_id = run.id`) is load-bearing: a
  queue-backed run's liveness is its job's heartbeat, so it is never reaped
  from under a living worker; CLI-opened runs reap on age. Pending jobs are
  never reaped (pending = worker never arrived = REZ-39 alerting problem).
  Riding the existing minutely cron means no new scheduler, and raising
  means `notify_etl_fail` fires instead of the queue running on top of a
  broken reaper.
- **Heartbeat universality is the reaper's safety precondition.** A reaper
  keyed on heartbeats kills any healthy job that never writes one, so every
  path now heartbeats: `_claim_next_job` sets `heartbeat_at = now()` at
  claim (schedule-enqueued jobs sat NULL until first progress), and
  `VerifyEvidenceJob` / `RefreshMonitorsJob` emit `progress_callback` events
  mid-run (every 25 docs / per monitor reconcile), guarded for CLI runs
  where no callback exists.
- **Skip-slide is replaced with catch-up semantics.**
  `enqueue_due_schedules` advanced `next_run_at` even when it skipped
  enqueueing behind a pending/running row — the weekly `rsc` schedule
  silently ate its 31 Jul run this way. The timer now advances only on an
  actual enqueue; a still-due schedule fires on the next cron minute once
  the reaper clears the block.
- **Resurrection guard:** `_mark_success` / `_mark_failed` only update rows
  still `status='running'`, so a half-alive process cannot flip a reaped job
  back.
- **The manual escape hatch mirrors the reaper predicate.** Migration 0088
  (2 Aug 2026, commit `42da527`): `admin_etl_job_decide` now accepts
  retry/cancel on a `running` job only when `coalesce(heartbeat_at,
  started_at, requested_at)` is older than 3 hours — exactly the reaper's
  staleness rule, so one rule covers the automatic and operator paths, and a
  live job (which heartbeats) can never match it; a fresh `running` job still
  raises. Before this, a zombie could only be cleared with manual SQL.
  `/admin/sources` surfaces "Retry (stale)" / "Cancel (stale)" on stale
  running rows (server stays the enforcement — hard rule 7); the UI predicate
  `isStaleRunningJob` in `lib/admin/etl-monitoring.ts` is held in lockstep
  with the SQL by 7 tests. Production verification ran in a rolled-back
  transaction: fresh `running` → `only failed or cancelled jobs can be
  retried` / `only pending jobs can be cancelled`; 4h-stale `running` →
  retry returns `status='pending'` with all run columns reset, a
  `Stale job`-prefixed event row, and the `admin_audit_log` write; no JWT
  claims → `admin only`; no synthetic rows persisted. Smoke on VPS
  `42da527`: `/api/health` + `/admin/sources` green.
- **`make_interval(hours => %s)` rejects a float bind on real Postgres**
  (int-only, 42883) while mocked-cursor tests never parse the SQL — the
  threshold is `(%s * interval '1 hour')`. Same class as REZ-34's
  `IndeterminateDatatype`: SQL that only ever runs under a mocked cursor is
  unverified SQL.

Production verification (1 Aug 2026 22:14 UTC, first cron pass after the
deploy): reaped exactly the audited zombie population — 2 queue jobs (`rsc`,
`rsc_documents`, dead since 30 Jul) and 7 `etl_runs` (2× bkmea_web 12 May,
bgapmea_web 14 May, oeko_tex 26 May, rsc + rsc_documents 30 Jul,
bgmea_buying_house 30 Jul) — each job with a `Reaped:` event row; every
minutely cycle since logs `jobs_reaped: 0, runs_reaped: 0`. Both reaped jobs
had NULL `etl_run_id` (worker died before linking), so their runs correctly
fell to the orphan predicate. `rsc` schedule still shows `next_run_at =
2026-08-07 05:14 UTC` and will now fire normally. Smoke: `run-queue --limit
0` → processed 0 / failed 0. Tests: 14 new in
`etl/tests/test_scraper_queue_reaper.py`; pytest 448 passed (same 1
pre-existing failure), ruff clean on touched files, `npx tsc --noEmit`
clean. REZ-31 is closed (reaper + 0088 manual escape hatch); pending-job
alerting continues as its own issue, REZ-39.

## Evidence Verification Tier Activation (REZ-34, with REZ-42)
2 Aug 2026 - Phases A/B/C COMPLETE; the verification tier is live in
production. Spec:
`context/feature-specs/spec-evidence-verification-tier-activation.md`. Phase D
(contradicted-claims triage) is now a standing routine with its first pass
executed. VPS is on `9591e41` — see the main-lag note below before any
`--ref=main` deploy.

Phase D first pass (2 Aug 2026): 881 unreviewed contradicted claims were
classified per supplier and 855 retired (status `orphaned`, review notes
prefixed `Phase D triage (REZ-34)`) across 73 suppliers — 72 one-company
decisions (62 plain re-listings, 7 membership-suffix corrections, 2
dual-membership same-company, 1 duplicate-profile same-factory) plus OSHIN
KNITWEAR, whose 16 losing claims cite OSHIN TEXTILE's page 84 (different
company, already split out on 31 Jul). Retirements were direct SQL replicating
`admin_evidence_claim_decide` retire semantics (the RPC asserts an admin JWT).
26 claims remain unreviewed by design — GOLDEN KNITWEAR (PVT) LTD (12) and
MUKTER EXPORT LTD. (14) are queued for a claim-level repair batch, not
triaged (see pattern 2). Two systematic patterns found:

1. **BKMEA re-listing (72 of 75 suppliers).** BKMEA re-lists members on new
   detail-page ids (21xx/22xx series) carrying the same membership number;
   the old pages still serve stale data and both are scraped every run, so
   each `bkmea_detail` run re-mints a fresh contradicted population (new
   document versions → new claim rows). Phase D triage is therefore a routine
   that never converges while both listings exist — expected and per spec.
2. **Unmerge claim residue (new finding, not covered by the spec).** The
   31 Jul unmerge moved `source_records` but not supplier-subject claims:
   all 39 split-off suppliers have zero evidence claims; every citation
   written while records were merged stayed on the pre-split parent. GOLDEN
   and MUKTER are inverted — their active citations point at the other
   company's page while their own records' claims sit contradicted (published
   profile columns are correct; conflation is citation-layer only). Retiring
   their contradicted claims would orphan their own registry citations, so
   they are queued for a dry-run-first claim-repair script
   (`ops/unmerge_bkmea_suppliers.py` does not cover this — it requires >1
   base membership per supplier). The next `bkmea_detail` run partially
   self-heals (split-offs gain first claims, own-record claims re-assert)
   and will mint fresh unreviewed contradicted rows for the next pass.
   Also queued: NOOR-A-ALIA / NOOR-A-ALIA FASHION duplicate-profile merge
   candidate (noted in its review note, not actioned).

Architectural decisions worth keeping:

- **Monitor registration is fail-loud.** `_monitor_spec` emits the real
  `/v2/monitor` schema (`targets[0].{type,urls,scrapeOptions}`,
  `schedule.text`, `webhook.events`), and `create_monitor` raises on non-2xx or
  `success:false`. A failed registration never writes a local row — that is
  what minted the 6 phantom NULL-`monitor_id` rows in production.
- **The webhook contract is a `data` array of page entries, classified on
  `data[i].status`.** The route writes one row per entry (dedupe
  `fc:{envelope id}:{index}`, body-hash fallback); the inbox requeues on
  `changed`/`new`/`removed`, ignores `same`, and `error` increments
  `consecutive_errors`. Event-type classification is gone.
- **REZ-42 is closed by transaction scope, not schema.** `process_pending`
  holds one connection for select-`FOR UPDATE SKIP LOCKED` → process → mark →
  commit, so overlapping drains cannot double-process. No `processing` status
  needed.
- **Verification replay goes through the source class.** `EvidenceVerifier`
  resolves `SCRAPERS[scraper_code]` and builds the request through the class's
  own adapter, so `request_headers`/`rps`/TLS apply to replays exactly as at
  ingest. `AcquisitionMixin.verify_transport` (new class attribute) overrides
  the replay transport per source — `BkmeaDetailScraper` verifies `direct`
  (founder-approved, parity-proven; ~0 credits vs ~1,770/week). One declaration
  point per source, same philosophy as `monitor_targets`.
- **The verifier has a credit ceiling.** `VerifyEvidenceJob` prices each
  Firecrawl replay with `estimate_credits` before fetching and stops the run
  before overspend; ceiling defaults to `firecrawl_max_credits_per_run` (0 =
  off) and is overridable per run / via `--max-credits`. This makes the
  queue-dispatched weekly job safe unattended. Also: `--interval-hours 0` now
  means "everything is due" (`is None` default, not `or`).

Tests: pytest 434 passed (1 pre-existing failure at HEAD —
`bgmea_buying_house` absent from the SQL allow-list, unrelated); `npm test`
329/329 (route tests intercept `globalThis.fetch`; Node 20 needs
`--experimental-websocket` for supabase-js, now in the test script); `npx tsc
--noEmit` and `ruff check` clean.

Phase B/C production outcome (2 Aug 2026, VPS `109.104.153.228`):

- **`FIRECRAWL_WEBHOOK_BASE_URL` was the doubled-path misconfig** — it held the
  full endpoint URL and `urljoin` appended the path again. Now the bare origin
  `https://sourcebd.net` (backup `.env.bak-20260802-phaseb` on the VPS).
- **15 monitors registered, agreeing both ways**: every `evidence_monitors`
  row has a non-NULL `monitor_id` and the corrected webhook URL; upstream
  `list_monitors()` matches the id set exactly. The 6 phantom rows self-healed
  through the upsert — no manual SQL.
- **End-to-end webhook proof**: a real-shape `monitor.page` / `changed` test
  delivery landed (200, `recorded=1`), drained (`processed=1`), requeued the
  source's document (`last_verified_at` cleared), and set the monitor health
  columns (`last_check_at`/`last_status=changed`/`last_change_at`). Wrong
  secret → 401.
- **The runbook caught a defect Phase A's tests could not.** The first live
  drain crashed on `_monitor_scraper_code`: a bare `%s is not null` parameter
  raises `IndeterminateDatatype` on real Postgres (psycopg binds server-side;
  the guard has no type context). Mocked-cursor unit tests never parse the
  statement, so the production end-to-end step was the only test that could
  catch it — and did. Every change-status drain rolled back cleanly (REZ-42's
  transaction scope: zero partial writes), but the minutely cron stalled behind
  the pending test event until it was marked `failed`. Fix: `%s::text`, commit
  `2b76046`. The same event was then reset to `pending` and drained as the
  C.4 proof (`attempts: 2`).
- **Smoke verify**: 50/50 `live`, 2,543 claims confirmed, `credits_used: 1`
  (bkmea_detail replays direct; the 1 credit is the cbp_wro doc on its ingest
  adapter). 50 rows in `evidence_verifications`.
- **Both jobs scheduled daily** (1440 min, via direct SQL —
  `admin_etl_schedule_upsert` asserts an admin JWT, so the RPC path is the
  admin UI; the spec allows SQL). First unattended cycles succeeded:
  `verify_evidence` 20:45 UTC (0 due at 168h — the 6–7 Aug wave drains ~500/day
  by design), `refresh_monitors` 20:46 UTC (15 existing, 0 created — idempotent
  reconcile). Queue rows link to their `etl_runs`; schedules advanced to
  2026-08-02 20:45 UTC.
- **The VPS now tracks `development` (`9591e41`), not `main`.** `origin/main`
  (`59f6a47`) lacks the inbox fix; a `--ref=main` deploy would revert it until
  the development→main PR is merged. Merge it before the next main deploy.
- **GitHub Actions "Deploy Production" cannot reach the VPS** (`dial tcp
  109.104.153.228:22: i/o timeout` from the runner — network-level, before
  auth). Manual SSH deploy (the documented secondary path) was used. The
  workflow needs firewall/runner-network attention before it is usable.

## Supplier Identity + Evidence Status Split
31 Jul 2026 - Complete, in the working tree. Triggered by "why does
/admin/evidence say 11,320 need review?", which turned out to be two defects
stacked on each other.

Architectural decisions worth keeping:

- **Superseding a citation is not a problem, and no longer looks like one.**
  `supersede_claims` wrote `stale` — the verifier's word for "the cited page no
  longer contains this value" — for the routine case of re-scraping a page. The
  worklist therefore counted ~11.9k non-problems while the verifier had never
  run once (`evidence_verifications` was empty), and grew by ~5,800 per
  `bkmea_detail` run without bound. Migration 0087 adds a `superseded` status
  that sits outside every needs-review filter.
- **But supersession is classified, not assumed.** Retiring everything silently
  would have hidden the second defect. The rule (writer and migration agree):
  same `url_hash` -> `superseded`; different URL but same value -> `superseded`;
  **different URL asserting a different value -> `contradicted`, and stays
  visible**. `evidence_documents` is unique on (url_hash, content_sha256), so a
  refetch of a changed page keeps its url_hash — that is what distinguishes "the
  page moved on" from "another page disagrees".
- **Contact overlap is not identity.** 82 suppliers held BKMEA member records for
  genuinely different companies. Bangladesh RMG groups run legally distinct
  factories off one switchboard and one group mailbox, and `_find_existing`
  Pass 2/3 merged on email or phone with no name check: ABANTI COLOUR TEX with
  CRONY APPARELS, SWEATER HEAVEN with FATULLAH FASHION, ABONI KNITWEAR with
  ABONI TEXTILE. Both passes now require a name floor (85) below the fuzzy
  threshold — the contact is corroboration, so the names need only be
  recognisably the same company. A duplicate supplier is visible and mergeable;
  a conflation silently publishes one factory's data under another's name.
- **`token_sort_ratio` is blind to the signal that separates these names.** It
  sorts tokens before comparing, so COTTON FAIR vs FAIR COTTON scores 100 and
  H. R TEXTILE MILLS vs G. R TEXTILE MILLS scores 94 — both over the 92
  threshold, both different companies. Pass 4 now also requires an
  order-sensitive `fuzz.ratio` over threshold, and forbids swapping one leading
  initials block for another. Pinned in
  `etl/tests/test_supplier_dedup_guards.py` against the real observed pairs, in
  both directions: conflations must not merge, true variants must still merge.
- **Max-merge hides downward corrections.** Fixed in REZ-68 / A8 (code on
  branch; production apply pending founder dry-run approval). KNIT GUARD
  machines_sewing 150 → 36 is the motivating case.

**Applied to production 31 Jul 2026** (main `bf9647d`). Migration 0087 took
needs_review from ~11.9k to 881, with 12,551 claims filed as `superseded`. The
unmerge split 40 groups into 39 new suppliers (10,245 -> 10,284) in one
transaction, taking conflated suppliers from 82 to 47; `backfill_profile_columns.py`
recomputed the derived columns afterwards. The unmerge moves source records and
evidence claims only; buyer-facing rows (saved_suppliers, message_threads, orders,
claim_requests) stay with the surviving supplier because there is no honest way to
know which company the buyer meant.

The 47 remaining are deliberate: BKMEA re-listing one company under two
membership numbers (a different base number opens the question, the names settle
it), or records with no scraped name, where inventing one is worse than leaving
it. One duplicate source record is stranded on CRONY FASHION LTD — two parents
each held a scrape of the same page and `source_records` is unique on
(supplier_id, source_id, source_ref).

Two things make this durable rather than a one-off cleanup:

- **`ops/deploy_vps.sh` now builds the etl image too.** It built only web. The
  etl service bakes the pipeline source in and cron invokes it with
  `docker compose run`, which reuses the existing tag — so the guards went live
  in the web container and were *absent from the scrapers that needed them*,
  while `/api/health` reported the new commit and the deploy looked clean. The
  next BKMEA run would have re-merged everything just split apart. Web and etl
  are one commit and must be built as one.
- **`ops/check_supplier_conflations.py`**, daily at 03:17 via
  `ops/conflation_check_cron.sh`, on the assumption the guards will eventually be
  circumvented. It reuses `_names_compatible`, so detection cannot drift from the
  rule it polices. A check that cannot run also alerts — otherwise a broken DSN
  disarms it silently. `ops/` is mounted rather than baked (the etl Dockerfile
  copies only `etl/` and `supabase/`).

## Firecrawl Acquisition Layer + Verified Provenance
29 Jul 2026 - Complete, in the working tree, from the accepted plan
`firecrawl_acquisition_layer`. Acquisition is now a separate concern from parsing
and persistence, and every stored fact carries a checkable citation.

Architectural decisions worth keeping:

- **Firecrawl replaces the acquisition concern only** (Hard-Rule-4 exception,
  founder-approved 29 Jul 2026, recorded in `context/architecture.md`). Parsing
  and persistence stay in our Python, so Hard Rule 5 field fidelity is never
  delegated. Extraction is deterministic at 1 credit/page; Firecrawl's LLM `json`
  mode is deliberately unused for registry facts.
- **Three adapters behind one interface** (`etl/acquire/`): Firecrawl for 14 HTML
  sources, Direct (httpx) for the 11 typed feeds Firecrawl cannot express
  (JSON/CSV/XML/XLSX/Power-BI), Local for the 2 on-disk sources. Every source
  emits identical evidence rows regardless of transport — asserted over the whole
  registry in `etl/tests/test_feed_sources_acquire.py`, not left to convention.
- **A citation is a URL plus a locator plus a verbatim excerpt** (migration 0084:
  `evidence_documents`, `evidence_claims`, `evidence_verifications`,
  `evidence_monitors`, `firecrawl_webhook_events`). The excerpt is what makes the
  no-dead-links guarantee machine-checkable: a page that returns 200 but has
  dropped the fact is caught, not just a 404.
- **`verify_mode` on each document decides verification depth** — `full` (a GET
  or a file, replays exactly, so a missing excerpt is real drift), `liveness` (a
  Firecrawl action sequence produced the payload; a replay reaches the page but
  not the payload, so a missing excerpt means "could not check"), `none` (a POST
  body cannot be reissued, so it is excluded from the queue and rests on its
  archived Bunny snapshot). Without this split every action-driven and POST-driven
  claim would be marked stale on the first pass.
- **Transient failure never retires a citation.** Timeouts, 403s and 5xx leave the
  last known good state, log `inconclusive`, and double the retry backoff. Only a
  definitive 404/410 orphans claims — and a *missing local file* is inconclusive,
  not dead, because an unmounted raw directory is our problem, not a retraction.
  This is the REZ-30 rule, and it is carried into the UI: `/admin/evidence` lists
  "could not be checked" separately from "checked and no longer supported".
- **XML feeds keep their markup when excerpting.** OFSI and the EU list put their
  payload in attributes (`wholeName="..."`), so stripping tags would delete every
  value and leave every claim unverifiable. Writer and verifier both route through
  `strips_tags_for()`, so an excerpt is re-checked under the rules that produced it.
- **Multi-record responses are excerpted against the single record they describe**
  (`json_record_window`, `_rows_with_raw`). One RSC response carries 200 factories;
  a page-wide search would let a neighbouring factory's worker count stand as this
  one's evidence.
- **Two-tier verification.** Firecrawl `/v2/monitor` on the ~20 index pages each
  source declares via `monitor_targets()` (declared on the source, so an entry
  point cannot change and quietly stop being watched), webhooking
  `/api/v1/webhooks/firecrawl`. That route only authenticates and records — it has
  10 seconds before Firecrawl retries — and the worker drains the inbox. A change
  notification requeues documents by clearing `last_verified_at`; it never
  concludes a fact is wrong, or a cosmetic redeploy would orphan thousands of
  claims. The `verify-evidence` job covers the long tail.
- **Maintenance jobs are registered separately from sources** (`JOBS` vs
  `SCRAPERS`, union `RUNNABLE`). `verify_evidence` and `refresh_monitors` run
  through the same admin queue, timer UI and run history, but a job has no
  transport and no evidence, so folding them into `SCRAPERS` would weaken the
  registry-wide invariant into a convention.
- **Playwright is retired everywhere except `brand_ms`**, which must read a
  per-contributor `x-oar-client-key` out of live iframe request headers — no scrape
  API exposes that. `etl/core/ssl_rsc.py` also stays: both RSC sources still reach
  rsc-bd.org directly for binaries and the direct fallback.

**An excerpt is never taken from a document wider than the record it belongs to.**
On a page carrying hundreds of records, a shared value — `"active"`, a repeated
worker count, a district name — can match a *neighbouring* record, and the claim
would then quote one supplier's bytes as another's evidence. Every multi-record
source therefore narrows to its own slice first, and where that slice cannot be
anchored it passes `NO_EXCERPT` so the claim keeps its URL and locator but goes
unquoted. `NO_EXCERPT` is deliberately distinct from `None`, which still means
"search the document body" and is only sound for single-subject documents; both
are falsy, so `writer.excerpt_source()` tests for `None` by identity and is
pinned by a test. Found in review: `btma_spinning`, `rsc`, `gots`, `epb_web` and
`wrap` all had a page-wide fall-through.

**Normalisation and dedup are unchanged by this work**, which is the point: the
refactor replaced how bytes are acquired, not what happens to values afterwards.
`upsert_supplier_with_source` is called identically — the only edit captures its
return value so evidence can be attached — so every supplier still gets
`make_slug` + `normalize_company_name` + `normalize_phones`, the five-pass dedup
ladder (source_ref → slug → email → phone-overlap → fuzzy name at 92), then
`contact_merge` and `address_norm`. Watchlist sources never insert suppliers at
all; they screen existing ones at a stricter 95. Evidence claims deliberately
store the source's **raw** value rather than the canonical one, because a
citation must quote what was published — normalising it would break excerpt
verification and misstate the source. `bd_place_lexicon.py` and
`lib/bd-place-lexicon.ts` are now held in lockstep by a test that compares pairs
*and* ordering (ordering is part of the contract: `ccepz` must precede `cepz`)
and that asserts a rule-count floor first so it cannot pass vacuously if the
source scrape ever breaks.

**Runs abort before passing a credit ceiling.** `FIRECRAWL_MAX_CREDITS_PER_RUN`
(0 = off) caps billable spend per run, and a source may tighten it via
`max_credits_per_run` but never loosen it. Enforced in `AcquisitionMixin.acquire`
and `acquire_many` — the only two paths every source shares — *before* the call,
priced with `estimate_credits`, because a credit is gone the moment the request
leaves. Batches are checked whole, since a per-item check cannot stop an
overspend already in flight concurrently. Exceeding raises `CreditBudgetExceeded`
rather than stopping quietly: a half-scraped registry that looks complete is
worse than a failed run, because it silently ages out every record it never
reached. Only the Firecrawl transport is charged; direct and local are exempt.
`credits_spent` now tracks true spend on the mixin, separate from the existing
`credits_used`, which counts only cited documents — the gap between the two is
spend that bought nothing citable. Verified live: with the ceiling at 1, exactly
one page was fetched and the second was refused.

**Firecrawl resolves hrefs against the page URL before returning HTML**, and that
silently fabricates data. BGMEA renders an absent website as `<a href="">`: read
directly the href is empty and correctly becomes None, but Firecrawl returns it
as the member's *own profile URL*, which passes a bare `startswith("https://")`
check and lands on the supplier as its website. `external_website()` in
`etl/core/normalize.py` now screens on host, since a registry's domain is never a
member's own site. Found by `compare-parity bgmea_web --limit 1` — the first live
Firecrawl run of any source — which is precisely the class of bug the harness
exists to catch, and an argument for running it per source before cutover rather
than trusting unit tests. Audited the other five href extractions: `bgapmea`
takes its website from label text rather than an href, `gots` and `btma` from
JSON, and the rest are navigation links where absolutisation is harmless. The one
latent case the audit turned up is now closed too: `bkmea_web` built `detail_url`
from an href, so a blank one would have absolutised to the listing page and been
stored as that member's detail link. It is now derived from the id parsed out of
the href, which also settles relative-against-absolute hrefs on one spelling —
the same shape `epb_web` and `bgapmea_web` already use. Nothing downstream
regressed because `bkmea_detail` selects on `bkmea_detail_id`, never the URL.

Firecrawl smoke test: `compare-parity bgmea_web --limit 1` → PASS (1 record,
identical across transports). 5 credits spent in total, all of it deliberate.
`compare-parity` writes nothing to the database, which is what makes it the right
first live test while migration 0084 is still unapplied.

Verification run locally: `python -m pytest etl/tests -q` → 332 passed;
`npx tsc --noEmit` clean; `npm test` → 159 passed; `ruff` clean across every file
this work touches. Firecrawl auth confirmed working against the live API. Migration 0084 parses under libpg_query (68 statements) via
`python ops/validate_sql_syntax.py` — syntax only, which cannot catch an
unresolvable column reference.

Fixed 31 Jul 2026 (initially deferred, pulled forward because it bills real
money): `etl/jobs/barikoi_geocode.py` re-billed every address the place lexicon
rewrites, on every run. `_store()` keyed the cache with `normalize_key()` (lexicon
applied) while `_list_pending()` looked up with plain lowercase-and-whitespace SQL
(no lexicon), so any address containing a renamed district — Chittagong→Chattogram,
Comilla→Cumilla, Jessore→Jashore — never matched, was re-selected as pending, and
cost 2 Rupantor calls again. `on conflict do nothing` hid it and the run counted the
re-geocode under `resolved`, so the only symptom was quota burn.

The fix moves the pending decision out of SQL into a pure `select_pending`, so
`normalize_key` is the only thing in the system that computes a cache key. Porting
the lexicon into SQL instead was rejected: it would have created a third copy to
hold in lockstep, and two already needed a dedicated parity test.

**Measuring it against production corrected the diagnosis, and found something
worse.** `normalize_key` only gained the lexicon in REZ-28 (28 Jul 2026), so the
cache held two generations of key. Of 17,973 rows: 14,568 the lexicon does not
touch, and 3,405 keyed by the pre-REZ-28 raw spelling. Canonical-keyed rows:
**zero** — so the re-billing had not actually cost anything yet. The job had not
run since REZ-28, and the bug was armed rather than firing.

The live harm was the other direction. Those 3,405 raw-keyed rows all hold real
coordinates, and the app's read path applies the lexicon, so it was looking for a
key that is not there: **every supplier in a renamed district had silently lost its
map pin when REZ-28 shipped.** The map fails closed by design — a cache miss yields
no pin and no error — which is why nobody saw 3,405 geocodes go dark.

Repaired in place on 30 Jul rather than by re-geocoding: `address_raw` is stored
next to the key, so the canonical key is recomputable for every row without asking
Barikoi anything. `ops/rekey_geocode_cache.py` updated 3,344 rows, 0 failures. The
remaining 61 are duplicates, not gaps (54 already have a canonical row serving the
app, 7 collapse onto a shared key). Free and instant where the backfill would have
cost 6,688 Rupantor calls for the same result, and reversible — the previous key is
`raw_key(address_raw)`.

The audit after the re-key is the clearest statement of why the code fix matters:
pending is now **0 calls** under the new scan and **6,688** under the old one. The
old code against the repaired data would re-bill the entire cache on every run.
`ops/audit_geocode_cache.py` re-runs that comparison read-only at any time. Full
write-up in `context/feature-specs/spec-barikoi-geocode-cache-key-leak.md`.

Not yet verified, and to be checked before deploy:
- **The `Dockerfile` base image change is unbuilt locally** (no Docker on the dev
  machine). It moves from `mcr.microsoft.com/playwright/python:v1.47.0-jammy` to
  `python:3.12-slim-bookworm` plus `playwright install --with-deps chromium`,
  since Chromium is now the only browser used. Build it before deploying.
- ~~Migration 0084 has not been applied~~ **Applied to production 30 Jul 2026**
  via the Supabase MCP, along with 0085. Verified after apply, not just assumed:
  5 tables with RLS on, 6 functions, 18 indexes, 4 triggers, and an allow-list of
  28 codes with `brand_inditex` absent and `verify_evidence` / `refresh_monitors`
  present. The `service_role` grant on `firecrawl_webhook_record` matters and is
  confirmed present — revoking the function from `public` also removes the
  implicit grant the webhook route relied on, so without it every delivery 500s
  while every test still passes.

  Access was proven rather than inferred (`ops/verify_evidence_access.py`): with
  the anon key, all five admin RPCs answer 401 "admin only", the webhook function
  answers 401 "permission denied", and direct reads of all three tables answer
  401. The advisor lists those RPCs as anon-executable, which is true of 71
  pre-existing RPCs here too — the real control is the `admin_etl_assert_admin()`
  call inside each one, per hard rule 7.

  One sharp edge checked and cleared: `etl_job_queue` and `etl_schedules` both
  CHECK `scraper_code` against this allow-list, and dropping `brand_inditex` from
  it is a narrowing, not the widening the migration header describes. Postgres
  does not re-validate existing rows, but it does re-check on UPDATE, so a live
  row for a removed code would break the moment a worker touched it. There are no
  `etl_schedules` rows and exactly one `etl_job_queue` row: a terminal `failed`
  job from 26 Jun whose error is "no disclosure file link found on
  inditex.com" — the very evidence for retiring the source. Terminal jobs are
  never picked up or updated, so it cannot trip the constraint, and it is left in
  place deliberately as the audit trail for that decision.

  0085 exists because the advisor flagged a mutable `search_path` on 0084's
  url_hash trigger function once it was live. Kept as its own migration rather
  than folded back, since editing an applied migration makes a fresh database and
  production disagree about history even when they agree about schema. 11
  pre-existing functions still carry that finding, `touch_updated_at` among them;
  out of scope here.
- No Firecrawl monitors are registered yet: `refresh_monitors` needs
  `FIRECRAWL_API_KEY`, `FIRECRAWL_WEBHOOK_BASE_URL` and
  `FIRECRAWL_WEBHOOK_SECRET` set, and refuses to register a monitor that would
  report to nobody.

### Live parity sweep, 29 Jul 2026

Every Firecrawl source was compared against its direct baseline on the real API,
about 60 credits in total. Nine sources are identical across transports:
`bgmea_web`, `bkmea_web`, `bkmea_detail`, `bgapmea_web`, `brand_asos`,
`brand_hm`, `brand_next`, `ilab_tvpra`, `cbp_wro`. Two need a product decision
(below) and four are legitimately not comparable.

The sweep found more than the earlier website-absolutisation bug, and the common
thread is worth stating plainly: **the dangerous failure is not an error, it is
silence.** Four separate paths could fetch successfully, parse to zero rows, and
report success. On a forced-labor watchlist that means every supplier screens
clean; on a brand disclosure it means existing suppliers quietly stop being
refreshed. Fixes therefore favour raising loudly over returning empty.

What was fixed:

- **The harness could not test sanctions sources at all.** It keyed every record
  on `source_ref`, but watchlist sources yield `SanctionEntry`, keyed on
  `entry_ref` with no `payload`. All three raised `AttributeError` and were
  silently unvalidated — the sources where a false positive brands a real factory
  as sanctioned. `record_ref` / `comparable_fields` now handle both shapes, and a
  record carrying neither key is refused rather than collapsing every entry onto
  one dictionary key. `raw` is excluded from comparison: it is our own capture of
  the scrape, not a publisher assertion, so it differs by design.
- **`cbp_wro` reported an empty Withhold Release Order list via Firecrawl.** CBP
  redirects the listing to a Tableau dashboard which is still on cbp.gov and
  still carries three `<table>` tags, so the old gate (`"<table" in text`) waved
  it through; every table was then skipped and zero entries yielded without
  error. Direct meanwhile gets a 403 and correctly falls back to Wayback, which
  is why only one transport was wrong. The gate now requires a table whose header
  names both the entities and merchandise columns, using the same predicate the
  parser uses so the two cannot drift, and a readable page parsing to zero
  entries now raises.
- **`brand_next` had two independent breakages.** Next renamed the tier 1 file
  from `T1 2025.pdf` to `PLC LIST FEB 2026 - TIER1.pdf`, so it was no longer
  found; the tier is now read from the decoded filename, never the whole URL,
  because the folder is called `Tier 1 -2 - 3 lists` and a URL-wide match would
  have picked up the Tier 2 and Tier 3 lists sitting beside it and published
  downstream subcontractors as direct manufacturers. They also changed the PDF's
  internal layout, inserting `Site Id` and `Country` ahead of the old first
  column, so positional indexing found no country and produced zero rows. The
  parser is now header-driven and handles both layouts: 397 Bangladesh rows,
  identical on both transports.
- **`brand_hm` cited two different URLs for one file.** H&M's filename really
  contains a space; direct returns it literally and Firecrawl percent-encodes it,
  so the stored citation depended on the transport. `canonical_url` in
  `etl/core/normalize.py` converges both on the encoded form without
  double-encoding an already-encoded URL.
- **Soft 404s are now detectable.** `AcquiredDoc.landed_on_site_root` reports a
  request for a specific page answered with the homepage, which is how sites
  retire pages while returning 200. This matters for provenance specifically: a
  citation is a promise that a URL shows a human the cited fact, and a homepage
  cannot keep it.
- **The harness no longer cries wolf.** A sweep that reports things it never
  could have validated as regressions gets ignored, and then a real failure gets
  ignored with it. `SKIP` is now distinct from `FAIL` (exit code 3), and is never
  treated as a pass. `rsc_reports`, `rsc_updates` and `rsc_documents` declare
  `yields_records = False` because they override `run()` and leave `fetch()` a
  stub, so there was never anything to diff. `sa8000` has no direct baseline at
  all. `uflpa` is skipped because DHS serves our address a 403 while Firecrawl
  returns the list — the migration working, not failing.
- **`compare-parity` reports credits spent**, so a sweep can be costed.
- One sampling trap worth remembering: `bkmea_detail` "failed" only because it
  fetches 590 detail pages concurrently and does not yield in a fixed order, so
  `--limit 1` sampled a different factory on each side. It is 8/8 identical at
  `--limit 8`. The report now says so instead of implying a data conflict.

Two sources are blocked on a decision rather than on engineering:

- **`brand_inditex` is retired** (decided 29 Jul 2026). Its landing page now 200s
  and redirects to the Inditex homepage, and more fundamentally Inditex does not
  publish a factory-level supplier list at all: only aggregate country counts,
  with the actual list shared privately with IndustriALL Global Union under their
  Global Framework Agreement. Know The Chain penalises them for exactly this. No
  selector fixes a disclosure that does not exist, so the scraper was removed from
  all four places that referenced it — the Python registry, the admin catalog and
  transport map, and the SQL allow-list in 0084 — each with a comment saying why,
  so it does not get re-added. `BRAND_INDITEX` stays in `upsert.py`'s tier map on
  purpose: rows ingested before today still need their tier resolved.
- **`brand_primark` is pointed at the wrong document**, and is queued as its own
  spec (`context/feature-specs/spec-brand-primark-global-sourcing-map.md`). It
  parses the Modern Slavery Statement, which is narrative prose, so zero rows is
  the correct output from the wrong file. Primark does publish a real factory list
  — the Global Sourcing Map at `globalsourcingmap.primark.com`, with factory
  names, addresses, worker counts and gender splits, and an Excel export.
  Deferring is safe because it now fails loudly rather than reporting an empty
  supplier list.

## Recent Admin Scraper Ops
26 Jun 2026 - Admin scraper operations implemented from the accepted plan.
Scope adds `/admin/sources`, admin-only ETL queue/schedule RPCs and API
routes, the `etl_job_queue` / `etl_schedules` migration, a VPS cron runner
for due schedules and queued jobs, and a shared scraper catalog that includes
BGMEA, BKMEA, BGAPMEA, EPB, BTMA, RSC, WRAP, OEKO-TEX, GOTS, SA8000,
sanctions/regulatory, and brand-disclosure scrapers. ETL execution remains in
the Python/Docker ETL service; the web app only enqueues and reports.
`pnpm typecheck`, `pnpm lint`, Python compile checks, `python -m etl.cli list`,
and `python -m etl.cli run-queue --limit 0` pass. Lint still reports
pre-existing warnings outside this work.

27 Jun 2026 - Admin scraper monitoring upgraded and deployed to VPS
`109.104.153.228`. Scope adds live progress counters, heartbeat timestamps,
per-job event timelines (`etl_job_events`), an admin polling status API, and a
live `/admin/sources` monitor with elapsed time, visual record bars, and
operator-facing action text. Production migration
`0064_admin_etl_live_monitoring.sql` applied and verified; web rebuilt and
restarted healthy. Local verification passed: `python -m py_compile` for ETL
progress files, `pnpm typecheck`, and `pnpm lint` (same pre-existing warnings).
Production smoke: `/api/health` OK, `docker compose ps` healthy, cron installed,
and `docker compose run --rm etl run-queue --limit 0` returned processed 0 /
failed 0.

26 Jun 2026 - Scraper operations deployed to VPS `109.104.153.228` via a
tmux-backed finish deploy after the first SSH build disconnected. Production
Supabase migration `0063_admin_etl_scraper_ops.sql` applied and verified,
`sourcebd-etl:latest` and `sourcebd-web:latest` built, web container recreated
healthy, and the scraper queue cron installed:
`/opt/sourcebd/ops/scraper_queue_cron.sh` every minute. Final smoke checks:
`/api/health` OK, `docker compose ps` healthy, ETL CLI lists `wrap`, and
`docker compose run --rm etl run-queue --limit 0` returns processed 0 / failed 0.

## Recent Admin Repair
26 Jun 2026 - Admin UI overhaul completed in the working tree under
`context/feature-specs/spec-ADMIN-CONSOLE-repair.md`. Scope is presentation
and operator usability across `/admin`, using the existing SourceBD app
surface primitives and vendored Magic UI-style layout components without new
dependencies or backend changes. Changes add shared admin UI wrappers, polish
supplier and queue workflows, migrate admin moderation/list/detail pages to a
consistent responsive system, and add the review queue to admin topbar quick
navigation. `pnpm typecheck` and `pnpm lint` pass; lint still reports
pre-existing warnings outside the touched admin work.

26 Jun 2026 - Admin console repair completed in the working tree under
`context/feature-specs/spec-ADMIN-CONSOLE-repair.md`. Changes add a unified
`/admin/queue` hub, clearer supplier publication feedback and profile
revalidation, operator-focused supplier list/detail labels, and moderation
page polish. `pnpm typecheck` and `pnpm lint` pass; `pnpm build` still fails
on Windows before compilation with `.next/trace` EPERM.

## Recent Barikoi Integration
6 Jul 2026 - Barikoi location services integrated (founder-approved Hard-Rule-4
exception; see architecture.md → Maps/geocoding). Web: `lib/barikoi.ts`
(server-side Rupantor resolution, DB-cache-first with bounded live fallback),
`components/supplier/locations-map.tsx` (`bkoi-gl` map, forest pins, no scroll
hijack), wired into the profile Locations card on both app and marketing
routes. ETL: `etl/jobs/barikoi_geocode.py` + `geocode-addresses` CLI command
backfill `public.address_geocodes` (mig `0077_address_geocodes.sql`).
Verified: typecheck/lint/py_compile pass; Rupantor API key smoke-tested OK.
PENDING OPS: migration 0077 is NOT yet applied — Supabase pooler ports
5432/6543 are unreachable from the dev machine; apply from the VPS
(`python -m etl.cli migrate` or psql) and then run
`python -m etl.cli geocode-addresses --limit 500` to start the backfill.
Until then the profile map works via live geocoding only (first 4 addresses
per profile, memoised in-process).

## Recent Map UX
28 Jul 2026 - REZ-30: Supplier map enrichment pack shipped (12 points).
`components/supplier/locations-map.tsx` rewritten again. **Fullscreen removed** — the map is
taller inline instead (380 / 470 / 540px), since fullscreen hides the address list that gives
the pins meaning. Pins now carry two independent channels: address kind (head shape + tone,
numbered to match the list rows) and geocode precision (filled = premises, hollow =
area-level). Confidence keys off `confidence_pct < 70` only — `address_status` is
"incomplete" on every cached row, so a cue based on it would flag 100% of pins and say
nothing (~39% of the cache is below 70, so the cue discriminates). Pins within 60 m get a
pixel spiderfy so each stays clickable. Added an on-map site switcher (arrow keys / Home on
the focused map region), straight-line distance sentence, curated-landmark context chips, a
live scale bar, `?site=N` permalinks via `history.replaceState`, GeoJSON pin export, and an
optional "other published SourceBD sites nearby" layer. New `lib/geo.ts` (haversine, bbox,
centroid, span, spiderfy, metresPerPixel), `lib/bd-landmarks.ts` (curated ports/airports/
EPZs/belts), `lib/nearby-suppliers.ts` + `app/api/suppliers/nearby` (rate-limited via
`lib/rate-limit/limits.ts`).

Three real bugs found and fixed while verifying, worth remembering:
1. **`GROUP_KIND` lived in a `"use client"` module** and was imported by the server component
   `profile-overview-tab.tsx`. A plain object imported out of a client module is a
   client-reference proxy, not the object, so every lookup returned `undefined` and every pin
   silently fell back to kind "other" — the map legend contradicted the address list. The
   table now lives in `lib/dedup-addresses.ts` as `CATEGORY_BY_GROUP` (server-safe) and the
   client re-uses it. **Lesson: never import a value table from a `"use client"` file into a
   Server Component; it fails silently, not loudly.**
2. **Attribution did not follow the basemap.** The satellite style is Barikoi's but its
   imagery is Stadia/Airbus/CNES/PlanetObserver, so crediting only Barikoi + OSM over
   satellite was factually wrong. `MAP_ATTRIBUTION` is now per-style.
3. **The nearby layer cached its own failures.** One dropped request wrote `[]` into the
   per-anchor cache, so the layer stayed empty for the rest of the session and the strip
   claimed "No other published sites within 6 km" — asserting a fact it had not established.
   Failures are no longer cached, and the strip distinguishes loading / failed / genuinely
   empty. This also explained an intermittent smoke failure that was really a cold
   dev-server compile hiding behind misleading copy.

Verified with a throwaway Playwright pass over a 4-site profile (`fakir-apparels`) and a
single-site profile: pin/legend/popup agreement, no fullscreen control anywhere, scale bar,
distance + landmark chips, keyboard cycling and permalink round-trip, satellite attribution
swap, nearby layer (12 sites, spiderfied), GeoJSON payload fields, deep-link cold load, and
mobile 400px layout. `pnpm test` 143/143, `pnpm typecheck` + `pnpm lint` pass (same
pre-existing warnings outside this work). Zero new Rupantor/live Barikoi geocode calls.

28 Jul 2026 - REZ-29: Supplier profile Locations map UX overhauled. `components/supplier/locations-map.tsx`
rewritten: satellite ↔ street style toggle (`barikoi_satellite` / `osm_barikoi_v1`), campus default
zoom 16, per-style maxZoom (19 / 20), one overview map for multi-site suppliers (fitBounds +
click-to-focus flyTo with "All sites" back button), fullscreen mode (Esc or ✕ exit, map.resize on
toggle — **superseded by REZ-30, which removed fullscreen**), copy lat/lng to clipboard + Open in
Google Maps link in per-pin popup (**the Google Maps link was since removed**). New
`components/supplier/locations-section.tsx` client wrapper holds shared `selectedIndex` state
binding map ↔ address list (address row click → map flyTo; map pin click → row highlight). Marker
index mapping pre-computed from `geocodeLocations` return order and stored as `markerIndex: number |
null` on each `SerializableLocation`. `profile-overview-tab.tsx` updated to use `LocationsSection`
(inline `AddressRow` and `GROUP_ICON` removed; `ProfileAddressesCard` updated similarly). Zero new
Barikoi geocode/Rupantor calls. `pnpm typecheck` + `pnpm lint` pass (same pre-existing warnings
outside this work).

## Recent Address Canonicalization
28 Jul 2026 - REZ-28: Shared BD place lexicon implemented. `lib/bd-place-lexicon.ts`
(`applyPlaceLexicon`) + `etl/lib/bd_place_lexicon.py` (`apply_place_lexicon`) carry
the founder-confirmed 50+ pair lexicon (A1–A2 new pairs, B1–B7 UI transliterations,
C1 district corrections, C2 locality/EPZ aliases; D negatives enforced by omission:
Sreepur≠Sripur, bare Nawabganj≠Chapainawabganj). Wired into: (1) `normaliseAddressKey`
in `dedup-addresses.ts` — replaces the old inline `TRANSLITERATION_PAIRS` so variant
spellings now merge into one `UniqueLocation` on the profile Locations card;
(2) `normalizeAddressKey` in `barikoi.ts` — geocode cache lookups canonicalize before
querying `address_geocodes`, so one cached row resolves both spellings without any new
Barikoi API calls; (3) `normalize_key` in `etl/jobs/barikoi_geocode.py` — future
geocode entries stored under the canonical key. `pnpm test` 108/108 pass; pytest
74/74 pass; `pnpm typecheck` + `pnpm lint` + `python -m py_compile` pass (same
pre-existing lint warnings outside this work). Raw source strings unchanged.

## Recent Map Update
27 Jul 2026 - REZ-27: Supplier profile Locations map switched to Barikoi
satellite imagery (`barikoi_satellite` style) at building-level zoom 18.
Companies with 2+ unique geocoded addresses now render a separate
`AddressMap` instance per address (each labeled with its address text)
instead of a single multi-pin fitBounds view. Single-address profiles keep
one map. No new dependencies; no Rupantor re-geocoding — all maps reuse
cached coordinates from `address_geocodes`. `pnpm typecheck` + `pnpm lint`
pass (same pre-existing warnings outside this work). Touch: only
`components/supplier/locations-map.tsx`.

## Recent Frontend Polish
23 Jul 2026 (homepage promotion) - The founder-approved /home-demo
composition is now the production homepage at `app/(marketing)/page.tsx`
(hero dashboard demo → MoatStats → EvidenceAnatomy → BuyerWorkflowBento →
RecordNetworkSection → IsometricDecisionPath → closing CTA), keeping the
old homepage's SEO metadata (title/description/keywords/canonical/OG/
twitter) and Organization JSON-LD. `/home-demo` is retired to a
`permanentRedirect("/")`. The scenic light footer (skyline artwork +
blended wordmark, formerly `demo-footer.tsx`) is now the shared
`components/marketing/footer.tsx` `MarketingFooter`, mounted globally by
the (marketing) layout — the deep-forest footer and the page-scoped
`:has()` footer-hiding hack are gone; `demo-footer.tsx` deleted.
Bugbot review fixes (pixel-neutral): (1) nav/footer `/#sources` and
`/#how-we-verify` links now resolve — anchor wrappers with `scroll-mt-24`
around EvidenceAnatomy (`#sources`) and RecordNetworkSection
(`#how-we-verify`); (2) EvidenceAnatomyStage auto-advance now PAUSES while
a tab holds visible keyboard focus (`:focus-visible` tracked on the
tablist, progress bar `animationPlayState: paused`) so the roving tabindex
can never desync (WCAG 2.2.2) — pointer users keep uninterrupted
rotation. Known-and-accepted: the Registries demo panel still pads to six
rows with peer registries/plausible IDs — the stage never names the
supplier (anonymous illustrative composite, IDs part-blurred), founder
approved the rendering; flagged for future legal review alongside the
brand-strip wording. Typecheck + lint pass; dev smoke: `/` 200 with both
anchors + scenic footer + JSON-LD, `/pricing` renders the global scenic
footer, `/home-demo` redirects to `/`.
DEPLOYED 23 Jul 2026: merged to main (PR #16, c8c1812; main branch was
restored at 22f5093 after being deleted on GitHub, then result-card.tsx
merge conflicts resolved keeping the development side — it subsumed
main's #14 mobile-spacing fix) and deployed to VPS 109.104.153.228 via
`ops/deploy_vps.sh --ref=main --require-git` in tmux. Rollback ref
8b0af65 in `.deploy/previous-sha`. Production smoke green:
sourcebd.net `/` + `/api/health` + `/discover` + product icon +
skyline art 200, `/pricing` global footer, `/home-demo` redirect doc.
The deploy script's "public health check failed" warning was transient
(Caddy active, public health 200 immediately after).

23 Jul 2026 (hero dashboard demo) - /home-demo hero product window is now
an animated `HeroDashboardDemo`
(`components/marketing/home/hero-dashboard-demo.tsx`, mounted by
`HomeHero`): the approved static buyer dashboard plus one looping ~22.6s
"Find matches" workflow — cursor opens Find matches, completes the REAL
Smart Match wizard (Step 1 types "knit shirts" + Factory, Step 2 OEKO-TEX
+ BGMEA, Step 3 review pills → Find matches → "Matching…"), the real
405-matches results render as hero-scaled `DiscoverResultCard` replicas
with real "Matched on" pill grammar (production top result Apparel
Promoters Ltd, 405/24 counts, Load-more affordance), the buyer follows the
top card via the SaveButton bell, and the dashboard returns with the
Saved-suppliers tile/badge odometering 10→11 before a seamless loop
(counts persist across the seam; invisible resets mid-story). Founder
correction honored: the match surface is a faithful replica of
/app/match + PageHeader + StepBar + proto-card steps — no invented search
rail/profile panel. Animation language is byte-compatible with
`BuyerWorkflowBento` (event-mark clock, ~55 renders/loop, same cursor
SVG/easing, flip-on-release, reduced-motion = settled static dashboard).
Mobile (<md) is the true product shell: bottom tab bar, stacked wizard,
native smooth pane auto-scroll that reveals each upcoming control above
the tab bar. Typecheck + lint pass; Playwright-verified across the loop at
1440px and 400px (wizard steps, results, follow, 11/11 return, loop seam).
(`components/marketing/home/demo-footer.tsx`) modeled on a founder
reference: light link registers, neutrality disclaimer (legal copy
unchanged), then a full-bleed flat-vector Bangladesh RMG industrial
skyline (`public/marketing/footer-rmg-skyline.png`, AI-generated,
strictly forest-green shades) with an oversized "SourceBD" watermark in
the sky. Band background #F4F7F5 is sampled from the artwork's flat sky
so band and art read as one surface; the watermark uses
`mix-blend-mode: darken` so skyline layers occlude the letterforms like
the reference. Shared `MarketingFooter` is hidden on this route only via
a page-scoped `#main-content:has(main[data-demo-footer]) + footer` rule;
production `/` and all other marketing pages keep the deep-forest
footer. Typecheck + lint pass; Playwright-verified desktop 1440px +
mobile 400px.

23 Jul 2026 (buyer workflow choreography pass) - Founder's fourth review
(9.3/10; "stop adding features, refine choreography only") addressed in
`buyer-workflow-bento.tsx`, timing/easing only: pre-wake — the next
chapter's card un-dims 200–250ms before its chapter starts (conversation
card brightens while the plane is in flight) so the eye never hunts;
longer ease-in-out on state changes (card dim 500ms, shortlist +
compliance row highlights 500ms, RFQ field fills 300ms, MSA ladder
cross-fades 300ms); shortlist outro extended — row highlight releases
~350ms into the RFQ chapter instead of cutting; supplier reply gains a
Delivered → Seen receipt ladder; loop reset now STAGGERED per card via
per-card `on()` closures (shortlist resets at 11.05s during the MSA
download click, then RFQ 11.25s, conversation 11.4s, rest 11.5s) so no
single detectable restart frame exists. Follow-up in the same session:
active windows now OVERLAP instead of cutting at chapter boundaries — a
card stays active until its task visibly settles (shortlist through its
highlight release, RFQ through the whole plane flight, conversation while
the buyer is still typing, compliance until the shield check settles), so
focus never leaves a card mid-animation. Handoff redesign in the same
session: the paper-plane flight is REMOVED entirely (any second traveler
read as a duplicate/morphing pointer) — the shared cursor never hides or
changes shape and its 700ms glide card 2 → 3 is the only cross-card
motion (`planeLaunch`/`planeArrive` marks renamed
`handoffStart`/`handoffEnd`). PaperPlaneTilt remains only as static
icons. MSA card also got a spacing pass (wider column gap/padding,
looser checklist rhythm) + sequenced status crossfades (incoming label
delays 100ms) after a cramped-text review. Grid-level premium spacing
pass (founder-adjusted): UNIFORM proportional gutters (mobile gap-6, md
gap-5, xl gap-6 — founder rejected asymmetric x/y gaps); card padding
xl:p-6; card header→demo offset mt-5; card shadow lightened from
0_18px_40px_-34px/0.22 to 0_8px_20px_-16px/0.10 (heavy ambient shadow
read as over-elevated on the active card). Compliance chapter payoff
added: cursor now CLICKS the GOTS alert row (compClick 8.25s) and a
certificate-alert detail popover opens under the row (compRelease 8.4s →
compPopClose 9.15s) — mono kicker, cert/supplier, expiry + renewal
reminder lines, "View certificate" hint; new marks slot between existing
ones so no other timing shifted; hidden in reduced motion (transient).
Sequencing pass (founder pass 5, SUPERSEDES chapter-overlap timing):
loop retimed 12s → 22s, chapters strictly sequential — each card's last
animation settles, ~1s dwell, then the cursor departs; only remaining
overlaps are pre-wake un-dim + cursor glides. Send button label now
flips to "Sending…" on press RELEASE (sendRelease), never at press-down.
Active windows = chapter start → cursor departure. All intra-chapter
beat deltas preserved. Typecheck + lint pass.

23 Jul 2026 (buyer workflow motion-quality pass) - Founder's third review
(video frame-by-frame) addressed in `buyer-workflow-bento.tsx`, timing and
choreography only (no visual redesign): chapters now overlap 150–250ms so
each action reads as causing the next (cursor leaves while the shortlist
toast settles; plane launches while the success copy settles; compliance
starts while the buyer is still drafting; MSA spins up while the shield
check settles); Send RFQ → success is a strict causal chain (click →
button "Sending…" → 300ms beat → panel wakes → success); compliance row
gets a temporary gray+border emphasis at the update moment then relaxes;
MSA runs Queued → Generating → Preparing → Ready → Download-enabled as
separate beats; completed cards keep near-invisible ambient life (new
`AmbientPulse` on toast/sent/ready checks, draft caret keeps blinking);
bookmark click gains a one-shot neutral confirmation ripple. Typecheck +
lint pass.

23 Jul 2026 (buyer workflow bento review pass) - Founder frame-by-frame
notes addressed in `buyer-workflow-bento.tsx`: continuous shared cursor
now travels bookmark → RFQ → Send → conversation → compliance → MSA
(only yields during the paper-plane handoff); non-active cards dim;
active card gets a neutral left hairline; RFQ right panel is a dormant
"Recipients / Waiting for Send RFQ" state until Send fires, then
Sending… → success; shortlist teaching beat stronger (row hierarchy +
toast pill); conversation keeps Seen + draft typing into the second
half; compliance active row has clearer neutral hierarchy; MSA writes
lines + progressive feature checks + scan while generating. Second-half
pacing tightened. Typecheck pass.

23 Jul 2026 (buyer workflow bento) - /home-demo section 4 replaced:
`CapabilityFeatureGrid` swapped out for a new `BuyerWorkflowBento`
(`components/marketing/home/buyer-workflow-bento.tsx`) built from the
founder's enterprise motion spec + mockup. Five cards (follow suppliers /
compose RFQ heroes + conversation / compliance / MSA supporting row) tell
one continuous 12s event-driven sourcing story: cursor follows a supplier
(bookmark fill, 23→24 odometer, ripple), RFQ fields paste-fill and Send
runs Send→Sending→Sent, a tiny forest paper plane (the ONLY cross-card
element, DOM-measured flight so it works on mobile stacks) hands off to
the conversation card (unread badge, reply, typing dots, Quotation.pdf),
compliance updates one certificate row (32→30 days, green dot, shield
check), MSA flips Queued→Generating→Ready, then everything soft-resets
inside the loop with no jump. Ambient motion: 120s confidence-ring drift,
3s status-dot opacity pulse, 4s online-dot breathing. Master clock emits
~30 discrete event marks per loop (no per-frame React renders); all
transitions are transform/opacity/color only. Green is semantic-only
(bookmark, checks, plane, dots, sending state); mockup's fabricated stats
strip intentionally NOT reproduced. Reduced motion renders the settled
end state (SSR-safe via mount gate). Old `capability-feature-grid.tsx` +
buyer-workflow-live-* files kept on disk but no longer routed. Typecheck +
lint pass; Playwright-verified at six story beats, mobile 400px, and
reduced-motion. NOTE: pre-existing hydration mismatch under reduced motion
traced to HeroBackdrop hero-wash animation style + NumberTicker (hero),
not this section.

23 Jul 2026 (founder edit pass 3) - Engine card's database orbit emblem
(generic ringed circle, dead white space) replaced with a compact
"Canonical record" footer row in the same idiom as the processing rows:
brand-forest db icon tile, "Assembling evidence…" while steps run, then
"Verified profile committed" + spring check the moment all five pipeline
steps complete — the footer is now the pipeline's landing state, not an
ornament. Card is shorter; typecheck/lint pass; Playwright-verified in
both states.

23 Jul 2026 (founder edit pass 2) - `IntelligenceEngineStage` refinements:
all greens moved to brand tokens (#1f4d3a / #2d6a4f, no generic #16a34a);
comets are now ONE tiny solid ball per trace (zero-length round dash
traveling the path, 6.5s, staggered) — gray on the ingest side, brand
green on the insight side, with card ports matching the tone; engine
card compacted (300px, tighter paddings, 68px db emblem with a
brand-forest core instead of near-black); processing rows run a
meaningful sequential pipeline (one Live row filling its bar per 2s
step, done rows keep a full bar + check, later rows show "Queued",
cycle resets after all five); column-label corner marks moved inline
into the label flex row so left/right always align; shadows reduced to
the shadow-l1 token + whisper hub glow; radii normalized to the
5/6/8/12/22 token family (rounded-card cards, rounded-hero engine,
rounded-pill tiles/rows, --r-md inner frame + metrics bar). Typecheck
+ lint pass; Playwright-verified at two animation phases.

23 Jul 2026 (later) - `IntelligenceEngineStage` rebuilt 1:1 against the
founder's second reference mockup. Beams are now thin solid light-gray
PCB traces with staggered rounded elbows (outer cards bend later →
nested cascade into each hub) and continuously traveling green packet
dashes (4 evenly spaced per trace via normalized `pathLength`; static
dashes under reduced motion) — replacing the dotted-track AnimatedBeam
comets. Cards gained green edge "ports" the beams anchor to; hubs are a
dark core in a green ring with a soft breathing glow; the engine card
is a double frame with corner ticks, "Source**BD**" two-tone wordmark,
five processing rows (icon tile + segmented green progress bar +
breathing tail + "Live" chip), and a dark database emblem with green
ring + expanding ripples. New chrome per the mockup: top-center "Live
reconciliation" pill, mono uppercase column labels, dotted-grid
patches + corner squares, a 4-metric stats bar (28+/18.7M+/1.1M+/96% —
same real audited values; mockup's illustrative counts NOT copied),
and the "Trusted records. Unified intelligence." caption. Right output
cards gained tiny illustrative mini-graphics (map/bars/dots/doc/check).
`roundedElbowPath` exported from `components/ui/animated-beam.tsx`
(component itself untouched, still used elsewhere). Typecheck + lint
pass; verified via Playwright screenshots desktop 1440px + mobile 400px.

23 Jul 2026 - Founder audit fix pass on the `IntelligenceEngineStage` from
earlier the same day, against a reference mockup screenshot. Fixes: (1)
left source cards now render real on-file provider logos via the existing
`sourceLogo()` helper (BGMEA ×2 "Registry"/"Members", EPB, RSC; NBR and
Certificates keep a neutral glyph fallback — no logo on file) instead of
generic gray icons, matching the `data-pipeline.tsx`/`trust-orbit.tsx`
convention already used elsewhere on this page; (2) every card→hub beam on
a side now shares one fixed elbow fraction (`ELBOW_TO_HUB` / mirrored
`ELBOW_FROM_HUB`) instead of a per-card spread, which was the root cause of
the tangled/overlapping curves near the collector and distributor nodes —
beams now form a clean single bus/spine into each hub; (3) `AnimatedBeam`
gained an opt-in `dashed` prop (dotted PCB-trace track with a slow marching
offset) used here so the base track reads as "carrying data" even without
motion; (4) hub nodes are now a visible dark dot inside one soft
forest-green fill + ring halo (was three near-invisible neutral rings);
(5) engine processing rows now show a title + subtitle per row inside a
light-green icon tile (was a single line, neutral icon); (6) the database
glyph is a forest-green ring badge on white (was a solid black fill); (7)
the metrics bar is wrapped in a bordered card with forest-green-tinted icon
badges (was a bare top border with neutral icons), and the "real-time"
caption gained small dot flourishes on both sides. Metric values stay the
real 28+/18.7M+/4.2M+/1.1M+/96% set from the original spec. `pnpm
typecheck` and `pnpm lint` pass (same pre-existing warnings); re-verified
visually via Playwright screenshots (desktop 1440px, mobile 400px, plus
zoomed hub and engine-card crops).

23 Jul 2026 - /home-demo section 5 ("How the record is built") animation
replaced with a new `IntelligenceEngineStage`
(`components/marketing/home/intelligence-engine-stage.tsx`): a calm,
industrial three-column diagram (six trusted-source cards → collector node →
SourceBD engine card with five live processing rows + database orbit →
distributor node → six verified-output cards), continuous PCB-trace beams
(gray lines, forest-green comets only), a 5-stat metrics bar with one-time
count-up + a small confidence ring, and a dedicated mobile stacked layout.
Scope is the animation only — the section's heading, three-step "how it
behaves" card, and authority-order strip are untouched. Extended the shared
`components/ui/animated-beam.tsx` primitive with `axis` (vertical elbow
routing) and `cornerRadius` (rounded PCB-style corners) props, both opt-in
and backward compatible with existing usages. Removed the now-unused
`record-network-stage.tsx` and its live-Discover-row plumbing in
`record-network-section.tsx` (the new diagram is illustrative, not tied to
one live supplier). Demo page only; production `/` untouched. `pnpm
typecheck` and `pnpm lint` pass (same pre-existing warnings); local
`/home-demo` smoke 200, verified visually via Playwright screenshots at
desktop (1440px) and mobile (400px) widths.

20 Jul 2026 - /home-demo mobile responsive polish completed in the working
tree. Scope is the demo homepage only: phone-first hero/product preview,
section density and wrapping, 44px touch targets, main/demo semantics,
reduced-motion behavior, and off-screen animation pausing. Production `/`,
data contracts, routes, and dependencies remain unchanged. `pnpm typecheck`
and `pnpm lint` pass (same pre-existing warnings). Runtime viewport smoke was
blocked on this Windows machine: both webpack and Turbopack exhausted the
available 8 GB memory while cold-compiling `/home-demo`; trace reported about
10 MB free, so the compile was stopped rather than left thrashing.

19 Jul 2026 - /home-demo polish pass (ad-hoc, working tree). Demo page
only; production `/` untouched. Section order now: hero → MoatStats →
EvidenceAnatomy → CapabilityFeatureGrid → WorkflowAgentsMarquee →
IsometricDecisionPath → VerifiedRecordSteps → closing forest CTA.
Removed ExploreIndexTeaser from the page. Evidence stage restyled from
deep-forest wash to a quiet stone surface (no under-stage glow); section
band `bg-neutral-50`; auto-advance no longer pauses on hover. Buyer
workflow animation: shared `FrameHairlines` inset/inherited-radius so
card corner hairlines do not clip; checklist milestone shadow softened
and top inset to keep the active-row hairline; Due badge removed from
Quality inspection. Local `/home-demo` smoke 200 after warm compile
(cold compile on Windows can take ~60–90s; watch for Next memory
restarts).

15 Jul 2026 - /home-demo audit remediation (38-item founder-selected list)
implemented in the working tree. Scope is the demo homepage only
(production `/` untouched). Structural: sections reordered to hero →
moat stats → evidence anatomy → positioning → live checks → new RSC
safety band → new brand-disclosure strip → decision path → new
explore-the-index teaser → new closing CTA; one shared `Kicker`
(`components/marketing/home/kicker.tsx`), one container (max-w-[1200px]),
two padding steps, hairline border-b separators. Data: MoatStats now
renders certifications_verified, sanctions_lists_screened and a
last_refreshed_at stamp; "corroborated" label corrected to "backed by a
government or association register"; live ≥2-source count in evidence
rail; new sections pull live counts via `discover_suppliers`
(`components/marketing/home/discover-count.ts`) with counts matched
1:1 to their /discover deep-link args. Brand-disclosure strip wording
("disclosed on {brand}'s published factory list", text-only, no brand
logos) is PENDING legal sign-off per frontend-design-spec.md §20 Q4.
A11y/fixes: evidence stage converted to tablist/tab/tabpanel with
arrow-key nav and fluid width (1024-1200px collapse fixed), marquee
grid holes removed (15 cards/15 slots), sub-12px text raised,
neutral-400 contrast failures lifted to neutral-500+. `pnpm typecheck`
and `pnpm lint` pass (same pre-existing warnings); /home-demo smoke
200 on local dev with all new sections rendering live numbers.

30 Jun 2026 - Principal product chip dedup and compound-label split deployed to VPS
`109.104.153.228`. Frontend-only (DB unchanged) in `lib/product-icons.ts`:
spelling correction for common BGMEA harvest typos, singular/plural merge
(Shirt/Shirts, Legging/Leggings, etc.), near-duplicate collapse and generic
suppression (e.g. generic Shirt hidden when Knit Shirt present), and compound
label split on `/`, `&`, `+` so `Sweater/Jacket` and `T-Shirt/Polo Shirt`
render as separate chips with distinct Noun Project icons. Supplemental trim/
packaging icons added (Poly Bag, Leggings, Lace, Hanger, Elastic, Athletic
Wear, Home Textile, Carton, Pajama, Back Board, Neck Board, Printed Label,
Tissue Paper, Hang Tag, Barcode; T-Shirt icon 4464232). Quick-deployed;
health OK.

29 Jun 2026 - Principal product icons integrated and deployed to VPS
`109.104.153.228`. Scope: local Noun Project "Principal products" apparel set
under `public/icons/products/` (plus supplemental packaging/trim/material icons
from Noun Project), `lib/product-icons.ts` slug resolver with RMG-aware label
normalisation, `components/supplier/product-icon.tsx` `<img>` rendering in
original icon colour, and principal-products strip typography aligned to
Overview tab body font in `app/globals.css`. Ops helpers:
`ops/download_product_icons.py`, `ops/audit_product_icons_offline.py`. Deleted
legacy `public/ApparelIcons/`. Quick-deployed to production; health OK.

25 Jun 2026 - Frontend design stabilization pass complete in working tree.
Presentation-only changes: solid nav chrome, iPhone-safe bottom navigation,
full-width hairline Discover cards, and cleanup of touched prototype
card/typography drift across marketing and app surfaces. `pnpm typecheck`
and `pnpm lint` pass; `pnpm build` compiled successfully but failed during
Windows standalone symlink copy with `EPERM`.

## Recent Maintenance
25 Jun 2026 - Context-token optimization complete. Daily agent boot now uses
`AGENTS.md`, `context/agent-brief.md`, `context/current-state.md`, and
`context/feature-specs/active.md`; the old append-only tracker is archived.

## Current Working Tree Warning
At the start of the token-optimization task, the repo already had a large uncommitted frontend/design diff plus deleted old Magic UI component files. Treat those as pre-existing user/session work unless explicitly told otherwise. Do not revert them while doing context cleanup.

## Daily Development Rules
- For micro edits, do not read the full historical tracker or all feature specs.
- Load only the core boot files plus the active spec and task-relevant source documents.
- Before asserting whether a file is modified, check `git status` or `git diff` against HEAD.
- For debugging, state the hypothesis and minimal change before editing when `context/current-issues.md` is involved.

## Historical Record
The old full tracker was archived at `context/archive/progress-tracker-archive-2026-06-25.md`. Use that archive for old shipped-spec details, architectural decisions, and production smoke history.
