-- REZ-114 repair: discover/saved/match display workers must match profile
-- headline (mother + facility_of buildings, RSC-preferred single source).

create or replace function public.production_workers_display_batch(p_supplier_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with roots as (
    select distinct u as root_id
    from unnest(coalesce(p_supplier_ids, array[]::uuid[])) as u
    where u is not null
  ),
  sites as (
    select
      r.root_id,
      s.id as site_id,
      s.employees_total,
      (
        select rr.workers_count
        from public.rsc_remediation rr
        where rr.supplier_id = s.id
          and rr.active is true
          and rr.workers_count is not null
        order by rr.fetched_at desc nulls last
        limit 1
      ) as rsc_w,
      (
        select rr.fetched_at
        from public.rsc_remediation rr
        where rr.supplier_id = s.id
          and rr.active is true
          and rr.workers_count is not null
        order by rr.fetched_at desc nulls last
        limit 1
      ) as rsc_fa
    from roots r
    join public.suppliers s on s.id = r.root_id
    union all
    select
      r.root_id,
      f.id as site_id,
      f.employees_total,
      (
        select rr.workers_count
        from public.rsc_remediation rr
        where rr.supplier_id = f.id
          and rr.active is true
          and rr.workers_count is not null
        order by rr.fetched_at desc nulls last
        limit 1
      ) as rsc_w,
      (
        select rr.fetched_at
        from public.rsc_remediation rr
        where rr.supplier_id = f.id
          and rr.active is true
          and rr.workers_count is not null
        order by rr.fetched_at desc nulls last
        limit 1
      ) as rsc_fa
    from roots r
    join public.suppliers f on f.facility_of = r.root_id
  ),
  selected as (
    select
      root_id,
      site_id,
      case
        when rsc_w is not null then rsc_w
        else employees_total
      end as value,
      case
        when rsc_w is not null then 'RSC'
        when employees_total is not null then 'registry'
        else null
      end as source,
      case when rsc_w is not null then rsc_fa else null end as fetched_at
    from sites
  ),
  flags as (
    select root_id, bool_or(source = 'RSC') as prefer_rsc
    from selected
    group by root_id
  ),
  agg as (
    select
      s.root_id,
      case when f.prefer_rsc then 'RSC' else 'registry' end as source,
      sum(s.value)::int as value,
      max(s.fetched_at) as fetched_at
    from selected s
    join flags f using (root_id)
    where s.source = case when f.prefer_rsc then 'RSC' else 'registry' end
    group by s.root_id, f.prefer_rsc
  )
  select coalesce(
    jsonb_object_agg(
      root_id::text,
      jsonb_build_object(
        'value', value,
        'source', source,
        'fetched_at', fetched_at
      )
    ),
    '{}'::jsonb
  )
  from agg;
$$;

revoke all on function public.production_workers_display_batch(uuid[]) from public;
grant execute on function public.production_workers_display_batch(uuid[]) to anon, authenticated;

comment on function public.production_workers_display_batch(uuid[]) is
  'REZ-114: headline production workers per supplier (mother+buildings, RSC preferred).';
