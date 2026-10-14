# 0150: a renamed profile keeps its old address (13 Oct 2026)

Migration `supabase/migrations/0150_supplier_slug_rename_redirect.sql`. **Not applied.** It waits for
the founder's "apply 0150".

## The problem

Migration 0149 (applied 13 Oct 2026) made the old address of a merged duplicate redirect to the
profile that was kept. A profile whose own address is changed, by the name clean-up
(`ops/backfill_supplier_identity.py`), by `ops/fix_quality.py` or by hand, was left out: its previous
address answers "Page not found".

## Is anything broken today? No.

Read on production, 13 Oct 2026 (read only). Seven saved copies of the supplier table hold an id and
an address: the full-table copy of 5 Aug 2026 (10,912 rows) and six later, smaller ones. Together
11,942 rows, 10,914 different suppliers.

- Suppliers in those copies that still exist and have a **different address today: 0**.
- Suppliers in those copies that no longer exist: 166. They are the 166 merged duplicates, and 0149
  already redirects every one.

So no profile has been renamed since 5 Aug 2026, and there is no record of any earlier rename to
repair. This change is for the next rename, not for a past one. Applying it writes no row.

The query, to run again rather than write a new one (read only; the last line is the answer):

```sql
with snaps as (
  select id, slug from public._rez91_employees_total_snapshot_20260805
  union all select id, slug from public._snapshot_20260814_queue_release_suppliers
  union all select id, slug from public._snapshot_dup_merge_20261013_suppliers
  union all select id, slug from public._snapshot_dup_merge_20261013b_suppliers
  union all select id, slug from public._snapshot_entity_type_20261013
  union all select id, slug from public._snapshot_premises_attach_20261013
  union all select id, slug from public._snapshot_premises_attach_20261013b
)
select count(*) as snapshot_rows,                                                           -- 11,942
       count(distinct sn.id) as suppliers,                                                  -- 10,914
       count(distinct sn.id) filter (where s.id is null) as no_longer_exist,                -- 166
       count(distinct (sn.id, sn.slug)) filter (where s.slug <> sn.slug) as renamed_since   -- 0
  from snaps sn left join public.suppliers s on s.id = sn.id
 where sn.slug is not null and sn.slug <> '';
```

## The design

One trigger on the suppliers table and nothing else.

- When a supplier's address changes, the database writes the old address into the table 0149 made
  (`supplier_slug_redirects`), against the same supplier row. The pages already look in that table
  before answering "not found", so the old address redirects (308) to the new one. No page, function
  or script changes.
- **A trigger, not an insert in each script**, because more than one script, and any hand edit, can
  rename a profile. The database sees all of them; a script would cover only itself.
- Renamed twice (a, then b, then c): a and b both go to c, because the table points at the row.
- Renamed back: nothing odd. A live profile always owns its own address (0149's rule).
- If a second profile later holds an address and is renamed away from it, the address goes to that
  later profile: the most recent profile at an address keeps it.
- A profile that is not published is recorded too and answers nothing until it is published.
- If a profile is deleted, its old addresses go with it (0149's rule). If it is merged, they move to
  the kept profile with everything else.

## When a rename is a correction

The trigger cannot tell a tidy-up ("oishi-fashions" to "oishi-fashion") from a correction (a profile
that was wrongly filed under another company's name). After a correction the wrong name should not
keep pointing at this profile. Remove its row by hand, as part of the correction:

```sql
delete from public.supplier_slug_redirects where old_slug = '<the wrong address>';
```

If the other company has, or later gets, a profile at that address, nothing needs doing: a live
profile always owns its own address.

## Rehearsal

**Not run on production.** Two attempts were declined at the approval prompt on 13 Oct 2026: the
first renamed one real profile inside a transaction that rolls back; the second touched no existing
row (a throwaway row made and renamed inside the same rolled-back transaction). A read straight after
confirmed nothing was left behind: no function, no trigger, 166 redirect rows as before.

What stands in for it:

- `supabase/ci/assert-0150.sql` runs on a database built from every migration, on Postgres 16, in
  CI. It renames a published profile and checks the old address answers the new one; renames it
  again and back; lets a second profile take and leave an address; checks an update that is not a
  rename writes nothing; an unpublished profile; a linked building; that the trigger's function
  cannot be called from outside; and that deleting a profile deletes its old addresses.
- What CI cannot show is the trigger beside production's own four triggers on that table. The
  rehearsal below shows it, and changes nothing that is kept.

The rehearsal is saved as `ops/plans/0150-rehearsal.sql`, to paste into the Supabase SQL editor: it
was declined at the approval prompt twice more after the founder asked for it (four times in all),
so it has to be run by hand. The rehearsal to run before applying, if the founder allows it (it ends in an error on purpose, so
nothing is kept): inside `do $dry$ … execute $m$ <the migration> $m$;`, insert a throwaway
unpublished supplier `zz-rehearsal-0150-a`, rename it to `zz-rehearsal-0150-b`, and check that the
redirect rows went from 166 to 167, that the new row points at the throwaway supplier, and that
`oishi-fashions` and `sayem-fashion` still answer `oishi-fashion` and `sayem-fashions`; then
`raise exception`.

## To apply

Say "apply 0150". It goes in through the Supabase MCP as `0150_supplier_slug_rename_redirect`,
after the rehearsal above if it is allowed. The check straight after, read only:

```sql
select (select count(*) from pg_trigger where tgname = 'trg_suppliers_slug_redirect') as trigger_there,  -- 1
       (select count(*) from public.supplier_slug_redirects) as redirect_rows,                            -- 166, unchanged
       has_function_privilege('anon', 'public.record_supplier_slug_change()', 'execute') as open_to_public; -- false
```

Order does not matter against the code: nothing in the app changes.

## Undo

```sql
drop trigger if exists trg_suppliers_slug_redirect on public.suppliers;
drop function if exists public.record_supplier_slug_change();
```

Old addresses already recorded keep redirecting; new renames stop being recorded.

## Not covered

An old address of a line sheet (`/app/suppliers/<old address>/lines/<code>`) still answers "not
found", for renamed and merged profiles and for buildings alike. Only the profile's own address
redirects.
