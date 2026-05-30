-- 0041_admin_user_management.sql
--
-- Spec A5 — User management.
-- Fifth Phase-4 admin spec. Admin manages platform user accounts:
-- change a user's role (buyer/supplier/admin), suspend / un-suspend an
-- account (reversible kill-switch via a profile flag, NOT
-- auth.users.banned_until), and read a per-user audit drilldown of
-- every admin action that affected the user OR was performed by the
-- user (when the user is themself an admin).
--
-- Self-edit refused (42501): admin cannot edit own row, ever.
-- Last-admin guard (P0001): refuse demote/suspend that would leave
-- zero rows where role='admin' AND coalesce(is_suspended,false)=false.
-- One admin_audit_log row per admin_user_update call, with the actual
-- old→new diff per changed field, in the same transaction as the
-- mutation.
--
-- Down (manual):
--   drop function public.admin_user_audit(uuid, text, int, int);
--   drop function public.admin_user_update(uuid, jsonb);
--   drop function public.admin_user_get(uuid);
--   drop function public.admin_user_list(text, text, text, int, int);
--   drop index if exists idx_profiles_is_suspended;
--   alter table public.profiles
--     drop column suspended_reason,
--     drop column suspended_by,
--     drop column suspended_at,
--     drop column is_suspended;

-- ---------- 1. profiles columns -------------------------------------------

alter table public.profiles
  add column if not exists is_suspended     boolean not null default false,
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_by     uuid references auth.users(id) on delete set null,
  add column if not exists suspended_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_suspended_reason_len') then
    alter table public.profiles
      add constraint profiles_suspended_reason_len
      check (suspended_reason is null or length(suspended_reason) <= 2000);
  end if;
end $$;

create index if not exists idx_profiles_is_suspended
  on public.profiles (is_suspended) where is_suspended = true;

-- ---------- 2. RPCs --------------------------------------------------------

-- admin_user_list — paginated user roster.
-- Joins public.profiles → auth.users for email/created_at/last_sign_in_at
-- and LEFT JOINs public.suppliers (claimed_by) for the claim summary.
-- Returns jsonb { total, rows: [...] }. Admin-only; in-body role check.
create or replace function public.admin_user_list(
  p_search text default null,
  p_role   text default null,
  p_status text default 'all',
  p_limit  int  default 50,
  p_offset int  default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid    uuid := auth.uid();
  v_role   text;
  v_status text := lower(coalesce(p_status, 'all'));
  v_limit  int  := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset int  := greatest(0, coalesce(p_offset, 0));
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_out    jsonb;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;
  if v_status not in ('active','suspended','all') then
    raise exception 'status must be active|suspended|all' using errcode = '22023';
  end if;
  if p_role is not null and p_role not in ('buyer','supplier','admin') then
    raise exception 'role must be buyer|supplier|admin' using errcode = '22023';
  end if;

  with filtered as (
    select
      p.id                          as user_id,
      p.role::text                  as role,
      p.display_name                as display_name,
      p.plan_tier                   as plan_tier,
      p.is_suspended                as is_suspended,
      p.suspended_at                as suspended_at,
      p.suspended_reason            as suspended_reason,
      u.email                       as email,
      u.created_at                  as created_at,
      u.last_sign_in_at             as last_sign_in_at
      from public.profiles p
      join auth.users u on u.id = p.id
     where (p_role is null or p.role::text = p_role)
       and (v_status = 'all'
            or (v_status = 'active'    and coalesce(p.is_suspended,false) = false)
            or (v_status = 'suspended' and coalesce(p.is_suspended,false) = true))
       and (v_search is null
            or u.email ilike '%' || v_search || '%'
            or coalesce(p.display_name,'') ilike '%' || v_search || '%')
  ),
  page as (
    select * from filtered
     order by created_at desc
     limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows',  coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',          f.user_id,
        'email',            f.email,
        'display_name',     f.display_name,
        'role',             f.role,
        'is_suspended',     f.is_suspended,
        'suspended_at',     f.suspended_at,
        'suspended_reason', f.suspended_reason,
        'plan_tier',        f.plan_tier,
        'created_at',       f.created_at,
        'last_sign_in_at',  f.last_sign_in_at,
        'claimed_supplier', (
          select jsonb_build_object(
            'id',           s.id,
            'slug',         s.slug,
            'company_name', s.company_name,
            'entity_type',  s.entity_type::text
          )
            from public.suppliers s
           where s.claimed_by = f.user_id
           limit 1
        ),
        'audit_count', (
          select count(*) from public.admin_audit_log a
           where (a.target_table = 'profiles' and a.target_id = f.user_id)
              or  a.actor_id = f.user_id
        )
      ) order by f.created_at desc)
      from page f
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

comment on function public.admin_user_list(text, text, text, int, int) is
  'Spec A5 — admin-only user roster. Joins profiles → auth.users + LEFT '
  'JOINs suppliers (claimed_by). Exposes email (admin context).';

revoke all     on function public.admin_user_list(text, text, text, int, int) from public;
grant  execute on function public.admin_user_list(text, text, text, int, int) to authenticated;

-- admin_user_get — single-user object in the same shape as one
-- admin_user_list row, plus suspended_by_email lookup.
create or replace function public.admin_user_get(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
  v_out  jsonb;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;
  if p_user_id is null then
    raise exception 'user_id required' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'user_id',           p.id,
    'email',             u.email,
    'display_name',      p.display_name,
    'role',              p.role::text,
    'is_suspended',      p.is_suspended,
    'suspended_at',      p.suspended_at,
    'suspended_by',      p.suspended_by,
    'suspended_by_email',(select email from auth.users where id = p.suspended_by),
    'suspended_reason',  p.suspended_reason,
    'plan_tier',         p.plan_tier,
    'created_at',        u.created_at,
    'last_sign_in_at',   u.last_sign_in_at,
    'claimed_supplier', (
      select jsonb_build_object(
        'id', s.id, 'slug', s.slug,
        'company_name', s.company_name,
        'entity_type', s.entity_type::text
      )
        from public.suppliers s
       where s.claimed_by = p.id
       limit 1
    ),
    'audit_count', (
      select count(*) from public.admin_audit_log a
       where (a.target_table = 'profiles' and a.target_id = p.id)
          or  a.actor_id = p.id
    )
  ) into v_out
    from public.profiles p
    join auth.users    u on u.id = p.id
   where p.id = p_user_id;

  if v_out is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  return v_out;
end;
$$;

comment on function public.admin_user_get(uuid) is
  'Spec A5 — admin-only single-user fetch. Same shape as one admin_user_list '
  'row plus suspended_by_email lookup.';

revoke all     on function public.admin_user_get(uuid) from public;
grant  execute on function public.admin_user_get(uuid) to authenticated;

-- admin_user_update — mutate a user's role / suspension. Single
-- transaction: mutation + one admin_audit_log row carrying the diff.
-- Self-edit refused (42501). Last-admin guard (P0001).
create or replace function public.admin_user_update(
  p_user_id uuid,
  p_patch   jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid          uuid := auth.uid();
  v_role         text;
  v_actor_email  text;
  v_cur_role     text;
  v_cur_susp     boolean;
  v_cur_reason   text;
  v_new_role     text;
  v_new_susp     boolean;
  v_new_reason   text;
  v_has_role     boolean := p_patch ? 'role';
  v_has_susp     boolean := p_patch ? 'is_suspended';
  v_has_reason   boolean := p_patch ? 'suspended_reason';
  v_diff         jsonb   := '{}'::jsonb;
  v_key          text;
  v_other_admins int;
  v_will_demote  boolean := false;
  v_will_suspend boolean := false;
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

  -- Whitelist
  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in ('role','is_suspended','suspended_reason') then
      raise exception 'field % is not editable', v_key using errcode = '22023';
    end if;
  end loop;

  if not (v_has_role or v_has_susp or v_has_reason) then
    raise exception 'patch is empty' using errcode = '22023';
  end if;

  -- Self-edit refused unconditionally
  if p_user_id = v_uid then
    raise insufficient_privilege using message = 'cannot edit self';
  end if;

  select role::text, coalesce(is_suspended,false), suspended_reason
    into v_cur_role, v_cur_susp, v_cur_reason
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

  -- Suspending requires a reason (either in patch, or already set).
  if v_has_susp and v_new_susp = true then
    -- if patch carries reason, validate it; if not, accept already-set reason
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

  -- Last-admin guard: refuse demote or suspend that drops active-admin count to 0.
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

  -- Apply mutation + build diff
  if v_has_role and v_new_role <> v_cur_role then
    update public.profiles set role = v_new_role::user_role where id = p_user_id;
    v_diff := v_diff || jsonb_build_object('role',
      jsonb_build_object('from', v_cur_role, 'to', v_new_role));
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
    -- reason-only update while remaining suspended
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
    'is_suspended',  v_new_susp
  );
end;
$$;

comment on function public.admin_user_update(uuid, jsonb) is
  'Spec A5 — admin-only user mutation. Whitelist: role, is_suspended, '
  'suspended_reason. Self-edit refused (42501). Last-admin guard (P0001). '
  'One admin_audit_log row per call with full old→new diff, single tx.';

revoke all     on function public.admin_user_update(uuid, jsonb) from public;
grant  execute on function public.admin_user_update(uuid, jsonb) to authenticated;

-- admin_user_audit — per-user, bi-directional audit drilldown.
-- p_direction in ('target','actor','both'). Tag each row with the
-- direction discriminator.
create or replace function public.admin_user_audit(
  p_user_id   uuid,
  p_direction text default 'both',
  p_limit     int  default 50,
  p_offset    int  default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid       uuid := auth.uid();
  v_role      text;
  v_direction text := lower(coalesce(p_direction, 'both'));
  v_limit     int  := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset    int  := greatest(0, coalesce(p_offset, 0));
  v_out       jsonb;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;
  if p_user_id is null then
    raise exception 'user_id required' using errcode = '22023';
  end if;
  if v_direction not in ('target','actor','both') then
    raise exception 'direction must be target|actor|both' using errcode = '22023';
  end if;

  with filtered as (
    select a.id, a.created_at, a.actor_id, a.action, a.target_table,
           a.target_id, a.patch, a.metadata,
           case
             when (a.target_table = 'profiles' and a.target_id = p_user_id) then 'target'
             else 'actor'
           end as direction
      from public.admin_audit_log a
     where (
       (v_direction in ('target','both')
         and a.target_table = 'profiles' and a.target_id = p_user_id)
       or
       (v_direction in ('actor','both')
         and a.actor_id = p_user_id)
     )
  ),
  page as (
    select * from filtered
     order by created_at desc
     limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows',  coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',           f.id,
        'created_at',   f.created_at,
        'actor_id',     f.actor_id,
        'actor_email',  (select email from auth.users where id = f.actor_id),
        'action',       f.action,
        'target_table', f.target_table,
        'target_id',    f.target_id,
        'patch',        f.patch,
        'metadata',     f.metadata,
        'direction',    f.direction
      ) order by f.created_at desc)
      from page f
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

comment on function public.admin_user_audit(uuid, text, int, int) is
  'Spec A5 — admin-only per-user audit drilldown. direction in '
  '(target|actor|both); rows tagged with direction discriminator.';

revoke all     on function public.admin_user_audit(uuid, text, int, int) from public;
grant  execute on function public.admin_user_audit(uuid, text, int, int) to authenticated;
