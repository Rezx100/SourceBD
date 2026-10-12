-- 0146 asserted by running it: the reveal returns the buyer's city and a price a piece for a plausible
-- shipment counted in pieces; a price a kilo, a price outside US$0.10 to US$60, a piece lighter than 0.01 kg
-- or heavier than 3 kg, a missing or zero value and a price filed as text all answer null; a shipment with no
-- declared weight keeps its price; the raw unit_rate_usd is never returned; no buyer may call the check itself.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a146', 'admin-0146@example.invalid', '{"role":"admin"}'::jsonb)
on conflict do nothing;

insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned) values
  ('00000000-0000-4000-8000-0000000a1146', 'ci-0146-a', 'CI 0146 A Ltd', 'ci 0146 a ltd', 'Dhaka', 'Dhaka', false, false);

-- Published only once it holds a Tier 1 source (enforce_publish_tier).
insert into public.source_records (supplier_id, source_id, source_tier, source_ref)
select sp.id, s.id, s.tier, 'CI-0146-' || sp.slug from public.suppliers sp, public.sources s
 where sp.slug = 'ci-0146-a' and s.code = 'RSC';
update public.suppliers set is_published = true where slug = 'ci-0146-a';

insert into public.volza_export_checks
  (supplier_id, name_searched, window_start, window_end, shipments, exporters_matched, match_class,
   volza_supplier_name, fetched_at, expires_at) values
  ('00000000-0000-4000-8000-0000000a1146', 'CI 0146 A', '2024-09-01', '2026-08-31', 40, 1, 'exact', 'CI 0146 A Ltd.', now(), now() + interval '300 days');

do $$
declare
  admin constant uuid := '00000000-0000-4000-8000-00000000a146';
  ok    constant jsonb := '{"unit": "PCS", "unit_rate_usd": 4.59, "trade_value_usd": 1137.308, "gross_weight_kg": 80.45}';
  j     jsonb;
  first jsonb;
begin
  if public._volza_checked_price(ok) <> 4.59 then raise exception 'a plausible price was held back'; end if;
  if public._volza_checked_price(ok - 'gross_weight_kg') <> 4.59
     or public._volza_checked_price(ok || '{"gross_weight_kg": 0}') <> 4.59 then
    raise exception 'no declared weight cost the price';
  end if;
  if public._volza_checked_price(ok || '{"unit": "KGS"}') is not null then raise exception 'a price a kilo was returned'; end if;
  if public._volza_checked_price(ok || '{"unit_rate_usd": 41608.22}') is not null
     or public._volza_checked_price(ok || '{"unit_rate_usd": 0.05}') is not null then
    raise exception 'a price outside 0.10 to 60 was returned';
  end if;
  -- 1,137 dollars at 4.59 is 248 pieces: 2 kg is 0.008 kg a piece, 1,000 kg is 4 kg a piece.
  if public._volza_checked_price(ok || '{"gross_weight_kg": 2}') is not null
     or public._volza_checked_price(ok || '{"gross_weight_kg": 1000}') is not null then
    raise exception 'an impossible weight a piece kept its price';
  end if;
  if public._volza_checked_price(ok || '{"trade_value_usd": 0}') is not null
     or public._volza_checked_price(ok - 'trade_value_usd') is not null
     or public._volza_checked_price(ok || '{"unit_rate_usd": "4.59"}') is not null
     or public._volza_checked_price(ok || '{"unit_rate_usd": null}') is not null then
    raise exception 'a price without a usable value or number was returned';
  end if;

  if has_function_privilege('authenticated', 'public._volza_checked_price(jsonb)', 'execute')
     or has_function_privilege('anon', 'public._volza_checked_price(jsonb)', 'execute')
     or has_function_privilege('anon', 'public.supplier_shipment_reveal(text)', 'execute') then
    raise exception '0146 grants are too wide';
  end if;

  insert into public.volza_shipment_reveals (supplier_id, records, fetched_at, expires_at, cost_usd) values
    ('00000000-0000-4000-8000-0000000a1146',
     jsonb_build_array(
       ok || '{"shipment_date": "2026-08-31T00:00:00", "buyer_name": "Buyer One", "buyer_city": "Stockholm"}',
       ok || '{"shipment_date": "2026-08-30T00:00:00", "buyer_name": "Buyer Two", "unit_rate_usd": 41608.22}'),
     now(), now() + interval '30 days', 0.20);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  j := public.supplier_shipment_reveal('ci-0146-a');
  reset role;
  first := j -> 'records' -> 0;
  if jsonb_array_length(j -> 'records') <> 2
     or first ->> 'buyer_city' <> 'Stockholm' or (first ->> 'unit_price_usd')::numeric <> 4.59
     or first ? 'unit_rate_usd'
     or j -> 'records' -> 1 -> 'unit_price_usd' <> 'null'::jsonb
     or (j -> 'records' -> 1) ? 'unit_rate_usd' then
    raise exception 'the read: %', j;
  end if;
end
$$;

rollback;
