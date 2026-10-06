-- 0131 — The activity record: every dealing written down once, by the database, and never changed (6 Oct 2026).
--
-- Plan: .impeccable/handoff-admin-moderation.md, section 4.1 "The record" and build item 1a.
--
-- WHAT
-- ----
--   1. public.activity_ledger: one row per action. When (the server's clock), who (account, their email
--      at that moment, role, company), the session, the IP address Supabase saw and the one our server
--      forwarded, the browser, what kind of action, what it was done to, the other party, and a full copy
--      of the content as it stood. Append-only: no role may update or delete a row, RLS is on with no
--      policy, and a trigger refuses UPDATE, DELETE and TRUNCATE for everyone, the owner included.
--   2. _ledger_write(): the one writer. It fills in who and where from auth.uid(), auth.users, profiles,
--      the request's JWT and headers, and fingerprints the entry (sha256 over kind, target, actor, time
--      and content). Not callable by any client role; the triggers call it as owner.
--   3. Triggers on the dealing tables (messages, conversations, files, RFQs, quotes, orders, milestones),
--      so a new code path cannot forget: INSERT, UPDATE and DELETE each write an entry with the row
--      before and after and the list of changed columns. Every edit is therefore a kept version. A
--      message's text is never copied: its sha256 is (the fingerprint the plan asks for) and the
--      encrypted row itself stays. A touch that changes only updated_at or last_message_at is not an event.
--
-- WHO IS THE ACTOR
-- ---------------
-- auth.uid() when there is a signed-in caller (every SECURITY DEFINER function runs as the caller's
-- identity for auth.uid(), so the buyer who accepts a quote is the actor of 'quote.accepted' even though
-- the row belongs to the supplier); otherwise the row's own actor column (a service or ETL write).
--
-- WHERE IT CAME FROM
-- ------------------
-- PostgREST exposes the request headers as request.headers. Two addresses are kept: x-forwarded-for as
-- the gateway saw it, and x-sourcebd-ip as our server forwarded it (1b teaches the server to send it, with
-- x-sourcebd-ua). Trust the forwarded one only when the gateway's is our own server; that judgement is
-- the reader's, so both are kept raw.
--
-- Deploy order: safe before the code (1b). Until the headers are sent, the address columns are null.
--
-- Dry run: ops/plans/0131-dry-run.md (ops/dry_run_0131_activity_ledger.py).
--
-- REVERSE
-- -------
--   for each table: drop trigger trg_<table>_ledger on public.<table>;
--   drop function public._ledger_row_change();
--   drop function public._ledger_write(text, text, uuid, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text);
--   drop function public._ledger_request();
--   drop function public._ledger_actor(uuid);
--   drop function public._ledger_inet(text);
--   drop trigger trg_activity_ledger_no_truncate on public.activity_ledger;
--   drop trigger trg_activity_ledger_no_change on public.activity_ledger;
--   drop function public._ledger_refuse_change();
--   drop table public.activity_ledger;   -- the one delete this file ever allows, and only by hand

set search_path = public;

-- ----------------------------------------------------------------------
-- 1. The table
-- ----------------------------------------------------------------------

create table if not exists public.activity_ledger (
  id             bigint      generated always as identity primary key,
  at             timestamptz not null,
  actor_id       uuid,
  actor_email    text,
  actor_role     text,
  actor_company  text,
  session_id     uuid,
  ip_gateway     inet,
  ip_forwarded   inet,
  user_agent     text,
  kind           text        not null,
  target_table   text,
  target_id      uuid,
  other_party_id uuid,
  supplier_id    uuid,
  thread_id      uuid,
  rfq_id         uuid,
  order_id       uuid,
  case_id        uuid,
  content        jsonb       not null default '{}'::jsonb,
  content_hash   text        not null,
  reason         text,
  constraint activity_ledger_kind_shape check (kind ~ '^[a-z_]+\.[a-z_]+$'),
  constraint activity_ledger_hash_shape check (content_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.activity_ledger is
  '0131: the activity record. Append-only (trigger + grants + RLS); written only by _ledger_write(); '
  'each hour''s entries are sealed (0135). Read through admin RPCs only.';

create index if not exists idx_activity_ledger_at        on public.activity_ledger (at desc);
create index if not exists idx_activity_ledger_actor     on public.activity_ledger (actor_id, at desc);
create index if not exists idx_activity_ledger_kind      on public.activity_ledger (kind, at desc);
create index if not exists idx_activity_ledger_target    on public.activity_ledger (target_table, target_id);
create index if not exists idx_activity_ledger_supplier  on public.activity_ledger (supplier_id, at desc) where supplier_id is not null;
create index if not exists idx_activity_ledger_thread    on public.activity_ledger (thread_id) where thread_id is not null;
create index if not exists idx_activity_ledger_rfq       on public.activity_ledger (rfq_id) where rfq_id is not null;
create index if not exists idx_activity_ledger_order     on public.activity_ledger (order_id) where order_id is not null;
create index if not exists idx_activity_ledger_other     on public.activity_ledger (other_party_id, at desc) where other_party_id is not null;
create index if not exists idx_activity_ledger_ip        on public.activity_ledger (ip_forwarded) where ip_forwarded is not null;

alter table public.activity_ledger enable row level security;
revoke all on table public.activity_ledger from public, anon, authenticated, service_role;
grant select on table public.activity_ledger to service_role;

-- Nobody edits the record. The owner can only drop the trigger, which is visible.
create or replace function public._ledger_refuse_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'the activity record is append-only: % is refused', tg_op using errcode = '42501';
end;
$$;

drop trigger if exists trg_activity_ledger_no_change on public.activity_ledger;
create trigger trg_activity_ledger_no_change
  before update or delete on public.activity_ledger
  for each row execute function public._ledger_refuse_change();

drop trigger if exists trg_activity_ledger_no_truncate on public.activity_ledger;
create trigger trg_activity_ledger_no_truncate
  before truncate on public.activity_ledger
  for each statement execute function public._ledger_refuse_change();

-- ----------------------------------------------------------------------
-- 2. Who and where
-- ----------------------------------------------------------------------

-- An address as text, or null when it is not one ("" or a name). A trailing :port is dropped.
create or replace function public._ledger_inet(p text)
returns inet
language plpgsql
immutable
as $$
declare
  v text := btrim(coalesce(p, ''));
begin
  if v = '' then
    return null;
  end if;
  if v ~ '^\d{1,3}(\.\d{1,3}){3}:\d+$' then
    v := split_part(v, ':', 1);
  end if;
  return v::inet;
exception when others then
  return null;
end;
$$;

create or replace function public._ledger_request()
returns table (ip_gateway inet, ip_forwarded inet, user_agent text, session_id uuid)
language plpgsql
stable
as $$
declare
  h   jsonb;
  sid uuid;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    h := null;
  end;
  begin
    sid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when others then
    sid := null;
  end;
  return query
    select public._ledger_inet(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)),
           public._ledger_inet(h ->> 'x-sourcebd-ip'),
           left(coalesce(nullif(h ->> 'x-sourcebd-ua', ''), h ->> 'user-agent'), 400),
           sid;
end;
$$;

create or replace function public._ledger_actor(p_actor uuid)
returns table (actor_email text, actor_role text, actor_company text)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_email   text;
  v_role    text;
  v_company text;
begin
  if p_actor is null then
    return;
  end if;
  select u.email::text, p.role::text into v_email, v_role
    from auth.users u
    left join public.profiles p on p.id = u.id
   where u.id = p_actor;
  select s.company_name into v_company
    from public.suppliers s where s.claimed_by = p_actor order by s.created_at limit 1;
  if v_company is null then
    -- buyer_settings.company_name arrived with 0106; a database without it names no company
    -- rather than failing every write.
    begin
      select bs.company_name into v_company from public.buyer_settings bs where bs.owner_id = p_actor;
    exception when undefined_column or undefined_table then
      v_company := null;
    end;
  end if;
  return query select v_email, v_role, v_company;
end;
$$;

revoke all on function public._ledger_inet(text) from public, anon, authenticated;
revoke all on function public._ledger_request() from public, anon, authenticated;
revoke all on function public._ledger_actor(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------
-- 3. The one writer
-- ----------------------------------------------------------------------

create or replace function public._ledger_write(
  p_kind         text,
  p_target_table text,
  p_target_id    uuid,
  p_content      jsonb,
  p_actor        uuid default null,
  p_other        uuid default null,
  p_supplier     uuid default null,
  p_thread       uuid default null,
  p_rfq          uuid default null,
  p_order        uuid default null,
  p_case         uuid default null,
  p_reason       text default null
)
returns bigint
language plpgsql
volatile
security definer
set search_path = public, auth, extensions
as $$
declare
  v_actor   uuid        := coalesce(p_actor, auth.uid());
  v_at      timestamptz := clock_timestamp();
  v_content jsonb       := coalesce(p_content, '{}'::jsonb);
  a         record;
  r         record;
  v_hash    text;
  v_id      bigint;
begin
  if p_kind is null or p_kind !~ '^[a-z_]+\.[a-z_]+$' then
    raise exception 'ledger kind must be <noun>.<verb>, got %', p_kind using errcode = '22023';
  end if;
  select * into a from public._ledger_actor(v_actor);
  select * into r from public._ledger_request();
  v_hash := encode(extensions.digest(
    p_kind || '|' || coalesce(p_target_table, '') || '|' || coalesce(p_target_id::text, '') || '|'
      || coalesce(v_actor::text, '') || '|' || to_char(v_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      || '|' || v_content::text,
    'sha256'), 'hex');

  insert into public.activity_ledger (
    at, actor_id, actor_email, actor_role, actor_company, session_id,
    ip_gateway, ip_forwarded, user_agent,
    kind, target_table, target_id, other_party_id, supplier_id, thread_id, rfq_id, order_id, case_id,
    content, content_hash, reason
  ) values (
    v_at, v_actor, a.actor_email, a.actor_role, a.actor_company, r.session_id,
    r.ip_gateway, r.ip_forwarded, r.user_agent,
    p_kind, p_target_table, p_target_id, p_other, p_supplier, p_thread, p_rfq, p_order, p_case,
    v_content, v_hash, nullif(btrim(coalesce(p_reason, '')), '')
  )
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public._ledger_write(text, text, uuid, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text) is
  '0131: the only writer of activity_ledger. Fills in who (auth.uid() or the given actor; email, role, company) '
  'and where (session, addresses, browser from the request), fingerprints the entry. Owner-only.';

revoke all on function public._ledger_write(text, text, uuid, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;

-- ----------------------------------------------------------------------
-- 4. The dealing tables write themselves down
-- ----------------------------------------------------------------------

create or replace function public._ledger_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_new      jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old      jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_row      jsonb := coalesce(case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end, '{}'::jsonb);
  v_changed  text[] := '{}';
  v_noun     text;
  v_kind     text;
  v_target   uuid;
  v_actor    uuid;
  v_other    uuid;
  v_supplier uuid;
  v_thread   uuid;
  v_rfq      uuid;
  v_order    uuid;
  v_content  jsonb;
  v_status   text;
  v_prev     text;
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), '{}') into v_changed
      from jsonb_object_keys(v_new) k
     where v_new -> k is distinct from v_old -> k;
    v_changed := array_remove(array_remove(v_changed, 'updated_at'), 'last_message_at');
    if cardinality(v_changed) = 0 then
      return null;                                  -- a touch is not an event
    end if;
  end if;

  v_target := nullif(v_row ->> 'id', '')::uuid;
  v_status := v_row ->> 'status';
  v_prev   := v_old ->> 'status';

  case tg_table_name
    when 'messages' then
      v_noun     := 'message';
      v_actor    := nullif(v_row ->> 'sender_id', '')::uuid;
      v_thread   := nullif(v_row ->> 'thread_id', '')::uuid;
      select t.supplier_id,
             (select tp.user_id from public.thread_participants tp
               where tp.thread_id = t.id and tp.user_id is distinct from v_actor
               order by tp.created_at limit 1)
        into v_supplier, v_other
        from public.message_threads t where t.id = v_thread;
      -- The text is never copied: its fingerprint is. The ciphertext leaves the copy too.
      v_new := case when v_new is null then null else v_new - 'body_ciphertext' end;
      v_old := case when v_old is null then null else v_old - 'body_ciphertext' end;
      if tg_op = 'INSERT' then
        v_kind := 'message.sent';
        -- A body the key cannot open (a row written under another key) is recorded as unreadable: the
        -- record never stops a message, and "no fingerprint" is itself a fact worth keeping.
        begin
          v_content := jsonb_build_object(
            'after', v_new,
            'body_sha256', encode(extensions.digest(pgp_sym_decrypt(new.body_ciphertext, public._messages_key()), 'sha256'), 'hex'));
        exception when others then
          v_content := jsonb_build_object('after', v_new, 'body_sha256', null, 'body_unreadable', true);
        end;
      end if;

    when 'message_threads' then
      v_noun     := 'conversation';
      v_actor    := nullif(v_row ->> 'buyer_id', '')::uuid;
      v_thread   := v_target;
      v_supplier := nullif(v_row ->> 'supplier_id', '')::uuid;
      v_rfq      := nullif(v_row ->> 'rfq_id', '')::uuid;
      select s.claimed_by into v_other from public.suppliers s where s.id = v_supplier;
      if tg_op = 'INSERT' then v_kind := 'conversation.opened'; end if;

    when 'message_attachments' then
      v_noun     := 'message';
      v_thread   := nullif(v_row ->> 'thread_id', '')::uuid;
      select m.sender_id into v_actor from public.messages m where m.id = nullif(v_row ->> 'message_id', '')::uuid;
      select t.supplier_id into v_supplier from public.message_threads t where t.id = v_thread;
      if tg_op = 'INSERT' then v_kind := 'message.file_attached'; end if;

    when 'rfqs' then
      v_noun  := 'rfq';
      v_actor := nullif(v_row ->> 'buyer_id', '')::uuid;
      v_rfq   := v_target;
      if tg_op = 'INSERT' then
        v_kind := 'rfq.sent';
      elsif tg_op = 'UPDATE' and v_status is distinct from v_prev then
        v_kind := 'rfq.' || v_status;                 -- rfq.accepted, rfq.closed, rfq.cancelled
      end if;

    when 'rfq_quotes' then
      v_noun     := 'quote';
      v_actor    := nullif(v_row ->> 'submitted_by', '')::uuid;
      v_rfq      := nullif(v_row ->> 'rfq_id', '')::uuid;
      v_supplier := nullif(v_row ->> 'supplier_id', '')::uuid;
      select r.buyer_id into v_other from public.rfqs r where r.id = v_rfq;
      if tg_op = 'INSERT' then
        v_kind := 'quote.submitted';
      elsif tg_op = 'UPDATE' and v_status is distinct from v_prev then
        v_kind := 'quote.' || v_status;               -- quote.accepted, quote.rejected, quote.withdrawn, quote.submitted (a resubmit)
      end if;

    when 'orders' then
      v_noun     := 'order';
      v_actor    := nullif(v_row ->> 'buyer_id', '')::uuid;
      v_order    := v_target;
      v_supplier := nullif(v_row ->> 'supplier_id', '')::uuid;
      v_rfq      := nullif(v_row ->> 'rfq_id', '')::uuid;
      select s.claimed_by into v_other from public.suppliers s where s.id = v_supplier;
      if tg_op = 'INSERT' then
        v_kind := 'order.created';
      elsif tg_op = 'UPDATE' and v_status = 'cancelled' and v_prev is distinct from 'cancelled' then
        v_kind := 'order.cancelled';
      end if;

    when 'order_milestones' then
      v_noun  := 'order';
      v_actor := nullif(v_row ->> 'created_by', '')::uuid;
      v_order := nullif(v_row ->> 'order_id', '')::uuid;
      select o.supplier_id, o.rfq_id into v_supplier, v_rfq from public.orders o where o.id = v_order;
      if tg_op = 'INSERT' then v_kind := 'order.milestone_added'; end if;

    else
      raise exception '0131: no ledger mapping for %', tg_table_name;
  end case;

  if v_kind is null then
    v_kind := v_noun || '.' || case tg_op when 'UPDATE' then 'updated' when 'DELETE' then 'deleted' else 'created' end;
  end if;
  if v_content is null then
    v_content := case tg_op
      when 'INSERT' then jsonb_build_object('after', v_new)
      when 'DELETE' then jsonb_build_object('before', v_old)
      else jsonb_build_object('after', v_new, 'before', v_old, 'changed', to_jsonb(v_changed))
    end;
  end if;

  perform public._ledger_write(
    v_kind, tg_table_name, v_target, v_content,
    coalesce(auth.uid(), v_actor), v_other, v_supplier, v_thread, v_rfq, v_order, null, null
  );
  return null;
end;
$$;

revoke all on function public._ledger_row_change() from public, anon, authenticated;

-- A table a database does not have yet (message_attachments came with 0112) is skipped with a notice;
-- the migration that creates it later must add the trigger (0112 is not re-run). The replay has all seven.
do $$
declare
  t text;
begin
  foreach t in array array[
    'messages', 'message_threads', 'message_attachments', 'rfqs', 'rfq_quotes', 'orders', 'order_milestones'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice '0131: public.% does not exist here; no ledger trigger on it', t;
      continue;
    end if;
    execute format('drop trigger if exists trg_%s_ledger on public.%I', t, t);
    execute format(
      'create trigger trg_%s_ledger after insert or update or delete on public.%I '
      'for each row execute function public._ledger_row_change()',
      t, t
    );
  end loop;
end
$$;
