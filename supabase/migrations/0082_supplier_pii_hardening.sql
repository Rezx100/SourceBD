-- Migration 0082 — REZ-13 / REZ-17 / REZ-18
-- Three public-supplier PII exposure issues, one coherent fix.
--
-- REZ-13: public.suppliers RLS allows anon/authenticated to SELECT all
--   columns including contact_name, contact_role, email_primary, phones,
--   website. Fix: column-level REVOKE strips those fields from the two
--   public roles. All security-definer RPCs (buyer_supplier_profile,
--   discover_suppliers, buyer_smart_match, supplier_profile_editor,
--   claim_verify_fn, admin_supplier_admin, etc.) run as their function owner
--   (postgres/service) and are wholly unaffected by this REVOKE. service_role
--   bypasses column privileges and RLS automatically.
--
-- REZ-17: v_supplier_addresses_direct / v_supplier_addresses /
--   v_supplier_address_summary expose phone and email to public callers. Fix:
--   all phone/email columns replaced with null::text throughout the view body;
--   phone/email keys removed from the v_supplier_address_summary jsonb. The
--   buyer_supplier_profile RPC (mig 0079) already excludes phone/email from
--   the addresses block it sends to the client, so its output is unchanged.
--
-- REZ-18: public address views do not filter suppliers.is_published, allowing
--   anonymous callers to discover unpublished suppliers via the address view.
--   Fix: v_supplier_addresses_direct adds a join on suppliers.is_published = true
--   in the base CTE; the inherited branch in v_supplier_addresses adds
--   child.is_published = true to its WHERE clause.
--
-- Defence-in-depth: anon and authenticated have SELECT revoked on all three
--   address views. The buyer_supplier_profile RPC is security definer and
--   therefore accesses the views as its owner regardless of these grants.
--   ETL runs as service_role and is also unaffected.
--
-- Reversibility: to restore pre-fix behaviour re-run migration 0018 (restores
--   view bodies) and issue:
--     grant select (contact_name, contact_role, email_primary, phones, website)
--       on public.suppliers to anon, authenticated;
--     grant select on public.v_supplier_addresses_direct,
--       public.v_supplier_addresses, public.v_supplier_address_summary
--       to anon, authenticated;

-- =============================================================================
-- REZ-13: Column-level PII revoke on public.suppliers
-- =============================================================================
-- Keeps all non-PII columns readable (company_name, slug, city, district,
-- entity_type, source_tags, completeness_pct, is_sanctioned, etc.) so the
-- RLS policy pol_suppliers_pub_read continues to allow public discovery.
-- Only contact fields are stripped from direct table / PostgREST access.
revoke select (contact_name, contact_role, email_primary, phones, website)
  on public.suppliers
  from anon, authenticated;

-- =============================================================================
-- REZ-17 + REZ-18: Harden public supplier address views
-- =============================================================================
-- Drop in dependency order; recreate with is_published filter and null PII.
drop view if exists public.v_supplier_address_summary;
drop view if exists public.v_supplier_addresses;
drop view if exists public.v_supplier_addresses_direct;

-- ---------------------------------------------------------------------------
-- v_supplier_addresses_direct (REZ-17 + REZ-18)
--   • src CTE gains join on suppliers.is_published = true (REZ-18)
--   • All phone / email columns replaced with null::text (REZ-17)
--   • View body otherwise identical to migration 0018 (most recent shaper)
-- ---------------------------------------------------------------------------
create view public.v_supplier_addresses_direct as
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
  -- REZ-18: exclude source records belonging to unpublished suppliers
  join public.suppliers sup on sup.id = sr.supplier_id and sup.is_published = true
  where sr.status = 'active'
)
-- BGMEA: factory + mailing (web detail) and raw_address (PDF / fallback)
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text    as address_kind,
       fields->>'factory_address' as address,
       null::text         as phone,   -- REZ-17
       null::text         as email,   -- REZ-17
       fetched_at
  from src
 where source_code = 'BGMEA'
   and coalesce(nullif(fields->>'factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'mailing'::text    as address_kind,
       fields->>'mailing_address' as address,
       null::text         as phone,   -- REZ-17
       null::text         as email,   -- REZ-17
       fetched_at
  from src
 where source_code = 'BGMEA'
   and coalesce(nullif(fields->>'mailing_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'registered'::text as address_kind,
       fields->>'raw_address' as address,
       null::text         as phone,   -- REZ-17
       null::text         as email,   -- REZ-17
       fetched_at
  from src
 where source_code = 'BGMEA'
   and coalesce(nullif(fields->>'raw_address',''),'') <> ''
   and coalesce(nullif(fields->>'factory_address',''),'') = ''
   and coalesce(nullif(fields->>'mailing_address',''),'') = ''

union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text    as address_kind,
       fields->>'bkmea_factory_address' as address,
       null::text         as phone,   -- REZ-17
       null::text         as email,   -- REZ-17
       fetched_at
  from src
 where source_code = 'BKMEA'
   and coalesce(nullif(fields->>'bkmea_factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'mailing'::text    as address_kind,
       fields->>'bkmea_mailing_address' as address,
       null::text         as phone,   -- REZ-17
       null::text         as email,   -- REZ-17
       fetched_at
  from src
 where source_code = 'BKMEA'
   and coalesce(nullif(fields->>'bkmea_mailing_address',''),'') <> ''

union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text    as address_kind,
       coalesce(fields->>'rsc_factory_address', fields->>'address', fields->>'raw_address') as address,
       null::text         as phone,
       null::text         as email,
       fetched_at
  from src
 where source_code = 'RSC'
   and coalesce(
         nullif(fields->>'rsc_factory_address',''),
         nullif(fields->>'address',''),
         nullif(fields->>'raw_address','')
       ) is not null

-- BTMA: factory_address (mill site) + mailing_address (head office)
union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text    as address_kind,
       fields->>'factory_address' as address,
       null::text         as phone,   -- REZ-17
       null::text         as email,   -- REZ-17
       fetched_at
  from src
 where source_code = 'BTMA'
   and coalesce(nullif(fields->>'factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'mailing'::text    as address_kind,
       fields->>'mailing_address' as address,
       null::text         as phone,   -- REZ-17
       null::text         as email,   -- REZ-17
       fetched_at
  from src
 where source_code = 'BTMA'
   and coalesce(nullif(fields->>'mailing_address',''),'') <> ''

-- BGAPMEA: factory site (no phone/email) + registered HQ
union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text    as address_kind,
       fields->>'bgapmea_factory_address' as address,
       null::text         as phone,
       null::text         as email,
       fetched_at
  from src
 where source_code = 'BGAPMEA'
   and coalesce(nullif(fields->>'bgapmea_factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'registered'::text as address_kind,
       fields->>'bgapmea_company_address' as address,
       null::text         as phone,   -- REZ-17: BGAPMEA phone suppressed
       null::text         as email,   -- REZ-17: BGAPMEA email suppressed
       fetched_at
  from src
 where source_code = 'BGAPMEA'
   and coalesce(nullif(fields->>'bgapmea_company_address',''),'') <> ''

-- EPB (mig 0017): no phone/email in EPB payload
union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text    as address_kind,
       fields->>'epb_factory_address' as address,
       null::text         as phone,
       null::text         as email,
       fetched_at
  from src
 where source_code = 'EPB'
   and coalesce(nullif(fields->>'epb_factory_address',''),'') <> ''
union all
select supplier_id, source_code, source_tier, source_ref,
       'registered'::text as address_kind,
       fields->>'epb_office_address' as address,
       null::text         as phone,
       null::text         as email,
       fetched_at
  from src
 where source_code = 'EPB'
   and coalesce(nullif(fields->>'epb_office_address',''),'') <> ''

-- OEKO-TEX (mig 0018): profile page address; phone/email suppressed (REZ-17)
union all
select supplier_id, source_code, source_tier, source_ref,
       'factory'::text    as address_kind,
       fields->>'oeko_profile_address' as address,
       null::text         as phone,   -- REZ-17: OEKO phone suppressed
       null::text         as email,   -- REZ-17: OEKO email suppressed
       fetched_at
  from src
 where source_code = 'OEKO_TEX'
   and coalesce(nullif(fields->>'oeko_profile_address',''),'') <> ''

-- BTMA / BGAPMEA fallback: fires only when structured keys are absent
union all
select supplier_id, source_code, source_tier, source_ref,
       'registered'::text as address_kind,
       coalesce(fields->>'address', fields->>'raw_address') as address,
       null::text         as phone,
       null::text         as email,
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
  'Verified addresses per supplier from source records (BGMEA factory/mailing, '
  'BKMEA factory/mailing, RSC factory, BTMA factory/mailing/registered, '
  'BGAPMEA factory/registered, EPB factory/registered, OEKO_TEX factory). '
  'REZ-17: phone and email columns are always null in the public view body. '
  'REZ-18: only rows for is_published=true suppliers are included. '
  'Subset of v_supplier_addresses; the parent view UNIONs this with inherited '
  'rows for RSC sibling factories.';

-- ---------------------------------------------------------------------------
-- v_supplier_addresses (REZ-18 child side)
--   • Direct branch: inherits the is_published filter from v_supplier_addresses_direct
--   • Inherited branch: child.is_published = true added (REZ-18)
--   • Phone/email passthrough from parent_addr will be null (REZ-17)
-- ---------------------------------------------------------------------------
create view public.v_supplier_addresses as
select * from public.v_supplier_addresses_direct
union all
select child.id                                       as supplier_id,
       parent_addr.source_code                        as source_code,
       parent_addr.source_tier                        as source_tier,
       (parent_addr.source_ref || '#inherited:' || parent.slug) as source_ref,
       (parent_addr.address_kind || '_inherited')     as address_kind,
       parent_addr.address                            as address,
       null::text                                     as phone,   -- REZ-17
       null::text                                     as email,   -- REZ-17
       parent_addr.fetched_at                         as fetched_at
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
   and child.is_published = true  -- REZ-18: exclude inherited rows for unpublished child suppliers
;

comment on view public.v_supplier_addresses is
  'All verified addresses per supplier (direct source rows + RSC sibling '
  'inheritance). Inherited rows have address_kind suffixed with "_inherited" '
  'and source_ref suffixed with "#inherited:<parent_slug>". '
  'REZ-17: phone and email columns are always null. '
  'REZ-18: only published suppliers appear (both direct and inherited branches). '
  'UI should label inherited rows as "Address (per parent factory <parent_slug>)".';

-- ---------------------------------------------------------------------------
-- v_supplier_address_summary (REZ-17)
--   • phone and email keys removed from the jsonb object
-- ---------------------------------------------------------------------------
create view public.v_supplier_address_summary as
select supplier_id,
       jsonb_agg(
         jsonb_build_object(
           'source',     source_code,
           'tier',       source_tier::text,
           'kind',       address_kind,
           'ref',        source_ref,
           'address',    address,
           'fetched_at', fetched_at
           -- REZ-17: 'phone' and 'email' keys intentionally omitted
         )
         order by source_code, address_kind
       ) as addresses
  from public.v_supplier_addresses
 group by supplier_id;

comment on view public.v_supplier_address_summary is
  'Aggregated per-supplier addresses keyed by id; each element identifies the '
  'issuing authority, address kind, and (for inherited rows) the parent factory '
  'via the "_inherited" suffix and "#inherited:<parent_slug>" source_ref. '
  'REZ-17: phone and email are not included in the jsonb output. '
  'REZ-18: only published suppliers are present.';

-- =============================================================================
-- Defence-in-depth: revoke direct SELECT on address views from public roles
-- =============================================================================
-- buyer_supplier_profile is security definer (runs as owner) so retains access.
-- ETL runs as service_role and bypasses all grants. Admin uses service_role too.
revoke select on public.v_supplier_addresses_direct  from anon, authenticated;
revoke select on public.v_supplier_addresses         from anon, authenticated;
revoke select on public.v_supplier_address_summary   from anon, authenticated;

notify pgrst, 'reload schema';
