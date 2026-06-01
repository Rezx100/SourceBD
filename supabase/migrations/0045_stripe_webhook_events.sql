-- Spec H3 — Stripe webhook hardening.
--
-- Idempotency + audit table for every Stripe event we have ever received.
-- The webhook route inserts via the SECURITY DEFINER stripe_webhook_record
-- RPC keyed on event_id; conflicts return false and the route returns 200
-- so Stripe retries are no-ops.
--
-- No RLS policies; service_role is the only principal with execute access
-- to the RPC, and the table itself has zero direct grants. Admin reads
-- land via a dedicated RPC in a later spec.

create table if not exists public.stripe_webhook_events (
  event_id     text primary key,
  type         text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  payload      jsonb not null
);

alter table public.stripe_webhook_events enable row level security;
-- Intentionally no policies. SECURITY DEFINER RPC is the only path in.

create or replace function public.stripe_webhook_record(
  p_event_id text,
  p_type text,
  p_payload jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count int;
begin
  if p_event_id is null or length(p_event_id) = 0 then
    raise exception 'event_id required' using errcode = '22023';
  end if;
  if p_type is null or length(p_type) = 0 then
    raise exception 'type required' using errcode = '22023';
  end if;
  if p_payload is null then
    raise exception 'payload required' using errcode = '22023';
  end if;

  insert into public.stripe_webhook_events (event_id, type, payload)
  values (p_event_id, p_type, p_payload)
  on conflict (event_id) do nothing;

  get diagnostics v_row_count = row_count;
  return v_row_count > 0;
end;
$$;

revoke all on function public.stripe_webhook_record(text, text, jsonb) from public;
grant execute on function public.stripe_webhook_record(text, text, jsonb) to service_role;
