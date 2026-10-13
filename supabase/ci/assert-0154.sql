-- 0154 asserted by running it: buyer_supplier_profile() carries `membership_status`, every BTMA entry on the
-- company or one of its buildings that BTMA files with a status, lower-cased and trimmed, with the list
-- number, the day it was read and a building's name; a BTMA entry with no status, an entry retired on our
-- side and another body's entry are not in it; a company with none gets an empty list, never null; the
-- keys 0152 added are still there.
\set ON_ERROR_STOP on

begin;

insert into public.suppliers (slug, company_name, company_name_norm, city, district, is_published, is_sanctioned)
values
  ('ci-0154-mill',  'CI 0154 Spinning Mills Ltd', 'ci 0154 spinning mills ltd', 'Dhaka', 'Dhaka', false, false),
  ('ci-0154-shed',  'CI 0154 Unit 2',             'ci 0154 unit 2',             'Dhaka', 'Dhaka', false, false),
  ('ci-0154-plain', 'CI 0154 Plain Mills Ltd',    'ci 0154 plain mills ltd',    'Dhaka', 'Dhaka', false, false);

update public.suppliers set facility_of = (select id from public.suppliers where slug = 'ci-0154-mill')
 where slug = 'ci-0154-shed';

insert into public.source_records (supplier_id, source_id, source_tier, source_ref, fields, fetched_at, status)
select sp.id, s.id, s.tier, v.ref, v.fields::jsonb, '2026-05-21T00:00:00+00'::timestamptz, v.status::public.evidence_status
  from (values
    -- Published only with a Tier 1 source (enforce_publish_tier).
    ('ci-0154-mill',  'RSC',   'CI-0154-R1', '{"rsc_status_name": "active"}',                                'active'),
    ('ci-0154-plain', 'RSC',   'CI-0154-R2', '{"rsc_status_name": "active"}',                                'active'),
    ('ci-0154-mill',  'BTMA',  'CI-0154-A',  '{"btma_status": " Suspended ", "btma_sl_no": "52"}',           'active'),
    ('ci-0154-mill',  'BTMA',  'CI-0154-B',  '{"btma_status": "suspended", "btma_sl_no": "53"}',             'superseded'),
    ('ci-0154-shed',  'BTMA',  'CI-0154-C',  '{"btma_status": "suspended", "btma_sl_no": "60"}',             'active'),
    ('ci-0154-plain', 'BTMA',  'CI-0154-D',  '{"btma_sl_no": "70"}',                                         'active'),
    ('ci-0154-plain', 'BGMEA', 'CI-0154-E',  '{"btma_status": "suspended", "btma_sl_no": "71"}',             'active')
  ) v(slug, code, ref, fields, status)
  join public.suppliers sp on sp.slug = v.slug
  join public.sources s on s.code = v.code;

update public.suppliers set is_published = true where slug in ('ci-0154-mill', 'ci-0154-plain');

do $$
declare
  got   jsonb;
  plain jsonb;
begin
  got := public.buyer_supplier_profile('ci-0154-mill');
  if got is null then raise exception 'no profile for the published mill'; end if;
  if jsonb_typeof(got -> 'membership_status') is distinct from 'array' or jsonb_array_length(got -> 'membership_status') <> 2 then
    raise exception 'expected the mill''s entry and its building''s, got %', got -> 'membership_status';
  end if;
  -- The company's own entry first: the body, its word lower-cased and trimmed, the list number, the read day.
  if got -> 'membership_status' -> 0 ->> 'source_code' <> 'BTMA'
     or got -> 'membership_status' -> 0 ->> 'status' <> 'suspended'
     or got -> 'membership_status' -> 0 ->> 'value' <> '52'
     or (got -> 'membership_status' -> 0) ? 'building_name'
     or (got -> 'membership_status' -> 0 ->> 'fetched_at')::timestamptz <> '2026-05-21T00:00:00+00'::timestamptz then
    raise exception 'the company''s own entry is wrong: %', got -> 'membership_status' -> 0;
  end if;
  if got -> 'membership_status' -> 1 ->> 'value' <> '60'
     or got -> 'membership_status' -> 1 ->> 'building_name' <> 'CI 0154 Unit 2' then
    raise exception 'the building''s entry is wrong: %', got -> 'membership_status' -> 1;
  end if;
  -- 0152's key and the old ones are still there.
  if not (got ?& array['supplier', 'pills', 'certifications', 'rsc_remediation', 'rsc_listed', 'provenance', 'addresses', 'sanctions', 'brand_attributions']) then
    raise exception 'a key of the earlier payload is gone';
  end if;
  if got -> 'rsc_listed' is distinct from '[]'::jsonb then
    raise exception 'rsc_listed changed: %', got -> 'rsc_listed';
  end if;

  -- A BTMA entry with no status, and another body's entry carrying the field, say nothing.
  plain := public.buyer_supplier_profile('ci-0154-plain');
  if plain -> 'membership_status' is distinct from '[]'::jsonb then
    raise exception 'a plain member got %', plain -> 'membership_status';
  end if;
end
$$;

rollback;
