# Spec M2 — Marketing pricing page

Second Phase-5 spec (M1 → **M2** → M3 → M4 → M5; per `context/phases.md`
line 102). Ships the public pricing page at `/pricing`, introduces the
marketing top-nav (per M1 architectural decision #14), and expands the
footer to accommodate a two-page marketing surface. **No live Stripe
checkout** in this spec (deferred per B10 decision #6 + Phase 6 H3 —
Stripe webhooks track subscription lifecycle and that wiring is a
hardening-phase concern). All CTAs route to `/signup` (or a contact
mailto for Enterprise). Pricing copy is **display-only**.

---

## Hard constraints (re-read before writing copy)

1. **SBI doctrine — `α now, β later, γ never`.** No numeric SBI on any
   public surface. No word "score" / "rating" / "ranking" / A-D grade
   in headlines, CTAs, plan names, feature rows, or FAQ answers.
2. **Receipts-first vocabulary.** Feature rows describe what a buyer
   can *see* (registers, certifications, RSC remediation %, mirrored
   compliance documents, source-pill provenance) — never an opinion
   issued by SourceBD.
3. **Plan-tier vocabulary is already locked at the DB level**
   (migration `0031_buyer_settings.sql`, B10): the `profiles.plan_tier`
   CHECK constraint allows exactly `{starter, growth, enterprise}`.
   M2 must use these three identifiers verbatim. Display labels
   "Starter" / "Growth" / "Enterprise" mirror `/app/settings/plan`.
4. **Per-factory authenticity rule applies to brand wordmarks** in
   any "trust strip" / logo wall (`logos.lock.md` §3 Tier 4 header
   verbatim, §5 rule #3 — brand wordmarks are typography only).
   **Recommendation: no trust-sources strip on `/pricing`** — keep the
   strip on `/` only, where it sits next to the methodology section
   that earns it.
5. **No new tools.** Existing Next.js 15 App Router + Tailwind +
   Phosphor SSR + hand-rolled shadcn primitives + Supabase server
   client. **No Stripe SDK / no `@stripe/*` packages.** When Stripe
   lands (H3) it gets its own spec + architecture amendment if needed.
6. **No new DB tables, no new migration.** Pricing copy is a TS
   constant. (See JC #11 — locked recommendation.)
7. **Robots / SEO (Lock #1 from M1).** `metadata.robots = { index:
   true, follow: true }`, `metadata.openGraph = { …, locale: 'en_GB',
   type: 'website' }`, `metadata.alternates.canonical` resolved from
   the same `NEXT_PUBLIC_SITE_URL` env var as M1. No OG image
   (deferred to M4).
8. **Accessibility (Lock #2 from M1).** Exactly one `<h1>` on the
   page; `<h2>` per section; `<h3>` per plan card / FAQ question;
   currency-switch radio group (if shipped — see JC #7) needs
   `aria-label`; comparison-table cells with checkmarks/dashes carry
   `aria-label` ("Included" / "Not included"); `pnpm build` a11y
   warnings = zero.
9. **Top-nav is a new shared surface.** Adds blast radius beyond a
   single page; the smoke covers `/` AND `/pricing` AND
   `/legal/trademarks` rendering the same nav (logged-out variant)
   and authed users (if seeded) seeing the logged-in variant
   (CTA → `/app` instead of `/signup`).

---

## Open judgement calls (need acks before implementation)

> **Convention:** each JC carries (a) the recommended default and (b)
> the alternatives. **Reply with `ack JC#1 = A`** etc. or override.
> No implementation work starts until every JC is acked.

### JC #1 — Plan prices (numbers + currency)

**Phases.md line 102** locks tier *names* but not numbers. Pricing
page needs an actual headline price per card.

- **Recommended (A): placeholder pricing for v1.** Starter `Free`,
  Growth `£<TBD> / month`, Enterprise `Contact for quote`. Render the
  numbers as `<!-- launch marker: price -->` HTML comments wrapping
  the dollar/pound figures so the placeholder is greppable and the
  smoke can assert the marker is still present (forces an
  intentional pre-launch swap). Recommended numbers anchored to the
  UK MSA bullseye (`£36M+ companies`, per
  `project-overview.md` § Audience): Starter £0, Growth £149/mo,
  Enterprise from £499/mo (custom). Locked when founder signs off.
- (B) Real, final numbers committed today. Requires founder pricing
  decision in this session.
- (C) No numbers at all — every card says "Contact sales for
  pricing". Loses the buyer-self-serve story.

### JC #2 — Billing cadence

- **Recommended (A): monthly only, with a "Pay annually, save 2 months"
  micro-copy under each price as a Phase-6 promise**. No toggle in
  v1 because the toggle implies a working Stripe integration; we
  don't have one. When H3 lands, the toggle ships then.
- (B) Monthly + annual toggle (UI only, both prices displayed). Adds
  a `'use client'` island for the toggle; risks looking broken when
  the buyer realises neither price is actionable.
- (C) Annual only. Out of step with SaaS norms; reduces signup
  conversion.

### JC #3 — Free trial vs freemium

**`project-overview.md` § Core user flow** says "Signs up (14-day
free trial)". B10 plan page has Starter as a real tier in
`profiles.plan_tier`. The two are reconcilable if:

- **Recommended (A): Starter is a free-forever tier with hard limits
  (50 supplier views / month, no contact reveal); Growth & Enterprise
  start with a 14-day free trial that downgrades to Starter on day 15
  unless the buyer adds payment.** Pricing page says "Free, no card
  required" on Starter, "14-day free trial" on Growth, "Custom
  pricing" on Enterprise. This matches B10's feature matrix already
  in production (Starter has Discover-up-to-50 etc.).
- (B) 14-day trial on the whole product, no free tier. Forces Starter
  out of `profiles.plan_tier` — schema change required, B10 ripple.
- (C) Freemium with no trial. Forces buyers to commit before
  experiencing paid features; conversion drag.

### JC #4 — Stripe vs manual invoicing for v1

- **Recommended (A): No Stripe in v1. CTAs route to `/signup` for
  Starter & Growth and to `mailto:sales@sourcebd.com` (or a
  `/contact` page if you'd prefer — see JC #5) for Enterprise.**
  Live Stripe ships in H3 (Phase 6 Hardening), where the webhook
  surface, subscription lifecycle, and dunning are wired in one
  cohesive spec. Manual invoicing for Enterprise is the founder's
  email until then. This matches B10 decision #6 already in
  production (B10 plan page disables "Manage plan" with explicit
  copy "Billing portal opens with Stripe in a later spec").
- (B) Ship Stripe Checkout v1 in M2. Requires: `@stripe/stripe-js` +
  Stripe SDK on server, webhook endpoint, `subscriptions` table,
  `current_period_end` column on `profiles`, env var management,
  Stripe-test-vs-live key handling. This is at least a one-week spec
  on its own; collapses M2 + H3 in a way that loses the discipline.
- (C) Manual invoicing globally (no Stripe, ever, even after H3).
  Misses the project-overview goal.

### JC #5 — Enterprise CTA target

- **Recommended (A): `mailto:sales@sourcebd.com` link, no in-app
  page.** Lowest blast radius, no new route. Email address needs to
  exist before launch (founder action item — out of scope for code).
- (B) New `/contact` server page with a simple Resend-powered form.
  Adds a new API route, a Resend send path, rate-limiting concern.
  Defer to M3 or M4.
- (C) Same `/signup` flow as other tiers, with `?plan=enterprise`
  query string and a "We'll be in touch about Enterprise terms"
  post-signup email. Smoother UX, but requires a new email template
  + an Inngest job to alert founder.

### JC #6 — Pricing FAQ section

- **Recommended (A): yes, 5–7 Q&As at the bottom of `/pricing` in
  a `<details>`/`<summary>` accordion (server component, no client
  JS).** Anchors: What's the difference between Starter and Growth?
  · How does the trial work? · What if I exceed my supplier-view
  limit? · Is my data exported on cancellation? · Where is my data
  stored? (Supabase Singapore + UK MSA residency note) · Do you
  charge per seat? · What is "contact reveal"? Smoke asserts the
  FAQ block has ≥5 `<details>` elements.
- (B) Defer FAQ to a dedicated `/faq` route in M3. Cleaner separation
  but pushes operational questions one click further from the buy
  decision.
- (C) No FAQ. Loses an SEO surface and a known-conversion lever.

### JC #7 — Currency display (GBP / USD / EUR)

UK launch (Source Fashion London Jul 2026) + US launch (MAGIC Vegas
Aug 2026) per `project-overview.md` § Goals.

- **Recommended (A): GBP-only at launch, with a single line under the
  price strip — "Prices shown in GBP. USD and EUR pricing arriving
  before MAGIC Las Vegas (August 2026)."** No switcher, no DB
  conversion table, no locale sniffing. The MAGIC launch is its
  own milestone with USD-Stripe price IDs in tow; do not lie about
  USD availability before then.
- (B) GBP + USD switcher (no EUR), client island reading
  `localStorage('pricing-currency')` or
  `Accept-Language`. Adds an interactive island and a multiplication
  table; the table will be wrong by the time Stripe goes live with
  its own per-currency price IDs.
- (C) GBP + USD + EUR with full locale-aware default. Premature; EUR
  isn't in any phase plan yet.

### JC #8 — Region-aware pricing

- **Recommended (A): no region-aware pricing.** Same numbers
  everywhere. Region-aware pricing requires a sustained reconciliation
  story (purchasing power parity, VAT, EU MOSS, USD↔GBP FX) that we
  shouldn't take on while Stripe isn't even wired.
- (B) IP-geolocated price switching (e.g. `/pricing` reads
  `x-vercel-ip-country` — we're on OneProvider so this header doesn't
  exist; would need a new geo-IP dep). Hard rule #4 forbids new
  tools.

### JC #9 — Footer expansion (now that we have 2 marketing pages)

`logos.lock.md` §5 rule #5 + M1 JC #7 are still binding: footer
**must** include `/legal/trademarks`; privacy + terms are forbidden
placeholders (ICO liability) until H7.

- **Recommended (A): keep the footer minimal — logo wordmark + ©
  line + `/legal/trademarks` link.** With only `/` and `/pricing`
  shipped, a multi-column footer would be mostly empty. Add a
  second link `/pricing` to the footer (so the trademarks page can
  navigate back to the pricing surface without going through the
  nav). Defer multi-column expansion to M3 when more pages exist.
- (B) Multi-column footer with reserved-but-empty headings (Product
  / Company / Legal) and "Coming soon" placeholders. UK ICO posture
  forbids this for legal pages and it looks unfinished for the
  others.
- (C) Full multi-column footer linking only to what exists today
  (Product: Pricing · Legal: Trademarks). Premature shape; will need
  restructure when M3/M4/M5 ship.

### JC #10 — Top-nav structure (M1 architectural decision #14)

This is the **first shared marketing chrome**. Lock it carefully.

- **Recommended (A): horizontal flex with:**
  - **Left:** SourceBD wordmark linking to `/` (font-display).
  - **Right (logged-out):** `Pricing` link · `Sign in` link · `Start
    free` CTA button (primary). On mobile (< sm): brand + CTA only;
    no hamburger (with only 1 link there's nothing to collapse).
  - **Right (logged-in, role = buyer/admin):** Same `Pricing` link
    · `Open app` CTA replacing `Sign in`/`Start free`.
  - **Right (logged-in, role = supplier):** Same `Pricing` link ·
    `Supplier portal` CTA pointing to `/supplier`.
  - Server-rendered; reads role via the existing `getServerRole()`
    helper (cookie-aware). No `'use client'` boundary. No menu
    dropdown.
- (B) Full multi-link nav (Pricing · Buyers · Suppliers · About ·
  Blog) with placeholders for unshipped routes. Forbidden by M1 JC
  #7 posture — no dead links / no "coming soon".
- (C) No top-nav at all; rely on in-page links only. Defeats the
  whole point of M2 unblocking shared marketing chrome.

### JC #11 — Pricing data storage

- **Recommended (A): static TS constant in a new module
  `lib/marketing/pricing-plans.ts`. Both `/pricing` and the existing
  `/app/settings/plan` page import from it so the feature matrix
  has one source of truth.** No DB row, no RPC, no migration. The
  matrix already exists hardcoded in `app/(app)/app/settings/plan/page.tsx`;
  M2 lifts it into the shared module and adds price + headline +
  CTA-target fields. ISR `dynamic = 'force-static'`, no `revalidate`
  (copy never changes at runtime — only at deploy time).
- (B) New `public.pricing_plans` DB table read at request time. Lets
  ops change prices without a deploy but adds a migration, an RPC,
  RLS posture (anon read?), and a smoke. Marginal value pre-launch.
- (C) Inline TS constant in `/pricing/page.tsx` only; let the B10
  settings page drift. Rejected — divergence already started in B10
  and we should consolidate now.

### JC #12 — Feature matrix shape

- **Recommended (A): three side-by-side `<Card>` plan tiles (matching
  the B10 settings shape), each carrying 4–7 bullet features + the
  price headline + a CTA button.** Plus a *separate* "Compare plans
  in detail" section below using a `<table>` with ~12 feature rows
  × 3 plan columns, check-mark cells. This gives both the
  fast-scan and the side-by-side honest comparison.
- (B) Cards only, no detailed comparison table. Fast to scan, but
  buyers expect the comparison table on a pricing page.
- (C) Comparison table only, no cards. Loses the "headline price + 1
  CTA" buy moment at the top.

---

## Workflow (only after every JC is acked)

1. **Probe** (`ops/_m2_probe.py`) — confirm:
   - No `pricing_plans` table exists (if JC #11 = A).
   - `profiles.plan_tier` CHECK still admits `{starter, growth,
     enterprise}` (sanity — if it has drifted, halt).
   - `next.config.ts` `NEXT_PUBLIC_SITE_URL` env var path matches
     what M1 uses.
   - `getServerRole()` exists at `lib/auth/server-role.ts` (or
     wherever it lives — grep first).
2. **Mark M2 in-progress** in `progress-tracker.md`
   (`## Current goal` + `## In progress`).
3. **No migration** (locked, JC #11 = A). If a JC override pushes
   us to a DB-backed shape, write `supabase/migrations/0044_*.sql`
   and apply via `docker exec -i sourcebd-etl-run python
   /tmp/_apply_stdin.py < /tmp/0044_*.sql`.
4. **Build the shared module** `lib/marketing/pricing-plans.ts`
   with `PLANS: PricingPlan[]` and the type exported.
5. **Refactor `app/(app)/app/settings/plan/page.tsx`** to import
   `PLANS` from the new module (drop the local `TIERS` const). This
   is the minimum collapse to keep the matrix single-source.
6. **Build the page** — `app/(marketing)/pricing/page.tsx` (server,
   `dynamic = 'force-static'`, `revalidate` omitted).
7. **Build the shared top-nav** — `components/marketing/top-nav.tsx`
   (server component, reads role via `getServerRole()`). Mount in
   `app/(marketing)/layout.tsx`.
8. **Expand the footer** — `components/marketing/footer.tsx`
   (server). Mount in the same `layout.tsx`. Wire into M1 home page
   (which currently renders its own inline footer — collapse it).
9. **Write `ops/_m2_smoke.py`** — see "Smoke" section below. Run on
   prod (`109.104.153.228`, container `sourcebd-etl-run`); iterate
   to PASS.
10. **`pnpm typecheck && pnpm lint && pnpm build`** — expect **+1
    route** (`/pricing`). No new deps. Build a11y warnings = zero.
11. **Close out tracker** — mark M2 complete; new
    `## Architectural decisions logged <date> (Spec M2)` block;
    bump route count to whatever `pnpm build` reports; clear the
    stale M1 "In progress" line; set `In progress` to `(none — M2
    closed; awaiting next Phase-5 spec assignment — M3 compliance
    education pages)`.
12. **Commit on `development`, push.** Conventional message:
    `feat(marketing): M2 pricing page + shared top-nav + footer expansion`.
    **Never `main`. Never touch pixelsport VPS (37.49.227.151).**
    SourceBD VPS = `109.104.153.228`.

---

## Smoke — `ops/_m2_smoke.py`

Mirror the M1 smoke harness. Run on prod, **single-SSH-at-a-time**.

Checks (final list will be locked when JCs are acked; this is the
baseline against the recommended defaults):

1. **`/pricing` returns 200** for anon + (seeded) buyer + supplier +
   admin. HTML byte-for-byte identical for anon vs buyer (the
   per-card CTAs change but the page chrome shouldn't — *unless* the
   top-nav swap means logged-in/logged-out diverge → assert the
   divergence is contained to the top-nav region only).
2. **No "score" / "rating" / "ranking" / A-D-letter-grade vocabulary**
   in any of `<h1>`, `<h2>`, `<h3>`, `<button>`, or anchor text.
   Same regex pattern as M1 smoke step 7.
3. **Plan-tier identifiers match the DB enum** — page source
   contains the exact strings `"starter"`, `"growth"`, `"enterprise"`
   (lowercased, in code paths only — not in user-visible text where
   we use "Starter" / "Growth" / "Enterprise").
4. **No PII / no SBI keys** anywhere in rendered HTML (recursive
   regex scan; same FORBIDDEN set as M1).
5. **Placeholder markers present** (JC #1 = A): `<!-- launch marker:
   price -->` appears exactly 3 times (one per tier). The smoke
   forces a deliberate pre-launch swap.
6. **Top-nav parity across pages** — `/`, `/pricing`, and
   `/legal/trademarks` all render the same nav element (extract by
   `<nav data-marketing-nav>` selector and diff the inner HTML).
7. **Footer parity across pages** — same diff against
   `<footer data-marketing-footer>`. `/legal/trademarks` appears
   exactly once; `/legal/privacy` and `/legal/terms` appear zero
   times (M1 JC #7 still binds).
8. **No Stripe SDK loaded** — `package.json` does not contain
   `@stripe/*`; rendered HTML does not contain `js.stripe.com`
   script tag. (Defends against an accidental "let me just wire
   Stripe" drift.)
9. **A11y baseline** — exactly one `<h1>` on `/pricing`; heading
   order valid (`<h2>` then `<h3>`s); FAQ accordion `<details>`
   count ≥ 5 (if JC #6 = A); per-comparison-table cell carries
   `aria-label` "Included" or "Not included".
10. **Pricing module is shared** — `app/(app)/app/settings/plan/page.tsx`
    imports `PLANS` from `lib/marketing/pricing-plans.ts`; the
    smoke greps both files to assert no second `TIERS`/`PLANS`
    constant has reappeared.

---

## Architectural decisions to log on close-out (placeholder — locked
to the acked JCs at close time)

1. M2 introduces the marketing top-nav per M1 decision #14. Shape =
   acked JC #10. Server-rendered. No `'use client'` boundary. Role
   detected via existing `getServerRole()` helper — no new auth
   surface.
2. Footer expanded per acked JC #9. Privacy + terms remain forbidden
   placeholders until H7 (UK ICO posture, M1 JC #7 carry-forward).
3. No live Stripe in v1 per acked JC #4. Stripe wiring is H3
   (Phase 6 Hardening) and gets its own spec; CTAs route to
   `/signup` (Starter/Growth) and `mailto:sales@sourcebd.com`
   (Enterprise) until then.
4. Currency = GBP-only at launch per acked JC #7. USD switch lands
   alongside Stripe wiring before MAGIC Las Vegas.
5. Pricing data is a static TS constant per acked JC #11; both
   `/pricing` and `/app/settings/plan` import from
   `lib/marketing/pricing-plans.ts`. Single source of truth, no
   migration, no RPC.
6. Plan identifiers match `profiles.plan_tier` DB enum verbatim
   (`starter` / `growth` / `enterprise`). Constraint shipped in
   migration 0031 (B10) and is the canonical lock.
7. No trust-sources strip on `/pricing` (per Hard Constraint #4).
   That strip lives on `/` where the methodology justifies it.
8. Placeholder pricing carries `<!-- launch marker: price -->` HTML
   comments so the smoke + a `grep` pre-launch checklist can find
   every unreleased number.
9. No new tools, no new dependencies. Same chrome (Tailwind +
   Phosphor SSR + hand-rolled shadcn primitives + existing
   Supabase server client).
10. M1 home page footer collapses into the new shared footer
    component on the same PR — closes the duplicate footer drift.

---

**Awaiting JC acks (#1–#12).** Once acked, the implementation
proceeds top-to-bottom per the workflow above without further
clarification rounds.
