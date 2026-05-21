-- =============================================================================
-- Migration 0016: BGAPMEA address branches in v_supplier_addresses_direct
--
-- Audit (2026-05-21) showed 955 BGAPMEA-only suppliers with no row in
-- v_supplier_addresses despite 100% of BGAPMEA source_records carrying
-- `bgapmea_company_address` (registered HQ) and 99.6% carrying
-- `bgapmea_factory_address` (factory site). The view as recreated by
-- migrations 0014/0015 only looks for `fields->>'address'` /
-- `fields->>'raw_address'` for BGAPMEA — keys the BGAPMEA harvester
-- (etl/scrapers/bgapmea.py) never writes. This migration adds two
-- BGAPMEA-specific branches (factory + registered) using the actual
-- payload keys.
--
-- Phone/email policy: BGAPMEA payload has a single `bgapmea_phone` and
-- `bgapmea_email_raw` per company (not split per location). They are
-- attached to the `registered` (HQ) row only; the `factory` row carries
-- address-only. Attaching the same phone/email to both rows would imply a
-- distinction that the source does not document.
--
-- No writes to base tables. Pure view recreation, additive over 0015.
-- Reversibility: re-running 0015 restores the prior shape.
-- =============================================================================

drop view if exists public.v_supplier_address_summary;
drop view if exists public.v_supplier_addresses;
drop view if exists public.v_supplier_addresses_direct;

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
  where sr.status = 'active'
)
-- BGMEA: factory + mailing (web detail) and raw_address (PDF / fallback)
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text                 as address_kind,
       fields->>'factory_address'      as address,
       nullif(fields->>'factory_phone','')   as phone,
       nullif(fields->>'factory_email','')   as email,
       fetched_at
  from src
 where source_code = 'BGMEA'
   and coalesce(nullif(fields->>'factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'mailing'::text                 as address_kind,
       fields->>'mailing_address'      as address,
       nullif(fields->>'mailing_phone','')   as phone,
       nullif(fields->>'mailing_email','')   as email,
       fetched_at
  from src
 where source_code = 'BGMEA'
   and coalesce(nullif(fields->>'mailing_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'registered'::text              as address_kind,
       fields->>'raw_address'          as address,
       nullif(fields->>'raw_tel','')         as phone,
       null::text                            as email,
       fetched_at
  from src
 where source_code = 'BGMEA'
   and coalesce(nullif(fields->>'raw_address',''),'') <> ''
   and coalesce(nullif(fields->>'factory_address',''),'') = ''
   and coalesce(nullif(fields->>'mailing_address',''),'') = ''

union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text                 as address_kind,
       fields->>'bkmea_factory_address' as address,
       nullif(fields->>'bkmea_factory_phone','')  as phone,
       nullif(fields->>'bkmea_factory_email','')  as email,
       fetched_at
  from src
 where source_code = 'BKMEA'
   and coalesce(nullif(fields->>'bkmea_factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'mailing'::text                 as address_kind,
       fields->>'bkmea_mailing_address' as address,
       nullif(fields->>'bkmea_mailing_phone','')  as phone,
       nullif(fields->>'bkmea_mailing_email','')  as email,
       fetched_at
  from src
 where source_code = 'BKMEA'
   and coalesce(nullif(fields->>'bkmea_mailing_address',''),'') <> ''

union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text                 as address_kind,
       coalesce(fields->>'rsc_factory_address', fields->>'address', fields->>'raw_address') as address,
       null::text                      as phone,
       null::text                      as email,
       fetched_at
  from src
 where source_code = 'RSC'
   and coalesce(
         nullif(fields->>'rsc_factory_address',''),
         nullif(fields->>'address',''),
         nullif(fields->>'raw_address','')
       ) is not null

-- BTMA Spec 16: factory_address (mill site) + mailing_address (head office)
union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text                 as address_kind,
       fields->>'factory_address'      as address,
       nullif(fields->>'raw_tel','')         as phone,
       nullif(fields->>'raw_email','')       as email,
       fetched_at
  from src
 where source_code = 'BTMA'
   and coalesce(nullif(fields->>'factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'mailing'::text                 as address_kind,
       fields->>'mailing_address'      as address,
       nullif(fields->>'raw_tel','')         as phone,
       nullif(fields->>'raw_email','')       as email,
       fetched_at
  from src
 where source_code = 'BTMA'
   and coalesce(nullif(fields->>'mailing_address',''),'') <> ''

-- BGAPMEA: bgapmea_factory_address (mill / factory site) and
-- bgapmea_company_address (registered HQ). Phone/email are attached to
-- the `registered` row only (BGAPMEA publishes a single contact pair
-- per company, not split per location).
union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text                 as address_kind,
       fields->>'bgapmea_factory_address'   as address,
       null::text                            as phone,
       null::text                            as email,
       fetched_at
  from src
 where source_code = 'BGAPMEA'
   and coalesce(nullif(fields->>'bgapmea_factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'registered'::text              as address_kind,
       fields->>'bgapmea_company_address'    as address,
       nullif(fields->>'bgapmea_phone','')        as phone,
       nullif(fields->>'bgapmea_email_raw','')    as email,
       fetched_at
  from src
 where source_code = 'BGAPMEA'
   and coalesce(nullif(fields->>'bgapmea_company_address',''),'') <> ''

-- BTMA / BGAPMEA fallback: a single `address` / `raw_address` key with no
-- structured split. For BTMA this branch only fires when BOTH structured
-- keys are absent; for BGAPMEA it is effectively a no-op today (the
-- harvester never writes `address` / `raw_address`) but is preserved for
-- future-proofing against alternate payload shapes.
union all
select supplier_id, source_code, source_tier, source_ref,
       'registered'::text              as address_kind,
       coalesce(fields->>'address', fields->>'raw_address') as address,
       null::text                      as phone,
       null::text                      as email,
       fetched_at
  from src
 where source_code in ('BTMA','BGAPMEA')
   and coalesce(nullif(fields->>'address',''), nullif(fields->>'raw_address','')) is not null
   and coalesce(nullif(fields->>'factory_address',''),'') = ''
   and coalesce(nullif(fields->>'mailing_address',''),'') = ''
   and coalesce(nullif(fields->>'bgapmea_factory_address',''),'') = ''
   and coalesce(nullif(fields->>'bgapmea_company_address',''),'') = ''
;

comment on view public.v_supplier_addresses_direct is
  'Raw, source-records-driven verified addresses per supplier (BGMEA factory/mailing, BKMEA factory/mailing, RSC factory, BTMA factory/mailing/registered, BGAPMEA factory/registered). Subset of v_supplier_addresses; the parent view UNIONs this with inherited rows for RSC sibling factories.';

-- v_supplier_addresses: direct ∪ inherited (RSC sibling factories). Recreated
-- verbatim from migration 0015 — dropping v_supplier_addresses_direct above
-- cascaded into this view and v_supplier_address_summary.
create or replace view public.v_supplier_addresses as
select * from public.v_supplier_addresses_direct
union all
select child.id                                    as supplier_id,
       parent_addr.source_code                     as source_code,
       parent_addr.source_tier                     as source_tier,
       (parent_addr.source_ref || '#inherited:' || parent.slug) as source_ref,
       (parent_addr.address_kind || '_inherited')  as address_kind,
       parent_addr.address                         as address,
       parent_addr.phone                           as phone,
       parent_addr.email                           as email,
       parent_addr.fetched_at                      as fetched_at
  from public.suppliers child
  join lateral (
        select public.rsc_extension_base_name(child.company_name) as base
       ) bn on true
  join public.suppliers parent
    on parent.id <> child.id
   and lower(parent.company_name) = lower(bn.base)
  join public.v_supplier_addresses_direct parent_addr
    on parent_addr.supplier_id = parent.id
 where bn.base is not null
;

comment on view public.v_supplier_addresses is
  'All verified addresses per supplier (direct source rows + RSC sibling inheritance). Inherited rows have address_kind suffixed with "_inherited" and source_ref suffixed with "#inherited:<parent_slug>"; source_code is the parent record''s original source. UI should label inherited rows as "Address (per parent factory <parent_slug>)".';

create or replace view public.v_supplier_address_summary as
select supplier_id,
       jsonb_agg(
         jsonb_build_object(
           'source',  source_code,
           'tier',    source_tier::text,
           'kind',    address_kind,
           'ref',     source_ref,
           'address', address,
           'phone',   phone,
           'email',   email,
           'fetched_at', fetched_at
         )
         order by source_code, address_kind
       ) as addresses
  from public.v_supplier_addresses
 group by supplier_id;

comment on view public.v_supplier_address_summary is
  'Aggregated per-supplier addresses keyed by id; each element identifies the issuing authority, address kind, and (for inherited rows) the parent factory via the "_inherited" suffix and "#inherited:<parent_slug>" source_ref.';
