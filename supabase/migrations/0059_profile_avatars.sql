-- 0059 — Profile avatars (profile-picture upload).
--
-- Adds `public.profiles.avatar_url` plus a public `avatars` storage bucket
-- with owner-scoped write RLS (a user may only write under
-- `avatars/<their uid>/...`). `settings_get()` is re-created to return the
-- new `avatar_url`; `settings_update_avatar(text)` is the SECURITY DEFINER
-- writer the upload route calls after a successful storage upload.
--
-- Hard invariants honoured:
--   * Server enforces auth + ownership: the writer RPC gates on auth.uid();
--     storage writes are constrained by RLS to the caller's own folder.
--   * Bucket is public-read only (avatars are non-sensitive); no listing of
--     other users' objects is granted.
--
-- Reversible:
--   drop function public.settings_update_avatar(text);
--   -- restore settings_get() body from migration 0031
--   drop policy if exists pol_avatars_owner_delete on storage.objects;
--   drop policy if exists pol_avatars_owner_update on storage.objects;
--   drop policy if exists pol_avatars_owner_insert on storage.objects;
--   drop policy if exists pol_avatars_public_read  on storage.objects;
--   delete from storage.buckets where id = 'avatars';
--   alter table public.profiles drop column avatar_url;

-- ----------------------------------------------------------------------
-- profiles extension
-- ----------------------------------------------------------------------

alter table public.profiles
  add column if not exists avatar_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_avatar_url_len_chk'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_url_len_chk
      check (avatar_url is null or length(avatar_url) <= 1000);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- settings_get — re-create including avatar_url
-- ----------------------------------------------------------------------

create or replace function public.settings_get()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_email        text;
  v_display_name text;
  v_avatar_url   text;
  v_role         text;
  v_plan_tier    text;
  v_created_at   timestamptz;
  v_digest       boolean;
  v_rfq          boolean;
  v_saved        boolean;
begin
  if v_uid is null then
    return null::jsonb;
  end if;

  select u.email
    into v_email
    from auth.users u
   where u.id = v_uid;

  select p.display_name, p.avatar_url, p.role::text, p.plan_tier, p.created_at
    into v_display_name, v_avatar_url, v_role, v_plan_tier, v_created_at
    from public.profiles p
   where p.id = v_uid;

  insert into public.buyer_settings (owner_id)
    values (v_uid)
    on conflict (owner_id) do nothing;

  select bs.notify_digest, bs.notify_rfq_replies, bs.notify_saved_alerts
    into v_digest, v_rfq, v_saved
    from public.buyer_settings bs
   where bs.owner_id = v_uid;

  return jsonb_build_object(
    'email',        v_email,
    'display_name', v_display_name,
    'avatar_url',   v_avatar_url,
    'role',         v_role,
    'plan_tier',    v_plan_tier,
    'created_at',   v_created_at,
    'notifications', jsonb_build_object(
      'digest',       coalesce(v_digest, true),
      'rfq_replies',  coalesce(v_rfq,    true),
      'saved_alerts', coalesce(v_saved,  true)
    )
  );
end;
$$;

comment on function public.settings_get() is
  'Spec B10 settings read RPC (0059: + avatar_url). Returns the caller''s '
  'email + profile + plan_tier + avatar_url + notification booleans.';

revoke all     on function public.settings_get() from public;
grant  execute on function public.settings_get() to authenticated;

-- ----------------------------------------------------------------------
-- settings_update_avatar — SECURITY DEFINER writer for avatar_url
-- ----------------------------------------------------------------------

create or replace function public.settings_update_avatar(
  p_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_url text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  v_url := nullif(btrim(coalesce(p_avatar_url, '')), '');

  if v_url is not null and length(v_url) > 1000 then
    raise exception 'avatar_url must be 1000 characters or fewer'
      using errcode = '22023';
  end if;

  update public.profiles
     set avatar_url = v_url
   where id = v_uid;
end;
$$;

comment on function public.settings_update_avatar(text) is
  'Spec B10 (0059) avatar writer. Sets public.profiles.avatar_url for the '
  'caller; pass null/empty to clear. Called by the upload route after a '
  'successful storage write.';

revoke all     on function public.settings_update_avatar(text) from public;
grant  execute on function public.settings_update_avatar(text) to authenticated;

-- ----------------------------------------------------------------------
-- avatars storage bucket + RLS
-- ----------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read (avatars are non-sensitive); scoped to this bucket only.
drop policy if exists pol_avatars_public_read on storage.objects;
create policy pol_avatars_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

-- Owner-scoped writes: the first path segment must equal the caller's uid,
-- so a user can only create/replace/delete files under avatars/<their uid>/.
drop policy if exists pol_avatars_owner_insert on storage.objects;
create policy pol_avatars_owner_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists pol_avatars_owner_update on storage.objects;
create policy pol_avatars_owner_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists pol_avatars_owner_delete on storage.objects;
create policy pol_avatars_owner_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
