-- Stands up the parts of a Supabase project that Postgres itself does not
-- provide, so that `supabase/migrations/*.sql` can be replayed against a
-- throwaway database in CI.
--
-- Why this exists: none of `0104_discover_v32.sql`'s 1,052 lines was ever
-- executed by anything. Four review rounds read it; round 4 found a doubled
-- comma that Postgres rejects at CREATE FUNCTION time, meaning the migration
-- would not have applied at all — and it had passed a guard whose whole job
-- was to check that ORDER BY, because the guard matched source text instead
-- of running it. Guards that pattern-match SQL are not guards.
--
-- These are stubs with the right names, signatures and shapes. They are not
-- Supabase. Nothing here is ever applied to a real project: `set search_path`
-- and the role names match so the migrations parse and run, and no more.

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;

-- --- auth -------------------------------------------------------------------
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- `raw_user_meta_data` is not decoration: 0022 puts an AFTER INSERT trigger on
-- this table that reads `new.raw_user_meta_data ->> 'role'` to seed a profile.
-- Without the column every insert here fails with "record new has no field",
-- which is what the first CI run of this job found.
create table if not exists auth.users (
  id                  uuid  primary key default gen_random_uuid(),
  email               text,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  raw_app_meta_data   jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- The real ones read the request JWT out of a GUC. Same contract: null when
-- nobody is signed in, which is what every RLS policy in these migrations is
-- written against.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

-- --- storage ----------------------------------------------------------------
-- 0059 creates an avatars bucket and four policies over storage.objects.
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text,
  owner      uuid,
  created_at timestamptz default now()
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select string_to_array(name, '/');
$$;
