-- 0052 — relax admin_user_update self-edit guard for plan_tier-only patches.
--
-- Background. 0051 forbade ALL self-edits with `cannot edit self`. That
-- blocked admins from changing their own plan tier on /admin/users/[id],
-- which we want to allow because plan_tier carries no access power for
-- admins — admin role bypasses all paywalls (Spec FE-PROTO contact gating
-- updated in I-004). Self role-change and self-suspend remain forbidden
-- (foot-shoot prevention).
--
-- Diff from 0051: only the self-edit branch changes. The whitelist, enum
-- checks, last-admin guard, audit-log write, and the rest of the body are
-- identical. The single CREATE OR REPLACE replaces the whole function so we
-- stay reversible by re-applying 0051.
--
-- Reversibility:
--   apply 0051 to restore strict-self-edit behaviour.

create or replace function public.admin_user_update(
  p_user_id uuid,
  p_patch   jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid           uuid := auth.uid();
  v_role          text;
  v_actor_email   text;
  v_cur_role      text;
  v_cur_susp      boolean;
  v_cur_reason    text;
  v_cur_plan      text;
  v_new_role      text;
  v_new_susp      boolean;
  v_new_reason    text;
  v_new_plan      text;
  v_has_role      boolean := p_patch ? 'role';
  v_has_susp      boolean := p_patch ? 'is_suspended';
  v_has_reason    boolean := p_patch ? 'suspended_reason';
  v_has_plan      boolean := p_patch ? 'plan_tier';
  v_diff          jsonb   := '{}'::jsonb;
  v_key           text;
  v_other_admins  int;
  v_will_demote   boolean := false;
  v_will_suspend  boolean := false;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;
  select p.role::text, u.email
    into v_role, v_actor_email
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;
  if p_user_id is null then
    raise exception 'user_id required' using errcode = '22023';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch must be object' using errcode = '22023';
  end if;

  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in ('role','is_suspended','suspended_reason','plan_tier') then
      raise exception 'field % is not editable', v_key using errcode = '22023';
    end if;
  end loop;

  if not (v_has_role or v_has_susp or v_has_reason or v_has_plan) then
    raise exception 'patch is empty' using errcode = '22023';
  end if;

  -- Self-edit allowed only when the patch touches plan_tier alone.
  -- Self role / suspension changes stay forbidden.
  if p_user_id = v_uid then
    if v_has_role or v_has_susp or v_has_reason then
      raise insufficient_privilege using message = 'cannot edit self role or suspension';
    end if;
    if not v_has_plan then
      raise insufficient_privilege using message = 'cannot edit self';
    end if;
  end if;

  select role::text, coalesce(is_suspended,false), suspended_reason, plan_tier
    into v_cur_role, v_cur_susp, v_cur_reason, v_cur_plan
    from public.profiles
   where id = p_user_id
   for update;
  if v_cur_role is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  if v_has_role then
    v_new_role := lower(coalesce(p_patch->>'role',''));
    if v_new_role not in ('buyer','supplier','admin') then
      raise exception 'role must be buyer|supplier|admin' using errcode = '22023';
    end if;
  else
    v_new_role := v_cur_role;
  end if;

  if v_has_susp then
    if jsonb_typeof(p_patch->'is_suspended') <> 'boolean' then
      raise exception 'is_suspended must be boolean' using errcode = '22023';
    end if;
    v_new_susp := (p_patch->>'is_suspended')::boolean;
  else
    v_new_susp := v_cur_susp;
  end if;

  if v_has_reason then
    v_new_reason := nullif(btrim(coalesce(p_patch->>'suspended_reason','')), '');
  end if;

  if v_has_plan then
    v_new_plan := lower(coalesce(p_patch->>'plan_tier',''));
    if v_new_plan not in ('starter','growth','enterprise') then
      raise exception 'plan_tier must be starter|growth|enterprise' using errcode = '22023';
    end if;
  end if;

  if v_has_susp and v_new_susp = true then
    if v_has_reason then
      if v_new_reason is null then
        raise exception 'suspended_reason required' using errcode = '22023';
      end if;
    else
      if v_cur_reason is null then
        raise exception 'suspended_reason required' using errcode = '22023';
      end if;
      v_new_reason := v_cur_reason;
    end if;
  end if;

  v_will_demote  := v_has_role and v_cur_role = 'admin' and v_new_role <> 'admin';
  v_will_suspend := v_has_susp and v_new_susp = true    and v_cur_role = 'admin' and v_cur_susp = false;
  if v_will_demote or v_will_suspend then
    select count(*) into v_other_admins
      from public.profiles
     where role = 'admin'
       and coalesce(is_suspended,false) = false
       and id <> p_user_id;
    if v_other_admins = 0 then
      raise exception 'cannot demote/suspend last active admin' using errcode = 'P0001';
    end if;
  end if;

  if v_has_role and v_new_role <> v_cur_role then
    update public.profiles set role = v_new_role::user_role where id = p_user_id;
    v_diff := v_diff || jsonb_build_object('role',
      jsonb_build_object('from', v_cur_role, 'to', v_new_role));
  end if;

  if v_has_plan and v_new_plan is distinct from v_cur_plan then
    update public.profiles set plan_tier = v_new_plan where id = p_user_id;
    v_diff := v_diff || jsonb_build_object('plan_tier',
      jsonb_build_object('from', v_cur_plan, 'to', v_new_plan));
  end if;

  if v_has_susp and v_new_susp <> v_cur_susp then
    if v_new_susp = true then
      update public.profiles
         set is_suspended     = true,
             suspended_at     = now(),
             suspended_by     = v_uid,
             suspended_reason = v_new_reason
       where id = p_user_id;
      v_diff := v_diff || jsonb_build_object('is_suspended',
        jsonb_build_object('from', false, 'to', true,
                           'reason', v_new_reason));
    else
      update public.profiles
         set is_suspended     = false,
             suspended_at     = null,
             suspended_by     = null,
             suspended_reason = null
       where id = p_user_id;
      v_diff := v_diff || jsonb_build_object('is_suspended',
        jsonb_build_object('from', true, 'to', false,
                           'previous_reason', v_cur_reason));
    end if;
  elsif v_has_reason and v_new_susp = true and v_new_reason is distinct from v_cur_reason then
    update public.profiles set suspended_reason = v_new_reason where id = p_user_id;
    v_diff := v_diff || jsonb_build_object('suspended_reason',
      jsonb_build_object('from', v_cur_reason, 'to', v_new_reason));
  end if;

  if v_diff = '{}'::jsonb then
    raise exception 'patch is a no-op' using errcode = '22023';
  end if;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, patch, metadata)
  values (
    v_uid,
    'admin_user_update',
    'profiles',
    p_user_id,
    v_diff,
    jsonb_build_object('actor_email', v_actor_email)
  );

  return jsonb_build_object(
    'ok',            true,
    'user_id',       p_user_id,
    'role',          v_new_role,
    'is_suspended',  v_new_susp,
    'plan_tier',     coalesce(v_new_plan, v_cur_plan)
  );
end;
$$;

comment on function public.admin_user_update(uuid, jsonb) is
  'Spec A5 + 0051 + 0052 — admin-only user mutation. Whitelist: role, '
  'is_suspended, suspended_reason, plan_tier. Self-edit allowed for '
  'plan_tier-only patches; self role / suspension still refused (42501). '
  'Last-admin guard (P0001). One admin_audit_log row per call, single tx.';

revoke all     on function public.admin_user_update(uuid, jsonb) from public;
grant  execute on function public.admin_user_update(uuid, jsonb) to authenticated;
