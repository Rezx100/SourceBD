-- 0030 — Compliance Hub (Spec B9, Phase 2).
--
-- Three SECURITY DEFINER RPCs that power /app/compliance/*. All three are
-- scoped to the calling buyer's `public.saved_suppliers` set so the hub is
-- personal, not a global cert/sanctions dump:
--
--   * `compliance_expiring_certs(p_window_days int default 90)` — every
--     certification on the caller's saved suppliers whose `expires_on`
--     falls inside `[current_date, current_date + p_window_days)`. Buyer-
--     safe shape only (kind, certificate_no, issuer, expires_on,
--     document_url, supplier{id,slug,company_name,entity_type}). The page
--     groups rows into 30 / 60 / 90 day urgency buckets client-side.
--   * `compliance_uflpa_tracker()` — for each saved supplier, returns
--     `uflpa_hits` (rows from `public.sanctions_screening` where
--     `list='uflpa' and active=true` joined to `sanctions_list_entries`)
--     and a `region_flag` heuristic (`'xinjiang_exposure'` when the
--     supplier's parent-group or any active source_record payload mentions
--     a Xinjiang-linked term; `'clear'` otherwise). v1 is conservative —
--     no record is marked hit without evidence in `sanctions_screening`.
--   * `compliance_msa_inputs()` — aggregates the caller's saved-supplier
--     footprint for the UK Modern Slavery Act §54 generator: total saved
--     count, breakdown by country / entity_type / register tag, cert
--     breadth, RSC coverage, sanctions hit count, top regions, top parent
--     groups. The MSA form client island composes the public statement
--     copy from this payload.
--
-- Hard invariants (honoured by every CTE):
--   * RLS on `saved_suppliers` is the only authority for ownership —
--     every query starts `where ss.owner_id = auth.uid()`.
--   * Contact PII (`email_primary`, `phones`, `contact_name`,
--     `contact_role`, `website`) is excluded at the function level —
--     not at the route or page layer.
--   * `sbi_scores` is never read. The Compliance Hub has no ordering
--     that needs SBI as a tiebreaker; surfacing it would put the value
--     on the wire for no operational reason.
--
-- Reversible:
--   drop function public.compliance_msa_inputs();
--   drop function public.compliance_uflpa_tracker();
--   drop function public.compliance_expiring_certs(int);

-- ----------------------------------------------------------------------
-- compliance_expiring_certs
-- ----------------------------------------------------------------------

create or replace function public.compliance_expiring_certs(
  p_window_days int default 90
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_window int  := greatest(1, least(coalesce(p_window_days, 90), 365));
  v_rows   jsonb;
  v_b30    int;
  v_b60    int;
  v_b90    int;
begin
  if v_uid is null then
    return jsonb_build_object(
      'window_days', v_window,
      'bucket_30',   0,
      'bucket_60',   0,
      'bucket_90',   0,
      'total',       0,
      'rows',        '[]'::jsonb
    );
  end if;

  with mine as (
    select ss.supplier_id
      from public.saved_suppliers ss
     where ss.owner_id = v_uid
  ),
  rows as (
    select
      c.kind::text                                       as kind,
      c.certificate_no,
      c.issuer,
      c.expires_on,
      c.document_url,
      (c.expires_on - current_date)::int                 as days_remaining,
      jsonb_build_object(
        'id',           s.id,
        'slug',         s.slug,
        'company_name', s.company_name,
        'entity_type',  s.entity_type::text,
        'city',         s.city,
        'district',     s.district
      )                                                  as supplier
    from mine m
    join public.suppliers s
      on s.id = m.supplier_id
    join public.certifications c
      on c.supplier_id = s.id
    where s.is_published   = true
      and s.is_sanctioned  = false
      and c.expires_on is not null
      and c.expires_on >= current_date
      and c.expires_on <  current_date + make_interval(days => v_window)
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'kind',           kind,
        'certificate_no', certificate_no,
        'issuer',         issuer,
        'expires_on',     expires_on,
        'document_url',   document_url,
        'days_remaining', days_remaining,
        'supplier',       supplier
      )
      order by expires_on asc
    ), '[]'::jsonb),
    count(*) filter (where days_remaining <  30)::int,
    count(*) filter (where days_remaining >= 30 and days_remaining < 60)::int,
    count(*) filter (where days_remaining >= 60 and days_remaining < 90)::int
  into v_rows, v_b30, v_b60, v_b90
  from rows;

  return jsonb_build_object(
    'window_days', v_window,
    'bucket_30',   coalesce(v_b30, 0),
    'bucket_60',   coalesce(v_b60, 0),
    'bucket_90',   coalesce(v_b90, 0),
    'total',       coalesce(jsonb_array_length(v_rows), 0),
    'rows',        v_rows
  );
end;
$$;

comment on function public.compliance_expiring_certs(int) is
  'Spec B9 expiring-cert RPC. Scopes by auth.uid() via saved_suppliers; '
  'returns buyer-safe cert rows expiring within p_window_days plus 30/60/90 '
  'bucket counts. Excludes contact PII + SBI.';

revoke all     on function public.compliance_expiring_certs(int) from public;
grant  execute on function public.compliance_expiring_certs(int) to authenticated;

-- ----------------------------------------------------------------------
-- compliance_uflpa_tracker
-- ----------------------------------------------------------------------

create or replace function public.compliance_uflpa_tracker()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_rows  jsonb;
  v_hit   int;
  v_flag  int;
  v_clear int;
  v_total int;
begin
  if v_uid is null then
    return jsonb_build_object(
      'total',  0,
      'hits',   0,
      'flags',  0,
      'clear',  0,
      'rows',   '[]'::jsonb
    );
  end if;

  with mine as (
    select ss.supplier_id, ss.created_at as saved_at
      from public.saved_suppliers ss
     where ss.owner_id = v_uid
  ),
  base as (
    select
      s.id, s.slug, s.company_name, s.entity_type::text as entity_type,
      s.city, s.district, s.country, s.parent_group_name,
      m.saved_at,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'matched_name',   ss.matched_name,
            'list_entry_ref', ss.list_entry_ref,
            'screened_at',    ss.screened_at,
            'source_url',     sle.source_url,
            'listed_date',    sle.listed_date,
            'entity_name',    sle.entity_name,
            'aliases',        sle.aliases
          )
          order by ss.screened_at desc
        )
        from public.sanctions_screening ss
        left join public.sanctions_list_entries sle
          on sle.list = ss.list and sle.entry_ref = ss.list_entry_ref
        where ss.supplier_id = s.id
          and ss.list = 'uflpa'
          and ss.active = true
      ), '[]'::jsonb) as uflpa_hits,
      (
        coalesce(s.parent_group_name, '') || ' ' ||
        coalesce(s.address_raw, '')       || ' ' ||
        coalesce(s.city, '')              || ' ' ||
        coalesce(s.district, '')
      ) as scan_text
    from mine m
    join public.suppliers s on s.id = m.supplier_id
    where s.is_published  = true
  ),
  scored as (
    select
      id, slug, company_name, entity_type, city, district, country,
      parent_group_name, saved_at, uflpa_hits,
      (jsonb_array_length(uflpa_hits) > 0) as has_hit,
      (scan_text ~* '(xinjiang|uyghur|uighur|XUAR)') as region_flag
    from base
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'supplier_id',       id,
        'supplier_slug',     slug,
        'company_name',      company_name,
        'entity_type',       entity_type,
        'city',              city,
        'district',          district,
        'country',           country,
        'parent_group_name', parent_group_name,
        'saved_at',          saved_at,
        'uflpa_hits',        uflpa_hits,
        'status', case
                    when has_hit       then 'hit'
                    when region_flag   then 'region_flag'
                    else                    'clear'
                  end
      )
      order by has_hit desc, region_flag desc, company_name asc
    ), '[]'::jsonb),
    count(*) filter (where has_hit)::int,
    count(*) filter (where region_flag and not has_hit)::int,
    count(*) filter (where not has_hit and not region_flag)::int,
    count(*)::int
  into v_rows, v_hit, v_flag, v_clear, v_total
  from scored;

  return jsonb_build_object(
    'total',  coalesce(v_total, 0),
    'hits',   coalesce(v_hit,   0),
    'flags',  coalesce(v_flag,  0),
    'clear',  coalesce(v_clear, 0),
    'rows',   v_rows
  );
end;
$$;

comment on function public.compliance_uflpa_tracker() is
  'Spec B9 UFLPA tracker. Scopes by auth.uid() via saved_suppliers; returns '
  'one row per saved supplier with sanctions_screening uflpa hits + region-'
  'exposure flag (xinjiang-linked text in supplier fields).';

revoke all     on function public.compliance_uflpa_tracker() from public;
grant  execute on function public.compliance_uflpa_tracker() to authenticated;

-- ----------------------------------------------------------------------
-- compliance_msa_inputs
-- ----------------------------------------------------------------------

create or replace function public.compliance_msa_inputs()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_total     int  := 0;
  v_published int  := 0;
  v_countries jsonb;
  v_entities  jsonb;
  v_registers jsonb;
  v_certs     jsonb;
  v_regions   jsonb;
  v_groups    jsonb;
  v_rsc_cov   int  := 0;
  v_rsc_avg   numeric;
  v_sanc_hits int  := 0;
  v_expiring  int  := 0;
begin
  if v_uid is null then
    return jsonb_build_object(
      'total_saved',           0,
      'total_published',       0,
      'by_country',            '[]'::jsonb,
      'by_entity_type',        '[]'::jsonb,
      'by_register',           '[]'::jsonb,
      'by_certification',      '[]'::jsonb,
      'top_regions',           '[]'::jsonb,
      'top_parent_groups',     '[]'::jsonb,
      'rsc_covered',           0,
      'rsc_avg_progress_pct',  null,
      'sanctions_hits',        0,
      'expiring_certs_90d',    0
    );
  end if;

  with mine as (
    select ss.supplier_id
      from public.saved_suppliers ss
     where ss.owner_id = v_uid
  ),
  base as (
    select s.*
      from mine m
      join public.suppliers s on s.id = m.supplier_id
  ),
  pub as (
    select * from base where is_published = true
  )
  select
    (select count(*) from base)::int,
    (select count(*) from pub)::int
  into v_total, v_published;

  -- by_country
  with mine as (
    select ss.supplier_id from public.saved_suppliers ss where ss.owner_id = v_uid
  )
  select coalesce(jsonb_agg(jsonb_build_object('country', country, 'count', n) order by n desc, country asc), '[]'::jsonb)
    into v_countries
    from (
      select coalesce(nullif(trim(s.country), ''), 'Unknown') as country, count(*)::int as n
        from mine m join public.suppliers s on s.id = m.supplier_id and s.is_published = true
       group by 1
    ) t;

  -- by_entity_type
  with mine as (
    select ss.supplier_id from public.saved_suppliers ss where ss.owner_id = v_uid
  )
  select coalesce(jsonb_agg(jsonb_build_object('entity_type', entity_type, 'count', n) order by n desc), '[]'::jsonb)
    into v_entities
    from (
      select s.entity_type::text as entity_type, count(*)::int as n
        from mine m join public.suppliers s on s.id = m.supplier_id and s.is_published = true
       group by 1
    ) t;

  -- by_register (BGMEA/BKMEA/BTMA/BGAPMEA/EPB/RSC via source_tags)
  with mine as (
    select ss.supplier_id from public.saved_suppliers ss where ss.owner_id = v_uid
  )
  select coalesce(jsonb_agg(jsonb_build_object('register', tag, 'count', n) order by n desc, tag asc), '[]'::jsonb)
    into v_registers
    from (
      select tag, count(distinct s.id)::int as n
        from mine m
        join public.suppliers s on s.id = m.supplier_id and s.is_published = true
        cross join lateral unnest(s.source_tags) as tag
       where tag in ('BGMEA','BKMEA','BTMA','BGAPMEA','EPB','RSC')
       group by 1
    ) t;

  -- by_certification (kinds present on saved set)
  with mine as (
    select ss.supplier_id from public.saved_suppliers ss where ss.owner_id = v_uid
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'count', n) order by n desc, kind asc), '[]'::jsonb)
    into v_certs
    from (
      select c.kind::text as kind, count(distinct s.id)::int as n
        from mine m
        join public.suppliers s on s.id = m.supplier_id and s.is_published = true
        join public.certifications c on c.supplier_id = s.id
       group by 1
    ) t;

  -- top_regions (city, district)
  with mine as (
    select ss.supplier_id from public.saved_suppliers ss where ss.owner_id = v_uid
  )
  select coalesce(jsonb_agg(jsonb_build_object('city', city, 'district', district, 'count', n) order by n desc), '[]'::jsonb)
    into v_regions
    from (
      select coalesce(nullif(trim(s.city), ''), 'Unknown') as city,
             coalesce(nullif(trim(s.district), ''), '')    as district,
             count(*)::int as n
        from mine m join public.suppliers s on s.id = m.supplier_id and s.is_published = true
       group by 1, 2
       order by n desc
       limit 10
    ) t;

  -- top_parent_groups
  with mine as (
    select ss.supplier_id from public.saved_suppliers ss where ss.owner_id = v_uid
  )
  select coalesce(jsonb_agg(jsonb_build_object('parent_group_name', parent_group_name, 'count', n) order by n desc), '[]'::jsonb)
    into v_groups
    from (
      select s.parent_group_name, count(*)::int as n
        from mine m join public.suppliers s on s.id = m.supplier_id and s.is_published = true
       where s.parent_group_name is not null
       group by 1
       order by n desc
       limit 10
    ) t;

  -- rsc coverage + avg progress
  with mine as (
    select ss.supplier_id from public.saved_suppliers ss where ss.owner_id = v_uid
  )
  select count(*)::int, avg(rr.progress_pct)
    into v_rsc_cov, v_rsc_avg
    from mine m
    join public.suppliers s on s.id = m.supplier_id and s.is_published = true
    join public.rsc_remediation rr on rr.supplier_id = s.id and rr.active = true;

  -- sanctions hits across all lists
  with mine as (
    select ss.supplier_id from public.saved_suppliers ss where ss.owner_id = v_uid
  )
  select count(distinct s.id)::int
    into v_sanc_hits
    from mine m
    join public.suppliers s on s.id = m.supplier_id and s.is_published = true
    join public.sanctions_screening sc on sc.supplier_id = s.id and sc.active = true;

  -- expiring certs within 90d
  with mine as (
    select ss.supplier_id from public.saved_suppliers ss where ss.owner_id = v_uid
  )
  select count(*)::int
    into v_expiring
    from mine m
    join public.suppliers s on s.id = m.supplier_id and s.is_published = true
    join public.certifications c on c.supplier_id = s.id
   where c.expires_on is not null
     and c.expires_on >= current_date
     and c.expires_on <  current_date + interval '90 days';

  return jsonb_build_object(
    'total_saved',           coalesce(v_total, 0),
    'total_published',       coalesce(v_published, 0),
    'by_country',            v_countries,
    'by_entity_type',        v_entities,
    'by_register',           v_registers,
    'by_certification',      v_certs,
    'top_regions',           v_regions,
    'top_parent_groups',     v_groups,
    'rsc_covered',           coalesce(v_rsc_cov, 0),
    'rsc_avg_progress_pct',  case when v_rsc_avg is null then null else round(v_rsc_avg, 1) end,
    'sanctions_hits',        coalesce(v_sanc_hits, 0),
    'expiring_certs_90d',    coalesce(v_expiring, 0)
  );
end;
$$;

comment on function public.compliance_msa_inputs() is
  'Spec B9 MSA-generator inputs. Scopes by auth.uid() via saved_suppliers; '
  'returns aggregates that feed the UK Modern Slavery Act §54 statement '
  'composer (countries / registers / certs / RSC coverage / sanctions / '
  'top regions / top groups).';

revoke all     on function public.compliance_msa_inputs() from public;
grant  execute on function public.compliance_msa_inputs() to authenticated;
