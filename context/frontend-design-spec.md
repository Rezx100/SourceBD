# SourceBD — Front-End Design Spec

> **Status:** Authoritative for Phase 1 design. Supersedes `context/ui-context.md` (deprecated — built before the data moat existed).
> **Audience:** Whoever designs and builds the Next.js 15 App Router front end.
> **Grounded in:** the live database at `109.104.153.228` as audited on this file's creation date — every coverage % below is measured, not aspirational. Re-audit before any major IA decision.

---

## 0. Why this file exists

`ui-context.md` was written before Phase 0 was built. Many fields it referenced (`bh_factory_relationships`, geo `lat/lng`, the `rjsc_reg_number` column on `suppliers`, the supplier-to-supplier graph) don't exist yet, and several fields it didn't mention (the 7,049-PDF compliance mirror, the 2-tier registry-pill view with inherited extension rows, the `progress_pct` single-number RSC field) carry the moat. The design must be built off what the database actually returns *today*, with reserved slots for known Phase-2+ tables.

These invariants from `ui-context.md` remain in force (preserved, not deprecated):

1. **No SBI numeric in any non-admin surface.** Never render `sbi_scores.total`, any `pillar_*` value, the string "SBI", "Score", "Rating", or A-D letter grades. RLS already blocks selection. Server-side `ORDER BY sbi_scores.total DESC` is allowed because the value is consumed in the query and never serialised.
2. **Verified-sources signal is mandatory on every supplier card and profile header, using one shared glyph across both surfaces (decided 2 Jul, UX audit, shipped in `DiscoverResultCard`; unified onto profile headers 5 Jul during the card-faithful profile overhaul).** Both list cards (Discover, Saved, Smart Match, dashboard — all routed through the single shared `components/discover/result-card.tsx`) and the full profile header (`components/supplier/company-profile-header.tsx`) use `CompanyAvatar` (`components/supplier/company-avatar.tsx`): a neutral identity tile — two-letter monogram today; the component also accepts a `logoUrl` for when `suppliers` gains a logo column, not yet true in production — with a small monochrome checkmark seal (yes/no verified, no number on the seal itself), plus the precise count in plain text ("Verified by N independent sources") at the same visual weight as the surface's other facts. `ReceiptsRing` (`components/receipts-ring.tsx`) is retired from the profile header but not deleted — it remains available for inline mention-chip contexts per its own doc comment. Registry/cert marks (`ProfileSourceMark` on profile, `RegistryMark` on Discover cards) are compact uniform tiles (real provider logo or a short text code) with no color-coding — same reasoning: no mark should visually outrank another. Rationale: a numeric badge as every surface's "face" invited glance-comparison across a results grid ("this one has more badges"), which conflicts with platform neutrality; the seal answers "is this verified" without turning source count into a leaderboard. Using one identity glyph everywhere also makes the profile and its own preview card read as the same product. Count payload is unchanged: distinct Tier 1–3 sources, saturated at 5+.
3. **Completeness badge** is the only "quality" indicator visible to buyers. Rendered as a quiet outline pill (`CompletenessPill` in `result-card.tsx`, bands from `lib/completeness-band.ts`) — icon + border carry the semantic colour; pill text stays neutral except in the red (< 40%) band, so completeness never out-shouts the verified-sources count next to it. See §14.2 for the exact band cutoffs.
7. **"Follow," not "Save."** The save/unsave action (`components/save-button.tsx`) is labelled Follow/Following with a bell glyph, not Save/Saved with a star — following a supplier enrols the buyer in cert/registration-change alerts by default (opt-out in Settings), which a bookmark icon doesn't communicate.
4. **Contact PII is gated server-side.** Hiding it in the UI is not a control — `email_primary`, `phones`, `contact_name`, `contact_role` must come back redacted from the API for unauthenticated/unauthorised callers.
5. **Sanctions banner.** Any active hit forces a top-of-profile red banner that overrides marketing chrome.
6. **The Tier hierarchy is law** (see [architecture.md](architecture.md)). UI never shows a Tier 6 source as primary.

---

## 1. Stack & design tokens (locked by [architecture.md](architecture.md))

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, RSC default) |
| Language | TypeScript strict |
| Styling | Tailwind utility classes only, `cn()` helper |
| Component primitives | Magic UI for new visual/layout components; shadcn/ui (Radix under the hood) for controls/dialogs/forms |
| Icons | Phosphor Icons (`@phosphor-icons/react`) |
| Display font | Archivo — unified across marketing, auth, buyer, supplier, and admin |
| Body font | Hanken Grotesk — unified across marketing, auth, buyer, supplier, and admin |
| Mono font | IBM Plex Mono — unified across marketing, auth, buyer, supplier, and admin |
| Auth UI | Supabase Auth (buyer / supplier / admin) |
| Data | Supabase JS + RLS — never bypass with a service role for buyer-facing reads |
| Tables / virtual lists | TanStack Table + virtualisation for any list > 50 rows |
| Forms | React Hook Form + Zod |
| Analytics | PostHog |
| Errors | Sentry |

Do not introduce a different component lib, icon set, font, table lib, or styling system without a Hard-Rule-4 exception.

**Unified visual system (Spec FE-SITEWIDE, 19 Jun 2026).** Marketing,
public data pages, and the logged-in portal share one light SourceBD SaaS
language: neutral page canvas, white hairline cards, Archivo display,
Hanken Grotesk body, IBM Plex Mono data labels, Phosphor icons, Magic UI
for new visual/layout components, and shadcn primitives for controls. The
older split between marketing fonts and app fonts is retired because the
platform must read as one company product from `/` through `/app`,
`/supplier`, and `/admin`. New UI work stays light mode only and should
avoid adding legacy prototype-only colour systems.

---

## 2. Information architecture & roles

Three role surfaces, three top-level route groups:

```
/app                 → buyer surface (default after sign-in if role = buyer)
/supplier            → supplier portal (role = supplier, claimed company)
/admin               → admin console (role = admin only; RLS-protected)
/                    → marketing site (anonymous)
```

Roles come from `auth.users` → `public.profiles.role` (Phase 1 spec). Server enforces; UI hides accordingly but never assumes the user-agent is honest.

### 2.1 Buyer sidebar (collapsed by default ≥ md, persistent open ≥ xl)

| Slot | Icon (Phosphor) | Route | Phase |
| --- | --- | --- | --- |
| Discover | `MagnifyingGlass` | `/app/discover` | B1 |
| Smart Match | `Sparkle` | `/app/match` | B4 |
| Saved | `BookmarkSimple` | `/app/saved` | B5 |
| Messages | `ChatCircleText` | `/app/messages` | B6 |
| RFQ Manager | `FileText` | `/app/rfqs` | B7 |
| Orders | `Package` | `/app/orders` | B8 |
| Compliance Hub | `ShieldCheck` | `/app/compliance` | B9 |
| Settings | `GearSix` | `/app/settings` | B10 |

Top bar (every authenticated route): logo (left) · global search bar (centre, opens `/app/discover?q=`) · notification bell · avatar menu (Account · Workspace · Billing · Sign out).

### 2.2 Supplier sidebar

| Slot | Route | Phase |
| --- | --- | --- |
| Dashboard | `/supplier` | S1 |
| Company profile editor | `/supplier/profile` | S2 |
| Inquiries | `/supplier/inquiries` | S3 |
| RFQs received | `/supplier/rfqs` | S4 |
| Documents (claim verification, certs upload) | `/supplier/documents` | S5 |
| Settings | `/supplier/settings` | S5 |

### 2.3 Admin sidebar (the **only** surface where SBI numeric may appear)

| Slot | Route | Phase |
| --- | --- | --- |
| Overview | `/admin` | A1 |
| Supplier review queue | `/admin/queue` | A2 |
| Claim verification | `/admin/claims` | A3 |
| Sources & ingestion | `/admin/sources` | A4 |
| Scoring (`sbi_scores` debug) | `/admin/scoring` | A5 |
| Users & access | `/admin/users` | A6 |

### 2.4 Marketing IA (anonymous)

`/` (home) · `/buyers` (M1) · `/suppliers` (M2) · `/pricing` (M3) · `/about` (M4) · `/legal/*` (M5) · `/blog` (deferred).

---

## 3. Page inventory mapped to data-moat readiness

Legend: **R**eady (data layer complete) · **P**artial (some fields populated, some Phase-2) · **F**uture (table or column doesn't exist yet — design a slot but don't ship a feature).

### Buyer (Phase 2)

| ID | Page | Route | Status | Notes |
| --- | --- | --- | --- | --- |
| B1 | Discover (search) | `/app/discover` | R | All filter facets covered (§5) |
| B2 | Factory profile | `/app/suppliers/[slug]` | R | Anatomy in §4 |
| B3 | Buying-house profile | `/app/suppliers/[slug]` (same route, branches on `entity_type`) | P | Partner-factory tab is **F** until `bh_factory_relationships` ships |
| B4 | Smart Match | `/app/match` | F | Needs scoring service to expose match shortlist API |
| B5 | Saved + Dashboard | `/app/saved`, `/app` | R | "Saved" = `saved_suppliers` Phase 1 table |
| B6 | Messages | `/app/messages/[threadId]` | F | Needs `threads`, `messages` Phase 1 tables |
| B7 | RFQ Manager | `/app/rfqs` | F | Needs `rfqs` table |
| B8 | Orders | `/app/orders` | F | Out of scope until late Phase 2 |
| B9 | Compliance Hub | `/app/compliance` | R | Pure reporting over `compliance_documents` + `rsc_industry_metrics` |
| B10 | Settings / billing | `/app/settings` | F | Stripe wiring in a later spec |

### Supplier (Phase 3) — S1–S5 all F until claim flow ships.

### Admin (Phase 4) — A1–A6.

### Marketing (Phase 5) — M1–M5.

---

## 4. Company-profile anatomy (B2 / B3) — the canonical page

The profile is the moat made visible. It is a single page with tab-routed sections. The header is always rendered; tabs lazy-load.

URL: `/app/suppliers/[slug]` (slug exists on 100% of published suppliers).

### 4.1 Header (always visible)

```
┌────────────────────────────────────────────────────────────────────────┐
│  ╭──────╮                                                              │
│  │ RING │  COMPANY NAME (Bricolage Grotesque 36/40)                    │
│  ╰──────╯  [factory]  ·  Gazipur, Dhaka  ·  [Completeness: 78%]        │
│            ▸ Part of NASSA Group  →                                     │
│  ─────────────────────────────────────────────────────────────────────  │
│  [BGMEA 1234] [BKMEA 567] [RSC] [EPB] [BGAPMEA] [BTMA] [GOTS] [OEKO-TEX]│
│  [WRAP] [SA8000]  ·  + 2 more  ·  via [parent factory] for 2 of these   │
│  ─────────────────────────────────────────────────────────────────────  │
│  ⚠  Listed on UFLPA Entity List — see "Compliance" tab.  (red, only    │
│      when sanctions match exists; else omitted entirely)                │
└────────────────────────────────────────────────────────────────────────┘
```

Header data sources (column → coverage of published universe):

| Field | Source | Coverage |
| --- | --- | --- |
| Verified Sources Ring count | `count(distinct source_id)` over Tier 1–3 active `source_records` for this supplier (saturated at 5+) | 100% (every published supplier has ≥1) |
| Ring distribution to design for | 1 source: 7,329 (72%) · 2: 1,420 (14%) · 3: 640 (6%) · 4: 405 (4%) · 5+: 327 (3%) | — |
| Company name | `suppliers.company_name` | 100% |
| Entity type chip | `suppliers.entity_type` enum (factory / buying_house / unknown) | 100% (factory 86%, BH 14%) |
| Location text | `suppliers.city`, `suppliers.district` | 97% / 97% (renders "Unknown" for the 270-supplier hard-wall residue) |
| Completeness badge | `suppliers.completeness_pct` (smallint 0–100) | 100% |
| Parent-group line | `suppliers.parent_group_name` | 13.3% — render only when present, link to `/app/discover?group=…` |
| Pill row | `v_supplier_registry_ids` (10-pill universe, includes inherited rows from migration 0021 with `inherited_from_name`) | 100% (everyone has ≥1) |
| Sanctions banner | match in `sanctions_list_entries` via `company_name_norm = entity_name_norm` AND `country='Bangladesh'` | 0 today; design the slot, render only when match exists |

**Pill chip variants:**

- *Direct pill* (`inherited_from IS NULL`): solid background, source code + reg number when present (e.g. `BGMEA 1234`).
- *Inherited pill* (`inherited_from IS NOT NULL`): dashed border, smaller dot indicator, tooltip = "via {inherited_from_name}". Clicking the pill navigates to the parent profile. This is the **RSC sibling/extension wedge** (761 inherited rows / 207 satellites, migration 0021).

### 4.2 Tab bar

`Compliance` (default) · `Overview` · `Capacity` · `Documents` · `Contact`

> Removed from initial scope: a "Reviews" tab. No review table exists; do not stub a UI for it.

### 4.3 `Compliance` tab — the moat tab

Six stacked cards. Render only the cards with data; omit empty cards entirely.

1. **Registry pills (expanded view).** The full chip grid from header, each chip expandable to show:
   - Source code, tier label, reg number (when present), last seen timestamp from `source_records.last_seen_at`, link to underlying `source_records.source_url`.
   - For inherited pills: parent factory chip + "Why?" disclosure linking to the migration-0021 explanation card.

2. **Certifications.** From `public.certifications`. Card per row.
   - `OEKO_TEX` (2,856 records on 2,453 suppliers): always shows `issuer` (100%) + `document_url` (100%). **No expiry exists** (with_expiry = 0) — do not render an expiry chip for OEKO_TEX even if the column is non-null; treat as "evergreen" until reissue. Show "Reissued/superseded" only when ETL marks it.
   - `GOTS` (884 / 856): 100% expiry, 93% currently valid, 79% with `document_url`.
   - `WRAP` (434 / 422): 100% expiry, 85% currently valid, 100% with `document_url`.
   - `SA8000` (7 / 6): tiny — do not feature in marketing, but render normally on the few profiles that have it.

   Each cert card: kind icon · cert no · issuer · expiry chip (`Valid` green / `Expires soon` amber / `Expired` red / `n/a` neutral) · "View certificate" → opens `document_url` in new tab. **Never inline a PDF**; we don't control those URLs.

3. **RSC remediation** (renders only when supplier has a `rsc_remediation` row — 2,227 of 10,121, i.e. 22%).
   - Hero metric: `progress_pct` shown as a horizontal progress bar with the number. Population: 100% of remediation rows. Use industry median (95%) as the reference tick.
   - Sub-metrics: `workers_count` (93% of remediation rows), `remediation_status` text, `training_status` text, `parent_group_factory_count` (when present, link to other factories in group).
   - Inspection-document chips, four max + the CAP. Each chip = doc icon + label + "Mirror" link + "RSC source" link. Coverage:
     - Fire 1,981 / 2,227 (89%)
     - Structural 1,978 (89%)
     - Electrical 1,989 (89%)
     - Boiler 932 (42%) — show "n/a" not "missing"; not every facility has a boiler.
     - CAP 2,029 (91%).
   - Primary link target = `compliance_documents.mirror_url` (CDN-hosted), fallback to RSC URL when no mirror.

4. **Brand attribution** (when present). From `source_records` where `sources.code LIKE 'BRAND_%'`. Show one chip per brand: H&M (191), Next (76), M&S (67), ASOS (43). Click → `source_url` to brand's published factory list. Do not render Inditex / Primark slots even though they're reserved — only show what we have. **Brand attribution does not mean endorsement; render as "Disclosed on {brand}'s factory list" not "Approved by {brand}".**

5. **Sanctions hits** (when present — currently 0). Card design must exist; render top-of-tab in red when any match. Each entry: list name, entry ref, source URL, listed date.

6. **Provenance footer.** Always rendered, last card of the tab. Lists every distinct active `source_records` row for this supplier with `source_url`, `last_seen_at`, and the tier badge. This is the "show your work" surface. Open with a `<details>` collapsed by default; show count in summary ("Verified evidence: 17 records across 5 sources").

### 4.4 `Overview` tab

| Block | Source | Coverage | Render rule |
| --- | --- | --- | --- |
| Address | `suppliers.address_raw` + view `v_supplier_addresses` (multi-address) | 92% address_raw | Show primary `address_raw`. If `v_supplier_addresses` has > 1 distinct row, show a "+ N other addresses on file" disclosure. Do not render a map (no `lat/lng` — column is 0% populated). |
| Established | `suppliers.established_date` | 35.3% | Render only when present, format as year (the column is text — guard parse). |
| Factory types | `suppliers.factory_types[]` | 70.2% | Pill row, ≤ 4 visible + overflow. |
| Principal products | `suppliers.principal_products[]` | 55.6% | Same. |
| BEPZA zone | `suppliers.bepza_zone` | 2.9% | Render only when present. |
| Group | `suppliers.parent_group_name` | 13.3% | Section linking to other group members via Discover filter. |

### 4.5 `Capacity` tab

Render the whole tab only when **at least one** capacity field is present. Empty-state otherwise = entire tab hidden.

| Field | Source | Coverage |
| --- | --- | --- |
| Sewing machines | `suppliers.machines_sewing` | 46.5% |
| Production capacity (dozen/year) | `suppliers.production_capacity_dozen_yearly` | 34.1% |
| Production capacity (pcs/day) | `suppliers.production_capacity_pcs_day` | 15.6% |
| Workforce total | `suppliers.employees_total` | 56.4% |
| Workforce male / female split | `suppliers.employees_male` / `employees_female` | 30% / 29% |

Layout: 2-up stat tiles for whichever fields are present. Never compute a "throughput" that the data doesn't support.

### 4.6 `Documents` tab

A flat list of every mirrored PDF from `compliance_documents` for this supplier, grouped by `doc_type` (cap, electrical, fire, structural, boiler). 7,049 docs across the moat — designed to be the destination of every "View certificate" click that lands on a mirror URL. Each row: doc type · `fetched_at` · "Open mirror" (preferred) · "Open original".

### 4.7 `Contact` tab — **gated**

The server returns these fields **only** when the requester is (a) signed in AND (b) has a workspace with seat allocation, or (c) is an admin. Anonymous and free-tier authenticated users get a 200 with the contact fields nulled and a `gated: true` flag.

| Field | Coverage | Render |
| --- | --- | --- |
| `email_primary` | 79.8% | Click-to-copy + `mailto:` |
| `phones[]` | 78.3% | Click-to-copy per number |
| `contact_name` | 82.5% | Plain text |
| `contact_role` | 79.3% | Plain text |
| `website` | 17.9% | External link with `rel="noopener noreferrer"` |

Gated empty-state: "Contact details unlocked on paid plans" + CTA → `/pricing`. **Do not** ship a UI that fetches contacts and hides them with `display: none`; the data must not reach the client.

### 4.8 Buying-house (B3) profile diff

Same anatomy, with these differences:

- Entity-type chip says `buying_house`.
- Compliance tab's RSC card and most cert kinds are usually empty for a BH; render only what exists.
- Add a "Partner factories" tab — **Future**. Reserve the slot with an empty state ("Partner-factory disclosures coming with the BH relationship graph in Phase 2"). Do **not** ship logic against a table that doesn't exist (`bh_factory_relationships` is not in the DB yet).

---

## 5. Discover (B1) — search page

URL: `/app/discover`. The page is server-rendered on first load (RSC), then hydrates with a client component for the filter rail + facet counts.

### 5.1 Layout

```
┌───────────┬──────────────────────────────────────────────────────────┐
│ Filters   │  ┌────────────────────────────────────────────────────┐  │
│ (rail,    │  │ Search: "knit factory in Gazipur with GOTS"  ⌘K    │  │
│  sticky)  │  └────────────────────────────────────────────────────┘  │
│           │  [Sort: Most evidence ▾]   1,420 results · Saved (12)   │
│           │  ┌──── result card ──────────────────────────────────┐  │
│           │  │ ◯ NAME · factory · Gazipur · 78%  ★              │  │
│           │  │ [BGMEA] [RSC] [GOTS] [OEKO-TEX]  +3              │  │
│           │  └────────────────────────────────────────────────────┘  │
│           │  …(virtualised, 50/page) …                              │
└───────────┴──────────────────────────────────────────────────────────┘
```

### 5.2 Search input

- Single text input. Server uses Postgres FTS over `company_name_norm` + `pg_trgm` similarity fallback for short queries.
- `Cmd/Ctrl-K` opens a command-palette modal over the same search (top-bar global search re-routes here).

### 5.3 Filter rail (in this order, top to bottom)

| Group | Control | Backing column / table |
| --- | --- | --- |
| **Entity type** | Multi-select pill group: Factory · Buying house · Unknown | `suppliers.entity_type` |
| **Verified sources** | Range slider 1–5+ | computed (Spec 12) |
| **Registry membership** | Checkbox group: BGMEA · BKMEA · BGAPMEA · BTMA · EPB · RSC | `v_supplier_registry_ids` (direct OR inherited) |
| **Certifications** | Checkbox group: GOTS · OEKO-TEX · WRAP · SA8000 (valid today / any) | `certifications` |
| **RSC progress** | Range slider 0–100 | `rsc_remediation.progress_pct` |
| **Location** | Hierarchical select: District → City (top 20 listed, "more" reveals long tail) | `suppliers.district`, `suppliers.city` |
| **Factory types** | Multi-select (top-20 facets) | `suppliers.factory_types[]` |
| **Principal products** | Multi-select (top-20 facets) | `suppliers.principal_products[]` |
| **Workforce** | Range slider | `suppliers.employees_total` |
| **Brand attribution** | Checkbox group: H&M · Next · M&S · ASOS | `source_records` joined on `BRAND_*` |
| **Parent group** | Searchable single-select | `suppliers.parent_group_name` |
| **Completeness** | Range slider | `suppliers.completeness_pct` |
| **Sanctions** | Toggle "Hide sanctioned" (default ON) | `is_sanctioned` |

All filter URLs are **deep-linkable** — Discover state lives in `searchParams`.

### 5.4 Sort options

- **Most evidence** (default; server `ORDER BY t13_source_count DESC`).
- **Relevance to query** (when there's a `q`; uses FTS rank).
- **Most complete profile** (`completeness_pct DESC`).
- **Recently updated** (`max(source_records.last_seen_at) DESC`).
- **Smart-Match score** — *server-side `ORDER BY sbi_scores.total DESC` is allowed since the value never leaves the query.* Label this sort "Best match for your brief" if and only if a Smart Match brief context exists; otherwise hide the option.

### 5.5 Result card anatomy

```
◯ COMPANY NAME · factory · Gazipur, Dhaka · 78%             ★ saved
  [BGMEA 1234] [RSC] [GOTS] [OEKO-TEX]   + 3 more
  Established 2008 · 4,500 employees · Knit composite
```

- Ring on the left: same Verified Sources Ring as profile header, smaller.
- Pill row: top 4 by tier priority, then count of remainder. Inherited pills get the dashed-border variant here too.
- Stat line: render fields that are populated; omit those that aren't (no "n/a" everywhere — empty space is fine).
- Save star: optimistic UI; calls Phase 1 `saved_suppliers` endpoint.

### 5.6 Empty / zero-result states

- **No query, no filters:** show 50 highest-evidence suppliers (default discovery).
- **Filtered to zero:** "No suppliers match these filters. Try removing {weakest filter}." Provide a single click to clear.
- **Tier-6-only would-be-result is omitted entirely** — that data tier never appears in Discover by hard rule.

---

## 6. Smart Match (B4) — Future

Reserve route `/app/match`. Spec-3 of Phase 2 will define the brief form (categories, MOQ, lead time, capabilities, certs required). Don't ship UI yet — design only.

---

## 7. Saved & Dashboard (B5)

`/app` (dashboard home post-sign-in):

- Top row: 3 stat tiles — Saved suppliers · Active RFQs · Unread messages.
- "Saved" section: card grid using the same result-card component as Discover.
- "Recently viewed" section: from `recent_views` (Phase 1 table to design — store last 50 per user).
- "Newly verified in your industry" section (P): pulls suppliers whose verified-source count increased in last 30 days; needs an audit/diff table — design only.

`/app/saved`: same result-card grid, sortable, with bulk-action toolbar (Add to list · Remove · Export CSV).

---

## 8. Messaging, RFQ, Orders (B6–B8) — Future

Skeletons only. Each needs its own Phase-2 spec defining the schema. Reserve the routes and sidebar slots.

---

## 9. Compliance Hub (B9)

`/app/compliance` — industry-wide read view over `compliance_documents` + `rsc_industry_metrics`.

- **Doc browser:** filter `compliance_documents` by `doc_type` (cap / fire / structural / electrical / boiler), supplier, fetched-at range. Bulk-download a ZIP (server-streamed) of selected mirror URLs. 7,049 docs total.
- **Industry metrics:** time-series charts off `rsc_industry_metrics` (use Recharts).
- **Search tab:** name search → opens the matching supplier's profile Documents tab.

No write surface. This is reporting only.

---

## 10. Settings (B10)

`/app/settings/profile` · `/settings/workspace` · `/settings/team` · `/settings/billing` · `/settings/notifications` · `/settings/api-keys` (reserved).

Phase 1 ships only `profile` and `workspace`. Stripe/billing in a later spec.

---

## 11. Supplier portal (S1–S5)

Future for Phase 1, but design must reserve the schema:

- `/supplier` dashboard: views on own company · inquiries inbox · message threads.
- `/supplier/profile` editor: every field on `suppliers` we expose for self-edit goes here; **everything edited by supplier is `verified=false` until an admin approves it**. Edits never overwrite higher-tier source data (Hard Rule 5).
- `/supplier/documents`: upload of self-claimed certificates / BIN / RJSC docs → review queue.
- Claim flow: starts at `/app/suppliers/[slug]` "Claim this company" CTA → email + BIN cross-check.

---

## 12. Admin (A1–A6) — the ONLY surface where `sbi_scores` numeric may render

| Page | Purpose | Notes |
| --- | --- | --- |
| `/admin` | Overview | Counters: total suppliers, published, with-Tier1-3, review-queue depth |
| `/admin/queue` | Verification queue | Triage rows from `verification_queue` |
| `/admin/claims` | Claim-verification approvals | Approve/reject; writes `claimed_by` |
| `/admin/sources` | ETL job runs | List of last run per scraper, row deltas, errors |
| `/admin/scoring` | SBI debug | The only page that selects from `sbi_scores`; gated by `profile.role = 'admin'` AND a separate `admin_can_view_scoring` boolean. Never exports. |
| `/admin/users` | Roles, suspensions | |

---

## 13. Marketing (M1–M5)

`/buyers`, `/suppliers`, `/pricing`, `/about`, `/legal/*`. Tone = data-rooted, not pop-marketing. Use real numbers (10,121 published suppliers, 7,049 mirrored compliance docs) — but **never** show SBI numerics or pillar values. Avoid letter-grade aesthetics. Hero CTA → sign up as buyer.

---

## 14. Cross-cutting invariants (apply to every page)

1. **Verified-sources trust signal** is universal wherever a supplier name appears (cards, headers, mention chips), but the glyph is surface-specific (see invariant §0.2): `ReceiptsRing` on profile headers (48/64px) and inline mention chips (12px); `CompanyAvatar`'s monochrome checkmark seal + plain-text count on list cards (Discover, Saved, Smart Match, dashboard — shared via `DiscoverResultCard`).
2. **Completeness badge** rendered as an outline `{pct}%` pill (`CompletenessPill`) with semantic colour: < 40 red, 40–69 amber, 70–89 green, ≥ 90 emerald (`lib/completeness-band.ts`, CSS tokens `--sem-red/-amber/-green/-emerald`). From `suppliers.completeness_pct`.
3. **Source-pill provenance.** Every pill, badge, or claim that comes from a specific source must be click-traceable to the underlying `source_records.source_url`. No "trust us" badges.
4. **Gated contact PII.** Server returns nulls + `gated: true` when caller lacks entitlement. Client never receives the secret.
5. **Sanctions banner.** Red top-of-profile, dismissible only within a session.
6. **Inherited pill rule.** Always visually distinct (dashed border), always shows parent name on hover/click, never aggregated into the "verified sources" count — verified sources count is direct Tier 1–3 only.
7. **No SBI numeric** anywhere outside `/admin/scoring`. Server-side sort by SBI is allowed; serialising the value is not.
8. **Tier 6 sources** never decorate buyer-facing UI. They're allowed inside `/admin/sources` for ingestion debug only.

---

## 15. State conventions

### 15.1 Loading

- RSC route boundary uses `loading.tsx` with the shadcn `Skeleton` primitive.
- Result lists: render 8 skeleton cards then stream in.
- Profile header: skeleton ring + name lines; tabs lazy-load via Suspense.

### 15.2 Empty

- Filtered to zero: see §5.6.
- Profile tab with no data: omit the tab entirely (don't show a "Nothing here" page).
- Provenance footer: always present, never empty (every supplier has ≥1 source).

### 15.3 Error

- Network/Supabase error: shadcn `Alert` with a "Retry" action. Sentry-tagged.
- Auth required: server-side redirect to `/sign-in?next=…` before render.
- Permission denied: render `403` route group with a clear "Upgrade plan" or "Sign in" CTA.

### 15.4 Optimistic

- Save star, follow group, send inquiry — optimistic with rollback toast on failure.

---

## 16. Responsive breakpoints

| Tailwind bp | Use |
| --- | --- |
| `default` (< 640) | Mobile. Sidebar becomes bottom-nav (4 most-used slots). Filter rail becomes a drawer. Pill grid wraps to 2-col. |
| `sm` (≥ 640) | Same as mobile, slightly looser spacing. |
| `md` (≥ 768) | Sidebar appears collapsed (icon-only). Filter rail still drawer. |
| `lg` (≥ 1024) | Sidebar expanded, filter rail inline. Result cards 2-col. |
| `xl` (≥ 1280) | Result cards 3-col on Discover, 4-col on Saved. |
| `2xl` (≥ 1536) | Profile tab content max-width 1100px (centered), header full-bleed. |

Mobile invariants: Verified Sources Ring never smaller than 24px; pill text never below 12px; tap targets ≥ 44px.

---

## 17. Accessibility checklist (non-negotiable)

- All Phosphor icons that aren't pure decoration carry `aria-label`.
- Verified Sources Ring: `role="img"` with `aria-label="3 verified sources"`.
- Colour is never the only signal — every state has a glyph or text affordance.
- Keyboard: full tab order, ⌘K opens search, `?` opens shortcut help.
- `prefers-reduced-motion`: disable ring "fill-in" animation.
- Contrast: 4.5:1 minimum for all text on backgrounds, 3:1 for UI components.

---

## 18. Things explicitly **not** to design yet

- Maps / geo views — no `lat/lng` populated (0%).
- Side-by-side compare — defer to Phase 2.
- Reviews / ratings — no schema.
- Public profile pages (anonymous-visible) — Phase 5 marketing concern; the buyer profile assumes auth.
- BH ↔ Factory relationship visualisations — `bh_factory_relationships` doesn't exist.
- Tier-5 sanctions cross-screen at scale — no rows linked yet; the per-profile banner is the only render path today.

---

## 19. Live coverage snapshot (from VPS at file creation)

Use these numbers to size empty-state copy, default sorts, and feature rollouts.

| Metric | Value |
| --- | --- |
| Suppliers total / published | 10,189 / 10,121 |
| Factories / Buying houses | 8,677 / 1,444 |
| Verified sources ≥ 2 distinct T1-3 sources | 2,792 (27.6%) |
| Verified sources = 1 | 7,329 (72.4%) |
| RSC remediation rows | 2,227 (median progress 95%) |
| Compliance docs mirrored | 7,049 across 5 doc types |
| OEKO-TEX certs | 2,871 (2,453 suppliers) |
| GOTS certs valid today | 823 of 884 (93%) |
| WRAP certs valid today | 369 of 434 (85%) |
| Suppliers in a parent group | 1,348 (top group: Biswas 21) |
| `address_raw` populated | 92% |
| `email_primary` populated | 80% |
| `website` populated | 18% |
| Brand-disclosed factories | H&M 191 · Next 76 · M&S 67 · ASOS 43 |
| Sanctions hits today | 0 (slot still required) |
| Inherited RSC-sibling rows (mig 0021) | 761 across 207 satellites |

---

## 20. Open design questions (resolve before B2 ships)

1. **Inherited pill — how strong is the visual demotion?** A dashed border may not be enough at 12px. Consider a tiny "↳" prefix glyph on inherited pills.
2. **Multiple-address disclosure on the profile header** — full-width sub-line, or click-through from the location pill?
3. **Verified Sources Ring tooltip copy** — finalise the one-liner. Current draft: "{n} of 5 verified registries". Avoid "score", "rating", "grade".
4. **Brand attribution wording** — confirm legal: "Disclosed on H&M's published supplier list" vs. "Listed by H&M". Coordinate with legal review before M1.
5. **Sanctions banner severity grades** — UFLPA / WRO / OFAC SDN vs UK OFSI vs EU SANC. Today all are red; should some be amber? Decide before the first hit lands.

End of spec.
