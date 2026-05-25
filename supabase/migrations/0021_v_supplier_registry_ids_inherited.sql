-- 0021 — RSC sibling/extension registry-pill inheritance.
--
-- Mirrors the F6 address-inheritance pattern from migration 0014 for the
-- supplier-profile pill row. The Accord JSON (Spec 06) emits RSC factory
-- records for "(Extension)", "(Expansion Buildings)", "(New Building)",
-- "(New Location)", "Unit-N", trailing " - N" siblings of an already-known
-- parent factory. The parent supplier carries the full registry/cert pill
-- set (BGMEA/BKMEA/EPB/BGAPMEA/BTMA + GOTS/OEKO_TEX/WRAP/SA8000); the
-- satellite supplier only carries its own RSC factory ID. F16 scale-check
-- (`ops/_rsc_only_match_scale.py`) found 277 / 783 RSC-only suppliers
-- (35.4%) have a ≥98 fuzzy-twin parent in the non-RSC pool — almost all
-- via the `rsc_extension_base_name()` patterns recognised by 0014.
--
-- This migration:
--   1. Renames the existing `public.v_supplier_registry_ids` (from 0020)
--      to `public.v_supplier_registry_ids_direct` (same 6-column shape).
--   2. Recreates `public.v_supplier_registry_ids` as
--      direct ∪ inherited(direct) where the inherited branch attaches the
--      parent factory's pill rows to its satellite via
--      `public.rsc_extension_base_name()` (introduced in 0014). RSC pills
--      are excluded from inheritance (satellite has its own RSC factory
--      ID); pills the satellite already carries directly with the same
--      value are excluded via anti-join against `_direct`.
--   3. Adds two columns to the public view:
--        inherited_from       uuid  -- parent supplier_id, NULL on direct
--        inherited_from_name  text  -- parent company_name, NULL on direct
--      Existing consumers (front-end pill row) ignore the new columns.
--
-- View-only. Reversible: drop the public view, rename `_direct` back, drop
-- this migration. No writes to base tables; no source_records rows; no
-- moat write.

drop view if exists public.v_supplier_registry_ids;

create or replace view public.v_supplier_registry_ids_direct as
-- BGMEA (typed text[] column on suppliers; can be multi-value)
select s.id              as supplier_id,
       'BGMEA'::text     as source_code,
       'BGMEA Reg #'     as label,
       unnest(s.bgmea_reg_numbers) as value,
       coalesce(s.bgmea_verified, false) as verified,
       'https://www.bgmea.com.bd/'::text as source_url
  from public.suppliers s
 where array_length(s.bgmea_reg_numbers, 1) > 0

union all
-- BKMEA (typed single-value column on suppliers)
select s.id, 'BKMEA', 'BKMEA #',
       s.bkmea_reg_number,
       coalesce(s.bkmea_verified, false),
       'https://www.bkmea.com/'
  from public.suppliers s
 where s.bkmea_reg_number is not null
   and btrim(s.bkmea_reg_number) <> ''

union all
-- RSC (sidecar table)
select rr.supplier_id, 'RSC', 'RSC ID',
       rr.rsc_factory_id,
       true,
       'https://www.rsc-bd.org/'
  from public.rsc_remediation rr
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
 where src.code = 'BGAPMEA'
   and sr.status = 'active'
   and sr.supplier_id is not null
   and sr.fields ? 'bgapmea_membership_no'
   and btrim(sr.fields->>'bgapmea_membership_no') <> ''

union all
-- BTMA (Tier 2 association; payload-only — SL # from members list)
select sr.supplier_id, 'BTMA', 'BTMA Member #SL',
       sr.fields->>'btma_sl_no',
       true,
       'https://btmadhaka.com/'
  from public.source_records sr
  join public.sources src on src.id = sr.source_id
 where src.code = 'BTMA'
   and sr.status = 'active'
   and sr.supplier_id is not null
   and sr.fields ? 'btma_sl_no'
   and btrim(sr.fields->>'btma_sl_no') <> ''

union all
-- Certifications (typed cert table — GOTS / OEKO-TEX / WRAP / SA8000 / SEDEX / GRS / ...)
select c.supplier_id,
       upper(c.kind::text) as source_code,
       upper(c.kind::text) || ' Cert #' as label,
       c.certificate_no,
       true,
       c.document_url
  from public.certifications c
 where c.certificate_no is not null
   and btrim(c.certificate_no) <> '';

comment on view public.v_supplier_registry_ids_direct is
  'Raw, source-records / typed-column-driven registry/membership/certificate IDs per supplier. Subset of v_supplier_registry_ids; the parent view UNIONs this with inherited rows for RSC sibling/extension factories.';

-- v_supplier_registry_ids: direct rows ∪ inherited rows for RSC siblings.
-- Inherited rows attach the parent factory's pills to the satellite. The
-- satellite's own RSC pill is preserved; parent's RSC pill is excluded.
-- Pills the satellite already carries directly with the same value are
-- excluded via anti-join against _direct.
create or replace view public.v_supplier_registry_ids as
select supplier_id,
       source_code,
       label,
       value,
       verified,
       source_url,
       null::uuid as inherited_from,
       null::text as inherited_from_name
  from public.v_supplier_registry_ids_direct
union all
select child.id                                as supplier_id,
       parent_pill.source_code                 as source_code,
       parent_pill.label || ' (parent factory)' as label,
       parent_pill.value                       as value,
       parent_pill.verified                    as verified,
       parent_pill.source_url                  as source_url,
       parent.id                               as inherited_from,
       parent.company_name                     as inherited_from_name
  from public.suppliers child
  join lateral (
        select public.rsc_extension_base_name(child.company_name) as base
       ) bn on true
  join public.suppliers parent
    on parent.id <> child.id
   and lower(parent.company_name) = lower(bn.base)
  join public.v_supplier_registry_ids_direct parent_pill
    on parent_pill.supplier_id = parent.id
 where bn.base is not null
   and parent_pill.source_code <> 'RSC'
   and not exists (
         select 1
           from public.v_supplier_registry_ids_direct d
          where d.supplier_id = child.id
            and d.source_code = parent_pill.source_code
            and d.value       = parent_pill.value
       )
;

comment on view public.v_supplier_registry_ids is
  'Long-form supplier registry/membership/certificate IDs for profile pill row (direct ∪ RSC sibling-factory inheritance). Inherited rows have label suffixed with " (parent factory)" and carry inherited_from / inherited_from_name. One row per (supplier, populated ID); never returns NULL values.';
