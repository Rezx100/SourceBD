-- ---------------------------------------------------------------------------
-- 0086: rename scraper code bgmea_pdf → bgmea_buying_house
--
-- The PDF list contains BGMEA *associate* members (buying houses), not the
-- general-member factory directory that bgmea_web covers. This migration
-- renames the code everywhere the DB stores it:
--
--   1. admin_etl_allowed_scraper_codes() — allow-list function used by CHECK
--      constraints on etl_job_queue and etl_schedules. Must run first so that
--      the subsequent UPDATEs pass the constraints.
--   2. etl_schedules       (scraper_code is the primary key — rename in place)
--   3. etl_job_queue       (scraper_code col, historical + pending rows)
--   4. etl_runs            (scraper_code col, run history)
--   5. evidence_documents  (scraper_code col, provenance links)
--   6. evidence_monitors   (scraper_code col, Firecrawl monitor rows)
-- ---------------------------------------------------------------------------

-- 1. Widen the allow-list to include the new code and drop the old one.
--    CHECK constraints re-evaluate on INSERT/UPDATE, not retroactively, so
--    existing rows with the old value are safe until the UPDATEs below fix them.
create or replace function public.admin_etl_allowed_scraper_codes()
returns text[]
language sql
immutable
as $$
  select array[
    'bgmea_buying_house',
    'bgmea_web',
    'bkmea_web',
    'bkmea_detail',
    'bgapmea_web',
    'epb_web',
    'btma_spinning',
    'rsc',
    'rsc_reports',
    'rsc_updates',
    'rsc_documents',
    'wrap',
    'oeko_tex',
    'gots',
    'sa8000',
    'uflpa',
    'cbp_wro',
    'ofac_sdn',
    'uk_ofsi',
    'eu_sanctions',
    'ilab_tvpra',
    'brand_hm',
    'brand_primark',
    'brand_asos',
    'brand_ms',
    'brand_next',
    'verify_evidence',
    'refresh_monitors'
  ]
$$;

-- 2. etl_schedules — scraper_code is the PK so UPDATE renames the row.
--    The allow-list function already returns the new code, so the CHECK passes.
update public.etl_schedules
   set scraper_code = 'bgmea_buying_house'
 where scraper_code = 'bgmea_pdf';

-- 3. etl_job_queue — rename all historical and pending jobs.
update public.etl_job_queue
   set scraper_code = 'bgmea_buying_house'
 where scraper_code = 'bgmea_pdf';

-- 4. etl_runs — run history (no CHECK constraint, plain rename).
update public.etl_runs
   set scraper_code = 'bgmea_buying_house'
 where scraper_code = 'bgmea_pdf';

-- 5. evidence_documents — provenance records.
update public.evidence_documents
   set scraper_code = 'bgmea_buying_house'
 where scraper_code = 'bgmea_pdf';

-- 6. evidence_monitors — Firecrawl monitor rows.
update public.evidence_monitors
   set scraper_code = 'bgmea_buying_house'
 where scraper_code = 'bgmea_pdf';
