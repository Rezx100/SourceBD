-- Hotfix supplier search candidate performance.
-- Removes expensive per-candidate matched_product extraction from the shared
-- candidate function; result cards still receive full principal_products.

create or replace function public.supplier_search_candidates(
  p_q                 text    default null,
  p_entity_types      text[]  default null,
  p_min_sources       int     default null,
  p_cert_kinds        text[]  default null,
  p_rsc_min           int     default null,
  p_city              text    default null,
  p_district          text    default null,
  p_category          text    default null,
  p_registries        text[]  default null,
  p_factory_types     text[]  default null,
  p_brand_codes       text[]  default null,
  p_completeness_min  int     default null,
  p_workers_min       int     default null,
  p_min_machines      int     default null
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
  machines_sewing     int,
  matched_product     text,
  search_rank         int,
  sbi_total           numeric
)
language sql
stable
set search_path = public
as $fn$
  with query_input as materialized (
    select lower(nullif(btrim(coalesce(p_q, '')), '')) as q
  ),
  raw_terms as materialized (
    select distinct case
             when term in ('childrean', 'childrens') then 'children'
             when term = 'kid' then 'kids'
             when term in ('womens', 'ladies') then 'women'
             when term = 'mens' then 'men'
             else term
           end as term
      from query_input qi
      cross join lateral regexp_split_to_table(coalesce(qi.q, ''), '[^[:alnum:]]+') as term
     where length(term) >= 2
  ),
  specific_terms as materialized (
    select rt.term
      from raw_terms rt
     where not exists (
       select 1 from public.search_stopwords sw where sw.word = rt.term
     )
  ),
  query_concepts as materialized (
    select distinct sc.concept_key, sc.group_key
      from specific_terms st
      join public.search_terms sterms on sterms.term = st.term
      join public.search_concepts sc on sc.concept_key = sterms.concept_key
  ),
  expanded_terms as materialized (
    select distinct sc.group_key, st.term, st.weight
      from query_concepts qc
      join public.search_concepts sc on sc.concept_key = qc.concept_key
      join public.search_terms st on st.concept_key = qc.concept_key
  ),
  required_product_groups as materialized (
    select distinct group_key
      from query_concepts
     where group_key in ('audience', 'garment', 'material', 'style')
  ),
  required_group_count as materialized (
    select count(*)::int as n from required_product_groups
  ),
  generic_terms as materialized (
    select st.term
      from specific_terms st
     where not exists (
       select 1 from public.search_terms sterms where sterms.term = st.term
     )
  ),
  query_flags as materialized (
    select qi.q,
           case when qi.q is null then null else '%' || qi.q || '%' end as q_like,
           case when qi.q is null then null else websearch_to_tsquery('simple', qi.q) end as tsq,
           exists (select 1 from raw_terms where term in ('factory', 'factories', 'manufacturer', 'manufacturers')) as wants_factory,
           exists (select 1 from raw_terms where term = 'buying')
             and exists (select 1 from raw_terms where term = 'house') as wants_buying_house
      from query_input qi
  ),
  filtered as materialized (
    select s.id, s.slug, s.company_name, s.entity_type::text as entity_type,
           s.city, s.district, s.source_tags,
           s.t13_source_count::int as t13_source_count,
           s.completeness_pct, s.employees_total, s.established_date,
           s.principal_products, s.factory_types,
           rr.progress_pct as rsc_progress_pct, s.parent_group_name,
           s.machines_sewing, sb.total as sbi_total,
           lower(
             coalesce(s.company_name, '') || ' ' ||
             coalesce(s.company_name_norm, '') || ' ' ||
             coalesce(s.parent_group_name, '') || ' ' ||
             coalesce(s.city, '') || ' ' ||
             coalesce(s.district, '') || ' ' ||
             coalesce(array_to_string(s.principal_products, ' '), '') || ' ' ||
             coalesce(array_to_string(s.factory_types, ' '), '') || ' ' ||
             coalesce(array_to_string(s.source_tags, ' '), '')
           ) as search_blob,
           case
             when qf.q is null then true
             when (select n from required_group_count) = 0 then true
             when (select n from required_group_count) = 1 then exists (
               select 1
                 from required_product_groups rg
                where exists (
                  select 1
                    from expanded_terms et
                   where et.group_key = rg.group_key
                     and exists (
                       select 1
                         from unnest(coalesce(s.principal_products, '{}') || coalesce(s.factory_types, '{}')) as pe(entry)
                        where lower(pe.entry) ilike '%' || et.term || '%'
                     )
                )
             )
             else exists (
               select 1
                 from unnest(coalesce(s.principal_products, '{}') || coalesce(s.factory_types, '{}')) as pe(entry)
                where not exists (
                  select 1
                    from required_product_groups rg
                   where not exists (
                     select 1
                       from expanded_terms et
                      where et.group_key = rg.group_key
                        and lower(pe.entry) ilike '%' || et.term || '%'
                   )
                )
             )
           end as product_intent_match,
           case
             when qf.q is null then true
             else not exists (
               select 1 from generic_terms gt
                where lower(
                  coalesce(s.company_name, '') || ' ' ||
                  coalesce(s.company_name_norm, '') || ' ' ||
                  coalesce(s.parent_group_name, '') || ' ' ||
                  coalesce(s.city, '') || ' ' ||
                  coalesce(s.district, '') || ' ' ||
                  coalesce(array_to_string(s.principal_products, ' '), '') || ' ' ||
                  coalesce(array_to_string(s.factory_types, ' '), '') || ' ' ||
                  coalesce(array_to_string(s.source_tags, ' '), '')
                ) not ilike '%' || gt.term || '%'
             )
           end as generic_intent_match,
           (
             case when qf.q is null then 0 else
               (case when s.company_name_norm = qf.q then 420 else 0 end) +
               (case when s.company_name_norm ilike qf.q_like then 240 else 0 end) +
               (case when exists (
                 select 1 from unnest(coalesce(s.principal_products, '{}') || coalesce(s.factory_types, '{}')) pe(entry)
                  where lower(pe.entry) = qf.q
               ) then 520 else 0 end) +
               (case when exists (
                 select 1 from unnest(coalesce(s.principal_products, '{}') || coalesce(s.factory_types, '{}')) pe(entry)
                  where lower(pe.entry) ilike qf.q_like
               ) then 380 else 0 end) +
               (case when coalesce(s.parent_group_name, '') ilike qf.q_like then 120 else 0 end) +
               (case when coalesce(s.city, '') ilike qf.q_like
                       or coalesce(s.district, '') ilike qf.q_like
                     then 90 else 0 end) +
               (case when replace(s.entity_type::text, '_', ' ') ilike qf.q_like
                       or (qf.wants_factory and s.entity_type::text = 'factory')
                       or (qf.wants_buying_house and s.entity_type::text = 'buying_house')
                     then 85 else 0 end) +
               coalesce((
                 select sum(et.weight)::int
                   from expanded_terms et
                  where exists (
                    select 1
                      from unnest(coalesce(s.principal_products, '{}') || coalesce(s.factory_types, '{}')) pe(entry)
                     where lower(pe.entry) ilike '%' || et.term || '%'
                  )
               ), 0) +
               coalesce((
                 select count(*)::int * 45
                   from generic_terms gt
                  where lower(
                    coalesce(s.company_name, '') || ' ' ||
                    coalesce(s.parent_group_name, '') || ' ' ||
                    coalesce(s.city, '') || ' ' ||
                    coalesce(s.district, '') || ' ' ||
                    coalesce(array_to_string(s.source_tags, ' '), '')
                  ) ilike '%' || gt.term || '%'
               ), 0) +
               (case when exists (
                 select 1
                   from public.certifications c
                  where c.supplier_id = s.id
                    and (c.expires_on is null or c.expires_on >= current_date)
                    and (
                      replace(c.kind::text, '_', ' ') ilike qf.q_like
                      or exists (
                        select 1 from specific_terms st
                         where replace(c.kind::text, '_', ' ') ilike '%' || st.term || '%'
                      )
                    )
               ) then 45 else 0 end) +
               (case when exists (
                 select 1
                   from public.source_records srq
                   join public.sources soq on soq.id = srq.source_id
                  where srq.supplier_id = s.id
                    and srq.status = 'active'
                    and (
                      soq.code ilike qf.q_like
                      or soq.display_name ilike qf.q_like
                      or exists (
                        select 1 from specific_terms st
                         where soq.code ilike '%' || st.term || '%'
                            or soq.display_name ilike '%' || st.term || '%'
                      )
                    )
               ) then 40 else 0 end) +
               (coalesce(ts_rank_cd(s.discover_search_tsv, qf.tsq), 0) * 1000)::int
             end
           ) as search_rank,
           null::text as matched_product
      from public.suppliers s
      cross join query_flags qf
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
       and (p_min_machines is null or s.machines_sewing >= p_min_machines)
       and (p_min_sources is null or s.t13_source_count >= p_min_sources)
  )
  select f.id, f.slug, f.company_name, f.entity_type, f.city, f.district,
         f.source_tags, f.t13_source_count, f.completeness_pct,
         f.employees_total, f.established_date, f.principal_products,
         f.factory_types, f.rsc_progress_pct, f.parent_group_name,
         f.machines_sewing, f.matched_product, f.search_rank, f.sbi_total
    from filtered f
   where (select q from query_input) is null
      or (f.product_intent_match and f.generic_intent_match and f.search_rank > 0)
$fn$;

notify pgrst, 'reload schema';
