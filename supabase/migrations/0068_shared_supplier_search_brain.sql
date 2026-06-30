-- Shared Supplier Search Brain.
-- Refactors Discover and Find Matches onto one taxonomy-backed candidate
-- function so synonym, misspelling, compound-intent, and location behavior
-- cannot drift between the two buyer search surfaces.

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

comment on function public.supplier_search_candidates(
  text, text[], int, text[], int, text, text, text,
  text[], text[], text[], int, int, int
) is
  'Internal shared supplier search brain for Discover and Find Matches. Returns internal rank/tiebreak data; do not grant directly to app roles.';

revoke all on function public.supplier_search_candidates(
  text, text[], int, text[], int, text, text, text,
  text[], text[], text[], int, int, int
) from public;

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
begin
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
  'Spec B1 Discover RPC backed by shared supplier_search_candidates search brain.';

revoke all on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) from public;

grant execute on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) to anon, authenticated;

create or replace function public.buyer_smart_match(p_input jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_product       text   := nullif(btrim(coalesce(p_input->>'product', '')), '');
  v_entity_types  text[] := case
                              when jsonb_typeof(p_input->'entity_types') = 'array'
                              then array(select jsonb_array_elements_text(p_input->'entity_types'))
                              else null
                            end;
  v_registries    text[] := case
                              when jsonb_typeof(p_input->'registries') = 'array'
                              then array(select upper(x) from jsonb_array_elements_text(p_input->'registries') as t(x))
                              else null
                            end;
  v_certs         text[] := case
                              when jsonb_typeof(p_input->'certs') = 'array'
                              then array(select lower(x) from jsonb_array_elements_text(p_input->'certs') as t(x))
                              else null
                            end;
  v_rsc_min       int    := nullif(p_input->>'rsc_min', '')::int;
  v_min_machines  int    := nullif(p_input->>'min_machines', '')::int;
  v_city          text   := nullif(btrim(coalesce(p_input->>'city', '')), '');
  v_district      text   := nullif(btrim(coalesce(p_input->>'district', '')), '');
  v_limit         int    := greatest(1, least(coalesce(nullif(p_input->>'limit', '')::int, 24), 100));
  v_offset        int    := greatest(0, coalesce(nullif(p_input->>'offset', '')::int, 0));
  v_criteria_count int   := 0;
  v_results       jsonb;
  v_total         int;
begin
  if v_rsc_min is not null and (v_rsc_min < 0 or v_rsc_min > 100) then
    v_rsc_min := null;
  end if;
  if v_min_machines is not null and v_min_machines < 0 then
    v_min_machines := null;
  end if;
  if v_entity_types is not null and array_length(v_entity_types, 1) is null then
    v_entity_types := null;
  end if;
  if v_registries is not null and array_length(v_registries, 1) is null then
    v_registries := null;
  end if;
  if v_certs is not null and array_length(v_certs, 1) is null then
    v_certs := null;
  end if;

  v_criteria_count :=
      (case when v_product       is not null then 1 else 0 end)
    + (case when v_entity_types  is not null then 1 else 0 end)
    + (case when v_registries    is not null then 1 else 0 end)
    + (case when v_certs         is not null then 1 else 0 end)
    + (case when v_rsc_min       is not null then 1 else 0 end)
    + (case when v_min_machines  is not null then 1 else 0 end)
    + (case when v_city          is not null then 1 else 0 end)
    + (case when v_district      is not null then 1 else 0 end);

  with candidates as materialized (
    select *
      from public.supplier_search_candidates(
        v_product, v_entity_types, null::int, v_certs, v_rsc_min,
        v_city, v_district, null::text, v_registries, null::text[],
        null::text[], null::int, null::int, v_min_machines
      )
  ),
  matched as materialized (
    select c.*,
           coalesce((
             select array(
               select jsonb_build_object('code', src_code, 'value', any_value)
                 from (
                   select vp.source_code as src_code,
                          (array_agg(vp.value order by vp.value) filter (where vp.value is not null))[1] as any_value
                     from public.v_supplier_registry_ids vp
                    where vp.supplier_id = c.id
                      and vp.source_code = any(v_registries)
                    group by vp.source_code
                 ) g
                order by src_code
             )
           ), '{}'::jsonb[]) as matched_registries,
           coalesce((
             select array_agg(distinct cert.kind::text order by cert.kind::text)
               from public.certifications cert
              where cert.supplier_id = c.id
                and cert.kind::text = any(v_certs)
                and (cert.expires_on is null or cert.expires_on >= current_date)
           ), '{}'::text[]) as matched_certs,
           (v_rsc_min is not null and c.rsc_progress_pct is not null and c.rsc_progress_pct >= v_rsc_min) as matched_rsc,
           (v_min_machines is not null and c.machines_sewing is not null and c.machines_sewing >= v_min_machines) as matched_machines
      from candidates c
  ),
  ranked as materialized (
    select m.*,
           (
             (case when v_product      is not null and m.search_rank > 0 then 1 else 0 end)
           + (case when v_entity_types is not null then 1 else 0 end)
           + (case when v_city         is not null then 1 else 0 end)
           + (case when v_district     is not null then 1 else 0 end)
           + (case when v_registries   is not null and array_length(m.matched_registries, 1) > 0 then 1 else 0 end)
           + (case when v_certs        is not null and array_length(m.matched_certs, 1) > 0 then 1 else 0 end)
           + (case when m.matched_rsc      then 1 else 0 end)
           + (case when m.matched_machines then 1 else 0 end)
           )::int as match_score
      from matched m
  ),
  counted as materialized (
    select r.*, count(*) over ()::int as total_count
      from ranked r
  ),
  page_rows as materialized (
    select *
      from counted
     order by
       search_rank desc nulls last,
       match_score desc,
       sbi_total desc nulls last,
       t13_source_count desc,
       company_name asc
     limit v_limit offset v_offset
  ),
  with_reasons as (
    select p.*,
           (
             coalesce(array(
               select 'Certified: ' || upper(replace(c, '_', '-'))
                 from unnest(p.matched_certs) c
                order by c
             ), '{}'::text[])
             ||
             coalesce(array(
               select case
                        when (pill->>'value') is not null and btrim(pill->>'value') <> ''
                          then (pill->>'code') || '-verified - #' || (pill->>'value')
                        else (pill->>'code') || '-verified'
                      end
                 from unnest(p.matched_registries) pill
                order by (pill->>'code')
             ), '{}'::text[])
             ||
             case when p.matched_rsc
               then array['RSC remediation ' || round(p.rsc_progress_pct)::text || '%']
               else '{}'::text[]
             end
             ||
             case when p.matched_machines
               then array[p.machines_sewing::text || '+ sewing machines']
               else '{}'::text[]
             end
             ||
             case when p.matched_product is not null
               then array['Makes ' || p.matched_product]
               when v_product is not null
               then array['Search match: ' || v_product]
               else '{}'::text[]
             end
           ) as match_reasons
      from page_rows p
  )
  select
    (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id',                w.id,
          'slug',              w.slug,
          'company_name',      w.company_name,
          'entity_type',       w.entity_type,
          'city',              w.city,
          'district',          w.district,
          'completeness_pct',  w.completeness_pct,
          'employees_total',   w.employees_total,
          'established_date',  w.established_date,
          'principal_products', to_jsonb(w.principal_products),
          'factory_types',     to_jsonb(w.factory_types),
          'rsc_progress_pct',  w.rsc_progress_pct,
          'parent_group_name', w.parent_group_name,
          't13_source_count',  w.t13_source_count,
          'source_tags',       to_jsonb(w.source_tags),
          'match_score',       w.match_score,
          'match_reasons',     to_jsonb(w.match_reasons)
        )
        order by
          w.search_rank desc nulls last,
          w.match_score desc,
          w.sbi_total desc nulls last,
          w.t13_source_count desc,
          w.company_name asc
      ), '[]'::jsonb)
      from with_reasons w
    ),
    (select coalesce(max(c.total_count), 0)::int from counted c)
  into v_results, v_total
  ;

  return jsonb_build_object(
    'criteria_count', v_criteria_count,
    'total',          v_total,
    'limit',          v_limit,
    'offset',         v_offset,
    'has_more',       (v_offset + v_limit) < v_total,
    'results',        v_results
  );
end;
$$;

comment on function public.buyer_smart_match(jsonb) is
  'Spec B4 buyer Smart Match RPC backed by shared supplier_search_candidates search brain. Returns paginated full totals without contact PII or SBI values.';

revoke all on function public.buyer_smart_match(jsonb) from public;
grant execute on function public.buyer_smart_match(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
