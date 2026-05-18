-- Migration 0004: per-authority address views
--
-- Each authority (BGMEA, BKMEA, BTMA, RSC, BGAPMEA) maintains its own
-- verified address(es) for the same factory. We do NOT collapse them into
-- a single row column; instead we keep every raw payload in
-- public.source_records.fields and surface them via these views so the
-- future UI/API can render "Addresses on file" grouped by authority.
--
-- This migration is data-shape only (read-only views). No table changes.

-- ---------- v_supplier_addresses --------------------------------------------
-- One row per (supplier, source_code, address_kind). Includes phone where
-- the source provides a phone tied to the same address kind. Empty/zero
-- values are filtered out.
create or replace view public.v_supplier_addresses as
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
   -- only keep raw_address rows where neither factory nor mailing exists
   -- (i.e. PDF associate buying-house records); avoids dup with factory/mailing
   and coalesce(nullif(fields->>'factory_address',''),'') = ''
   and coalesce(nullif(fields->>'mailing_address',''),'') = ''

-- BKMEA: factory + mailing (detail page)
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

-- RSC: single factory address from the inspection roster
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

-- BTMA / BGAPMEA: single raw_address
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
;

comment on view public.v_supplier_addresses is
  'All verified addresses per authority (BGMEA factory/mailing, BKMEA factory/mailing, RSC factory, BTMA/BGAPMEA registered). Source of truth for the supplier profile "Addresses on file" panel. Driven by source_records.fields; no data is collapsed.';

-- ---------- v_supplier_address_summary --------------------------------------
-- One row per supplier with a jsonb array of {source, kind, address, phone, email}.
-- Convenient for API responses and joins.
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
  'Aggregated per-supplier addresses keyed by id; each element identifies the issuing authority and address kind.';
