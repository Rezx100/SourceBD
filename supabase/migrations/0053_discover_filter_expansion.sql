-- 0053 — Discover filter expansion + facets RPC (Debug batch 6, I-018).
--
-- Extends `public.discover_suppliers` with five new optional filter
-- params so the Discover surface can match what the spec §5.3 promised
-- but the original 0023 RPC never wired:
--
--   p_registries        text[]   match if supplier has an active
--                                 source_record from any of these
--                                 registry source codes
--                                 (BGMEA, BKMEA, BGAPMEA, BTMA, EPB, RSC).
--   p_factory_types     text[]   array overlap with
--                                 suppliers.factory_types
--                                 (GIN-indexed by 0006).
--   p_brand_codes       text[]   match if supplier has an active
--                                 source_record from any of these brand
--                                 source codes (BRAND_HM, BRAND_NEXT,
--                                 BRAND_MS, BRAND_ASOS).
--   p_completeness_min  int      suppliers.completeness_pct >= p_*.
--   p_workers_min       int      suppliers.employees_total    >= p_*.
--
-- Existing 11 params kept at positions 1–11 with unchanged semantics; new
-- params land at positions 12–16, all default null. Body otherwise reuses
-- the 0050 plpgsql+EXECUTE custom-plan trick verbatim.
--
-- `create or replace function` cannot widen the signature, so we drop the
-- 0050 function first. RETURNS TABLE columns are unchanged, so anon /
-- authenticated callers keep working without code changes.
--
-- Also seeds `public.discover_facets()` returning a single jsonb document
-- with top-N cities/districts/products/factory-types for native
-- <datalist> suggestions on the Discover filter rail (I-017).
-- Cheap aggregate queries against indexed columns; ~10k suppliers.
--
-- Reversible: drop both functions; re-apply 0050 to restore old behaviour.

drop function if exists public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int
);

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
        p_city, p_district, p_category, p_sort, v_lim, v_off,
        p_registries, p_factory_types, p_brand_codes,
        p_completeness_min, p_workers_min;
end;
$fn$;

comment on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) is
  'Spec B1 Discover RPC, debug batch 6 expansion: + registries, factory_types, brand_codes, completeness_min, workers_min.';

revoke all on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) from public;

grant execute on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) to anon, authenticated;


-- ------------------------------------------------------------------
-- discover_facets() — top-N suggestion lists for the filter rail
-- datalists (I-017). One jsonb document so the page fetches with a
-- single round-trip. STABLE so PostgREST can cache.
-- ------------------------------------------------------------------

create or replace function public.discover_facets()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'cities', coalesce((
      select jsonb_agg(city order by n desc)
        from (
          select city, count(*)::int as n
            from public.suppliers
           where is_published = true
             and is_sanctioned = false
             and city is not null
             and btrim(city) <> ''
           group by city
           order by n desc
           limit 60
        ) c
    ), '[]'::jsonb),
    'districts', coalesce((
      select jsonb_agg(district order by n desc)
        from (
          select district, count(*)::int as n
            from public.suppliers
           where is_published = true
             and is_sanctioned = false
             and district is not null
             and btrim(district) <> ''
           group by district
           order by n desc
           limit 30
        ) d
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(p order by n desc)
        from (
          select pp as p, count(*)::int as n
            from public.suppliers,
                 lateral unnest(principal_products) pp
           where is_published = true
             and is_sanctioned = false
             and pp is not null
             and btrim(pp) <> ''
           group by pp
           order by n desc
           limit 80
        ) pp
    ), '[]'::jsonb),
    'factory_types', coalesce((
      select jsonb_agg(t order by n desc)
        from (
          select ft as t, count(*)::int as n
            from public.suppliers,
                 lateral unnest(factory_types) ft
           where is_published = true
             and is_sanctioned = false
             and ft is not null
             and btrim(ft) <> ''
           group by ft
           order by n desc
           limit 30
        ) ft
    ), '[]'::jsonb)
  );
$$;

comment on function public.discover_facets() is
  'Top-N facets for Discover filter rail datalists (cities, districts, products, factory_types). Debug batch 6 I-017.';

revoke all on function public.discover_facets() from public;
grant execute on function public.discover_facets() to anon, authenticated;
