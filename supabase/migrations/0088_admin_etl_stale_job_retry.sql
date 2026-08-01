-- 0088_admin_etl_stale_job_retry.sql
-- Guarded manual escape hatch for zombie queue jobs (REZ-31 follow-up).
--
-- The worker reaper (etl/jobs/scraper_queue.py reap_stale) fails stale
-- running jobs automatically, but an operator may need to clear one by hand
-- before the next cron pass. Until now admin_etl_job_decide rejected running
-- jobs outright, so a zombie could only be cleared with manual SQL. This
-- keeps the rejection for genuinely live jobs and opens it only under the
-- reaper's own staleness predicate, which a live job can never match because
-- it heartbeats.

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
  v_stale boolean;
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

  -- Same predicate as the reaper: a running job whose newest liveness
  -- timestamp is older than 3 hours is a zombie (its worker is dead), so a
  -- manual retry/cancel can never interrupt live work.
  v_stale := v_job.status = 'running'
             and coalesce(v_job.heartbeat_at, v_job.started_at, v_job.requested_at)
                   < now() - interval '3 hours';

  if p_action = 'cancel' then
    if v_job.status <> 'pending' and not v_stale then
      raise exception 'only pending jobs can be cancelled' using errcode = 'P0001';
    end if;
    update public.etl_job_queue
       set status = 'cancelled',
           finished_at = now(),
           error = null,
           progress_message = case when v_stale
                then 'Stale job cancelled; the dead worker will not pick it back up.'
                else 'Cancelled before the VPS worker started it.' end,
           heartbeat_at = now()
     where id = p_job_id;
    insert into public.etl_job_events (job_id, scraper_code, event_type, message, meta)
    values (
      p_job_id,
      v_job.scraper_code,
      'cancelled',
      case when v_stale
           then 'Stale job cancelled by admin; its worker had stopped heartbeating, so no live run was interrupted.'
           else 'Cancelled before the VPS worker started it.' end,
      jsonb_build_object('actor_id', v_uid)
    );
    v_new_status := 'cancelled';
  elsif p_action = 'retry' then
    if v_job.status not in ('failed', 'cancelled') and not v_stale then
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
      case when v_stale
           then 'Stale job retry queued by admin. The VPS worker will pick this up within about one minute.'
           else 'Retry queued by admin. The VPS worker will pick this up within about one minute.' end,
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

comment on function public.admin_etl_job_decide(uuid, text) is
  'Admin-only cancel/retry for queued scraper jobs. A running job may be cancelled or retried only when stale — coalesce(heartbeat_at, started_at, requested_at) older than 3 hours, the same predicate as the worker reaper (reap_stale in etl/jobs/scraper_queue.py). A live job heartbeats, so the guard can never double-fire a real run. Writes admin_audit_log.';

revoke all on function public.admin_etl_job_decide(uuid, text) from public;
grant execute on function public.admin_etl_job_decide(uuid, text) to authenticated;
