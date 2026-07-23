-- Discover text path: stay under PostgREST ~3s statement timeout.
-- Drop heavy per-row rank extras and supplier_primary_address() on search
-- results; use FTS rank + address_raw. Exact primary address remains on profile.

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
  primary_address     text,
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
      ),
      page as (
        select c.*
          from counted c
         order by
           case when p_sort = 'completeness' then c.completeness_pct end desc nulls last,
           case when p_sort = 'name' then c.company_name end asc,
           case when p_sort = 'receipts' then c.t13_source_count end desc nulls last,
           c.sbi_total desc nulls last,
           c.t13_source_count desc nulls last,
           c.company_name asc
         limit v_lim offset v_off
      )
      select p.id, p.slug, p.company_name, p.entity_type, p.city, p.district,
             p.source_tags, p.t13_source_count, p.completeness_pct,
             p.employees_total, p.established_date, p.principal_products,
             p.factory_types, p.rsc_progress_pct, p.parent_group_name,
             s.address_raw as primary_address,
             p.total_count
        from page p
        join public.suppliers s on s.id = p.id;
    return;
  end if;

  return query
    with query_flags as materialized (
      select v_q as q,
             '%' || v_q || '%' as q_like,
             websearch_to_tsquery('simple', v_q) as tsq
    ),
    filtered as materialized (
      select s.id, s.slug, s.company_name, s.entity_type::text as entity_type,
             s.city, s.district, s.source_tags,
             s.t13_source_count::int as t13_source_count,
             s.completeness_pct, s.employees_total, s.established_date,
             s.principal_products, s.factory_types,
             rr.progress_pct as rsc_progress_pct, s.parent_group_name,
             s.address_raw as primary_address,
             sb.total as sbi_total,
             (
               (coalesce(ts_rank_cd(s.discover_search_tsv, qf.tsq), 0) * 1000)::int +
               case when s.company_name_norm ilike qf.q_like then 240 else 0 end
             ) as search_rank
        from public.suppliers s
        cross join query_flags qf
        left join public.rsc_remediation rr
          on rr.supplier_id = s.id and rr.active = true
        left join public.sbi_scores sb on sb.supplier_id = s.id
       where s.is_published = true
         and s.is_sanctioned = false
         and (
           (qf.tsq is not null and s.discover_search_tsv @@ qf.tsq)
           or s.company_name_norm ilike qf.q_like
           or coalesce(s.parent_group_name, '') ilike qf.q_like
           or coalesce(s.city, '') ilike qf.q_like
           or coalesce(s.district, '') ilike qf.q_like
         )
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
    stats as materialized (
      select count(*)::bigint as total_count
        from filtered
       where search_rank > 0
    ),
    page as (
      select f.*
        from filtered f
       where f.search_rank > 0
       order by
         case when p_sort = 'completeness' then f.completeness_pct end desc nulls last,
         case when p_sort = 'name' then f.company_name end asc,
         case when p_sort = 'receipts' then f.t13_source_count end desc nulls last,
         case when coalesce(p_sort, 'default') = 'default' then f.search_rank end desc nulls last,
         f.sbi_total desc nulls last,
         f.t13_source_count desc nulls last,
         f.company_name asc
       limit v_lim offset v_off
    )
    select p.id, p.slug, p.company_name, p.entity_type, p.city, p.district,
           p.source_tags, p.t13_source_count, p.completeness_pct,
           p.employees_total, p.established_date, p.principal_products,
           p.factory_types, p.rsc_progress_pct, p.parent_group_name,
           p.primary_address,
           s.total_count
      from page p
      cross join stats s;
end;
$fn$;

create index if not exists idx_suppliers_published_discover_tsv
  on public.suppliers using gin (discover_search_tsv)
  where is_published = true and is_sanctioned = false;

comment on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) is
  'Spec B1 Discover RPC. Text search uses FTS rank under PostgREST timeout; browse keeps primary_address lookup.';

revoke all on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) from public;

grant execute on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) to anon, authenticated;

notify pgrst, 'reload schema';
