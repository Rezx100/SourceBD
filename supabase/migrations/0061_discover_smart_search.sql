-- 0061 — smart keyword search for Discover.
--
-- Keeps the public.discover_suppliers signature and return shape from 0054,
-- but broadens p_q from company-name-only matching to a buyer-style search
-- over products, factory types, locations, entity wording, source tags, and
-- active evidence records. SBI remains server-side only: it is still used as
-- a tie-breaker and is never returned.

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
  return query execute $q$
    with query_input as materialized (
      select lower(nullif(btrim(coalesce($1, '')), '')) as q
    ),
    raw_terms as materialized (
      select distinct term
        from query_input qi
        cross join lateral regexp_split_to_table(coalesce(qi.q, ''), '[^[:alnum:]]+') as term
       where length(term) >= 2
    ),
    specific_terms as materialized (
      select term
        from raw_terms
       where term not in (
         'a', 'an', 'and', 'any', 'all', 'for', 'from', 'in', 'into', 'near',
         'of', 'on', 'the', 'that', 'this', 'to', 'with', 'who',
         'make', 'makes', 'maker', 'makers', 'need', 'needs', 'want', 'wants',
         'looking', 'find', 'kind', 'kinds',
         'supplier', 'suppliers', 'manufacturer', 'manufacturers',
         'company', 'companies', 'exporter', 'exporters',
         'factory', 'factories', 'garment', 'garments', 'apparel',
         'product', 'products', 'buying', 'house'
       )
    ),
    search_terms as materialized (
      select distinct expanded.term
        from specific_terms st
        cross join lateral unnest(
          case
            when st.term in ('shirt', 'shirts', 'tshirt', 'tshirts', 'tee', 'tees') then
              array['shirt', 'shirts', 't-shirt', 'tshirts', 'tshirt', 'tee', 'tees']
            when st.term in ('pant', 'pants', 'trouser', 'trousers') then
              array['pant', 'pants', 'trouser', 'trousers']
            when st.term in ('jean', 'jeans', 'denim') then
              array['jean', 'jeans', 'denim']
            when st.term in ('knit', 'knits', 'knitwear') then
              array['knit', 'knits', 'knitwear']
            when st.term in ('sweater', 'sweaters', 'pullover', 'pullovers') then
              array['sweater', 'sweaters', 'pullover', 'pullovers']
            when st.term in ('lingerie', 'underwear', 'innerwear') then
              array['lingerie', 'underwear', 'innerwear']
            when st.term in ('child', 'children', 'childrens', 'kids', 'kid') then
              array['child', 'children', 'childrens', 'kids', 'kid']
            when st.term in ('jacket', 'jackets', 'outerwear') then
              array['jacket', 'jackets', 'outerwear']
            when st.term in ('hoodie', 'hoodies', 'sweatshirt', 'sweatshirts') then
              array['hoodie', 'hoodies', 'sweatshirt', 'sweatshirts']
            else array[st.term]
          end
        ) as expanded(term)
    ),
    query_flags as materialized (
      select qi.q,
             case when qi.q is null then null else '%' || qi.q || '%' end as q_like,
             exists (select 1 from search_terms) as has_terms,
             exists (
               select 1 from raw_terms
                where term in ('factory', 'factories', 'manufacturer', 'manufacturers')
             ) as wants_factory,
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
             sb.total as _sbi_total,
             case
               when qf.q is null then 0
               else
                 (case when s.company_name_norm = qf.q then 420 else 0 end) +
                 (case when s.company_name_norm ilike qf.q_like then 240 else 0 end) +
                 (case when coalesce(s.parent_group_name, '') ilike qf.q_like then 120 else 0 end) +
                 (case when exists (
                   select 1 from unnest(s.principal_products) pp
                    where pp ilike qf.q_like
                 ) then 220 else 0 end) +
                 (case when exists (
                   select 1 from unnest(s.factory_types) ft
                    where ft ilike qf.q_like
                 ) then 170 else 0 end) +
                 (case when coalesce(s.city, '') ilike qf.q_like
                         or coalesce(s.district, '') ilike qf.q_like
                       then 90 else 0 end) +
                 (case when replace(s.entity_type::text, '_', ' ') ilike qf.q_like
                         or (qf.wants_factory and s.entity_type::text = 'factory')
                         or (qf.wants_buying_house and s.entity_type::text = 'buying_house')
                       then 85 else 0 end) +
                 coalesce((
                   select count(*)::int * 80
                     from search_terms st
                    where exists (
                      select 1 from unnest(s.principal_products) pp
                       where pp ilike '%' || st.term || '%'
                    )
                 ), 0) +
                 coalesce((
                   select count(*)::int * 60
                     from search_terms st
                    where exists (
                      select 1 from unnest(s.factory_types) ft
                       where ft ilike '%' || st.term || '%'
                    )
                 ), 0) +
                 coalesce((
                   select count(*)::int * 45
                     from search_terms st
                    where s.company_name_norm ilike '%' || st.term || '%'
                       or coalesce(s.parent_group_name, '') ilike '%' || st.term || '%'
                 ), 0) +
                 coalesce((
                   select count(*)::int * 35
                     from search_terms st
                    where coalesce(s.city, '') ilike '%' || st.term || '%'
                       or coalesce(s.district, '') ilike '%' || st.term || '%'
                 ), 0) +
                 coalesce((
                   select count(*)::int * 30
                     from search_terms st
                    where exists (
                      select 1 from unnest(s.source_tags) tag
                       where tag ilike '%' || st.term || '%'
                    )
                 ), 0) +
                 (case when exists (
                   select 1
                     from public.certifications c
                    where c.supplier_id = s.id
                      and (c.expires_on is null or c.expires_on >= current_date)
                      and (
                        replace(c.kind::text, '_', ' ') ilike qf.q_like
                        or exists (
                          select 1 from search_terms st
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
                          select 1 from search_terms st
                           where soq.code ilike '%' || st.term || '%'
                              or soq.display_name ilike '%' || st.term || '%'
                        )
                      )
                 ) then 40 else 0 end)
             end as _search_rank
        from public.suppliers s
        cross join query_flags qf
        left join public.rsc_remediation rr
          on rr.supplier_id = s.id and rr.active = true
        left join public.sbi_scores sb on sb.supplier_id = s.id
       where s.is_published = true
         and s.is_sanctioned = false
         and (
           qf.q is null
           or s.company_name_norm ilike qf.q_like
           or coalesce(s.parent_group_name, '') ilike qf.q_like
           or replace(s.entity_type::text, '_', ' ') ilike qf.q_like
           or exists (
             select 1 from unnest(s.principal_products) pp
              where pp ilike qf.q_like
           )
           or exists (
             select 1 from unnest(s.factory_types) ft
              where ft ilike qf.q_like
           )
           or coalesce(s.city, '') ilike qf.q_like
           or coalesce(s.district, '') ilike qf.q_like
           or exists (
             select 1 from unnest(s.source_tags) tag
              where tag ilike qf.q_like
           )
           or (qf.wants_factory and s.entity_type::text = 'factory')
           or (qf.wants_buying_house and s.entity_type::text = 'buying_house')
           or (qf.has_terms and exists (
             select 1
               from search_terms st
              where s.company_name_norm ilike '%' || st.term || '%'
                 or coalesce(s.parent_group_name, '') ilike '%' || st.term || '%'
                 or coalesce(s.city, '') ilike '%' || st.term || '%'
                 or coalesce(s.district, '') ilike '%' || st.term || '%'
                 or replace(s.entity_type::text, '_', ' ') ilike '%' || st.term || '%'
                 or exists (
                   select 1 from unnest(s.principal_products) pp
                    where pp ilike '%' || st.term || '%'
                 )
                 or exists (
                   select 1 from unnest(s.factory_types) ft
                    where ft ilike '%' || st.term || '%'
                 )
                 or exists (
                   select 1 from unnest(s.source_tags) tag
                    where tag ilike '%' || st.term || '%'
                 )
                 or exists (
                   select 1
                     from public.certifications c
                    where c.supplier_id = s.id
                      and (c.expires_on is null or c.expires_on >= current_date)
                      and replace(c.kind::text, '_', ' ') ilike '%' || st.term || '%'
                 )
                 or exists (
                   select 1
                     from public.source_records srq
                     join public.sources soq on soq.id = srq.source_id
                    where srq.supplier_id = s.id
                      and srq.status = 'active'
                      and (
                        soq.code ilike '%' || st.term || '%'
                        or soq.display_name ilike '%' || st.term || '%'
                      )
                 )
           ))
         )
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
         and ($12 is null
              or exists (
                select 1
                  from public.source_records sr2
                  join public.sources so2 on so2.id = sr2.source_id
                 where sr2.supplier_id = s.id
                   and sr2.status = 'active'
                   and so2.code = any($12)
              ))
         and ($13 is null or s.factory_types && $13)
         and ($14 is null
              or exists (
                select 1
                  from public.source_records sr3
                  join public.sources so3 on so3.id = sr3.source_id
                 where sr3.supplier_id = s.id
                   and sr3.status = 'active'
                   and so3.code = any($14)
              ))
         and ($15 is null or s.completeness_pct >= $15)
         and ($16 is null or s.employees_total >= $16)
         and ($3  is null or s.t13_source_count >= $3)
    ),
    counted as (select *, count(*) over () as total_count from filtered)
    select id, slug, company_name, entity_type, city, district, source_tags,
           t13_source_count, completeness_pct, employees_total, established_date,
           principal_products, factory_types, rsc_progress_pct, parent_group_name,
           total_count
      from counted
     order by
       case when $9='completeness' then completeness_pct end desc nulls last,
       case when $9='name'         then company_name     end asc,
       case when $9='receipts'     then t13_source_count end desc nulls last,
       case when coalesce($9, 'default')='default' then _search_rank end desc nulls last,
       _sbi_total desc nulls last,
       t13_source_count desc nulls last,
       company_name asc
     limit $10 offset $11
  $q$
  using p_q, p_entity_types, p_min_sources, p_cert_kinds, p_rsc_min,
        p_city, p_district, p_category, p_sort, v_lim, v_off,
        p_registries, p_factory_types, p_brand_codes,
        p_completeness_min, p_workers_min;
end;
$fn$;

comment on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) is
  'Spec B1 Discover RPC, 0061 smart search: p_q matches supplier names, products, factory types, locations, entity terms, and active evidence text with apparel synonym ranking.';

revoke all on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) from public;

grant execute on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) to anon, authenticated;
