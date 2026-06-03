# Spec P1 — Production VPS deploy (free public beta launch)

**Phase**: 7 — Public Beta launch (online-first, free tier)
**Status**: in progress
**Author target**: 3 Jun 2026

## 1. Why

Phase 6 hardening (H1–H8) shipped. The platform is feature-complete for a free
public beta but has never been deployed to its production VPS as a Next.js
web service — the existing `docker-compose.yml` ships only the `etl` worker.
This spec stands up the web container on `109.104.153.228`, fronts it with
Caddy, and runs an enterprise-grade responsive sweep so every shipped surface
behaves at 360 px → 2560 px before the first beta user lands. No Stripe, no
paid tiers, no trade-show timeline — see `phases.md` → "Deferred until
post-beta".

## 2. Out of scope (Hard NOs)

- **No Stripe live mode.** The existing H3 webhook recorder stays as harmless
  infrastructure; the route must **graceful no-op** when `STRIPE_WEBHOOK_SECRET`
  is unset, not 500.
- **No new tools, no new deps.** Caddy is already named in `architecture.md`
  (lines 27, 30). Supabase CLI is NOT installed on the VPS by this spec — the
  established migration pattern is psycopg via the etl container per
  `progress-tracker.md` precedent.
- **No domain / HTTPS.** DNS lands tomorrow. P1 serves plain HTTP on
  `109.104.153.228:80`. Caddy stays in HTTP-only mode until the CNAME is
  visible.
- **No pixelsport VPS access.** `37.49.227.151` is off-limits per
  `/memories/access-boundaries.md`.

## 3. Deliverables

### 3.1 Next.js standalone output

- `next.config.ts` gets `output: 'standalone'` so the production image can ship
  without `node_modules`.
- `next.config.ts` gets `pageExtensions` filtered by `NODE_ENV` so the
  `*.dev.tsx` extension is registered only in development — keeps the
  production routes-manifest at the H8 baseline of 68.

### 3.2 Mobile viewport baseline

- `app/layout.tsx` gains a Next 15 `viewport` export
  (`width: 'device-width', initialScale: 1, viewportFit: 'cover'`). Without it
  mobile Safari renders the site at desktop width and every other responsive
  fix is wasted. This is the single most impactful one-line fix in the spec.

### 3.3 Stripe webhook graceful no-op

- `app/api/stripe/webhook/route.ts` returns **200** with
  `{disabled: true}` when `STRIPE_WEBHOOK_SECRET` or `STRIPE_SECRET_KEY` is
  unset, instead of the previous 500. A random scanner POSTing to
  `/api/stripe/webhook` during beta gets a clean response; Stripe is not
  configured during the free beta so the route is intentionally dormant.

### 3.4 Web Docker image

- New `Dockerfile.web` — three-stage build (deps → build → runner). Final
  stage runs as a non-root `nextjs:nodejs` user, exposes 3000, and ships a
  `HEALTHCHECK` against `/api/health`. Base: `node:20-alpine`.

### 3.5 Compose extension

- `docker-compose.yml` extended with a `web` service that builds from
  `Dockerfile.web`, reads `.env`, restarts unless stopped, binds the host
  port `127.0.0.1:3000` (Caddy fronts it externally).

### 3.6 Caddy reverse proxy

- New `ops/Caddyfile` — HTTP-only on `:80`, `reverse_proxy 127.0.0.1:3000`,
  health-check probe against the app's `/api/health`, sane gzip + access
  log. Domain cutover is one `Caddyfile` edit later (`sourcebd.com {`).

### 3.7 Deploy script

- New `ops/deploy_vps.sh` — pulls latest `development`, builds the
  `sourcebd-web:latest` image, optionally applies any new Supabase migration
  via the existing psycopg pattern (`--with-migrations` flag, default OFF
  because migrations 0001 → 0047 are already in the production project),
  brings the web container up, reloads Caddy, prints the health-check.
  Idempotent — safe to re-run.

### 3.8 Env contract

- New `ops/deploy/README.md` — every var from `.env.example` mapped to its
  production source (Supabase dashboard, Resend dashboard, Sentry, PostHog,
  Bunny). Names what is required vs optional for the free beta. Calls out
  that Stripe and ICO/UK-GDPR-rep vars are unset on purpose.

### 3.9 Responsive QA aid

- New `lib/responsive/breakpoints.ts` — locked constants
  `[360, 414, 768, 1024, 1280, 1440, 1920, 2560]` (`RESPONSIVE_WIDTHS`),
  consumed by the QA page. Constants live in `lib/` so any future component
  audit can reuse the same canonical list.
- New `app/(dev)/responsive-grid/page.dev.tsx` — dev-only matrix that
  iframes a chosen route at every locked width. Triple-gated: file
  extension excluded from production builds (so the route doesn't appear in
  `routes-manifest.json`), `NODE_ENV === 'production'` runtime guard, admin
  role check. URL: `/responsive-grid?path=/discover`.

### 3.10 Enterprise responsive contract

Sweep every shipped page against this checklist; fix violations as part of
this spec; document anything that needed a fix in §6 below.

- No horizontal scroll at 360 px wide.
- All interactive targets ≥ 44×44 px on touch viewports.
- Tables collapse to card stacks below 768 px (Discover, RFQ list, Orders,
  Messages list, admin tables).
- Sidebar collapses to a hamburger / bottom-nav below 1024 px in
  `(app)` route groups.
- Hero / landing typography uses `clamp()`.
- All images use `next/image` with `sizes` set; no raw `<img>`.
- 4K (2560+) does not stretch reading columns beyond `max-w-prose` or
  shells beyond `max-w-7xl`.

### 3.11 Smoke

- New `ops/_p1_smoke.py` — 8 checks, disk-only (no network):
  1. `Dockerfile.web` exists + declares a non-root user + has `HEALTHCHECK`.
  2. `ops/Caddyfile` exists + `reverse_proxy 127.0.0.1:3000`.
  3. `ops/deploy_vps.sh` exists + is executable on Unix (mode bit) +
     references `Dockerfile.web` and the `web` compose service.
  4. `next.config.ts` has `output: 'standalone'`.
  5. `lib/responsive/breakpoints.ts` exists + exports `RESPONSIVE_WIDTHS`
     containing the 8 canonical widths.
  6. `app/api/stripe/webhook/route.ts` contains the missing-secret guard
     and the literal `"disabled"` token (proves no-op path exists).
  7. Forbidden-token scan over every file the spec creates / edits.
  8. `.next/routes-manifest.json` route count is exactly 68 (the
     responsive-grid page is dev-extension-filtered so production routes
     do not increase).

## 4. Constraints

- SSH discipline per `/memories/scraping-ops.md` — sequential single-shot
  `ssh.exe -i $env:USERPROFILE\.ssh\sourcebd_vps -o BatchMode=yes -n
  root@109.104.153.228 '<cmd>'`. Chain remote shell via `scp` of a `.sh`
  file. Never `&&`-chain inside quoted ssh.
- Production Supabase project: `stnrfxrxfonwexzcvvpv` (Singapore). Live
  data, do not nuke. Migrations are already in sync from the
  per-migration apply pattern — only run `--with-migrations` when shipping
  a NEW migration.
- Operator pastes secrets directly into the VPS `.env` over ssh. Never
  commit. The deploy script does not echo secrets to logs.

## 5. Workflow

1. Mark in-progress in `progress-tracker.md` (Current goal + In progress).
2. Apply 3.1 → 3.10.
3. Validate locally: `pnpm typecheck && pnpm lint && pnpm build && python
   ops/_p1_smoke.py`. `docker compose build web && docker compose up web`,
   hit `http://localhost:3000/api/health`.
4. Sequential ssh deploy: `scp` `deploy_vps.sh` + `Caddyfile` + a one-shot
   bootstrap `.sh`, then run `bash /tmp/deploy_vps.sh` inside
   `tmux new-session -d -s p1_deploy`. Tail the log via separate
   single-shot ssh.
5. From local: `curl http://109.104.153.228/api/health` returns 200 with
   `{"status":"ok",...}`.
6. Close out tracker — Last updated + decisions log.

## 6. Architectural decisions (filled in at close)

_Logged in `progress-tracker.md` at close. Decisions log captures: the
responsive fixes that needed real code changes, the migration-deferral
posture, the pageExtensions trick that keeps the production route count
at 68, the graceful Stripe no-op rationale, and the Caddy HTTP-only
posture pending DNS._
