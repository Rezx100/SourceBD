-- 0133 — A fingerprint for every file sent in a message (6 Oct 2026).
--
-- Plan: .impeccable/handoff-admin-moderation.md, section 3 ("Message files are stored without a fingerprint")
-- and build item 1c. Versions for RFQs, quotes and orders came with 0131: every edit is kept with the row
-- before and after. A message's text is fingerprinted there too. Files were the gap: the browser uploads a
-- file straight to the bucket and the database only ever sees its path, so nothing could later prove a
-- file is the one that was sent.
--
-- WHAT
-- ----
--   1. message_attachments.sha256 and fingerprinted_at.
--   2. message_attachment_fingerprint(message, path, sha256): the sender of the message, and nobody else,
--      writes the file's sha256 once. The server computes it right after the send by reading the file back
--      from the bucket under the sender's own session (app/api/v1/messages/route.ts, lib/ledger/
--      file-fingerprint.ts), so the value is the server's reading of the stored bytes, not a claim from the
--      browser. A second write with the same value is a no-op; a different value is refused: once a file
--      has a fingerprint it keeps it. The 0131 trigger on message_attachments records the write as a kept
--      version (message.updated, changed: fingerprinted_at, sha256).
--
-- A file sent before this has no fingerprint and the desk says so; nothing is invented after the fact.
--
-- Deploy order: the route calls the new function; until this is applied a send still works (the
-- fingerprint step is best effort and logs its failure). Apply before or with the deploy.
--
-- REVERSE
-- -------
--   drop function public.message_attachment_fingerprint(uuid, text, text);
--   alter table public.message_attachments drop column fingerprinted_at, drop column sha256;

set search_path = public;

do $$
begin
  if to_regclass('public.message_attachments') is null then
    raise notice '0133: public.message_attachments does not exist here (0112 not applied); nothing to do';
    return;
  end if;

  alter table public.message_attachments
    add column if not exists sha256          text,
    add column if not exists fingerprinted_at timestamptz;

  if not exists (select 1 from pg_constraint where conname = 'message_attachments_sha256_shape') then
    alter table public.message_attachments
      add constraint message_attachments_sha256_shape check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'message_attachments_fingerprint_pair') then
    alter table public.message_attachments
      add constraint message_attachments_fingerprint_pair check ((sha256 is null) = (fingerprinted_at is null));
  end if;
end
$$;

create or replace function public.message_attachment_fingerprint(
  p_message_id  uuid,
  p_object_path text,
  p_sha256      text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_att record;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'sha256 must be 64 hex characters' using errcode = '22023';
  end if;

  select a.id, a.sha256, m.sender_id
    into v_att
    from public.message_attachments a
    join public.messages m on m.id = a.message_id
   where a.message_id = p_message_id
     and a.object_path = p_object_path
   for update of a;
  if not found then
    raise exception 'attachment not found' using errcode = 'P0002';
  end if;
  if v_att.sender_id <> v_uid then
    raise exception 'only the sender may fingerprint a file' using errcode = '42501';
  end if;
  if v_att.sha256 is not null then
    if v_att.sha256 = p_sha256 then
      return false;
    end if;
    raise exception 'the file already has a different fingerprint' using errcode = '42501';
  end if;

  update public.message_attachments
     set sha256 = p_sha256,
         fingerprinted_at = now()
   where id = v_att.id;
  return true;
end;
$$;

comment on function public.message_attachment_fingerprint(uuid, text, text) is
  '0133: the sender writes a file''s sha256 once, as the server read it back from the bucket after the send.';

revoke all     on function public.message_attachment_fingerprint(uuid, text, text) from public, anon;
grant  execute on function public.message_attachment_fingerprint(uuid, text, text) to authenticated;
