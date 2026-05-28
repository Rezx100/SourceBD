-- 0025 — buyer_smart_match RPC (Spec B4, Phase 2 buyer Smart Match wizard).
--
-- One read-only function that powers POST /api/v1/match. Consumes a single
-- jsonb input (the 3-step wizard payload) and returns a single jsonb document
-- with a ranked supplier list and "why matched" receipts per row.
--
-- Input shape (all keys optional, additive criteria):
--   {
--     "product":      "knitwear",            // substring match on principal_products[]
--     "entity_types": ["factory"],           // suppliers.entity_type in (...)
--     "registries":   ["BGMEA","RSC",...],   // direct or RSC-inherited via v_supplier_registry_ids
--     "certs":        ["wrap","gots",...],   // certifications.kind, expires_on null|future
--     "rsc_min":      80,                    // rsc_remediation.progress_pct >= N
--     "min_machines": 200,                   // suppliers.machines_sewing >= N
--     "city":         "Gazipur",             // suppliers.city ILIKE
--     "district":     "Dhaka",               // suppliers.district ILIKE
--     "limit":        20                     // default 20, max 50
--   }
--
-- Hard filters always applied: is_published = true AND is_sanctioned = false.
-- Additional hard filters: entity_types, city, district (when present).
-- Soft criteria contribute to `match_score`: certs, registries, rsc_min,
-- min_machines, product. A supplier is returned only when match_score >= 1,
-- unless NO soft criteria were supplied (in which case the function returns
-- highest-quality suppliers by the internal tiebreakers).
--
-- Output shape (single jsonb document):
--   {
--     "criteria_count": N,        // number of soft criteria the user submitted
--     "total":          N,        // number of matching suppliers
--     "results": [
--       {
--         "id", "slug", "company_name", "entity_type", "city", "district",
--         "completeness_pct", "t13_source_count", "source_tags",
--         "match_score":   N,
--         "match_reasons": ["WRAP certified", "BGMEA-verified \u00b7 #1234", ...]
--       }, ...
--     ]
--   }
--
-- Ranking: match_score desc, internal SBI desc nulls last, t13_source_count
-- desc, name asc. The internal SBI value is consumed by ORDER BY inside the
-- function body and NEVER returned to the caller. The returned shape contains
-- no `sbi_*` keys, no pillar values, no A/B/C/D grade, no proprietary numeric
-- "score" other than the visible `match_score` (which is just a count of
-- explicit user criteria satisfied \u2014 not a SourceBD opinion).
--
-- Contact PII (email_primary / phones / contact_name / contact_role / website)
-- is excluded from the result wire. Contacts unlock on a paid-tier RPC.
--
-- `security definer` is required to read sbi_scores / source_records /
-- certifications / rsc_remediation under RLS. Reversible:
--   drop function public.buyer_smart_match(jsonb);

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
  v_limit         int    := greatest(1, least(coalesce(nullif(p_input->>'limit','')::int, 20), 50));
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

  -- Count soft criteria the user explicitly submitted.
  v_criteria_count :=
      (case when v_product       is not null then 1 else 0 end)
    + (case when v_registries    is not null then 1 else 0 end)
    + (case when v_certs         is not null then 1 else 0 end)
    + (case when v_rsc_min       is not null then 1 else 0 end)
    + (case when v_min_machines  is not null then 1 else 0 end);

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
      and (v_city     is null or s.city     ilike v_city)
      and (v_district is null or s.district ilike v_district)
  ),
  -- Soft criteria evaluation per supplier.
  scored as (
    select
      b.*,
      -- product match: any principal_products[] entry ILIKE %product%
      (case when v_product is not null and exists (
          select 1 from unnest(b.principal_products) pp
           where pp ilike '%' || v_product || '%')
        then b.principal_products[
          (select min(i) from generate_subscripts(b.principal_products, 1) i
            where b.principal_products[i] ilike '%' || v_product || '%')
        ] end) as matched_product,

      -- registries: which of the requested registry codes the supplier has
      -- (direct OR RSC-inherited via v_supplier_registry_ids).
      -- One pill object per (code, first non-null value) pair.
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

      -- certs: which of the requested cert kinds the supplier carries (valid)
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
     where v_criteria_count = 0 or match_score >= 1
     order by
       match_score desc,
       _sbi_total desc nulls last,
       t13_source_count desc,
       company_name asc
     limit v_limit
  ),
  with_reasons as (
    select
      k.*,
      (
        -- Build the "why matched" string list, in display order:
        -- certs -> registries -> RSC -> machines -> product.
        coalesce(array(
          select 'Certified: ' || upper(replace(c, '_', '-'))
            from unnest(k.matched_certs) c
           order by c
        ), '{}'::text[])
        ||
        coalesce(array(
          select case
                   when (pill->>'value') is not null and btrim(pill->>'value') <> ''
                     then (pill->>'code') || '-verified \u00b7 #' || (pill->>'value')
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
  'Spec B4 buyer Smart Match RPC. Reads sbi_scores under security definer '
  'as an ORDER BY tiebreaker only; the SBI value is never serialised to '
  'the caller. Contact PII is excluded from the result wire.';

revoke all     on function public.buyer_smart_match(jsonb) from public;
grant  execute on function public.buyer_smart_match(jsonb) to anon, authenticated;
