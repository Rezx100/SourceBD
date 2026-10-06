-- 0124 — monthly register reads: schedule rows, all disabled.
-- Spec: context/feature-specs/spec-etl-freshness.md, slice S5 (§2, §3).
--
-- WHY
-- ---
-- The registers (BGMEA, BKMEA, BGAPMEA, EPB) were read in ad-hoc full passes
-- and are on no schedule; their facts may be 45 days old (§3). From S5 their
-- reads are cheap: BGMEA and BGAPMEA are read directly (no Firecrawl
-- credits), BGMEA and BKMEA read a member's detail page only when its list
-- row changed, and a monitor that sees a list page change queues the re-read
-- (at most once a day). This adds their monthly schedule rows, staggered
-- through the Dhaka night, DISABLED: the founder enables them in
-- /admin/sources. RSC (weekly, exists) gains its 14-day age limit.
--
-- Window, jitter and age limit live in `etl_schedules.metadata`, as S1/S3.
--
-- REVERSE
-- -------
--   delete from public.etl_schedules
--    where metadata ->> 'spec' = 'etl-freshness S5' and not enabled;
--   update public.etl_schedules set metadata = metadata - 'max_age_hours' - 'run_window_utc'
--    where scraper_code = 'rsc' and metadata ->> 'max_age_spec' = 'etl-freshness S5';

insert into public.etl_schedules (scraper_code, enabled, interval_minutes, metadata)
values
  ('epb_web',      false, 43200, '{"spec": "etl-freshness S5", "max_age_hours": 1080, "run_window_utc": 19, "jitter_minutes": 30}'),
  ('bkmea_web',    false, 43200, '{"spec": "etl-freshness S5", "max_age_hours": 1080, "run_window_utc": 20, "jitter_minutes": 30}'),
  ('bkmea_detail', false, 43200, '{"spec": "etl-freshness S5", "max_age_hours": 1080, "run_window_utc": 21, "jitter_minutes": 30}'),
  ('bgmea_web',    false, 43200, '{"spec": "etl-freshness S5", "max_age_hours": 1080, "run_window_utc": 22, "jitter_minutes": 30}'),
  ('bgapmea_web',  false, 43200, '{"spec": "etl-freshness S5", "max_age_hours": 1080, "run_window_utc": 23, "jitter_minutes": 30}')
on conflict (scraper_code) do nothing;

update public.etl_schedules
   set metadata = metadata
       || '{"max_age_hours": 336, "run_window_utc": 1, "jitter_minutes": 30, "max_age_spec": "etl-freshness S5"}'::jsonb
 where scraper_code = 'rsc'
   and not metadata ? 'max_age_hours';
