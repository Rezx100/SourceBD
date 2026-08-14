-- =============================================================================
-- SourceBD — EPB Open URL is the exporter page; HS codes for existing companies
-- =============================================================================
-- Founder, 15 Aug 2026: EPB is an independent government entity. A company
-- already on our list must show EPB evidence (and HS codes) when EPB
-- publishes them, whether or not it carries a BGMEA/BKMEA association flag.
-- Never mint a single-source EPB-only supplier (category pass stays
-- enrich_only). This migration is display-only.
--
-- 1. Registry Open source for EPB uses the stored public exporter URL
--    (`fields.epb_detail_url`) when it is `https://edb.epb.gov.bd/exporter/{source_ref}/…`.
--    Otherwise null — never the agency homepage.
-- 2. Six census extras (15 Aug 2026) whose exporter page names a different
--    company than the current host are excluded from Open and HS until
--    re-homed. Drop the pair from epb_record_is_foreign_to_host after move.
-- 3. `supplier_epb_hscodes(p_slug)` returns the HS codes stored on that
--    published supplier's active EPB records. Empty array when none.
--
-- Does NOT rewrite buyer_supplier_profile. Static SQL only. No EXECUTE / format().
-- Not applied in the authoring session — STOP AND ASK before production.
-- -----------------------------------------------------------------------------

set search_path = public;

-- Census 15 Aug 2026: second EPB record on these hosts is a different legal
-- name (za-apparels, bsa-fashion, deluxe-fashions, kds-fashion, mim-fashion,
-- univogue unit-3). True only for that (host slug, exporter id) pair, so a
-- re-home onto the sister company starts showing Open/HS automatically.
create or replace function public.epb_record_is_foreign_to_host(
  p_host_slug text,
  p_source_ref text
)
returns boolean
language sql
immutable
parallel safe
as $$
  select exists (
    select 1
      from (values
        ('az-apparels', '4821'),
        ('bsa-apparels', '4491'),
        ('deluxe-apparels', '2850'),
        ('kds-apparels', '3710'),
        ('mim-apparel', '1762'),
        ('univogue-garments-co-ltd-unit-2', '3084')
      ) as t(host_slug, source_ref)
     where t.host_slug = p_host_slug
       and t.source_ref = p_source_ref
  );
$$;

revoke all on function public.epb_record_is_foreign_to_host(text, text) from public;

comment on function public.epb_record_is_foreign_to_host(text, text) is
  'True when this EPB exporter id is a different company than the host slug. Display-only denylist from the 15 Aug 2026 dual-EPB census.';

create or replace view public.v_supplier_registry_ids_direct as
-- BGMEA: register + number from the live source record (REZ-115)
select sr.supplier_id as supplier_id,
       'BGMEA'::text as source_code,
       case sr.fields->>'bgmea_member_type'
         when 'general_manufacturer' then 'BGMEA General member #'
         when 'associate_buying_house' then 'BGMEA Associate member #'
       end as label,
       case sr.fields->>'bgmea_member_type'
         when 'general_manufacturer' then
           coalesce(
             nullif(btrim(sr.fields->>'bgmea_reg_number'), ''),
             nullif(btrim(regexp_replace(sr.source_ref, '^general:', '')), '')
           )
         when 'associate_buying_house' then
           coalesce(
             nullif(btrim(sr.fields->>'bgmea_reg_number'), ''),
             nullif(btrim(sr.source_ref), '')
           )
       end as value,
       true as verified,
       case
         when sr.fields->>'bgmea_member_type' = 'general_manufacturer'
          and nullif(btrim(sr.fields->>'bgmea_member_id'), '') is not null
         then 'https://www.bgmea.com.bd/member/'
              || btrim(sr.fields->>'bgmea_member_id')
         else null
       end as source_url
  from public.source_records sr
  join public.sources src
    on src.id = sr.source_id
   and src.code = 'BGMEA'
  join public.suppliers s
    on s.id = sr.supplier_id
   and (s.is_published = true or s.facility_of is not null)
 where sr.status = 'active'
   and sr.supplier_id is not null
   and sr.fields->>'bgmea_member_type' in (
         'general_manufacturer',
         'associate_buying_house'
       )
   and case sr.fields->>'bgmea_member_type'
         when 'general_manufacturer' then
           coalesce(
             nullif(btrim(sr.fields->>'bgmea_reg_number'), ''),
             nullif(btrim(regexp_replace(sr.source_ref, '^general:', '')), '')
           )
         when 'associate_buying_house' then
           coalesce(
             nullif(btrim(sr.fields->>'bgmea_reg_number'), ''),
             nullif(btrim(sr.source_ref), '')
           )
       end is not null

union all
-- BKMEA (typed single-value column on suppliers)
select s.id, 'BKMEA', 'BKMEA #',
       s.bkmea_reg_number,
       coalesce(s.bkmea_verified, false),
       'https://www.bkmea.com/'
  from public.suppliers s
 where (s.is_published = true or s.facility_of is not null)
   and s.bkmea_reg_number is not null
   and btrim(s.bkmea_reg_number) <> ''

union all
-- RSC (sidecar table)
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
-- EPB (Tier 1 government registry; independent of BGMEA/BKMEA flags)
select sr.supplier_id, 'EPB', 'EPB Reg #',
       sr.fields->>'epb_reg_no',
       true,
       case
         when sr.source_ref ~ '^[0-9]+$'
          and nullif(btrim(sr.fields->>'epb_detail_url'), '')
              like 'https://edb.epb.gov.bd/exporter/' || sr.source_ref || '/%'
         then nullif(btrim(sr.fields->>'epb_detail_url'), '')
         else null
       end
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
   and sr.source_ref ~ '^[0-9]+$'
   and not public.epb_record_is_foreign_to_host(s.slug, sr.source_ref)

union all
-- BGAPMEA (Tier 2 association; payload-only)
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
-- BTMA (Tier 2 association; payload-only)
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
-- Certificates
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
  'Registry/membership/certificate IDs. REZ-98 BGMEA backed by live source '
  'records. REZ-109: attached facilities for mother Facilities panel. '
  'REZ-115: BGMEA pills carry General vs Associate register labels and '
  'General deep-links; never publish a bare digit as the identity. '
  'EPB Open URL is the stored exporter page, never the agency homepage.';

revoke select on public.v_supplier_registry_ids_direct from anon, authenticated;
revoke select on public.v_supplier_registry_ids from anon, authenticated;

-- HS codes stored on EPB source_records. Published suppliers only. No PII.
create or replace function public.supplier_epb_hscodes(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_obj order by row_obj->>'code'), '[]'::jsonb)
    from (
      select distinct on (btrim(hs.elem->>'code'))
             jsonb_build_object(
               'code', btrim(hs.elem->>'code'),
               'description', nullif(btrim(hs.elem->>'description'), ''),
               'source_url',
                 case
                   when nullif(btrim(hs.elem->>'source_url'), '')
                        ~ '^https://edb\.epb\.gov\.bd/hscode-exporters/[0-9]+$'
                   then nullif(btrim(hs.elem->>'source_url'), '')
                   else null
                 end
             ) as row_obj
        from public.suppliers s
        join public.source_records sr
          on sr.supplier_id = s.id
         and sr.status = 'active'
        join public.sources src
          on src.id = sr.source_id
         and src.code = 'EPB'
        cross join lateral jsonb_array_elements(
          case
            when jsonb_typeof(sr.fields->'epb_hscodes') = 'array'
            then sr.fields->'epb_hscodes'
            else '[]'::jsonb
          end
        ) with ordinality as hs(elem, ord)
       where s.slug = p_slug
         and s.is_published = true
         and sr.source_ref ~ '^[0-9]+$'
         and not public.epb_record_is_foreign_to_host(s.slug, sr.source_ref)
         and btrim(coalesce(hs.elem->>'code', '')) ~ '^[0-9]{4,6}$'
       order by btrim(hs.elem->>'code'), sr.fetched_at desc nulls last, sr.id, hs.ord
    ) d;
$$;

revoke all on function public.supplier_epb_hscodes(text) from public;
grant execute on function public.supplier_epb_hscodes(text) to anon, authenticated;

comment on function public.supplier_epb_hscodes(text) is
  'HS codes from active EPB records on a published supplier. Empty array when none. No PII.';
