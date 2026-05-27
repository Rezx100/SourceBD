-- 0023 — discover_suppliers RPC (Spec B1, Phase 2 buyer Discover)
--
-- One read-only function that powers `/app/discover`. The function:
--   * filters published, non-sanctioned suppliers,
--   * runs FTS / trigram via ILIKE on `company_name_norm` (existing GIN
--     trigram index `idx_suppliers_name_trgm`),
--   * counts distinct Tier 1–3 sources per supplier for the Receipts Ring
--     and for the source-count tier filter,
--   * orders by `sbi_scores.total DESC NULLS LAST` server-side WITHOUT
--     returning the value — the RETURNS TABLE whitelist has no SBI column.
--
-- `security definer` is required because `sbi_scores`, `source_records`,
-- `certifications`, and `rsc_remediation` all have RLS that blocks anon/
-- authenticated SELECTs. The function reads them inside the SQL body but
-- never serialises SBI back to the caller. Output is restricted to the
-- buyer-safe column whitelist below.
--
-- Hard prohibitions (ai-workflow-rules.md, frontend-design-spec.md §0):
--   * Never return `sbi_scores.total` / pillar values to non-admin callers.
--   * Never return contact PII (`email_primary`, `phones`, `contact_name`,
--     `contact_role`) — that is a separate Phase-2 spec gated behind /pricing.
--
-- Reversible: `drop function public.discover_suppliers(...)`.

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
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select
      s.id,
      s.slug,
      s.company_name,
      s.entity_type::text                                            as entity_type,
      s.city,
      s.district,
      s.source_tags,
      coalesce((
        select count(distinct sr.source_id)::int
        from public.source_records sr
        where sr.supplier_id = s.id
          and sr.status      = 'active'
          and sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert')
      ), 0)                                                          as t13_source_count,
      s.completeness_pct,
      s.employees_total,
      s.established_date,
      s.principal_products,
      s.factory_types,
      rr.progress_pct                                                as rsc_progress_pct,
      s.parent_group_name,
      sb.total                                                       as _sbi_total
    from public.suppliers s
    left join public.rsc_remediation rr
      on rr.supplier_id = s.id
     and rr.active      = true
    left join public.sbi_scores sb
      on sb.supplier_id = s.id
    where s.is_published   = true
      and s.is_sanctioned  = false
      and (p_q is null or p_q = ''
           or s.company_name_norm ilike '%' || lower(trim(p_q)) || '%')
      and (p_entity_types is null
           or s.entity_type::text = any(p_entity_types))
      and (p_city is null     or s.city     ilike p_city)
      and (p_district is null or s.district ilike p_district)
      and (p_rsc_min is null  or rr.progress_pct >= p_rsc_min)
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
  ),
  applied as (
    select *
    from filtered
    where p_min_sources is null
       or t13_source_count >= p_min_sources
  ),
  counted as (
    select *, count(*) over () as total_count
    from applied
  )
  select
    id, slug, company_name, entity_type, city, district, source_tags,
    t13_source_count, completeness_pct, employees_total, established_date,
    principal_products, factory_types, rsc_progress_pct, parent_group_name,
    total_count
  from counted
  order by
    case when p_sort = 'completeness' then completeness_pct end desc nulls last,
    case when p_sort = 'name'         then company_name     end asc,
    case when p_sort = 'receipts'     then t13_source_count end desc nulls last,
    -- internal default tiebreaker: SBI desc, then receipts, then name.
    -- SBI never leaves the function body.
    _sbi_total desc nulls last,
    t13_source_count desc nulls last,
    company_name asc
  limit  greatest(1, least(coalesce(p_limit,  24), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

comment on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int
) is
  'Spec B1 buyer Discover RPC. Reads sbi_scores under security definer for '
  'server-side ORDER BY only; the SBI value is excluded from the RETURNS '
  'TABLE column list and never serialised to the client.';

revoke all on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int
) from public;

grant execute on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int
) to anon, authenticated;
