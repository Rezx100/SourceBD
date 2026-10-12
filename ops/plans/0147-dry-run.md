# 0147 dry run (13 Oct 2026, production, rolled back)

Migration `supabase/migrations/0147_export_rank_and_cells.sql`: two new readers, nothing else. No table,
no column and no existing function changes. **Applied 13 Oct 2026** on the founder's "apply 0147". Read back straight after, as an admin, a Free
buyer and signed out (read only): `rank square: admin 88 free null signed-out null`; cells for Square
and Ducati: admin gets the value and `{EU,US,UK,CA}`, a Free buyer gets `has=t fob=null to=null`;
neither function can be called signed out.

- `supplier_export_rank(slug)`: the whole percent of exporters on record whose two-year export value is
  below this supplier's. It fills the line under the record's first export tile ("Bigger than 88% of
  exporters on record").
- `discover_export_cells(ids)`: for the suppliers on a results page, the export value and the markets
  shipped to, for a reader on Growth or Enterprise and for admins. Anyone else signed in learns only
  that a record exists, which the results draw as a lock (founder, 13 Oct 2026).

The screens do not wait for it. Until 0147 is applied the first tile is the value alone and every
results row says its customs cell was not read.

## What was run

Both functions were created inside `do $dry$ … execute $m$ <the two functions and their grants> $m$;
<checks>; raise exception …`, so everything rolled back by construction. The checks called them as three
readers by setting the request's user: signed out, the oldest admin account, and the oldest account that
is neither an admin nor on a paying plan.

```
DRY RUN OK | rank square: admin 88 free null signed-out null
 | suppliers with records 228 ranked 228 (min 0 max 99, at 99 or more: 2, at 0: 3)
 | cells for [square, ducati, ar-fashion]:
     admin 2 rows { ffb9d650 fob=76578613.86 to={EU,US,UK,CA} ; 174a5ab8 fob=19842263.93 to={EU,US,UK,CA} }
     free 2 rows { 174a5ab8 has=t fob=null to=null ; ffb9d650 has=t fob=null to=null }
     signed-out 0 rows
 | of first 200 with records, markets returned for 194
```

Afterwards `select count(*) from pg_proc where proname in ('supplier_export_rank',
'discover_export_cells')` answered 0: nothing was left behind.

## What it shows

- **The gate holds.** A Free account and a signed-out caller get no rank. A Free account gets a row
  for Square Apparels and Ducati Apparels that says only that a record exists: no value, no market.
  A.R. Fashion has no customs record and has no row for anyone.
- **Square Apparels ranks 88**, not the 89 on the board. The board rounded 88.6 up; the function rounds
  down, so the page never says a supplier is bigger than more exporters than it is.
- **All 228 suppliers with a customs record are ranked**, from 0 to 99. The three smallest are at 0, and
  the page draws no "bigger than" line for them.
- **Markets come back for 194 of the first 200**, biggest share of value first. The other six ship to
  one country and have no market split; their cell is the value alone.

## Asserted on every CI run

`supabase/ci/assert-0147.sql`: who gets a rank and who gets null; the rank is the floored share below
and never 100; no rank for a match nobody confirmed, an expired record, a record with no value or an
unpublished supplier; no rank among fewer than 20 exporters; a buyer the licence leaves out gets
`has_records` and neither figure; the markets are short codes ordered by value with an unshipped market
left out; more than 200 ids is refused; `anon` can call neither.

## To apply

On the founder's "apply 0147": `apply_migration` through the Supabase connection with the file as it is
on `main`, then confirm both functions exist and that `supplier_export_rank('square-apparels')` answers
88 for an admin. Rollback is the two `drop function` lines at the top of the migration.
