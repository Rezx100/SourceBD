-- 0135 — The record is sealed each hour, the seals chain, and the latest is stamped outside each day (6 Oct 2026).
--
-- Plan: .impeccable/handoff-admin-moderation.md, section 4.3 "Tamper-proofing" and build item 1e.
--
-- WHAT
-- ----
--   1. activity_seals: one row per sealed window. entries_hash is the sha256 of every entry in the window
--      (id, time, kind, actor, target and the entry's own fingerprint, one line each, in id order);
--      seal_hash is the sha256 of the previous seal's seal_hash and this one's entries_hash, window and
--      count. Changing any old entry changes its window's entries_hash, which changes that seal and every
--      seal after it. Append-only like the record: a seal's only later change is its outside stamp, once.
--   2. ledger_seal(): seals every whole hour that ended at least five minutes ago and is not yet sealed
--      (one row per hour, so a job that was down for a day writes the hours it missed). The five minutes
--      are for a write that was in flight when the hour turned: a transaction that commits late lands in
--      the window its time says, and the window is sealed only when such a write cannot still be coming.
--   3. ledger_verify(): recomputes every seal from the entries and the chain, oldest first, and reports the
--      first that no longer matches; also how many entries wait for their hour. Admin only. Its result is
--      kept in activity_ledger_jobs so the Data page shows the last verdict.
--   4. ledger_seal_stamp / ledger_seal_mailed: the daily job (service role) stores the outside timestamp
--      authority's token for the newest seal (which chains every seal before it) and notes that the stamp
--      was emailed to the outside mailbox. admin_ledger_health() gives the Data page its figures.
--   5. rl_check learns 'email:ledger_stamp' (0119's shape).
--
-- The entries themselves are never touched: the seals are a second table. A seal can also be checked by
-- anyone holding the entries, the seals and the token, with the checking script of phase 5.
--
-- Dry run: ops/plans/0135-dry-run.md.
--
-- REVERSE
-- -------
--   drop function public.admin_ledger_health();
--   drop function public.ledger_latest_seal();
--   drop function public.ledger_seal_mailed(bigint, text);
--   drop function public.ledger_seal_stamp(bigint, text, bytea, timestamptz);
--   drop function public.ledger_verify();
--   drop function public.ledger_seal();
--   drop function public._ledger_entries_hash(timestamptz, timestamptz);
--   drop function public._ledger_seal_hash(text, text, timestamptz, timestamptz, int);
--   drop trigger trg_activity_seals_guard on public.activity_seals; drop function public._ledger_seals_guard();
--   drop table public.activity_seals;
--   re-run the rl_check patch without 'email:ledger_stamp'.

set search_path = public;

-- ----------------------------------------------------------------------
-- 5. rl_check knows the stamp email's bucket
-- ----------------------------------------------------------------------

do $$
declare
  v_def  text := pg_get_functiondef('public.rl_check(text, text, integer)'::regprocedure);
  v_new  text := v_def;
  v_name text;
begin
  foreach v_name in array array['email:ledger_stamp']
  loop
    if position(quote_literal(v_name) in v_new) = 0 then
      if position('''email:password_reset''' in v_new) = 0 then
        raise exception 'rl_check has no email:password_reset anchor; patch by hand';
      end if;
      v_new := replace(v_new, '''email:password_reset''', '''email:password_reset'', ' || quote_literal(v_name));
    end if;
    if position(quote_literal(v_name) in v_new) = 0 then
      raise exception 'rl_check patch did not add %', v_name;
    end if;
  end loop;

  if v_new <> v_def then
    execute v_new;
  end if;
end
$$;

-- ----------------------------------------------------------------------
-- 1. The seals
-- ----------------------------------------------------------------------

create table if not exists public.activity_seals (
  id              bigint      generated always as identity primary key,
  period_start    timestamptz not null,
  period_end      timestamptz not null,
  first_entry_id  bigint,
  last_entry_id   bigint,
  entry_count     int         not null,
  entries_hash    text        not null,
  prev_seal_hash  text,
  seal_hash       text        not null,
  sealed_at       timestamptz not null default clock_timestamp(),
  tsa_url         text,
  tsa_token       bytea,
  tsa_time        timestamptz,
  stamped_at      timestamptz,
  stamp_mailbox   text,
  stamp_mailed_at timestamptz,
  constraint activity_seals_window check (period_end > period_start),
  constraint activity_seals_hash_shape check (entries_hash ~ '^[0-9a-f]{64}$' and seal_hash ~ '^[0-9a-f]{64}$'
                                              and (prev_seal_hash is null or prev_seal_hash ~ '^[0-9a-f]{64}$')),
  constraint activity_seals_stamp_pair check ((tsa_token is null) = (stamped_at is null))
);

create unique index if not exists uq_activity_seals_period on public.activity_seals (period_start);
create index if not exists idx_activity_seals_unstamped on public.activity_seals (id desc) where tsa_token is null;

comment on table public.activity_seals is
  '0135: hourly seals of activity_ledger, chained by hash; the newest is stamped by an outside timestamp authority daily.';

alter table public.activity_seals enable row level security;
revoke all on table public.activity_seals from public, anon, authenticated, service_role;
grant select on table public.activity_seals to service_role;

-- A seal changes once: when its outside stamp arrives, and once more when that stamp is noted as mailed.
create or replace function public._ledger_seals_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'the seals are append-only: % is refused', tg_op using errcode = '42501';
  end if;
  if new.id <> old.id or new.period_start <> old.period_start or new.period_end <> old.period_end
     or new.first_entry_id is distinct from old.first_entry_id or new.last_entry_id is distinct from old.last_entry_id
     or new.entry_count <> old.entry_count or new.entries_hash <> old.entries_hash
     or new.prev_seal_hash is distinct from old.prev_seal_hash or new.seal_hash <> old.seal_hash
     or new.sealed_at <> old.sealed_at then
    raise exception 'a seal cannot be rewritten' using errcode = '42501';
  end if;
  if old.tsa_token is not null and (new.tsa_token is distinct from old.tsa_token or new.tsa_url is distinct from old.tsa_url
                                    or new.tsa_time is distinct from old.tsa_time or new.stamped_at is distinct from old.stamped_at) then
    raise exception 'a seal is stamped once' using errcode = '42501';
  end if;
  if old.stamp_mailed_at is not null and (new.stamp_mailed_at is distinct from old.stamp_mailed_at or new.stamp_mailbox is distinct from old.stamp_mailbox) then
    raise exception 'a stamp is mailed once' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_activity_seals_guard on public.activity_seals;
create trigger trg_activity_seals_guard
  before update or delete on public.activity_seals
  for each row execute function public._ledger_seals_guard();
drop trigger if exists trg_activity_seals_no_truncate on public.activity_seals;
create trigger trg_activity_seals_no_truncate
  before truncate on public.activity_seals
  for each statement execute function public._ledger_refuse_change();

-- ----------------------------------------------------------------------
-- 2. Hashing and sealing
-- ----------------------------------------------------------------------

-- The sha256 of a window's entries, one line each in id order; the window's count, first and last id too.
create or replace function public._ledger_entries_hash(p_start timestamptz, p_end timestamptz)
returns table (entries_hash text, entry_count int, first_entry_id bigint, last_entry_id bigint)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_lines text;
  v_n     int;
  v_first bigint;
  v_last  bigint;
begin
  select string_agg(
           l.id::text || '|' || to_char(l.at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || l.kind || '|'
             || coalesce(l.actor_id::text, '') || '|' || coalesce(l.target_table, '') || '|' || coalesce(l.target_id::text, '')
             || '|' || l.content_hash,
           E'\n' order by l.id),
         count(*), min(l.id), max(l.id)
    into v_lines, v_n, v_first, v_last
    from public.activity_ledger l
   where l.at >= p_start and l.at < p_end;
  return query select encode(extensions.digest(coalesce(v_lines, ''), 'sha256'), 'hex'), v_n::int, v_first, v_last;
end;
$$;

create or replace function public._ledger_seal_hash(p_prev text, p_entries text, p_start timestamptz, p_end timestamptz, p_count int)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(
    coalesce(p_prev, '') || '|' || p_entries || '|'
      || to_char(p_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '|'
      || to_char(p_end at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '|' || p_count::text,
    'sha256'), 'hex');
$$;

revoke all on function public._ledger_entries_hash(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public._ledger_seal_hash(text, text, timestamptz, timestamptz, int) from public, anon, authenticated;

-- Seals every whole hour that ended at least five minutes ago and is not sealed yet. The first seal starts
-- at the hour of the oldest entry. Answers how many seals were written and the newest seal.
create or replace function public.ledger_seal(p_now timestamptz default clock_timestamp())
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_cutoff timestamptz := date_trunc('hour', p_now - interval '5 minutes');
  v_start  timestamptz;
  v_prev   text;
  v_n      int := 0;
  h        record;
  v_hash   text;
  v_last   record;
begin
  if coalesce(auth.role(), '') not in ('', 'service_role') then
    raise exception 'ledger_seal is for the service role' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ledger_seal', 0));

  select s.period_end, s.seal_hash into v_start, v_prev
    from public.activity_seals s order by s.id desc limit 1;
  if v_start is null then
    select date_trunc('hour', min(l.at)) into v_start from public.activity_ledger l;
    if v_start is null then
      return jsonb_build_object('sealed', 0, 'reason', 'no entries yet');
    end if;
  end if;

  while v_start + interval '1 hour' <= v_cutoff loop
    select * into h from public._ledger_entries_hash(v_start, v_start + interval '1 hour');
    v_hash := public._ledger_seal_hash(v_prev, h.entries_hash, v_start, v_start + interval '1 hour', h.entry_count);
    insert into public.activity_seals (period_start, period_end, first_entry_id, last_entry_id, entry_count, entries_hash, prev_seal_hash, seal_hash)
    values (v_start, v_start + interval '1 hour', h.first_entry_id, h.last_entry_id, h.entry_count, h.entries_hash, v_prev, v_hash);
    v_prev  := v_hash;
    v_start := v_start + interval '1 hour';
    v_n     := v_n + 1;
  end loop;

  select s.id, s.period_end, s.seal_hash, s.entry_count into v_last from public.activity_seals s order by s.id desc limit 1;
  return jsonb_build_object('sealed', v_n, 'sealed_through', v_last.period_end, 'latest_seal_id', v_last.id,
                            'latest_seal_hash', v_last.seal_hash, 'latest_entry_count', v_last.entry_count);
end;
$$;

comment on function public.ledger_seal(timestamptz) is
  '0135: seals each whole hour that ended five minutes ago or more; one activity_seals row per hour, chained. Service role.';

revoke all     on function public.ledger_seal(timestamptz) from public, anon, authenticated;
grant  execute on function public.ledger_seal(timestamptz) to service_role;

-- ----------------------------------------------------------------------
-- 3. Verifying
-- ----------------------------------------------------------------------

create or replace function public.ledger_verify()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    text;
  s         record;
  h         record;
  v_prev    text := null;
  v_checked int := 0;
  v_broken  bigint := null;
  v_why     text := null;
  v_unsealed int;
  v_out     jsonb;
begin
  -- An admin from the page, or the service role / owner from the job.
  if v_uid is not null then
    select p.role::text into v_role from public.profiles p where p.id = v_uid;
    if v_role is distinct from 'admin' then
      raise insufficient_privilege using message = 'admin only';
    end if;
  elsif coalesce(auth.role(), '') not in ('', 'service_role') then
    raise insufficient_privilege using message = 'admin only';
  end if;

  for s in select * from public.activity_seals order by id loop
    v_checked := v_checked + 1;
    select * into h from public._ledger_entries_hash(s.period_start, s.period_end);
    if h.entries_hash <> s.entries_hash or h.entry_count <> s.entry_count then
      v_broken := s.id;
      v_why := format('the entries of %s to %s no longer match the seal (%s entries now, %s sealed)',
                      s.period_start, s.period_end, h.entry_count, s.entry_count);
      exit;
    end if;
    if s.prev_seal_hash is distinct from v_prev then
      v_broken := s.id;
      v_why := format('seal %s does not chain to the seal before it', s.id);
      exit;
    end if;
    if s.seal_hash <> public._ledger_seal_hash(s.prev_seal_hash, s.entries_hash, s.period_start, s.period_end, s.entry_count) then
      v_broken := s.id;
      v_why := format('seal %s does not match its own fields', s.id);
      exit;
    end if;
    v_prev := s.seal_hash;
  end loop;

  select count(*) into v_unsealed from public.activity_ledger l
   where l.at >= coalesce((select max(x.period_end) from public.activity_seals x), '-infinity'::timestamptz);

  v_out := jsonb_build_object(
    'ok',               v_broken is null,
    'seals_checked',    v_checked,
    'first_broken_seal', v_broken,
    'why',              v_why,
    'unsealed_entries', v_unsealed,
    'checked_at',       now());

  insert into public.activity_ledger_jobs (name, ran_at, copied, note)
  values ('verify', now(), 0, v_out::text)
  on conflict (name) do update set ran_at = excluded.ran_at, note = excluded.note;

  return v_out;
end;
$$;

comment on function public.ledger_verify() is
  '0135: recomputes every seal from the entries and the chain, oldest first; reports the first break and the entries not yet sealed. Admin or service role.';

revoke all     on function public.ledger_verify() from public, anon;
grant  execute on function public.ledger_verify() to authenticated, service_role;

-- ----------------------------------------------------------------------
-- 4. The outside stamp
-- ----------------------------------------------------------------------

create or replace function public.ledger_seal_stamp(p_seal_id bigint, p_tsa_url text, p_token bytea, p_tsa_time timestamptz)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') not in ('', 'service_role') then
    raise exception 'ledger_seal_stamp is for the service role' using errcode = '42501';
  end if;
  if p_token is null or length(p_token) = 0 or p_tsa_url is null or p_tsa_time is null then
    raise exception 'a token, its authority and its time are required' using errcode = '22023';
  end if;
  update public.activity_seals
     set tsa_url = p_tsa_url, tsa_token = p_token, tsa_time = p_tsa_time, stamped_at = now()
   where id = p_seal_id and tsa_token is null;
  return found;
end;
$$;

create or replace function public.ledger_seal_mailed(p_seal_id bigint, p_mailbox text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') not in ('', 'service_role') then
    raise exception 'ledger_seal_mailed is for the service role' using errcode = '42501';
  end if;
  update public.activity_seals
     set stamp_mailbox = p_mailbox, stamp_mailed_at = now()
   where id = p_seal_id and tsa_token is not null and stamp_mailed_at is null;
  return found;
end;
$$;

revoke all     on function public.ledger_seal_stamp(bigint, text, bytea, timestamptz) from public, anon, authenticated;
grant  execute on function public.ledger_seal_stamp(bigint, text, bytea, timestamptz) to service_role;
revoke all     on function public.ledger_seal_mailed(bigint, text) from public, anon, authenticated;
grant  execute on function public.ledger_seal_mailed(bigint, text) to service_role;

-- The newest seal, for the daily job: what to stamp, or that it is stamped already.
create or replace function public.ledger_latest_seal()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s record;
begin
  if coalesce(auth.role(), '') not in ('', 'service_role') then
    raise exception 'ledger_latest_seal is for the service role' using errcode = '42501';
  end if;
  select * into s from public.activity_seals order by id desc limit 1;
  if s.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'id', s.id, 'period_start', s.period_start, 'period_end', s.period_end, 'entry_count', s.entry_count,
    'seal_hash', s.seal_hash, 'prev_seal_hash', s.prev_seal_hash,
    'stamped', s.tsa_token is not null, 'tsa_url', s.tsa_url, 'tsa_time', s.tsa_time,
    'mailed', s.stamp_mailed_at is not null);
end;
$$;

revoke all     on function public.ledger_latest_seal() from public, anon, authenticated;
grant  execute on function public.ledger_latest_seal() to service_role;

-- What the Data page shows: entries, the last seal, the last outside stamp, the last verify verdict.
create or replace function public.admin_ledger_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
  v_last record;
  v_stamp record;
  v_verify text;
  v_entries bigint;
  v_oldest timestamptz;
  v_unsealed bigint;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;
  select p.role::text into v_role from public.profiles p where p.id = v_uid;
  if v_role is distinct from 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;

  select count(*), min(l.at) into v_entries, v_oldest from public.activity_ledger l;
  select s.id, s.period_end, s.seal_hash, s.sealed_at, s.entry_count into v_last
    from public.activity_seals s order by s.id desc limit 1;
  select s.id, s.tsa_url, s.tsa_time, s.stamped_at, s.stamp_mailbox, s.stamp_mailed_at into v_stamp
    from public.activity_seals s where s.tsa_token is not null order by s.id desc limit 1;
  select j.note into v_verify from public.activity_ledger_jobs j where j.name = 'verify';
  select count(*) into v_unsealed from public.activity_ledger l
   where l.at >= coalesce(v_last.period_end, '-infinity'::timestamptz);

  return jsonb_build_object(
    'entries',          v_entries,
    'oldest_entry_at',  v_oldest,
    'unsealed_entries', v_unsealed,
    'last_seal',        case when v_last.id is null then null else jsonb_build_object(
                          'id', v_last.id, 'sealed_through', v_last.period_end, 'seal_hash', v_last.seal_hash,
                          'sealed_at', v_last.sealed_at, 'entry_count', v_last.entry_count) end,
    'last_stamp',       case when v_stamp.id is null then null else jsonb_build_object(
                          'seal_id', v_stamp.id, 'tsa_url', v_stamp.tsa_url, 'tsa_time', v_stamp.tsa_time,
                          'stamped_at', v_stamp.stamped_at, 'mailbox', v_stamp.stamp_mailbox, 'mailed_at', v_stamp.stamp_mailed_at) end,
    'last_verify',      case when v_verify is null then null else v_verify::jsonb end);
end;
$$;

revoke all     on function public.admin_ledger_health() from public, anon;
grant  execute on function public.admin_ledger_health() to authenticated;
