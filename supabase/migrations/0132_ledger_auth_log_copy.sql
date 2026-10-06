-- 0132 — Supabase's own sign-in log is copied into the activity record (6 Oct 2026).
--
-- Plan: .impeccable/handoff-admin-moderation.md, section 4.1 "Copy Supabase's own sign-in log into the ledger
-- daily; Supabase does not keep it forever" and build item 1b (with the forwarded address and browser,
-- which are code: lib/ledger/request-headers.ts; 0131 already reads them).
--
-- WHAT
-- ----
--   1. activity_ledger_jobs: where each copying job got to (a cursor), so a run copies only what is new and
--      a run that is cut short is simply resumed.
--   2. ledger_copy_auth_log(limit): reads auth.audit_log_entries after the cursor, oldest first, and writes
--      one entry per row: kind from the payload's action (login -> account.sign_in, logout -> account.sign_out,
--      user_signedup -> account.signed_up, user_recovery_requested -> account.password_reset_requested,
--      user_updated_password -> account.password_changed, user_deleted -> account.deleted, mfa_* ->
--      account.two_step_*, anything else -> account.auth_<action>), the actor from payload.actor_id, the
--      address Auth recorded as ip_gateway, and the whole payload as content with `occurred_at`, the time
--      Auth wrote it. The record's `at` is when the copy ran: the entry is the copy, and the copy is sealed.
--      Token refreshes are skipped: they are the session breathing, not an action.
--   3. Runs as service_role from the hourly job (1e, ops/ledger_cron.sh) or by hand.
--
-- Deploy order: safe any time after 0131.
--
-- Dry run: ops/plans/0132-dry-run.md.
--
-- REVERSE
-- -------
--   drop function public.ledger_copy_auth_log(int);
--   drop table public.activity_ledger_jobs;

set search_path = public;

create table if not exists public.activity_ledger_jobs (
  name      text        primary key,
  cursor_at timestamptz,
  cursor_id uuid,
  ran_at    timestamptz,
  copied    bigint      not null default 0,
  note      text
);

alter table public.activity_ledger_jobs enable row level security;
revoke all on table public.activity_ledger_jobs from public, anon, authenticated;
grant select on table public.activity_ledger_jobs to service_role;

create or replace function public._ledger_auth_kind(p_action text)
returns text
language sql
immutable
as $$
  select case p_action
    when 'login'                        then 'account.sign_in'
    when 'logout'                       then 'account.sign_out'
    when 'user_signedup'                then 'account.signed_up'
    when 'user_confirmation_requested'  then 'account.confirmation_requested'
    when 'user_recovery_requested'      then 'account.password_reset_requested'
    when 'user_updated_password'        then 'account.password_changed'
    when 'user_modified'                then 'account.modified'
    when 'user_deleted'                 then 'account.deleted'
    when 'user_repeated_signup'         then 'account.repeated_sign_up'
    when 'user_invited'                 then 'account.invited'
    when 'invite_accepted'              then 'account.invite_accepted'
    when 'user_reauthenticate_requested' then 'account.reauthentication_requested'
    when 'mfa_factor_enrolled'          then 'account.two_step_enrolled'
    when 'mfa_factor_unenrolled'        then 'account.two_step_removed'
    when 'mfa_challenge_verified'       then 'account.two_step_verified'
    when 'identity_linked'              then 'account.identity_linked'
    when 'identity_unlinked'            then 'account.identity_unlinked'
    else 'account.auth_' || regexp_replace(lower(coalesce(p_action, 'unknown')), '[^a-z_]+', '_', 'g')
  end;
$$;

revoke all on function public._ledger_auth_kind(text) from public, anon, authenticated;

create or replace function public.ledger_copy_auth_log(p_limit int default 1000)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_limit   int := greatest(1, least(coalesce(p_limit, 1000), 10000));
  v_cur_at  timestamptz;
  v_cur_id  uuid;
  v_n       int := 0;
  v_skipped int := 0;
  r         record;
  v_action  text;
  v_actor   uuid;
  v_hdr_old text := current_setting('request.headers', true);
begin
  -- Only the service role (the hourly job) or the owner (no request at all) may run this.
  if coalesce(auth.role(), '') not in ('', 'service_role') then
    raise exception 'ledger_copy_auth_log is for the service role' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ledger_copy_auth_log', 0));
  select j.cursor_at, j.cursor_id into v_cur_at, v_cur_id
    from public.activity_ledger_jobs j where j.name = 'auth_log';

  for r in
    select e.id, e.payload::jsonb as payload, e.created_at, e.ip_address
      from auth.audit_log_entries e
     where v_cur_at is null
        or e.created_at > v_cur_at
        or (e.created_at = v_cur_at and e.id > v_cur_id)
     order by e.created_at, e.id
     limit v_limit
  loop
    v_action := r.payload ->> 'action';
    v_cur_at := r.created_at;
    v_cur_id := r.id;
    if v_action in ('token_refreshed', 'token_revoked') then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    begin
      v_actor := nullif(r.payload ->> 'actor_id', '')::uuid;
    exception when others then
      v_actor := null;
    end;
    -- The address Auth recorded goes on the entry as the gateway's address: the one writer reads it from
    -- the request setting, so the setting is the Auth row's for the length of this write (and restored after
    -- the loop). The job's own request carries no visitor.
    perform set_config('request.headers', jsonb_build_object('x-forwarded-for', coalesce(r.ip_address, ''))::text, true);
    perform public._ledger_write(
      public._ledger_auth_kind(v_action),
      'auth.audit_log_entries',
      r.id,
      r.payload || jsonb_build_object('occurred_at', r.created_at, 'auth_ip', r.ip_address),
      v_actor, null, null, null, null, null, null, null
    );
    v_n := v_n + 1;
  end loop;
  perform set_config('request.headers', coalesce(v_hdr_old, ''), true);

  insert into public.activity_ledger_jobs (name, cursor_at, cursor_id, ran_at, copied, note)
  values ('auth_log', v_cur_at, v_cur_id, now(), v_n, format('%s copied, %s token refreshes skipped', v_n, v_skipped))
  on conflict (name) do update
    set cursor_at = excluded.cursor_at,
        cursor_id = excluded.cursor_id,
        ran_at    = excluded.ran_at,
        copied    = public.activity_ledger_jobs.copied + excluded.copied,
        note      = excluded.note;

  return jsonb_build_object('copied', v_n, 'skipped', v_skipped, 'cursor_at', v_cur_at, 'cursor_id', v_cur_id);
end;
$$;

comment on function public.ledger_copy_auth_log(int) is
  '0132: copies Auth''s audit log into the activity record after the kept cursor, oldest first; token '
  'refreshes skipped. Service role only (the hourly job).';

revoke all     on function public.ledger_copy_auth_log(int) from public, anon, authenticated;
grant  execute on function public.ledger_copy_auth_log(int) to service_role;
