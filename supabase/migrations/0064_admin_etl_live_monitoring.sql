-- 0064_admin_etl_live_monitoring.sql
-- Live scraper monitoring for non-technical admin operators.

alter table public.etl_job_queue
  add column if not exists progress_seen integer not null default 0,
  add column if not exists progress_upserted integer not null default 0,
  add column if not exists progress_skipped integer not null default 0,
  add column if not exists progress_matched integer not null default 0,
  add column if not exists progress_message text,
  add column if not exists heartbeat_at timestamptz;

create index if not exists idx_etl_job_queue_heartbeat
  on public.etl_job_queue (heartbeat_at desc)
  where status = 'running';

create table if not exists public.etl_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.etl_job_queue(id) on delete cascade,
  etl_run_id uuid references public.etl_runs(id),
  scraper_code text not null,
  event_type text not null
    check (event_type in ('queued','claimed','started','progress','success','failed','cancelled')),
  message text not null,
  records_seen integer not null default 0,
  records_upserted integer not null default 0,
  records_skipped integer not null default 0,
  records_matched integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_etl_job_events_job_created
  on public.etl_job_events (job_id, created_at desc);

create index if not exists idx_etl_job_events_scraper_created
  on public.etl_job_events (scraper_code, created_at desc);

alter table public.etl_job_events enable row level security;
revoke all on public.etl_job_events from anon, authenticated;

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

  insert into public.etl_job_queue (
    scraper_code,
    priority,
    requested_by,
    metadata,
    progress_message,
    heartbeat_at
  )
  values (
    p_scraper_code,
    greatest(0, v_priority),
    v_uid,
    v_metadata,
    'Queued. The VPS worker will pick this up within about one minute.',
    now()
  )
  returning id into v_job_id;

  insert into public.etl_job_events (job_id, scraper_code, event_type, message, meta)
  values (
    v_job_id,
    p_scraper_code,
    'queued',
    'Queued by admin. The VPS worker will pick this up within about one minute.',
    jsonb_build_object('requested_by', v_uid, 'priority', v_priority)
  );

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
           error = null,
           progress_message = 'Cancelled before the VPS worker started it.',
           heartbeat_at = now()
     where id = p_job_id;
    insert into public.etl_job_events (job_id, scraper_code, event_type, message, meta)
    values (
      p_job_id,
      v_job.scraper_code,
      'cancelled',
      'Cancelled before the VPS worker started it.',
      jsonb_build_object('actor_id', v_uid)
    );
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
           error = null,
           progress_seen = 0,
           progress_upserted = 0,
           progress_skipped = 0,
           progress_matched = 0,
           progress_message = 'Retry queued. The VPS worker will pick this up within about one minute.',
           heartbeat_at = now()
     where id = p_job_id;
    insert into public.etl_job_events (job_id, scraper_code, event_type, message, meta)
    values (
      p_job_id,
      v_job.scraper_code,
      'queued',
      'Retry queued by admin. The VPS worker will pick this up within about one minute.',
      jsonb_build_object('actor_id', v_uid, 'previous_status', v_job.status)
    );
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
  active_job as (
    select distinct on (q.scraper_code)
           q.*
      from public.etl_job_queue q
     where q.status in ('pending', 'running')
     order by q.scraper_code,
              case q.status when 'running' then 0 else 1 end,
              q.requested_at asc
  ),
  job_counts as (
    select q.scraper_code,
           count(*) filter (where q.status = 'pending') as pending_jobs,
           count(*) filter (where q.status = 'running') as running_jobs,
           count(*) filter (where q.status = 'failed') as failed_jobs
      from public.etl_job_queue q
     group by q.scraper_code
  ),
  event_json as (
    select e.job_id,
           jsonb_agg(
             jsonb_build_object(
               'id', e.id,
               'event_type', e.event_type,
               'message', e.message,
               'records_seen', e.records_seen,
               'records_upserted', e.records_upserted,
               'records_skipped', e.records_skipped,
               'records_matched', e.records_matched,
               'created_at', e.created_at,
               'meta', e.meta
             )
             order by e.created_at desc
           ) as events
      from (
        select *
          from public.etl_job_events
         order by created_at desc
         limit 300
      ) e
     group by e.job_id
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
               'active_job', case when aj.id is null then null else jsonb_build_object(
                 'id', aj.id,
                 'status', aj.status,
                 'requested_at', aj.requested_at,
                 'started_at', aj.started_at,
                 'finished_at', aj.finished_at,
                 'etl_run_id', aj.etl_run_id,
                 'attempts', aj.attempts,
                 'error', aj.error,
                 'progress_seen', aj.progress_seen,
                 'progress_upserted', aj.progress_upserted,
                 'progress_skipped', aj.progress_skipped,
                 'progress_matched', aj.progress_matched,
                 'progress_message', aj.progress_message,
                 'heartbeat_at', aj.heartbeat_at,
                 'events', coalesce(ej.events, '[]'::jsonb)
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
    left join job_counts j on j.scraper_code = a.code
    left join active_job aj on aj.scraper_code = a.code
    left join event_json ej on ej.job_id = aj.id;

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

  with event_json as (
    select e.job_id,
           jsonb_agg(
             jsonb_build_object(
               'id', e.id,
               'event_type', e.event_type,
               'message', e.message,
               'records_seen', e.records_seen,
               'records_upserted', e.records_upserted,
               'records_skipped', e.records_skipped,
               'records_matched', e.records_matched,
               'created_at', e.created_at,
               'meta', e.meta
             )
             order by e.created_at desc
           ) as events
      from (
        select *
          from public.etl_job_events
         order by created_at desc
         limit 300
      ) e
     group by e.job_id
  )
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
               'metadata', q.metadata,
               'progress_seen', q.progress_seen,
               'progress_upserted', q.progress_upserted,
               'progress_skipped', q.progress_skipped,
               'progress_matched', q.progress_matched,
               'progress_message', q.progress_message,
               'heartbeat_at', q.heartbeat_at,
               'events', coalesce(ej.events, '[]'::jsonb)
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
    ) q
    left join event_json ej on ej.job_id = q.id;

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

comment on table public.etl_job_events is
  'Live admin-facing progress events for scraper queue jobs. RLS locked; admin reads through admin_etl_dashboard().';
