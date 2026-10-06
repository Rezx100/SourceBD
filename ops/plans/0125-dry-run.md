# 0125 sources we do not read, and brand schedules: dry run (6 Oct 2026)

Migration: `supabase/migrations/0125_sources_listed_brand_schedules.sql`
sha256 (LF, as committed): `e9b58eb15f0804bc296bd49ab9a26e85bf9fd73e152422296baed44f89b60b2f`
Spec: `context/feature-specs/spec-etl-freshness.md`, slice S6 (founder decision 4).

## How it was run

Production `stnrfxrxfonwexzcvvpv`, Supabase MCP `execute_sql`, in one `DO` block ending in `raise exception`. A read afterwards found no `listed` column, the public count still at 25, and 10 schedules.

`marketing_facts` on production matched 0117 before the change (applied 6 Oct as `20261006010010`).

## Result

```
DRY RUN OK (rolled back) | sources_listed 25 -> 21 | with_records 14 -> 14 |
hidden=RJSC,DIFE,BEPZA,BRAND_INDITEX | brand schedules=4
```

## What changes for buyers and visitors when it is applied

- **The public site says 21 sources listed, not 25** (home, Data & methodology, footer).
  - BEPZA, DIFE and RJSC drop out until a scraper reads them.
  - Inditex is retired: it publishes no supplier list.
  - Rows are kept, with a note. Flipping `sources.listed` back is how one returns.
- **The same PR's code** also drops them from the methodology page's list and the home page's Tier 1 line. The legal Data Sources page now names EPB and RSC as Tier 1, not RJSC filings.
- **Brand lists (H&M, Next, ASOS, M&S) get a monthly schedule, all off,** with a 120-day age limit.
  - The spec says quarterly; schedules allow at most 30 days, and a monthly read is about 2 credits a brand.
  - Their reads no longer count as changed every time: today's date and the mirror path are out of the fingerprint.
  - Primark is paused: no schedule.

## To apply (founder)

Say "apply 0125" **before the deploy that carries S6**: deployed first, the site would say "25 sources listed" beside a list of 21 until it is applied. It is applied through the Supabase MCP `apply_migration`, gated on the sha256 above.

## Rollback

The REVERSE block is in the migration header. Re-run 0117 for `marketing_facts`.
