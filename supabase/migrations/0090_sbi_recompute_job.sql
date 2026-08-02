-- ---------------------------------------------------------------------------
-- 0090: register the sbi_recompute maintenance job (REZ-33)
--
-- sbi_scores was written once (Spec-11 backfill, 21 May 2026) and never
-- recomputed; the nightly recompute is SbiRecomputeJob (etl/scoring/job.py),
-- dispatched through the admin queue from an etl_schedules row. Both
-- etl_job_queue and etl_schedules CHECK scraper_code against this allow-list,
-- so the code must be admitted here before a schedule can be created.
--
-- Widening only; CHECK re-validates on INSERT/UPDATE, so existing rows are
-- unaffected. List carries 0086's rename (bgmea_buying_house) forward.
-- ---------------------------------------------------------------------------
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
    'refresh_monitors',
    'sbi_recompute'
  ]
$$;
