-- 0110 — An order cannot be cancelled once it has shipped (OR-02, 4 Oct 2026).
--
-- PR 237 hid "Cancel order" on shipped and in-transit orders, but
-- order_cancel (0029) still refused only delivered and cancelled ones, so a
-- direct call cancelled goods already on their way. It now refuses shipped and
-- in_transit too, with a sentence the order page can show as it is.
--
-- Everything else is 0029's text unchanged (production's copy matched the repo
-- byte for byte on 4 Oct: md5 of pg_get_functiondef fe955411…). order_update
-- still lets the buyer correct a status by hand, shipped back to
-- in_production included; that is their own record and stays theirs to fix.
--
-- Hard invariants honoured:
--   * Server enforces auth + ownership: SECURITY DEFINER, `set search_path =
--     public`, the caller must own the order (unchanged from 0029).
--   * Supabase grants EXECUTE to `anon` by name, so `anon` is revoked by name
--     (0105's finding); the function refused a null auth.uid() regardless.
--
-- Idempotent: `create or replace` of the same signature. No row changes.
--
-- Do not apply to production from this PR (AGENTS rule 15); the founder
-- applies it after the dry run in ops/plans/0110-dry-run.md.
--
-- Reversible: re-run 0029's `create or replace function public.order_cancel`.

create or replace function public.order_cancel(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_order record;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_id is null then
    raise exception 'id is required';
  end if;
  select o.* into v_order from public.orders o where o.id = p_id;
  if not found then
    raise exception 'order not found';
  end if;
  if v_order.buyer_id <> v_uid then
    raise exception 'caller does not own this order' using errcode = '42501';
  end if;
  if v_order.status in ('shipped', 'in_transit', 'delivered') then
    raise exception 'This order has shipped, so it can no longer be cancelled.';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'This order is already cancelled.';
  end if;

  update public.orders
     set status = 'cancelled',
         updated_at = now()
   where id = p_id;
end;
$$;

revoke all     on function public.order_cancel(uuid) from public;
revoke execute on function public.order_cancel(uuid) from anon;
grant  execute on function public.order_cancel(uuid) to authenticated;
