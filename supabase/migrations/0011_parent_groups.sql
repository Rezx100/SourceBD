-- 0011_parent_groups.sql
-- Spec 10: parent-group membership on suppliers + queue type for ambiguous clusters.
--
-- Decision (option A): a single text column on public.suppliers names the
-- corporate parent group. This is intentionally lighter than the addendum's
-- bh_factory_relationships table (which models BH<->factory, not sibling
-- factories sharing a corporate parent). Empty / NULL means "no known parent
-- group" — the common case. Index supports profile-card "other factories in
-- this group" lookups in Phase 1.

alter table public.suppliers
    add column if not exists parent_group_name text;

create index if not exists idx_suppliers_parent_group_name
    on public.suppliers (parent_group_name)
    where parent_group_name is not null;

-- Extend queue_type enum with the new value used by spec10_parent_groups.py
-- for clusters that look like a parent group but cannot be auto-assigned
-- deterministically (e.g. generic shared prefix, no district overlap).
do $$
begin
  if not exists (
    select 1
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
     where t.typname = 'queue_type'
       and e.enumlabel = 'group_parent_review'
  ) then
    alter type public.queue_type add value 'group_parent_review';
  end if;
end$$;
