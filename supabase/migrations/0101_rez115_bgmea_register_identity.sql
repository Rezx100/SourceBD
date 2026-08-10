-- =============================================================================
-- SourceBD — REZ-115: BGMEA register is part of the published identity
-- =============================================================================
-- BGMEA General and Associate registers number independently. The historical
-- BGMEA branch of this view unnested bare digits from suppliers.bgmea_reg_numbers
-- and matched either general:{N} or any fields->>'bgmea_reg_number' = N, so the
-- same digit published as one "BGMEA Reg #" on both registers.
--
-- Display now derives from the live source_record only, using
-- fields->>'bgmea_member_type' (written by the scrapers — never inferred here).
-- General members deep-link to /member/{bgmea_member_id}. Associate members
-- have no per-company HTML page on bgmea.com.bd (PDF register only), so
-- source_url is null rather than linking into the General register for the
-- same digit.
--
-- Storage of suppliers.bgmea_reg_numbers as general:N / associate:N is a
-- separate backfill (ops/backfill_bgmea_reg_identities.py). This migration is
-- display-only.
--
-- Static SQL only. search_path explicit. No EXECUTE / format().
-- -----------------------------------------------------------------------------

set search_path = public;

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
-- EPB (Tier 1 government registry; payload-only)
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
  'General deep-links; never publish a bare digit as the identity.';

revoke select on public.v_supplier_registry_ids_direct from anon, authenticated;
revoke select on public.v_supplier_registry_ids from anon, authenticated;
