-- 0149 — the old address of a merged supplier redirects to the kept profile.
--
-- WHY
-- ---
-- On 13 Oct 2026, 166 duplicate supplier rows were merged into the row kept
-- and deleted, in two runs (ops/plans/duplicate-suppliers-audit.md, sections 3
-- and 5a: 70, then 96 on the founder's decisions). 152 of them were
-- published, so /suppliers/<their slug> now answers 404 where Google and
-- buyers' bookmarks still point: /suppliers/oishi-fashions is gone, the kept
-- profile is /suppliers/oishi-fashion.
--
-- WHAT
-- ----
-- 1. supplier_slug_redirects: one row per retired slug, pointing at the kept
--    row by id, so a later rename of the kept row is followed. The id is a
--    foreign key to suppliers, and both merges (ops/plans/duplicate-suppliers-
--    merge.sql, ops/merge_duplicate_suppliers.py) move every such column to the
--    kept row, so merging a kept row again carries its old addresses along.
-- 2. facility_parent_slug(p_slug) answers for a retired slug as well as for a
--    building. Both profile routes and the search's ?record= already call it
--    when a profile is not found and send a 308 to what it returns, so no
--    route changes (lib/facility-parent-redirect.ts).
-- 3. The 152 published slugs of 13 Oct are filled from the two merges'
--    snapshots.
--
-- WHY THIS IS SAFE
-- ----------------
-- As in 0096 the function returns one text slug of a published row and
-- nothing else. The table holds a slug and an id, has RLS on with no policy
-- and no grant to anon or authenticated; only the function reads it.
-- A slug a live row holds is never redirected by the table: the row owns its
-- address, published or not.
--
-- REVERSE
-- -------
--   Re-run supabase/migrations/0096_facility_parent_slug.sql, then
--   drop table if exists public.supplier_slug_redirects;
--
-- Not applied in the authoring session. Dry run: ops/plans/0149-dry-run.md.

create table if not exists public.supplier_slug_redirects (
  old_slug    text primary key,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists idx_supplier_slug_redirects_supplier_id
  on public.supplier_slug_redirects (supplier_id);

alter table public.supplier_slug_redirects enable row level security;
revoke all on public.supplier_slug_redirects from anon, authenticated;

comment on table public.supplier_slug_redirects is
  'A slug retired when its supplier row was merged into another, and the row kept. Read only by facility_parent_slug(), which the profile routes call before answering 404.';

create or replace function public.facility_parent_slug(p_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    -- A building: its published mother (0096, unchanged).
    (select p.slug
       from public.suppliers c
       join public.suppliers p on p.id = c.facility_of
      where c.slug = p_slug
        and c.facility_of is not null
        and p.is_published = true
      limit 1),
    -- A slug retired by a merge: the row kept, or that row's mother if it has
    -- since become a building.
    (select p.slug
       from public.supplier_slug_redirects r
       join public.suppliers k on k.id = r.supplier_id
       join public.suppliers p on p.id = coalesce(k.facility_of, k.id)
      where r.old_slug = p_slug
        and p.is_published = true
        and not exists (select 1 from public.suppliers s where s.slug = p_slug))
  );
$$;

revoke all on function public.facility_parent_slug(text) from public;
grant execute on function public.facility_parent_slug(text) to anon, authenticated;

comment on function public.facility_parent_slug(text) is
  'Returns the published slug an unpublished building (REZ-72) or a merged supplier''s retired slug (0149) should redirect to, or NULL. Used by profile routes to permanentRedirect before notFound(). Returns only a slug — no PII.';

-- The two merges of 13 Oct 2026. A database that never ran them (CI, a fresh
-- local one) has no snapshot and nothing to fill.
do $fill$
declare
  t text;
  n bigint;
  total bigint := 0;
begin
  foreach t in array array['_snapshot_dup_merge_20261013_suppliers', '_snapshot_dup_merge_20261013b_suppliers']
  loop
    continue when to_regclass('public.' || t) is null;
    execute format($q$
      insert into public.supplier_slug_redirects (old_slug, supplier_id)
      select x.slug, x.merged_into
        from public.%1$I x
        join public.suppliers k on k.id = x.merged_into
       where x.role = 'lose' and x.is_published
      on conflict (old_slug) do nothing$q$, t);
    get diagnostics n = row_count;
    total := total + n;
    -- All of them or none: a published merged row whose address did not get in
    -- (its kept row is gone) stops the migration instead of staying a quiet 404.
    execute format($q$
      select count(*) from public.%1$I x
       where x.role = 'lose' and x.is_published
         and not exists (select 1 from public.supplier_slug_redirects r where r.old_slug = x.slug)$q$, t)
      into n;
    if n > 0 then
      raise exception '0149: % published merged rows of % have no redirect; their kept rows are missing', n, t;
    end if;
  end loop;
  raise notice '0149: % old addresses recorded', total;
end
$fill$;
