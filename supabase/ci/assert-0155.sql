-- 0155 asserted by running it: a BTMA entry filed under suspension stays in v_supplier_registry_ids_direct
-- (the record lists it) but is not verified, and discover_v32_registries() no longer reads it as a
-- membership; a plain BTMA entry, and a mill holding both kinds, still count. The registry filter and the
-- match reason read the same flag.
\set ON_ERROR_STOP on

begin;

insert into public.suppliers (slug, company_name, company_name_norm, city, district, is_published, is_sanctioned)
values
  ('ci-0155-suspended', 'CI 0155 Suspended Mills Ltd', 'ci 0155 suspended mills ltd', 'Dhaka', 'Dhaka', false, false),
  ('ci-0155-member',    'CI 0155 Member Mills Ltd',    'ci 0155 member mills ltd',    'Dhaka', 'Dhaka', false, false),
  ('ci-0155-both',      'CI 0155 Both Mills Ltd',      'ci 0155 both mills ltd',      'Dhaka', 'Dhaka', false, false);

insert into public.source_records (supplier_id, source_id, source_tier, source_ref, fields, fetched_at, status)
select sp.id, s.id, s.tier, v.ref, v.fields::jsonb, '2026-10-07T00:00:00+00'::timestamptz, 'active'::public.evidence_status
  from (values
    -- Published only with a Tier 1 source (enforce_publish_tier).
    ('ci-0155-suspended', 'RSC',  'CI-0155-R1', '{"rsc_status_name": "active"}'),
    ('ci-0155-member',    'RSC',  'CI-0155-R2', '{"rsc_status_name": "active"}'),
    ('ci-0155-both',      'RSC',  'CI-0155-R3', '{"rsc_status_name": "active"}'),
    ('ci-0155-suspended', 'BTMA', 'CI-0155-A',  '{"btma_status": " Suspended ", "btma_sl_no": "52"}'),
    ('ci-0155-member',    'BTMA', 'CI-0155-B',  '{"btma_sl_no": "10"}'),
    ('ci-0155-both',      'BTMA', 'CI-0155-C',  '{"btma_status": "suspended", "btma_sl_no": "59"}'),
    ('ci-0155-both',      'BTMA', 'CI-0155-D',  '{"btma_sl_no": "61"}')
  ) v(slug, code, ref, fields)
  join public.suppliers sp on sp.slug = v.slug
  join public.sources s on s.code = v.code;

update public.suppliers set is_published = true where slug like 'ci-0155-%';

do $$
declare
  susp uuid := (select id from public.suppliers where slug = 'ci-0155-suspended');
  mem  uuid := (select id from public.suppliers where slug = 'ci-0155-member');
  pair uuid := (select id from public.suppliers where slug = 'ci-0155-both');
  fn   text;
begin
  -- The entry is still listed, with its number, but not verified.
  if (select array_agg(verified) from public.v_supplier_registry_ids_direct where supplier_id = susp and source_code = 'BTMA')
     is distinct from array[false] then
    raise exception 'the suspended entry should be listed once, unverified';
  end if;
  if (select array_agg(verified) from public.v_supplier_registry_ids_direct where supplier_id = mem and source_code = 'BTMA')
     is distinct from array[true] then
    raise exception 'a plain member should be listed once, verified';
  end if;

  -- The card's register tile.
  if 'BTMA' = any (public.discover_v32_registries(susp)) then
    raise exception 'a suspended entry still reads as a BTMA membership: %', public.discover_v32_registries(susp);
  end if;
  if not 'BTMA' = any (public.discover_v32_registries(mem)) then
    raise exception 'a plain member lost its BTMA tile';
  end if;
  if not 'BTMA' = any (public.discover_v32_registries(pair)) then
    raise exception 'a mill with a plain entry beside a suspended one lost its BTMA tile';
  end if;

  -- The registry filter, run: the suspended mill is out, the plain member and the mill holding both are in.
  if exists (select 1 from public.discover_suppliers(p_registries => array['BTMA'], p_limit => 1000) d where d.slug = 'ci-0155-suspended') then
    raise exception 'the BTMA filter still returns a mill whose only entry is suspended';
  end if;
  if (select count(*) from public.discover_suppliers(p_registries => array['BTMA'], p_limit => 1000) d
       where d.slug in ('ci-0155-member', 'ci-0155-both')) <> 2 then
    raise exception 'the BTMA filter lost a member';
  end if;

  -- The match reason reads the same flag.
  foreach fn in array array['buyer_smart_match'] loop
    if position('and vp.verified' in pg_get_functiondef(('public.' || fn)::regproc)) = 0 then
      raise exception '% counts a membership without reading verified', fn;
    end if;
  end loop;
end
$$;

rollback;
