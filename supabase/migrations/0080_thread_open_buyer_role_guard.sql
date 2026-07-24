-- Migration 0080 — REZ-11
-- Add buyer/admin role guard to thread_open.
--
-- Previously the function was granted to `authenticated` with only an
-- auth.uid() null-check, so a logged-in supplier could call it and be
-- inserted into message_threads as buyer_id / thread_participants as
-- role='buyer', impersonating a buyer.
--
-- This migration replaces thread_open with an identical body except for
-- a role guard immediately after the null-check. The GRANT is unchanged
-- (still `authenticated`) — the role enforcement is now inside the
-- SECURITY DEFINER body where it cannot be bypassed.

create or replace function public.thread_open(
  p_supplier_id uuid,
  p_rfq_id      uuid default null,
  p_subject     text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_role      text;
  v_thread_id uuid;
  v_claimed   uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Only buyers and admins may open threads.
  select role into v_role from public.profiles where id = v_uid;
  if v_role not in ('buyer', 'admin') then
    raise exception 'not a buyer' using errcode = '42501';
  end if;

  if p_supplier_id is null then
    raise exception 'supplier_id is required';
  end if;
  if not exists (
    select 1 from public.suppliers s
     where s.id = p_supplier_id and s.is_published = true
  ) then
    raise exception 'supplier not found or not published';
  end if;

  -- Idempotent: try the existing thread first.
  select id into v_thread_id
    from public.message_threads
   where buyer_id    = v_uid
     and supplier_id = p_supplier_id
     and rfq_id is not distinct from p_rfq_id
   limit 1;

  if v_thread_id is null then
    insert into public.message_threads (buyer_id, supplier_id, rfq_id, subject)
    values (v_uid, p_supplier_id, p_rfq_id, nullif(trim(coalesce(p_subject, '')), ''))
    returning id into v_thread_id;
  end if;

  -- Ensure buyer participant row exists.
  insert into public.thread_participants (thread_id, user_id, role)
  values (v_thread_id, v_uid, 'buyer')
  on conflict (thread_id, user_id) do nothing;

  -- Add the claimed supplier user if any.
  select s.claimed_by into v_claimed
    from public.suppliers s
   where s.id = p_supplier_id;

  if v_claimed is not null and v_claimed <> v_uid then
    insert into public.thread_participants (thread_id, user_id, role)
    values (v_thread_id, v_claimed, 'supplier')
    on conflict (thread_id, user_id) do nothing;
  end if;

  return v_thread_id;
end;
$$;

-- GRANT unchanged — role enforcement is inside the function body.
revoke all  on function public.thread_open(uuid, uuid, text) from public;
grant execute on function public.thread_open(uuid, uuid, text) to authenticated;
