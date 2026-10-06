-- 0128 — Review queue: the Release answer is worked out once and kept, not fifty times a page (6 Oct 2026).
--
-- Plan: .impeccable/handoff-admin-moderation.md, build item 0d ("All open" times out).
--
-- WHY
-- ---
-- admin_queue_list (0102) works out the Release plan for every row of the page on every load:
-- `cross join lateral admin_queue_release_plan(p.id)`. For a building-shaped or near-match
-- name the plan scans every published supplier through a stack of regular expressions
-- (_queue_mother_hits), so fifty rows can be fifty full-table passes, and the "All open" tab
-- hits the statement timeout. The founder asked for the numbers before the fix; this machine
-- cannot reach production, so ops/time_admin_queue_list.py prints the read-only timing SQL
-- for the founder to run, and the fix below bounds the cost whatever the numbers turn out to be.
--
-- WHAT
-- ----
--   1. verification_queue.release_plan / release_plan_at: the plan as last worked out, and when.
--   2. admin_queue_list reads the kept plan. A row whose plan is missing or older than a day is
--      worked out afresh, AT MOST TEN ROWS PER CALL, newest first, and kept. Rows past the cap
--      answer `plan_pending: true` with no destination; the next load takes the next ten. So a
--      page costs at most ten plans, and a queue that has been loaded once costs none.
--   3. admin_queue_decide is untouched: it still works out the plan fresh at the moment of the
--      decision (0102), so a kept plan can only ever affect the label on the list, never what
--      Release does.
--
-- The function's signature and every key it returned are kept; `plan_pending` and `plan_at` are
-- added. It becomes VOLATILE because it writes the kept plan; the page calls it over POST.
--
-- Dry run and timing: ops/plans/0128-queue-plan-cache.md.
--
-- REVERSE
-- -------
--   Restore admin_queue_list from 0102_admin_queue_release.sql;
--   alter table public.verification_queue drop column release_plan, drop column release_plan_at;

set search_path = public;

alter table public.verification_queue
  add column if not exists release_plan    jsonb,
  add column if not exists release_plan_at timestamptz;

comment on column public.verification_queue.release_plan is
  '0128: the Release plan (admin_queue_release_plan) as last worked out for the list; decide recomputes it.';

create or replace function public.admin_queue_list(
  p_type   text default null,
  p_status text default 'open',
  p_limit  int  default 50,
  p_offset int  default 0
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_uid       uuid := auth.uid();
  v_role      text;
  v_type      text := nullif(btrim(coalesce(p_type, '')), '');
  v_status    text := lower(coalesce(nullif(btrim(p_status), ''), 'open'));
  v_limit     int  := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset    int  := greatest(0, coalesce(p_offset, 0));
  v_max_age   constant interval := interval '1 day';
  v_fresh_cap constant int := 10;
  v_out       jsonb;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;
  if v_status not in ('open', 'reviewed', 'all') then
    raise exception 'status must be open|reviewed|all' using errcode = '22023';
  end if;
  if v_type is not null and not exists (
    select 1
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
     where t.typnamespace = 'public'::regnamespace
       and t.typname = 'queue_type'
       and e.enumlabel = v_type
  ) then
    raise exception 'unknown queue_type %', v_type using errcode = '22023';
  end if;

  -- Work out and keep the plan for at most v_fresh_cap rows of THIS page that have none or a
  -- stale one. Open rows only (a decided row's label is history), and never the two queue types
  -- that have their own decision flow.
  update public.verification_queue q
     set release_plan    = public.admin_queue_release_plan(q.id),
         release_plan_at = now()
   where q.id in (
     select p.id
       from (
         select q2.id, q2.created_at, q2.reviewed_at, q2.queue_type, q2.release_plan_at
           from public.verification_queue q2
          where (v_type is null or q2.queue_type::text = v_type)
            and (
              v_status = 'all'
              or (v_status = 'open' and q2.reviewed_at is null)
              or (v_status = 'reviewed' and q2.reviewed_at is not null)
            )
          order by q2.created_at desc
          limit v_limit offset v_offset
       ) p
      where p.reviewed_at is null
        and p.queue_type::text not in ('cert_doc_review', 'sanctions_hit')
        and (p.release_plan_at is null or p.release_plan_at < now() - v_max_age)
      order by p.created_at desc
      limit v_fresh_cap
   );

  with open_by_type as (
    select q.queue_type::text as queue_type, count(*)::bigint as n
      from public.verification_queue q
     where q.reviewed_at is null
     group by q.queue_type
  ),
  filtered as (
    select
      q.id,
      q.queue_type::text as queue_type,
      q.supplier_a_id,
      q.supplier_b_name,
      q.confidence,
      q.source_data,
      q.admin_action::text as admin_action,
      q.reviewed_at,
      q.reviewed_by,
      q.created_at,
      q.release_plan,
      q.release_plan_at,
      s.slug,
      s.company_name,
      s.name_display,
      s.entity_type::text as entity_type,
      s.city,
      s.district,
      s.is_published as published,
      (
        select count(distinct sr.source_id)::int
          from public.source_records sr
         where sr.supplier_id = s.id
           and sr.source_tier in ('tier1_gov', 'tier2_industry', 'tier3_cert')
           and sr.status = 'active'
      ) as tier_coverage
    from public.verification_queue q
    left join public.suppliers s on s.id = q.supplier_a_id
   where (v_type is null or q.queue_type::text = v_type)
     and (
       v_status = 'all'
       or (v_status = 'open' and q.reviewed_at is null)
       or (v_status = 'reviewed' and q.reviewed_at is not null)
     )
  ),
  page as (
    select *
      from filtered
     order by created_at desc
     limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'by_type', coalesce((
      select jsonb_object_agg(queue_type, n order by queue_type)
        from open_by_type
    ), '{}'::jsonb),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'queue_id',          p.id,
        'queue_type',        p.queue_type,
        'supplier_b_name',   p.supplier_b_name,
        'confidence',        p.confidence,
        'source_data',       p.source_data,
        'admin_action',      p.admin_action,
        'reviewed_at',       p.reviewed_at,
        'reviewed_by',       p.reviewed_by,
        'created_at',        p.created_at,
        'release_action',    (p.release_plan->>'action'),
        'buyer_destination', (p.release_plan->>'buyer_destination'),
        'plan_pending',      (p.reviewed_at is null
                              and p.release_plan is null
                              and p.queue_type not in ('cert_doc_review', 'sanctions_hit')),
        'plan_at',           p.release_plan_at,
        'supplier', case when p.supplier_a_id is null then null else jsonb_build_object(
          'id',            p.supplier_a_id,
          'slug',          p.slug,
          'company_name',  p.company_name,
          'name_display',  p.name_display,
          'entity_type',   p.entity_type,
          'city',          p.city,
          'district',      p.district,
          'published',     p.published,
          'tier_coverage', p.tier_coverage
        ) end
      ) order by p.created_at desc)
      from page p
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

comment on function public.admin_queue_list(text, text, int, int) is
  '0128: admin-only review queue page. Reads the kept Release plan; works out and keeps at most ten '
  'missing or day-old plans per call (plan_pending marks the rest). Decide recomputes the plan itself.';

revoke all on function public.admin_queue_list(text, text, int, int) from public, anon, authenticated;
grant execute on function public.admin_queue_list(text, text, int, int) to authenticated;
