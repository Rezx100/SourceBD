# SourceBD — Phases A→Z

> The full project roadmap. Each phase has an exit gate; do not cross until met. Specs live in `context/feature-specs/`.

---

## Phase 0 — Data Moat (BUILD FIRST · weeks 1–6)

**Why first**: The defensibility is the data, not the UI. A pretty SaaS with empty/wrong data dies; an ugly SaaS with the only verified Bangladesh supplier database wins.

**Deliverables**:
- Supabase project provisioned (Singapore region), schema migrated.
- Python ETL workspace with parsers for: BGMEA buying houses, BGMEA factory register, BKMEA, BTMA, BGAPMEA, RSC, EPB exporter list, WRAP, OEKO-TEX, GOTS, H&M / Inditex / Primark / ASOS / M&S / Next supplier disclosures, UFLPA Entity List, US CBP WRO list.
- Cross-source dedup + merge engine (multi-pass: slug → email → phone → fuzzy name → address).
- SBI score calculator (idempotent, unit-tested).
- Sanctions screening (every supplier flagged on UFLPA/WRO → score = 0).
- All raw fetches cached in `etl/raw/` (gitignored).
- Nightly Inngest jobs: re-screen sanctions + recompute scores.

**Exit gate**:
- ≥ 2,000 suppliers in production DB.
- ≥ 1,500 factories cross-checked vs RSC.
- 100% suppliers sanctions-screened.
- ≥ 90% have computed SBI scores.
- Every published supplier has ≥1 Tier 1–3 source record.
- All ETL scripts are re-runnable without producing duplicates.

---

## Phase 1 — Foundation App (weeks 7–10)

Three foundation specs (per master tutorial), in this order:

**Spec F1 — Design system**
- Next.js 15 App Router + TypeScript strict + Tailwind + shadcn/ui + Phosphor.
- Tokens wired from `frontend-design-spec.md` into `tailwind.config.ts` + `globals.css`.
- `cn()` helper, base components (Button, Card, Tabs, Tag, Badge, **Receipts Ring SVG** — per `frontend-design-spec.md`, payload is the count of distinct Tier 1–3 sources, NEVER the SBI numeric total).
- Storybook-style `/dev/components` route gated to dev only.

**Spec F2 — App shell**
- Sidebar + topbar + layout per v4 mockup.
- Route groups: `(marketing)`, `(app)/app`, `(app)/supplier`, `(app)/admin`.
- Health check `GET /api/health`.
- Error boundaries + 404 + 500 pages styled.

**Spec F3 — Auth**
- Supabase Auth: email/password + magic link.
- Three roles: `buyer`, `supplier`, `admin` (stored on `profiles` table).
- Middleware-protected routes; public allow-list for `(marketing)/*`, `/discover` (limited), `/suppliers/[slug]` (blurred contacts).
- Session helper, sign-out redirect, password reset flow.

**Exit gate**: Three roles can sign in/out; protected routes redirect; public Discover loads supplier data with contacts blurred.

---

## Phase 2 — Buyer App MVP (weeks 11–14)

Specs (one per session):
- B1 — Discover page (filters: entity type, category, **source-count tier** (≥1 / ≥2 / ≥3 Tier 1–3 sources), certs, RSC remediation %, location; FTS + trigram search; results card list with the Receipts Ring per `frontend-design-spec.md`. **Default server-side sort uses the internal SBI total descending; the value itself is never serialised to the client**, only the resulting row order — see `ai-workflow-rules.md` Hard Prohibitions).
- B2 — Factory profile (5 tabs: Overview, Compliance, Media, Reviews, Contact — gated).
- B3 — Buying-house profile (5 tabs incl. Partner Factories tab using `bh_factory_relationships`).
- B4 — Smart Match wizard (3-step form → POST `/api/v1/match` → ranked results with "why matched").
- B5 — Saved suppliers + dashboard (recent activity, alerts, saved list).
- B6 — Messages (Supabase Realtime; thread per RFQ; 256-bit-encrypted-at-rest copy).
- B7 — RFQ Manager (create RFQ → distribute to N suppliers → track responses).
- B8 — Order Tracking (manual entry of milestones; freight info; later: Maersk/MSC API integration v2).
- B9 — Compliance Hub (UK MSA generator, UFLPA traceability tracker, certification expiry dashboard).
- B10 — Settings (account, plan, notification preferences).

**Exit gate**: A buyer can sign up → Smart Match → open profile → send RFQ → receive supplier reply → save + track.

---

## Phase 3 — Supplier Portal (weeks 15–16)

- S1 — Claim flow (`/supplier/claim` → search company → email verification → admin approval).
- S2 — Supplier dashboard (profile completion %, evidence-receipt density (counts per tier), incoming RFQs). **The internal SBI score is NOT shown** (per α/β/γ decision, 2026-05-20) — suppliers cannot see a number that buyers cannot see; gaming risk + parity rule. If suppliers ask "what's my score?" the dashboard shows "You have X registers, Y active certs, Z RSC documents — buyers see these receipts directly".
- S3 — Profile editor (contact, photos, videos, certs upload to private bucket).
- S4 — RFQ inbox (respond, attach quotation PDF).
- S5 — Factory ↔ Buying-house relationship management.

**Exit gate**: A buying house can claim, complete profile, link partner factories, respond to a buyer RFQ end-to-end.

---

## Phase 4 — Admin Panel (week 17)

- A1 — Admin dashboard (platform stats: users, suppliers, RFQs, MRR).
- A2 — Supplier CRUD + bulk CSV import + score recalc trigger.
- A3 — Certification verification queue (review supplier-uploaded certs).
- A4 — Sanctions queue (review auto-flagged suppliers).
- A5 — User management (role switching, account suspension, audit log view).
- A6 — Append-only `admin_audit_log` viewer.

**Exit gate**: Admin can run platform without engineering involvement.

---

## Phase 5 — Marketing Site + Pricing (week 18)

- M1 — Landing page (hero, live counter, **"How we verify" methodology** (source trust hierarchy + per-factory authenticity rule + receipts-first posture — no scoring formula in copy, no word "score" in headlines), trust logos, founder story).
- M2 — Pricing page (free-beta messaging, "Pricing coming after public beta"). **Stripe checkout deferred to a post-beta phase** — see "Deferred until post-beta" at the bottom of this file.
- M3 — Compliance education pages (UK MSA, UFLPA — SEO targets).
- M4 — Blog scaffold + 3 launch posts.
- M5 — Public Discover demo mode (blurred contacts, "Sign up free" CTA on profile).

**Exit gate**: A cold visitor can land → understand value → sign up free → use the app within 5 minutes.

---

## Phase 6 — Hardening & Launch Prep (weeks 19–20)

- H1 — Sentry + PostHog wired.
- H2 — Rate limiting on all public + auth routes.
- H3 — Stripe webhooks (subscription lifecycle, invoice failures). *Note: shipped as a hardened idempotent recorder; live-mode cutover is deferred (see "Deferred until post-beta").*
- H4 — Resend email templates (welcome, RFQ received, cert expiry, sanction alert, password reset).
- H5 — In-app onboarding tour (5 steps).
- H6 — Polishing pass per `current-issues.md` — keyboard, mobile viewport, empty/error/loading states, race conditions, a11y, default privacy on storage.
- H7 — Trademark + legal: ICO registration, UK GDPR Representative appointed, UKIPO + USPTO trademark filed, T&Cs + Privacy + Cookie + Data Source Policy pages live.
- H8 — Backup + restore drill on Supabase.

**Exit gate**: Penetration test (or self-assessment against OWASP Top 10) passes; load test handles 100 concurrent buyers; all legal pages live.

---

## Phase 7 — Public Beta launch (online-first, free tier)

Free, online-only public beta. No trade-show attendance, no paid tiers, no billing. The product runs at zero price for as long as it takes to validate product-market fit; monetisation is a future phase triggered by usage signals, not a calendar event.

- P1 — Production VPS deploy (Docker + Caddy + Supabase prod) on the SourceBD VPS (`109.104.153.228`). Site live at the bare IP until DNS lands; enterprise-grade responsive sweep across 360 → 2560 px.
- P2 — Public status page (`/status`) reading live freshness signals (DB head, last ETL run, sanctions-screen freshness, RSC mirror freshness) so beta users have a public artefact when something breaks.
- P3 — In-app feedback loop (`?` hotkey opens a slide-over → `feedback_reports` table → admin queue).
- P4 — Founder analytics dashboard (admin-only `/admin/beta`): signup → first-supplier-view → first-RFQ funnel; top-20 viewed suppliers; cadence health. Read-only views over existing tables, no new ETL.

**Exit gate**:
1. Platform live on production domain with real Phase-0 data (≥10,000 suppliers indexed; current state on tracker).
2. Public status page + in-app feedback loop operational.
3. Founder analytics dashboard showing the signup → first-RFQ funnel end-to-end.
4. **30 consecutive days of zero P1/P2 Sentry incidents.**

---

## Phase 8 — v2 Roadmap (post-beta, parking lot)

- Public review system UI.
- Dark mode.
- Mobile apps (Expo).
- Maersk/MSC freight API integration (replace manual tracking).
- AI-assisted RFQ parsing (extract spec from buyer's natural language).
- Self-serve API for enterprise customers.
- Localisation (UK English → US English → German → French).
- Tier-1 supplier onboarding for India / Vietnam (geographic expansion).
- Sedex/SLCP integration.

---

## Deferred until post-beta

The following items have been **explicitly deprioritised** by founder decision on 3 Jun 2026 in favour of a free, online-first public beta of indefinite duration. They are **not on the roadmap** and **must not be surfaced as todo items in any future planning pass** without an explicit business trigger (e.g. paid-conversion demand evidence, regulator request, sales-led RFP).

- **Stripe live mode** (GBP + USD), pricing checkout, billing portal, plan-tier enforcement, invoice templates. The H3 idempotent webhook recorder is retained in the codebase as harmless infrastructure; no live keys, no checkout flow.
- **Trade-show attendance** — Source Fashion London (July 2026) and SOURCING at MAGIC Las Vegas (August 2026) are both **off the roadmap permanently**. The platform proves itself online before any in-person motion.
- **Lead-capture / UTM attribution** flows (booth `?ref=` tagging, QR-optimised signup).
- **48-hour Resend transactional cadence** (T+0 / T+24h / T+48h sequence).
- **Demo seed fixtures** (`demo@sourcebd.net` pre-loaded with synthetic RFQs / orders / threads).
- **k6 / locust 100-concurrent load re-run** as a documented runbook artefact.
- **Supplier outreach pack** (per-supplier shareable preview links + claim-flow shortcut).

**Trigger to revisit**: a separate spec must be authored, with the business trigger named in §1, before any of the above is reintroduced. Don't repropose them on cadence reviews.

---

## Cross-cutting principles (apply in every phase)

1. **Data quality over feature count.** A wrong supplier kills more trust than a missing feature.
2. **Every UI element that shows a supplier shows the Receipts Ring** (source-count payload per `frontend-design-spec.md`). Brand consistency. **Never render the SBI numeric total in any user-facing surface** (α/β/γ decision, 2026-05-20 — see `ai-workflow-rules.md` Hard Prohibitions).
3. **Every gated value is also gated server-side.** Hiding in CSS = vulnerability. The SBI integer is gated by RLS on `public.sbi_scores` (admin-only); CSS-hiding it is not a control.
4. **Every spec ships behind a feature flag** (env var or DB row) until QA passes.
5. **No spec ships without unit tests for business logic** (scoring, matching, dedup, sanctions). The SBI calculator stays unit-tested even though its output never reaches the user — it still drives default sort + admin alerting.
6. **Every external scraper respects robots.txt + rate limits + identifies itself.**
7. **Receipts, not opinions.** SourceBD shows third-party-issued facts (cert badges, register links, RSC %, sanctions hits, brand disclosures attributed to the specific brand). Where SourceBD's own opinion would otherwise appear (rankings, alerts, internal tier labels), it is computed server-side and consumed server-side — never published as a SourceBD-issued number. This is the marketplace-vs-rater boundary (α/β/γ decision).
