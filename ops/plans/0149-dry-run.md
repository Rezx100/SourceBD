# 0149 dry run: old addresses of merged duplicates (13 Oct 2026, production, rolled back)

Migration `supabase/migrations/0149_supplier_slug_redirects.sql`. **Not applied.** It waits for the
founder's "apply 0149".

## The problem

On 13 Oct 2026, 166 duplicate supplier rows were merged into their twins and deleted
(`ops/plans/duplicate-suppliers-audit.md`). 152 of them were published. Their public addresses now
answer 404: `/suppliers/oishi-fashions` is gone, and the profile that was kept is
`/suppliers/oishi-fashion`. Google and buyers still hold the old addresses.

## The design

One small table and no new code path.

- **`supplier_slug_redirects`**: the old address, and the id of the supplier row it was merged into.
  It stores the id, not the kept address, so the redirect follows the kept profile if it is renamed.
- **The redirect that already exists.** The supplier pages already ask `facility_parent_slug` where to
  go before they answer 404; that is how `/suppliers/sayem-fashion` (a linked building) reaches
  `/suppliers/sayem-fashions`. The same function now also answers from the new table. No page, route
  or setting changes, so the public page, the signed-in record and the record beside search results
  all redirect, with the same permanent redirect (308) the buildings use.
- **Later merges look after themselves.** `ops/plans/duplicate-suppliers-merge.sql` now records each
  losing row's address before deleting it, and checks at the end that every old address reaches its
  kept profile. If a kept row is itself merged later, its old addresses move to the new kept row
  with everything else (the merge reads what points at a supplier from the schema).
- **What a visitor can learn**: one published address or nothing, as before. The table cannot be
  read with the public key; only the function reads it. If a kept row is later unpublished, its old
  addresses go back to 404. If it is later linked as a building, they go straight to its company.
  If it is deleted outright, its redirects are deleted with it. If a live row ever holds an old
  address again, that row decides what the address shows, not the table.
- **Not covered: a profile that is renamed.** Only merges are recorded. A profile whose address is
  changed by hand or by the name clean-up (`ops/backfill_supplier_identity.py`) loses its previous
  address as it always has; recording that is one more insert in that script, not built here.
  **Built 13 Oct 2026 as migration `0150`** (one trigger on the suppliers table, so every rename is
  recorded whichever script makes it): `ops/plans/0150-dry-run.md`.

## What was run

The whole migration ran inside `do $dry$ … execute $m$ <the migration> $m$; <checks>; raise exception …`,
so everything rolled back by construction.

```
DRY RUN OK | function before md5 d7acc1e72e04f93d67189f5846f19b11
 | redirect rows 166
 | old addresses that were published and now reach their kept profile 152
 | old addresses answering anything else 0
 | oishi-fashions -> oishi-fashion
 | sayem-fashion -> sayem-fashions
 | unknown slug -> null
 | linked buildings 744 of which answer changed 0
 | live non-building rows that would redirect 0
 | table readable by anon f by authenticated f rls t
 | function callable signed out t
```

Run twice with the same answer: once as first written, and again after the review added the rule
that a live row holding an old address wins.

Afterwards `to_regclass('public.supplier_slug_redirects')` answered null and the function's md5 was
still `d7acc1e7…`: nothing was left behind.

Read before the rehearsal, from the two snapshot tables (`_snapshot_dup_merge_20261013_suppliers`,
70 losing rows; `_snapshot_dup_merge_20261013b_suppliers`, 96): 166 losing rows, 166 different
addresses, none blank, none in use by a live row today, every kept row still there, published and
not a building, and no kept row that was itself merged away.

## What it shows

- **All 166 old addresses are recorded, and all 166 answer their kept profile.** 152 of them were
  published and are the ones a visitor could have held. The other 14 were never public; recording
  them costs nothing and discloses only the published profile of the same company.
- **Nothing that works today changes.** All 744 linked buildings answer exactly what they answered
  before, and no live profile gains a redirect.
- **The live function is the one in the repo** (0096's body, md5 above), so replacing it removes
  nothing production has that the repo lacks.
- **Order does not matter.** The app already calls this function, so 0149 can be applied before or
  after any deploy. Once applied, an old address redirects within five minutes (the public page's
  cache).

## To apply

Say "apply 0149". It then goes in through the Supabase MCP as `0149_supplier_slug_redirects`, and
the check straight after is:

```sql
select (select count(*) from public.supplier_slug_redirects) as redirect_rows,          -- 166
       public.facility_parent_slug('oishi-fashions') as oishi,                          -- oishi-fashion
       public.facility_parent_slug('sayem-fashion')  as sayem;                          -- sayem-fashions
```

then `/suppliers/oishi-fashions` in a browser, which should land on `/suppliers/oishi-fashion`.

Approval covers exactly this set: 166 rows and one function. If the count read on the day differs,
the dry run is re-run and shown again first.

## Rollback

Re-create the function from `supabase/migrations/0096_facility_parent_slug.sql`, then
`drop table public.supplier_slug_redirects;`. The old addresses go back to 404; nothing else moves.

## Guards left behind

- `supabase/ci/assert-0149.sql`: CI replays the migration on Postgres 16 and calls the function for
  a merged address, a building, a kept row that became a building, an unpublished kept row, an
  unknown address and a deleted kept row, and checks the table is closed to the public key.
- `scripts/test-profile-http-boundary.mjs`: the real app server answers 308 with the kept profile's
  address for a merged duplicate's old address, on `/suppliers/…` and on `/app/suppliers/…`.
- `ops/plans/duplicate-suppliers-merge.sql`: a merge refuses to finish if any old address does not
  reach its kept profile. `ops/merge_duplicate_suppliers.py`, its Python twin, records the address
  the same way. Both raise, and change nothing, on a database where 0149 is not applied.
