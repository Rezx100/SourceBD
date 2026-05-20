-- Migration 0012: RSC sibling-factory address inheritance.
--
-- The Accord JSON API that backs `public.rsc_remediation` (Spec 06) does NOT
-- carry a postal address for ~825 RSC factory records whose company_name is
-- a sibling/extension of an already-known parent factory (patterns:
-- "(Extension)", "(Expansion)", "(Expansion Buildings)", "(New Building)",
-- "(New Location)", "Unit-N", trailing " - N"). Diagnostic
-- ops/_addr_recovery_audit.py shows 171 such siblings whose parent factory
-- exists in our DB with a verified Tier-1/2 address — the extension and
-- the parent are the same physical compound under RSC's own data model.
--
-- This migration:
--   1. Introduces helper SQL function `public.rsc_extension_base_name(text)`
--      that returns the parent name for an extension-pattern company_name,
--      or NULL when the name is not a recognised extension pattern.
--   2. Renames the existing public.v_supplier_addresses to
--      public.v_supplier_addresses_direct (raw source-records-driven branch).
--   3. Recreates public.v_supplier_addresses as
--      direct ∪ inherited(direct) where the inherited branch attaches a
--      parent factory's address row to its extension sibling, tagged with
--      address_kind = <kind> || '_inherited' and the parent's original
--      source_code preserved. No source_records rows are written; provenance
--      stays inside the view.
--   4. Recreates public.v_supplier_address_summary against the new view
--      (identical schema; auto-picks up inherited rows).
--
-- The change is read-only data exposure on top of existing rows; no schema
-- modification to suppliers / source_records. Fully reversible by dropping
-- v_supplier_addresses_direct.

create or replace function public.rsc_extension_base_name(p_name text)
returns text
language plpgsql
immutable
as $$
declare
  v          text := coalesce(p_name, '');
  v_clean    text;
  v_stripped text;
begin
  if v = '' then return null; end if;

  -- Strip "(Previously NAME)" annotation; the parent lookup uses the surviving
  -- canonical name, not the historical one.
  v_clean := regexp_replace(v, '\s*\(\s*previously\s+[^)]*\)\s*$', '', 'i');

  v_stripped := v_clean;

  -- Strip extension / expansion / new-building / new-location suffixes.
  -- Run one regex per token to keep PG ARE happy (nested alternations with
  -- escaped parens have been observed to break the parser).
  v_stripped := regexp_replace(v_stripped, '\s*[-(]\s*extension\s*\)?\s*$', '', 'i');
  v_stripped := regexp_replace(v_stripped, '\s*[-(]\s*expansion(\s+buildings?)?\s*\)?\s*$', '', 'i');
  v_stripped := regexp_replace(v_stripped, '\s*[-(]\s*new\s+building\s*\)?\s*$', '', 'i');
  v_stripped := regexp_replace(v_stripped, '\s*[-(]\s*new\s+location\s*\)?\s*$', '', 'i');

  -- " Unit-N" / " Unit N" / " - Unit N" with optional comma-separated unit list
  v_stripped := regexp_replace(v_stripped, '\s*-?\s*unit[\s-]+[0-9]+(\s*[,-]\s*[0-9]+)*\s*$', '', 'i');

  -- " -N-" trailing numeric tag
  v_stripped := regexp_replace(v_stripped, '\s*-\s*[0-9]+\s*-\s*$', '', 'i');

  -- Trailing " - N" / " - N, M" (numeric building list); requires whitespace
  -- before the dash to avoid swallowing legitimate parts of a company name.
  v_stripped := regexp_replace(v_stripped, '\s+-\s*[0-9]+(\s*[,-]\s*[0-9]+)*\s*$', '', '');

  v_stripped := btrim(v_stripped);

  if v_stripped = '' then
    return null;
  end if;
  if lower(v_stripped) = lower(v_clean) then
    -- nothing was actually stripped → not an extension pattern
    return null;
  end if;

  return v_stripped;
end$$;

comment on function public.rsc_extension_base_name(text) is
  'Returns the parent factory name for RSC sibling records (Extension, Expansion, New Building, Unit-N, - N). Returns NULL when the input is not a recognised sibling pattern. Used by v_supplier_addresses to inherit a parent factory address onto its sibling RSC record.';

-- Drop the summary view first so we can recreate v_supplier_addresses cleanly.
drop view if exists public.v_supplier_address_summary;
drop view if exists public.v_supplier_addresses;

-- v_supplier_addresses_direct: the raw, source-records-driven branches.
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

comment on view public.v_supplier_addresses_direct is
  'Raw, source-records-driven verified addresses per supplier (BGMEA factory/mailing, BKMEA factory/mailing, RSC factory, BTMA/BGAPMEA registered). Subset of v_supplier_addresses; the parent view UNIONs this with inherited rows for RSC sibling factories.';

-- v_supplier_addresses: direct rows ∪ inherited rows for RSC sibling factories.
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
