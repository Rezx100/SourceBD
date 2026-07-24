-- 0079 — REZ-7 (P1): stop buyer_supplier_profile leaking contact PII to anon.
--
-- buyer_supplier_profile is `security definer` and granted to anon, so any
-- unauthenticated caller can invoke it directly (PostgREST /rpc). The
-- `addresses` block emitted registry-published `phone` and `email` for every
-- factory. The marketing route stripped those fields in the browser, but the
-- PII had already crossed the wire and a direct RPC call bypasses the UI
-- entirely. Hiding data in the client is never a security control.
--
-- Smallest safe fix: recreate the function IDENTICAL to its previous
-- definition (migration 0036) EXCEPT the `addresses` jsonb rows no longer
-- include the `phone` or `email` keys. No signature, grant, RLS, view, or
-- table changes. No other block is touched. Both consuming routes already
-- ignore those two fields, so nothing renders differently. The admin/paid
-- contact card is sourced separately (suppliers.email_primary/phones) and is
-- unaffected.
--
-- Reversible: restore buyer_supplier_profile from 0036 (re-adds the two keys).

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
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'source_code',         p.source_code,
          'label',               p.label,
          'value',               p.value,
          'verified',            p.verified,
          'source_url',          p.source_url,
          'inherited_from',      p.inherited_from,
          'inherited_from_name', p.inherited_from_name
        )
        order by (p.inherited_from is not null), p.source_code, p.value nulls last
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.v_supplier_registry_ids p on p.supplier_id = s.id
  ),
  certs as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'kind',           c.kind::text,
          'certificate_no', c.certificate_no,
          'issuer',         c.issuer,
          'issued_on',      c.issued_on,
          'expires_on',     c.expires_on,
          'scope',          c.scope,
          'document_url',   c.document_url
        )
        order by c.kind::text, c.expires_on desc nulls last
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.certifications c on c.supplier_id = s.id
  ),
  rsc as (
    select jsonb_build_object(
      'progress_pct',                rr.progress_pct,
      'workers_count',               rr.workers_count,
      'remediation_status',          rr.remediation_status,
      'training_status',             rr.training_status,
      'parent_group_name',           rr.parent_group_name,
      'parent_group_factory_count',  rr.parent_group_factory_count,
      'fire_inspection_url',         rr.fire_inspection_url,
      'structural_inspection_url',   rr.structural_inspection_url,
      'electrical_inspection_url',   rr.electrical_inspection_url,
      'boiler_inspection_url',       rr.boiler_inspection_url,
      'cap_url',                     rr.cap_url
    ) as obj
    from s
    join public.rsc_remediation rr on rr.supplier_id = s.id and rr.active = true
    limit 1
  ),
  brands as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'source_code',  src.code,
          'display_name', src.display_name,
          'source_url',   coalesce(nullif(sr.fields->>'source_url', ''), src.base_url),
          'last_seen_at', sr.fetched_at
        )
        order by src.code
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.source_records sr on sr.supplier_id = s.id and sr.status = 'active'
    join public.sources src        on src.id = sr.source_id
    where src.code like 'BRAND\_%' escape '\'
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
        jsonb_build_object(
          'doc_type',     cd.doc_type,
          'mirror_url',   cd.mirror_url,
          'original_url', cd.original_url,
          'fetched_at',   cd.fetched_at,
          'file_size',    cd.file_size
        )
        order by cd.doc_type, cd.fetched_at desc
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.compliance_documents cd on cd.supplier_id = s.id
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
    'rsc_remediation',      (select obj   from rsc),
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

comment on function public.buyer_supplier_profile(text) is
  'Buyer-facing factory profile (Spec B2; extended by S2 + S5; REZ-7 removed '
  'address contact PII). partner_factories[] on buying_house pages and '
  'partner_buying_houses[] on factory pages contain only accepted '
  'relationships. Never returns contact PII (no phone/email/contact_name).';

notify pgrst, 'reload schema';
