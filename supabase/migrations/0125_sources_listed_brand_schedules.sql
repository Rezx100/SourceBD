-- 0125 — sources we do not read leave the public counts; brand lists get a schedule.
-- Spec: context/feature-specs/spec-etl-freshness.md, slice S6 (§2, §7 decision 4).
--
-- WHY
-- ---
-- The public site counts every `sources` row (0117 `marketing_facts`), so it
-- claims sources we have never read: BEPZA, DIFE and RJSC have no scraper and
-- 0 records, and Inditex publishes no supplier list at all. Founder decision 4
-- (6 Oct 2026): they come out of the public list and counts until they are
-- read. Rows are not deleted: `sources.listed = false` hides them, and
-- flipping it back is how a source returns once its scraper exists.
--
-- Also: the four brand lists the spec keeps (H&M, Next, ASOS, M&S) get a
-- DISABLED schedule. The spec says quarterly; `etl_schedules` allows at most
-- 30 days, and a monthly read costs about 2 credits a brand, so they are
-- monthly with a 120-day age limit. Primark is paused: no schedule (it has
-- never yielded a record; its own spec retargets it).
--
-- `marketing_facts` below is 0117's body (live on 6 Oct 2026, md5 8879c3d7…)
-- with one filter added.
--
-- REVERSE
-- -------
--   (re-run 0117 for marketing_facts)
--   delete from public.etl_schedules where metadata ->> 'spec' = 'etl-freshness S6' and not enabled;
--   alter table public.sources drop column if exists listed;

alter table public.sources add column if not exists listed boolean not null default true;

comment on column public.sources.listed is
  'False for a source we do not read (no scraper, or the publisher has no list): left out of the public list and counts. Spec etl-freshness S6, founder decision 4 (6 Oct 2026).';

update public.sources
   set listed = false,
       notes = coalesce(notes || ' ', '') || case code
         when 'BRAND_INDITEX' then 'Retired 6 Oct 2026: Inditex publishes no supplier list.'
         else 'Not read yet (no scraper); hidden from public counts 6 Oct 2026.' end
 where code in ('BEPZA', 'DIFE', 'RJSC', 'BRAND_INDITEX')
   and listed;

create or replace function public.marketing_facts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with per as (
    select s.code,
           s.tier::text as tier,
           count(r.id)::int as records,
           count(distinct r.supplier_id)::int as suppliers,
           max(r.fetched_at)::date as latest
      from public.sources s
      left join public.source_records r on r.source_id = s.id
     where s.listed
     group by s.id, s.code, s.tier
  )
  select jsonb_build_object(
           'suppliers_published',   (select count(*) from public.suppliers where is_published),
           'sources_listed',        (select count(*) from per),
           'sources_with_records',  (select count(*) from per where records > 0),
           'certificates_on_file',  (select count(*) from public.certifications where rejected_at is null),
           'certificates_expired',  (select count(*) from public.certifications where rejected_at is null and expires_on < current_date),
           'rsc_records',           (select records from per where code = 'RSC'),
           'latest_read',           (select max(fetched_at) from public.source_records),
           'sources',               (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'tier', tier, 'records', records, 'suppliers', suppliers, 'latest', latest) order by tier, code), '[]'::jsonb) from per)
         );
$$;

revoke all     on function public.marketing_facts() from public;
grant  execute on function public.marketing_facts() to anon, authenticated, service_role;

insert into public.etl_schedules (scraper_code, enabled, interval_minutes, metadata)
values
  ('brand_hm',   false, 43200, '{"spec": "etl-freshness S6", "max_age_hours": 2880, "run_window_utc": 0, "jitter_minutes": 60}'),
  ('brand_next', false, 43200, '{"spec": "etl-freshness S6", "max_age_hours": 2880, "run_window_utc": 0, "jitter_minutes": 60}'),
  ('brand_asos', false, 43200, '{"spec": "etl-freshness S6", "max_age_hours": 2880, "run_window_utc": 0, "jitter_minutes": 60}'),
  ('brand_ms',   false, 43200, '{"spec": "etl-freshness S6", "max_age_hours": 2880, "run_window_utc": 0, "jitter_minutes": 60}')
on conflict (scraper_code) do nothing;
