-- 0150 — A renamed supplier profile keeps its old address (13 Oct 2026).
--
-- 0149 made the old address of a MERGED duplicate redirect to the kept profile. A profile whose
-- slug is changed (the name clean-up ops/backfill_supplier_identity.py, ops/fix_quality.py, a
-- hand edit) lost its old address the same way: /suppliers/<old-slug> answers 404.
--
-- ONE TRIGGER, NOTHING ELSE
--   When suppliers.slug changes, the old slug is written to supplier_slug_redirects (0149) against
--   the same row. facility_parent_slug already answers from that table, and the supplier pages
--   already call it before a 404, so the old address redirects (308) to the profile's new one. No
--   function, page or script changes: a trigger sees every rename, whichever script made it.
--
--   - The row is stored by id, so a second rename is followed: a -> b -> c leaves a and b both
--     answering c.
--   - Renaming back is safe: a live row that holds a slug wins over the table (0149).
--   - If another row is later renamed away from the same slug, the address goes to that later
--     holder: the most recent profile at an address keeps it.
--   - An unpublished row is recorded too and answers nothing until it is published (0149's rule).
--
-- NO BACKFILL
--   Read on production, 13 Oct 2026: against the full-table snapshot of 5 Aug 2026 and six later
--   ones (10,914 rows), no supplier that still exists has a different slug today. There is no past
--   rename to repair, and no record of any earlier one. Applying this writes no row.
--   Dry run: ops/plans/0150-dry-run.md.
--
-- SECURITY DEFINER because the table is closed to anon and authenticated (0149) and a rename must
-- never fail on its bookkeeping. It writes only old.slug and new.id of the row being updated.
--
-- REVERSE
--   drop trigger if exists trg_suppliers_slug_redirect on public.suppliers;
--   drop function if exists public.record_supplier_slug_change();

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
  after update of slug on public.suppliers
  for each row
  when (old.slug is distinct from new.slug)
  execute function public.record_supplier_slug_change();

comment on function public.record_supplier_slug_change() is
  'Trigger: when a supplier''s slug changes, records the old slug against the row in supplier_slug_redirects so the old address redirects (0150).';
