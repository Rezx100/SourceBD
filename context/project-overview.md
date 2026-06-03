# SourceBD — Project Overview

## One-sentence pitch
SourceBD is a B2B intelligence SaaS that gives UK/US/EU/CA fashion buyers **verified, source-linked compliance evidence** on every Bangladesh RMG factory and buying house — so they can discover, vet, and source with confidence. We surface the **receipts** (cert badges, register links, RSC remediation %, named-source provenance), not opinions packaged as a proprietary score.

## Why this wins
The moat is **authoritative, deduplicated, cross-checked Bangladesh supplier data** — RSC remediation status, BGMEA/BKMEA/BTMA/BGAPMEA membership, WRAP/OEKO-TEX/GOTS certifications, brand supplier-list disclosures (H&M, Inditex, Primark, ASOS…), UFLPA/WRO sanctions screening, and the unique buying-house ↔ factory relationship graph. No competitor has this in one place.

## Goals (v1)
1. Build the **data moat first**: 2,000+ verified suppliers with cross-source verified compliance evidence before any user logs in. *(Shipped — 10,186 suppliers as of Phase 0 close.)*
2. Ship a buyer SaaS where a UK/US sourcing director can find a compliant Bangladesh supplier in <5 minutes via Smart Match.
3. Launch as a **free, online-first public beta of indefinite duration** — no trade-show attendance, no paid tiers — until usage signals warrant monetisation.

## Core user flow (buyer)
1. Lands on marketing site → sees live "verified suppliers" counter + **evidence-verification methodology** (how we cross-check across Tier 1–3 sources).
2. Signs up (14-day free trial) or browses public Discover (blurred contacts).
3. Uses Smart Match wizard (3 steps: product → requirements → ranked matches with "why matched" explanation).
4. Opens supplier profile → **compliance receipts panel** (cert badges + issuer + expiry + document, register memberships with reg numbers, RSC remediation %, brand-disclosure attributions, completeness badge, source-pill provenance for every field), partner factories, media gallery, reviews, contact (gated by plan).
5. Sends RFQ / message → tracks conversation → optionally tracks order to port.

## Features in scope (v1)
- Public marketing site (sourcebd.com) with live counter, **evidence-verification methodology** page, compliance education.
- Buyer app: Dashboard, Smart Match, Discover, Factory profile, Buying-house profile, Messages, Order Tracking, Compliance Hub, RFQ Manager, Settings. **Every supplier surface is receipts-first**: cert badges + register links + RSC % + source pills, never a SourceBD-proprietary numeric score.
- Supplier portal: claim profile, dashboard, edit profile, manage incoming RFQs, upload certs/photos.
- Admin panel: supplier CRUD, bulk CSV import, score recalculation, certification verification queue, sanctions queue, user management. **Admin tools may surface the internal SBI signal; buyer/supplier surfaces never do.**
- **SBI scoring engine (internal-only sort signal — α/β/γ decision, 2026-05-20).** 4-pillar calculator continues to compute per supplier and back the default server-side ranking + admin alerting + change-detection. The numeric SBI total is **never** returned to unauthenticated clients, buyer surfaces, supplier surfaces, or the marketing site. A user-facing aggregate, if ever shipped (Phase 1+, design pending), will be a **tier label** (Bronze / Silver / Gold / Platinum) derived from counts of independent Tier 1–3 sources, not a 0–100 score.
- Buying-house ↔ factory relationship graph (the unique product wedge).
- Sanctions screening (UFLPA Entity List, US WRO, UK/EU sanctions).

## Out of scope (v1)
- Transactional payments / escrow (SourceBD is **never** a transaction platform).
- Mobile apps (responsive web only).
- AI-generated outreach copy / chatbots.
- Real-time multiplayer features.
- Localisation beyond English.
- Self-serve API for third parties.
- Public review system (schema only — UI in v2).

## Success criteria (v1)
- ≥ 2,000 suppliers in production DB, each with ≥1 Tier 1–3 source verified.
- ≥ 1,500 factories cross-checked against RSC fire/structural data.
- ≥ 90% of suppliers have a computed **internal** SBI score (server-side sort signal; not user-facing).
- 100% of suppliers screened against UFLPA Entity List + US WROs.
- **Free public beta live on production**, public status page + in-app feedback loop operational, 30 consecutive days of zero P1/P2 incidents.

## Go-to-market
Free, online-first public beta of indefinite duration. The platform is published at zero price while we gather end-to-end usage and quality signals; trade-show attendance, paid tiers, and Stripe checkout are deferred until validated product-market fit signals warrant monetisation. See `context/phases.md` → "Deferred until post-beta" for the exhaustive list of items that are explicitly off the roadmap.

## Audience
Sourcing directors, ethical/compliance leads, and procurement managers at UK/US/EU/CA fashion brands and importers (£36M+ UK MSA threshold companies are the bullseye).

## Founder asset
Built by a Bangladeshi founder with direct access to BGMEA/BKMEA registers and on-the-ground verification capacity — that's the brand story and a real defensibility advantage.
