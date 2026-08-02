# Spec — ETL change-skip, BKMEA source_records split, bkmea_detail pre-fetch gate

Linear: REZ-36 (Spec A of the scraper collection-rules issue). Status: in progress.
Scope discipline: implement EXACTLY this file. No drive-by refactors. No schema
migration — data rekey only.

## Problem (audit-verified at development HEAD)

- `etl/core/upsert.py` `_upsert_source_record` writes `raw_hash` on every
  upsert; nothing in the repo ever reads it. Every yielded record is enriched
  and gets its evidence rewritten on every run, changed or not.
- `bkmea_detail` (`transport = "firecrawl"`) targets members with
  `email_primary IS NULL OR address_raw IS NULL` — a predicate that never
  clears because BKMEA pages rarely publish email — so effectively the whole
  ~590-member register is re-scraped every run (~590 credits/run).
- **Shared-row defect:** `bkmea_web` and `bkmea_detail` both write
  `source_code="BKMEA"` with the SAME `source_ref`, sharing one
  `source_records` row whose `raw_hash` flip-flops between list-hash and
  detail-hash on alternating runs. Hash-skip is impossible until split.
- **Unstable ref defect:** `bkmea_web` prefers `detail_id` over
  `membership_int` for `source_ref` despite its own comment. BKMEA re-lists
  members on new detail ids under the same membership number → new
  `source_records` rows → the REZ-34 Phase D re-listing treadmill.

## Design

### 1. Split the shared row

`bkmea_detail` writes its own `source_records` row per member with a
ref-namespaced `source_ref`: `{detail_id}:detail`. No new source code (that
would ripple into the SQL allow-list and tier map). The detail row's `fields`
carries `enriched_from_list_hash` — the list row's `raw_hash` at enrichment
time — which is what the pre-fetch gate compares against.

**Linkage:** today the shared ref is what makes the upsert's Pass-0 source_ref
match resolve a detail record to the existing supplier. After the split the
detail record carries the list row's ref as an **alias**
(`ScrapedRecord.alias_refs`); Pass 0 matches `source_ref = any(refs)` with the
record's own ref preferred. Pinned by a test: running bkmea_detail after the
split creates zero new suppliers.

### 2. Stabilize the list ref

`bkmea_web` prefers `membership_int` over `detail_id`.
`ops/rekey_bkmea_source_refs.py` (dry-run by default, like
`ops/unmerge_bkmea_suppliers.py`) rekeys existing BKMEA list rows to the
membership integer:

- Groups each supplier's BKMEA list rows by parsed membership int; the row
  with the latest `fetched_at` wins the rekey.
- Same-supplier duplicates (the re-listing treadmill rows) are merged into the
  winner: `evidence_claims` subjects and the four FK tables
  (`certifications`, `rsc_remediation`, `sanctions_screening`,
  `partner_factories`) are re-pointed, then the loser row is deleted. Leaving
  them would keep every stale detail page targeted forever — the treadmill
  would survive the fix.
- Refs spanning MORE THAN ONE supplier (the stranded CRONY FASHION duplicate)
  are reported, never merged across suppliers, and never crash the run.
- Rows with an unparseable membership number are reported and left alone.
- Rows whose ref already contains `:` (detail-namespace rows) are never
  touched.

### 3. Generic post-fetch change-skip (one code path, all scrapers benefit)

In `upsert_supplier_with_source`, before `_find_existing`:

- Look up existing `source_records` rows by `(source_id, source_ref)`.
- Rows on MORE THAN ONE supplier → fall through to the full upsert (ambiguous
  ref; Pass 0 resolves deterministically). Pinned by a test.
- Exactly one supplier and `raw_hash == rec.hash()` → skip the enrich AND the
  evidence rewrite, but still `update source_records set fetched_at = now()`
  (freshness monitoring must not false-age a record we did just verify), and
  count `records_skipped`.
- Otherwise → full upsert as today.

The function returns `str | None`: `None` signals the skip. `BaseScraper.run`
and the six custom `run()` overrides (`wrap`, `sa8000`, `oeko_tex`, `gots`,
`rsc`, `brand_disclosures`) count the skip and skip their per-record
downstream writes and evidence recording. Sanctions screening is not re-run
for an unchanged record: the supplier was screened in-transaction when the
record last changed (REZ-32), and new list entries screen existing suppliers
entry-side.

### 4. bkmea_detail pre-fetch gate

`_load_targets` predicate becomes:

- never-enriched (no `{detail_id}:detail` row), OR
- list-row `raw_hash != detail_row.fields->>'enriched_from_list_hash'`, OR
- unreviewed stale claim (that branch kept exactly).

The null-email/null-address predicate is DELETED.

The predicate is a pure Python function over a wider candidate select — mocked
cursors never parse SQL (the REZ-34 lesson), and the old SQL-resident
null-email predicate is exactly how the whole register got re-scraped every
run untested. Same lesson as `barikoi_geocode.select_pending`.

`--full-refresh` CLI flag on `python -m etl.cli run bkmea_detail` bypasses the
hash gate (default off — founder knob for a periodic full pass). Queue-dispatched
runs always use the gate.

### 5. Tests

Mocked-cursor / pure-function patterns, SQL kept simple:

- hash-skip idempotency: second run upserts 0, skips all, touches fetched_at.
- skip counting in `BaseScraper.run`.
- multi-supplier-ref fallthrough to the full upsert.
- zero-new-supplier linkage for bkmea_detail after the split.
- target-gate predicate: changed list hash → targeted; unchanged → not;
  stale claim → targeted; never-enriched → targeted.
- `--full-refresh` bypass.

### 6. Docs

`context/architecture.md` ETL section gains the change-skip rule (one
documented place).

## Acceptance (production, in order)

1. `ops/rekey_bkmea_source_refs.py` dry-run reviewed, then live.
2. Controlled `bkmea_web` run, then `bkmea_detail`.
3. `bkmea_detail` a SECOND time: targets ≈ 0, `records_skipped` ≈ 0 (nothing
   fetched), `credits_spent` ≈ 0.
4. Forced `--full-refresh` run skips ≈ 100% of upserts via hash-skip.
5. `/api/health` 200; `/admin/sources` shows the runs with the new skip
   counters.

Explicitly NOT this spec: migration 0089 and the REZ-32 backfill (session 2's
pending work); field-ownership map and overlap precedence (REZ-36 Spec B).
