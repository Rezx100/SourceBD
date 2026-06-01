-- Spec H4 — Transactional email audit log.
--
-- Every attempt by the shared sender (`lib/email/send.ts`) writes one row
-- here. Sent + failed are both recorded so retries are visible and abuse
-- patterns (loop sending the same template to the same recipient) are
-- discoverable.
--
-- RLS is on with zero policies. Only the SECURITY DEFINER RPC
-- public.email_log_record(...) can write; only `service_role` may execute
-- the RPC (the sender always runs server-side with the service-role
-- Supabase client, same pattern as the H3 Stripe webhook recorder).

create table if not exists public.email_log (
  id         uuid primary key default gen_random_uuid(),
  to_addr    text not null,
  template   text not null,
  ref_id     text,
  sent_at    timestamptz not null default now(),
  resend_id  text,
  status     text not null check (status in ('sent','failed')),
  error      text
);

create index if not exists idx_email_log_to_template_sent
  on public.email_log (to_addr, template, sent_at desc);
create index if not exists idx_email_log_ref
  on public.email_log (ref_id) where ref_id is not null;

alter table public.email_log enable row level security;
-- Intentionally no policies. SECURITY DEFINER email_log_record is the only writer.

create or replace function public.email_log_record(
  p_to_addr   text,
  p_template  text,
  p_ref_id    text,
  p_resend_id text,
  p_status    text,
  p_error     text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_to_addr is null or length(p_to_addr) = 0 then
    raise exception 'to_addr required' using errcode = '22023';
  end if;
  if p_template is null or length(p_template) = 0 then
    raise exception 'template required' using errcode = '22023';
  end if;
  if p_status not in ('sent','failed') then
    raise exception 'status must be sent|failed' using errcode = '22023';
  end if;
  insert into public.email_log (to_addr, template, ref_id, resend_id, status, error)
  values (p_to_addr, p_template, p_ref_id, p_resend_id, p_status, p_error)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.email_log_record(text, text, text, text, text, text) from public;
revoke execute on function public.email_log_record(text, text, text, text, text, text) from anon, authenticated;
grant execute on function public.email_log_record(text, text, text, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Helper RPCs used by the H4 trigger wiring. Both run as SECURITY DEFINER
-- so the calling code (server actions / API routes with the service-role
-- key) can look up recipient addresses without exposing auth.users to the
-- anon/authenticated roles. Both are granted to service_role only.

create or replace function public.email_rfq_recipients(
  p_supplier_ids uuid[]
) returns table (
  supplier_id  uuid,
  company_name text,
  email        text
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.company_name, u.email::text
    from public.suppliers s
    join auth.users u on u.id = s.claimed_by
   where s.id = any(p_supplier_ids)
     and s.claimed_by is not null
     and u.email is not null;
$$;

revoke all on function public.email_rfq_recipients(uuid[]) from public;
revoke execute on function public.email_rfq_recipients(uuid[]) from anon, authenticated;
grant execute on function public.email_rfq_recipients(uuid[]) to service_role;

create or replace function public.email_sanction_recipients(
  p_supplier_id uuid
) returns table (email text)
language sql
security definer
set search_path = public
as $$
  select distinct u.email::text
    from public.saved_suppliers ss
    join auth.users u on u.id = ss.owner_id
   where ss.supplier_id = p_supplier_id
     and u.email is not null;
$$;

revoke all on function public.email_sanction_recipients(uuid) from public;
revoke execute on function public.email_sanction_recipients(uuid) from anon, authenticated;
grant execute on function public.email_sanction_recipients(uuid) to service_role;
