-- Rehearsal of migration 0150 (a renamed profile keeps its old address) on production.
--
-- Paste the whole file into the Supabase SQL editor and run it. It ENDS IN AN ERROR ON PURPOSE:
-- an error whose text starts "DRY RUN OK" is the pass, and because it is an error nothing is kept
-- (the trigger, its function and the throwaway row are all rolled back).
--
-- It touches no existing supplier: it makes one unpublished throwaway row, renames it, and reads.
--
-- Expected (13 Oct 2026, 166 redirect rows on production):
--   DRY RUN OK | redirect rows before 166 | after creating the trigger 166
--    | after an update that is not a rename 166 | after one rename 167
--    | the old address is recorded against the renamed row: t | it answers null while the row is unpublished
--    | oishi-fashions still -> oishi-fashion | sayem-fashion still -> sayem-fashions
--    | triggers on suppliers: the four there today plus trg_suppliers_slug_redirect
--    | trigger function: runs as owner t, callable by anon f authenticated f
--
-- The block between $m$ and $m$ is supabase/migrations/0150_supplier_slug_rename_redirect.sql.

do $dry$
declare
  n0 bigint; n1 bigint; n2 bigint; n3 bigint; tid uuid; trg text; target uuid; ans text;
begin
  select count(*) into n0 from public.supplier_slug_redirects;

  execute $m$
create or replace function public.record_supplier_slug_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.supplier_slug_redirects (old_slug, supplier_id)
  values (old.slug, new.id)
  on conflict (old_slug) do update set supplier_id = excluded.supplier_id;
  return null;
end;
$$;

revoke all on function public.record_supplier_slug_change() from public, anon, authenticated;

drop trigger if exists trg_suppliers_slug_redirect on public.suppliers;
create trigger trg_suppliers_slug_redirect
  -- Not "update of slug": that fires only when the statement itself sets slug, and would miss a
  -- slug changed by another trigger. The WHEN clause is the whole test.
  after update on public.suppliers
  for each row
  when (old.slug is distinct from new.slug)
  execute function public.record_supplier_slug_change();

comment on function public.record_supplier_slug_change() is
  'Trigger: when a supplier''s slug changes, records the old slug against the row in supplier_slug_redirects so the old address redirects (0150).';
  $m$;

  select count(*) into n1 from public.supplier_slug_redirects;

  -- No existing row is touched: a throwaway, unpublished row made here and gone with the rollback.
  insert into public.suppliers (slug, company_name, company_name_norm, city, district, is_published, is_sanctioned)
  values ('zz-rehearsal-0150-a', 'ZZ Rehearsal 0150 Ltd', 'zz rehearsal 0150 ltd', 'Dhaka', 'Dhaka', false, false)
  returning id into tid;
  update public.suppliers set city = 'Gazipur', slug = slug where id = tid;
  select count(*) into n2 from public.supplier_slug_redirects;
  update public.suppliers set slug = 'zz-rehearsal-0150-b' where id = tid;
  select count(*) into n3 from public.supplier_slug_redirects;
  select supplier_id into target from public.supplier_slug_redirects where old_slug = 'zz-rehearsal-0150-a';
  ans := coalesce(public.facility_parent_slug('zz-rehearsal-0150-a'), 'null');
  select string_agg(tgname, ', ' order by tgname) into trg from pg_trigger where tgrelid = 'public.suppliers'::regclass and not tgisinternal;

  raise exception E'DRY RUN OK | redirect rows before % | after creating the trigger % | after an update that is not a rename % | after one rename %\n | the old address is recorded against the renamed row: % | it answers % while the row is unpublished\n | oishi-fashions still -> % | sayem-fashion still -> %\n | triggers on suppliers: %\n | trigger function: runs as owner %, callable by anon % authenticated %',
    n0, n1, n2, n3, (target = tid), ans,
    public.facility_parent_slug('oishi-fashions'), public.facility_parent_slug('sayem-fashion'), trg,
    (select prosecdef from pg_proc where oid = 'public.record_supplier_slug_change()'::regprocedure),
    has_function_privilege('anon', 'public.record_supplier_slug_change()', 'execute'),
    has_function_privilege('authenticated', 'public.record_supplier_slug_change()', 'execute');
end
$dry$;
