-- Discover Search Upgrade.
-- Postgres-native search taxonomy + compound-intent ranking for /discover and
-- /app/discover. No third-party search service and no production LLM.

create table if not exists public.search_concept_groups (
  group_key text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.search_concepts (
  concept_key text primary key,
  group_key text not null references public.search_concept_groups(group_key) on delete restrict,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.search_terms (
  term text primary key,
  concept_key text not null references public.search_concepts(concept_key) on delete cascade,
  weight int not null default 100,
  is_misspelling boolean not null default false,
  created_at timestamptz not null default now(),
  constraint search_terms_term_lower_chk check (term = lower(term)),
  constraint search_terms_weight_chk check (weight between 1 and 500)
);

create table if not exists public.search_stopwords (
  word text primary key,
  created_at timestamptz not null default now(),
  constraint search_stopwords_word_lower_chk check (word = lower(word))
);

insert into public.search_concept_groups(group_key, label) values
  ('audience', 'Audience'),
  ('garment', 'Garment'),
  ('material', 'Material'),
  ('style', 'Style')
on conflict (group_key) do update set label = excluded.label;

insert into public.search_concepts(concept_key, group_key, label) values
  ('children', 'audience', 'Children / kids'),
  ('women', 'audience', 'Women / ladies'),
  ('men', 'audience', 'Men'),
  ('baby', 'audience', 'Baby / infant'),
  ('shirt', 'garment', 'Shirts and t-shirts'),
  ('pant', 'garment', 'Pants and trousers'),
  ('denim', 'material', 'Denim / jeans'),
  ('knit', 'material', 'Knitwear'),
  ('woven', 'material', 'Woven'),
  ('sweater', 'garment', 'Sweaters and pullovers'),
  ('jacket', 'garment', 'Jackets and outerwear'),
  ('hoodie', 'garment', 'Hoodies and sweatshirts'),
  ('lingerie', 'garment', 'Lingerie and innerwear'),
  ('uniform', 'style', 'Uniforms and workwear'),
  ('jersey', 'material', 'Jersey'),
  ('fleece', 'material', 'Fleece')
on conflict (concept_key) do update
  set group_key = excluded.group_key,
      label = excluded.label;

insert into public.search_terms(term, concept_key, weight, is_misspelling) values
  ('child', 'children', 100, false),
  ('children', 'children', 120, false),
  ('childrens', 'children', 120, false),
  ('childrean', 'children', 80, true),
  ('kid', 'children', 100, false),
  ('kids', 'children', 120, false),
  ('boy', 'children', 80, false),
  ('boys', 'children', 90, false),
  ('girl', 'children', 80, false),
  ('girls', 'children', 90, false),
  ('baby', 'baby', 120, false),
  ('babies', 'baby', 100, false),
  ('infant', 'baby', 100, false),
  ('infants', 'baby', 100, false),
  ('toddler', 'baby', 90, false),
  ('toddlers', 'baby', 90, false),
  ('ladies', 'women', 120, false),
  ('lady', 'women', 100, false),
  ('women', 'women', 120, false),
  ('womens', 'women', 110, false),
  ('woman', 'women', 100, false),
  ('female', 'women', 80, false),
  ('men', 'men', 120, false),
  ('mens', 'men', 110, false),
  ('man', 'men', 100, false),
  ('male', 'men', 80, false),
  ('shirt', 'shirt', 120, false),
  ('shirts', 'shirt', 120, false),
  ('tshirt', 'shirt', 115, false),
  ('tshirts', 'shirt', 115, false),
  ('tee', 'shirt', 100, false),
  ('tees', 'shirt', 100, false),
  ('top', 'shirt', 80, false),
  ('tops', 'shirt', 80, false),
  ('pant', 'pant', 120, false),
  ('pants', 'pant', 120, false),
  ('trouser', 'pant', 120, false),
  ('trousers', 'pant', 120, false),
  ('jean', 'denim', 110, false),
  ('jeans', 'denim', 120, false),
  ('denim', 'denim', 120, false),
  ('knit', 'knit', 120, false),
  ('knits', 'knit', 100, false),
  ('knitwear', 'knit', 120, false),
  ('knitted', 'knit', 90, false),
  ('woven', 'woven', 120, false),
  ('sweater', 'sweater', 120, false),
  ('sweaters', 'sweater', 120, false),
  ('pullover', 'sweater', 100, false),
  ('pullovers', 'sweater', 100, false),
  ('jacket', 'jacket', 120, false),
  ('jackets', 'jacket', 120, false),
  ('outerwear', 'jacket', 100, false),
  ('hoodie', 'hoodie', 120, false),
  ('hoodies', 'hoodie', 120, false),
  ('sweatshirt', 'hoodie', 100, false),
  ('sweatshirts', 'hoodie', 100, false),
  ('lingerie', 'lingerie', 120, false),
  ('underwear', 'lingerie', 110, false),
  ('innerwear', 'lingerie', 110, false),
  ('uniform', 'uniform', 120, false),
  ('uniforms', 'uniform', 120, false),
  ('workwear', 'uniform', 100, false),
  ('jersey', 'jersey', 120, false),
  ('fleece', 'fleece', 120, false)
on conflict (term) do update
  set concept_key = excluded.concept_key,
      weight = excluded.weight,
      is_misspelling = excluded.is_misspelling;

insert into public.search_stopwords(word) values
  ('a'), ('an'), ('and'), ('any'), ('all'), ('for'), ('from'), ('in'),
  ('into'), ('near'), ('of'), ('on'), ('the'), ('that'), ('this'), ('to'),
  ('with'), ('who'), ('make'), ('makes'), ('maker'), ('makers'), ('need'),
  ('needs'), ('want'), ('wants'), ('looking'), ('find'), ('kind'), ('kinds'),
  ('supplier'), ('suppliers'), ('manufacturer'), ('manufacturers'), ('company'),
  ('companies'), ('exporter'), ('exporters'), ('factory'), ('factories'),
  ('garment'), ('garments'), ('apparel'), ('product'), ('products'), ('buying'),
  ('house')
on conflict (word) do nothing;

alter table public.suppliers
  add column if not exists discover_search_tsv tsvector;

create or replace function public.refresh_supplier_discover_search_tsv()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.discover_search_tsv :=
      setweight(to_tsvector('simple', coalesce(new.company_name, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(array_to_string(new.principal_products, ' '), '')), 'A')
    || setweight(to_tsvector('simple', coalesce(array_to_string(new.factory_types, ' '), '')), 'B')
    || setweight(to_tsvector('simple', coalesce(new.parent_group_name, '')), 'C')
    || setweight(to_tsvector('simple', coalesce(new.city, '') || ' ' || coalesce(new.district, '')), 'C')
    || setweight(to_tsvector('simple', coalesce(array_to_string(new.source_tags, ' '), '')), 'D');
  return new;
end;
$$;

drop trigger if exists trg_suppliers_discover_search_tsv on public.suppliers;
create trigger trg_suppliers_discover_search_tsv
before insert or update of
  company_name, principal_products, factory_types, parent_group_name,
  city, district, source_tags
on public.suppliers
for each row
execute function public.refresh_supplier_discover_search_tsv();

update public.suppliers s
   set discover_search_tsv =
      setweight(to_tsvector('simple', coalesce(s.company_name, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(array_to_string(s.principal_products, ' '), '')), 'A')
    || setweight(to_tsvector('simple', coalesce(array_to_string(s.factory_types, ' '), '')), 'B')
    || setweight(to_tsvector('simple', coalesce(s.parent_group_name, '')), 'C')
    || setweight(to_tsvector('simple', coalesce(s.city, '') || ' ' || coalesce(s.district, '')), 'C')
    || setweight(to_tsvector('simple', coalesce(array_to_string(s.source_tags, ' '), '')), 'D')
 where s.discover_search_tsv is null;

create index if not exists idx_suppliers_discover_search_tsv
  on public.suppliers using gin (discover_search_tsv);

create index if not exists idx_search_terms_concept
  on public.search_terms (concept_key);

create index if not exists idx_search_concepts_group
  on public.search_concepts (group_key);

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
      select distinct case
               when term in ('childrean', 'childrens') then 'children'
               when term in ('kid') then 'kids'
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
             exists (select 1 from specific_terms) as has_terms,
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
             coalesce(array_to_string(s.principal_products, ' '), '') || ' ' ||
             coalesce(array_to_string(s.factory_types, ' '), '') as _product_text,
             lower(
               coalesce(s.company_name, '') || ' ' ||
               coalesce(s.company_name_norm, '') || ' ' ||
               coalesce(s.parent_group_name, '') || ' ' ||
               coalesce(s.city, '') || ' ' ||
               coalesce(s.district, '') || ' ' ||
               coalesce(array_to_string(s.principal_products, ' '), '') || ' ' ||
               coalesce(array_to_string(s.factory_types, ' '), '') || ' ' ||
               coalesce(array_to_string(s.source_tags, ' '), '')
             ) as _search_blob,
             coalesce(ts_rank_cd(s.discover_search_tsv, qf.tsq), 0) as _fts_rank,
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
             end as _product_intent_match,
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
             end as _generic_intent_match,
             case
               when qf.q is null then 0
               else
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
             end as _search_rank
        from public.suppliers s
        cross join query_flags qf
        left join public.rsc_remediation rr
          on rr.supplier_id = s.id and rr.active = true
        left join public.sbi_scores sb on sb.supplier_id = s.id
       where s.is_published = true
         and s.is_sanctioned = false
         and ($2 is null or s.entity_type::text = any($2))
         and ($6 is null or s.city     ilike '%' || $6 || '%')
         and ($7 is null or s.district ilike '%' || $7 || '%')
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
    applied as materialized (
      select *
        from filtered
       where (
         (select q from query_input) is null
         or (_product_intent_match and _generic_intent_match and _search_rank > 0)
       )
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
  'Spec B1 Discover RPC, 0067 search upgrade: taxonomy-backed compound intent, Postgres FTS ranking, and source-safe result shape.';

revoke all on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) from public;

grant execute on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) to anon, authenticated;

notify pgrst, 'reload schema';
