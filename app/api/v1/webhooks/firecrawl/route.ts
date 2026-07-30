// Firecrawl monitor webhook.
//
// Firecrawl retries any delivery it does not get a 2xx for within 10 seconds, so
// this route does the minimum that is still correct: authenticate, record, return.
// Re-verifying a changed page takes far longer than the timeout, so doing it
// inline would guarantee duplicate deliveries for every real change — the ETL
// worker drains `firecrawl_webhook_events` instead (etl/evidence/webhook_inbox.py).
//
// Auth is a shared secret in a header, compared in constant time. Firecrawl does
// not sign its webhook bodies the way Stripe does, so there is no signature to
// verify; the secret is registered per monitor in `webhook.headers` by
// `refresh_monitors`. A header rather than a query string keeps it out of access
// logs.
//
// Excluded from the middleware rate limiter for the same reason the Stripe route
// is: throttling a retrying webhook sender turns a transient blip into a backlog.

import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET_HEADER = "x-sourcebd-webhook-secret";
// Firecrawl deliveries are small JSON envelopes. A cap stops an unauthenticated
// body from being buffered before the secret has been checked.
const MAX_BODY_BYTES = 512 * 1024;

/** Constant-time compare over fixed-length digests. */
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

/**
 * A stable identity for this delivery.
 *
 * Firecrawl's envelope shape has varied across monitor releases, so we prefer an
 * id it supplies and otherwise hash the body. Hashing means a genuine retry of
 * the same event collapses to one row, while two distinct checks of the same URL
 * stay distinct because their payloads differ.
 */
function dedupeKey(payload: Record<string, unknown>, rawBody: string): string {
  const explicit = firstString(payload, ["id", "eventId", "event_id", "deliveryId"]);
  if (explicit) return `fc:${explicit}`;
  return `fc:sha256:${createHash("sha256").update(rawBody).digest("hex")}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.FIRECRAWL_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Unconfigured means no monitors were ever registered against this deployment,
  // so nothing can legitimately be posting here. 404 rather than 500: an
  // unconfigured route is indistinguishable from a nonexistent one to a scanner,
  // and a 5xx would make Firecrawl retry a request we will never accept.
  if (!expected) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const provided = req.headers.get(SECRET_HEADER);
  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    // 500 on purpose: the delivery is valid and we want it retried once the
    // deployment is repaired, rather than silently dropped.
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 });
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "body_unreadable" }, { status: 400 });
  }
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isRecord(payload)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const eventType =
    firstString(payload, ["type", "event", "eventType", "event_type"]) ?? "unknown";
  const monitorId = firstString(payload, ["monitorId", "monitor_id", "monitor"]);

  // The changed page's URL can arrive at the envelope root or inside the check
  // result, depending on the event. Recording it wrong would mean requeueing the
  // wrong documents, so both shapes are read rather than assumed.
  const nested = isRecord(payload.data) ? payload.data : {};
  const pageUrl =
    firstString(payload, ["url", "pageUrl", "page_url"]) ??
    firstString(nested, ["url", "pageUrl", "page_url"]);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: inserted, error } = await supabase.rpc("firecrawl_webhook_record", {
    p_dedupe_key: dedupeKey(payload, rawBody),
    p_event_type: eventType,
    p_monitor_id: monitorId,
    p_page_url: pageUrl,
    p_payload: payload,
  });

  if (error) {
    // Retryable by design: losing a change notification would leave stale
    // citations looking verified until the weekly sweep caught up.
    console.error("[firecrawl-webhook] record failed:", error.message);
    return NextResponse.json({ error: "record_failed" }, { status: 500 });
  }

  return NextResponse.json(
    { received: true, duplicate: inserted === false },
    { status: 200 },
  );
}
