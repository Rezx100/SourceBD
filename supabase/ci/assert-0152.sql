-- 0152 asserted by running it: buyer_supplier_profile() carries `rsc_listed`, every RSC entry on the company
-- or one of its buildings whose register status is not "active", with the register's own word, the RSC
-- number, the day it was read and a building's name; an active entry, an entry with no status, an entry
-- that is not active on our side, and another register's entry are not in it; a company with nothing of
-- the kind gets an empty list, never null; `rsc_remediation` still holds the active rows only.
\set ON_ERROR_STOP on

begin;

insert into public.suppliers (slug, company_name, company_name_norm, city, district, is_published, is_sanctioned)
values
  ('ci-0152-mill',  'CI 0152 Mill Ltd',  'ci 0152 mill ltd',  'Dhaka', 'Dhaka', false, false),
  ('ci-0152-shed',  'CI 0152 Shed 2',    'ci 0152 shed 2',    'Dhaka', 'Dhaka', false, false),
  ('ci-0152-plain', 'CI 0152 Plain Ltd', 'ci 0152 plain ltd', 'Dhaka', 'Dhaka', false, false);

update public.suppliers set facility_of = (select id from public.suppliers where slug = 'ci-0152-mill')
 where slug = 'ci-0152-shed';

-- The mill: one Ineligible entry (padded, as the register sometimes files it), one active, one with no status,
-- one we have retired. Its shed: Pending Closure. The plain company: an active entry only.
insert into public.source_records (supplier_id, source_id, source_tier, source_ref, fields, fetched_at, status)
select sp.id, s.id, s.tier, v.ref, v.fields::jsonb, '2026-10-02T04:00:00+00'::timestamptz, v.status::public.evidence_status
  from (values
    ('ci-0152-mill',  'CI-0152-A', '{"rsc_status_name": " Ineligible "}', 'active'),
    ('ci-0152-mill',  'CI-0152-B', '{"rsc_status_name": "active"}',       'active'),
    ('ci-0152-mill',  'CI-0152-C', '{}',                                  'active'),
    ('ci-0152-mill',  'CI-0152-D', '{"rsc_status_name": "No brand"}',     'superseded'),
    ('ci-0152-shed',  'CI-0152-E', '{"rsc_status_name": "Pending Closure"}', 'active'),
    ('ci-0152-plain', 'CI-0152-F', '{"rsc_status_name": "Active"}',       'active')
  ) v(slug, ref, fields, status)
  join public.suppliers sp on sp.slug = v.slug
  join public.sources s on s.code = 'RSC';

-- Another register's entry carrying the same field name is not RSC's word.
insert into public.source_records (supplier_id, source_id, source_tier, source_ref, fields, status)
select sp.id, s.id, s.tier, 'CI-0152-G', '{"rsc_status_name": "Ineligible"}'::jsonb, 'active'
  from public.suppliers sp, public.sources s
 where sp.slug = 'ci-0152-plain' and s.code = 'BGMEA';

update public.suppliers set is_published = true where slug in ('ci-0152-mill', 'ci-0152-plain');

do $$
declare
  got   jsonb;
  plain jsonb;
begin
  got := public.buyer_supplier_profile('ci-0152-mill');
  if got is null then raise exception 'no profile for the published mill'; end if;
  if jsonb_typeof(got -> 'rsc_listed') is distinct from 'array' then
    raise exception 'rsc_listed is %', jsonb_typeof(got -> 'rsc_listed');
  end if;
  if jsonb_array_length(got -> 'rsc_listed') <> 2 then
    raise exception 'expected the Ineligible entry and the shed''s, got %', got -> 'rsc_listed';
  end if;
  -- The company's own entry first, in the register's word, trimmed; no building name on it.
  if got -> 'rsc_listed' -> 0 ->> 'status' <> 'Ineligible'
     or got -> 'rsc_listed' -> 0 ->> 'rsc_factory_id' <> 'CI-0152-A'
     or (got -> 'rsc_listed' -> 0) ? 'building_name'
     or (got -> 'rsc_listed' -> 0 ->> 'fetched_at')::timestamptz <> '2026-10-02T04:00:00+00'::timestamptz then
    raise exception 'the company''s own entry is wrong: %', got -> 'rsc_listed' -> 0;
  end if;
  if got -> 'rsc_listed' -> 1 ->> 'status' <> 'Pending Closure'
     or got -> 'rsc_listed' -> 1 ->> 'building_name' <> 'CI 0152 Shed 2' then
    raise exception 'the building''s entry is wrong: %', got -> 'rsc_listed' -> 1;
  end if;
  -- The rest of the payload is 0107's: the active safety rows only (none here), and the old keys present.
  if got -> 'rsc_remediation' is distinct from 'null'::jsonb then
    raise exception 'rsc_remediation changed: %', got -> 'rsc_remediation';
  end if;
  if not (got ?& array['supplier', 'pills', 'certifications', 'provenance', 'addresses', 'sanctions', 'brand_attributions']) then
    raise exception 'a key of the old payload is gone';
  end if;

  plain := public.buyer_supplier_profile('ci-0152-plain');
  if plain -> 'rsc_listed' is distinct from '[]'::jsonb then
    raise exception 'a company with only an active RSC entry got %', plain -> 'rsc_listed';
  end if;

  -- An unpublished company still answers nothing.
  if public.buyer_supplier_profile('ci-0152-shed') is not null then
    raise exception 'an unpublished building answered';
  end if;
end
$$;

rollback;
