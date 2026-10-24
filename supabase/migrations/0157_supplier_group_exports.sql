-- 0157 — A group's exports beside a member that has none of its own (24 Oct 2026).
--
-- 4A Yarn Dyeing Ltd. (Team Group) shows "no customs records" while its sister Mars Stitch Ltd. has 990
-- shipments: a group often ships its orders under one member's name. The founder: show the sister
-- companies' exports on the member's record, clearly labelled as the group's, never as the member's own.
--
-- supplier_group_exports(slug) answers only the readers supplier_volza_exports() answers (admin, or a
-- Growth/Enterprise buyer who is not suspended: Volza's licence), only for a published member of a real
-- group (parent_group_name set, not RSC's "Not in a Group" placeholder), and only when the member has no
-- exact customs row of its own. It returns the group's name and up to three published sisters with an
-- exact, unexpired row, biggest first. Read only: expired rows are purged by supplier_volza_exports().
--
-- Rollback:
--   drop function public.supplier_group_exports(text);

create or replace function public.supplier_group_exports(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
  v_id      uuid;
  v_group   text;
  v_members jsonb;
begin
  select (p.role = 'admin' or p.plan_tier in ('growth', 'enterprise'))
         and not coalesce(p.is_suspended, false)
    into v_allowed
    from public.profiles p
   where p.id = auth.uid();
  if not coalesce(v_allowed, false) then
    return null;
  end if;

  select s.id, nullif(btrim(s.parent_group_name), '')
    into v_id, v_group
    from public.suppliers s
   where s.slug = p_slug
     and s.is_published = true;
  if v_group is null or v_group ~* '^not in a group$' then
    return null;
  end if;

  -- A member with its own records shows those; the group's are never mixed in.
  if exists (select 1 from public.volza_export_checks v
              where v.supplier_id = v_id and v.match_class = 'exact' and v.expires_at > now()) then
    return null;
  end if;

  select jsonb_agg(m.j order by m.shipments desc)
    into v_members
    from (select v.shipments,
                 jsonb_build_object(
                   'name',         coalesce(nullif(btrim(s.name_display), ''), s.company_name),
                   'slug',         s.slug,
                   'shipments',    v.shipments,
                   'fob_usd',      v.fob_usd,
                   'buyers',       v.buyers,
                   'window_start', v.window_start,
                   'window_end',   v.window_end) as j
            from public.suppliers s
            join public.volza_export_checks v on v.supplier_id = s.id
           where btrim(s.parent_group_name) = v_group
             and s.id <> v_id
             and s.is_published = true
             and v.match_class = 'exact'
             and v.expires_at > now()
           order by v.shipments desc
           limit 3) m;

  if v_members is null then
    return null;
  end if;
  return jsonb_build_object('group', v_group, 'members', v_members);
end;
$$;

comment on function public.supplier_group_exports(text) is
  'Customs export totals of up to three sister companies in a published supplier''s group, for the readers '
  'supplier_volza_exports() answers, only when the supplier has no exact row of its own. 0157.';

revoke all on function public.supplier_group_exports(text) from public;
revoke all on function public.supplier_group_exports(text) from anon;
grant execute on function public.supplier_group_exports(text) to authenticated, service_role;
