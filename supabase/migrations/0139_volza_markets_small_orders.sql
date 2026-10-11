-- 0139 — Volza market figures and the small-orders count, and the read returns the whole preview (11 Oct 2026).
--
-- Launch batch 1 (ops/volza_launch.py; report ops/plans/volza-export-dry-run.md section 11) fetched,
-- per supplier shown, four market searches (United Kingdom, United States, the 27 EU countries as one,
-- Canada) and, for suppliers that ship only in pieces, the count of shipments under 1,000 pieces.
-- Founder, 11 Oct 2026: give them a place so the customs card can show them. Kept raw, as fetched:
--   markets      {"United Kingdom": {"shipments", "fob_usd", "buyers", "top": <biggest shipment there>}, ...}
--   small_orders {"under_pcs": 1000, "shipments": <under 1,000 pieces>, "of": <all shipments>}
-- Both null when not fetched (single-country suppliers have no markets; mixed units no small_orders).
--
-- supplier_volza_exports() also returns summary and top_record (0138) and these two. Same gate as
-- 0137: admins and Growth/Enterprise buyers who are not suspended, exact matches only, unexpired rows.
-- New keys only, so today's reader (lib/dashboard/load-record.ts) is unaffected.
--
-- Rollback:
--   alter table public.volza_export_checks drop column markets, drop column small_orders;
--   then re-run the function body from 0137.

alter table public.volza_export_checks
  add column markets      jsonb check (markets is null or jsonb_typeof(markets) = 'object'),
  add column small_orders jsonb check (small_orders is null or jsonb_typeof(small_orders) = 'object');

comment on column public.volza_export_checks.markets is
  'Per market (United Kingdom, United States, EU, Canada): shipments, fob_usd, buyers and the biggest shipment there. 0139.';
comment on column public.volza_export_checks.small_orders is
  'Shipments under 1,000 pieces out of all ({under_pcs, shipments, of}); only for suppliers shipping in pieces only. 0139.';

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
  'Returns the whole preview (0138) and the market and small-orders figures (0139).';

revoke all on function public.supplier_volza_exports(text) from public;
revoke all on function public.supplier_volza_exports(text) from anon;
grant execute on function public.supplier_volza_exports(text) to authenticated, service_role;
