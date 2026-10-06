-- 0126 — the six "claimed supplier may read" policies stop reading suppliers.claimed_by as the caller.
--
-- WHY
-- ---
-- A signed-in buyer opening a supplier record sees "Your RFQs could not be
-- read." (phone record page, 6 Oct 2026). The record reads `public.rfqs`
-- directly as the buyer, and Postgres evaluates EVERY permissive policy on the
-- table, so `pol_rfqs_select_supplier` runs its subquery
-- `select 1 from suppliers s where s.claimed_by = auth.uid() …` as
-- `authenticated`. REZ-22 (20260725_rez_security_hardening_2.sql) revoked
-- SELECT (claimed_by) on suppliers from authenticated, so that subquery, and
-- with it every direct read of the table, fails:
--
--   begin read only; set local role authenticated; …
--   select count(*) from public.rfqs where buyer_id = '…';
--   ERROR: 42501: permission denied for table suppliers     (production, 6 Oct 2026)
--
-- The same subquery sits in five more policies (rfq_quotes, orders,
-- order_milestones, supplier_relationships ×2), all live in production with
-- the identical text, so a direct read of any of those tables fails the same
-- way. The security-definer RPCs were never affected.
--
-- FIX
-- ---
-- One security-definer helper answers "which suppliers has the caller
-- claimed" — only the caller's own ids, which is all the policies ever asked —
-- and the six policies use it. `claimed_by` stays unreadable to authenticated
-- (REZ-22 keeps holding); the policies' meaning is unchanged.
--
-- REVERSE
-- -------
--   recreate the six policies with their 0028 / 0029 / 0036 bodies, then
--   drop function public.claimed_supplier_ids();

create or replace function public.claimed_supplier_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(s.id), '{}'::uuid[])
    from public.suppliers s
   where auth.uid() is not null and s.claimed_by = auth.uid();
$$;

revoke all on function public.claimed_supplier_ids() from public, anon;
grant execute on function public.claimed_supplier_ids() to authenticated;

comment on function public.claimed_supplier_ids() is
  'The supplier ids the caller has claimed; empty when none or signed out. For RLS policies: '
  'authenticated cannot read suppliers.claimed_by itself (REZ-22), so a policy that read it failed every query (0126).';

drop policy if exists pol_rfqs_select_supplier on public.rfqs;
create policy pol_rfqs_select_supplier
  on public.rfqs
  for select
  to authenticated
  using (rfqs.target_supplier_ids && public.claimed_supplier_ids());

drop policy if exists pol_rfq_quotes_select_supplier on public.rfq_quotes;
create policy pol_rfq_quotes_select_supplier
  on public.rfq_quotes
  for select
  to authenticated
  using (rfq_quotes.supplier_id = any (public.claimed_supplier_ids()));

drop policy if exists pol_orders_select_supplier on public.orders;
create policy pol_orders_select_supplier
  on public.orders
  for select
  to authenticated
  using (orders.supplier_id = any (public.claimed_supplier_ids()));

drop policy if exists pol_order_milestones_select_supplier on public.order_milestones;
create policy pol_order_milestones_select_supplier
  on public.order_milestones
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
       where o.id = order_milestones.order_id
         and o.supplier_id = any (public.claimed_supplier_ids())
    )
  );

drop policy if exists pol_supplier_relationships_select_bh on public.supplier_relationships;
create policy pol_supplier_relationships_select_bh
  on public.supplier_relationships
  for select
  to authenticated
  using (supplier_relationships.buying_house_id = any (public.claimed_supplier_ids()));

drop policy if exists pol_supplier_relationships_select_factory on public.supplier_relationships;
create policy pol_supplier_relationships_select_factory
  on public.supplier_relationships
  for select
  to authenticated
  using (supplier_relationships.factory_id = any (public.claimed_supplier_ids()));

notify pgrst, 'reload schema';
