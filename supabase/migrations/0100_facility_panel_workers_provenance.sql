-- 0100 REZ-114 — expose RSC fetched_at + facility employees_total for honest
-- worker selection (presentation). Static SQL. search_path fixed.
-- Does not change stored suppliers.employees_total.

-- 1) Facility panel: per-building employees_total + rsc.fetched_at
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
           b.employees_total,
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
               'fetched_at', rr.fetched_at,
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
        'employees_total', fac.employees_total,
        'addresses', fac.addresses,
        'pills', fac.pills,
        'rsc', fac.rsc
      ) order by fac.company_name) from fac), '[]'::jsonb),
    'group', jsonb_build_object(
      -- employees_total group remains declared-column sum for backward compat;
      -- UI must use lib/profile-metrics (RSC authority) for worker headlines.
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


-- 2) Profile RSC payload: include fetched_at for provenance labels
create or replace function public.buyer_supplier_profile(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select *
      from public.suppliers
     where slug = p_slug
       and is_published = true
     limit 1
  ),
  ring as (
    select coalesce(count(distinct sr.source_id), 0)::int as t13
      from s
      join public.source_records sr on sr.supplier_id = s.id
     where sr.status      = 'active'
       and sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert')
  ),
  pills as (
    -- REZ-110 DISPLAY-ONLY: union facility registry pills labelled by
    -- building. Discover/t13 stay on mother id alone (see containment tests).
    select coalesce(
      jsonb_agg(
        (
          jsonb_build_object(
            'source_code',         p.source_code,
            'label',               p.label,
            'value',               p.value,
            'verified',            p.verified,
            'source_url',          p.source_url,
            'inherited_from',      p.inherited_from,
            'inherited_from_name', p.inherited_from_name
          )
          || case
               when p.building_name is not null
               then jsonb_build_object('building_name', p.building_name)
               else '{}'::jsonb
             end
        )
        order by (p.building_name is not null), p.building_name nulls first,
                 (p.inherited_from is not null), p.source_code, p.value nulls last
      ),
      '[]'::jsonb
    ) as items
    from (
      select p.source_code,
             p.label,
             p.value,
             p.verified,
             p.source_url,
             p.inherited_from,
             p.inherited_from_name,
             null::text as building_name
        from s
        join public.v_supplier_registry_ids p on p.supplier_id = s.id
      union all
      select p.source_code,
             p.label,
             p.value,
             p.verified,
             p.source_url,
             null::uuid as inherited_from,
             null::text as inherited_from_name,
             f.company_name as building_name
        from s
        join public.suppliers f
          on f.facility_of = s.id
        join public.v_supplier_registry_ids_direct p
          on p.supplier_id = f.id
    ) p
  ),
  certs as (
    -- REZ-93: union parent + facility_of children; label inherited rows;
    -- DISTINCT ON (id) collapses the same certifications row twice.
    -- DISPLAY-ONLY — discover_suppliers stays on s.id alone.
    select coalesce(
      jsonb_agg(
        (
          jsonb_build_object(
            'kind',           c.kind,
            'certificate_no', c.certificate_no,
            'issuer',         c.issuer,
            'issued_on',      c.issued_on,
            'expires_on',     c.expires_on,
            'scope',          c.scope,
            'document_url',   c.document_url
          )
          || case
               when c.building_name is not null
               then jsonb_build_object('building_name', c.building_name)
               else '{}'::jsonb
             end
        )
        order by (c.building_name is not null), c.building_name nulls first,
                 c.kind, c.expires_on desc nulls last
      ),
      '[]'::jsonb
    ) as items
    from (
      select distinct on (owned.id)
             owned.id,
             owned.kind,
             owned.certificate_no,
             owned.issuer,
             owned.issued_on,
             owned.expires_on,
             owned.scope,
             owned.document_url,
             owned.building_name
        from (
          select c.id,
                 c.kind::text as kind,
                 c.certificate_no,
                 c.issuer,
                 c.issued_on,
                 c.expires_on,
                 c.scope,
                 c.document_url,
                 null::text as building_name
            from s
            join public.certifications c on c.supplier_id = s.id
          union all
          select c.id,
                 c.kind::text as kind,
                 c.certificate_no,
                 c.issuer,
                 c.issued_on,
                 c.expires_on,
                 c.scope,
                 c.document_url,
                 f.company_name as building_name
            from s
            join public.suppliers f
              on f.facility_of = s.id
            join public.certifications c
              on c.supplier_id = f.id
        ) owned
       order by owned.id, owned.building_name nulls last
    ) c
  ),
  rsc as (
    -- REZ-110: array of mother + facility active RSC rows; building_name on
    -- facility sites only. DISPLAY-ONLY on Compliance.
    select coalesce(
      jsonb_agg(
        (
          jsonb_build_object(
            'progress_pct',                rr.progress_pct,
            'workers_count',               rr.workers_count,
            'fetched_at',                  rr.fetched_at,
            'remediation_status',          rr.remediation_status,
            'training_status',             rr.training_status,
            'parent_group_name',           rr.parent_group_name,
            'parent_group_factory_count',  rr.parent_group_factory_count,
            'fire_inspection_url',         rr.fire_inspection_url,
            'structural_inspection_url',   rr.structural_inspection_url,
            'electrical_inspection_url',   rr.electrical_inspection_url,
            'boiler_inspection_url',       rr.boiler_inspection_url,
            'cap_url',                     rr.cap_url
          )
          || case
               when rr.building_name is not null
               then jsonb_build_object('building_name', rr.building_name)
               else '{}'::jsonb
             end
        )
        order by (rr.building_name is not null), rr.building_name nulls first
      ),
      '[]'::jsonb
    ) as items
    from (
      select rr.progress_pct,
             rr.workers_count,
             rr.fetched_at,
             rr.remediation_status,
             rr.training_status,
             rr.parent_group_name,
             rr.parent_group_factory_count,
             rr.fire_inspection_url,
             rr.structural_inspection_url,
             rr.electrical_inspection_url,
             rr.boiler_inspection_url,
             rr.cap_url,
             null::text as building_name
        from s
        join public.rsc_remediation rr
          on rr.supplier_id = s.id and rr.active = true
      union all
      select rr.progress_pct,
             rr.workers_count,
             rr.fetched_at,
             rr.remediation_status,
             rr.training_status,
             rr.parent_group_name,
             rr.parent_group_factory_count,
             rr.fire_inspection_url,
             rr.structural_inspection_url,
             rr.electrical_inspection_url,
             rr.boiler_inspection_url,
             rr.cap_url,
             f.company_name as building_name
        from s
        join public.suppliers f
          on f.facility_of = s.id
        join public.rsc_remediation rr
          on rr.supplier_id = f.id and rr.active = true
    ) rr
  ),
  brands as (
    -- REZ-110 DISPLAY-ONLY: facility BRAND_* labelled by building.
    select coalesce(
      jsonb_agg(
        (
          jsonb_build_object(
            'source_code',  b.source_code,
            'display_name', b.display_name,
            'source_url',   b.source_url,
            'last_seen_at', b.last_seen_at
          )
          || case
               when b.building_name is not null
               then jsonb_build_object('building_name', b.building_name)
               else '{}'::jsonb
             end
        )
        order by (b.building_name is not null), b.building_name nulls first,
                 b.source_code
      ),
      '[]'::jsonb
    ) as items
    from (
      select src.code as source_code,
             src.display_name,
             coalesce(nullif(sr.fields->>'source_url', ''), src.base_url) as source_url,
             sr.fetched_at as last_seen_at,
             null::text as building_name
        from s
        join public.source_records sr on sr.supplier_id = s.id and sr.status = 'active'
        join public.sources src        on src.id = sr.source_id
       where src.code like 'BRAND\_%' escape '\'
      union all
      select src.code as source_code,
             src.display_name,
             coalesce(nullif(sr.fields->>'source_url', ''), src.base_url) as source_url,
             sr.fetched_at as last_seen_at,
             f.company_name as building_name
        from s
        join public.suppliers f
          on f.facility_of = s.id
        join public.source_records sr on sr.supplier_id = f.id and sr.status = 'active'
        join public.sources src        on src.id = sr.source_id
       where src.code like 'BRAND\_%' escape '\'
    ) b
  ),
  sanc as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'list',           ss.list::text,
          'matched_name',   ss.matched_name,
          'list_entry_ref', ss.list_entry_ref,
          'screened_at',    ss.screened_at,
          'source_url',     sle.source_url,
          'listed_date',    sle.listed_date
        )
        order by ss.screened_at desc
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.sanctions_screening ss on ss.supplier_id = s.id and ss.active = true
    left join public.sanctions_list_entries sle
      on sle.list = ss.list and sle.entry_ref = ss.list_entry_ref
  ),
  provenance as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'source_code',  src.code,
          'display_name', src.display_name,
          'tier',         sr.source_tier::text,
          'source_ref',   sr.source_ref,
          'source_url',   coalesce(nullif(sr.fields->>'source_url', ''), src.base_url),
          'last_seen_at', sr.fetched_at
        )
        order by sr.source_tier::text, src.code, sr.fetched_at desc
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.source_records sr on sr.supplier_id = s.id and sr.status = 'active'
    join public.sources src        on src.id = sr.source_id
  ),
  addresses as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'kind',         va.address_kind,
          'address',      va.address,
          'source_code',  va.source_code,
          'fetched_at',   va.fetched_at
        )
        order by va.address_kind, va.source_code
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.v_supplier_addresses va on va.supplier_id = s.id
  ),
  docs as (
    select coalesce(
      jsonb_agg(
        (
          jsonb_build_object(
            'doc_type',     d.doc_type,
            'mirror_url',   d.mirror_url,
            'original_url', d.original_url,
            'fetched_at',   d.fetched_at,
            'file_size',    d.file_size
          )
          || case
               when d.building_name is not null
               then jsonb_build_object('building_name', d.building_name)
               else '{}'::jsonb
             end
        )
        order by (d.building_name is not null), d.building_name nulls first,
                 d.doc_type, d.fetched_at desc
      ),
      '[]'::jsonb
    ) as items
    from (
      select distinct on (owned.id)
             owned.id,
             owned.doc_type,
             owned.mirror_url,
             owned.original_url,
             owned.fetched_at,
             owned.file_size,
             owned.building_name
        from (
          select cd.id,
                 cd.doc_type,
                 cd.mirror_url,
                 cd.original_url,
                 cd.fetched_at,
                 cd.file_size,
                 null::text as building_name
            from s
            join public.compliance_documents cd on cd.supplier_id = s.id
          union all
          select cd.id,
                 cd.doc_type,
                 cd.mirror_url,
                 cd.original_url,
                 cd.fetched_at,
                 cd.file_size,
                 f.company_name as building_name
            from s
            join public.suppliers f
              on f.facility_of = s.id
            join public.compliance_documents cd
              on cd.supplier_id = f.id
        ) owned
       order by owned.id, owned.building_name nulls last
    ) d
  ),
  partner_factories as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',           f.id,
          'slug',         f.slug,
          'company_name', f.company_name,
          'entity_type',  f.entity_type::text,
          'city',         f.city,
          'district',     f.district,
          'decided_at',   sr.decided_at
        )
        order by f.company_name
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.supplier_relationships sr
      on sr.buying_house_id = s.id and sr.status = 'accepted'
    join public.suppliers f
      on f.id = sr.factory_id
     and f.is_published = true
    where s.entity_type::text = 'buying_house'
  ),
  partner_buying_houses as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',           bh.id,
          'slug',         bh.slug,
          'company_name', bh.company_name,
          'entity_type',  bh.entity_type::text,
          'city',         bh.city,
          'district',     bh.district,
          'decided_at',   sr.decided_at
        )
        order by bh.company_name
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.supplier_relationships sr
      on sr.factory_id = s.id and sr.status = 'accepted'
    join public.suppliers bh
      on bh.id = sr.buying_house_id
     and bh.is_published = true
    where s.entity_type::text = 'factory'
  )
  select jsonb_build_object(
    'supplier', jsonb_build_object(
      'id',                              s.id,
      'slug',                            s.slug,
      'company_name',                    s.company_name,
      'entity_type',                     s.entity_type::text,
      'city',                            s.city,
      'district',                        s.district,
      'country',                         s.country,
      'address_raw',                     s.address_raw,
      'completeness_pct',                s.completeness_pct,
      'is_sanctioned',                   s.is_sanctioned,
      'parent_group_name',               s.parent_group_name,
      'established_date',                s.established_date,
      'bepza_zone',                      s.bepza_zone,
      'factory_types',                   s.factory_types,
      'principal_products',              s.principal_products,
      'employees_total',                 s.employees_total,
      'employees_male',                  s.employees_male,
      'employees_female',                s.employees_female,
      'machines_sewing',                 s.machines_sewing,
      'production_capacity_pcs_day',     s.production_capacity_pcs_day,
      'production_capacity_dozen_yearly',s.production_capacity_dozen_yearly,
      'source_tags',                     s.source_tags,
      'supplier_tagline',                s.supplier_tagline,
      'supplier_about',                  s.supplier_about,
      'supplier_moq',                    s.supplier_moq,
      'supplier_lead_time_days',         s.supplier_lead_time_days,
      'supplier_capabilities',           coalesce(s.supplier_capabilities, '{}'::text[])
    ),
    't13_source_count',     (select t13   from ring),
    'pills',                (select items from pills),
    'certifications',       (select items from certs),
    'rsc_remediation',      nullif((select items from rsc), '[]'::jsonb),
    'brand_attributions',   (select items from brands),
    'sanctions',            (select items from sanc),
    'provenance',           (select items from provenance),
    'addresses',            (select items from addresses),
    'documents',            (select items from docs),
    'partner_factories',
      coalesce((select items from partner_factories), '[]'::jsonb),
    'partner_buying_houses',
      coalesce((select items from partner_buying_houses), '[]'::jsonb)
  )
  from s
$$;

revoke all on function public.buyer_supplier_profile(text) from public;
grant execute on function public.buyer_supplier_profile(text) to anon, authenticated;
