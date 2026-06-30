-- Repair Phase 7 P4 founder analytics RPC exposure.
-- This is intentionally idempotent so production can apply it even if 0060 was
-- skipped or PostgREST still has an old schema cache.

create or replace function public.admin_beta_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_funnel jsonb;
  v_top_suppliers jsonb;
begin
  select p.role::text into v_role from public.profiles p where p.id = v_uid;
  if v_role is distinct from 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;

  with buyers as (
    select id, created_at from auth.users u
     where exists (
       select 1 from public.profiles p
        where p.id = u.id and p.role = 'buyer'
     )
  ),
  saved_buyers as (
    select distinct owner_id as buyer_id from public.saved_suppliers
  ),
  rfq_buyers as (
    select distinct buyer_id from public.rfqs
  )
  select jsonb_build_object(
    'signups_total', (select count(*) from buyers),
    'signups_7d', (select count(*) from buyers where created_at >= now() - interval '7 days'),
    'signups_30d', (select count(*) from buyers where created_at >= now() - interval '30 days'),
    'with_saved_supplier', (select count(*) from saved_buyers),
    'with_rfq', (select count(*) from rfq_buyers),
    'signup_to_saved_pct',
      case when (select count(*) from buyers) = 0 then 0
           else round(100.0 * (select count(*) from saved_buyers) / (select count(*) from buyers), 1)
      end,
    'signup_to_rfq_pct',
      case when (select count(*) from buyers) = 0 then 0
           else round(100.0 * (select count(*) from rfq_buyers) / (select count(*) from buyers), 1)
      end
  ) into v_funnel;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'supplier_id', t.supplier_id,
               'company_name', t.company_name,
               'slug', t.slug,
               'save_count', t.save_count
             )
             order by t.save_count desc
           ),
           '[]'::jsonb
         )
    into v_top_suppliers
    from (
      select
        s.id as supplier_id,
        s.company_name,
        s.slug,
        count(*)::bigint as save_count
      from public.saved_suppliers ss
      join public.suppliers s on s.id = ss.supplier_id
      group by s.id, s.company_name, s.slug
      order by save_count desc
      limit 20
    ) t;

  return jsonb_build_object(
    'funnel', v_funnel,
    'top_saved_suppliers', v_top_suppliers,
    'generated_at', now()
  );
end;
$$;

comment on function public.admin_beta_dashboard() is
  'Phase 7 P4: founder beta funnel + top saved suppliers. Admin-only.';

revoke all on function public.admin_beta_dashboard() from public;
grant execute on function public.admin_beta_dashboard() to authenticated;

notify pgrst, 'reload schema';
