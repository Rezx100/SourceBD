# Spec M3 — Compliance education pages

Third Phase-5 spec (M1 → M2 → **M3** → M4 → M5; per
`context/phases.md` line 102). Ships public, indexable compliance
education pages for UK / US / EU / CA buyer-side regulations
(UK MSA, US UFLPA, EU CBAM, EU EUDR, EU CSDDD). Pure marketing copy
+ source-cited regulatory citations — **no live data, no DB reads,
no scrapers, no Stripe**. Inherits the shared marketing chrome
(top-nav + footer) from M2 for free; expands the footer with a
Compliance link group and optionally adds a `Compliance` link to the
top-nav (JC #5).

---

## Hard constraints (re-read before writing copy)

1. **Receipts-first doctrine.** Every regulatory claim on every page
   carries an explicit Tier-1 (gov / regulatory) or Tier-5 (US / UK /
   EU regulatory) citation that links out to the issuing authority.
   No "trust us" prose. No SourceBD-issued interpretation that isn't
   directly traceable to a cited paragraph in the cited document.
2. **SBI doctrine — `α now, β later, γ never`.** No "score" / "rating"
   / "ranking" / A–D / "tier" (in the SBI sense) vocabulary anywhere
   in copy. We may say "Tier 1 source" / "Tier 5 regulation" in the
   source-trust-hierarchy sense, because that vocabulary is already
   public (`architecture.md` Source Trust Hierarchy + `logos.lock.md`)
   and refers to *the source's* tier, not to a supplier's score.
3. **Source-trust hierarchy is law.** Every cited URL is a Tier 1 or
   Tier 5 source. No Tier 4 (brand) cite. No Tier 6 (cross-check)
   cite. Citations live in a TS constant (see JC #2) so the smoke
   can assert every page renders ≥1 Tier-1-or-5 link, no Tier-4,
   no Tier-6.
4. **No new tools.** No MDX, no `@next/mdx`, no CMS, no headless
   editor, no Stripe. Existing Next.js 15 App Router + Tailwind +
   Phosphor SSR + hand-rolled shadcn primitives + the shared
   marketing chrome from M2.
5. **No new DB tables, no new migration, no new RPC, no new env
   var.** All page content is TS constants (see JC #2). The smoke
   harness asserts no `supabase/migrations/0045_*.sql` was added.
6. **Per-factory authenticity rule still applies to any brand /
   buyer wordmark** (`logos.lock.md` §3 Tier 4 header verbatim).
   **Recommendation: no brand wordmarks on any M3 page** — we are
   citing regulators, not vendors. Marketing typography only.
7. **No legal advice.** Every page carries a one-line disclaimer
   ("Educational summary, not legal advice. Consult counsel for
   obligations specific to your business.") at the top of each page
   body. Smoke asserts the literal disclaimer string appears on
   every M3 route.
8. **In-app `/app/compliance/*` (B9 Compliance Hub) is buyer-only,
   behind auth.** M3 marketing pages link *into* `/app/compliance`
   (post-signup destination), but do not duplicate the live data
   surfaces (UFLPA tracker, expiry dashboard, MSA generator). M3 is
   "what is this regulation, why does it matter, how does SourceBD
   help" — B9 is the working tool.
9. **Robots / SEO (Lock #1 from M1 + M2).** Every M3 page:
   `dynamic = 'force-static'`, `metadata.robots = { index: true,
   follow: true }`, `metadata.openGraph = { …, locale: 'en_GB',
   type: 'article' }`, `metadata.alternates.canonical` resolved
   from `NEXT_PUBLIC_SITE_URL`. No OG image (deferred to M4).
10. **Accessibility (Lock #2 from M1 + M2).** Exactly one `<h1>` per
    page; `<h2>` per major section; `<h3>` per sub-section / FAQ
    question. Every external regulatory link carries
    `rel="noopener noreferrer"` and `target="_blank"` plus a
    `aria-label` describing the issuer ("Open UFLPA Entity List on
    Department of Homeland Security website"). `pnpm build` a11y
    warnings = zero.
11. **`last_reviewed_at` stamp on every page.** Per-page TS constant
    of shape `{ regulation, last_reviewed_at: '2026-06-01',
    reviewed_by: 'SourceBD editorial' }` rendered in the page footer
    ("Last reviewed: 1 June 2026"). Smoke asserts the date string
    parses + is not older than 365 days. This is the "fresh without
    a CMS" answer — bump the date in the TS constant on each spec
    that revisits the page.

---

## Open judgement calls (need acks before implementation)

> **Convention:** each JC has (a) recommended default and (b)
> alternatives. **Reply with `ack JC#1 = A`** etc. or override.
> No implementation work starts until every JC is acked.

### JC #1 — Scope of pages (hub vs per-regulation vs hybrid)

- **Recommended (A): hybrid.** One hub page at `/compliance`
  (overview of the 5 regulations + the SourceBD posture) **plus** one
  detail page per regulation:
  - `/compliance/uk-msa` (UK Modern Slavery Act 2015, §54)
  - `/compliance/uflpa` (US Uyghur Forced Labor Prevention Act)
  - `/compliance/eu-cbam` (EU Carbon Border Adjustment Mechanism)
  - `/compliance/eu-eudr` (EU Deforestation Regulation 2023/1115)
  - `/compliance/eu-csddd` (EU Corporate Sustainability Due Diligence
    Directive 2024/1760)

  Total: **6 new routes** (1 hub + 5 detail). Each detail page is
  ~600–900 words, structured (What it is · Who it applies to ·
  Penalties · What you must disclose / verify · How SourceBD's data
  helps · External references). The hub page is ~400 words +
  5 tile-cards linking to the detail pages.

- (B) Single hub page only at `/compliance`, ~2500 words covering
  all 5 regulations inline. Loses SEO surface area (each regulation
  is a distinct buyer query), and forces giant page weight.

- (C) Per-regulation only, no hub. Forces buyers to land on a
  specific URL or hunt — and we lose the "Compliance" footer/nav
  entry point unless we pick one regulation arbitrarily as the
  landing.

### JC #2 — Content storage

- **Recommended (A): one shared TS constant module
  `lib/marketing/compliance-pages.ts` exporting a `COMPLIANCE_PAGES:
  CompliancePage[]` array. One entry per regulation + the hub
  metadata.** Each entry carries `slug`, `title`, `headline`,
  `summary`, `sections: { heading, body, citations }[]`, `references:
  Citation[]` (every Citation = `{label, url, issuer, tier:
  'tier1_gov'|'tier5_regulatory', accessed_on}`), `last_reviewed_at`,
  `seo: { description, ogTitle }`. The page components are thin
  shells over this data so adding / editing a regulation is a 1-file
  change.
- (B) Inline TS constants in each `page.tsx`. Duplicates the
  `Citation` rendering and makes the smoke harness's "every page has
  ≥1 Tier-1-or-5 citation, no Tier-4, no Tier-6" assertion need to
  parse JSX instead of reading data.
- (C) MDX files in `content/compliance/*.mdx`. Requires `@next/mdx`
  (new tool — forbidden by hard rule #4).

### JC #3 — Audience framing

- **Recommended (A): UK / US / EU / CA buyer-facing only.** Every
  page speaks to the importer / brand / sourcing director as the
  "you" of the copy ("Your business may need to publish a §54
  statement if…"). Supplier-side guidance is out of scope — Phase 3
  S1–S5 has its own surfaces.
- (B) Buyer + supplier sections per page (split with `<h2>For
  buyers` / `<h2>For Bangladesh suppliers`). Doubles page length,
  blurs the editorial voice, and risks supplier copy being read as
  legal advice in jurisdictions where they have no obligation.
- (C) Regulator-neutral framing ("what the regulation says, who it
  binds, what evidence trails it requires"). Honest but less
  conversion-friendly — these pages are marketing surfaces; the
  buyer is the audience that signs up.

### JC #4 — Source-pill / receipts presentation on the marketing
copy

- **Recommended (A): marketing typography only — no live
  `<SourcePill>` component.** Citations render as plain inline
  external links with a small `[issuer · Tier 1]` muted suffix in
  the same `font-mono 11px` style M1 uses for `<CardMeta>`. The
  in-app `<SourcePill>` component is for *supplier-specific*
  evidence and depends on `source_records` rows; marketing pages
  cite regulations, not suppliers, so the visual contract is
  different. Continues M1 JC #1 (marketing typography over
  component reuse where it changes the contract).
- (B) Reuse the in-app `<SourcePill>` component from B2 / discover.
  Forces the component to grow a new "no supplier context" branch
  and couples marketing copy to data-shape evolution.

### JC #5 — Top-nav update

- **Recommended (A): add a `Compliance` link to the marketing
  top-nav** (`components/marketing/top-nav.tsx`), placed left of
  `Pricing` for both logged-out and logged-in variants. Total nav
  links logged-out: `Compliance` · `Pricing` · `Sign in` · `Start
  free`. M2 logged-in variants get `Compliance` · `Pricing` ·
  `Open app` / `Supplier portal`. The mobile `< sm` rule from M2
  (hide secondary nav links, keep brand + CTA only) extends to
  Compliance too — it sits inside the `hidden … sm:inline` group.
- (B) Keep nav minimal (Pricing only) and rely on the footer +
  in-page links. Lower discoverability for a major SEO surface.
- (C) Replace `Pricing` with a `Compliance` dropdown that lists all
  5 regulations + Pricing. Adds a `'use client'` boundary or a
  CSS-only `<details>` widget — both worse than (A) for SSR cost +
  a11y.

### JC #6 — Footer expansion

- **Recommended (A): add a single new link `Compliance` to the
  existing footer link row**, between `Pricing` and `Trademarks`.
  Keep the footer as a single row (M2 JC #9 = A). Detail-page links
  do not appear in the footer — they are reachable from the hub.
- (B) Restructure the footer into 2 columns: "Product" (Pricing) ·
  "Compliance" (UK MSA · UFLPA · CBAM · EUDR · CSDDD) · with
  Trademarks + © spanning the bottom. More polished but conflicts
  with M2's "minimal footer until more pages exist" posture.
- (C) Don't touch the footer; rely on the top-nav entry only.
  Skips the redundancy that helps with deep-link orientation.

### JC #7 — CTA shape on each page

- **Recommended (A): two-button CTA strip at the bottom of every
  page** — primary `Start free` → `/signup?plan=starter` (matches
  M2 pricing CTA shape), secondary `Talk to compliance team` →
  `mailto:sales@sourcebd.com?subject=…<regulation>%20enquiry`. Hub
  page gets the same CTA strip with subject "Compliance programme
  enquiry". Logged-in buyers see `Open Compliance Hub` →
  `/app/compliance` replacing `Start free` (role-resolved via
  `getServerRole()` in the same pattern as M2 top-nav).
- (B) Single `Start free` button only. Cleaner but loses the
  enterprise-buyer escape hatch.
- (C) Per-page bespoke CTA (e.g. UFLPA page → "Screen your suppliers"
  → `/app/compliance/uflpa`). Tempting, but the in-app route gates
  by `saved_suppliers` and is empty for a new buyer — the CTA would
  land on an empty screen. Cleaner once Smart Match seeds a "first
  look" supplier list.

### JC #8 — Updates cadence + `last_reviewed_at` policy

- **Recommended (A): `last_reviewed_at` per page is a TS constant
  bumped on every spec that revisits the page** (M3 ships with all
  pages stamped `2026-06-01`; subsequent specs touch the constant
  when they change the copy). Render in the page footer as "Last
  reviewed: 1 June 2026" using `Intl.DateTimeFormat('en-GB', {
  dateStyle: 'long' })`. The hub page additionally renders the
  oldest of the 5 detail dates as a hub-level "Last reviewed". No
  cron, no Inngest job — staleness is a manual-bump discipline
  enforced by the smoke (warn if any page is >365 days old at
  build time).
- (B) Server-side render today's date. Misleading — buyers will
  read it as "this content was last verified today" when it wasn't.
- (C) Omit the date entirely. Loses freshness signal and SEO E-E-A-T
  signal.

### JC #9 — Relationship to in-app `/app/compliance/*` (B9)

- **Recommended (A): marketing pages link *into* the in-app
  routes, but in-app routes do not link back to marketing pages.**
  The "How SourceBD helps" section of each detail page carries
  contextual CTAs:
  - UK MSA page → "Generate your §54 statement →" → `/app/compliance/msa`
  - UFLPA page → "Open the UFLPA traceability tracker →" → `/app/compliance/uflpa`
  - All pages → "See all compliance tools →" → `/app/compliance`

  These CTAs render inside the page body for logged-in buyers, and
  as `Start free` (M3 JC #7) for logged-out visitors. The in-app
  pages' copy stays unchanged (no new "← Back to compliance
  education" affordance there — buyers in the app are working, not
  reading).
- (B) Bidirectional links (in-app pages also link back to marketing
  pages). Adds marketing chrome inside the app surface, blurring
  the boundary.
- (C) No links between the two surfaces. Loses the obvious
  conversion path from cold visitor → in-app tool.

### JC #10 — Indexability + canonical (carry-over lock)

Locked from M1 + M2 — already covered by hard constraint #9. Noted
here as a JC slot only so the ack chain stays sequential.

**ack JC#10 = locked (carry-over)** is the expected reply.

### JC #11 — Per-regulation page anatomy

- **Recommended (A): every detail page has the exact same 6
  sections in the same order**, driven by the TS constant:
  1. **What it is** — 2–3 sentences in plain English.
  2. **Who it applies to** — bullet list of thresholds (turnover,
     geography, sector).
  3. **What you must do** — bullet list of obligations.
  4. **Penalties for non-compliance** — short paragraph + cited
     enforcement examples where public.
  5. **How SourceBD's data helps** — bullet list pointing at the
     specific receipts the platform surfaces (UFLPA hits, RSC %,
     register pills, cert badges, brand attribution chips) — never
     a promise that SourceBD certifies / clears / approves.
  6. **References** — bulleted list of every cited source with
     issuer + date accessed.

  Consistent anatomy = predictable buyer scan + simpler smoke.
- (B) Per-regulation anatomy (e.g. UFLPA grows a "Suppliers we
  screen" section). Drift surface; tempting but unbounded.

---

## Workflow (only after every JC is acked)

1. **Probe** (`ops/_m3_probe.py`) — confirm:
   - No `compliance_*` table exists outside the B9 surfaces
     (sanity — if a new compliance table has appeared, halt).
   - `components/marketing/top-nav.tsx` matches the M2 shape so the
     diff is a clean insertion.
   - `lib/marketing/pricing-plans.ts` still has the `CtaTarget`
     shape (we reuse the pattern for compliance CTAs).
   - `getServerRole()` still lives at `lib/auth.ts`.
2. **Mark M3 in-progress** in `progress-tracker.md` (`## Current
   goal` + `## In progress`).
3. **No migration.** If a JC override requires DB shape change,
   write `supabase/migrations/0045_*.sql` and apply via the per-
   migration `docker cp + python /tmp/_apply_stdin.py` pattern.
4. **Build the shared content module** `lib/marketing/compliance-
   pages.ts` per JC #2:
   - `Citation` type + `CompliancePage` type.
   - `COMPLIANCE_PAGES: CompliancePage[]` populated with all 5
     regulations + the hub-level metadata.
   - Every `citation.tier` ∈ `{tier1_gov, tier5_regulatory}` (smoke
     asserts).
5. **Build the hub page** `app/(marketing)/compliance/page.tsx`
   (server, `dynamic = 'force-static'`, no `revalidate`):
   - Hero + intro paragraph from `COMPLIANCE_PAGES` hub entry.
   - 5 tile-cards (one per regulation) linking to detail pages.
   - "Last reviewed" line (oldest of the 5 detail dates).
   - CTA strip per JC #7 (role-aware via `getServerRole()`).
6. **Build the 5 detail pages** under
   `app/(marketing)/compliance/[slug]/page.tsx` — a single dynamic
   segment per JC #11 anatomy. Use `generateStaticParams()` to
   pre-render the 5 known slugs at build time so they ship as
   static HTML alongside the hub. `notFound()` for any unknown
   slug.
7. **Update the top-nav** per JC #5 — insert the `Compliance` link
   in `components/marketing/top-nav.tsx` in all three role
   branches.
8. **Update the footer** per JC #6 — insert the `Compliance` link
   in `components/marketing/footer.tsx` between `Pricing` and
   `Trademarks`.
9. **Write `ops/_m3_smoke.py`** — see "Smoke" section below.
   Run on prod (`109.104.153.228`, container `sourcebd-etl-run`);
   iterate to PASS.
10. **`pnpm typecheck && pnpm lint && pnpm build`** — expect **+6
    routes** (1 hub + 5 detail). No new deps. Build a11y warnings
    = zero. Update progress-tracker route count.
11. **Close out tracker** — mark M3 complete; new `##
    Architectural decisions logged <date> (Spec M3)` block;
    bump the route count + the "Recently shipped (Phase 5 —
    Marketing)" section.
12. **Commit on `development`** with Conventional Commit
    `feat(marketing): ship Spec M3 compliance education pages`,
    push. **Do not push to `main`** (hard rule).

---

## Smoke (`ops/_m3_smoke.py`)

Single-process Python script run inside `sourcebd-etl-run` on prod
(`109.104.153.228`). HTTP-only (no DB hits — this spec writes no
DB rows). Tests:

- **(a)** `GET https://sourcebd.net/compliance` → 200 +
  `<title>` contains `Compliance` + body contains the
  literal disclaimer string.
- **(b)** `GET https://sourcebd.net/compliance/<slug>` for each of
  `{uk-msa, uflpa, eu-cbam, eu-eudr, eu-csddd}` → 200 +
  `<title>` contains the regulation short name +
  `<link rel="canonical" href="https://sourcebd.net/compliance/<slug>">`
  matches exactly.
- **(c)** Body of each detail page contains:
  - The literal disclaimer string.
  - ≥1 outbound link whose `href` host matches the cited issuer
    domain set (e.g. `dhs.gov`, `gov.uk`, `eur-lex.europa.eu`,
    `ec.europa.eu`, `legislation.gov.uk`).
  - No `<a href>` whose host is on the brand wordmark list (smoke
    asserts no Tier 4 cite leaked in).
  - The 6 section `<h2>`s in the JC #11 order.
- **(d)** Top-nav on every M3 page renders the `Compliance` link
  (matches `<a href="/compliance">Compliance</a>` exactly once per
  page). Top-nav on `/` and `/pricing` ALSO now renders the link
  (regression check — proves the M2 chrome diff didn't drift).
- **(e)** Footer on every M3 page renders the `Compliance` link
  between `Pricing` and `Trademarks` (assert link-text order in
  the rendered footer HTML).
- **(f)** Every `last_reviewed_at` in `COMPLIANCE_PAGES` parses as
  ISO-8601 and is not older than 365 days at build time (this is
  enforced by a small node script invoked by the smoke via
  `node -e '...'` against the built bundle, OR by an inline
  assertion inside the page component that throws at render).
  Recommendation: page-level inline assertion (fails the build,
  not just the smoke).
- **(g)** Recursive forbidden-key leak diff = `[]` (the marketing
  HTML must not contain the SBI / `sbi_total` / register-PII
  string set — same forbidden set used by every prior smoke).
- **(h)** Robots / canonical headers on each page match the M2
  pattern.

Smoke PASS gate = all (a)–(h) green.

---

## Out of scope for M3 (explicit non-goals)

- Per-supplier compliance history widgets (lives in B9 inside the
  app; never on marketing pages).
- Country-specific compliance pages beyond UK / US / EU (CA-specific
  page deferred until Canadian Bill S-211 traction warrants it —
  smoke harness is generic, so adding `ca-bill-s211` later is a
  single TS constant entry + auto-route via `generateStaticParams`).
- Sector-specific compliance pages (footwear, leather, denim
  wet-processing). Deferred.
- Localisation (en-US vs en-GB vs es / de / fr). All copy is en-GB
  per `frontend-design-spec.md`.
- PDF / downloadable artefacts. The MSA generator already lives at
  `/app/compliance/msa` for buyers — M3 marketing pages link to it,
  do not duplicate it.
- A compliance changelog or blog. Goes with M4 blog scaffold.

---

## Architectural decisions to log on close-out (placeholder)

Will be filled at spec close. Expected entries:

1. Hybrid hub + 5 detail pages (JC #1 = A) vs. single hub or
   per-regulation only.
2. TS-constant content storage (JC #2 = A) vs. MDX / DB-backed.
3. Buyer-facing-only voice (JC #3 = A).
4. Marketing typography for citations (JC #4 = A) vs. reuse of
   in-app `<SourcePill>`.
5. Top-nav and footer both grow a `Compliance` entry (JC #5 + JC
   #6 = A).
6. Two-button CTA strip with role-aware primary (JC #7 = A).
7. Manual `last_reviewed_at` bump policy (JC #8 = A).
8. Marketing → in-app one-way links (JC #9 = A); in-app pages
   stay clean.
9. Per-regulation 6-section anatomy (JC #11 = A) — consistency
   over bespoke per-regulation flexibility.

---
