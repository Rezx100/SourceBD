// Spec H1 — Sentry PII scrubber.
//
// Shared by the server, edge, and client Sentry inits. The scrubber:
//   - drops events that carry cookies or an Authorization header
//   - recursively redacts any object key in FORBIDDEN
//   - redacts query-string entries with a forbidden key
//
// FORBIDDEN matches the M5 forbidden-token doctrine plus the auth /
// secret keys that should never leave the process.

import type { Event } from "@sentry/nextjs";

const REDACTED = "[scrubbed]";

const FORBIDDEN: ReadonlyArray<RegExp> = [
  /^email(_primary)?$/i,
  /^phones?$/i,
  /^contact_(name|role)$/i,
  /^nid_number$/i,
  /^proprietor_nid$/i,
  /^owner_phone$/i,
  /^trade_license_number$/i,
  /^password$/i,
  /^verification_token(_hash)?$/i,
  /^body_ciphertext$/i,
  /^authorization$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^sbi(_.*)?$/i,
  /^pillar(_.*)?$/i,
  /^internal_score$/i,
  /^supplier_score_internal$/i,
  // H3 — Stripe webhook hardening: scrub the verification header and the
  // PII-bearing fields Stripe puts on Checkout / Invoice / PaymentIntent
  // payloads so neither makes it into a Sentry breadcrumb.
  /^stripe-signature$/i,
  /^customer_email$/i,
  /^receipt_email$/i,
  /^billing_details$/i,
  // H4 — Resend transactional emails: redact the API key and the
  // recipient address from any breadcrumb / extra / tag that may carry
  // them through the sender wrapper.
  /^resend[-_]?api[-_]?key$/i,
  /^to[-_]?addr$/i,
];

function isForbiddenKey(key: string): boolean {
  for (const pat of FORBIDDEN) if (pat.test(key)) return true;
  return false;
}

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isForbiddenKey(k) ? REDACTED : scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

function scrubQueryString(qs: string): string {
  if (!qs) return qs;
  const parts = qs.split("&");
  const out: string[] = [];
  for (const part of parts) {
    const eq = part.indexOf("=");
    const key = eq >= 0 ? part.slice(0, eq) : part;
    let decoded = key;
    try {
      decoded = decodeURIComponent(key);
    } catch {
      decoded = key;
    }
    if (isForbiddenKey(decoded)) {
      out.push(`${key}=${REDACTED}`);
    } else {
      out.push(part);
    }
  }
  return out.join("&");
}

export function scrubSentryEvent<T extends Event>(event: T): T | null {
  const req = event.request;
  if (req) {
    if (req.cookies) return null;
    const headers = req.headers as Record<string, string> | undefined;
    if (headers && (headers.authorization || headers.Authorization)) {
      return null;
    }
    if (typeof req.query_string === "string") {
      req.query_string = scrubQueryString(req.query_string);
    }
    if (headers) req.headers = scrub(headers) as Record<string, string>;
    if (req.data) req.data = scrub(req.data);
  }
  if (event.contexts) event.contexts = scrub(event.contexts) as Event["contexts"];
  if (event.extra) event.extra = scrub(event.extra) as Event["extra"];
  if (event.tags) event.tags = scrub(event.tags) as Event["tags"];
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      data: b.data ? (scrub(b.data) as Record<string, unknown>) : b.data,
    }));
  }
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      const frames = ex.stacktrace?.frames;
      if (frames) {
        for (const f of frames) {
          if (f.vars) f.vars = scrub(f.vars) as Record<string, unknown>;
        }
      }
    }
  }
  return event;
}
