-- Discover browse fast path.
-- Empty-query Discover was routing through supplier_search_candidates, which
-- materialises and ranks every published supplier and exceeds PostgREST's
-- statement timeout. Keep the shared search brain for text queries; use the
-- direct suppliers scan for browse / filter-only loads.

create or replace function public.discover_suppliers(
  p_q                 text    default null,
  p_entity_types      text[]  default null,
  p_min_sources       int     default null,
  p_cert_kinds        text[]  default null,
  p_rsc_min           int     default null,
  p_city              text    default null,
  p_district          text    default null,
  p_category          text    default null,
  p_sort              text    default 'receipts',
  p_limit             int     default 24,
  p_offset            int     default 0,
  p_registries        text[]  default null,
  p_factory_types     text[]  default null,
  p_brand_codes       text[]  default null,
  p_completeness_min  int     default null,
  p_workers_min       int     default null
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
  v_q   text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if v_q is null then
    return query
      with filtered as materialized (
        select s.id, s.slug, s.company_name, s.entity_type::text as entity_type,
               s.city, s.district, s.source_tags,
               s.t13_source_count::int as t13_source_count,
               s.completeness_pct, s.employees_total, s.established_date,
               s.principal_products, s.factory_types,
               rr.progress_pct as rsc_progress_pct, s.parent_group_name,
               sb.total as sbi_total
          from public.suppliers s
          left join public.rsc_remediation rr
            on rr.supplier_id = s.id and rr.active = true
          left join public.sbi_scores sb on sb.supplier_id = s.id
         where s.is_published = true
           and s.is_sanctioned = false
           and (p_entity_types is null or s.entity_type::text = any(p_entity_types))
           and (p_city is null or s.city ilike '%' || p_city || '%')
           and (p_district is null or s.district ilike '%' || p_district || '%')
           and (p_rsc_min is null or rr.progress_pct >= p_rsc_min)
           and (p_category is null or p_category = ''
                or exists (
                  select 1 from unnest(s.principal_products) pp
                   where pp ilike '%' || p_category || '%'))
           and (p_cert_kinds is null
                or exists (
                  select 1 from public.certifications c
                   where c.supplier_id = s.id
                     and c.kind::text = any(p_cert_kinds)
                     and (c.expires_on is null or c.expires_on >= current_date)
                ))
           and (p_registries is null
                or exists (
                  select 1
                    from public.v_supplier_registry_ids vp
                   where vp.supplier_id = s.id
                     and vp.source_code = any(p_registries)
                ))
           and (p_factory_types is null or s.factory_types && p_factory_types)
           and (p_brand_codes is null
                or exists (
                  select 1
                    from public.source_records sr3
                    join public.sources so3 on so3.id = sr3.source_id
                   where sr3.supplier_id = s.id
                     and sr3.status = 'active'
                     and so3.code = any(p_brand_codes)
                ))
           and (p_completeness_min is null or s.completeness_pct >= p_completeness_min)
           and (p_workers_min is null or s.employees_total >= p_workers_min)
           and (p_min_sources is null or s.t13_source_count >= p_min_sources)
      ),
      counted as (
        select f.*, count(*) over () as total_count
          from filtered f
      )
      select c.id, c.slug, c.company_name, c.entity_type, c.city, c.district,
             c.source_tags, c.t13_source_count, c.completeness_pct,
             c.employees_total, c.established_date, c.principal_products,
             c.factory_types, c.rsc_progress_pct, c.parent_group_name,
             c.total_count
        from counted c
       order by
         case when p_sort = 'completeness' then c.completeness_pct end desc nulls last,
         case when p_sort = 'name' then c.company_name end asc,
         case when p_sort = 'receipts' then c.t13_source_count end desc nulls last,
         c.sbi_total desc nulls last,
         c.t13_source_count desc nulls last,
         c.company_name asc
       limit v_lim offset v_off;
    return;
  end if;

  return query
    with candidates as materialized (
      select *
        from public.supplier_search_candidates(
          p_q, p_entity_types, p_min_sources, p_cert_kinds, p_rsc_min,
          p_city, p_district, p_category, p_registries, p_factory_types,
          p_brand_codes, p_completeness_min, p_workers_min, null::int
        )
    ),
    counted as (
      select c.*, count(*) over () as total_count
        from candidates c
    )
    select c.id, c.slug, c.company_name, c.entity_type, c.city, c.district,
           c.source_tags, c.t13_source_count, c.completeness_pct,
           c.employees_total, c.established_date, c.principal_products,
           c.factory_types, c.rsc_progress_pct, c.parent_group_name,
           c.total_count
      from counted c
     order by
       case when p_sort = 'completeness' then c.completeness_pct end desc nulls last,
       case when p_sort = 'name' then c.company_name end asc,
       case when p_sort = 'receipts' then c.t13_source_count end desc nulls last,
       case when coalesce(p_sort, 'default') = 'default' then c.search_rank end desc nulls last,
       c.sbi_total desc nulls last,
       c.t13_source_count desc nulls last,
       c.company_name asc
     limit v_lim offset v_off;
end;
$fn$;

comment on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) is
  'Spec B1 Discover RPC. Browse/filter-only loads use a direct suppliers scan; text queries use supplier_search_candidates.';

revoke all on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) from public;

grant execute on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) to anon, authenticated;

notify pgrst, 'reload schema';
