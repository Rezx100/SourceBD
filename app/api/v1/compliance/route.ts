// /api/v1/compliance — Compliance Hub (Spec B9).
//
// GET endpoints, all buyer-scoped via `saved_suppliers` inside the RPC:
//   GET /api/v1/compliance?view=expiry&window=90 → { expiry: {...} }
//   GET /api/v1/compliance?view=uflpa            → { uflpa:  {...} }
//   GET /api/v1/compliance?view=msa              → { msa:    {...} }
//
// Auth: any authenticated user; the RPCs gate by auth.uid() and return
// empty payloads when no rows match.

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Sb = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function requireAuth(): Promise<
  { supabase: Sb; userId: string } | NextResponse
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  return { supabase, userId: user.id };
}

export async function GET(req: Request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const { supabase } = gate;

  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "expiry";

  if (view === "expiry") {
    const windowRaw = url.searchParams.get("window");
    const parsed = windowRaw ? Number.parseInt(windowRaw, 10) : 90;
    const windowDays =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 365) : 90;
    const { data, error } = await supabase.rpc("compliance_expiring_certs", {
      p_window_days: windowDays,
    });
    if (error) {
      return NextResponse.json(
        { error: "compliance_expiring_certs failed", detail: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json({ expiry: data });
  }

  if (view === "uflpa") {
    const { data, error } = await supabase.rpc("compliance_uflpa_tracker");
    if (error) {
      return NextResponse.json(
        { error: "compliance_uflpa_tracker failed", detail: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json({ uflpa: data });
  }

  if (view === "msa") {
    const { data, error } = await supabase.rpc("compliance_msa_inputs");
    if (error) {
      return NextResponse.json(
        { error: "compliance_msa_inputs failed", detail: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json({ msa: data });
  }

  return NextResponse.json(
    { error: "unknown view; expected one of expiry|uflpa|msa" },
    { status: 400 },
  );
}
