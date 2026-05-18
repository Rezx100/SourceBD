# SourceBD — Spec Addendum v1.1
**Gaps identified from full conversation review · January 2026**

This document supplements the Master Spec. Add these to your dev briefings and Figma scope.

---

## GAP 1 — BUYING HOUSE ↔ FACTORY RELATIONSHIP MAPPING (Critical Missing Feature)

This was explicitly identified in the original conversation as **the most unique thing SourceBD can offer** that no other platform has:

> "SourceBD would be the first platform to map the relationship between buying houses and factory clusters — which buying house works with which factories, in which product category."

A UK buyer currently cannot tell the difference between a buying house and a factory, or which buying house specialises in which factories. This mapping IS the core intelligence product.

### Feature: Relationship Graph

**Database addition needed:**
```sql
CREATE TABLE public.bh_factory_relationships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buying_house_id UUID NOT NULL REFERENCES suppliers(id),
  factory_id      UUID NOT NULL REFERENCES suppliers(id),
  relationship_type TEXT DEFAULT 'works_with'
    CHECK (relationship_type IN ('works_with', 'preferred_partner', 'exclusive')),
  product_categories TEXT[],    -- categories this pair handles together
  verified        BOOLEAN DEFAULT FALSE,
  source          TEXT,         -- 'factory_submitted' | 'admin' | 'buyer_confirmed'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (buying_house_id, factory_id)
);
```

**UI additions needed in Figma:**
- On buying house profile: "Partner factories" tab showing linked factories with mini score rings
- On factory profile: "Works with" tab showing linked buying houses
- On Discover page: Filter toggle "Show me buying houses that work with WRAP-certified knitwear factories"
- New page: `/discover/match` — Smart matching form (see Gap 4)

---

## GAP 2 — SUPPLIER ONBOARDING STRATEGY (Go-to-Market Feature, Not Just a Business Note)

From the conversation:
> "Don't try to onboard 4,500 factories. Start by signing up 30 buying houses from the BGMEA list as 'SourceBD Verified Partners' first."

This means the **supplier-facing portal** (Phase 2 in current spec) needs to move earlier, at least for buying houses. Buying houses have an incentive to be listed because it brings them UK/US buyer leads. Factories follow when they see buying houses already there.

**Revised supplier onboarding flow:**
1. Admin manually seeds 500 factories from BGMEA/Trade Portal PDFs (public data, no permission needed)
2. Admin emails top 30 buying houses directly (you have their contacts from the BGMEA PDF) offering free "SourceBD Verified Partner" listing during beta
3. Buying houses claim and enhance their profile (add factory relationships, upload docs)
4. Factories see their buying house partners listed and self-register to claim/enhance their own profiles
5. Credibility flywheel: buyers arrive → high-scoring factories get leads → low-scoring factories upgrade

**Database field needed on suppliers table:**
```sql
ALTER TABLE suppliers ADD COLUMN claimed_by UUID REFERENCES profiles(id);
ALTER TABLE suppliers ADD COLUMN claimed_at TIMESTAMPTZ;
ALTER TABLE suppliers ADD COLUMN profile_completion_pct INTEGER DEFAULT 0;
```

**New supplier portal routes (needed in Phase 1, not Phase 2):**
```
/supplier/claim           → search for your company, claim it
/supplier/dashboard       → see your SBI score, incoming RFQs, profile completion
/supplier/profile/edit    → update contact info, upload certifications, add factory links
/supplier/rfqs            → manage incoming RFQ requests from buyers
```

---

## GAP 3 — ADVANCED ORDER SPEC MATCHING (The Intelligence Layer)

The user specifically said "advance order spec search so that buyers will get matching buying house information." This is more than a filter — it's a **matching/recommendation engine**.

### Feature: Smart Sourcing Match

A buyer fills in their order specification and gets ranked matches, not just search results.

**Input form fields:**
```
product_type           (knitwear / woven / denim etc.)
quantity_pieces        number
fabric_composition     text (e.g. "100% organic cotton")
required_certifications multi-select (WRAP / GOTS / RSC Complete)
target_fob_price       number (USD per piece, optional)
delivery_port          select (Felixstowe / NY Port / Rotterdam)
required_delivery_date date picker
buyer_country          UK | US | EU
prefer_entity_type     factory | buying_house | either
```

**Matching algorithm (score each supplier against requirements):**
```typescript
// src/lib/matching/scoreMatch.ts

function calculateMatchScore(supplier: Supplier, requirements: OrderSpec): number {
  let score = 0

  // Base SBI score contributes 40% of match score
  score += (supplier.sbi_score / 100) * 40

  // Certification match: 30%
  const certMatch = requirements.required_certifications.filter(
    cert => supplierHasCert(supplier, cert)
  ).length / requirements.required_certifications.length
  score += certMatch * 30

  // Category match: 15%
  if (supplier.product_categories.includes(requirements.product_type)) score += 15

  // MOQ fit: 10%
  if (requirements.quantity_pieces >= (supplier.moq_pieces || 0)) score += 10

  // UK/US buyer preference — buying houses preferred for first-time orders: 5%
  if (requirements.buyer_is_new && supplier.entity_type === 'buying_house') score += 5

  return Math.round(score)
}
```

**New API route:**
```
POST /api/v1/match
Body: { order_spec: OrderSpec }
Response: { matches: MatchResult[], query_id: string }
```

**UI: New "Find a Match" page** (`/match`)
- Step 1: Fill order spec form (wizard, 3 steps)
- Step 2: See ranked results with match score (different visual from search — shows WHY they match)
- Step 3: Send RFQ to selected matches in one click

**This is the feature to demo at Source Fashion London** — it's more impressive than search.

---

## GAP 4 — LANDING PAGE / MARKETING WEBSITE (Not in Spec at All)

The spec covers the app only. But buyers need to find and trust SourceBD before they log in. A marketing site is required:

**Routes on marketing site (separate from app.sourcebd.com):**
```
sourcebd.com/              Landing page — hero, value prop, trust signals
sourcebd.com/pricing       Pricing table (Starter / Growth / Enterprise)
sourcebd.com/how-it-works  Feature overview with screenshots
sourcebd.com/compliance     UK Modern Slavery Act + UFLPA education page (SEO)
sourcebd.com/blog          Content hub (trade press reposts, SBI methodology)
sourcebd.com/about         Founder story (the Bangladesh angle is a brand asset — use it)
sourcebd.com/contact       Contact form
```

**Key trust signals on landing page:**
- "2,159 verified suppliers indexed" (live counter)
- SBI Score methodology summary — shows you're serious
- "Built by a Bangladeshi founder with direct RSC and BGMEA data access"
- Logos of data sources (RSC, WRAP, BGMEA, BSCI) as trust signals
- UK GDPR compliant badge
- UFLPA compliance support badge

**Tech stack for marketing site:**
- Same Next.js repo, but under `/` while app is under `/app` subdomain
- Or separate Next.js project at `sourcebd.com` with link to `app.sourcebd.com`
- **Recommended: same monorepo, different subdomain** — saves deployment overhead

---

## GAP 5 — BUYING HOUSE PROFILE (Different from Factory Profile)

Buying houses are not factories. They have a different profile layout:

**Buying house specific fields:**
```sql
ALTER TABLE suppliers ADD COLUMN bh_specialisation TEXT[];      -- ['knitwear', 'woven']
ALTER TABLE suppliers ADD COLUMN bh_markets_served TEXT[];      -- ['UK', 'US', 'EU']
ALTER TABLE suppliers ADD COLUMN bh_years_experience INTEGER;
ALTER TABLE suppliers ADD COLUMN bh_typical_moq_range TEXT;
ALTER TABLE suppliers ADD COLUMN bh_language_support TEXT[];    -- ['English', 'Bengali']
ALTER TABLE suppliers ADD COLUMN bh_payment_terms TEXT;         -- 'LC, TT' etc.
ALTER TABLE suppliers ADD COLUMN bh_sourcing_fee_pct DECIMAL;  -- optional, % of FOB
```

**Buying house profile page differences from factory:**
- Shows "Partner factories" list with score rings (linked factory profiles)
- Shows "Markets served" (UK, US, EU) as prominent tags
- Shows "Typical order range" (e.g. $10K–$500K)
- No RSC fire/structural scores (buying houses don't have those)
- No factory capacity field
- Instead: "Number of partner factories" stat
- Call to action is different: "Request introduction" (not "Request RFQ")

---

## GAP 6 — SUPPLIER REVIEW SYSTEM (Schema Missing from Spec)

Mentioned as Phase 2 but the schema was never written. Add to Phase 1 as a stub (hidden until Phase 2):

```sql
CREATE TABLE public.supplier_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID NOT NULL REFERENCES suppliers(id),
  reviewer_id     UUID NOT NULL REFERENCES profiles(id),
  order_id        UUID REFERENCES orders(id),       -- requires completed order
  quality_rating  INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  lead_time_rating INTEGER CHECK (lead_time_rating BETWEEN 1 AND 5),
  review_text     TEXT,
  is_verified_order BOOLEAN DEFAULT FALSE,          -- did order actually complete?
  is_public       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE suppliers ADD COLUMN avg_review_score DECIMAL(3,2);
ALTER TABLE suppliers ADD COLUMN review_count INTEGER DEFAULT 0;
```

---

## GAP 7 — NOTIFICATION PREFERENCES TABLE (Missing from Schema)

```sql
CREATE TABLE public.notification_preferences (
  profile_id          UUID PRIMARY KEY REFERENCES profiles(id),
  email_new_message   BOOLEAN DEFAULT TRUE,
  email_rfq_response  BOOLEAN DEFAULT TRUE,
  email_cert_expiry   BOOLEAN DEFAULT TRUE,
  email_score_change  BOOLEAN DEFAULT TRUE,
  email_weekly_digest BOOLEAN DEFAULT TRUE,
  push_new_message    BOOLEAN DEFAULT FALSE,   -- Phase 2
  push_rfq_response   BOOLEAN DEFAULT FALSE,
  in_app_all          BOOLEAN DEFAULT TRUE
);
```

---

## GAP 8 — FIBRE TRACEABILITY AS PART OF SBI SCORE (Not Just Compliance Page)

From the conversation:
> "Building fibre traceability into your compliance score from day one turns a liability into a selling point."

The current spec puts UFLPA traceability only in the Compliance Hub (buyer-facing). It should ALSO be part of the SBI score calculation:

**Add to Pillar 2 (Safety & Remediation) or as Pillar 5 for US-market buyers:**

```typescript
// Addition to SBI score calculation:
// UFLPA Traceability: 0-10 pts (shown to US buyer accounts only)
const uflpa_score = {
  has_traceability_docs:  supplierHasDocs(supplier, 'uflpa_traceability') ? 7 : 0,
  xinjiang_free_certified: supplierCertified(supplier, 'xinjiang_free')   ? 3 : 0,
}
```

Display note: "For US buyers, UFLPA traceability documentation adds up to 10 additional points to the SBI score."

---

## GAP 9 — PLATFORM-LEVEL ADMIN FEATURES (Not Specified)

The spec mentions an admin user type but doesn't specify what the admin panel covers. This is needed from Day 1:

**Admin panel routes (`/admin/`):**
```
/admin/dashboard          → platform stats (users, suppliers, RFQs, revenue)
/admin/suppliers          → full supplier list, edit, approve claims
/admin/suppliers/import   → bulk CSV import from BGMEA/Trade Portal data
/admin/suppliers/scores   → trigger score recalculation for one or all
/admin/users              → buyer and supplier accounts
/admin/certifications     → pending verification queue (factory-submitted docs)
/admin/sanctions          → sanctions screening results and flags
/admin/rfqs               → all RFQs (for support and dispute visibility)
/admin/billing            → subscription overview, revenue dashboard
/admin/content            → manage blog posts (if CMS integrated)
```

**Bulk import tool (critical for launch):**
You have 178 pages of factory data and 14 pages of buying house data. You need a CSV import flow:

```typescript
// Admin tool: bulk import suppliers from CSV
// CSV columns: company_name, entity_type, district, contact_name, contact_phone, 
//              product_categories, bgmea_number, epb_number

async function bulkImportSuppliers(csvFile: File) {
  const rows = await parseCSV(csvFile)
  
  for (const row of rows) {
    const slug = generateSlug(row.company_name)
    await supabase.from('suppliers').upsert({
      ...row,
      slug,
      product_categories: row.product_categories.split(',').map(s => s.trim()),
      sbi_score: 0,  // Will be calculated after certifications added
    }, { onConflict: 'slug' })
  }
  
  // Trigger batch score calculation
  await inngest.send({ name: 'supplier/batch-score', data: { trigger: 'import' } })
}
```

---

## GAP 10 — MISSING REVENUE STREAM: BUYING HOUSE REFERRAL CUTS

From the original conversation, buying house referral cuts were listed as an additional revenue stream. This was not in the spec's monetisation section.

**How it works:**
- If a buyer discovers a buying house on SourceBD and places an order through them, the buying house pays SourceBD a small referral fee (1–2% of order value) OR an elevated listing fee tier
- This ONLY applies to buying houses (they are intermediaries who earn commission anyway)
- Still does NOT make SourceBD a transaction platform — the referral fee is between SourceBD and the buying house, not contingent on the underlying goods transaction
- Legal note: document carefully in buying house Terms of Service that this is a referral/marketing fee, not a commission on goods

**Implementation:** Track which buyers came to a buying house via SourceBD using UTM parameters and conversation audit trail. Invoice buying house monthly for introductions that became orders (self-reported at launch, verified later).

---

## GAP 11 — TRADEMARK & LEGAL TASKS (Missing from Spec Roadmap)

These were identified as Day-1 blockers in the original conversation but are missing from the spec's Phase 0:

**Before any public launch:**
1. File "SourceBD" trademark at UKIPO (Class 42: software/SaaS) — ~£170/class, 4–6 month process, file immediately
2. File "SourceBD" trademark at USPTO (Class 42) — ~$250–350/class, 8–12 month process
3. Appoint UK GDPR Representative (~£300–800/year) — required to accept UK users
4. Register with ICO (UK data protection regulator) — £52/year
5. Register Bangladesh Private Ltd via RJSC (~BDT 15,000–30,000, 2–4 weeks)
6. Register with BASIS for ITES tax exemption (zero tax on foreign earnings to 2031)
7. Open Authorised Dealer (AD) bank account for receiving USD/GBP from Stripe

**Add to Phase 0 (Design/Legal) checklist in the spec roadmap.**

---

## GAP 12 — SOURCE FASHION LONDON & MAGIC LAS VEGAS (Missing from Roadmap)

These were specifically researched and confirmed as the two launch events:

- **Source Fashion London** — Excel London, **July 7–9, 2026**
  - Apply for exhibitor booth (~£3,000) AND speaker slot (a panel on "Bangladesh compliance transparency" is exactly right)
  - Target: sign up 40–80 UK buyers on the day

- **SOURCING at MAGIC, Las Vegas** — **August 10–12, 2026**
  - Business Solutions Center for tech platforms (~$3,500–8,000 booth)
  - Target: sign up 40–80 US buyers on the day

**Add to Phase 1 Roadmap under Sprint 11–12:**
```
Pre-Source Fashion (by June 30):
  - Public beta live with 500+ suppliers indexed
  - Demo mode (no login required to see supplier list)
  - Booth graphics, presentation deck prepared
  - LinkedIn at 500+ connections, 200+ sourcing director connections

Source Fashion July 7–9:
  - Live demo at booth
  - On-the-spot signup with laptop/tablet
  - Follow up all leads within 48 hours on LinkedIn

SOURCING at MAGIC August 10–12:
  - UFLPA compliance angle as primary US hook
  - On-the-spot signup flow
```

---

## GAP 13 — DEMO MODE (No Login Required)

For trade shows and cold outreach, buyers need to explore the platform without signing up. Not in the spec.

**Implementation:**
- Public `/discover` page with limited data (no contact details, score rings visible)
- Public supplier profile at `/suppliers/[slug]` with blurred contacts and a "Sign up free" CTA
- 14-day free trial triggered from profile page
- No Redis auth required for public routes — Cloudflare caches these aggressively

**Conversion funnel:**
```
Demo visit → saved_supplier event (requires signup) → free trial → paid plan
```

---

## GAP 14 — IN-APP ONBOARDING TOUR (Missing from Feature Spec)

First-time buyers need guidance. Add:
- A 5-step interactive tour on first login (can use `react-joyride` or build custom)
- Empty state copy for each section (e.g., "You haven't saved any suppliers yet. Start by searching for WRAP-certified knitwear factories.")
- Progress indicator in sidebar: "Complete your profile" with % bar

---

## SUMMARY: WHAT TO ADD TO THE MASTER SPEC

| Gap | Priority | Phase |
|---|---|---|
| Buying house ↔ factory relationship mapping | Critical | Phase 1 |
| Supplier claim/portal (buying houses first) | Critical | Phase 1 |
| Smart matching / order spec engine | High | Phase 1 |
| Landing/marketing website | High | Phase 0 |
| Buying house profile (different layout) | High | Phase 1 |
| Admin panel + bulk import tool | Critical | Phase 1 |
| Reviews schema (stub) | Medium | Phase 1 schema, Phase 2 UI |
| Notification preferences table | Medium | Phase 1 |
| UFLPA in SBI score (not just compliance page) | Medium | Phase 1 |
| Fibre traceability as score component | Medium | Phase 1 |
| Demo mode (no login) | High | Phase 1 |
| Trademark filing + legal tasks | Critical | Phase 0 NOW |
| Source Fashion + MAGIC in roadmap | High | Phase 1 |
| Referral revenue stream docs | Low | Phase 2 |
| Onboarding tour | Low | Phase 1 polish |

---

*Addendum v1.1 — 12 gaps identified from full transcript review*
*Merge with SourceBD_Master_Spec.md before distributing to dev team*
