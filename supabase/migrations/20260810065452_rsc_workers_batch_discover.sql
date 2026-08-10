-- REZ-114: batch active RSC workers for discover / saved / smart-match cards.
-- Lets list surfaces apply the same site selection as profiles (RSC authority).

create or replace function public.rsc_workers_batch(p_supplier_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(
      sid::text,
      jsonb_build_object(
        'workers_count', workers_count,
        'fetched_at', fetched_at
      )
    ),
    '{}'::jsonb
  )
  from (
    select distinct on (rr.supplier_id)
      rr.supplier_id as sid,
      rr.workers_count,
      rr.fetched_at
    from public.rsc_remediation rr
    where rr.active is true
      and rr.workers_count is not null
      and rr.supplier_id = any (p_supplier_ids)
    order by rr.supplier_id, rr.fetched_at desc nulls last
  ) t;
$$;

revoke all on function public.rsc_workers_batch(uuid[]) from public;
grant execute on function public.rsc_workers_batch(uuid[]) to anon, authenticated;

comment on function public.rsc_workers_batch(uuid[]) is
  'REZ-114: map supplier_id → latest active RSC workers_count for list-card selection.';
