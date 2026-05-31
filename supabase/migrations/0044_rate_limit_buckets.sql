-- Spec H2 — Rate limiting on public + auth + API routes.
--
-- Postgres-backed fixed-window counter. Storage table + SECURITY DEFINER RPC
-- public.rl_check(bucket, ident, limit_per_min) returns jsonb that
-- atomically increments the bucket and reports whether the caller is over
-- the limit. 5-minute TTL purge is opportunistic — a quiet bucket ages out
-- lazily on the next call that touches the table; no cron needed.
--
-- Identifiers:
--   * authenticated routes -> auth.users.id (UUID stringified)
--   * anonymous routes     -> leftmost x-forwarded-for IP (Coolify/Traefik chain)
--
-- All access to rate_limit_buckets goes through this RPC. The table has RLS
-- enabled with zero policies; only the SECURITY DEFINER function can read or
-- mutate it.

create table if not exists public.rate_limit_buckets (
  bucket text not null,
  ident text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket, ident, window_start)
);

alter table public.rate_limit_buckets enable row level security;
-- Intentionally no policies. SECURITY DEFINER rl_check is the only path in.

create or replace function public.rl_check(
  p_bucket text,
  p_ident text,
  p_limit_per_min int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz := date_trunc('minute', now());
  v_count int;
  v_remaining int;
  v_retry_after int;
begin
  if p_bucket is null or length(p_bucket) = 0 then
    raise exception 'bucket required' using errcode = '22023';
  end if;
  if p_ident is null or length(p_ident) = 0 then
    raise exception 'ident required' using errcode = '22023';
  end if;
  if p_limit_per_min is null or p_limit_per_min <= 0 then
    raise exception 'limit_per_min must be > 0' using errcode = '22023';
  end if;

  -- Opportunistic TTL purge — keep the table bounded without a cron.
  delete from public.rate_limit_buckets
   where window_start < now() - interval '5 minutes';

  insert into public.rate_limit_buckets (bucket, ident, window_start, count)
  values (p_bucket, p_ident, v_window_start, 1)
  on conflict (bucket, ident, window_start)
  do update set count = public.rate_limit_buckets.count + 1
  returning count into v_count;

  v_remaining := greatest(0, p_limit_per_min - v_count);
  if v_count > p_limit_per_min then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (v_window_start + interval '1 minute' - now())))::int
    );
  else
    v_retry_after := 0;
  end if;

  return jsonb_build_object(
    'ok', v_count <= p_limit_per_min,
    'count', v_count,
    'limit', p_limit_per_min,
    'remaining', v_remaining,
    'window_start', v_window_start,
    'retry_after_seconds', v_retry_after
  );
end;
$$;

revoke all on function public.rl_check(text, text, int) from public;
grant execute on function public.rl_check(text, text, int) to anon, authenticated;
