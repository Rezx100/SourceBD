-- 0035 — Spec S3 (supplier inbox surface). Extend `public.thread_list()`
-- to surface a `viewer_role` discriminator + buyer-identity columns so
-- the supplier-side inbox can render the buyer counterpart while the
-- buyer-side inbox keeps rendering the supplier counterpart. No new
-- table, no new enum — only the function body changes. The buyer-side
-- consumers (`/app/messages` + `/app/messages/[thread]`) keep working
-- because the existing return keys (`buyer_id`, `supplier_*`, …) are
-- preserved verbatim; this migration only adds keys.
--
-- Reversible: restore the prior body from 0027_messages.sql.

create or replace function public.thread_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;
  with mine as (
    select t.id, t.buyer_id, t.supplier_id, t.rfq_id, t.subject,
           t.last_message_at, t.updated_at, t.created_at
      from public.message_threads t
      join public.thread_participants tp
        on tp.thread_id = t.id and tp.user_id = v_uid
  ),
  enriched as (
    select
      m.id,
      m.buyer_id,
      m.supplier_id,
      m.rfq_id,
      m.subject,
      m.last_message_at,
      m.updated_at,
      m.created_at,
      s.slug         as supplier_slug,
      s.company_name as supplier_name,
      s.entity_type::text as supplier_entity_type,
      au.email::text      as buyer_email,
      bp.display_name     as buyer_display_name,
      case when m.buyer_id = v_uid then 'buyer' else 'supplier' end as viewer_role,
      (select count(*) from public.messages mm where mm.thread_id = m.id) as message_count
    from mine m
    join public.suppliers s   on s.id  = m.supplier_id
    join auth.users       au  on au.id = m.buyer_id
    left join public.profiles bp on bp.id = m.buyer_id
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id',                  id,
      'buyer_id',            buyer_id,
      'supplier_id',         supplier_id,
      'supplier_slug',       supplier_slug,
      'supplier_name',       supplier_name,
      'supplier_entity_type', supplier_entity_type,
      'buyer_email',         buyer_email,
      'buyer_display_name',  buyer_display_name,
      'viewer_role',         viewer_role,
      'rfq_id',              rfq_id,
      'subject',             subject,
      'last_message_at',     last_message_at,
      'updated_at',          updated_at,
      'created_at',          created_at,
      'message_count',       message_count
    ) order by coalesce(last_message_at, created_at) desc),
    '[]'::jsonb
  )
  into v_out
  from enriched;
  return v_out;
end;
$$;

revoke all  on function public.thread_list() from public;
grant execute on function public.thread_list() to authenticated;
