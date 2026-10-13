# Manufacturers shown as buying houses: the count, the cause, the plan

Found 13 Oct 2026 by the duplicate audit (`ops/plans/duplicate-suppliers-audit.md`, PR #511, the
whole-table duplicate audit). Nothing in this file has been applied to production.

Measured by `ops/report_bgmea_entity_type.py` (read-only). The rows are in
`ops/plans/bgmea-entity-type.json`; the fix is `ops/plans/bgmea-entity-type-fix.sql`.

## 1. What was measured (production, 13 Oct 2026, 08:45 UTC)

BGMEA keeps two registers. General members make garments (entry `general:N`). Associate members are
buying houses (a bare number). A real buying house is a row that holds the associate entry.

```
suppliers 10811 (10025 published)
type          BGMEA entries         rows  published
buying_house  associate only        1427       1427
buying_house  both                    27         27
buying_house  general only           519        503
buying_house  no BGMEA entry           8          8
factory       associate only          77         77
factory       both                    44         44
factory       general only          3666       3633
factory       no BGMEA entry        5043       4306
fix: 519 shown as buying house on a manufacturer's entry alone (503 published, 511 with sewing machines on file, 16 a building of another company)
ask: 0 more where a person locked the type or the company is claimed
stays: 1454 buying houses holding an associate entry
buying house with no register behind it: 8 (listed, not touched)
```

**519 rows, 503 of them published**, are shown to buyers as a buying house while the only BGMEA entry
they hold is a manufacturer's. The audit said 541; that was before the day's duplicate merges took 22
of them into other rows. The same eight cells came back from a direct count in the database.

What the 519 have in common:

- every one was created on 3 Aug 2026 and holds BGMEA entries only;
- 511 have sewing machines on file, 16 are a building of another company;
- none holds an associate entry, live or retired, and none has an associate number on its row;
- none has a person's lock on its type (the 11 live locks all sit on rows holding an associate entry),
  and none is claimed.

Not in this plan, seen while counting:

- 8 buying houses with no BGMEA entry. All 8 hold GOTS entries (the loader reads a GOTS trader as a
  buying house). Left alone; they are listed in the JSON.
- 77 rows shown as a factory that hold an associate entry and no general one. Each also holds another
  register (BKMEA, RSC, EPB or a certificate), so they are not this defect. Whether a factory that also
  holds an associate membership should read as a buying house is a separate question for the founder.

## 2. The cause

Two steps, both in our own code.

1. On 3 Aug 2026 the BGMEA conflation repair (`ops/repair_bgmea_conflations.py`) split member companies
   out of rows that held several. It created the new rows with a name and nothing else, so their type
   was the table's default, `unknown`.
2. The loader upgrades an `unknown` row when a trade body's record attaches. For BGMEA it wrote
   `buying_house` whichever register the record came from (`etl/core/upsert.py`,
   `_apply_source_specific`). The next BGMEA read turned all of them into buying houses.

The same wrong default sat in `_ENTITY_DEFAULT` for a brand-new row. The manufacturer scraper names its
own type, so that path did no harm, but it was one missing argument away from it.

## 3. The loader fix (this PR)

The register decides, in both places: a general member is a `factory`, an associate member is a
`buying_house`, and a BGMEA record that names no register leaves the type `unknown` rather than guess.
A type a person locked, and a type already set, are still never overwritten.
Test: `etl/tests/test_bgmea_entity_type.py` (the inserted row, the upgrade of an `unknown` row, and the
report's rule that any sign of the associate register keeps a buying house).

The fix stops new damage. It does not repair the 519: they are no longer `unknown`, so the loader will
not touch them. That is section 4.

## 4. The repair, waiting for the founder

`ops/plans/bgmea-entity-type-fix.sql`, one transaction:

1. Copies the 519 rows as they are to `public._snapshot_entity_type_20261013` (RLS on, nothing granted
   to anon or authenticated).
2. Sets their type to `factory`.
3. Refuses, writing nothing, unless exactly 519 rows still qualify at that moment and the number of
   buying houses holding an associate entry is the same before and after.

A row is taken only if it is in the list **and** still qualifies when the block runs: still a buying
house, a live general entry, no associate entry (live or retired), no associate number on the row, no
lock on the type, not claimed. So a row that changes between now and the apply makes the block refuse
rather than guess.

Rehearsed on production 13 Oct 2026 (the block ends in a raise, so nothing was kept):

```
DRY RUN OK | snapshot 519 | set to factory 519 | buying houses 1981 -> 1462 |
holding an associate entry 1454 -> 1454 | published among them 503 | factories now 9349
```

Read after the rehearsal: no snapshot table, 1,981 buying houses, 8,830 factories, as before.

The rehearsal computed the 519 ids in the database by the same rule and checked them against the file's
list (md5 of the sorted ids, `82c0350bd88f4458907943c2b7e5eba0`), because the SQL endpoint used here
takes the block as typed text. The file itself, with its literal list, has not been run.

What a buyer sees change: 503 published profiles read "Factory" instead of "Buying house", and they move
from the buying-house filter in search to the factory one. Nothing else on the rows changes. No activity
record is written (that trigger only records edits made by a signed-in person).

**To apply** (the founder's go-ahead, AGENTS rule 15): run the file with the line marked `REHEARSAL`
deleted. If the count is no longer 519, re-run the report with `--sql` first and rehearse again.

**Undo:**

```sql
update public.suppliers s set entity_type = t.entity_type
  from public._snapshot_entity_type_20261013 t where t.id = s.id;
```

## 5. Re-running the report

```
python ops/report_bgmea_entity_type.py --sql ops/plans/bgmea-entity-type-fix.sql
```

Needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (GET requests only). On 13 Oct 2026 it was run
with `--cache` on rows pulled through the Supabase SQL endpoint instead: the same three reads
(suppliers, BGMEA entries, live locks on the type), judged by the script.
