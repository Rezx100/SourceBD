-- Repair Smart Match result completeness.
-- The original B4 RPC defaulted to limit 20 and counted only the limited rows,
-- which made unrelated searches appear to have exactly 20 matches. The wizard
-- should return the full ranked set for the submitted brief.

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
  v_criteria_count int   := 0;
  v_results       jsonb;
  v_total         int;
begin
  -- Clamp range on rsc_min / min_machines.
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

  -- Count every visible criterion the user submitted. `match_score` below
  -- remains a transparent count of soft evidence criteria satisfied.
  v_criteria_count :=
      (case when v_product       is not null then 1 else 0 end)
    + (case when v_entity_types  is not null then 1 else 0 end)
    + (case when v_registries    is not null then 1 else 0 end)
    + (case when v_certs         is not null then 1 else 0 end)
    + (case when v_rsc_min       is not null then 1 else 0 end)
    + (case when v_min_machines  is not null then 1 else 0 end)
    + (case when v_city          is not null then 1 else 0 end)
    + (case when v_district      is not null then 1 else 0 end);

  with base as (
    select
      s.id, s.slug, s.company_name, s.entity_type::text as entity_type,
      s.city, s.district, s.source_tags, s.completeness_pct,
      s.principal_products, s.machines_sewing,
      coalesce((
        select count(distinct sr.source_id)::int
          from public.source_records sr
         where sr.supplier_id = s.id
           and sr.status      = 'active'
           and sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert')
      ), 0) as t13_source_count,
      rr.progress_pct as rsc_progress_pct,
      sb.total        as _sbi_total
    from public.suppliers s
    left join public.rsc_remediation rr
      on rr.supplier_id = s.id and rr.active = true
    left join public.sbi_scores sb
      on sb.supplier_id = s.id
    where s.is_published  = true
      and s.is_sanctioned = false
      and (v_entity_types is null or s.entity_type::text = any(v_entity_types))
      and (v_city     is null or s.city     ilike '%' || v_city || '%')
      and (v_district is null or s.district ilike '%' || v_district || '%')
  ),
  scored as (
    select
      b.*,
      (case when v_product is not null and exists (
          select 1 from unnest(b.principal_products) pp
           where pp ilike '%' || v_product || '%')
        then b.principal_products[
          (select min(i) from generate_subscripts(b.principal_products, 1) i
            where b.principal_products[i] ilike '%' || v_product || '%')
        ] end) as matched_product,
      coalesce((
        select array(
          select jsonb_build_object('code', src_code, 'value', any_value)
            from (
              select vp.source_code as src_code,
                     (array_agg(vp.value order by vp.value) filter (where vp.value is not null))[1] as any_value
                from public.v_supplier_registry_ids vp
               where vp.supplier_id = b.id
                 and vp.source_code = any(v_registries)
               group by vp.source_code
            ) g
           order by src_code
        )
      ), '{}'::jsonb[]) as matched_registries,
      coalesce((
        select array_agg(distinct c.kind::text)
          from public.certifications c
         where c.supplier_id = b.id
           and c.kind::text = any(v_certs)
           and (c.expires_on is null or c.expires_on >= current_date)
      ), '{}'::text[]) as matched_certs,
      (v_rsc_min      is not null and b.rsc_progress_pct is not null and b.rsc_progress_pct >= v_rsc_min) as matched_rsc,
      (v_min_machines is not null and b.machines_sewing  is not null and b.machines_sewing  >= v_min_machines) as matched_machines
    from base b
  ),
  ranked as (
    select
      s.*,
      (
        (case when v_product      is not null and matched_product   is not null then 1 else 0 end)
      + (case when v_registries   is not null and array_length(matched_registries, 1) > 0 then 1 else 0 end)
      + (case when v_certs        is not null and array_length(matched_certs,      1) > 0 then 1 else 0 end)
      + (case when matched_rsc      then 1 else 0 end)
      + (case when matched_machines then 1 else 0 end)
      )::int as match_score
    from scored s
  ),
  kept as (
    select *
      from ranked
     where (
       v_product is null
       and v_registries is null
       and v_certs is null
       and v_rsc_min is null
       and v_min_machines is null
     ) or match_score >= 1
  ),
  with_reasons as (
    select
      k.*,
      (
        coalesce(array(
          select 'Certified: ' || upper(replace(c, '_', '-'))
            from unnest(k.matched_certs) c
           order by c
        ), '{}'::text[])
        ||
        coalesce(array(
          select case
                   when (pill->>'value') is not null and btrim(pill->>'value') <> ''
                     then (pill->>'code') || '-verified - #' || (pill->>'value')
                   else (pill->>'code') || '-verified'
                 end
            from unnest(k.matched_registries) pill
           order by (pill->>'code')
        ), '{}'::text[])
        ||
        case when k.matched_rsc
          then array['RSC remediation ' || round(k.rsc_progress_pct)::text || '%']
          else '{}'::text[]
        end
        ||
        case when k.matched_machines
          then array[k.machines_sewing::text || '+ sewing machines']
          else '{}'::text[]
        end
        ||
        case when k.matched_product is not null
          then array['Makes ' || k.matched_product]
          else '{}'::text[]
        end
      ) as match_reasons
    from kept k
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
        't13_source_count',  w.t13_source_count,
        'source_tags',       to_jsonb(w.source_tags),
        'match_score',       w.match_score,
        'match_reasons',     to_jsonb(w.match_reasons)
      )
      order by
        w.match_score desc,
        w._sbi_total desc nulls last,
        w.t13_source_count desc,
        w.company_name asc
    ), '[]'::jsonb),
    count(*)::int
  into v_results, v_total
  from with_reasons w;

  return jsonb_build_object(
    'criteria_count', v_criteria_count,
    'total',          v_total,
    'results',        v_results
  );
end;
$$;

comment on function public.buyer_smart_match(jsonb) is
  'Spec B4 buyer Smart Match RPC. Returns the full ranked match set; reads '
  'sbi_scores under security definer as an ORDER BY tiebreaker only; the SBI '
  'value is never serialised to the caller. Contact PII is excluded.';

revoke all     on function public.buyer_smart_match(jsonb) from public;
grant  execute on function public.buyer_smart_match(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
