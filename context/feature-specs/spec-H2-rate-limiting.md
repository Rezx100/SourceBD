# Spec H2 — Rate limiting on public + auth + API routes

> Second Phase-6 spec per [phases.md](../phases.md) line 119: **"H2 — Rate limiting on all public + auth routes."**

## Goal

Cap abusive traffic against (a) the public marketing surface, (b) the auth surface (`/login`, `/signup`, `/forgot-password`, `/reset-password`), and (c) `/api/v1/*` reads + writes — before Phase 7 (Source Fashion London beta) goes live with anonymous discoverability. Postgres-backed fixed-window counter; no Redis, no new infra.

## Out of scope

- Stripe webhooks (H3), Resend templates (H4), onboarding tour (H5), polishing pass (H6), legal pages (H7), backup drill (H8).
- DDoS mitigation at the edge — Coolify/Traefik already does L4. This spec is L7 application-level.
- Per-tenant or per-plan quotas. Single global limit per route class.
- Distributed token-bucket math (leaky-bucket, sliding window). A 1-minute fixed window is sufficient for the v1 abuse threshold; can be sharpened later without a schema change.

## Hard rules carried forward

1. **No new tools.** Postgres + Supabase JS only — no Redis, no `@upstash/ratelimit`, no in-memory store (per-process memory is wrong on a multi-replica deploy).
2. **PII scrubber from H1 continues to hold.** Neither the bucket name nor the identifier (which can be an IP) may surface in a Sentry breadcrumb or PostHog event. Smoke check (e) forbids the literals.
3. **Server enforces** — middleware is the only enforcement point; UI never relies on knowing the limit.
4. **SBI / contact-PII / register-PII forbidden-token doctrine carries forward** to any new TS file.

## Scope

### A. Schema — migration `supabase/migrations/0044_rate_limit_buckets.sql`

```sql
create table if not exists public.rate_limit_buckets (
  bucket text not null,
  ident text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket, ident, window_start)
);
alter table public.rate_limit_buckets enable row level security;
-- No SELECT / INSERT / UPDATE / DELETE policies. All access goes through the
-- SECURITY DEFINER rl_check RPC.
```

Index on the primary key is sufficient for the access patterns (upsert + opportunistic TTL delete).

### B. RPC — `public.rl_check(p_bucket text, p_ident text, p_limit_per_min int) returns jsonb`

- `language plpgsql security definer set search_path = public`.
- `revoke all from public; grant execute to anon, authenticated`.
- Truncates `now()` to the minute → `v_window_start`.
- Upserts `(p_bucket, p_ident, v_window_start)` with `count = count + 1` via `on conflict do update`, returning the post-increment count.
- Opportunistic TTL purge in the same call: `delete from rate_limit_buckets where window_start < now() - interval '5 minutes'`. No separate cron — the 5-minute TTL is a soft cap; a quiet bucket can age out lazily on the next request that touches the table.
- Returns `jsonb` envelope `{ok, count, limit, remaining, window_start, retry_after_seconds}`.
  - `ok` = `v_count <= p_limit_per_min`.
  - `retry_after_seconds` = seconds until the current minute boundary expires, only when `ok=false`; `0` otherwise.

### C. Route classifier — `lib/rate-limit/limits.ts`

Documented limit constants (the smoke pins them):

```ts
export const RATE_LIMITS = {
  auth:             { perMin:  10, identifier: "ip"   },  // /login POST, /signup POST, /forgot-password, /reset-password
  api_write:        { perMin:  30, identifier: "user" },  // /api/v1/* with POST/PUT/PATCH/DELETE
  api_read:         { perMin: 120, identifier: "user" },  // /api/v1/* with GET/HEAD
  public_marketing: { perMin: 240, identifier: "ip"   },  // marketing pages (anon)
} as const;
```

`classifyRoute(pathname, method) → keyof RATE_LIMITS | null`:

- Returns `"auth"` for `/login` (POST), `/signup` (POST), `/forgot-password`, `/reset-password`.
- Returns `"api_write"` for `/api/v1/*` with `POST|PUT|PATCH|DELETE`.
- Returns `"api_read"` for `/api/v1/*` with `GET|HEAD`.
- Returns `"public_marketing"` for marketing-group paths (`/`, `/pricing`, `/legal/*`, `/discover`, `/suppliers/*`, `/compliance/*`).
- Returns `null` for authenticated app paths (`/app/*`, `/admin/*`, `/supplier/*` — those already gated by server-side auth, not rate-limited in this spec) and the internal health probe (`/api/health` — outside the matcher).

### D. Identifier resolver

- `identifier === "ip"` → left-most entry of `req.headers.get("x-forwarded-for")` (Coolify/Traefik chain). Fallback `"0.0.0.0"` for local dev where the header is absent. The `"x-real-ip"` header is also honoured as a fallback before the literal.
- `identifier === "user"` → `supabase.auth.getUser()` → `user.id`. On unauthed `/api/v1/*` hits (e.g. before login), fall back to IP so the bucket still applies and a logged-out attacker cannot bypass the gate by omitting cookies.

### E. Server-side allowlist for the internal health probe

`/api/health` is excluded from the middleware matcher entirely (uptime probes from Coolify hit it tens of times per minute). No client-controllable allowlist header — the bypass is structural (matcher), never user-asserted.

### F. Middleware integration — `middleware.ts`

The classifier runs **before** auth gating so an attacker who never authenticates cannot evade the auth-route limiter. Existing auth logic (Spec F3 + A5 suspension gate) is preserved verbatim for `/app`, `/admin`, `/supplier`, `/api/v1`.

Matcher broadened to cover the marketing + auth surfaces. Static assets and the `_next` runtime are excluded so the middleware does not run on image / JS / CSS requests.

```ts
config.matcher = [
  "/((?!_next/|api/health|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js|woff|woff2|ttf|map|xml|txt)$).*)",
];
```

On a rate-limit miss, the middleware returns:

```json
{ "error": "rate_limited", "retry_after_seconds": N }
```

with HTTP status `429` and the `Retry-After: N` header. For HTML routes the same JSON body is acceptable — the middleware does not distinguish (clients can read either the header or the body).

### G. Smoke — `ops/_h2_smoke.py` (6 checks, disk-based)

1. **Migration applied** — `supabase/migrations/0044_rate_limit_buckets.sql` exists and contains `create table` for `rate_limit_buckets` + `create or replace function public.rl_check`. (Migration list itself is a VPS-side concern; disk inspection covers what we can deterministically gate in CI.)
2. **RPC signature** — the migration text contains `rl_check(p_bucket text, p_ident text, p_limit_per_min int) returns jsonb` and `security definer`.
3. **Middleware imports the limiter** — `middleware.ts` imports `classifyRoute` and `RATE_LIMITS` from `@/lib/rate-limit/limits` and `rlCheck` from `@/lib/rate-limit/check`.
4. **All 4 route classes documented** — `lib/rate-limit/limits.ts` declares `RATE_LIMITS` with exactly four keys `auth`, `api_write`, `api_read`, `public_marketing`, each carrying the documented `perMin` numbers (10 / 30 / 120 / 240).
5. **Forbidden-token scan** — new TS files (`lib/rate-limit/*.ts`, modified `middleware.ts`) carry none of the M5/H1 forbidden-token literals (`email`, `phone`, `password`, `nid_number`, `trade_license_number`, `sbi_total`, `pillar_1`, `internal_score`, `verification_token`, `body_ciphertext`).
6. **Route count unchanged at 64** — `.next/routes-manifest.json` `staticRoutes` + `dynamicRoutes` length matches the H1 close-out total. H2 adds zero routes.

## Acceptance

- `pnpm typecheck` clean.
- `pnpm lint` clean.
- `pnpm build` green.
- `python ops/_h2_smoke.py` → 6/6 PASS.
- Route count = 64 (no change from H1).
- Migration `0044_rate_limit_buckets.sql` applied to Supabase Singapore project (`stnrfxrxfonwexzcvvpv`).
- One commit on `development`: `feat(security): ship Spec H2 rate limiting`.
