-- =============================================================================
-- Migration 0022 — Phase 1 Spec F3 (Auth): public.profiles + RLS
--
-- Per `context/phases.md` lines 46–50, F3 introduces three roles (buyer /
-- supplier / admin) stored on `public.profiles.role`. The earlier 0001
-- migration already declared `suppliers.claimed_by uuid` with a
-- "profiles.id (nullable until Phase 4 auth tables)" inline comment.
-- This migration is the smallest additive schema change that lets the
-- Phase-1 app read a role per authenticated session.
--
-- Server enforces auth + ownership (per `context/architecture.md` invariant);
-- RLS lives directly on this table so a logged-in client can only ever see
-- their own row.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('buyer', 'supplier', 'admin');
  end if;
end $$;

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        user_role not null default 'buyer',
  created_at  timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles (role);

alter table public.profiles enable row level security;

-- A signed-in user can read their own profile row only. No anon read.
drop policy if exists pol_profiles_self_read on public.profiles;
create policy pol_profiles_self_read
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Profile rows are created by the trigger below; no direct insert/update from
-- the client. Role changes are admin-only and happen via service_role
-- (Phase 4 admin panel). Hence no insert/update/delete policies for
-- authenticated / anon — service_role bypasses RLS automatically.

-- Auto-create a profile row on every new auth.users insert. The role default
-- ('buyer') matches the most common signup path; the supplier claim flow
-- (Spec S1) and the admin promotion flow (Phase 4) update this column via
-- service-role connections.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'buyer'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- end migration 0022_profiles_auth
-- =============================================================================
