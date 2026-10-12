-- 0147 asserted by running it. supplier_export_rank: a signed-out caller, a Starter buyer and a suspended
-- Growth buyer get null; Growth, Enterprise and an admin get the whole percent of exporters on record
-- whose export value is below the supplier's (floored, the smallest is 0, the largest under 100); a
-- supplier with a 'likely' match, an expired record, no value, or that is unpublished gets null; and
-- with fewer than 20 exporters to compare everyone gets null. discover_export_cells: signed out, no row;
-- a Starter or suspended buyer gets has_records and neither a value nor a market; an entitled reader gets
-- the value and the markets it ships to as short codes, biggest share of value first, a market with no
-- shipments left out; a supplier with no exact, unexpired record (or unpublished) has no row; more than
-- 200 ids is refused. Neither function can be called by anon.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a147', 'admin-0147@example.invalid',   '{"role":"admin"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b147', 'growth-0147@example.invalid',  '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000c147', 'ent-0147@example.invalid',     '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000d147', 'starter-0147@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000e147', 'susp-0147@example.invalid',    '{"role":"buyer"}'::jsonb)
on conflict do nothing;

update public.profiles set plan_tier = 'growth' where id in ('00000000-0000-4000-8000-00000000b147', '00000000-0000-4000-8000-00000000e147');
update public.profiles set plan_tier = 'enterprise' where id = '00000000-0000-4000-8000-00000000c147';
update public.profiles set is_suspended = true where id = '00000000-0000-4000-8000-00000000e147';

-- 24 suppliers: 1 to 20 are published exporters with values 1,000 to 20,000; 21 is a 'likely' match, 22 has
-- an expired record, 23 has no value, 24 is unpublished.
insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned)
select ('00000000-0000-4000-8000-0000001470' || lpad(k::text, 2, '0'))::uuid, 'ci-0147-' || k, 'CI 0147 ' || k || ' Ltd', 'ci 0147 ' || k || ' ltd', 'Dhaka', 'Dhaka', false, false
  from generate_series(1, 24) k;

-- Published only once each holds a Tier 1 source (enforce_publish_tier). 24 stays unpublished.
insert into public.source_records (supplier_id, source_id, source_tier, source_ref)
select sp.id, s.id, s.tier, 'CI-0147-' || sp.slug from public.suppliers sp, public.sources s
 where sp.slug like 'ci-0147-%' and sp.slug <> 'ci-0147-24' and s.code = 'RSC';
update public.suppliers set is_published = true where slug like 'ci-0147-%' and slug <> 'ci-0147-24';

insert into public.volza_export_checks
  (supplier_id, name_searched, window_start, window_end, shipments, exporters_matched, match_class,
   volza_supplier_name, fob_usd, fetched_at, expires_at, markets)
select ('00000000-0000-4000-8000-0000001470' || lpad(k::text, 2, '0'))::uuid, 'CI 0147 ' || k, '2024-09-01', '2026-08-31', 40, 1,
       case when k = 21 then 'likely' else 'exact' end,
       'CI 0147 ' || k || ' Ltd',
       case when k = 23 then null else (k * 1000)::numeric end,
       case when k = 22 then now() - interval '30 days' else now() end,
       case when k = 22 then now() - interval '1 day' else now() + interval '300 days' end,
       -- Supplier 20 ships mostly to the US, then the EU, a little to Canada, and nothing to the UK.
       case when k = 20 then '{"EU": {"shipments": 10, "fob_usd": 6000, "buyers": 3, "top": null},
                               "United States": {"shipments": 25, "fob_usd": 12000, "buyers": 5, "top": null},
                               "United Kingdom": {"shipments": 0, "fob_usd": null, "buyers": null, "top": null},
                               "Canada": {"shipments": 5, "fob_usd": 2000, "buyers": 1, "top": null}}'::jsonb
            else null end
  from generate_series(1, 24) k;

do $$
declare
  admin   constant uuid := '00000000-0000-4000-8000-00000000a147';
  growth  constant uuid := '00000000-0000-4000-8000-00000000b147';
  ent     constant uuid := '00000000-0000-4000-8000-00000000c147';
  starter constant uuid := '00000000-0000-4000-8000-00000000d147';
  susp    constant uuid := '00000000-0000-4000-8000-00000000e147';
  ids     constant uuid[] := array(select ('00000000-0000-4000-8000-0000001470' || lpad(k::text, 2, '0'))::uuid from generate_series(1, 24) k);
  -- Whatever else the database holds is counted too, so the expected ranks are worked out the same way.
  n_all   bigint;
  n_below bigint;
  r       record;
  n       int;
begin
  if has_function_privilege('anon', 'public.supplier_export_rank(text)', 'execute')
     or has_function_privilege('anon', 'public.discover_export_cells(uuid[])', 'execute') then
    raise exception '0147 grants are too wide';
  end if;

  select count(*) into n_all
    from public.volza_export_checks v join public.suppliers s on s.id = v.supplier_id
   where s.is_published and v.match_class = 'exact' and v.expires_at > now() and v.fob_usd is not null;
  if n_all < 20 then raise exception 'guard: % exporters to compare', n_all; end if;
  -- Counted here, as the owner: a signed-in reader cannot read the table itself, only the two functions.
  select count(*) into n_below
    from public.volza_export_checks v join public.suppliers s on s.id = v.supplier_id
   where s.is_published and v.match_class = 'exact' and v.expires_at > now() and v.fob_usd < 20000;

  set local role authenticated;

  -- Nobody the licence leaves out gets a rank or a figure.
  perform set_config('request.jwt.claim.sub', '', true);
  if public.supplier_export_rank('ci-0147-20') is not null then raise exception 'signed out got a rank'; end if;
  if exists (select 1 from public.discover_export_cells(ids)) then raise exception 'signed out got cells'; end if;

  perform set_config('request.jwt.claim.sub', starter::text, true);
  if public.supplier_export_rank('ci-0147-20') is not null then raise exception 'starter got a rank'; end if;
  perform set_config('request.jwt.claim.sub', susp::text, true);
  if public.supplier_export_rank('ci-0147-20') is not null then raise exception 'suspended got a rank'; end if;

  -- A buyer the licence leaves out learns only that a record exists: 1 to 20 and 23, never a value or a market.
  for r in select * from public.discover_export_cells(ids) loop
    if r.has_records is not true or r.fob_usd is not null or r.markets is not null then
      raise exception 'a suspended buyer got a figure: %', r;
    end if;
  end loop;
  select count(*) into n from public.discover_export_cells(ids);
  if n <> 21 then raise exception 'suspended: % cells, expected 21 (1 to 20 and 23)', n; end if;
  perform set_config('request.jwt.claim.sub', starter::text, true);
  if exists (select 1 from public.discover_export_cells(ids) where fob_usd is not null or markets is not null)
     or (select count(*) from public.discover_export_cells(ids)) <> 21 then
    raise exception 'starter cells are wrong';
  end if;

  -- The entitled: the rank is the floored share of exporters below, for Growth, Enterprise and an admin alike.
  perform set_config('request.jwt.claim.sub', growth::text, true);
  if public.supplier_export_rank('ci-0147-20') is distinct from floor(100.0 * n_below / n_all)::int then
    raise exception 'rank of the largest: % (below %, all %)', public.supplier_export_rank('ci-0147-20'), n_below, n_all;
  end if;
  if public.supplier_export_rank('ci-0147-20') >= 100 then raise exception 'a rank of 100: nothing is bigger than itself'; end if;
  if public.supplier_export_rank('ci-0147-2') >= public.supplier_export_rank('ci-0147-19') then raise exception 'a smaller exporter outranks a larger one'; end if;
  perform set_config('request.jwt.claim.sub', ent::text, true);
  if public.supplier_export_rank('ci-0147-20') is distinct from floor(100.0 * n_below / n_all)::int then raise exception 'enterprise rank differs'; end if;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  if public.supplier_export_rank('ci-0147-20') is distinct from floor(100.0 * n_below / n_all)::int then raise exception 'admin rank differs'; end if;

  -- No rank for a match a person has not confirmed, an expired record, a record with no value, an unpublished or unknown supplier.
  if public.supplier_export_rank('ci-0147-21') is not null or public.supplier_export_rank('ci-0147-22') is not null
     or public.supplier_export_rank('ci-0147-23') is not null or public.supplier_export_rank('ci-0147-24') is not null
     or public.supplier_export_rank('ci-0147-nobody') is not null then
    raise exception 'a rank where there is nothing to rank';
  end if;

  -- The cells for an entitled reader: the value, and the markets by short code, biggest share of value first.
  select * into r from public.discover_export_cells(ids) where supplier_id = '00000000-0000-4000-8000-000000147020';
  if r.has_records is not true or r.fob_usd <> 20000 or r.markets is distinct from array['US', 'EU', 'CA'] then
    raise exception 'cell of supplier 20: %', r;
  end if;
  -- A supplier with no market split has a value and no markets; one with no value keeps its row.
  select * into r from public.discover_export_cells(ids) where supplier_id = '00000000-0000-4000-8000-000000147001';
  if r.fob_usd <> 1000 or r.markets is not null then raise exception 'cell of supplier 1: %', r; end if;
  select * into r from public.discover_export_cells(ids) where supplier_id = '00000000-0000-4000-8000-000000147023';
  if r.has_records is not true or r.fob_usd is not null then raise exception 'cell of supplier 23: %', r; end if;
  -- No row for a 'likely' match, an expired record or an unpublished supplier; none for an empty or null list.
  if exists (select 1 from public.discover_export_cells(ids) where supplier_id in
       ('00000000-0000-4000-8000-000000147021', '00000000-0000-4000-8000-000000147022', '00000000-0000-4000-8000-000000147024')) then
    raise exception 'a cell for a record nobody may see';
  end if;
  if exists (select 1 from public.discover_export_cells('{}'::uuid[])) or exists (select 1 from public.discover_export_cells(null)) then
    raise exception 'cells for no suppliers';
  end if;

  -- A page is 100 suppliers at most: more than 200 ids is refused.
  begin
    perform public.discover_export_cells(array(select gen_random_uuid() from generate_series(1, 201)));
    raise exception 'more than 200 ids were accepted';
  exception when sqlstate '22023' then null;
  end;

  reset role;

  -- With fewer than 20 exporters to compare, nobody gets a rank.
  delete from public.volza_export_checks v
   where v.supplier_id not in (select ('00000000-0000-4000-8000-0000001470' || lpad(k::text, 2, '0'))::uuid from generate_series(1, 19) k);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  if public.supplier_export_rank('ci-0147-19') is not null then raise exception 'a rank among fewer than 20 exporters'; end if;
  reset role;
end $$;

rollback;
