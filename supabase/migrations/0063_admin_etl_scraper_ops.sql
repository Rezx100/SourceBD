-- 0063_admin_etl_scraper_ops.sql
-- Admin scraper operations: queue, schedules, admin RPCs, and audit trail.

create or replace function public.admin_etl_allowed_scraper_codes()
returns text[]
language sql
immutable
as $$
  select array[
    'bgmea_pdf',
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
    'brand_inditex',
    'brand_primark',
    'brand_asos',
    'brand_ms',
    'brand_next'
  ]::text[];
$$;

create or replace function public.admin_etl_assert_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;

  select role::text into v_role
    from public.profiles
   where id = v_uid;

  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;

  return v_uid;
end;
$$;

create table if not exists public.etl_job_queue (
  id uuid primary key default gen_random_uuid(),
  scraper_code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'success', 'failed', 'cancelled')),
  priority integer not null default 100,
  requested_by uuid references public.profiles(id),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  etl_run_id uuid references public.etl_runs(id),
  attempts integer not null default 0 check (attempts >= 0),
  error text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint etl_job_queue_scraper_known
    check (scraper_code = any (public.admin_etl_allowed_scraper_codes()))
);

create index if not exists idx_etl_job_queue_pending
  on public.etl_job_queue (priority asc, requested_at asc)
  where status = 'pending';

create index if not exists idx_etl_job_queue_scraper
  on public.etl_job_queue (scraper_code, requested_at desc);

create index if not exists idx_etl_job_queue_status
  on public.etl_job_queue (status, requested_at desc);

create table if not exists public.etl_schedules (
  scraper_code text primary key,
  enabled boolean not null default false,
  interval_minutes integer not null default 1440
    check (interval_minutes between 60 and 43200),
  next_run_at timestamptz,
  last_enqueued_at timestamptz,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint etl_schedules_scraper_known
    check (scraper_code = any (public.admin_etl_allowed_scraper_codes()))
);

create index if not exists idx_etl_schedules_due
  on public.etl_schedules (next_run_at asc)
  where enabled = true;

alter table public.etl_job_queue enable row level security;
alter table public.etl_schedules enable row level security;
revoke all on public.etl_job_queue from anon, authenticated;
revoke all on public.etl_schedules from anon, authenticated;

drop trigger if exists trg_etl_job_queue_touch on public.etl_job_queue;
create trigger trg_etl_job_queue_touch
  before update on public.etl_job_queue
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_etl_schedules_touch on public.etl_schedules;
create trigger trg_etl_schedules_touch
  before update on public.etl_schedules
  for each row execute function public.touch_updated_at();

create or replace function public.admin_etl_enqueue(
  p_scraper_code text,
  p_priority integer default 100,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := public.admin_etl_assert_admin();
  v_existing public.etl_job_queue%rowtype;
  v_job_id uuid;
  v_priority integer := coalesce(p_priority, 100);
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if p_scraper_code is null or not (p_scraper_code = any (public.admin_etl_allowed_scraper_codes())) then
    raise exception 'unknown scraper_code' using errcode = '22023';
  end if;

  select * into v_existing
    from public.etl_job_queue
   where scraper_code = p_scraper_code
     and status in ('pending', 'running')
   order by requested_at desc
   limit 1;

  if found then
    return jsonb_build_object(
      'job_id', v_existing.id,
      'status', v_existing.status,
      'scraper_code', v_existing.scraper_code,
      'already_queued', true
    );
  end if;

  insert into public.etl_job_queue (scraper_code, priority, requested_by, metadata)
  values (p_scraper_code, greatest(0, v_priority), v_uid, v_metadata)
  returning id into v_job_id;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, metadata)
  values (
    v_uid,
    'admin_etl_enqueue',
    'etl_job_queue',
    v_job_id,
    jsonb_build_object('scraper_code', p_scraper_code, 'priority', v_priority)
  );

  return jsonb_build_object(
    'job_id', v_job_id,
    'status', 'pending',
    'scraper_code', p_scraper_code,
    'already_queued', false
  );
end;
$$;

create or replace function public.admin_etl_schedule_upsert(
  p_scraper_code text,
  p_enabled boolean,
  p_interval_minutes integer,
  p_next_run_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := public.admin_etl_assert_admin();
  v_interval integer := coalesce(p_interval_minutes, 1440);
  v_enabled boolean := coalesce(p_enabled, false);
  v_next timestamptz;
begin
  if p_scraper_code is null or not (p_scraper_code = any (public.admin_etl_allowed_scraper_codes())) then
    raise exception 'unknown scraper_code' using errcode = '22023';
  end if;

  if v_interval < 60 or v_interval > 43200 then
    raise exception 'interval_minutes must be between 60 and 43200' using errcode = '22023';
  end if;

  v_next := case
    when v_enabled then coalesce(p_next_run_at, now() + make_interval(mins => v_interval))
    else null
  end;

  insert into public.etl_schedules (
    scraper_code,
    enabled,
    interval_minutes,
    next_run_at,
    created_by,
    updated_by
  )
  values (p_scraper_code, v_enabled, v_interval, v_next, v_uid, v_uid)
  on conflict (scraper_code) do update set
    enabled = excluded.enabled,
    interval_minutes = excluded.interval_minutes,
    next_run_at = excluded.next_run_at,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning next_run_at into v_next;

  insert into public.admin_audit_log (actor_id, action, target_table, metadata)
  values (
    v_uid,
    'admin_etl_schedule_upsert',
    'etl_schedules',
    jsonb_build_object(
      'scraper_code', p_scraper_code,
      'enabled', v_enabled,
      'interval_minutes', v_interval,
      'next_run_at', v_next
    )
  );

  return jsonb_build_object(
    'scraper_code', p_scraper_code,
    'enabled', v_enabled,
    'interval_minutes', v_interval,
    'next_run_at', v_next
  );
end;
$$;

create or replace function public.admin_etl_job_decide(
  p_job_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := public.admin_etl_assert_admin();
  v_job public.etl_job_queue%rowtype;
  v_new_status text;
begin
  if p_job_id is null then
    raise exception 'job_id required' using errcode = '22023';
  end if;

  select * into v_job
    from public.etl_job_queue
   where id = p_job_id
   for update;

  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;

  if p_action = 'cancel' then
    if v_job.status <> 'pending' then
      raise exception 'only pending jobs can be cancelled' using errcode = 'P0001';
    end if;
    update public.etl_job_queue
       set status = 'cancelled',
           finished_at = now(),
           error = null
     where id = p_job_id;
    v_new_status := 'cancelled';
  elsif p_action = 'retry' then
    if v_job.status not in ('failed', 'cancelled') then
      raise exception 'only failed or cancelled jobs can be retried' using errcode = 'P0001';
    end if;
    update public.etl_job_queue
       set status = 'pending',
           started_at = null,
           finished_at = null,
           etl_run_id = null,
           error = null
     where id = p_job_id;
    v_new_status := 'pending';
  else
    raise exception 'action must be cancel or retry' using errcode = '22023';
  end if;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, metadata)
  values (
    v_uid,
    'admin_etl_job_' || p_action,
    'etl_job_queue',
    p_job_id,
    jsonb_build_object('scraper_code', v_job.scraper_code, 'previous_status', v_job.status)
  );

  return jsonb_build_object('job_id', p_job_id, 'status', v_new_status);
end;
$$;

create or replace function public.admin_etl_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := public.admin_etl_assert_admin();
  v_scrapers jsonb;
  v_recent_runs jsonb;
  v_recent_jobs jsonb;
  v_summary jsonb;
begin
  with allowed(code) as (
    select unnest(public.admin_etl_allowed_scraper_codes())
  ),
  latest_run as (
    select distinct on (er.scraper_code)
           er.*
      from public.etl_runs er
     order by er.scraper_code, er.started_at desc
  ),
  last_success as (
    select er.scraper_code, max(er.finished_at) as finished_at
      from public.etl_runs er
     where er.status = 'success'
       and er.finished_at is not null
     group by er.scraper_code
  ),
  job_counts as (
    select q.scraper_code,
           count(*) filter (where q.status = 'pending') as pending_jobs,
           count(*) filter (where q.status = 'running') as running_jobs,
           count(*) filter (where q.status = 'failed') as failed_jobs
      from public.etl_job_queue q
     group by q.scraper_code
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'scraper_code', a.code,
               'last_success_at', ls.finished_at,
               'latest_run', case when lr.id is null then null else jsonb_build_object(
                 'id', lr.id,
                 'status', lr.status,
                 'started_at', lr.started_at,
                 'finished_at', lr.finished_at,
                 'records_seen', lr.records_seen,
                 'records_upserted', lr.records_upserted,
                 'records_skipped', lr.records_skipped,
                 'error', lr.error,
                 'meta', lr.meta
               ) end,
               'schedule', case when s.scraper_code is null then null else jsonb_build_object(
                 'enabled', s.enabled,
                 'interval_minutes', s.interval_minutes,
                 'next_run_at', s.next_run_at,
                 'last_enqueued_at', s.last_enqueued_at,
                 'updated_at', s.updated_at
               ) end,
               'queue', jsonb_build_object(
                 'pending', coalesce(j.pending_jobs, 0),
                 'running', coalesce(j.running_jobs, 0),
                 'failed', coalesce(j.failed_jobs, 0)
               )
             )
             order by a.code
           ),
           '[]'::jsonb
         )
    into v_scrapers
    from allowed a
    left join latest_run lr on lr.scraper_code = a.code
    left join last_success ls on ls.scraper_code = a.code
    left join public.etl_schedules s on s.scraper_code = a.code
    left join job_counts j on j.scraper_code = a.code;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', r.id,
               'scraper_code', r.scraper_code,
               'status', r.status,
               'started_at', r.started_at,
               'finished_at', r.finished_at,
               'records_seen', r.records_seen,
               'records_upserted', r.records_upserted,
               'records_skipped', r.records_skipped,
               'error', r.error,
               'meta', r.meta
             )
             order by r.started_at desc
           ),
           '[]'::jsonb
         )
    into v_recent_runs
    from (
      select *
        from public.etl_runs
       order by started_at desc
       limit 50
    ) r;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', q.id,
               'scraper_code', q.scraper_code,
               'status', q.status,
               'priority', q.priority,
               'requested_at', q.requested_at,
               'started_at', q.started_at,
               'finished_at', q.finished_at,
               'etl_run_id', q.etl_run_id,
               'attempts', q.attempts,
               'error', q.error,
               'metadata', q.metadata
             )
             order by q.requested_at desc
           ),
           '[]'::jsonb
         )
    into v_recent_jobs
    from (
      select *
        from public.etl_job_queue
       order by requested_at desc
       limit 50
    ) q;

  select jsonb_build_object(
           'last_success_at', (select max(finished_at) from public.etl_runs where status = 'success'),
           'running_jobs', (select count(*) from public.etl_job_queue where status = 'running'),
           'pending_jobs', (select count(*) from public.etl_job_queue where status = 'pending'),
           'failed_jobs', (select count(*) from public.etl_job_queue where status = 'failed'),
           'enabled_schedules', (select count(*) from public.etl_schedules where enabled = true),
           'next_scheduled_at', (select min(next_run_at) from public.etl_schedules where enabled = true)
         )
    into v_summary;

  return jsonb_build_object(
    'summary', v_summary,
    'scrapers', v_scrapers,
    'recent_runs', v_recent_runs,
    'recent_jobs', v_recent_jobs,
    'generated_at', now()
  );
end;
$$;

comment on function public.admin_etl_dashboard() is
  'Admin-only scraper operations dashboard. SECURITY DEFINER; exposes ETL run and queue summaries.';
comment on function public.admin_etl_enqueue(text, integer, jsonb) is
  'Admin-only enqueue of a SourceBD scraper run. Writes etl_job_queue and admin_audit_log.';
comment on function public.admin_etl_schedule_upsert(text, boolean, integer, timestamptz) is
  'Admin-only timer setup for SourceBD scrapers. Writes etl_schedules and admin_audit_log.';
comment on function public.admin_etl_job_decide(uuid, text) is
  'Admin-only cancel/retry for queued scraper jobs. Writes admin_audit_log.';

revoke all on function public.admin_etl_allowed_scraper_codes() from public;
revoke all on function public.admin_etl_assert_admin() from public;
revoke all on function public.admin_etl_dashboard() from public;
revoke all on function public.admin_etl_enqueue(text, integer, jsonb) from public;
revoke all on function public.admin_etl_schedule_upsert(text, boolean, integer, timestamptz) from public;
revoke all on function public.admin_etl_job_decide(uuid, text) from public;

grant execute on function public.admin_etl_dashboard() to authenticated;
grant execute on function public.admin_etl_enqueue(text, integer, jsonb) to authenticated;
grant execute on function public.admin_etl_schedule_upsert(text, boolean, integer, timestamptz) to authenticated;
grant execute on function public.admin_etl_job_decide(uuid, text) to authenticated;
grant execute on function public.admin_etl_allowed_scraper_codes() to service_role;
