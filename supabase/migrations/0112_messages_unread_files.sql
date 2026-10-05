-- 0112 — Messages: unread, read ticks, the last line, and files (5 Oct 2026).
--
-- Spec: context/feature-specs/gap-09-messages-unread-files.md (gap list row 9).
--
--   1. thread_participants.last_read_at: where each person has read up to.
--      Existing rows are stamped now(), so applying this does not light up
--      every old conversation as unread.
--   2. thread_mark_read(thread) moves it; thread_unread_total() is the
--      sidebar's "2 new" (conversations with something unread).
--   3. thread_list() gains unread_count, has_reply, last_body (140
--      characters) and last_is_self, so the inbox no longer reads each
--      conversation to draw its last line.
--   4. thread_messages() gains `read` on your own messages (the other side
--      has read up to it) and `attachments`.
--   5. Files: a private `message-files` bucket, path
--      <thread_id>/<uploader_id>/<random>/<file name>; a participant may
--      upload into their own folder of a conversation they are in and read
--      every file of it. message_attachments ties a file to its message;
--      thread_send_message_files(thread, body, paths) sends text, files or
--      both.
--
-- Hard invariants honoured:
--   * Server enforces auth + participation: every RPC is SECURITY DEFINER with
--     a pinned search_path and checks the caller is a participant; the new
--     table has RLS on and no grant; storage policies test participation
--     against thread_participants, not the path alone.
--   * Bodies stay encrypted (0027): last_body is decrypted inside the RPC,
--     for a participant only, as thread_messages already does.
--   * Supabase grants EXECUTE on new functions to `anon` by name, so each
--     revokes `anon` by name (0105's finding).
--
-- Idempotent: `if not exists`, `create or replace`, policies dropped first,
-- the bucket upserted. The only existing rows it changes are
-- thread_participants.last_read_at (null to now()).
--
-- Do not apply to production from this PR (AGENTS rule 15); the founder
-- applies it after the dry run in ops/plans/0112-dry-run.md.
--
-- Reversible:
--   drop function public.thread_send_message_files(uuid, text, text[]);
--   drop function public.thread_unread_total();
--   drop function public.thread_mark_read(uuid);
--   drop policy pol_message_files_participant_read on storage.objects;
--   drop policy pol_message_files_participant_insert on storage.objects;
--   delete from storage.buckets where id = 'message-files';
--   drop table public.message_attachments;
--   alter table public.thread_participants drop column last_read_at;
--   then re-run thread_list() from 0035 and thread_messages() from 0027.

set search_path = public;

-- ----------------------------------------------------------------------
-- 1. Read markers
-- ----------------------------------------------------------------------

alter table public.thread_participants add column if not exists last_read_at timestamptz;
update public.thread_participants set last_read_at = now() where last_read_at is null;

-- ----------------------------------------------------------------------
-- 2. Attachments
-- ----------------------------------------------------------------------

create table if not exists public.message_attachments (
  id          uuid        primary key default gen_random_uuid(),
  message_id  uuid        not null references public.messages(id) on delete cascade,
  thread_id   uuid        not null references public.message_threads(id) on delete cascade,
  object_path text        not null,
  file_name   text        not null,
  mime_type   text,
  size_bytes  bigint,
  created_at  timestamptz not null default now(),
  constraint message_attachments_path_unique unique (object_path),
  constraint message_attachments_name_len check (char_length(file_name) between 1 and 200)
);

create index if not exists idx_message_attachments_message on public.message_attachments (message_id);

alter table public.message_attachments enable row level security;
revoke all on table public.message_attachments from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message-files', 'message-files', false, 26214400, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
  'text/csv'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Participation is compared as text so a path whose first folder is not a
-- uuid is simply refused rather than raising a cast error.
drop policy if exists pol_message_files_participant_insert on storage.objects;
create policy pol_message_files_participant_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'message-files'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (select 1 from public.thread_participants tp
                 where tp.user_id = auth.uid()
                   and tp.thread_id::text = (storage.foldername(name))[1])
  );

drop policy if exists pol_message_files_participant_read on storage.objects;
create policy pol_message_files_participant_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'message-files'
    and exists (select 1 from public.thread_participants tp
                 where tp.user_id = auth.uid()
                   and tp.thread_id::text = (storage.foldername(name))[1])
  );

-- ----------------------------------------------------------------------
-- 3. thread_mark_read and thread_unread_total
-- ----------------------------------------------------------------------

create or replace function public.thread_mark_read(p_thread_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.thread_participants tp
     set last_read_at = now()
   where tp.thread_id = p_thread_id and tp.user_id = auth.uid();
  if not found then
    raise exception 'not a participant of this thread' using errcode = '42501';
  end if;
end;
$$;

revoke all     on function public.thread_mark_read(uuid) from public, anon;
grant  execute on function public.thread_mark_read(uuid) to authenticated;

create or replace function public.thread_unread_total()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.thread_participants tp
   where tp.user_id = auth.uid()
     and exists (select 1 from public.messages m
                  where m.thread_id = tp.thread_id
                    and m.sender_id <> tp.user_id
                    and (tp.last_read_at is null or m.created_at > tp.last_read_at));
$$;

revoke all     on function public.thread_unread_total() from public, anon;
grant  execute on function public.thread_unread_total() to authenticated;

-- ----------------------------------------------------------------------
-- 4. thread_list(): 0035's keys, plus unread_count, has_reply, last_body,
--    last_is_self.
-- ----------------------------------------------------------------------

create or replace function public.thread_list()
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
    return '[]'::jsonb;
  end if;
  with mine as (
    select t.id, t.buyer_id, t.supplier_id, t.rfq_id, t.subject,
           t.last_message_at, t.updated_at, t.created_at, tp.last_read_at
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
      au.email::text      as buyer_email,
      bp.display_name     as buyer_display_name,
      case when m.buyer_id = v_uid then 'buyer' else 'supplier' end as viewer_role,
      (select count(*) from public.messages mm where mm.thread_id = m.id) as message_count,
      (select count(*) from public.messages mm
        where mm.thread_id = m.id and mm.sender_id <> v_uid
          and (m.last_read_at is null or mm.created_at > m.last_read_at)) as unread_count,
      exists (select 1 from public.messages mm where mm.thread_id = m.id and mm.sender_id <> v_uid) as has_reply,
      lm.body as last_body,
      lm.sender_id = v_uid as last_is_self
    from mine m
    join public.suppliers s   on s.id  = m.supplier_id
    join auth.users       au  on au.id = m.buyer_id
    left join public.profiles bp on bp.id = m.buyer_id
    left join lateral (
      select mm.sender_id,
             left(pgp_sym_decrypt(mm.body_ciphertext, public._messages_key()), 140) as body
        from public.messages mm
       where mm.thread_id = m.id
       order by mm.created_at desc
       limit 1
    ) lm on true
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id',                  id,
      'buyer_id',            buyer_id,
      'supplier_id',         supplier_id,
      'supplier_slug',       supplier_slug,
      'supplier_name',       supplier_name,
      'supplier_entity_type', supplier_entity_type,
      'buyer_email',         buyer_email,
      'buyer_display_name',  buyer_display_name,
      'viewer_role',         viewer_role,
      'rfq_id',              rfq_id,
      'subject',             subject,
      'last_message_at',     last_message_at,
      'updated_at',          updated_at,
      'created_at',          created_at,
      'message_count',       message_count,
      'unread_count',        unread_count,
      'has_reply',           has_reply,
      'last_body',           last_body,
      'last_is_self',        last_is_self
    ) order by coalesce(last_message_at, created_at) desc),
    '[]'::jsonb
  )
  into v_out
  from enriched;
  return v_out;
end;
$$;

revoke all     on function public.thread_list() from public, anon;
grant  execute on function public.thread_list() to authenticated;

-- ----------------------------------------------------------------------
-- 5. thread_messages(): 0027's keys, plus `read` and `attachments`.
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
  v_uid       uuid := auth.uid();
  v_other_read timestamptz;
  v_out       jsonb;
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

  select max(tp.last_read_at) into v_other_read
    from public.thread_participants tp
   where tp.thread_id = p_thread_id and tp.user_id <> v_uid;

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
      'id',          r.id,
      'thread_id',   r.thread_id,
      'sender_id',   r.sender_id,
      'created_at',  r.created_at,
      'body',        r.body,
      'is_self',     r.is_self,
      'read',        r.is_self and v_other_read is not null and v_other_read >= r.created_at,
      'attachments', (select coalesce(jsonb_agg(jsonb_build_object(
                                'id',         a.id,
                                'path',       a.object_path,
                                'file_name',  a.file_name,
                                'mime_type',  a.mime_type,
                                'size_bytes', a.size_bytes) order by a.created_at, a.file_name), '[]'::jsonb)
                        from public.message_attachments a where a.message_id = r.id)
    ) order by r.created_at asc),
    '[]'::jsonb
  )
  into v_out
  from rows r;

  return v_out;
end;
$$;

revoke all     on function public.thread_messages(uuid, int, timestamptz) from public, anon;
grant  execute on function public.thread_messages(uuid, int, timestamptz) to authenticated;

-- ----------------------------------------------------------------------
-- 6. thread_send_message_files(thread, body, paths): text, files or both.
--    Each path must be a file the caller uploaded into this conversation
--    (<thread>/<caller>/...), present in the bucket, not on another message.
--    Up to 10 files. Sending also marks the conversation read for the sender.
-- ----------------------------------------------------------------------

create or replace function public.thread_send_message_files(
  p_thread_id uuid,
  p_body      text,
  p_paths     text[]
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_body    text := btrim(coalesce(p_body, ''));
  v_paths   text[];
  v_path    text;
  v_obj     record;
  v_id      uuid;
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

  select coalesce(array_agg(distinct p), '{}') into v_paths
    from unnest(coalesce(p_paths, '{}')) p where p is not null and p <> '';
  if cardinality(v_paths) > 10 then
    raise exception 'at most 10 files a message' using errcode = '22023';
  end if;
  if length(v_body) = 0 and cardinality(v_paths) = 0 then
    raise exception 'body is empty' using errcode = '22023';
  end if;
  if length(v_body) > 8000 then
    raise exception 'body exceeds 8000 characters' using errcode = '22023';
  end if;

  insert into public.messages (thread_id, sender_id, body_ciphertext, body_len)
  values (p_thread_id, v_uid,
          pgp_sym_encrypt(v_body, public._messages_key(), 'cipher-algo=aes256'),
          length(v_body))
  returning id into v_id;

  foreach v_path in array v_paths loop
    if split_part(v_path, '/', 1) <> p_thread_id::text
       or split_part(v_path, '/', 2) <> v_uid::text
       or split_part(v_path, '/', 4) = '' then
      raise exception 'a file is not yours in this conversation' using errcode = '42501';
    end if;
    select o.name, o.metadata into v_obj
      from storage.objects o
     where o.bucket_id = 'message-files' and o.name = v_path;
    if not found then
      raise exception 'a file was not uploaded' using errcode = 'P0002';
    end if;
    insert into public.message_attachments (message_id, thread_id, object_path, file_name, mime_type, size_bytes)
    values (v_id, p_thread_id, v_path,
            left(substr(v_path, length(split_part(v_path, '/', 1)) + length(split_part(v_path, '/', 2))
                                + length(split_part(v_path, '/', 3)) + 4), 200),
            v_obj.metadata->>'mimetype',
            nullif(v_obj.metadata->>'size', '')::bigint);
  end loop;

  update public.thread_participants tp
     set last_read_at = now()
   where tp.thread_id = p_thread_id and tp.user_id = v_uid;

  return v_id;
end;
$$;

revoke all     on function public.thread_send_message_files(uuid, text, text[]) from public, anon;
grant  execute on function public.thread_send_message_files(uuid, text, text[]) to authenticated;
