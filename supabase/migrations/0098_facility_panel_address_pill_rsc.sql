-- 0098 REZ-109 — facility address / registry pills / RSC on mother Facilities panel.
-- Static SQL. Numbered like 0095–0097. search_path fixed.
-- Relaxes _direct views so unpublished facility_of children are readable to
-- SECURITY DEFINER RPCs only (SELECT remains revoked from anon/authenticated).
-- Inheritance donors must be published so facilities never donate addresses.
-- Does NOT rewrite buyer_supplier_profile; panel RPC stays the arithmetic home.

-- 1. Addresses (direct): published OR attached facility
create or replace view public.v_supplier_addresses_direct as
with src as (
  select sr.supplier_id,
         s.code           as source_code,
         s.tier           as source_tier,
         sr.source_ref,
         sr.fields,
         sr.fetched_at,
         sr.status
  from public.source_records sr
  join public.sources s on s.id = sr.source_id
  join public.suppliers sup on sup.id = sr.supplier_id
   and (sup.is_published = true or sup.facility_of is not null)
  where sr.status = 'active'
)
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text as address_kind,
       fields->>'factory_address' as address,
       null::text as phone,
       null::text as email,
       fetched_at
  from src
 where source_code = 'BGMEA'
   and coalesce(nullif(fields->>'factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'mailing'::text, fields->>'mailing_address', null::text, null::text, fetched_at
  from src
 where source_code = 'BGMEA'
   and coalesce(nullif(fields->>'mailing_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'registered'::text, fields->>'raw_address', null::text, null::text, fetched_at
  from src
 where source_code = 'BGMEA'
   and coalesce(nullif(fields->>'raw_address',''),'') <> ''
   and coalesce(nullif(fields->>'factory_address',''),'') = ''
   and coalesce(nullif(fields->>'mailing_address',''),'') = ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text, fields->>'bkmea_factory_address', null::text, null::text, fetched_at
  from src
 where source_code = 'BKMEA'
   and coalesce(nullif(fields->>'bkmea_factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'mailing'::text, fields->>'bkmea_mailing_address', null::text, null::text, fetched_at
  from src
 where source_code = 'BKMEA'
   and coalesce(nullif(fields->>'bkmea_mailing_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text,
       coalesce(fields->>'rsc_factory_address', fields->>'address', fields->>'raw_address'),
       null::text, null::text, fetched_at
  from src
 where source_code = 'RSC'
   and coalesce(
         nullif(fields->>'rsc_factory_address',''),
         nullif(fields->>'address',''),
         nullif(fields->>'raw_address','')
       ) is not null
union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text, fields->>'factory_address', null::text, null::text, fetched_at
  from src
 where source_code = 'BTMA'
   and coalesce(nullif(fields->>'factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'mailing'::text, fields->>'mailing_address', null::text, null::text, fetched_at
  from src
 where source_code = 'BTMA'
   and coalesce(nullif(fields->>'mailing_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text, fields->>'bgapmea_factory_address', null::text, null::text, fetched_at
  from src
 where source_code = 'BGAPMEA'
   and coalesce(nullif(fields->>'bgapmea_factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'registered'::text, fields->>'bgapmea_company_address', null::text, null::text, fetched_at
  from src
 where source_code = 'BGAPMEA'
   and coalesce(nullif(fields->>'bgapmea_company_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text, fields->>'epb_factory_address', null::text, null::text, fetched_at
  from src
 where source_code = 'EPB'
   and coalesce(nullif(fields->>'epb_factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'registered'::text, fields->>'epb_office_address', null::text, null::text, fetched_at
  from src
 where source_code = 'EPB'
   and coalesce(nullif(fields->>'epb_office_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text, fields->>'oeko_profile_address', null::text, null::text, fetched_at
  from src
 where source_code = 'OEKO_TEX'
   and coalesce(nullif(fields->>'oeko_profile_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'registered'::text,
       coalesce(fields->>'address', fields->>'raw_address'),
       null::text, null::text, fetched_at
  from src
 where source_code in ('BTMA','BGAPMEA')
   and coalesce(nullif(fields->>'address',''), nullif(fields->>'raw_address','')) is not null
   and coalesce(nullif(fields->>'factory_address',''),'') = ''
   and coalesce(nullif(fields->>'mailing_address',''),'') = ''
   and coalesce(nullif(fields->>'bgapmea_factory_address',''),'') = ''
   and coalesce(nullif(fields->>'bgapmea_company_address',''),'') = ''
;

comment on view public.v_supplier_addresses_direct is
  'Verified addresses per supplier. REZ-17: phone/email always null. '
  'REZ-18: published suppliers. REZ-109: also attached facilities '
  '(facility_of not null) for mother Facilities panel via SECURITY DEFINER RPC.';

-- 1b. Inheritance: donors must be published (facilities never donate)
create or replace view public.v_supplier_addresses as
select * from public.v_supplier_addresses_direct
union all
select child.id as supplier_id,
       parent_addr.source_code,
       parent_addr.source_tier,
       (parent_addr.source_ref || '#inherited:' || parent.slug) as source_ref,
       (parent_addr.address_kind || '_inherited') as address_kind,
       parent_addr.address,
       null::text as phone,
       null::text as email,
       parent_addr.fetched_at
  from public.suppliers child
  join lateral (
        select public.rsc_extension_base_name(child.company_name) as base
       ) bn on true
  join public.suppliers parent
    on parent.id <> child.id
   and lower(parent.company_name) = lower(bn.base)
   and parent.is_published = true
  join public.v_supplier_addresses_direct parent_addr
    on parent_addr.supplier_id = parent.id
 where bn.base is not null
   and child.is_published = true
;

comment on view public.v_supplier_addresses is
  'Direct + RSC sibling inheritance. REZ-109: inheritance donors must be '
  'published — attached facilities are readable via _direct for the mother '
  'panel but never donate.';

-- 2. Registry pills (direct): published OR attached facility (REZ-98 BGMEA backed-only kept)
create or replace view public.v_supplier_registry_ids_direct as
select s.id as supplier_id,
       'BGMEA'::text as source_code,
       'BGMEA Reg #'::text as label,
       n.value as value,
       coalesce(s.bgmea_verified, false) as verified,
       'https://www.bgmea.com.bd/'::text as source_url
  from public.suppliers s
  cross join lateral unnest(s.bgmea_reg_numbers) as n(value)
 where (s.is_published = true or s.facility_of is not null)
   and array_length(s.bgmea_reg_numbers, 1) > 0
   and exists (
         select 1
           from public.source_records sr
           join public.sources src on src.id = sr.source_id and src.code = 'BGMEA'
          where sr.supplier_id = s.id
            and sr.status = 'active'
            and (
                  sr.source_ref = 'general:' || n.value
               or sr.fields->>'bgmea_reg_number' = n.value
            )
       )
union all
select s.id, 'BKMEA', 'BKMEA #',
       s.bkmea_reg_number,
       coalesce(s.bkmea_verified, false),
       'https://www.bkmea.com/'
  from public.suppliers s
 where (s.is_published = true or s.facility_of is not null)
   and s.bkmea_reg_number is not null
   and btrim(s.bkmea_reg_number) <> ''
union all
select rr.supplier_id, 'RSC', 'RSC ID',
       rr.rsc_factory_id,
       true,
       'https://www.rsc-bd.org/'
  from public.rsc_remediation rr
  join public.suppliers s
    on s.id = rr.supplier_id
   and (s.is_published = true or s.facility_of is not null)
 where rr.rsc_factory_id is not null
   and btrim(rr.rsc_factory_id) <> ''
union all
select sr.supplier_id, 'EPB', 'EPB Reg #',
       sr.fields->>'epb_reg_no',
       true,
       'https://epb.gov.bd/'
  from public.source_records sr
  join public.sources src on src.id = sr.source_id
  join public.suppliers s
    on s.id = sr.supplier_id
   and (s.is_published = true or s.facility_of is not null)
 where src.code = 'EPB'
   and sr.status = 'active'
   and sr.supplier_id is not null
   and sr.fields ? 'epb_reg_no'
   and btrim(sr.fields->>'epb_reg_no') <> ''
union all
select sr.supplier_id, 'BGAPMEA', 'BGAPMEA #',
       sr.fields->>'bgapmea_membership_no',
       true,
       'https://bgapmea.org/'
  from public.source_records sr
  join public.sources src on src.id = sr.source_id
  join public.suppliers s
    on s.id = sr.supplier_id
   and (s.is_published = true or s.facility_of is not null)
 where src.code = 'BGAPMEA'
   and sr.status = 'active'
   and sr.supplier_id is not null
   and sr.fields ? 'bgapmea_membership_no'
   and btrim(sr.fields->>'bgapmea_membership_no') <> ''
union all
select sr.supplier_id, 'BTMA', 'BTMA Member #SL',
       sr.fields->>'btma_sl_no',
       true,
       'https://btmadhaka.com/'
  from public.source_records sr
  join public.sources src on src.id = sr.source_id
  join public.suppliers s
    on s.id = sr.supplier_id
   and (s.is_published = true or s.facility_of is not null)
 where src.code = 'BTMA'
   and sr.status = 'active'
   and sr.supplier_id is not null
   and sr.fields ? 'btma_sl_no'
   and btrim(sr.fields->>'btma_sl_no') <> ''
union all
select c.supplier_id,
       upper(c.kind::text),
       upper(c.kind::text) || ' Cert #',
       c.certificate_no,
       true,
       c.document_url
  from public.certifications c
  join public.suppliers s
    on s.id = c.supplier_id
   and (s.is_published = true or s.facility_of is not null)
 where c.certificate_no is not null
   and btrim(c.certificate_no) <> ''
;

comment on view public.v_supplier_registry_ids_direct is
  'Registry/membership/certificate IDs. REZ-98 BGMEA backed-only. '
  'REZ-109: also attached facilities for mother Facilities panel.';

revoke select on public.v_supplier_registry_ids_direct from anon, authenticated;
revoke select on public.v_supplier_registry_ids from anon, authenticated;
revoke select on public.v_supplier_addresses_direct from anon, authenticated;
revoke select on public.v_supplier_addresses from anon, authenticated;

-- 3. Panel: per-building name + addresses + pills + RSC (group metrics unchanged)
create or replace function public.buyer_supplier_facility_panel(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  with m as (
    select id, employees_total, machines_sewing,
           production_capacity_pcs_day, production_capacity_dozen_yearly
      from public.suppliers
     where slug = p_slug and is_published and facility_of is null limit 1
  ),
  b as (
    select f.id, f.company_name, f.employees_total, f.machines_sewing,
           f.production_capacity_pcs_day, f.production_capacity_dozen_yearly
      from m join public.suppliers f on f.facility_of = m.id
  ),
  fac as (
    select b.company_name,
           coalesce((
             select jsonb_agg(jsonb_build_object(
               'kind', va.address_kind,
               'address', va.address,
               'source_code', va.source_code
             ) order by va.address_kind, va.source_code, va.address)
               from (
                 select distinct on (va.address_kind, va.address, va.source_code)
                        va.address_kind, va.address, va.source_code
                   from public.v_supplier_addresses_direct va
                  where va.supplier_id = b.id
                    and va.address is not null
                    and btrim(va.address) <> ''
                  order by va.address_kind, va.address, va.source_code
               ) va
           ), '[]'::jsonb) as addresses,
           coalesce((
             select jsonb_agg(jsonb_build_object(
               'source_code', p.source_code,
               'label', p.label,
               'value', p.value,
               'verified', p.verified,
               'source_url', p.source_url
             ) order by p.source_code, p.label)
               from public.v_supplier_registry_ids_direct p
              where p.supplier_id = b.id
           ), '[]'::jsonb) as pills,
           (
             select jsonb_build_object(
               'progress_pct', rr.progress_pct,
               'workers_count', rr.workers_count,
               'remediation_status', rr.remediation_status,
               'training_status', rr.training_status
             )
               from public.rsc_remediation rr
              where rr.supplier_id = b.id and rr.active is true
              order by rr.fetched_at desc nulls last
              limit 1
           ) as rsc
      from b
  )
  select case when not exists (select 1 from m) then null else jsonb_build_object(
    'facility_count', (select count(*)::int from b),
    'facilities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', fac.company_name,
        'addresses', fac.addresses,
        'pills', fac.pills,
        'rsc', fac.rsc
      ) order by fac.company_name) from fac), '[]'::jsonb),
    'group', jsonb_build_object(
      'employees_total', public._facility_group_metric(
        (select employees_total from m),
        (select coalesce(array_agg(employees_total), '{}') from b)),
      'machines_sewing', public._facility_group_metric(
        (select machines_sewing from m),
        (select coalesce(array_agg(machines_sewing), '{}') from b)),
      'production_capacity_pcs_day', public._facility_group_metric(
        (select production_capacity_pcs_day from m),
        (select coalesce(array_agg(production_capacity_pcs_day), '{}') from b)),
      'production_capacity_dozen_yearly', public._facility_group_metric(
        (select production_capacity_dozen_yearly from m),
        (select coalesce(array_agg(production_capacity_dozen_yearly), '{}') from b)))
  ) end;
$$;

revoke all on function public.buyer_supplier_facility_panel(text) from public;
grant execute on function public.buyer_supplier_facility_panel(text) to anon, authenticated;
