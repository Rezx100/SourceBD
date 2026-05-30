-- 0042_admin_audit_log_explorer.sql
--
-- Spec A6 — Cross-cutting audit-log explorer.
-- Sixth Phase-4 admin spec. One chronological feed surfacing every row
-- of public.admin_audit_log (from A2/A3/A4/A5) with filters
-- (action, target_table, actor email substring, since/until) and a
-- per-row drilldown. Read-only — no mutations, no audit-of-the-audit.
--
-- Index additions are narrow + additive (probe 31 May 2026 on prod
-- confirmed unfiltered desc + action filter were Seq Scans; target_table
-- already uses bitmap on idx_admin_audit_log_target prefix-scan, so we
-- do NOT add (target_table, created_at desc)).
--
-- Down (manual):
--   drop function public.admin_audit_log_get(uuid);
--   drop function public.admin_audit_log_list(text, text, text, timestamptz, timestamptz, int, int);
--   drop index if exists idx_admin_audit_log_action;
--   drop index if exists idx_admin_audit_log_created;

-- ---------- 1. indexes ----------------------------------------------------

create index if not exists idx_admin_audit_log_created
  on public.admin_audit_log (created_at desc);

create index if not exists idx_admin_audit_log_action
  on public.admin_audit_log (action, created_at desc);

-- ---------- 2. RPCs --------------------------------------------------------

-- admin_audit_log_list — paginated cross-cutting feed.
-- Filters: action, target_table, actor email substring, since, until.
-- Returns jsonb { total, rows[], facets{actions[], target_tables[]} }.
-- Facets are computed from the UNFILTERED table so admins see every
-- option regardless of current filter. Assumes action/target_table
-- remain small enum-like sets (~6 actions, ~4 target_tables today);
-- a future spec that introduces free-text actions must add a LIMIT.
create or replace function public.admin_audit_log_list(
  p_action       text        default null,
  p_target_table text        default null,
  p_actor_email  text        default null,
  p_since        timestamptz default null,
  p_until        timestamptz default null,
  p_limit        int         default 50,
  p_offset       int         default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid          uuid := auth.uid();
  v_role         text;
  v_limit        int  := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset       int  := greatest(0, coalesce(p_offset, 0));
  v_action       text := nullif(btrim(coalesce(p_action,'')), '');
  v_target_table text := nullif(btrim(coalesce(p_target_table,'')), '');
  v_actor_q      text;
  v_actor_ids    uuid[];
  v_out          jsonb;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;
  select p.role::text into v_role from public.profiles p where p.id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;

  -- Actor email substring: trim + lower + bail out (treat as null) when
  -- <2 chars to avoid unbounded ILIKE '%%' scans. We resolve emails to
  -- a uuid[] up-front so the main query stays on the indexed actor_id.
  v_actor_q := lower(coalesce(btrim(p_actor_email), ''));
  if length(v_actor_q) < 2 then
    v_actor_q := null;
  end if;
  if v_actor_q is not null then
    select coalesce(array_agg(u.id), '{}'::uuid[])
      into v_actor_ids
      from auth.users u
     where lower(u.email) like '%' || v_actor_q || '%';
    if v_actor_ids = '{}'::uuid[] then
      -- No actor matched; short-circuit to an empty page (facets still
      -- compute over the unfiltered table).
      return jsonb_build_object(
        'total', 0,
        'rows',  '[]'::jsonb,
        'facets', jsonb_build_object(
          'actions',       coalesce((select jsonb_agg(action order by action)
                                      from (select distinct action
                                              from public.admin_audit_log) a), '[]'::jsonb),
          'target_tables', coalesce((select jsonb_agg(target_table order by target_table)
                                      from (select distinct target_table
                                              from public.admin_audit_log) t), '[]'::jsonb)
        )
      );
    end if;
  end if;

  with filtered as (
    select a.id, a.created_at, a.actor_id, a.action,
           a.target_table, a.target_id, a.patch, a.metadata
      from public.admin_audit_log a
     where (v_action       is null or a.action       = v_action)
       and (v_target_table is null or a.target_table = v_target_table)
       and (v_actor_ids    is null or a.actor_id     = any(v_actor_ids))
       and (p_since        is null or a.created_at  >= p_since)
       and (p_until        is null or a.created_at  <= p_until)
  ),
  page as (
    select * from filtered
     order by created_at desc
     limit v_limit offset v_offset
  ),
  -- Resolve target_label once per page row (post-LIMIT) via correlated
  -- sub-selects keyed by target_table. nullable; client renders raw
  -- target_id short-form when null.
  labelled as (
    select p.id, p.created_at, p.actor_id, p.action, p.target_table,
           p.target_id, p.patch, p.metadata,
           case p.target_table
             when 'suppliers'      then (select s.company_name  from public.suppliers      s where s.id = p.target_id)
             when 'profiles'       then (select u.email         from auth.users            u where u.id = p.target_id)
             when 'certifications' then (select c.certificate_no from public.certifications c where c.id = p.target_id)
             else null
           end as target_label,
           (select u2.email from auth.users u2 where u2.id = p.actor_id) as actor_email,
           (select pr.role::text from public.profiles pr where pr.id = p.actor_id) as actor_role
      from page p
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows',  coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',           l.id,
        'created_at',   l.created_at,
        'action',       l.action,
        'target_table', l.target_table,
        'target_id',    l.target_id,
        'target_label', l.target_label,
        'patch',        l.patch,
        'metadata',     l.metadata,
        'actor',        jsonb_build_object(
          'id',    l.actor_id,
          'email', l.actor_email,
          'role',  l.actor_role
        )
      ) order by l.created_at desc)
      from labelled l
    ), '[]'::jsonb),
    'facets', jsonb_build_object(
      'actions',       coalesce((select jsonb_agg(action order by action)
                                  from (select distinct action
                                          from public.admin_audit_log) a), '[]'::jsonb),
      'target_tables', coalesce((select jsonb_agg(target_table order by target_table)
                                  from (select distinct target_table
                                          from public.admin_audit_log) t), '[]'::jsonb)
    )
  ) into v_out;

  return v_out;
end;
$$;

comment on function public.admin_audit_log_list(text, text, text, timestamptz, timestamptz, int, int) is
  'Spec A6 — admin-only cross-cutting audit-log feed. Filters: action, '
  'target_table, actor email substring (>=2 chars), since, until. '
  'Facets computed over unfiltered table.';

revoke all     on function public.admin_audit_log_list(text, text, text, timestamptz, timestamptz, int, int) from public;
grant  execute on function public.admin_audit_log_list(text, text, text, timestamptz, timestamptz, int, int) to authenticated;

-- admin_audit_log_get — single row drilldown.
-- Raises P0002 'audit row not found' on unknown id (route maps to 404).
-- No mutation, no audit-of-the-audit recursion.
create or replace function public.admin_audit_log_get(p_id uuid)
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
  select p.role::text into v_role from public.profiles p where p.id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;
  if p_id is null then
    raise exception 'id required' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'id',           a.id,
    'created_at',   a.created_at,
    'action',       a.action,
    'target_table', a.target_table,
    'target_id',    a.target_id,
    'target_label', case a.target_table
                      when 'suppliers'      then (select s.company_name  from public.suppliers      s where s.id = a.target_id)
                      when 'profiles'       then (select u.email         from auth.users            u where u.id = a.target_id)
                      when 'certifications' then (select c.certificate_no from public.certifications c where c.id = a.target_id)
                      else null
                    end,
    'patch',        a.patch,
    'metadata',     a.metadata,
    'actor',        jsonb_build_object(
      'id',    a.actor_id,
      'email', (select u.email from auth.users u where u.id = a.actor_id),
      'role',  (select pr.role::text from public.profiles pr where pr.id = a.actor_id)
    )
  ) into v_out
  from public.admin_audit_log a
  where a.id = p_id;

  if v_out is null then
    raise exception 'audit row not found' using errcode = 'P0002';
  end if;

  return v_out;
end;
$$;

comment on function public.admin_audit_log_get(uuid) is
  'Spec A6 — admin-only audit row drilldown. P0002 on unknown id.';

revoke all     on function public.admin_audit_log_get(uuid) from public;
grant  execute on function public.admin_audit_log_get(uuid) to authenticated;
