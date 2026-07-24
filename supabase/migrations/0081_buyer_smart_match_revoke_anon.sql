-- Migration 0081 — REZ-10
-- Revoke anon access from buyer_smart_match and add an internal role guard.
--
-- Previously the function was granted to `anon, authenticated`, allowing
-- unauthenticated callers to invoke buyer-only match logic directly via
-- PostgREST, bypassing the Next.js /api/v1/match route auth gate.
--
-- This migration replaces the function with an identical body (from 0070)
-- except for two additions at the top of the begin block:
--   1. auth.uid() null-check → 28000 (not authenticated)
--   2. profile role check    → 42501 (not a buyer)
-- The anon grant is revoked; only authenticated retains execute.

create or replace function public.buyer_smart_match(p_input jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid           uuid   := auth.uid();
  v_role          text;
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
  -- Auth guard: reject unauthenticated and non-buyer/admin callers.
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role not in ('buyer', 'admin') then
    raise exception 'not a buyer' using errcode = '42501';
  end if;

  -- Input sanitisation (unchanged from 0070).
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

  with rows as materialized (
    select *
      from public.discover_suppliers(
        v_product,
        v_entity_types,
        null::int,
        v_certs,
        v_rsc_min,
        v_city,
        v_district,
        null::text,
        'default',
        v_limit,
        v_offset,
        v_registries,
        null::text[],
        null::text[],
        null::int,
        null::int
      )
  ),
  enriched as (
    select r.*,
           (
             select pe.entry
               from unnest(coalesce(r.principal_products, '{}') || coalesce(r.factory_types, '{}'))
                    with ordinality as pe(entry, ord)
              where v_product is not null
                and lower(pe.entry) ilike '%' || lower(v_product) || '%'
              order by pe.ord
              limit 1
           ) as matched_product,
           coalesce((
             select array(
               select jsonb_build_object('code', src_code, 'value', any_value)
                 from (
                   select vp.source_code as src_code,
                          (array_agg(vp.value order by vp.value) filter (where vp.value is not null))[1] as any_value
                     from public.v_supplier_registry_ids vp
                    where vp.supplier_id = r.id
                      and vp.source_code = any(v_registries)
                    group by vp.source_code
                 ) g
                order by src_code
             )
           ), '{}'::jsonb[]) as matched_registries,
           coalesce((
             select array_agg(distinct cert.kind::text order by cert.kind::text)
               from public.certifications cert
              where cert.supplier_id = r.id
                and cert.kind::text = any(v_certs)
                and (cert.expires_on is null or cert.expires_on >= current_date)
           ), '{}'::text[]) as matched_certs
      from rows r
     where v_min_machines is null
        or exists (
          select 1
            from public.suppliers s
           where s.id = r.id
             and s.machines_sewing >= v_min_machines
        )
  ),
  with_reasons as (
    select e.*,
           (
             coalesce(array(
               select 'Certified: ' || upper(replace(c, '_', '-'))
                 from unnest(e.matched_certs) c
                order by c
             ), '{}'::text[])
             ||
             coalesce(array(
               select case
                        when (pill->>'value') is not null and btrim(pill->>'value') <> ''
                          then (pill->>'code') || '-verified - #' || (pill->>'value')
                        else (pill->>'code') || '-verified'
                      end
                 from unnest(e.matched_registries) pill
                order by (pill->>'code')
             ), '{}'::text[])
             ||
             case when v_rsc_min is not null and e.rsc_progress_pct is not null
               then array['RSC remediation ' || round(e.rsc_progress_pct)::text || '%']
               else '{}'::text[]
             end
             ||
             case when e.matched_product is not null
               then array['Makes ' || e.matched_product]
               when v_product is not null
               then array['Search match: ' || v_product]
               else '{}'::text[]
             end
           ) as match_reasons
      from enriched e
  )
  select
    coalesce(jsonb_agg(
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
        'match_score',       v_criteria_count,
        'match_reasons',     to_jsonb(w.match_reasons)
      )
      order by w.total_count desc, w.t13_source_count desc, w.company_name asc
    ), '[]'::jsonb),
    coalesce(max(w.total_count), 0)::int
  into v_results, v_total
  from with_reasons w;

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
  'Buyer Smart Match wrapper around discover_suppliers. Requires authenticated buyer or admin — anon access is revoked.';

revoke all     on function public.buyer_smart_match(jsonb) from public;
revoke execute on function public.buyer_smart_match(jsonb) from anon;
grant execute  on function public.buyer_smart_match(jsonb) to authenticated;

notify pgrst, 'reload schema';
