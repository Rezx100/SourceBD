# SourceBD — Progress Tracker

> Keep this short. One line per shipped spec. Detailed history lives in git.

## Current phase
**Phase 6 — Hardening & Launch Prep** (`context/phases.md` weeks 19–20).
Phase 0 data moat shipped. Phases 1–5 (foundation, buyer surface, supplier
portal, admin, marketing) shipped. Branch: `development`.

## Status
- Phase 6 specs: H1 ✅ · H2 ✅ · H3–H8 pending.
- Marketing homepage redesigned (Magic UI, light mode) and live at `/`.

## Shipped (most recent first)
- **Marketing homepage v2 — mobile + animation hardening pass** (in progress,
  branch `development`, not yet committed). Fixes: (1) mobile nav drawer was
  parked off-screen — Tailwind v3 `translate-x-0/full` only flip a CSS var,
  which browsers won't transition, so the slide is now driven by an inline
  `transform` (deterministic CSS transition, `inert` + scrim depth, no drop
  shadow). (2) Hamburger pinned far-right / logo far-left. (3) Hero search
  beam swapped from offset-path `BorderBeam` (fails on mobile, bi-directional)
  to a single-direction conic-gradient ring. (4) `AnimatedList` provenance
  feed looped continuously instead of freezing on the last row. (5) Hero
  `Globe` (cobe/WebGL) no longer mounts at width 0 when hidden < lg — a
  ResizeObserver gates creation/teardown, eliminating a `drawArrays` error
  loop that pinned the main thread and stalled page-wide CSS animations.
  Globe also restyled to a blended white dotted sphere. Build green 26/26.
- **Marketing homepage v2 (Magic UI light redesign)** — full rewrite of
  `app/(marketing)/page.tsx` + new `top-nav.tsx` / `footer.tsx` / `logo.tsx`.
  Hero with interactive `Globe` (BD→buyer markets), `BorderBeam` search,
  `AvatarCircles` (company initials) social proof; authority `Marquee`;
  live `NumberTicker` stats (`marketing_stats` RPC); three alternating
  feature sections — `AnimatedBeam` data pipeline (cert ⟶ SourceBD mark ⟵
  register, L-routing), `AnimatedList` provenance feed, `OrbitingCircles`
  trust ring; positioning cards; `TextHighlighter` CTA. New components under
  `components/marketing/home/` + Magic UI primitives in `components/ui/`.
  Shared SourceBD `BrandMark`/`ShieldGlyph` in `components/marketing/logo.tsx`.
  Old cinematic/M6 homepage + its orphaned components/helpers removed.
- **H2 — Rate limiting** — Postgres fixed-window limiter (no Redis);
  migration `0044`, `lib/rate-limit/*`, middleware gate.
- **H1 — Sentry + PostHog observability** — PII-scrubbed Sentry across all
  runtimes; PostHog anon + identified. `lib/sentry/pii-scrub.ts`,
  `lib/posthog/provider.tsx`.
- **M1–M6 — Marketing surface** — pricing, compliance education pages + SEO
  baseline, public discover demo mode, auth shell.
- **Phases 1–4** — design system, app shell, buyer discover/profile/messaging,
  supplier portal, admin. (See git history for per-spec detail.)

## Conventions (quick reference)
- Marketing surface: light mode, forest `#1f4d3a` as a signature only;
  fonts Archivo / Hanken Grotesk / IBM Plex Mono via `--mkt-font-*` on
  `[data-surface="marketing"]`. Magic UI for animation.
- Server enforces auth/ownership (`middleware.ts`); hiding UI is never a
  security control.
- Source-trust hierarchy is law (gov > association > cert > brand > sanctions
  > cross-check). No proprietary / "SBI" score shown in marketing copy.
- No Redis. Local Windows `pnpm build` ends in a harmless EPERM symlink at the
  standalone-copy step — treat "Compiled successfully" as the pass signal.

## Last updated
16 Jun 2026 — Marketing homepage v2 promoted to `/`; old homepage + stale
marketing components/helpers removed; tracker trimmed to minimal.
