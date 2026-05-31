# Spec H1 — Sentry + PostHog observability wiring

> First Phase-6 spec per [phases.md](../phases.md) line 118: **"H1 — Sentry + PostHog wired."**

## Goal

Stand up production observability so Phase 7 (Source Fashion London beta) ships with crash visibility and product analytics. Two SDKs, three Next.js runtimes, zero PII, zero new architectural surface.

## Out of scope

- Rate limiting (H2), Stripe webhooks (H3), Resend templates (H4), onboarding tour (H5), polishing pass (H6), legal pages (H7), backup drill (H8).
- Custom event taxonomy beyond autocapture + a single `identify()` call. A later spec can define semantic events.
- Session replay. Privacy-first; revisit only after a data-protection review.
- Server-side PostHog. PostHog ships browser-only here; server crashes go to Sentry.
- New RPCs, new migrations, new tables, new env outside the keys listed below.

## Hard rules carried forward

1. Source trust hierarchy is unchanged. SDKs read no DB rows.
2. SBI numeric values are forbidden in any payload — capture allow-lists must not contain `sbi_*`, `pillar_*`, `internal_score`, `supplier_score_internal`.
3. Register PII (`email_primary`, `phones`, `contact_name`, `contact_role`, `nid_number`, `trade_license_number`, `proprietor_nid`, `owner_phone`) and signup PII (`email`, `phone`) MUST be scrubbed from every Sentry event and never captured by PostHog autocapture.
4. No new tools beyond `@sentry/nextjs` and `posthog-js` — both are listed in [architecture.md](../architecture.md) `Error tracking: Sentry` + `Analytics: PostHog`.

## Scope

### A. Sentry (server + edge + client)

- `instrumentation.ts` at repo root registers `sentry.server.config.ts` (when `runtime === 'nodejs'`) and `sentry.edge.config.ts` (when `runtime === 'edge'`).
- `instrumentation-client.ts` at repo root initialises the browser SDK (Next 15 convention; replaces the deprecated `sentry.client.config.ts`).
- Every `Sentry.init({…})` call passes `dsn: process.env.SENTRY_DSN`. When unset, Sentry no-ops silently.
- Every `Sentry.init` call wires `beforeSend` and `beforeSendTransaction` through a shared scrubber `lib/sentry/pii-scrub.ts` that:
  - Drops the event entirely if `event.request.cookies` or `event.request.headers.authorization` is present.
  - Recursively walks `event.{request, contexts, extra, tags, breadcrumbs[].data, exception.values[*].stacktrace.frames[*].vars}` and redacts any string-keyed entry whose key matches the **forbidden-token set** (case-insensitive): `email`, `phone`, `nid_number`, `proprietor_nid`, `owner_phone`, `trade_license_number`, `email_primary`, `phones`, `contact_name`, `contact_role`, `password`, `verification_token`, `body_ciphertext`, `sbi`, `pillar_*`, `internal_score`, `supplier_score_internal`. Redaction value: the literal string `"[scrubbed]"`.
  - Drops query-string values from `event.request.query_string` whose key matches the forbidden set.
- Source-map upload at build time via `withSentryConfig` in `next.config.ts`. Plugin options: `org: process.env.SENTRY_ORG`, `project: process.env.SENTRY_PROJECT`, `authToken: process.env.SENTRY_AUTH_TOKEN`, `silent: true`, `widenClientFileUpload: true`, `disableLogger: true`. When `SENTRY_AUTH_TOKEN` is unset the plugin builds source maps but skips upload — `pnpm build` stays green in dev / preview.

### B. PostHog (browser-only)

- `lib/posthog/provider.tsx` — `'use client'` provider that calls `posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST, autocapture: true, capture_pageview: true, disable_session_recording: true, capture_performance: false, person_profiles: 'identified_only', mask_all_text: false, mask_all_element_attributes: false, sanitize_properties: <forbidden-key stripper>})` exactly once per page lifecycle. When the env keys are unset, `init` is skipped and the provider becomes a pass-through.
- `sanitize_properties` is a callback PostHog runs on every captured event. It walks the properties object and deletes keys matching the same forbidden-token set above. Belt-and-braces against autocapture grabbing an `<input name="email">` value.
- Provider mounts in `app/(marketing)/layout.tsx` and `app/(app)/layout.tsx`. The `(app)` mount is passed a `userId` prop (server-fetched via `supabase.auth.getUser()`) and the provider calls `posthog.identify(userId)` in a `useEffect` keyed on `userId`. Never identifies by email.
- No mount in `app/(auth)/layout.tsx` (anonymous login / signup pages) and no mount in `app/layout.tsx` (root layout is shared with auth / suspended / error / not-found — would force PostHog onto pages that should stay quiet).

### C. Env

`.env.example` documents (no values, mirror keys only):

- `SENTRY_DSN` — server + edge + client.
- `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` — source-map upload only; unset = upload skipped.
- `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` — browser SDK only.

`SENTRY_DSN` is NOT prefixed `NEXT_PUBLIC_` — the SDK reads it at build time and inlines it into the client bundle automatically via `withSentryConfig`. This matches Sentry's own documented Next.js pattern and avoids a parallel `NEXT_PUBLIC_SENTRY_DSN` knob.

### D. Smoke

`ops/_h1_smoke.py` — disk-based, 6 checks:

1. **SDK presence** — `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `lib/sentry/pii-scrub.ts`, `lib/posthog/provider.tsx` all exist and each `Sentry.init` / `posthog.init` callsite is wired to the expected env key.
2. **Layout mounts** — `app/(marketing)/layout.tsx` and `app/(app)/layout.tsx` both import and render `PostHogProvider`. `app/(auth)/layout.tsx` does NOT.
3. **PII forbidden-token scan** — all new files (sentry / posthog / instrumentation) are grepped for the forbidden-token set; any literal occurrence (other than inside the scrubber's own allow-list) is a fail. Same regex set the M5 smoke uses, extended with `email`, `phone`, `password`, `verification_token`, `body_ciphertext`.
4. **Env keys documented** — `.env.example` contains `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (key presence only; values still blank).
5. **Build still green** — `.next/BUILD_ID` exists and is non-empty.
6. **Route count unchanged** — `.next/routes-manifest.json` `staticRoutes` + `dynamicRoutes` length matches the M5 close-out total (83). H1 adds zero routes.

### E. M5 parked follow-up (separate `chore` commit)

`components/marketing/top-nav.tsx` anonymous variant: `Sign in` link href `/auth/sign-in` → `/login`. The route `/auth/sign-in` does not exist; `/login` is the real route (under `app/(auth)/login/page.tsx`). One-line fix. Shipped as a `chore` commit immediately after the H1 commit on the same `development` push so the H1 spec stays single-concern.

## Acceptance

- `pnpm typecheck` clean.
- `pnpm lint` clean.
- `pnpm build` green; build output references `withSentryConfig` and emits the standard Sentry source-map step.
- `python ops/_h1_smoke.py` → 6/6 PASS.
- Route count = 83 (no change from M5).
- Two commits on `development`: `feat(observability): ship Spec H1 Sentry + PostHog` and `chore(marketing): fix top-nav sign-in href to /login`.
