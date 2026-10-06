# 0120 sanctions daily reconcile: dry run (6 Oct 2026)

Migration: `supabase/migrations/0120_sanctions_daily_reconcile.sql`
sha256 (LF, as committed): `ad8388ae532a38ef1f35b74a46d185448fe69ce61572d97817968ddb2b307e6c`
Spec: `context/feature-specs/spec-etl-freshness.md`, slice S1.

## How it was run

- Production `stnrfxrxfonwexzcvvpv`, through the Supabase MCP `execute_sql`.
- The migration's statements were run inside one `DO` block that ends in `raise exception`. The whole block therefore rolled back by construction.
- A read afterwards confirmed nothing stayed: the `listing_status` column was absent (0), there was no `ofac_sdn` schedule (0), and there was no `sanctions_lists_read` function (0).

## Result

```
DRY RUN OK (rolled back) | schedules=5 | trigger_has_queue=t | cols=4 |
lists: eu_sanctions listed=1589 read=2026-06-26; ilab_tvpra listed=457 read=2026-06-26;
       ofac_sdn listed=9799 read=2026-06-27; uflpa listed=160 read=2026-05-14;
       uk_ofsi listed=1286 read=2026-06-26; us_wro listed=75 read=2026-07-30
```

- 4 new columns and 5 disabled schedules. There is no schedule for `cbp_wro`: CBP now publishes only a Tableau dashboard.
- The trigger now opens a review row on every hit.
- `sanctions_lists_read()` returns the six lists with today's (stale) dates. Until a new run, the buyer cell shows "lists last read 14 May 2026 · not re-read since", because UFLPA is the oldest list.

## What changes for buyers when it is applied

- Nothing until the code is deployed.
- After deploy, the Sanctions cell on a record keeps "Not listed" and adds the read date, in the caution tone while the date is older than 48 hours. No supplier is flagged or cleared by the migration.

## To apply (founder)

Say "apply 0120". It is applied through the Supabase MCP `apply_migration`, gated on the sha256 above.

## After applying

1. Enable the five schedules in `/admin/sources`, one at a time.
2. Read each first run's `meta.reconcile`:
   - UFLPA's first run is expected to be `partial`, because the list grew from 160 to 205 entries and some references may have changed.
   - If so, release it after reading the numbers with:
     ```
     docker compose run --rm etl run uflpa --accept-delistings
     ```
3. Check that the record cell shows a date within the last 48 hours.

## Rollback

The REVERSE block is in the migration header. It is additive only; the earlier `propagate_sanctions` body is quoted there.
