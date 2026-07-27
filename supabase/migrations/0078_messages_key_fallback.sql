-- 0078 — Messaging key fallback for environments where the app migration role
-- cannot persist a custom Postgres GUC via ALTER DATABASE.
--
-- Keeps the original contract intact:
--   1. Prefer current_setting('app.messages_key', true) when ops has set it.
--   2. Fall back to a private table row managed by migrations/ops when the
--      database role lacks ALTER DATABASE privilege (observed on production).
--
-- Reversible:
--   delete from public.app_private_settings where key = 'messages_key';
--   drop function public._messages_key();
--   -- then restore the previous body from 0027_messages.sql
--   drop table public.app_private_settings;

create table if not exists public.app_private_settings (
  key        text        primary key,
  value      text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_private_settings_key_nonempty check (length(trim(key)) > 0),
  constraint app_private_settings_value_len check (length(value) >= 16)
);

alter table public.app_private_settings enable row level security;

revoke all on public.app_private_settings from anon, authenticated;

insert into public.app_private_settings (key, value)
values ('messages_key', encode(gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

create or replace function public._messages_key()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  k text := current_setting('app.messages_key', true);
begin
  if k is null or length(k) < 16 then
    select aps.value
      into k
      from public.app_private_settings aps
     where aps.key = 'messages_key'
     limit 1;
  end if;

  if k is null or length(k) < 16 then
    raise exception 'messages encryption key is not configured (app.messages_key/app_private_settings.messages_key)';
  end if;

  return k;
end;
$$;

revoke all on function public._messages_key() from public;
