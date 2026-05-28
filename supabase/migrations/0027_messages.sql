-- 0027 — Messages (Spec B6, Phase 2).
--
-- Buyer ↔ supplier messaging with:
--   * one thread per (buyer, supplier, rfq_id) tuple; rfq_id is nullable
--     today and reserved for Spec B7. UNIQUE NULLS NOT DISTINCT enforces
--     "one thread per buyer×supplier" until B7 fills rfq_id.
--   * 256-bit-at-rest encryption of message body via `pgp_sym_encrypt`
--     (CAST5/AES-256 envelope; default cipher in pgcrypto is AES; we force
--     `cipher-algo=aes256` to be explicit). The encryption passphrase is
--     read from a database GUC `app.messages_key` set out-of-band by ops
--     (`alter database postgres set app.messages_key = '<random hex>';`).
--   * Realtime broadcast via the `supabase_realtime` publication; clients
--     subscribe to `public.messages` and Supabase Realtime filters rows by
--     the SELECT RLS policy below (participants only). Clients receive
--     the encrypted bytea (meaningless to them) as a notification, then
--     refetch plaintext via `thread_messages(...)`.
--
-- Hard invariants:
--   * Direct INSERT/UPDATE/DELETE on `public.messages` is denied for
--     anon + authenticated — sends go exclusively through
--     `thread_send_message(...)` so the encryption key never has to leave
--     the database and ownership/participation is checked in one place.
--   * Column-level: only metadata columns are SELECTable; `body_ciphertext`
--     is REVOKED from authenticated/anon. The only path to plaintext is
--     `thread_messages(...)` which itself is participant-gated.
--   * Server route handlers must enforce `getServerRole()` before the RPC
--     call; RLS on these tables is the second line of defence.
--
-- Reversible:
--   alter publication supabase_realtime drop table public.messages;
--   drop function public.thread_messages(uuid, int, timestamptz);
--   drop function public.thread_send_message(uuid, text);
--   drop function public.thread_open(uuid, uuid, text);
--   drop function public.thread_list();
--   drop function public._messages_key();
--   drop trigger trg_messages_bump_thread on public.messages;
--   drop function public._messages_bump_thread();
--   drop table public.messages;
--   drop table public.thread_participants;
--   drop table public.message_threads;

-- ----------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------

create table if not exists public.message_threads (
  id              uuid        primary key default gen_random_uuid(),
  buyer_id        uuid        not null references auth.users(id)       on delete cascade,
  supplier_id     uuid        not null references public.suppliers(id) on delete cascade,
  rfq_id          uuid        null,
  subject         text        null,
  last_message_at timestamptz null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- NULLS NOT DISTINCT is PG15+. Treats two NULL rfq_ids as equal so a
  -- buyer cannot create multiple "no-RFQ" threads against the same
  -- supplier; one general thread, one thread per RFQ.
  constraint message_threads_unique unique nulls not distinct
    (buyer_id, supplier_id, rfq_id)
);

create index if not exists idx_message_threads_buyer_updated
  on public.message_threads (buyer_id, updated_at desc);
create index if not exists idx_message_threads_supplier
  on public.message_threads (supplier_id);

create table if not exists public.thread_participants (
  id         uuid        primary key default gen_random_uuid(),
  thread_id  uuid        not null references public.message_threads(id) on delete cascade,
  user_id    uuid        not null references auth.users(id)             on delete cascade,
  role       text        not null check (role in ('buyer','supplier','admin')),
  created_at timestamptz not null default now(),
  unique (thread_id, user_id)
);
create index if not exists idx_thread_participants_user
  on public.thread_participants (user_id);

create table if not exists public.messages (
  id              uuid        primary key default gen_random_uuid(),
  thread_id       uuid        not null references public.message_threads(id) on delete cascade,
  sender_id       uuid        not null references auth.users(id)             on delete cascade,
  body_ciphertext bytea       not null,
  body_len        int         not null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_messages_thread_created
  on public.messages (thread_id, created_at desc);

-- ----------------------------------------------------------------------
-- Encryption key helper
-- ----------------------------------------------------------------------

-- Reads `app.messages_key` from the current session/database GUC. Raises
-- if unset so a misconfigured environment fails loudly instead of
-- silently writing ciphertext that nobody can decrypt.
create or replace function public._messages_key()
returns text
language plpgsql
stable
as $$
declare
  k text := current_setting('app.messages_key', true);
begin
  if k is null or length(k) < 16 then
    raise exception 'messages encryption key is not configured (app.messages_key)';
  end if;
  return k;
end;
$$;

revoke all on function public._messages_key() from public;

-- ----------------------------------------------------------------------
-- Updated-at + last_message_at bump
-- ----------------------------------------------------------------------

create or replace function public._messages_bump_thread()
returns trigger
language plpgsql
as $$
begin
  update public.message_threads
     set last_message_at = new.created_at,
         updated_at      = now()
   where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists trg_messages_bump_thread on public.messages;
create trigger trg_messages_bump_thread
  after insert on public.messages
  for each row execute function public._messages_bump_thread();

-- ----------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------

alter table public.message_threads     enable row level security;
alter table public.thread_participants enable row level security;
alter table public.messages            enable row level security;

-- message_threads: visible to participants only. No direct writes.
drop policy if exists pol_threads_select_participant on public.message_threads;
create policy pol_threads_select_participant
  on public.message_threads
  for select
  to authenticated
  using (
    exists (
      select 1 from public.thread_participants tp
       where tp.thread_id = message_threads.id
         and tp.user_id   = auth.uid()
    )
  );

-- thread_participants: a participant can see only their own participant
-- row. Keeping the policy simple (`user_id = auth.uid()`) is essential —
-- otherwise the SELECT policy on `messages` (which sub-queries this
-- table) would re-trigger this policy and Postgres reports "infinite
-- recursion detected in policy". The full participant list for a thread
-- is exposed only via the security-definer RPCs (thread_list /
-- thread_messages), which already do their own participation check.
drop policy if exists pol_participants_select_self on public.thread_participants;
drop policy if exists pol_participants_select_self_thread on public.thread_participants;
create policy pol_participants_select_self
  on public.thread_participants
  for select
  to authenticated
  using (user_id = auth.uid());

-- messages: visible to thread participants only. No direct writes.
drop policy if exists pol_messages_select_participant on public.messages;
create policy pol_messages_select_participant
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.thread_participants tp
       where tp.thread_id = messages.thread_id
         and tp.user_id   = auth.uid()
    )
  );

-- Column-level: hide the ciphertext from direct SELECT. Realtime payloads
-- delivered to authenticated will contain only the metadata columns
-- listed below; the body is reachable only via thread_messages(...).
revoke all on public.messages from anon, authenticated;
grant  select (id, thread_id, sender_id, body_len, created_at)
  on  public.messages
  to  authenticated;

-- Threads + participants: PostgREST needs SELECT to apply RLS; writes are
-- still blocked because no INSERT/UPDATE/DELETE policy exists.
revoke all on public.message_threads     from anon, authenticated;
revoke all on public.thread_participants from anon, authenticated;
grant  select on public.message_threads     to authenticated;
grant  select on public.thread_participants to authenticated;

-- ----------------------------------------------------------------------
-- thread_open(p_supplier_id, p_rfq_id, p_subject)
--   Open the (caller, supplier, rfq) thread or return its existing id.
--   Adds the caller as 'buyer' participant. If the supplier row has a
--   `claimed_by` user, adds them as 'supplier' participant too.
-- ----------------------------------------------------------------------

create or replace function public.thread_open(
  p_supplier_id uuid,
  p_rfq_id      uuid default null,
  p_subject     text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_thread_id uuid;
  v_claimed   uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_supplier_id is null then
    raise exception 'supplier_id is required';
  end if;
  if not exists (
    select 1 from public.suppliers s
     where s.id = p_supplier_id and s.is_published = true
  ) then
    raise exception 'supplier not found or not published';
  end if;

  -- Idempotent: try the existing thread first.
  select id into v_thread_id
    from public.message_threads
   where buyer_id    = v_uid
     and supplier_id = p_supplier_id
     and rfq_id is not distinct from p_rfq_id
   limit 1;

  if v_thread_id is null then
    insert into public.message_threads (buyer_id, supplier_id, rfq_id, subject)
    values (v_uid, p_supplier_id, p_rfq_id, nullif(trim(coalesce(p_subject, '')), ''))
    returning id into v_thread_id;
  end if;

  -- Ensure buyer participant row exists.
  insert into public.thread_participants (thread_id, user_id, role)
  values (v_thread_id, v_uid, 'buyer')
  on conflict (thread_id, user_id) do nothing;

  -- Add the claimed supplier user if any.
  select s.claimed_by into v_claimed
    from public.suppliers s
   where s.id = p_supplier_id;

  if v_claimed is not null and v_claimed <> v_uid then
    insert into public.thread_participants (thread_id, user_id, role)
    values (v_thread_id, v_claimed, 'supplier')
    on conflict (thread_id, user_id) do nothing;
  end if;

  return v_thread_id;
end;
$$;

revoke all  on function public.thread_open(uuid, uuid, text) from public;
grant execute on function public.thread_open(uuid, uuid, text) to authenticated;

-- ----------------------------------------------------------------------
-- thread_send_message(p_thread_id, p_body) → uuid
--   Caller must be a participant. Encrypts body with pgp_sym_encrypt
--   under app.messages_key. Returns the new message id.
-- ----------------------------------------------------------------------

create or replace function public.thread_send_message(
  p_thread_id uuid,
  p_body      text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_uid       uuid := auth.uid();
  v_id        uuid;
  v_body      text := coalesce(p_body, '');
  v_trimmed   text := trim(v_body);
  v_max_len   int  := 8000;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if length(v_trimmed) = 0 then
    raise exception 'body is empty';
  end if;
  if length(v_trimmed) > v_max_len then
    raise exception 'body exceeds % characters', v_max_len;
  end if;
  if not exists (
    select 1 from public.thread_participants tp
     where tp.thread_id = p_thread_id and tp.user_id = v_uid
  ) then
    raise exception 'not a participant of this thread' using errcode = '42501';
  end if;

  insert into public.messages (thread_id, sender_id, body_ciphertext, body_len)
  values (
    p_thread_id,
    v_uid,
    pgp_sym_encrypt(v_trimmed, public._messages_key(), 'cipher-algo=aes256'),
    length(v_trimmed)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all  on function public.thread_send_message(uuid, text) from public;
grant execute on function public.thread_send_message(uuid, text) to authenticated;

-- ----------------------------------------------------------------------
-- thread_messages(p_thread_id, p_limit, p_before) → jsonb[]
--   Returns plaintext messages for participants only. p_before paginates
--   backwards by `created_at`. Decryption uses app.messages_key.
-- ----------------------------------------------------------------------

create or replace function public.thread_messages(
  p_thread_id uuid,
  p_limit     int         default 50,
  p_before    timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.thread_participants tp
     where tp.thread_id = p_thread_id and tp.user_id = v_uid
  ) then
    raise exception 'not a participant of this thread' using errcode = '42501';
  end if;

  with rows as (
    select
      m.id,
      m.thread_id,
      m.sender_id,
      m.created_at,
      pgp_sym_decrypt(m.body_ciphertext, public._messages_key()) as body,
      (m.sender_id = v_uid) as is_self
    from public.messages m
    where m.thread_id = p_thread_id
      and (p_before is null or m.created_at < p_before)
    order by m.created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 200))
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id',         id,
      'thread_id',  thread_id,
      'sender_id',  sender_id,
      'created_at', created_at,
      'body',       body,
      'is_self',    is_self
    ) order by created_at asc),
    '[]'::jsonb
  )
  into v_out
  from rows;

  return v_out;
end;
$$;

revoke all  on function public.thread_messages(uuid, int, timestamptz) from public;
grant execute on function public.thread_messages(uuid, int, timestamptz) to authenticated;

-- ----------------------------------------------------------------------
-- thread_list() → jsonb
--   Lists the caller's threads (newest first) with buyer-safe metadata
--   for /app/messages. No message body is returned — the inbox shows
--   "(encrypted)" plus last_message_at + counterpart.
-- ----------------------------------------------------------------------

create or replace function public.thread_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;
  with mine as (
    select t.id, t.buyer_id, t.supplier_id, t.rfq_id, t.subject,
           t.last_message_at, t.updated_at, t.created_at
      from public.message_threads t
      join public.thread_participants tp
        on tp.thread_id = t.id and tp.user_id = v_uid
  ),
  enriched as (
    select
      m.id,
      m.buyer_id,
      m.supplier_id,
      m.rfq_id,
      m.subject,
      m.last_message_at,
      m.updated_at,
      m.created_at,
      s.slug         as supplier_slug,
      s.company_name as supplier_name,
      s.entity_type::text as supplier_entity_type,
      (select count(*) from public.messages mm where mm.thread_id = m.id) as message_count
    from mine m
    join public.suppliers s on s.id = m.supplier_id
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id',                  id,
      'buyer_id',            buyer_id,
      'supplier_id',         supplier_id,
      'supplier_slug',       supplier_slug,
      'supplier_name',       supplier_name,
      'supplier_entity_type', supplier_entity_type,
      'rfq_id',              rfq_id,
      'subject',             subject,
      'last_message_at',     last_message_at,
      'updated_at',          updated_at,
      'created_at',          created_at,
      'message_count',       message_count
    ) order by coalesce(last_message_at, created_at) desc),
    '[]'::jsonb
  )
  into v_out
  from enriched;
  return v_out;
end;
$$;

revoke all  on function public.thread_list() from public;
grant execute on function public.thread_list() to authenticated;

-- ----------------------------------------------------------------------
-- Realtime publication
-- ----------------------------------------------------------------------
-- Add the messages table to the Supabase realtime publication so clients
-- can subscribe to row-insert events. Wrapped in a DO so the migration is
-- idempotent + survives projects where the publication does not exist
-- (local dev outside of Supabase).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
        from pg_publication_tables
       where pubname    = 'supabase_realtime'
         and schemaname = 'public'
         and tablename  = 'messages'
    ) then
      execute 'alter publication supabase_realtime add table public.messages';
    end if;
  end if;
end$$;
