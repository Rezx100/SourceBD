-- 0031 — Buyer Settings (Spec B10, Phase 2).
--
-- Extends `public.profiles` with two user-facing columns (display_name +
-- plan_tier) and adds `public.buyer_settings` for notification toggles.
-- Three SECURITY DEFINER RPCs power the settings UI:
--
--   * `settings_get()` — composite read of the caller's profile + settings
--     + email; lazily materialises the buyer_settings row so the UI always
--     gets concrete booleans.
--   * `settings_update_profile(p_display_name)` — trims and validates
--     length; writes to `public.profiles.display_name`. Email + password
--     changes go through Supabase Auth directly (no custom RPC).
--   * `settings_update_notifications(p_input jsonb)` — partial-patch on
--     the three notify_* booleans; only updates keys present in the patch.
--
-- Plan tier is a read-only placeholder. Stripe billing lands in Phase 5
-- (`phases.md` line 100, M2); when it does, the column is forward-
-- compatible (extend the check to add new tiers, plug the Stripe webhook
-- into a service-role write path).
--
-- Hard invariants honoured:
--   * Server enforces auth + ownership: every RPC is `security definer
--     set search_path = public` and gates on `auth.uid()`.
--   * RLS on `buyer_settings` is SELECT-self-only; writes go exclusively
--     through the SECURITY DEFINER RPCs.
--   * No contact PII or SBI keys are read or returned.
--
-- Reversible:
--   drop function public.settings_update_notifications(jsonb);
--   drop function public.settings_update_profile(text);
--   drop function public.settings_get();
--   drop table public.buyer_settings;
--   alter table public.profiles drop column plan_tier;
--   alter table public.profiles drop column display_name;

-- ----------------------------------------------------------------------
-- profiles extensions
-- ----------------------------------------------------------------------

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists plan_tier    text not null default 'starter';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_display_name_len_chk'
  ) then
    alter table public.profiles
      add constraint profiles_display_name_len_chk
      check (display_name is null or length(display_name) between 1 and 120);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_plan_tier_chk'
  ) then
    alter table public.profiles
      add constraint profiles_plan_tier_chk
      check (plan_tier in ('starter','growth','enterprise'));
  end if;
end $$;

-- ----------------------------------------------------------------------
-- buyer_settings table
-- ----------------------------------------------------------------------

create table if not exists public.buyer_settings (
  owner_id                uuid primary key references auth.users (id) on delete cascade,
  notify_digest           boolean not null default true,
  notify_rfq_replies      boolean not null default true,
  notify_saved_alerts     boolean not null default true,
  updated_at              timestamptz not null default now()
);

alter table public.buyer_settings enable row level security;

drop policy if exists pol_buyer_settings_self_read on public.buyer_settings;
create policy pol_buyer_settings_self_read
  on public.buyer_settings
  for select
  to authenticated
  using (auth.uid() = owner_id);

-- No INSERT/UPDATE/DELETE policies. The two writer RPCs below run as
-- SECURITY DEFINER and are the only mutation path.

-- ----------------------------------------------------------------------
-- settings_get
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

  select p.display_name, p.role::text, p.plan_tier, p.created_at
    into v_display_name, v_role, v_plan_tier, v_created_at
    from public.profiles p
   where p.id = v_uid;

  -- Lazy materialisation: first read seeds the defaults so the UI never
  -- has to deal with a null settings shape.
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
  'Spec B10 settings read RPC. Returns the caller''s email + profile + '
  'plan_tier + notification booleans. Lazily seeds buyer_settings on first '
  'read so the UI always sees concrete values.';

revoke all     on function public.settings_get() from public;
grant  execute on function public.settings_get() to authenticated;

-- ----------------------------------------------------------------------
-- settings_update_profile
-- ----------------------------------------------------------------------

create or replace function public.settings_update_profile(
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_trimmed text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  v_trimmed := nullif(btrim(coalesce(p_display_name, '')), '');

  if v_trimmed is not null and length(v_trimmed) > 120 then
    raise exception 'display_name must be 120 characters or fewer'
      using errcode = '22023';
  end if;

  update public.profiles
     set display_name = v_trimmed
   where id = v_uid;
end;
$$;

comment on function public.settings_update_profile(text) is
  'Spec B10 profile-update RPC. Trims and length-validates display_name; '
  'writes nullable to public.profiles.display_name for the caller.';

revoke all     on function public.settings_update_profile(text) from public;
grant  execute on function public.settings_update_profile(text) to authenticated;

-- ----------------------------------------------------------------------
-- settings_update_notifications
-- ----------------------------------------------------------------------

create or replace function public.settings_update_notifications(
  p_input jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'p_input must be a jsonb object' using errcode = '22023';
  end if;

  -- Seed if missing so the partial-patch UPDATE always finds a row.
  insert into public.buyer_settings (owner_id)
    values (v_uid)
    on conflict (owner_id) do nothing;

  update public.buyer_settings bs
     set notify_digest       = case when p_input ? 'digest'
                                    then (p_input ->> 'digest')::boolean
                                    else bs.notify_digest end,
         notify_rfq_replies  = case when p_input ? 'rfq_replies'
                                    then (p_input ->> 'rfq_replies')::boolean
                                    else bs.notify_rfq_replies end,
         notify_saved_alerts = case when p_input ? 'saved_alerts'
                                    then (p_input ->> 'saved_alerts')::boolean
                                    else bs.notify_saved_alerts end,
         updated_at          = now()
   where bs.owner_id = v_uid;
end;
$$;

comment on function public.settings_update_notifications(jsonb) is
  'Spec B10 notifications-update RPC. Partial-patch on buyer_settings; '
  'only updates the three notify_* booleans present in p_input.';

revoke all     on function public.settings_update_notifications(jsonb) from public;
grant  execute on function public.settings_update_notifications(jsonb) to authenticated;

-- =============================================================================
-- end migration 0031_buyer_settings
-- =============================================================================
