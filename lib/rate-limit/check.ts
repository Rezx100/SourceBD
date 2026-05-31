// Spec H2 — Limiter helper. Wraps the SECURITY DEFINER `public.rl_check` RPC.
//
// Returns `{ok, retryAfter}`. Network/RPC failures fail OPEN (allow the
// request) so a transient Supabase outage does not lock every user out;
// Sentry catches the underlying error via the supabase-js error path.

import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitResult = { ok: boolean; retryAfter: number };

type RlCheckEnvelope = {
  ok: boolean;
  retry_after_seconds: number;
};

export async function rlCheck(
  supabase: SupabaseClient,
  bucket: string,
  ident: string,
  limitPerMin: number,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("rl_check", {
    p_bucket: bucket,
    p_ident: ident,
    p_limit_per_min: limitPerMin,
  });
  if (error || !data) return { ok: true, retryAfter: 0 };
  const env = data as RlCheckEnvelope;
  return {
    ok: env.ok === true,
    retryAfter: Math.max(0, Number(env.retry_after_seconds) || 0),
  };
}
