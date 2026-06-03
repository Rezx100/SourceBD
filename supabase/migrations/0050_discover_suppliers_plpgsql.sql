-- 0050 — discover_suppliers hotfix.
--
-- The 0023 SECURITY DEFINER SQL function had a per-supplier correlated
-- `count(distinct sr.source_id)` subquery and (because SECURITY DEFINER
-- SQL funcs are never inlined) PostgREST got a generic plan that picked
-- nested-loop joins — 13s with 2.7M buffer hits, blowing the 8s
-- statement_timeout. The same body inline runs in 76ms.
--
-- Fix: (a) partial index on source_records to make the t13 aggregate
-- cheap, (b) rewrite the function in PL/pgSQL with EXECUTE so each call
-- gets a fresh custom plan with literal-substituted params, picking
-- hash joins instead of nested loops. Verified 13s → 0.28s.
--
-- Same signature, RETURNS TABLE, security posture, and grants as 0023.

create index if not exists idx_source_records_supplier_t13_active
  on public.source_records (supplier_id, source_id)
  where status='active'
    and source_tier in ('tier1_gov','tier2_industry','tier3_cert');

create or replace function public.discover_suppliers(
  p_q              text    default null,
  p_entity_types   text[]  default null,
  p_min_sources    int     default null,
  p_cert_kinds     text[]  default null,
  p_rsc_min        int     default null,
  p_city           text    default null,
  p_district       text    default null,
  p_category       text    default null,
  p_sort           text    default 'receipts',
  p_limit          int     default 24,
  p_offset         int     default 0
)
returns table (
  id                  uuid,
  slug                text,
  company_name        text,
  entity_type         text,
  city                text,
  district            text,
  source_tags         text[],
  t13_source_count    int,
  completeness_pct    smallint,
  employees_total     int,
  established_date    text,
  principal_products  text[],
  factory_types       text[],
  rsc_progress_pct    numeric,
  parent_group_name   text,
  total_count         bigint
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_lim int := greatest(1, least(coalesce(p_limit, 24), 100));
  v_off int := greatest(0, coalesce(p_offset, 0));
begin
  return query execute $q$
    with t13 as materialized (
      select sr.supplier_id, count(distinct sr.source_id)::int as n
        from public.source_records sr
       where sr.status='active'
         and sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert')
       group by sr.supplier_id
    ),
    filtered as materialized (
      select s.id, s.slug, s.company_name, s.entity_type::text as entity_type,
             s.city, s.district, s.source_tags,
             coalesce(t13.n, 0) as t13_source_count,
             s.completeness_pct, s.employees_total, s.established_date,
             s.principal_products, s.factory_types,
             rr.progress_pct as rsc_progress_pct, s.parent_group_name,
             sb.total as _sbi_total
        from public.suppliers s
        left join t13 on t13.supplier_id = s.id
        left join public.rsc_remediation rr
          on rr.supplier_id = s.id and rr.active = true
        left join public.sbi_scores sb on sb.supplier_id = s.id
       where s.is_published = true
         and s.is_sanctioned = false
         and ($1 is null or $1 = ''
              or s.company_name_norm ilike '%' || lower(trim($1)) || '%')
         and ($2 is null or s.entity_type::text = any($2))
         and ($6 is null or s.city     ilike $6)
         and ($7 is null or s.district ilike $7)
         and ($5 is null or rr.progress_pct >= $5)
         and ($8 is null or $8 = ''
              or exists (
                select 1 from unnest(s.principal_products) pp
                where pp ilike '%' || $8 || '%'))
         and ($4 is null
              or exists (
                select 1 from public.certifications c
                where c.supplier_id = s.id
                  and c.kind::text = any($4)
                  and (c.expires_on is null or c.expires_on >= current_date)
              ))
    ),
    applied as materialized (
      select * from filtered
       where $3 is null or t13_source_count >= $3
    ),
    counted as (select *, count(*) over () as total_count from applied)
    select id, slug, company_name, entity_type, city, district, source_tags,
           t13_source_count, completeness_pct, employees_total, established_date,
           principal_products, factory_types, rsc_progress_pct, parent_group_name,
           total_count
      from counted
     order by
       case when $9='completeness' then completeness_pct end desc nulls last,
       case when $9='name'         then company_name     end asc,
       case when $9='receipts'     then t13_source_count end desc nulls last,
       _sbi_total desc nulls last,
       t13_source_count desc nulls last,
       company_name asc
     limit $10 offset $11
  $q$
  using p_q, p_entity_types, p_min_sources, p_cert_kinds, p_rsc_min,
        p_city, p_district, p_category, p_sort, v_lim, v_off;
end;
$fn$;

comment on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int
) is
  'Spec B1 buyer Discover RPC (perf 0050, plpgsql + EXECUTE for custom plans).';

revoke all on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int
) from public;

grant execute on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int
) to anon, authenticated;
