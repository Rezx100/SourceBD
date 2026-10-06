-- 0130 — A suspended account is stopped by the database, not only at the website's front door (6 Oct 2026).
--
-- Plan: .impeccable/handoff-admin-moderation.md, section 3 ("A ban that can be walked around") and build item 0f.
--
-- THE GAP, PROVEN FROM THE CODE
-- ----------------------------
-- `profiles.is_suspended` (0041) is read in exactly one place that stops anything: middleware.ts, which
-- redirects a suspended person away from /app, /supplier, /admin and /api/v1. No RLS policy and no
-- SECURITY DEFINER function checks it (grep: 0041, 0051, 0052 set it; 0113 skips suspended people when
-- sending alert emails; nothing else reads it). The Supabase client in the browser holds the session's
-- own token, and PostgREST does not pass through our middleware, so a suspended person with a live
-- session could call thread_send_message, rfq_create, rfq_quote_submit, order_create,
-- order_milestone_add, claim_initiate or supplier_relationship_request directly and be served. The
-- middleware's only other effect was to stop refreshing the session cookie, which the browser client
-- does for itself.
--
-- WHAT
-- ----
--   1. _account_can_act(user): raises 42501 "This account is suspended." when the profile is suspended.
--      One place to extend when the enforcement ladder (warn, restrict, ban) lands.
--   2. One BEFORE INSERT trigger on each table where a person acts, reading the actor from that table's
--      own column: messages.sender_id, message_threads.buyer_id, rfqs.buyer_id, rfq_quotes.submitted_by,
--      orders.buyer_id, order_milestones.created_by, claim_requests.claimant_user_id,
--      supplier_relationships.initiated_by. A trigger fires inside every SECURITY DEFINER function and
--      for every role, so no function body needs a new line and no new code path can forget.
--   3. Suspending ends the person's sessions: an AFTER UPDATE trigger on profiles deletes their
--      auth.sessions rows (and with them, in Supabase, the refresh tokens), so the session cannot renew.
--      The access token already issued can still READ for up to an hour (its lifetime); it cannot write.
--
-- Hard invariants honoured: server enforces (rule 7); SECURITY DEFINER with pinned search_path; the
-- helper is executable by nobody but the triggers that call it as owner.
--
-- Deploy order: safe before or after the code. The messages, RFQs, orders and claims routes already map
-- sqlstate 42501 to 403.
--
-- Dry run: ops/plans/0130-dry-run.md (ops/dry_run_0130_suspension.py).
--
-- REVERSE
-- -------
--   drop trigger trg_profiles_end_sessions_on_suspend on public.profiles;
--   drop function public._end_sessions_on_suspend();
--   for each table: drop trigger trg_<table>_refuse_suspended on public.<table>;
--   drop function public._refuse_suspended_actor();
--   drop function public._account_can_act(uuid);

set search_path = public;

-- ----------------------------------------------------------------------
-- 1. The one check
-- ----------------------------------------------------------------------

create or replace function public._account_can_act(p_user uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_suspended boolean;
begin
  if p_user is null then
    return;
  end if;
  select coalesce(p.is_suspended, false) into v_suspended
    from public.profiles p
   where p.id = p_user;
  if v_suspended then
    raise exception 'This account is suspended.' using errcode = '42501';
  end if;
end;
$$;

comment on function public._account_can_act(uuid) is
  '0130: raises 42501 when the account is suspended. Called by the BEFORE INSERT triggers on every table '
  'where a person acts; the enforcement ladder extends this one function.';

revoke all on function public._account_can_act(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------
-- 2. The triggers
-- ----------------------------------------------------------------------

create or replace function public._refuse_suspended_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_col   text;
  v_actor uuid;
begin
  v_col := case tg_table_name
    when 'messages'               then 'sender_id'
    when 'message_threads'        then 'buyer_id'
    when 'rfqs'                   then 'buyer_id'
    when 'rfq_quotes'             then 'submitted_by'
    when 'orders'                 then 'buyer_id'
    when 'order_milestones'       then 'created_by'
    when 'claim_requests'         then 'claimant_user_id'
    when 'supplier_relationships' then 'initiated_by'
    else null
  end;
  if v_col is null then
    raise exception '0130: no actor column known for %', tg_table_name;
  end if;
  v_actor := nullif(to_jsonb(new) ->> v_col, '')::uuid;
  perform public._account_can_act(v_actor);
  return new;
end;
$$;

revoke all on function public._refuse_suspended_actor() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'messages', 'message_threads', 'rfqs', 'rfq_quotes', 'orders', 'order_milestones',
    'claim_requests', 'supplier_relationships'
  ] loop
    execute format('drop trigger if exists trg_%s_refuse_suspended on public.%I', t, t);
    execute format(
      'create trigger trg_%s_refuse_suspended before insert on public.%I '
      'for each row execute function public._refuse_suspended_actor()',
      t, t
    );
  end loop;
end
$$;

-- ----------------------------------------------------------------------
-- 3. Suspending ends the sessions
-- ----------------------------------------------------------------------

create or replace function public._end_sessions_on_suspend()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if coalesce(new.is_suspended, false) and not coalesce(old.is_suspended, false) then
    delete from auth.sessions s where s.user_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public._end_sessions_on_suspend() from public, anon, authenticated;

drop trigger if exists trg_profiles_end_sessions_on_suspend on public.profiles;
create trigger trg_profiles_end_sessions_on_suspend
  after update of is_suspended on public.profiles
  for each row execute function public._end_sessions_on_suspend();

comment on trigger trg_profiles_end_sessions_on_suspend on public.profiles is
  '0130: suspending an account deletes its auth.sessions rows, so no session of theirs can renew.';
