-- 0142 — Search by customs exports: the Exports filter, its sorts and the figures on each row (11 Oct 2026).
--
-- Spec: context/feature-specs/spec-volza-reveal.md section 4, item 4; Paper page 34, boards E, H, J1, G.
-- For entitled readers (admins, Growth and Enterprise, not suspended; the gate of 0137) the search can
-- be narrowed to suppliers with an exact, unexpired customs record, by export value band and by market,
-- and sorted by average shipment, export value, shipments or buyers. Everyone else gets no rows: the
-- Volza licence lets paying users see the figures and nobody else (0137).
--
-- discover_suppliers (0104) is untouched. This is a sibling over the same filter predicate
-- (discover_v32_passes) joined to volza_export_checks, so it pages and counts only suppliers with a
-- customs record. It is granted to authenticated only and is never read through the shared anon cache.
--
-- Rollback:
--   drop function public.discover_customs_exports(text, text[], int, text[], int, text, text, text, text,
--     int, int, text[], text[], text[], int, int, text[], text, text, int, int, int, text[], text[],
--     boolean, numeric, text);
--   drop function public.volza_reader_entitled();

create or replace function public.volza_reader_entitled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select (p.role = 'admin' or p.plan_tier in ('growth', 'enterprise'))
           and not coalesce(p.is_suspended, false)
      from public.profiles p
     where p.id = auth.uid()), false);
$$;

comment on function public.volza_reader_entitled() is
  'True for an admin or a Growth/Enterprise buyer who is not suspended: who may see Volza customs figures. 0142.';

revoke all on function public.volza_reader_entitled() from public, anon;
grant execute on function public.volza_reader_entitled() to authenticated, service_role;

create or replace function public.discover_customs_exports(
  p_q                    text    default null,
  p_entity_types         text[]  default null,
  p_min_sources          int     default null,
  p_cert_kinds           text[]  default null,
  p_rsc_min              int     default null,
  p_city                 text    default null,
  p_district             text    default null,
  p_category             text    default null,
  p_sort                 text    default 'avg_shipment',
  p_limit                int     default 25,
  p_offset               int     default 0,
  p_registries           text[]  default null,
  p_factory_types        text[]  default null,
  p_brand_codes          text[]  default null,
  p_completeness_min     int     default null,
  p_workers_min          int     default null,
  p_hs_codes             text[]  default null,
  p_cert_state           text    default null,
  p_rsc_state            text    default null,
  p_est_from             int     default null,
  p_est_to               int     default null,
  p_workers_max          int     default null,
  p_districts            text[]  default null,
  p_cities               text[]  default null,
  p_exclude_sanctioned   boolean default true,
  -- Export value floor in US dollars over the window (1m, 10m, 50m on the menu).
  p_exports_min          numeric default null,
  -- One market as 0139 keys it: 'United Kingdom', 'United States', 'EU', 'Canada'.
  p_ships_to             text    default null
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
  total_count         bigint,
  is_sanctioned       boolean,
  cert_summary        jsonb,
  hs_codes            text[],
  brand_codes         text[],
  registries          text[],
  top_tier            smallint,
  export_fob_usd      numeric,
  export_shipments    int,
  export_buyers       int
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_lim int := greatest(1, least(coalesce(p_limit, 25), 100));
  v_off int := greatest(0, coalesce(p_offset, 0));
  v_q   text := nullif(btrim(coalesce(p_q, '')), '');
  v_tsq tsquery := case when nullif(btrim(coalesce(p_q, '')), '') is null then null
                        else websearch_to_tsquery('simple', btrim(p_q)) end;
  v_sort text := case when p_sort in ('avg_shipment', 'export_value', 'shipments', 'buyers', 'workers', 'name')
                      then p_sort else 'avg_shipment' end;
begin
  if not public.volza_reader_entitled() then
    return;
  end if;
  if p_ships_to is not null and p_ships_to not in ('United Kingdom', 'United States', 'EU', 'Canada') then
    raise exception 'discover_customs_exports: unknown market' using errcode = '22023';
  end if;
  perform public.discover_v32_assert_bounded(
    p_entity_types, p_cert_kinds, p_registries, p_factory_types,
    p_brand_codes, p_hs_codes, p_districts, p_cities,
    p_q, p_city, p_district, p_category
  );

  return query
    with filtered as materialized (
      select s.id, s.slug, s.company_name, s.entity_type::text as entity_type,
             s.city, s.district, s.source_tags,
             s.t13_source_count::int as t13_source_count,
             s.completeness_pct, s.employees_total, s.established_date,
             s.principal_products, s.factory_types,
             rr.progress_pct as rsc_progress_pct, s.parent_group_name,
             s.address_raw as primary_address,
             s.is_sanctioned,
             v.fob_usd, v.shipments, v.buyers
        from public.volza_export_checks v
        join public.suppliers s on s.id = v.supplier_id
        left join public.rsc_remediation rr
          on rr.supplier_id = s.id and rr.active = true
       where v.match_class = 'exact'
         and v.expires_at > now()
         and public.discover_v32_passes(
           s, rr.progress_pct, null,
           p_entity_types, p_min_sources, p_cert_kinds, p_rsc_min,
           p_city, p_district, p_category, p_registries, p_factory_types,
           p_brand_codes, p_completeness_min, p_workers_min, p_hs_codes,
           p_cert_state, p_rsc_state, p_est_from, p_est_to, p_workers_max,
           p_districts, p_cities, p_exclude_sanctioned
         )
         and (p_exports_min is null or coalesce(v.fob_usd, 0) >= p_exports_min)
         -- A market is on when it had shipments; a supplier that ships to one country has no market
         -- figures (0139) and counts when its stored shipment went there.
         and (p_ships_to is null
              or coalesce((v.markets -> p_ships_to ->> 'shipments')::numeric, 0) > 0
              or (v.markets is null and v.top_record ->> 'destination_country' ilike p_ships_to || '%'))
         and (v_q is null
              or (v_tsq is not null and s.discover_search_tsv @@ v_tsq)
              or s.company_name_norm ilike '%' || v_q || '%'
              or coalesce(s.parent_group_name, '') ilike '%' || v_q || '%'
              or coalesce(s.city, '') ilike '%' || v_q || '%'
              or coalesce(s.district, '') ilike '%' || v_q || '%')
    ),
    counted as (
      select f.*, count(*) over () as total_count from filtered f
    ),
    page as (
      select c.*
        from counted c
       order by
         -- Average shipment ranks only suppliers with 10+ shipments; the rest follow, so one large
         -- shipment cannot top the list (spec section 4).
         case when v_sort = 'avg_shipment' then c.shipments >= 10 end desc nulls last,
         case when v_sort = 'avg_shipment' then c.fob_usd / nullif(c.shipments, 0) end desc nulls last,
         case when v_sort = 'export_value' then c.fob_usd end desc nulls last,
         case when v_sort = 'shipments' then c.shipments end desc nulls last,
         case when v_sort = 'buyers' then c.buyers end desc nulls last,
         case when v_sort = 'workers' then c.employees_total end desc nulls last,
         case when v_sort = 'name' then c.company_name end asc,
         c.fob_usd desc nulls last,
         c.id asc
       limit v_lim offset v_off
    )
    select p.id, p.slug, p.company_name, p.entity_type, p.city, p.district,
           p.source_tags, p.t13_source_count, p.completeness_pct,
           p.employees_total, p.established_date, p.principal_products,
           p.factory_types, p.rsc_progress_pct, p.parent_group_name,
           p.primary_address,
           p.total_count,
           p.is_sanctioned,
           public.discover_v32_cert_summary(p.id),
           public.discover_v32_hs_codes(p.id),
           public.discover_v32_brand_codes(p.id),
           public.discover_v32_registries(p.id),
           public.discover_v32_top_tier(p.source_tags),
           p.fob_usd, p.shipments, p.buyers
      from page p;
end;
$fn$;

comment on function public.discover_customs_exports(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int,
  text[], text, text, int, int, int, text[], text[], boolean, numeric, text
) is
  'The search narrowed to suppliers with an exact, unexpired Volza customs record, with their figures, '
  'for entitled readers only (volza_reader_entitled); no rows for anyone else. Filters as discover_suppliers. 0142.';

revoke all on function public.discover_customs_exports(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int,
  text[], text, text, int, int, int, text[], text[], boolean, numeric, text
) from public, anon;

grant execute on function public.discover_customs_exports(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int,
  text[], text, text, int, int, int, text[], text[], boolean, numeric, text
) to authenticated;
