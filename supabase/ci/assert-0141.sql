-- 0141 asserted by running it: Starter and suspended buyers get nothing; a non-exact match offers nothing; the
-- first reveal hands out one claim and a second click meanwhile is told busy (one Volza call); a finished fetch
-- serves Growth exactly 15 and Enterprise exactly 25 of the same saved 25, newest first, without another claim;
-- the allowance, the off switch and the budget stop a new fetch while a saved copy still serves; an aborted fetch
-- saves nothing and uses no allowance; an expired copy is deleted and not served; finish and abort are the
-- service role's alone; rl_check accepts api_reveal.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a141', 'admin-0141@example.invalid',   '{"role":"admin"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b141', 'growth-0141@example.invalid',  '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000c141', 'ent-0141@example.invalid',     '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000d141', 'starter-0141@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000e141', 'susp-0141@example.invalid',    '{"role":"buyer"}'::jsonb)
on conflict do nothing;

update public.profiles set plan_tier = 'growth' where id in
  ('00000000-0000-4000-8000-00000000b141', '00000000-0000-4000-8000-00000000e141');
update public.profiles set plan_tier = 'enterprise' where id = '00000000-0000-4000-8000-00000000c141';
update public.profiles set is_suspended = true where id = '00000000-0000-4000-8000-00000000e141';

insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned) values
  ('00000000-0000-4000-8000-0000000a1141', 'ci-0141-a', 'CI 0141 A Ltd', 'ci 0141 a ltd', 'Dhaka', 'Dhaka', true, false),
  ('00000000-0000-4000-8000-0000000a2141', 'ci-0141-b', 'CI 0141 B Ltd', 'ci 0141 b ltd', 'Dhaka', 'Dhaka', true, false),
  ('00000000-0000-4000-8000-0000000a3141', 'ci-0141-c', 'CI 0141 C Ltd', 'ci 0141 c ltd', 'Dhaka', 'Dhaka', true, false);

insert into public.volza_export_checks
  (supplier_id, name_searched, window_start, window_end, shipments, exporters_matched, match_class,
   volza_supplier_name, fetched_at, expires_at) values
  ('00000000-0000-4000-8000-0000000a1141', 'CI 0141 A', '2024-09-01', '2026-08-31', 40, 1, 'exact',  'CI 0141 A Ltd.', now(), now() + interval '300 days'),
  ('00000000-0000-4000-8000-0000000a2141', 'CI 0141 B', '2024-09-01', '2026-08-31', 40, 1, 'exact',  'CI 0141 B Ltd',  now(), now() + interval '300 days'),
  ('00000000-0000-4000-8000-0000000a3141', 'CI 0141 C', '2024-09-01', '2026-08-31', 40, 3, 'likely', 'CI 0141 C',      now(), now() + interval '300 days');

do $$
declare
  admin   constant uuid := '00000000-0000-4000-8000-00000000a141';
  growth  constant uuid := '00000000-0000-4000-8000-00000000b141';
  ent     constant uuid := '00000000-0000-4000-8000-00000000c141';
  starter constant uuid := '00000000-0000-4000-8000-00000000d141';
  susp    constant uuid := '00000000-0000-4000-8000-00000000e141';
  a       constant uuid := '00000000-0000-4000-8000-0000000a1141';
  b       constant uuid := '00000000-0000-4000-8000-0000000a2141';
  recs    jsonb;
  j       jsonb;
  claim   uuid;
  n       int;
begin
  -- Who may call what.
  if has_function_privilege('anon', 'public.volza_reveal_begin(text)', 'execute')
     or has_function_privilege('anon', 'public.supplier_shipment_reveal(text)', 'execute')
     or has_function_privilege('authenticated', 'public.volza_reveal_finish(uuid, jsonb, numeric, numeric)', 'execute')
     or has_function_privilege('authenticated', 'public.volza_reveal_abort(uuid, numeric)', 'execute')
     or has_table_privilege('authenticated', 'public.volza_shipment_reveals', 'select')
     or has_table_privilege('authenticated', 'public.volza_reveal_settings', 'update') then
    raise exception '0141 grants are too wide';
  end if;

  -- 25 records, dates shuffled: record k is 2026-08-(k+1), stored in reverse-ish order.
  select jsonb_agg(jsonb_build_object('shipment_date', format('2026-08-%sT00:00:00', lpad((k + 1)::text, 2, '0')),
                                      'buyer_name', 'Buyer ' || k, 'unit_rate_usd', 1.5, 'trade_value_usd', k * 100)
                   order by (k * 7) % 25)
    into recs from generate_series(1, 25) k;

  set local role authenticated;

  perform set_config('request.jwt.claim.sub', starter::text, true);
  if public.volza_reveal_begin('ci-0141-a') ->> 'status' <> 'forbidden' or public.supplier_shipment_reveal('ci-0141-a') is not null then
    raise exception 'starter got a reveal';
  end if;
  perform set_config('request.jwt.claim.sub', susp::text, true);
  if public.volza_reveal_begin('ci-0141-a') ->> 'status' <> 'forbidden' then raise exception 'suspended got a reveal'; end if;

  perform set_config('request.jwt.claim.sub', growth::text, true);
  if public.volza_reveal_begin('ci-0141-c') ->> 'status' <> 'unavailable' then raise exception 'a likely match was offered'; end if;

  -- First click: a claim, searched by the Volza spelling.
  j := public.volza_reveal_begin('ci-0141-a');
  if j ->> 'status' <> 'fetch' or j ->> 'name' <> 'CI 0141 A Ltd.' or j ->> 'window_start' <> '2024-09-01' then
    raise exception 'first click: %', j;
  end if;
  claim := (j ->> 'claim')::uuid;

  -- A second buyer clicking meanwhile: busy, no second claim.
  perform set_config('request.jwt.claim.sub', ent::text, true);
  if public.volza_reveal_begin('ci-0141-a') ->> 'status' <> 'busy' then raise exception 'second click was not busy'; end if;
  reset role;

  set local role service_role;
  if not public.volza_reveal_finish(claim, recs, 1.35, 2900) then raise exception 'finish lost its claim'; end if;
  reset role;

  if (select spent_usd from public.volza_reveal_settings) <> 1.35
     or (select credit_remaining_usd from public.volza_reveal_settings) <> 2900 then
    raise exception 'spend not logged';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', growth::text, true);
  j := public.supplier_shipment_reveal('ci-0141-a');
  if jsonb_array_length(j -> 'records') <> 15 or (j ->> 'limit')::int <> 15
     or j -> 'records' -> 0 ->> 'date' <> '2026-08-26' or j -> 'records' -> 14 ->> 'date' <> '2026-08-12'
     or (j -> 'records' -> 0) ? 'unit_rate_usd' then
    raise exception 'growth read: %', j;
  end if;

  -- Enterprise: served from the saved copy, 25, no claim.
  perform set_config('request.jwt.claim.sub', ent::text, true);
  j := public.volza_reveal_begin('ci-0141-a');
  if j ->> 'status' <> 'ready' or jsonb_array_length(j -> 'reveal' -> 'records') <> 25 then
    raise exception 'enterprise click: %', j;
  end if;
  reset role;
  if exists (select 1 from public.volza_shipment_reveals where claim_id is not null) then raise exception 'a claim was left'; end if;
  select count(*) into n from public.volza_reveal_uses where supplier_id = a and user_id in (growth, ent);
  if n <> 2 then raise exception 'uses for a: %', n; end if;
  select count(*) into n from public.activity_ledger where kind = 'shipments.revealed' and supplier_id = a;
  if n <> 2 then raise exception 'ledger entries for a: %', n; end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', growth::text, true);
  j := public.shipment_reveal_allowance();
  if (j ->> 'limit')::int <> 30 or (j ->> 'used')::int <> 1 or (j ->> 'shown')::int <> 15 then raise exception 'allowance: %', j; end if;
  perform set_config('request.jwt.claim.sub', starter::text, true);
  if public.shipment_reveal_allowance() is not null then raise exception 'starter has an allowance'; end if;
  reset role;

  -- Allowance used up: no claim for a new supplier, the one already opened still serves.
  update public.volza_reveal_settings set growth_per_month = 1;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', growth::text, true);
  j := public.volza_reveal_begin('ci-0141-b');
  if j ->> 'status' <> 'allowance_used' or (j ->> 'limit')::int <> 1 then raise exception 'allowance: %', j; end if;
  if public.volza_reveal_begin('ci-0141-a') ->> 'status' <> 'ready' then raise exception 'reopening used allowance'; end if;
  reset role;
  update public.volza_reveal_settings set growth_per_month = 30;

  -- Off switch and budget: no claim; an older saved copy still serves.
  update public.volza_shipment_reveals
     set fetched_at = now() - interval '40 days', expires_at = now() + interval '300 days' where supplier_id = a;
  update public.volza_reveal_settings set live = false;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', ent::text, true);
  if public.volza_reveal_begin('ci-0141-b') ->> 'status' <> 'paused' then raise exception 'off switch did not stop b'; end if;
  if public.volza_reveal_begin('ci-0141-a') ->> 'status' <> 'ready' then raise exception 'off switch hid the saved copy'; end if;
  reset role;
  update public.volza_reveal_settings set live = true, monthly_cap_usd = 2;
  set local role authenticated;
  if public.volza_reveal_begin('ci-0141-b') ->> 'status' <> 'budget' then raise exception 'cap did not stop b'; end if;
  reset role;
  update public.volza_reveal_settings set monthly_cap_usd = 100, credit_remaining_usd = 50;
  set local role authenticated;
  if public.volza_reveal_begin('ci-0141-b') ->> 'status' <> 'paused' then raise exception 'credit floor did not stop b'; end if;
  reset role;
  update public.volza_reveal_settings set credit_remaining_usd = 2900;

  -- A failed fetch: nothing saved, no allowance, a possible charge logged.
  set local role authenticated;
  j := public.volza_reveal_begin('ci-0141-b');
  if j ->> 'status' <> 'fetch' then raise exception 'b: %', j; end if;
  reset role;
  set local role service_role;
  perform public.volza_reveal_abort((j ->> 'claim')::uuid, 1.35);
  reset role;
  if exists (select 1 from public.volza_shipment_reveals where supplier_id = b)
     or exists (select 1 from public.volza_reveal_uses where supplier_id = b)
     or (select spent_usd from public.volza_reveal_settings) <> 2.70 then
    raise exception 'abort left something behind';
  end if;

  -- Zero records are saved too, and served as an empty list.
  set local role authenticated;
  j := public.volza_reveal_begin('ci-0141-b');
  reset role;
  set local role service_role;
  perform public.volza_reveal_finish((j ->> 'claim')::uuid, '[]'::jsonb, 0.10, null);
  reset role;
  set local role authenticated;
  j := public.supplier_shipment_reveal('ci-0141-b');
  if j is null or jsonb_array_length(j -> 'records') <> 0 then raise exception 'empty fetch: %', j; end if;

  -- Expired: deleted, not served (an admin reads without a use).
  perform set_config('request.jwt.claim.sub', admin::text, true);
  reset role;
  update public.volza_shipment_reveals
     set fetched_at = now() - interval '13 months',
         expires_at = now() - interval '13 months' + interval '1 year' where supplier_id = a;
  set local role authenticated;
  if public.supplier_shipment_reveal('ci-0141-a') is not null then raise exception 'an expired copy was served'; end if;
  reset role;
  if exists (select 1 from public.volza_shipment_reveals where supplier_id = a) then raise exception 'expired row kept'; end if;

  -- The route's bucket.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', growth::text, true);
  if (public.rl_check('api_reveal', 'ci-0141', 10) ->> 'ok')::boolean is not true then raise exception 'api_reveal refused'; end if;
  reset role;
end
$$;

rollback;
