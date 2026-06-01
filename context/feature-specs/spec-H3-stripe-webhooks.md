# Spec H3 — Stripe webhook hardening

> Third Phase-6 spec per [phases.md](../phases.md) line 115: **"H3 — Stripe webhooks (subscription lifecycle, invoice failures)."**

## Goal

Land the Stripe webhook endpoint that Phase-5 billing (M2 follow-up) will dispatch subscription-lifecycle events through, with the four hardening invariants the rest of Phase 6 depends on: (1) raw-body signature verification, (2) idempotency keyed on `event.id`, (3) replay-window enforcement, (4) audit trail for every event we have ever received — even ones we do not handle yet.

The endpoint exists in v1 with the **dispatch table stubbed** — `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` are recognised but their downstream effects (writing `profiles.plan_tier`, suspending the buyer's saved-supplier quotas, etc.) are deliberately deferred to the Phase-5-billing follow-up that will actually wire Stripe checkout. H3 is a **security perimeter**, not a billing implementation.

## Out of scope

- Stripe Checkout, Customer Portal, Pricing Table embeds (Phase-5-billing follow-up).
- Actual mutation of `profiles.plan_tier` on subscription events (same follow-up).
- Stripe Treasury, Connect, Issuing, Tax — single-account subscriptions only.
- Resend templates (H4), onboarding tour (H5), polishing pass (H6), legal pages (H7), backup drill (H8).

## Hard rules carried forward

1. **Single new dep allowed: `stripe`** — sanctioned by `context/architecture.md` ("Payments: Stripe"). No other tool added.
2. **H1 PII scrubber continues to hold** — and is extended here to cover Stripe-specific identifiers (`stripe-signature` header, `customer_email`, `receipt_email`, `billing_details`).
3. **H2 rate limiter does NOT apply to `/api/stripe/webhook`** — Stripe retries idle-failed events with up to ~3 day exponential back-off and would otherwise hammer the limiter; the matcher excludes the path the same way `/api/health` is excluded.
4. **Server enforces** — signature mismatch / missing header / replay-out-of-window / parse failure all return 400 **before any side effect**, including before the idempotency insert.
5. **Service role only** — the `stripe_webhook_record` RPC is granted to `service_role` exclusively (not `anon`, not `authenticated`). The webhook route hits Supabase with the service-role key from the server env; the RPC is never reachable from a browser session.
6. **SBI / contact-PII / register-PII forbidden-token doctrine carries forward** to any new TS file.

## Scope

### A. Schema — migration `supabase/migrations/0045_stripe_webhook_events.sql`

```sql
create table if not exists public.stripe_webhook_events (
  event_id     text primary key,
  type         text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  payload      jsonb not null
);
alter table public.stripe_webhook_events enable row level security;
-- No policies. Only the SECURITY DEFINER stripe_webhook_record RPC writes.
-- No SELECT grant — admin reads will land via a dedicated RPC in a later spec.
```

`event_id` as PK is the idempotency key. `received_at` defaults to `now()`. `processed_at` stays NULL until a downstream dispatcher (Phase-5-billing follow-up) marks it; H3 itself does NOT set `processed_at` because v1 has nothing to dispatch.

### B. RPC — `public.stripe_webhook_record(p_event_id text, p_type text, p_payload jsonb) returns boolean`

- `language plpgsql security definer set search_path = public`.
- `revoke all from public; grant execute to service_role` only — **NOT anon, NOT authenticated**.
- Validates `p_event_id`, `p_type`, `p_payload` are non-null / non-empty.
- Single-statement insert with `on conflict (event_id) do nothing`. Returns `true` when a new row was inserted, `false` when the event was already on file.

```sql
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
  v_inserted boolean := false;
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

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.stripe_webhook_record(text, text, jsonb) from public;
grant execute on function public.stripe_webhook_record(text, text, jsonb) to service_role;
```

### C. PII scrubber extension — `lib/sentry/pii-scrub.ts`

Add four entries to `FORBIDDEN` so Stripe payloads / breadcrumbs cannot leak through Sentry:

- `/^stripe-signature$/i`
- `/^customer_email$/i`
- `/^receipt_email$/i`
- `/^billing_details$/i`

Existing scrub semantics (drop-event-on-auth-cookie, recursive object scrub, query-string scrub) are unchanged.

### D. Middleware matcher — `middleware.ts`

Extend the negative-lookahead to exclude `api/stripe/webhook` alongside `api/health`:

```
matcher: [
  "/((?!_next/|api/health|api/stripe/webhook|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js|woff|woff2|ttf|map|xml|txt)$).*)",
],
```

Stripe retries do not carry our session cookie, do not need the rate limiter, and must not be rewritten to a redirect by the auth gate.

### E. Route — `app/api/stripe/webhook/route.ts`

- `export const runtime = "nodejs"` + `export const dynamic = "force-dynamic"`.
- Reads the raw body via `await req.text()` — `req.json()` is forbidden because the JSON parser drops byte-exact whitespace and `constructEvent` will then fail signature verification.
- Verifies signature with `stripe.webhooks.constructEvent(rawBody, sigHeader, process.env.STRIPE_WEBHOOK_SECRET!)`. Missing header / missing secret env / verification throw → HTTP 400 with `{error:"invalid_signature"}`.
- Replay window: rejects with HTTP 400 `{error:"replay_window_exceeded"}` when `Math.abs(Date.now() - event.created * 1000) > 5 * 60 * 1000` (matches Stripe's default tolerance).
- Calls `stripe_webhook_record(event.id, event.type, event as unknown as Record<string, unknown>)` via a `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` (NOT the SSR cookie-bridge client — the service-role key has no cookie surface).
  - Returns 200 + `{received:true, duplicate:true}` immediately if the RPC reports the event was already on file. Stripe retries become no-ops.
- Dispatch table for v1:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

  Each handler is a one-line `console.log("[h3] dispatch:", event.type, event.id)` for now — actual mutation is deferred to the Phase-5-billing follow-up. Any other `event.type` is recorded (already via step above) and returns 200 + `{received:true, handled:false}` so we have an audit trail without partial business logic.

### F. Env

- `STRIPE_WEBHOOK_SECRET` — already declared in `.env.example`.
- `STRIPE_SECRET_KEY` — already declared. Used by the `Stripe` constructor (constructEvent needs the secret key to instantiate even though signature verification does not call the API).
- `SUPABASE_SERVICE_ROLE_KEY` — already declared.

### G. Smoke — `ops/_h3_smoke.py` (6 checks, disk-based)

1. **Migration on disk** — `supabase/migrations/0045_stripe_webhook_events.sql` exists and contains `create table` for `stripe_webhook_events` (PK `event_id`) + `create or replace function public.stripe_webhook_record`.
2. **RPC signature + SECURITY DEFINER + grant-to-service-role-only** — migration text contains the signature `(p_event_id text, p_type text, p_payload jsonb) returns boolean`, `security definer`, `set search_path = public`, `revoke all on function public.stripe_webhook_record(text, text, jsonb) from public`, AND `grant execute on function public.stripe_webhook_record(text, text, jsonb) to service_role`. Smoke also asserts the migration does NOT grant execute to `anon` or `authenticated` (those would defeat the entire boundary).
3. **Route file shape** — `app/api/stripe/webhook/route.ts` imports `Stripe`, sets `runtime='nodejs'`, sets `dynamic='force-dynamic'`, calls `await req.text()`, calls `stripe.webhooks.constructEvent(`, and enforces the 5-minute replay window literal `5 * 60 * 1000`.
4. **Middleware matcher excludes the webhook path** — `middleware.ts` matcher string contains the literal `api/stripe/webhook` in the negative-lookahead alongside `api/health`.
5. **Forbidden-token scan** — new TS files (`app/api/stripe/webhook/route.ts`, modified `middleware.ts`, modified `lib/sentry/pii-scrub.ts`) carry none of the M5/H1 forbidden-token literals as JSON keys (`"email"`, `"phone"`, `"password"`, `"nid_number"`, `"trade_license_number"`, `"sbi_total"`, `"pillar_1"`, `"internal_score"`, `"verification_token"`, `"body_ciphertext"`). The Stripe-specific tokens (`stripe-signature`, `customer_email`, `receipt_email`, `billing_details`) are expected as regex literals inside `pii-scrub.ts` and excluded from this scan by file path.
6. **Route count baseline** — `.next/routes-manifest.json` `staticRoutes` + `dynamicRoutes` length is **64**, unchanged from the H2 baseline. Non-dynamic API routes (`/api/health`, `/api/stripe/webhook`, the static `/api/v1/*` handlers) are not enumerated in `routes-manifest.json`'s `staticRoutes` / `dynamicRoutes` — only dynamic-param API routes appear (e.g. `/api/v1/admin/suppliers/[id]`). The new webhook route does show up in the `pnpm build` route table, but the smoke can only deterministically gate on the manifest counts.

## Acceptance

- `pnpm typecheck` clean.
- `pnpm lint` clean.
- `pnpm build` green.
- `python ops/_h3_smoke.py` → 6/6 PASS.
- Route count = 64 (unchanged from H2 — see smoke (6) for why).
- Migration `0045_stripe_webhook_events.sql` ready to apply to Supabase Singapore project (`stnrfxrxfonwexzcvvpv`) — applied separately by user via the existing migration apply pattern.
- One commit on `development`: `feat(security): ship Spec H3 stripe webhook hardening`.

## Non-goals (explicit, do NOT do)

- Do NOT write to `profiles.plan_tier` from event handlers — billing wiring is the Phase-5-billing follow-up's job.
- Do NOT add SELECT policies on `stripe_webhook_events` — admin read surface lands later.
- Do NOT call `stripe.subscriptions.retrieve()` or any other Stripe API from the webhook handler. Signature verification + idempotent insert + dispatch stub only.
