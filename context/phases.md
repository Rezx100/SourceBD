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
- Tokens wired from `ui-context.md` into `tailwind.config.ts` + `globals.css`.
- `cn()` helper, base components (Button, Card, Tabs, Tag, Badge, Score Ring SVG).
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
- B1 — Discover page (filters: entity type, category, SBI grade, certs, location; FTS + trigram search; results card list with score rings).
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
- S2 — Supplier dashboard (SBI score, profile completion %, incoming RFQs).
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

- M1 — Landing page (hero, live counter, SBI methodology, trust logos, founder story).
- M2 — Pricing page (Starter / Growth / Enterprise) + Stripe checkout.
- M3 — Compliance education pages (UK MSA, UFLPA — SEO targets).
- M4 — Blog scaffold + 3 launch posts.
- M5 — Public Discover demo mode (blurred contacts, "Sign up free" CTA on profile).

**Exit gate**: A cold visitor can land → understand value → sign up → pay → use the app within 5 minutes.

---

## Phase 6 — Hardening & Launch Prep (weeks 19–20)

- H1 — Sentry + PostHog wired.
- H2 — Rate limiting on all public + auth routes.
- H3 — Stripe webhooks (subscription lifecycle, invoice failures).
- H4 — Resend email templates (welcome, RFQ received, cert expiry, sanction alert, password reset).
- H5 — In-app onboarding tour (5 steps).
- H6 — Polishing pass per `current-issues.md` — keyboard, mobile viewport, empty/error/loading states, race conditions, a11y, default privacy on storage.
- H7 — Trademark + legal: ICO registration, UK GDPR Representative appointed, UKIPO + USPTO trademark filed, T&Cs + Privacy + Cookie + Data Source Policy pages live.
- H8 — Backup + restore drill on Supabase.

**Exit gate**: Penetration test (or self-assessment against OWASP Top 10) passes; load test handles 100 concurrent buyers; all legal pages live.

---

## Phase 7 — Public Beta + Source Fashion London (Jul 7–9, 2026)

- Pre-event: 500+ suppliers indexed, demo URL live, booth + speaker slot booked.
- LinkedIn pipeline: 200+ sourcing-director connections.
- Live demo at booth.
- 48-hour follow-up cadence on every lead.
- Target: 40–80 UK buyer signups.

---

## Phase 8 — SOURCING at MAGIC Las Vegas (Aug 10–12, 2026)

- US-market positioning: UFLPA traceability as primary hook.
- Stripe USD pricing live.
- On-the-spot signup flow tested.
- Target: 40–80 US buyer signups.

---

## Phase 9 — v2 Roadmap (post-launch, parking lot)

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

## Cross-cutting principles (apply in every phase)

1. **Data quality over feature count.** A wrong supplier kills more trust than a missing feature.
2. **Every UI element that shows a supplier shows the score ring.** Brand consistency.
3. **Every gated value is also gated server-side.** Hiding in CSS = vulnerability.
4. **Every spec ships behind a feature flag** (env var or DB row) until QA passes.
5. **No spec ships without unit tests for business logic** (scoring, matching, dedup, sanctions).
6. **Every external scraper respects robots.txt + rate limits + identifies itself.**
