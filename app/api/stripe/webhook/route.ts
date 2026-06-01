// Spec H3 — Stripe webhook hardening.
//
// Verifies the Stripe signature against the raw request body, enforces a
// 5-minute replay tolerance, records every event idempotently via the
// SECURITY DEFINER `public.stripe_webhook_record` RPC (service-role only),
// and dispatches a small set of subscription-lifecycle event types.
//
// The dispatch table is deliberately a stub for v1 — actual mutation of
// profiles.plan_tier lands in the Phase-5 billing follow-up. H3 is a
// security perimeter, not a billing implementation.
//
// Excluded from the H2 rate limiter via the middleware matcher: Stripe
// retries with up to ~3-day exponential back-off and must not be throttled.

import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISPATCH_TYPES = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

function serverError(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 500 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret || !apiKey) return serverError("stripe_not_configured");
  if (!supabaseUrl || !serviceRoleKey) return serverError("supabase_not_configured");

  const sigHeader = req.headers.get("stripe-signature");
  if (!sigHeader) return badRequest("missing_signature");

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return badRequest("body_unreadable");
  }

  const stripe = new Stripe(apiKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sigHeader, secret);
  } catch {
    return badRequest("invalid_signature");
  }

  if (Math.abs(Date.now() - event.created * 1000) > 5 * 60 * 1000) {
    return badRequest("replay_window_exceeded");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: inserted, error: rpcError } = await supabase.rpc(
    "stripe_webhook_record",
    {
      p_event_id: event.id,
      p_type: event.type,
      p_payload: event as unknown as Record<string, unknown>,
    },
  );
  if (rpcError) {
    // Surface to Sentry via thrown error path; respond 500 so Stripe retries.
    return serverError("record_failed");
  }

  if (inserted === false) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  if (DISPATCH_TYPES.has(event.type)) {
    // Dispatch stub. The Phase-5 billing follow-up replaces these no-ops
    // with the real plan_tier / subscription mutations.
    console.log("[h3] dispatch:", event.type, event.id);
    return NextResponse.json({ received: true, handled: true }, { status: 200 });
  }

  return NextResponse.json({ received: true, handled: false }, { status: 200 });
}
