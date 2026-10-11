// POST /api/v1/suppliers/:slug/shipments — the on-demand shipment reveal (0141, handoff-volza-reveal.md).
//
// The only place the app calls Volza. The middleware's api_reveal bucket (10 a minute per user) answers 429
// before this runs. Then, in order: sign-in; volza_reveal_begin as the buyer (plan and suspension, exact match,
// allowance, the saved copy, the per-supplier claim, off switch, credit floor and monthly cap); the Volza call;
// finish or abort as the service role; the read as the buyer, cut to 15 or 25 in SQL.
//
// Answers: 200 {reveal}; 401 signed out; 403 not on Growth or Enterprise (or suspended); 404 no exact match;
// 429 allowance or daily limit used ({error, limit, code: allowance_used | daily_limit}); 503 "try again shortly" for anything else, with nothing
// saved and no allowance used.

import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { fetchLatestShipments, revealTiming } from "@/lib/volza/shipments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,159}$/;
const BUSY_TRIES = 25; // × 2 s: outlasts the other fetch's 45 s Volza timeout

type Begin =
  | { status: "ready"; reveal: unknown }
  | { status: "fetch"; claim: string; name: string; window_start: string; window_end: string }
  | { status: "allowance_used" | "daily_limit"; limit: number }
  | { status: "forbidden" | "unavailable" | "busy" | "paused" | "budget" };

const say = (error: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status });
const shortly = () => say("Couldn't load the shipments just now. Try again shortly.", 503);

export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) return say("Not found.", 404);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return say("Sign in to see shipments.", 401);

  let begin: Begin | null = null;
  for (let i = 0; i < BUSY_TRIES; i++) {
    const { data, error } = await supabase.rpc("volza_reveal_begin", { p_slug: slug });
    if (error || !data) return shortly();
    begin = data as Begin;
    if (begin.status !== "busy") break;
    // Another buyer's fetch of this supplier is running: wait for it rather than pay twice.
    await new Promise((r) => setTimeout(r, revealTiming.busyWaitMs));
  }

  switch (begin?.status) {
    case "ready":
      return NextResponse.json({ reveal: begin.reveal });
    case "forbidden":
      return say("Shipments are part of the Growth and Enterprise plans.", 403);
    case "unavailable":
      return say("No shipments to show for this supplier.", 404);
    case "allowance_used":
      return say("You've used this month's shipment reveals.", 429, { limit: begin.limit, code: "allowance_used" });
    case "daily_limit":
      return say("You've reached today's shipment reveals. Try again tomorrow.", 429, { limit: begin.limit, code: "daily_limit" });
    case "fetch":
      break;
    default:
      return shortly();
  }

  const service = await createSupabaseServiceClient();
  const key = process.env.VOLZA_API_KEY;
  // Misconfigured (no service key): only the service role may release a claim, so it lapses after two minutes.
  if (!service) return shortly();
  if (!key) {
    await service.rpc("volza_reveal_abort", { p_claim: begin.claim, p_cost_usd: 0 });
    return shortly();
  }

  const got = await fetchLatestShipments(key, begin.name, begin.window_start, begin.window_end);
  if (got.ok === false) {
    console.error(`[volza reveal] ${slug}: ${got.reason}`);
    await service.rpc("volza_reveal_abort", { p_claim: begin.claim, p_cost_usd: got.cost });
    return shortly();
  }

  const finished = await service.rpc("volza_reveal_finish", {
    p_claim: begin.claim,
    p_records: got.records,
    p_cost_usd: got.cost,
    p_credit_remaining_usd: got.creditRemaining,
  });
  if (finished.error) {
    // Nothing saved; Volza has billed it, so the spend is still logged.
    await service.rpc("volza_reveal_abort", { p_claim: begin.claim, p_cost_usd: got.cost });
    return shortly();
  }

  // The read, as the buyer. Null when the claim had lapsed and no copy was saved for them.
  const { data: reveal, error } = await supabase.rpc("supplier_shipment_reveal", { p_slug: slug });
  if (error || !reveal) return shortly();
  return NextResponse.json({ reveal });
}
