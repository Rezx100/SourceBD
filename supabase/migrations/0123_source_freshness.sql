-- 0123 — how fresh each source is: the Sources page and the daily Slack digest.
-- Spec: context/feature-specs/spec-etl-freshness.md, slice S3 (§4.1, §4.7, §4.9).
--
-- WHY
-- ---
-- Nothing says when a source was last read in full, whether that is within
-- the age its facts may reach (§3), how often it has failed in a row, what it
-- spent this month, or when its circuit breaker last stopped it. One function
-- answers all of that from etl_runs, etl_schedules and evidence_documents; the
-- Sources page (admin) and the ETL's daily digest (service role) both read it.
--
--   * `etl_source_freshness()` — one row per source with a schedule or a run in
--     the last 120 days. A "complete read" is a run that succeeded, says it was
--     complete (`meta.complete`, written since S1/S3) and has no reconcile
--     marked partial. Service role only.
--   * `admin_source_freshness()` — the same rows for an admin, plus this
--     month's Firecrawl credits against the 1,500 ceiling (founder, 6 Oct).
--   * Schedule rows for the four certificate bodies (spec §2), DISABLED: GOTS
--     and WRAP daily, OEKO-TEX and SA8000 weekly. The founder enables them in
--     /admin/sources. The sanctions rows gain a 02:00 UTC window; the window,
--     jitter and age limit live in `etl_schedules.metadata` (`run_window_utc`,
--     `jitter_minutes`, `max_age_hours`), as S1 started, so no column is added
--     and the ETL code needs nothing new to read them.
--
-- Needs 0122 (certificate listing_status) applied first.
--
-- REVERSE
-- -------
--   drop function if exists public.admin_source_freshness();
--   drop function if exists public.etl_source_freshness();
--   delete from public.etl_schedules
--    where scraper_code in ('gots', 'wrap', 'oeko_tex', 'sa8000') and not enabled
--      and metadata ->> 'spec' = 'etl-freshness S3';
--   update public.etl_schedules set metadata = metadata - 'run_window_utc' - 'jitter_minutes'
--    where metadata ->> 'spec' = 'etl-freshness S1';

-- ---------------------------------------------------------------------------
-- 1. Schedules
-- ---------------------------------------------------------------------------
insert into public.etl_schedules (scraper_code, enabled, interval_minutes, metadata)
values
  ('gots',     false, 1440,  '{"spec": "etl-freshness S3", "max_age_hours": 72,  "run_window_utc": 3, "jitter_minutes": 15}'),
  ('wrap',     false, 1440,  '{"spec": "etl-freshness S3", "max_age_hours": 72,  "run_window_utc": 3, "jitter_minutes": 15}'),
  ('oeko_tex', false, 10080, '{"spec": "etl-freshness S3", "max_age_hours": 240, "run_window_utc": 4, "jitter_minutes": 30}'),
  ('sa8000',   false, 10080, '{"spec": "etl-freshness S3", "max_age_hours": 240, "run_window_utc": 4, "jitter_minutes": 30}')
on conflict (scraper_code) do nothing;

update public.etl_schedules
   set metadata = metadata || '{"run_window_utc": 2, "jitter_minutes": 15}'::jsonb
 where metadata ->> 'spec' = 'etl-freshness S1'
   and not metadata ? 'run_window_utc';

-- ---------------------------------------------------------------------------
-- 2. Per-source freshness
-- ---------------------------------------------------------------------------
create or replace function public.etl_source_freshness()
returns table (
  scraper_code      text,
  enabled           boolean,
  interval_minutes  int,
  max_age_hours     int,
  next_run_at       timestamptz,
  last_complete_at  timestamptz,
  age_hours         numeric,
  over_sla          boolean,
  failures_in_row   int,
  last_breaker_trip timestamptz,
  credits_month     int,
  no_longer_listed  int,
  last_runs         jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with codes as (
    select s.scraper_code from public.etl_schedules s
    union
    select r.scraper_code from public.etl_runs r
     where r.started_at > now() - interval '120 days'
       and r.scraper_code <> 'freshness_digest'
  ),
  complete as (
    select r.scraper_code, max(r.finished_at) as at
      from public.etl_runs r
     where r.status = 'success'
       and coalesce((r.meta ->> 'complete')::boolean, true)
       and not exists (
         select 1 from jsonb_each(coalesce(r.meta -> 'reconcile', '{}'::jsonb)) e
          where e.value ->> 'action' in ('partial', 'unavailable'))
     group by r.scraper_code
  )
  select
    c.scraper_code,
    coalesce(s.enabled, false),
    s.interval_minutes,
    (s.metadata ->> 'max_age_hours')::int,
    s.next_run_at,
    k.at,
    round((extract(epoch from now() - k.at) / 3600)::numeric, 1),
    case when s.metadata ? 'max_age_hours'
         then k.at is null or now() - k.at > make_interval(hours => (s.metadata ->> 'max_age_hours')::int)
    end,
    (select count(*)::int from public.etl_runs f
      where f.scraper_code = c.scraper_code and f.status = 'failed'
        and f.started_at > coalesce((select max(g.started_at) from public.etl_runs g
                                      where g.scraper_code = c.scraper_code
                                        and g.status in ('success', 'held')), '-infinity')),
    (select max(h.finished_at) from public.etl_runs h
      where h.scraper_code = c.scraper_code and h.status = 'held'),
    (select coalesce(sum(d.credits_used), 0)::int from public.evidence_documents d
      where d.scraper_code = c.scraper_code and d.created_at >= date_trunc('month', now())),
    (select count(*)::int from public.certifications x
      where x.kind::text = c.scraper_code and x.listing_status = 'no_longer_listed')
      + (select count(*)::int from public.sanctions_list_entries y
          where y.list::text = c.scraper_code and y.listing_status = 'no_longer_listed'),
    (select coalesce(jsonb_agg(jsonb_build_object(
               'started_at', l.started_at, 'status', l.status,
               'seen', l.records_seen, 'upserted', l.records_upserted, 'skipped', l.records_skipped)
             order by l.started_at desc), '[]'::jsonb)
       from (select * from public.etl_runs z where z.scraper_code = c.scraper_code
              order by z.started_at desc limit 5) l)
  from codes c
  left join public.etl_schedules s on s.scraper_code = c.scraper_code
  left join complete k on k.scraper_code = c.scraper_code
  order by c.scraper_code
$$;

revoke all on function public.etl_source_freshness() from public, anon, authenticated;
grant execute on function public.etl_source_freshness() to service_role;

create or replace function public.admin_source_freshness()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  perform public.admin_etl_assert_admin();
  return jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(f)) from public.etl_source_freshness() f), '[]'::jsonb),
    'credits_month', (select coalesce(sum(d.credits_used), 0)::int from public.evidence_documents d
                       where d.created_at >= date_trunc('month', now())),
    'credits_ceiling', 1500
  );
end;
$$;

revoke all on function public.admin_source_freshness() from public, anon;
grant execute on function public.admin_source_freshness() to authenticated;
