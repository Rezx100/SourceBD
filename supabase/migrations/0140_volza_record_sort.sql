-- 0140 — Which shipment a Volza row's one record is: the biggest or the latest (11 Oct 2026).
--
-- Until 11 Oct every search sorted by value, so top_record / top_shipments hold a supplier's biggest
-- shipment. The customs card's band shows "Latest shipment on record: <date>" (design session and
-- founder, 11 Oct 2026), so later fetches sort the preview by date, and the 73 suppliers shown are
-- refetched that way (ops/volza_launch.py --latest). Both kinds coexist until the refetch has run, and
-- the card has to label the row "Biggest shipment" or "Latest shipment on record": record_sort says
-- which. 'value' for every row stored so far (true: all were value-sorted); the loader writes 'date'.
--
-- supplier_volza_exports() returns it as record_sort; otherwise unchanged from 0139.
--
-- Rollback:
--   alter table public.volza_export_checks drop column record_sort;
--   then re-run the function body from 0139.

alter table public.volza_export_checks
  add column record_sort text not null default 'value' check (record_sort in ('value', 'date'));

comment on column public.volza_export_checks.record_sort is
  'value: top_record is the biggest shipment; date: it is the latest shipment on record. 0140.';

create or replace function public.supplier_volza_exports(p_slug text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  select (p.role = 'admin' or p.plan_tier in ('growth', 'enterprise'))
         and not coalesce(p.is_suspended, false)
    into v_allowed
    from public.profiles p
   where p.id = auth.uid();
  if not coalesce(v_allowed, false) then
    return null;
  end if;

  -- The licence ends a row's life at one year; the first entitled read after that deletes it
  -- (the loaders purge too). A free reader's view stays a read.
  delete from public.volza_export_checks where expires_at <= now();

  return (
    select jsonb_build_object(
             'shipments',      v.shipments,
             'fob_usd',        v.fob_usd,
             'buyers',         v.buyers,
             'window_start',   v.window_start,
             'window_end',     v.window_end,
             'volza_name',     v.volza_supplier_name,
             'top_shipments',  v.top_shipments,
             'fetched_at',     v.fetched_at,
             'summary',        v.summary,
             'top_record',     v.top_record,
             'record_sort',    v.record_sort,
             'markets',        v.markets,
             'small_orders',   v.small_orders)
      from public.volza_export_checks v
      join public.suppliers s on s.id = v.supplier_id
     where s.slug = p_slug
       and s.is_published = true
       and v.match_class = 'exact'
       and v.expires_at > now());
end;
$$;

comment on function public.supplier_volza_exports(text) is
  'Volza export summary for a published supplier, for admins and Growth/Enterprise buyers who are '
  'not suspended; null for everyone else, for no exact match, or once expired. Deletes expired rows. '
  'Returns the whole preview (0138), the market and small-orders figures (0139) and record_sort (0140).';

revoke all on function public.supplier_volza_exports(text) from public;
revoke all on function public.supplier_volza_exports(text) from anon;
grant execute on function public.supplier_volza_exports(text) to authenticated, service_role;
