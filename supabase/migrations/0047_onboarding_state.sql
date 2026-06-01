-- =============================================================================
-- Migration 0047 — Spec H5 (In-app onboarding tour): onboarding_state column
-- on public.profiles + SECURITY DEFINER RPC profile_onboarding_set.
--
-- The tour client (`components/onboarding/tour.tsx`) calls this RPC to record
-- step progress, dismissal, and completion. The RPC verifies auth.uid() =
-- profiles.id and json-patches the requested key. Granted to `authenticated`
-- only — explicitly revoked from `public` and `anon` so anonymous probes
-- return permission denied.
-- =============================================================================

alter table public.profiles
  add column if not exists onboarding_state jsonb not null default '{}'::jsonb;

create or replace function public.profile_onboarding_set(
  p_key   text,
  p_value jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'auth required' using errcode = '28000';
  end if;
  if p_key is null or length(p_key) = 0 then
    raise exception 'key required' using errcode = '22023';
  end if;
  if p_key !~ '^[a-z_][a-z0-9_]*$' then
    raise exception 'invalid key' using errcode = '22023';
  end if;
  update public.profiles
     set onboarding_state =
           jsonb_set(coalesce(onboarding_state, '{}'::jsonb),
                     array[p_key], p_value, true)
   where id = v_uid
  returning onboarding_state into v_out;
  if v_out is null then
    raise exception 'profile not found' using errcode = '42704';
  end if;
  return v_out;
end;
$$;

revoke all on function public.profile_onboarding_set(text, jsonb) from public;
revoke execute on function public.profile_onboarding_set(text, jsonb) from anon;
grant  execute on function public.profile_onboarding_set(text, jsonb) to authenticated;

-- =============================================================================
-- end migration 0047_onboarding_state
-- =============================================================================
