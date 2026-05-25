-- 0020 — v_supplier_registry_ids
-- Long-form supplier registry / membership / certificate IDs for the
-- supplier-profile pill row. One row per (supplier, pill that has a value).
-- Rows are never NULL: the WHERE clauses filter missing IDs so the front end
-- can render data.map(...) without conditionals.
--
-- Columns:
--   supplier_id  uuid    — public.suppliers.id
--   source_code  text    — 'BGMEA' | 'BKMEA' | 'RSC' | 'EPB' | 'BGAPMEA' | 'BTMA'
--                          | 'GOTS' | 'OEKO_TEX' | 'WRAP' | 'SA8000' | ...
--   label        text    — human label for the pill ("BGMEA Reg #", "RSC ID", ...)
--   value        text    — the registry / membership / certificate number
--   verified     bool    — true when the source is an authoritative registry
--                          (RSC/EPB/BGAPMEA/BTMA/certs always true; BGMEA/BKMEA
--                          carry the typed *_verified flag)
--   source_url   text    — public landing page for the issuing body
--
-- View only. Reversible: `drop view public.v_supplier_registry_ids;`

create or replace view public.v_supplier_registry_ids as
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

comment on view public.v_supplier_registry_ids is
  'Long-form supplier registry/membership/certificate IDs for profile pill row. One row per (supplier, populated ID); never returns NULL values.';
