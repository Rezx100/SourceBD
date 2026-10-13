-- 0148 — The workforce of a company with buildings: its own figure and its buildings' (13 Oct 2026).
--
-- Founder, 13 Oct 2026, after sheds and units were attached to their companies (facility_of): the
-- record read "822 across 2 of the 3 sites on file, excluded: Anowara Fashions Ltd" beside a search
-- row saying 280. He asked for the whole company's workforce, as a range, the same on the record and
-- in search.
--
-- production_workers_display_batch gains two keys, and nothing it already returns changes:
--
--   own        the record's own figure: what it filed, else its RSC headcount
--   buildings  its attached buildings' figures added up: each one's RSC headcount, else what it filed
--
-- Both are present only when the record has at least one building with a figure and a figure of its
-- own. The app turns them into the range (lib/enrich-discover-workers.ts, `familyRange`): a company's
-- filed figure may or may not already count its sheds, so the whole is between the larger of the two
-- and their sum. One function feeds the record and every list, so the two cannot disagree.
--
-- The five existing keys (value, source, fetched_at, sites, includes_root) are computed exactly as
-- before; code that does not know the new keys is unaffected, so this may be applied before or after
-- the deploy that reads them.
--
-- Rollback: re-create the function from 20260810071000_production_workers_display_batch.sql as
-- amended by 0104 (the body below without the `family` CTE, its join and the two keys).

create or replace function public.production_workers_display_batch(p_supplier_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
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
      max(s.fetched_at) as fetched_at,
      count(*)::int as sites,
      bool_or(s.site_id = s.root_id) as includes_root
    from selected s
    join flags f using (root_id)
    where s.source = case when f.prefer_rsc then 'RSC' else 'registry' end
    group by s.root_id, f.prefer_rsc
  ),
  -- 0148. The record's own figure is the one it filed (the figure the Workers sort uses), and a
  -- building's is its RSC headcount, because the safety register is what lists buildings.
  family as (
    select
      root_id,
      max(coalesce(employees_total, rsc_w)) filter (where site_id = root_id) as own,
      sum(coalesce(rsc_w, employees_total)) filter (where site_id <> root_id) as buildings
    from sites
    group by root_id
  )
  select coalesce(
    jsonb_object_agg(
      a.root_id::text,
      jsonb_build_object(
        'value', a.value,
        'source', a.source,
        'fetched_at', a.fetched_at,
        'sites', a.sites,
        'includes_root', a.includes_root
      ) || case
        when fam.own > 0 and fam.buildings > 0
          then jsonb_build_object('own', fam.own::int, 'buildings', fam.buildings::int)
        else '{}'::jsonb
      end
    ),
    '{}'::jsonb
  )
  from agg a
  join family fam using (root_id);
$function$;
