# SourceBD — Architecture

> The law. No tool not listed here may be added without a spec change approved by the user.

## Tech stack

### Data layer (built FIRST in Phase 0)
- **Database**: PostgreSQL via **Supabase** (managed, with RLS, full-text search, `pg_trgm`, `pgvector` for future).
- **ETL / scraping**: **Python 3.12** with `pdfplumber`, `requests`, `beautifulsoup4`, `playwright`, `rapidfuzz`, `python-slugify`, `unidecode`. One-off scripts in `etl/` directory of the monorepo.
- **Web data acquisition**: **Firecrawl Cloud API** (approved as a Hard-Rule-4 exception by founder on 29 Jul 2026). Scope: the **acquisition concern only** — fetching HTML pages and discovered documents. Parsing and persistence stay in our own Python, so field fidelity under Hard Rule 5 is never delegated to a third party. Implemented as one adapter behind `etl/acquire/` (`FirecrawlAdapter`), alongside `DirectAdapter` (httpx, for JSON/CSV/XML/XLSX/Power-BI transports Firecrawl cannot express) and `LocalFileAdapter` (on-disk sources). Key `FIRECRAWL_API_KEY` (server-only; never exposed to the browser). **Extraction is deterministic**: we request `markdown` + `rawHtml` at 1 credit/page and run our own parsers. Firecrawl's LLM `json` mode is deliberately NOT used for registry facts — it is non-deterministic and would put a language model between a government/association register and a stored fact. Per-source config (`only_main_content=false` for registry tables, custom `headers`, `proxy`, `actions`, `parsers`) lives in each source definition so cost and anti-bot behaviour are explicit. Notes: sending `headers` forces `storeInCache=false` upstream; `zeroDataRetention` is incompatible with the `screenshot` format, so ZDR and archived snapshots are mutually exclusive per request; `proxy="auto"` silently escalates to 5 credits on retry, so it is opt-in per source. We consume the Cloud API and do **not** self-host, so the AGPL-3.0 licence of the open-source distribution does not bind this repo. Credits are recorded per acquired document (`evidence_documents.credits_used`) and surfaced in `/admin/sources`.
- **Provenance / evidence**: every stored fact is citable to a live URL via `evidence_documents` + `evidence_claims` + `evidence_verifications` (mig `0084`). A claim stores the field key, the value as cited, a `locator` (CSS selector / table row / PDF page / JSON pointer) and a verbatim `excerpt`, so "the link still contains this fact" is machine-checkable rather than assumed. Dead or drifted citations fall back to a dated Bunny snapshot and raise an admin review item; a single transient fetch failure never marks a link dead. When a newer claim retires an older one for the same subject+field, the retirement is `superseded` (bookkeeping, hidden) whenever the replacement is the same page refetched, the same value elsewhere, or the SAME scraper updating itself across a page move — `contradicted` is reserved for cross-scraper disagreement, the only kind worth operator review (REZ-36 follow-up, 2 Aug 2026: BKMEA re-listings had been filing their own updates as contradictions, 396 claims in one run).
- **Change-skip (REZ-36)**: every record through `upsert_supplier_with_source` is compared against the stored `source_records.raw_hash` for its `(source_id, source_ref)`. An unchanged payload skips the enrich, the source-record rewrite, evidence recording and per-record downstream writes, and counts `records_skipped` — but still touches `fetched_at`, because freshness monitoring must not false-age a record that was verified. A ref matching rows on more than one supplier never skips (ambiguous; Pass 0 resolves it deterministically). Chained scrapers carry their parent row's ref in `ScrapedRecord.alias_refs` so Pass 0 resolves them to the same supplier: `bkmea_detail` writes its own `{detail_id}:detail` source_records row (never sharing the list row — a shared row's hash flip-flops per run) carrying `enriched_from_list_hash`, and its pre-fetch gate spends a Firecrawl credit only when the member was never enriched, its list row's hash moved, or an unreviewed stale claim is outstanding (`run bkmea_detail --full-refresh` bypasses). `bkmea_web` keys `source_ref` on the membership integer, never the detail-page id — BKMEA re-lists members on new ids under the same number, and `ops/rekey_bkmea_source_refs.py` rekeys the rows written before that rule.
- **Registry columns are canonical-latest-wins** (founder rule, 3 Aug 2026: the provider's current page is the truth and shows without a review round-trip): a record flagged `ScrapedRecord.canonical_registry` (bkmea_detail's member page) OVERWRITES `suppliers.bkmea_reg_number`; the directory list only fills a NULL — the old blanket `coalesce` froze the first-ever value and left 73 suppliers displaying numbers BKMEA had long since corrected. A blank/malformed membership ("- C/2009" from a half-rendered page) is junk-guarded out of both the parser payload and the column. One canonical citation per provider: `bkmea_web` does not claim detail-owned fields (membership_no / reg_number / category) when the member has a detail page, so a list-vs-page disagreement can never become a review item. ~48 suppliers legitimately hold 2+ current BKMEA memberships (BKMEA never dedupes re-registrations); the displayed value is the newest-fetched valid detail value, which only moves when the provider's data actually changes. Backlog repaired by `ops/repair_bkmea_registry_display.py`.
- **Object storage**: Supabase Storage (private bucket: `supplier-docs`; public bucket: `supplier-media`).

### Web app (built in Phase 1+)
- **Language**: TypeScript (strict).
- **Framework**: **Next.js 15+ App Router** (single Next.js app serving both marketing site `/` and buyer app `/app/*` via route groups; supplier portal `/supplier/*`; admin `/admin/*`).
- **Styling**: Tailwind CSS + shadcn/ui + Phosphor Icons (`@phosphor-icons/react`). Fonts: Bricolage Grotesque (display) + Plus Jakarta Sans (body).
- **Motion / animation**: **`motion`** (the successor to Framer Motion; package `motion`, React bindings via `motion/react`). **Approved as a Hard-Rule-4 exception by founder on 9 Jun 2026** for the marketing-surface redesign (Register × Engine direction). Scope: marketing route group (`(marketing)`) + auth shell only — the buyer/supplier/admin app surfaces stay on CSS + small IntersectionObserver islands unless a future spec extends this. All motion must honour `prefers-reduced-motion` (settle to final state, no animation) and must never animate fabricated data.
- **Auth**: Supabase Auth (email/password + magic link). Three roles: `buyer`, `supplier`, `admin`.
- **Server-side data**: Supabase JS client + RLS-protected queries. No separate backend service.
- **Forms / validation**: `react-hook-form` + `zod`.
- **State**: React Server Components + URL state. No global client store unless a spec demands it.
- **Email**: **Resend** (transactional only).
- **Background jobs**: **Inngest** (approved for: certificate-expiry alerts, scheduled scrapes; no Inngest code exists in the repo yet). Nightly score recompute does NOT use Inngest: it is the `sbi_recompute` entry in `etl/scrapers/registry.py` `JOBS`, scheduled via `etl_schedules` and dispatched by the minutely queue cron (`ops/scraper_queue_cron.sh`).
- **Payments**: **Stripe** integration is **deferred to a post-beta phase** (3 Jun 2026 founder decision). The H3 idempotent webhook recorder is retained as harmless infrastructure; no live keys, no checkout, no tier structure committed. Plan-tier names and pricing will be decided after the free public beta validates product-market fit. See `phases.md` → "Deferred until post-beta".
- **Error tracking**: **Sentry** (added at production launch).
- **Analytics**: **PostHog** (added at production launch).
- **Maps / geocoding**: **Barikoi** (approved as a Hard-Rule-4 exception by founder on 6 Jul 2026). Two scoped uses: (1) Rupantor geocode backfill in ETL (`etl/jobs/barikoi_geocode.py` → `public.address_geocodes` cache table, mig 0077) and (2) the profile Locations map (`bkoi-gl` via `components/supplier/locations-map.tsx` + `locations-section.tsx`, server geocode resolution in `lib/barikoi.ts`). Server key `BARIKOI_API_KEY`; tile key `NEXT_PUBLIC_BARIKOI_API_KEY` (public by design — bind to domain in the Barikoi dashboard). Coordinates are display metadata only; they never overwrite registry facts (trust hierarchy unaffected). Web only reads the geocode cache; the ETL job is the only writer, and Rupantor bills 2 calls/address so backfills run with `--limit`. Map styles: satellite (`barikoi_satellite`) and street (`osm_barikoi_v1`); default campus zoom 16; maxZoom 19 (satellite) / 20 (street); multi-site suppliers get one overview map with fitBounds + click-to-focus flyTo; single-site stays one focused map. Address list ↔ map sync via shared `selectedIndex` in `LocationsSection` (REZ-29, 28 Jul 2026). REZ-30 (28 Jul 2026) enriched it and **removed fullscreen** — the map is taller inline instead (380/470/540px), because a fullscreen map loses the address list that gives the pins meaning. Added: pins keyed by address kind (head shape + tone, numbered to match the list rows), filled vs hollow head as the geocode-confidence cue (`confidence_pct < 70` = hollow "area-level"; `address_status` is unusable — every cached row reads "incomplete"), pixel spiderfy for pins within 60 m, an on-map site switcher with arrow-key nav, straight-line distances and static landmark chips (`lib/geo.ts`, `lib/bd-landmarks.ts`), a scale bar, `?site=N` permalinks, GeoJSON pin export, and an optional "other published SourceBD sites nearby" layer (`lib/nearby-suppliers.ts` → `app/api/suppliers/nearby`). That layer is a **moat feature, not a provider feature**: it joins our own published catalog to our own geocode cache, service-role reads with the published/unsanctioned gate and no-PII projection enforced in-module (RLS closed these tables in REZ-23/REZ-17). Attribution follows the live style — the satellite basemap is Stadia/Airbus/CNES imagery, so crediting only Barikoi+OSM there would be wrong. **Zero new Rupantor/live Barikoi geocode calls**: everything reads the cache.

### Hosting
- **Web app**: **OneProvider VPS** (Ubuntu 22.04 LTS, Docker + Caddy reverse proxy, Next.js running under PM2 or as a systemd service in a container). Replaces Vercel.
- **Database / storage / auth**: Supabase (Singapore region — closest to Bangladesh + good for UK latency). Project ref `stnrfxrxfonwexzcvvpv`.
- **ETL scripts**: Same OneProvider VPS, separate Docker container. Triggered by cron + Inngest. Outputs land in Supabase via service-role key. Local dev uses identical Docker image.
- **Approved infra tools**: Docker, docker-compose, Caddy, systemd, cron, Playwright (Chromium only), Firecrawl Cloud API (web acquisition — see Data layer). No new tools without spec change.

## Repo layout (monorepo, single Next.js project)
```
/                            Next.js root
├─ app/                      App Router
│  ├─ (marketing)/           sourcebd.com — landing, pricing, blog, compliance pages
│  ├─ (app)/app/             Buyer app
│  ├─ (app)/supplier/        Supplier portal
│  ├─ (app)/admin/           Admin panel
│  └─ api/                   Route handlers (RFQs, match engine, webhooks)
├─ components/               Shared UI (shadcn-style)
├─ lib/
│  ├─ supabase/              Server + client helpers
│  ├─ scoring/               SBI score engine
│  ├─ matching/              Smart Match scoring
│  └─ utils/
├─ etl/                      Python data pipeline (separate venv)
│  ├─ raw/                   Source PDFs, HTML caches (gitignored)
│  ├─ parsers/               One per source (BGMEA, BKMEA, RSC, …)
│  ├─ dedup/                 Cross-source matching, merge logic
│  ├─ enrich/                UFLPA, WRO, brand disclosure miners
│  └─ load/                  Supabase upsert scripts
├─ context/                  Spec & rules (this folder)
├─ supabase/                 SQL migrations
└─ public/
```

## System boundaries
- **Marketing pages** are static / ISR; no auth.
- **Buyer app** routes are server-rendered with Supabase auth + RLS.
- **Supplier / Admin** routes are role-gated server-side.
- **API routes** validate input with `zod`, authenticate via Supabase session, enforce ownership server-side.
- **ETL scripts** never run inside Next.js. They write directly to Supabase using the service role key (kept out of the web app).
- **Sanctions screening** runs in the ETL (`etl/core/sanctions.py`), in both directions, sharing one pair-level predicate (`_pair_matches`): entry-side when a sanctions list entry is ingested (`_match_and_screen`), and supplier-side inside the `upsert_supplier_with_source` transaction (`screen_supplier_against_entries`) — a screening failure rolls the supplier record back. Either direction inserts into `sanctions_screening`; the `trg_sanc_propagate` trigger then flips `suppliers.is_sanctioned` and zeroes `sbi_scores.total`. There is no Inngest job for this (no Inngest code exists in the repo).

## Storage model
- **Persistent metadata**: PostgreSQL (suppliers, profiles, RFQs, conversations, messages, orders, certs, scores, reviews, sources, source_records).
- **Large blobs**: Supabase Storage. `supplier-media` (public, photos/videos). `supplier-docs` (private, certs/uploads). Default = private; flip per spec.
- **Cache / ephemeral**: Next.js fetch cache + RSC. No Redis in v1.

## Source trust hierarchy (enforced in code)
```
Tier 1 — Gov/regulatory (RSC, EPB, RJSC, DIFE, BEPZA)        — overrides all
Tier 2 — Industry registers (BGMEA, BKMEA, BTMA, BGAPMEA)
Tier 3 — Cert bodies (WRAP, OEKO-TEX, GOTS, GRS, BCI, Sedex)
Tier 4 — Brand supplier disclosures (H&M, Inditex, Primark, ASOS, Gap, PVH, VF, Hanesbrands, Ralph Lauren, M&S, Next, Tesco, Sainsbury's, C&A)
Tier 5 — US/UK/EU regulatory (UFLPA Entity List, US CBP WROs, ILAB TVPRA, SEC EDGAR, UK MSA Registry, UK Companies House, German LkSG/BAFA)
Tier 6 — Cross-check only (third-party exporter PDFs, LinkedIn) — NEVER imported alone
```
Every record in the `suppliers` table tracks which sources verified which fields via the `source_records` join table.

## Invariants (must never be broken)
- Every supplier row has at least one row in `source_records` from Tier 1–3 before being marked `is_published = true`.
- SBI score recalculation is idempotent; running it twice on the same data yields the same score.
- **SBI is an internal signal only** (α/β/γ decision, 2026-05-20). The numeric `total` / `pillar*` columns from `public.sbi_scores` MUST NOT be returned to unauthenticated clients, buyer surfaces, supplier surfaces, or any public API response. Server-side use only: default ranking, admin tooling, change-detection alerts, internal benchmarks. Public-facing supplier surfaces show **receipts** (cert badges, register links, RSC remediation %, source-pill provenance, completeness badge) — facts issued by named third-party authorities, not opinions issued by SourceBD. RLS on `public.sbi_scores` is `admin`-only; no `anon` or `authenticated` SELECT grant.
- A supplier flagged on UFLPA/WRO sanctions screen returns `sbi_score = 0` AND a red banner regardless of other pillars (banner is the visible signal; the zero itself stays server-internal).
- Contact details (email_primary, phone_primary) are NEVER returned to unauthenticated clients or `buyer_starter` plan users — gated server-side, not just hidden in UI.
- `supplier-docs` bucket is private. Signed URLs only, max 10-minute TTL.
- Admin actions on supplier records are append-only logged in `admin_audit_log`.
- Currency is always stored in cents (USD) as integers. Never floats.
- All timestamps are `timestamptz`, stored UTC.

## What is explicitly NOT in the architecture
- No Redis, no Memcached.
- No separate Node/Express/Hono backend — Next.js route handlers only.
- No GraphQL — REST + Supabase queries.
- No microservices.
- **No public-facing SourceBD-proprietary numeric score** (α/β/γ decision, 2026-05-20). SourceBD is a marketplace/intelligence platform (Foursource / Alibaba / Globalsources pattern), not a paid rater (EcoVadis / D&B / MSCI ESG pattern). The two models are economically incompatible: marketplaces show third-party receipts so the platform borrows trust from named authorities; raters charge the rated entity and own a methodology committee + appeals process. SourceBD has neither the capital nor the regulatory posture to defend a public numeric rating, and a public score creates platform liability (CSDDD / UFLPA / LkSG diligence duties on buyers are non-delegable — a published score can be relied on, then sued over). The internal SBI calculation is retained as a server-side sort signal; the public face is receipts.
- Docker IS used (single VPS, web + etl as separate compose services). No Kubernetes.
- No web sockets — messaging uses Supabase Realtime channels (already part of Supabase, no new tool).
- No AI/LLM in v1. Smart Match is rule-based scoring, not an LLM.
- No third-party search (Algolia/Meilisearch) — Postgres FTS + `pg_trgm` for v1.
- No CI beyond GitHub Actions running typecheck + lint + tests.
