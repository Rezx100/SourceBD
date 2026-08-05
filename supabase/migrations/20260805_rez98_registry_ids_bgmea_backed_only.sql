-- =============================================================================
-- SourceBD — REZ-98: publish only BGMEA numbers a live source record backs
-- =============================================================================
-- BGMEA was the only register in this view published from a denormalised
-- column: `unnest(suppliers.bgmea_reg_numbers)`. EPB, BGAPMEA and BTMA already
-- derive from `source_records`, RSC from `rsc_remediation`, certificates from
-- `certifications`. Every writer of that array unions and none ever removes an
-- element, so a number outlives the record that put it there — 805 of 6,775
-- published numbers (5 Aug 2026) were registrations whose live record sits on
-- a DIFFERENT supplier, each rendered "verified" by the supplier-level
-- `bgmea_verified` flag.
--
-- Founder decision (REZ-98, option (a)): show only numbers backed by a live
-- source record. A registration belonging to another company is not
-- "unverified", it is wrong, so it is withheld rather than relabelled.
--
-- Measured effect, published suppliers, 5 Aug 2026:
--   805 numbers withdrawn across 554 suppliers
--    61 suppliers lose the BGMEA pill entirely (6 multi-number, 55 single —
--       the single-number class is the dangerous one: it presents as a clean,
--       confident profile and no multi-number check can see it)
--   459 suppliers go from several numbers to exactly one
--   199 still show more than one — precisely REZ-88's multi-source-record
--       population, which REZ-90 already owns
--
-- This is a DISPLAY rule. It does not mutate `bgmea_reg_numbers`; the array
-- repair is a separate production write with its own snapshot and dry-run.
-- Note that `suppliers.bgmea_reg_numbers` also feeds SBI Pillar 1, which this
-- view cannot reach — see REZ-98 for that measurement.
--
-- Every other branch below is unchanged from the REZ-19 definition.
--
-- APPLIED to production 5 Aug 2026. The live view returns 5,970 BGMEA numbers
-- across 5,740 suppliers with 199 multi-number, matching the dry-run exactly;
-- the 11,403 non-BGMEA rows were unaffected. Rollback = re-run the pre-REZ-98
-- definition (this file minus the `exists (...)` clause in the BGMEA branch).
-- -----------------------------------------------------------------------------

create or replace view public.v_supplier_registry_ids_direct as
-- BGMEA (typed text[] column on suppliers; can be multi-value)
-- Backed-only: the supplier must itself hold an ACTIVE BGMEA record for this
-- number. `bgmea_web` keys general members as `general:{reg}`, so the ref is
-- the primary test; the stored payload field covers rows keyed `member:{id}`
-- because the register published no number for them.
select s.id              as supplier_id,
       'BGMEA'::text     as source_code,
       'BGMEA Reg #'     as label,
       n.value           as value,
       coalesce(s.bgmea_verified, false) as verified,
       'https://www.bgmea.com.bd/'::text as source_url
  from public.suppliers s
  cross join lateral unnest(s.bgmea_reg_numbers) as n(value)
 where s.is_published = true
   and array_length(s.bgmea_reg_numbers, 1) > 0
   and exists (
         select 1
           from public.source_records sr
           join public.sources src on src.id = sr.source_id and src.code = 'BGMEA'
          where sr.supplier_id = s.id
            and sr.status = 'active'
            and (
                  sr.source_ref = 'general:' || n.value
               or sr.fields->>'bgmea_reg_number' = n.value
            )
       )

union all
-- BKMEA (typed single-value column on suppliers)
select s.id, 'BKMEA', 'BKMEA #',
       s.bkmea_reg_number,
       coalesce(s.bkmea_verified, false),
       'https://www.bkmea.com/'
  from public.suppliers s
 where s.is_published = true
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
   and s.is_published = true
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
   and s.is_published = true
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
   and s.is_published = true
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
  join public.suppliers s
    on s.id = sr.supplier_id
   and s.is_published = true
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
  join public.suppliers s
    on s.id = c.supplier_id
   and s.is_published = true
 where c.certificate_no is not null
   and btrim(c.certificate_no) <> '';

comment on view public.v_supplier_registry_ids_direct is
  'Raw, source-records / typed-column-driven registry/membership/certificate IDs per supplier. Published suppliers only. BGMEA numbers are shown only when the supplier itself holds an active BGMEA source record for that number (REZ-98): the array is append-only and retains registrations whose record has since moved to another supplier. Subset of v_supplier_registry_ids; the parent view UNIONs this with inherited rows for RSC sibling/extension factories.';

notify pgrst, 'reload schema';
