// POST /api/v1/match — Spec B4 Smart Match wizard endpoint.
//
// Accepts the 3-step wizard payload, validates it inline (no zod — keeping
// dependencies locked per architecture.md), calls the security-definer SQL
// function `public.buyer_smart_match(p_input jsonb)`, and returns the ranked
// results document untouched.
//
// Auth: `middleware.ts` only covers `/app/*`, `/supplier/*`, `/admin/*`. This
// handler enforces buyer/admin auth itself via `getServerRole()`. No anon
// access \u2014 the wizard surface is buyer-only by frontend-design-spec.md \u00a72.1.
//
// The matcher RPC excludes contact PII and never serialises SBI numerics, so
// this route does not need to project / strip fields after the call.
// REZ-114: workers on results go through runSmartMatch → enrichDiscoverWorkers.

import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { runSmartMatch } from "@/lib/smart-match-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const role = await getServerRole();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const result = await runSmartMatch({
    role,
    supabase,
    raw,
  });
  return NextResponse.json(result.body, { status: result.status });
}
