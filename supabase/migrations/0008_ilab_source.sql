-- 0008_ilab_source
-- Adds the US Department of Labor ILAB List of Goods source row used by the
-- ilab_tvpra scraper. UK_OFSI and EU_SANC source rows already seeded by
-- 0001_phase0_core.sql.

insert into public.sources (code, display_name, tier, base_url) values
  ('ILAB',
   'US DoL ILAB List of Goods Produced by Child or Forced Labor',
   'tier5_regulatory',
   'https://www.dol.gov/agencies/ilab/reports/child-labor/list-of-goods')
on conflict (code) do nothing;
