-- 0097 REZ-73 mother facility panel. Static SQL. Numbered like 0095/0096.
-- search_path fixed. No EXECUTE/format/dynamic identifiers.

create or replace function public._facility_group_metric(p_own bigint, p_vals bigint[])
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'own', p_own,
    'facility_count', coalesce(cardinality(p_vals), 0),
    'building_count', 1 + coalesce(cardinality(p_vals), 0),
    'known_sum', case
      when coalesce(cardinality(p_vals), 0) = 0 then p_own
      when (select count(*) from unnest(array_prepend(p_own, p_vals)) v(x) where x is not null) = 0
        then null
      else (select sum(x)::bigint from unnest(array_prepend(p_own, p_vals)) v(x) where x is not null)
    end,
    'unknown_count',
      (select count(*)::int from unnest(array_prepend(p_own, p_vals)) v(x) where x is null));
$$;

create or replace function public.buyer_supplier_facility_panel(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  with m as (
    select id, employees_total, machines_sewing,
           production_capacity_pcs_day, production_capacity_dozen_yearly
      from public.suppliers
     where slug = p_slug and is_published and facility_of is null limit 1
  ),
  b as (
    select f.id, f.company_name, f.employees_total, f.machines_sewing,
           f.production_capacity_pcs_day, f.production_capacity_dozen_yearly
      from m join public.suppliers f on f.facility_of = m.id
  )
  select case when not exists (select 1 from m) then null else jsonb_build_object(
    'facility_count', (select count(*)::int from b),
    'facilities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', b.company_name,
        'employees_total', b.employees_total,
        'machines_sewing', b.machines_sewing,
        'production_capacity_pcs_day', b.production_capacity_pcs_day,
        'production_capacity_dozen_yearly', b.production_capacity_dozen_yearly,
        'addresses', coalesce((
          select jsonb_agg(jsonb_build_object(
            'kind', va.address_kind, 'address', va.address, 'source_code', va.source_code
          ) order by va.address_kind, va.source_code)
          from public.v_supplier_addresses_direct va where va.supplier_id = b.id
        ), '[]'::jsonb),
        'rsc_progress_pct', (
          select r.progress_pct from public.rsc_remediation r
           where r.supplier_id = b.id and r.active limit 1),
        'pills', coalesce((
          select jsonb_agg(jsonb_build_object(
            'source_code', p.source_code, 'label', p.label, 'value', p.value
          ) order by p.source_code)
          from public.v_supplier_registry_ids_direct p where p.supplier_id = b.id
        ), '[]'::jsonb)
      ) order by b.company_name) from b), '[]'::jsonb),
    'group', jsonb_build_object(
      'employees_total', public._facility_group_metric(
        (select employees_total from m),
        (select coalesce(array_agg(employees_total), '{}') from b)),
      'machines_sewing', public._facility_group_metric(
        (select machines_sewing from m),
        (select coalesce(array_agg(machines_sewing), '{}') from b)),
      'production_capacity_pcs_day', public._facility_group_metric(
        (select production_capacity_pcs_day from m),
        (select coalesce(array_agg(production_capacity_pcs_day), '{}') from b)),
      'production_capacity_dozen_yearly', public._facility_group_metric(
        (select production_capacity_dozen_yearly from m),
        (select coalesce(array_agg(production_capacity_dozen_yearly), '{}') from b)))
  ) end;
$$;

revoke all on function public._facility_group_metric(bigint, bigint[]) from public;
revoke all on function public.buyer_supplier_facility_panel(text) from public;
grant execute on function public.buyer_supplier_facility_panel(text) to anon, authenticated;
