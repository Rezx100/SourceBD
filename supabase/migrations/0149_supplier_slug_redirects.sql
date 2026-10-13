-- 0149 — Old addresses of merged duplicate suppliers redirect to the kept profile (13 Oct 2026).
--
-- On 13 Oct 2026, 166 duplicate supplier rows were merged into their twins and deleted
-- (ops/plans/duplicate-suppliers-audit.md). 152 of them were published, so /suppliers/<old-slug>
-- now answers 404 on an address Google and buyers already hold (/suppliers/oishi-fashions; the
-- kept profile is /suppliers/oishi-fashion).
--
-- ONE TABLE, AND THE REDIRECT THAT ALREADY EXISTS
--   supplier_slug_redirects (old_slug -> the kept supplier's id). facility_parent_slug, which the
--   supplier pages already call before a 404 (0096: a linked building goes to its company), now
--   also answers from this table. No page, route or middleware changes: the same call, the same 308.
--
--   The id, not the slug, is stored, so the redirect follows the kept row if it is renamed, and a
--   later merge of the kept row moves these rows with everything else that points at a supplier
--   (ops/plans/duplicate-suppliers-merge.sql reads foreign keys from the schema). Deleting the kept
--   row outright deletes its redirects, and the old address is a 404 again.
--
-- WHAT A CALLER CAN LEARN
--   As in 0096: one published slug, or NULL. The table itself is closed to anon and authenticated
--   (row level security on, no policy, no grant); only the function reads it. An old address whose
--   kept row is unpublished answers NULL (404) unless that row is a building, in which case it
--   answers the building's published company, in one hop.
--
-- BACKFILL
--   The 166 old slugs come from the two snapshot tables the merges left behind. They exist only on
--   production, so a database without them (CI's replay, a fresh local one) creates an empty table.
--   Dry run: ops/plans/0149-dry-run.md.
--
-- May be applied before or after any deploy: the app already calls this function.
--
-- REVERSE
--   Re-create the function from 0096_facility_parent_slug.sql, then
--   drop table public.supplier_slug_redirects;

create table if not exists public.supplier_slug_redirects (
  old_slug    text primary key,
  -- ponytail: no index on supplier_id; a supplier delete or merge scans a table of a few hundred
  -- rows. Add one when merges are routine or the table passes ~10k rows.
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.supplier_slug_redirects enable row level security;
revoke all on table public.supplier_slug_redirects from anon, authenticated;

comment on table public.supplier_slug_redirects is
  'The old public slug of a supplier row that was merged into another and deleted, and the row it was merged into. Read only by facility_parent_slug.';

do $$
declare
  t text;
begin
  foreach t in array array[
    '_snapshot_dup_merge_20261013_suppliers',
    '_snapshot_dup_merge_20261013b_suppliers'
  ]
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format(
        'insert into public.supplier_slug_redirects (old_slug, supplier_id)
           select l.slug, l.merged_into
             from public.%I l
             join public.suppliers k on k.id = l.merged_into
            where l.role = ''lose'' and l.slug is not null and l.slug <> ''''
           on conflict (old_slug) do nothing', t);
    end if;
  end loop;
end
$$;

create or replace function public.facility_parent_slug(p_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    -- A linked building: its published company (0096, unchanged).
    (select p.slug
       from public.suppliers c
       join public.suppliers p on p.id = c.facility_of
      where c.slug = p_slug
        and c.facility_of is not null
        and p.is_published = true
      limit 1),
    -- A merged duplicate's old address: the kept profile, or the kept row's
    -- company when the kept row has since been linked as a building.
    (select case when k.is_published then k.slug when p.is_published then p.slug end
       from public.supplier_slug_redirects r
       join public.suppliers k on k.id = r.supplier_id
       left join public.suppliers p on p.id = k.facility_of
      where r.old_slug = p_slug)
  );
$$;

revoke all on function public.facility_parent_slug(text) from public;
grant execute on function public.facility_parent_slug(text) to anon, authenticated;

comment on function public.facility_parent_slug(text) is
  'Where a supplier address that no longer has a profile should go: the published company of a linked building (REZ-72), or the kept profile of a merged duplicate (0149). NULL otherwise. Returns only a slug, no PII.';
