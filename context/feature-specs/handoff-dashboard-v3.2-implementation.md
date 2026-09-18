# Handoff — build the approved buyer dashboard (v3.2) on the real app, with the V2 AI layer

Written 18 Sep 2026. Status: **queued behind the design-system rebuild** (`ds-rebuild-must-stay.md`); it is the first page work of that rebuild, on branch `design-rebuild` or a branch cut from it. Founder approved the v3.2 screens on 18 Sep ("approved for SourceBD dashboard").

Read, in this order, before touching anything: `AGENTS.md` · `context/agent-brief.md` · `context/current-state.md` · `context/feature-specs/active.md` · `context/feature-specs/ds-rebuild-must-stay.md` §1, §2, §5, §9 · `design/README.md` · `design/dashboard-ux-flow.md` · this file. The screens themselves are the Design System artifact (https://claude.ai/artifact/3n9MkVaXgFaFokziwhmP5o — ResultsList, ResultsTable, SupplierSheet, ProductSheet, RFQComposer, RFQList, each with a README) and their source under `design/src/`. The reference crawl that drives §1 is `design/reference/sourceready/crawl-2026-09-18.md`.

Rules that do not bend, carried from the rebuild spec and the founder's messages: brand green only on the primary button, links, the active nav mark and the logo · status hues only on facts · `smart` (lavender) only on V2 surfaces, always with the V2 tag · no score, grade, star or "verified" badge anywhere a buyer can see · every fact carries a source mark that links to its page · names wrap, never truncate · locked is striped, never blurred · empty is quiet · a sanction cannot be hidden by layout · only `lib/design/tokens.ts` carries hex · contrast 4.5:1 text, 3:1 controls, 7:1 sanction · `pnpm`, Node 20, `tsc` + `node --test` · no new packages · server enforces auth and ownership · contact PII never leaves the server unless the caller is entitled.

"Super accurate" means: every route, table, RPC and API in this file is named as it exists in the repository today (checked 18 Sep on `design-rebuild`, tree dirty with the founder's HS-card work), and every new one is named so the implementer does not have to invent a name. Where a decision was mine, §8 says so.

---

## 0. The one-paragraph version

Replace the buyer app's Discover, supplier profile, Saved, RFQs and their empty states with the six approved screens; keep the existing data layer (`discover_suppliers`, `buyer_supplier_profile`, `supplier_epb_hscodes`, `rfq_*`, `thread_*`, `saved_suppliers`) and extend it with saved searches, multi-supplier RFQs with questions, drafts and templates, a compare page, CSV export, the HS photo catalogue, and an AI layer (OpenAI, server-side only, key from the environment) that turns a sentence into filter chips, explains why each result matched, summarises a record in plain language from its facts, improves RFQ wording, suggests questions, and drafts follow-ups for the buyer to approve. Nothing the AI writes is shown without the facts it was built from; nothing it writes is a score.

---

## 1. What SourceReady's dashboard has that ours does not — and what we do about each

Source: the crawl file. "Ours" means the code on `design-rebuild` today plus the approved v3.2 screens. Verdicts: **Build** (in this handoff) · **Build our way** (same job, different shape, in this handoff) · **Have** (exists, gets restyled) · **Not building** (with the reason) · **Data gap** (a founder decision about data, not a UI task).

### Search and results

| SourceReady | Ours today | Verdict |
| -- | -- | -- |
| One composer with mode stops (Supplier search · Product research · Product ideation · Manual filter) and a template gallery | `/app/discover` search box + filter rail; `/app/match` 3-step wizard | **Build our way.** One `SearchComposer` with two stops, Filters (V1) and Ask (V2). No product research / ideation / image / video modes. Smart Match's three steps become the Ask stop's clarifying turn (§5.3); `/app/match` redirects to `/app/discover?ask=1`. |
| AI turns a sentence into filters, shows a clarifying turn when vague, posts "I've updated the filtering requirements" and re-runs when filters change | Nothing (string normalisation only, `lib/discover-smart-query.ts`) | **Build (V2).** `POST /api/v1/ai/parse-query` → chips shown as "Reads as:" before the search runs; the buyer edits chips, not prose (§5.2). |
| "Requirements" that only change ranking, weighted most→least important | Sort by receipts/name; no weights | **Not building.** Weighted ranking is a score by another name. Ranking stays factual: most sources (default), name, workers, established, certificate expiry soonest, HS line count. |
| "3 filters · 3 requirements · 1 sort" summary pills | Filter rail | **Build our way.** The composer's chips are the summary; the panel header shows the query title and live count (`ResultsList` header). |
| Search filter drawer with ~30 fields incl. Highlight groups, employee bands, review score, marketplace source, marketplace verification, Pro-only Shipments/Extension data | `discover_suppliers` takes q, entity types, min sources, cert kinds, RSC min, city, district, category, registries, factory types, brand codes, completeness, workers | **Have + Build.** Add to the RPC: HS heading (`p_hs_codes text[]`), cert state (`p_cert_state text`: valid / expiring / expired / any), RSC state, established range, workers range, district/city multi, sanctioned exclusion (default on). No highlight taxonomy, no review score, no marketplace source/verification (§1 last block). |
| Per-result match ring "100% matched" + requirement chips + AI sentence + per-requirement "Matched" cards with evidence counts | Nothing | **Build our way (V2).** "Why matched" line: one line in `smart`, tagged V2, naming the filters met and the fact that met each, with its source mark. No percentage, no ring, no counts-as-confidence. (§5.4) |
| Card: logo, name, Verified badge, flag, year, people band, business types, Save, Send inquiry ▾, highlight tags, Description / Key customer / Key market cells, product strip with prices | `components/discover/result-card.tsx` (name, type, city, source tags, cert chips, workers) | **Build.** The approved `SupplierResultCard` (§3.1). No Verified badge, no people band (we show the exact worker count with its source), no marketplace prices. Key customer → "Listed by" (brand disclosure lists). Key market → not on file for us (Data gap). |
| Table view toggle | None | **Build.** `ResultsTable` (§3.2). |
| Save = favourite flag; Favorite suppliers tab | `saved_suppliers` flat list, `/app/saved` | **Have.** Wording "Save" / "Saved". Named lists are V2.1 (§8). |
| Share, Comments on a search | None | **Build.** Saved searches with a shareable in-app link (`/app/searches/[id]`) and the org-scoped `CommentsRail` on the search page (§4.10). |
| "15 per page · Page 1 of 6" | 24 per page | **Have.** Footer "1–25 of 320", per-page 25/50/100. |
| Inline results table inside the chat answer (new chats) | — | **Not building.** Results always render in `ResultsList` / `ResultsTable`; the Ask stop's answer is chips + one sentence, not a second results UI. |

### Supplier record

| SourceReady | Ours today | Verdict |
| -- | -- | -- |
| Right side sheet that persists across list pages; also a full page | Full page `/app/suppliers/[slug]` with tabs Overview / Compliance / Capacity / Brands / Contact / Provenance / Locations / Facilities | **Build.** `SupplierSheet` over results, URL-addressable (`?record=<slug>`), plus the full page rebuilt with the same sections. Tabs become Overview · Products · Certificates · Safety · Sources · Locations · Facilities · RFQs (§3.3). |
| Generated overview paragraph | None | **Build (V2).** Fact-only summary, cached per record, every sentence traceable to a fact id (§5.5). Without the AI key, the section shows the FactsPanel only. |
| Highlight cards with a reason each (OEM manufacturer, Industry association member — "Member of BGMEA association", Multi-country export — "over 17 countries") | Source tags, cert chips | **Build our way.** Highlight chips are facts with status hues (GOTS valid to …, WRAP expired …, RSC active · 100 %, EPB exporter · 12 lines, Listed by H&M, ASOS, NEXT). No capability taxonomy that is not on a register. |
| Contact: Private/Public, masked rows, Unlock all N (credits) | Contact tab gated by plan/claim server-side (`profile-contact-tab`, `phones-reveal`) | **Have.** Locked card that says exactly what is hidden and from which registers; never a blur, never credits. |
| Customers from bills of lading (ASDA 962 shipments …); unlocked on Entry, 20 credits per "Unlock all N" contact block | Brand disclosure lists (H&M, ASOS, NEXT, Inditex, M&S, Primark) | **Have + Build, on demand.** "Listed by" tiles stay. US bill-of-lading customers come from the on-demand Shipments layer (§4.8): a stub for every Bangladeshi supplier from the provider's free search, the rows fetched server-side through the paid ImportYeti API on the first buyer's click and cached 90 days for everyone; a Customers section under the Shipments tab, counts and dates only, provider mark on every row. |
| Certifications: scheme + count, "View detail" | `certifications` table: kind, number, issuer, issued, expires, scope, document URL, source record | **Have.** We show more: number, issuer, scope, state badge, link to the issuer's page. |
| Key export market flags | None | **Build, on demand — partial.** §4.8 writes `supplier_export_markets` from the same unlock, but ImportYeti covers US buyers only, so the stat reads "Not on file · ImportYeti lists US buyers only" until a second provider is licensed; EPB still lists lines, not markets. |
| Shipments tab (B/L rows, "View all 3,979 shipments" modal with Date/Country/Search filters and multi-sort), Insights charts (Pro) | None | **Build, on demand (§4.8) / Not building the charts.** Shipments tab with the striped locked card → 100 most recent US bills of lading (date, H/M numbers, US buyer, HS 6, description, weight, quantity, ports) with a tier-6 provider mark; no charts, no percentages, no score in v3.2. Not published on its own: the layer only attaches to suppliers that already exist from Tier 1–3 registers. |
| Extension fields (Pro) | None | **Build our way (§4.9).** Org-private notes on the record plus custom fields the org defines in `/app/settings/fields`; never mixed into register facts, never visible to another org. |
| Inquiries tab on the record | RFQs page only | **Build.** RFQs tab on the sheet: this buyer's RFQs to this supplier, from `rfq_list` filtered by supplier. |
| Links badge "+N" (marketplace URL) | Source links per fact | **Have.** Sources tab lists every register page with read date. |
| Save to list (one click, toast) | `save-button.tsx` → `POST /api/v1/saved` | **Have.** Toast per approved `RFQList` toast style. |
| Comments on the record (right rail, team thread) | None | **Build (§4.10).** `CommentsRail` on the sheet header, org-scoped. |
| Chat now (action bar) | `/app/messages` threads exist, no entry from the record | **Build (§4.12).** "Message" opens the thread for a claimed supplier; disabled with the claim caption for an unclaimed one. |

### Products

| SourceReady | Ours today | Verdict |
| -- | -- | -- |
| Product strip from marketplace listings with prices; product list/detail; private products with variants and keyword tags; Add private product | EPB HS lines (`supplier_epb_hscodes`), BGMEA principal products | **Build our way.** HS-keyed illustrative photo strip and `ProductSheet` per export line (§3.4); "Products" nav item = `/app/products` = the HS catalogue with exporter counts (§3.5). No prices, no marketplace listings. Buyer's own product specs live inside the RFQ (product block), not as a separate object, in v3.2. |

### RFQs / inquiries

| SourceReady | Ours today | Verdict |
| -- | -- | -- |
| Send inquiry modal: suppliers (new vs existing), products with price & qty, basic info 1/6, 10 preset questions (5 required), advance settings (auto cc, AI follow up, AI auto reply, knowledge bases), template new/existing with variable chips, product table, Improve with AI, live preview with "Missing …", Save as draft / Send now / Save as template | `rfq-create-form.tsx`: one supplier via `?supplier=`, title, description, qty, unit, target price, currency, ship-to, ship-by; `rfq_create` accepts 1–50 targets | **Build.** `RFQComposer` dialog (§3.6): multi-supplier from selection, product block with HS line, details, questions, templates, variables, preview, drafts. AI: Improve wording, Suggest questions, follow-up drafts (V2, §5.6–5.8). |
| Inquiry list: Inquiry name · Status · Owner · Email sent · Email read · Email replied · Received quotes · Order due date · Inquiry date; tabs All / Email replied / Quotes received | `/app/rfqs` table with status open/accepted/closed/cancelled | **Build.** `RFQList` (§3.7) with status chips All · Awaiting reply · Quoted · Reply overdue · Draft · Closed. No email-read tracking (we do not send tracked email pixels). |
| Inquiries are emails to the supplier's address; replies come back by email; AI follow-up and auto-reply act on the thread | `rfq_create` opens a `message_threads` row; email goes only to **claimed** suppliers' users (`email_rfq_recipients` joins `auth.users` on `suppliers.claimed_by`); an unclaimed supplier never hears about the RFQ | **Build + founder decision (§8 Q1).** The approved copy says "Your RFQ reaches the supplier through SourceBD either way". Today that is not true for 10,2xx unclaimed records. Proposed: email the register address (`suppliers.email_primary`, server-side only) with a reply link that opens a claim-lite reply page (§4.6). |
| Templates and question presets in Settings › Inquiry; knowledge bases | None | **Build.** `/app/settings/rfq` with templates (first contact / repeat) and question presets (§3.9). No knowledge bases in v3.2. |

### Shell, settings, plans

| SourceReady | Ours today | Verdict |
| -- | -- | -- |
| Sidebar: New chat, Search chats, Supplier, Product, Inquiry, Chats by date, plan badge, credits, avatar | `components/shell/sidebar.tsx`: Discover (Search suppliers, Find matches, Saved), Activity (Messages, RFQs, Orders), Compliance, Account | **Build.** Approved nav: Search ⌘K · Suppliers (count) · Products · RFQs (count) · Saved (count) · Messages · Compliance hub · Recent searches (3, with counts) · plan line. Orders stays reachable from an RFQ (accepted quote → order) and under Compliance hub's "Orders" link; it leaves the primary nav (§8). |
| Workspace, members, sub-workspaces, credits, usage export | Settings profile / plan / notifications | **Build (§4.11, §4.13).** One organisation per buyer team with members, roles and email invites at `/app/settings/workspace`; plan allowances for shipment unlocks and contact reveals shown at `/app/settings/plan`. No sub-workspaces, no purchasable credits, no usage export in v3.2. |
| Product research, ideation, image search, video, keyword trends, agents, tasks, WIP orders | — | **Not building.** Out of product scope (data moat + sourcing workflow). |
| Reviews, ratings, Verified badge, match score | — | **Not building.** Rule: receipts, not opinions. |

---

## 2. What exists today and is reused (checked 18 Sep 2026)

Routes (App Router, `app/(app)/app/*`): `page.tsx` (dashboard) · `discover` · `match` · `saved` · `messages`, `messages/[thread]` · `rfqs`, `rfqs/new`, `rfqs/[id]` · `orders`, `orders/new`, `orders/[id]` · `compliance`, `compliance/expiry|msa|uflpa` · `settings`, `settings/profile|plan|notifications` · `suppliers/[slug]`. Public: `app/(public)/suppliers/[slug]`, `app/(marketing)/discover`. Supplier portal and admin are untouched by this handoff except §4.6.

APIs: `app/api/v1/{match,rfqs,saved,messages,orders,settings,compliance,feedback,claims}/route.ts`, `app/api/discover/suggest/route.ts` (anon typeahead), `app/api/suppliers/nearby/route.ts`. Rate limiting: `lib/rate-limit/limits.ts` classes auth / api_write (30/min/user) / api_read (120/min/user) / public_marketing, checked via `rl_check` RPC.

RPCs the buyer app calls: `discover_suppliers` (last redefined in migration `0076_discover_browse_postgrest_budget.sql`; returns id, slug, company_name, entity_type, city, district, source_tags, t13_source_count, completeness_pct, employees_total, established_date, principal_products, factory_types, rsc_progress_pct, parent_group_name, primary_address, total_count) · `discover_facets` · `buyer_supplier_profile(p_slug)` (last redefined in `20260725_rez_security_hardening_2.sql`; contact fields excluded; PII gated in `profile-contact-tab`) · `supplier_epb_hscodes(p_slug)` (migration `0103`) · `buyer_supplier_facility_panel` · `production_workers_display_batch` (REZ-114 worker figures, via `lib/enrich-discover-workers.ts`) · `buyer_smart_match(p_input jsonb)` · `buyer_saved_list` · `buyer_dashboard` · `rfq_create(p_input jsonb)` / `rfq_list(p_status)` / `rfq_get(p_id)` / `rfq_quote_submit` / `rfq_quote_accept` · `thread_list` / `thread_messages` / `thread_open` / `thread_send_message` · `compliance_*` · `settings_get` · `email_rfq_recipients`.

Tables: `suppliers` (incl. `is_sanctioned`, `is_published`, `claimed_by`, `email_primary`, `phones`, `source_tags`, `bgmea_reg_numbers`, `epb_erc_number` …) · `source_records` + `sources` · `certifications` (kind, certificate_no, issuer, issued_on, expires_on, scope, source_record_id, document_url) · `rsc_remediation` · `saved_suppliers (owner_id, supplier_id)` · `rfqs` (buyer_id, target_supplier_ids uuid[] 1–50 published suppliers, product_title, product_description, quantity, quantity_unit, target_unit_price, currency, ship_to_country, ship_by, status enum open/accepted/closed/cancelled, accepted_quote_id) · `rfq_quotes` · `message_threads (buyer_id, supplier_id, rfq_id, subject, last_message_at)` · `thread_participants` · `messages` · `email_log`.

Design tokens: `lib/design/tokens.ts` (`light`, `density`, `contrastPairs` — `pnpm test` fails if a pair drops), `app/ds.css`, `tailwind.config.ts` (rebuild's own), gallery `/dev/ds`. `components/ui/*` is the old system and is off-limits for new work; each piece moves out as its last page is rebuilt.

Environment: `.env.example` lists every variable; runtime secrets live in `/opt/sourcebd/.env` on the VPS and in the developer's local `.env`, never in the repo or CI (`docs/ENTERPRISE_DEPLOYMENT.md` §"Secrets"). The guard refuses any write to `.env`.

Migrations: latest numbered file is `0103_epb_detail_url_and_hscodes.sql` (applied 15 Aug). New ones start at `0104`. Additive only; the production ledger in `current-state.md` is the truth, not file headers.

---

## 3. Screens → routes → components

Component names are the artifact's. Every component is a server component unless it holds selection or dialog state. Photos: §6. Every screen has the six states of `ds-rebuild-must-stay.md` §5 (empty, locked, loading, error, sanctioned, stale/contradicted where a fact can be), and `loading.tsx` per route stays.

### 3.1 `/app/discover` → `ResultsList` (default) — replaces the current Discover

- **Shell**: `AppShell` = sidebar (§3.10) + topbar (search field "Search suppliers, HS codes, certificates ⌘K", caption "10,266 published suppliers · records read <max fetched_at>", help, avatar) + content on `canvas`.
- **Composer** (`SearchComposer`, client): chip row = the active filters as chips (`Product · Knitted shirts 6105`, `Certificate · GOTS, valid`, …) + "Add filter" + stop switch **Filters | Ask V2**. Filters stop opens the filter panel (the current rail's fields, as a popover per chip, not a permanent rail). Ask stop (§5.2) is hidden when `AI_ENABLED` is false or the key is missing — the switch is not rendered, not disabled.
- **URL is the state**: `?q=&hs=6105,6110&cert=gots:valid,wrap:any&reg=BGMEA&brand=hm&district=Dhaka&type=factory&min_sources=3&rsc=active&est_from=&est_to=&workers_min=&workers_max=&sort=sources&page=1&per=25&view=cards|table`. Back/forward restores the search. `resolveDiscoverSmartQuery` stays for plain `q`.
- **Panel header**: select-all checkbox · query as title (built from chips: "Knitted shirts · GOTS valid") · caption "320 suppliers · 1–25" · Sort (Most sources default · Name · Workers · Established · Certificate expiry soonest · HS lines) · Save search · Export CSV · card/table `seg`.
- **Card** (`SupplierResultCard`, band for band as the artifact README): identity (48px initials tile on the top-tier mark, name wraps, source-mark row with tier ramp t1→t5 and "11 sources", meta line type · district · est. · workers each with its register mark) · actions Save · Open record · Send RFQ (`brand`; disabled + `sanction` bar on a sanctioned record) · highlight chips (positive / caution / neutral / quiet, "+N more" → Highlights popover listing every chip with its source) · four tiles Certificates · Export lines · Listed by · Registers (value, sub-line link into the sheet tab; "—" quiet with the reason) · photo strip (six HS tiles rarest-first, "+N ›" pill, note) · **Why matched** (V2 only, §5.4).
- **Selection**: checkbox per card; a sticky action bar appears with "N selected · Send RFQ · Save · Compare · Export"; max 50 for Send RFQ (the `rfq_create` cap).
- **Footer**: "1–25 of 320" · per page · Prev/Next.
- **Data**: `discover_suppliers` (extended, §4.1) + `enrichDiscoverWorkers` + `supplier_epb_hscodes_batch` (§4.2) for the strips + `certifications` state per row + `saved_suppliers` membership. One round trip per page beyond the RPC is the budget; measure with the existing PostgREST budget tests (`0075`/`0076` patterns).
- **Empty / error**: no query → the composer with three recent searches and the catalogue count; zero results → "No supplier matches all N filters" + remove-a-chip suggestions (the chip with the fewest matches first, computed from `discover_facets`-style counts — §4.1 `p_explain`); RPC timeout → the existing "under heavy load" copy in the new style.
- **Acceptance**: the 101-character name (Zaheen) wraps on card and table; `ar-fashion` renders every band in the quiet state; a sanctioned sample renders the bar, notice, disabled Send RFQ in both views; contrast pairs in `tokens.ts` all pass; screenshots at 320 and 1280 for both views.

### 3.2 `/app/discover?view=table` → `ResultsTable`

Same header/footer. Columns Supplier · Sources · Certificates · Export lines (three rarest thumbs) · Type · Workers · actions; 36px rows; sticky header; long names wrap the row. Selection and bulk bar identical. No match column in V1; in V2 a "Why" column shows the first met filter with a hover for the rest.

### 3.3 `/app/suppliers/[slug]` and the sheet → `SupplierSheet`

- The sheet opens from Open record / the name **without leaving the results**: `router.push('?record=<slug>', { scroll: false })`; the results page reads `record` and renders the sheet as a parallel/intercepting route (`app/(app)/app/discover/@sheet/(.)suppliers/[slug]`) so the same component serves the full page at `/app/suppliers/[slug]` (deep link, refresh, share).
- Bar: close · "Supplier record" · "Read <date> · N sources · pages unchanged since read" (from `source_records.fetched_at` and `raw_hash` comparison, §4.3) · Share (copies the full-page URL) · more (Report a problem → existing feedback endpoint).
- Head: initials tile, name (`heading-lg`, wraps), meta with marks, BGMEA number in `code`, full source-mark row with the names spelled out.
- Tabs scroll to sections (counts in mono): Overview · Products N · Certificates N · Safety RSC · Sources N · Locations N · Facilities · RFQs N. Mapping from today's tabs: Overview = overview + capacity (`profile-overview-tab`, `profile-capacity-tab`, `has-capacity-data`) · Products = `epb-hscodes-card` + `principal-products-card` + `also-produces-chips` · Certificates = `profile-compliance-tab` certificate part · Safety = the RSC part (`asRscSites`) · Sources = `profile-provenance-tab` + `corroborated-by-row` + `sources-explainer` · Locations = `locations-section` + map (Barikoi stays) · Facilities = `profile-facilities-section` (REZ-73 roll-up, ships when that branch lands) · RFQs = new.
- Overview: V2 summary (§5.5) or nothing, then the `FactsPanel` (28px rows: Registered name · Type · Parent group · Factory address · Established · Workers · Sewing machines · Capacity as filed · Registers · Map pin; each value with its register mark; "Not on file" with what was checked) beside the **locked contact card** (`profile-contact-tab` logic: says "1 email · 6 phone numbers · website · 2 named representatives, from BGMEA, BKMEA and BGAPMEA"; the counts come from the server without the values — add `contact_counts` to `buyer_supplier_profile`, §4.3) and the read-dates caption.
- Products: four stats (HS lines · Product list · Certified scope · Buyer lists) + six-up photo grid + "All N lines ›" → Products tab expands; each tile opens `ProductSheet`.
- Certificates: one card per row of `certifications` for the supplier: issuer mark (t3), scheme, state badge (valid / expires in N days when ≤ 90 / expired / no expiry on file), number in `code`, issuer + scope caption, link to the issuer page (`source-links.ts`).
- Safety: RSC meter from `rsc_remediation.progress_pct` + status words + the five report links (fire, structural, electrical, boiler, CAP; missing = dashed quiet chip).
- Action bar (sticky): Send RFQ (`brand`, `control-lg`) · Save · Compare · "Every fact links to its source page". Sanctioned: banner under the bar on every tab, Send RFQ disabled (server also refuses: `rfq_create` gains `and s.is_sanctioned = false`, §4.5).
- Acceptance: the 11-source record (Aboni) and a one-source record show every mark position; the 54-code and 39-product lists; `ar-fashion`; a sanctioned sample; contact card never renders a value the RPC did not return (boundary test asserts `email_primary`/`phones` absent from the HTML for a non-entitled caller).

### 3.4 `/app/suppliers/[slug]/lines/[hs]` → `ProductSheet`

Nested sheet with Back and breadcrumb. Left: the HS photo (320px) + caption "Illustrative photo for HS 6105 · a supplier upload replaces it". Right: eyebrow "HS 6105 · EPB export line", the official heading (`lib/epb-hscode-labels.ts`), FactsPanel: chapter · EPB exporter page (link, read date) · exporting since ("Not on file · EPB lists lines, not dates") · other lines (`code`) · certified scope with state · BGMEA product list · buyer lists · price · MOQ · lead time (shown only when a supplier attested them — V2 supplier portal field, absent in v3.2 so the row reads "Not attested"). Actions: Send RFQ for this line (prefills the composer's product block with the HS code) · "Other exporters of 6105 · 1,635" → `/app/discover?hs=6105`.

### 3.5 `/app/products` → HS catalogue (new, the "Products" nav item)

A `row-dense` table of the 4-digit EPB headings with a photo thumb, heading text, exporter count (live: `select hs, count(distinct supplier_id)` over the HS table used by `supplier_epb_hscodes`, cached 10 min with the `discover-facets` tag), chapter; search box; click → `/app/discover?hs=NNNN`. Empty state impossible (46 headings with 20+ exporters, 200+ total). This is the "Products" the approved sidebar names; it is not a buyer product library.

### 3.6 `/app/rfqs/new` → `RFQComposer` (dialog over results, also a page)

- Opens from: card/sheet Send RFQ (one supplier), the bulk bar (N suppliers ≤ 50), ProductSheet (with HS), RFQ list "+ New RFQ" (no supplier yet → the rail's Suppliers step opens a picker over the buyer's saved list and recent results).
- Rail (steps with counts and a `caution-ink` "missing" line each): **Suppliers** (each with first contact / repeat, derived from `message_threads` between this buyer and supplier) · **Product** (name, HS line from the catalogue, target price, quantity + unit, description; "Missing target price" flagged not blocking) · **Details** (RFQ name, reply-by date, incoterm, destination country, currency, attachments up to 5 × 10 MB via Supabase Storage bucket `rfq-attachments`, private, signed URLs) · **Questions** (10 presets from settings; on first contact 5 marked required; add/remove/reorder) · **Follow-up rules** (V2: "Draft a follow-up if no reply in 5 days" — draft only, §5.8).
- Editor: template switch First contact / Repeat supplier (from `rfq_templates`) · Attach · Insert variable · **Improve wording** (V2, §5.6) · subject + body with variable chips (`{{supplier_name}}`, `{{buyer_company}}`, `{{rfq_name}}`, `{{reply_by}}`, `{{product_table}}`, `{{questions}}`, `{{certificate_line}}`, `{{hs_line}}`; a variable without a value renders `caution-tint` "Missing") · the product table · the question list with REQUIRED stamps.
- Preview: the message as the supplier receives it, per supplier (tabs when N > 1), missing fields still flagged. The message cites the record ("Your GOTS certificate GOTS-31587 is valid to 12 May 2027; HS 6105 is on your EPB exporter page") built from the same facts the sheet shows — the `certificate_line` and `hs_line` variables are server-rendered from `certifications` and `supplier_epb_hscodes`, never typed.
- Footer: "3 fields missing" · Save draft (always) · Send RFQ (disabled until required fields are filled and every supplier is published and not sanctioned).
- On send: one `rfqs` row, one `message_threads` row per supplier (as today), one outbound message per supplier rendered from the template (§4.5), delivery per §4.6, toast "RFQ sent to N suppliers · replies land in Messages".
- Acceptance: draft survives reload (`rfq_drafts`, §4.4); Send with 50 suppliers succeeds and 51 is refused at the API with the reason; a sanctioned supplier in the selection is refused server-side with its name in the error; the preview and the stored message body are byte-identical (boundary test on `POST /api/v1/rfqs`).

### 3.7 `/app/rfqs` → `RFQList`

Heading "RFQs · 7 sent · 0 quotes" (live counts), Search, Fields (column picker), Sort, + New RFQ. Status chips with counts: All · Awaiting reply · Quoted · Reply overdue (reply-by date passed, no quote and no supplier message) · Draft · Closed. Table (36px): RFQ name with HS in `code` · Supplier (tier tile + name; "N suppliers" with a hover list when multi) · Quantity (tabular) · Status badge · Sent · Ship by · action (Continue for drafts, Open otherwise). Rows from `rfq_list` + drafts from `rfq_drafts` (§4.4); status derived server-side (§4.5 `rfq_list` gains `derived_status`). Empty: "Your first RFQ lands here. Suppliers answer inside the platform, with the record attached." Toast style per artifact.

`/app/rfqs/[id]`: restyled with the same kit — the sent message per supplier, the questions with the supplier's answers (from `rfq_quote_answers`, §4.4), quotes, accept (existing `rfq_quote_accept`), the thread link, and the V2 follow-up drafts waiting for approval (§5.8).

### 3.8 `/app/saved`, `/app/searches`, `/app/compare`

- Saved: the flat list as `ResultsTable` rows (same component, `source=saved`), with the bulk bar (Send RFQ, Compare, Export, Remove). Count in the sidebar from `buyer_dashboard`.
- Saved searches (new): `saved_searches` (§4.4); "Save search" in the panel header stores the URL state + a name; `/app/searches` lists them with live counts (one `discover_suppliers` count call each, cached 10 min); the sidebar's "Recent searches" shows the last three (saved or not — recent are stored client-side in `localStorage`, saved are server rows). A saved search page `/app/searches/[id]` redirects to `/app/discover?<its state>`; sharing = the app URL (buyer-only).
- Compare (new): `/app/compare?ids=a,b,c` (2–5 suppliers): one column per supplier, FactsPanel rows aligned, each cell with its source mark, differences not highlighted with colour (only facts get hues) but each row can be sorted; actions Send RFQ to all · Save all. Data: `buyer_supplier_profile` per id in parallel (≤ 5).

### 3.9 `/app/settings/rfq` (new) and the rest of settings

Templates (first contact / repeat; subject + body with variables; reset to default) and question presets (ordered list, required-on-first-contact flags, default 10 as in the artifact). AI section: "Ask and why-matched" on/off for this account (server-side flag in `settings_get` payload), follow-up drafting on/off. Profile / plan / notifications restyled only.

### 3.10 `AppShell` — sidebar, topbar, dashboard

Sidebar (232px): logo · Search ⌘K (opens the composer focused) · Suppliers 10,266 · Products · RFQs 7 · Saved 36 · Messages · Compliance hub · Recent searches (3) · plan line ("Free · public beta"; the artifact's "Team plan · renews 1 Oct · 7 of 50 RFQs this month" is a sample — render plan name + RFQ count from `settings_get`/`buyer_dashboard`, no renewal date until billing exists). Badge counts from `buyer_dashboard` (extend with `rfq_count`, `saved_count`, `published_count`). Orders and Compliance sub-pages keep their routes; Orders is reached from Compliance hub and from an accepted quote. Mobile: the existing bottom tab bar pattern (`shell/bottom-tab-bar.tsx`) rebuilt with Search · Suppliers · RFQs · Saved · More.

`/app` (dashboard): Alerts (cert expiry, sanction — existing) · Saved · Recent RFQs · Recent searches, all as the new table/list kit. No chart, no score.

---

## 4. Data and API changes (all additive; dry-run first; founder applies)

### 4.1 `0104_discover_v32.sql` — extend `discover_suppliers`

Add parameters (defaults null, so every existing caller keeps working): `p_hs_codes text[]` (4-digit headings; match when the supplier has any) · `p_cert_state text` ('valid' | 'expiring' | 'expired' | 'any') applied with `p_cert_kinds` · `p_rsc_state text` ('active' | 'lapsed') · `p_est_from int`, `p_est_to int` · `p_workers_max int` · `p_districts text[]`, `p_cities text[]` · `p_exclude_sanctioned boolean default true` · `p_sort` gains 'name', 'workers', 'established', 'cert_expiry', 'hs_lines'. Return gains `is_sanctioned boolean`, `cert_summary jsonb` (per kind: state, expires_on, days_left), `hs_codes text[]` (rarest-first is computed in TypeScript from the catalogue counts), `brand_codes text[]`, `registries text[]`, `top_tier smallint`. Keep the browse fast path (`0071`) and the PostgREST budget tests; add `discover_suppliers_explain(p_… same)` returning the count with each filter dropped in turn (for the zero-results suggestions; only called when total_count = 0).

Guard: contact columns stay out of the return list (test asserts the function's `pg_get_function_result` contains no `email_primary`, `phones`, `contact_name`, `contact_role`).

### 4.2 `0104` continued — `supplier_epb_hscodes_batch(p_slugs text[])` and `hs_catalogue()`

Batch form of `supplier_epb_hscodes` for a results page (≤ 100 slugs) returning slug, hs, heading; and `hs_catalogue()` returning hs, heading, exporter_count (stable, security definer, granted to authenticated). Both reuse the tables `0103` created.

### 4.3 `0105_supplier_record_v32.sql` — `buyer_supplier_profile` additions

Add `contact_counts jsonb` (`{"emails":1,"phones":6,"website":true,"representatives":2,"registers":["BGMEA","BKMEA","BGAPMEA"]}`) computed from the same columns the gated tab reads — counts only, never values; `read_at timestamptz` (max `source_records.fetched_at`), `pages_changed_since_read boolean` (any active source record whose latest `raw_hash` differs from the one at `fetched_at` — if the ETL does not store a later hash, return null and the caption says "read <date>" only); `rfq_count int` for the calling buyer.

### 4.4 `0106_rfq_v32.sql` — drafts, questions, templates, saved searches

- `rfq_drafts (id, buyer_id, payload jsonb, updated_at)` — the composer state; RLS owner-only; one row per buyer per "new" and one per rfq being edited.
- `rfq_questions (id, rfq_id, position, text, required boolean)` and `rfq_quote_answers (quote_id, question_id, answer text)`; `rfq_quote_submit` accepts `answers`.
- `rfq_templates (id, owner_id, kind 'first_contact'|'repeat', subject, body, is_default, updated_at)` and `rfq_question_presets (id, owner_id, position, text, required_first_contact boolean)`; seeded per user lazily from constants in `lib/rfq/defaults.ts` (the artifact's 10 questions).
- `rfqs` gains `name text`, `hs_code text`, `reply_by date`, `incoterm text`, `attachments jsonb` (storage paths), `sent_message_body text` (the rendered message, one per target stored in `rfq_messages (rfq_id, supplier_id, body, delivered_via, delivered_at, opened_at null)`).
- `saved_searches (id, owner_id, name, query_state jsonb, created_at, last_count int, last_counted_at)`.
- `rfq_list` returns `derived_status` ('draft' never here; 'awaiting_reply' | 'quoted' | 'overdue' | 'closed' | 'accepted' | 'cancelled') and `supplier_names text[]`; `rfq_get` returns questions, answers, messages.

### 4.5 `rfq_create` changes

Accept `name`, `hs_code`, `reply_by`, `incoterm`, `questions[]`, `template_kind`, `attachments[]`; refuse a sanctioned target (`raise exception 'target supplier is sanctioned: <name>'`); render and store one message body per target from the template + variables **in SQL or in the API route** — pick the route (`app/api/v1/rfqs/route.ts`) so the preview and the stored body share one TypeScript renderer (`lib/rfq/render-message.ts`) with a boundary test; the RPC stores what the route passes.

### 4.6 Delivery to unclaimed suppliers — needs the founder's yes (§8 Q1)

Today `email_rfq_recipients` only returns claimed suppliers' users. Proposed, behind `RFQ_EMAIL_UNCLAIMED=true`: for an unclaimed target with `email_primary`, send `rfq_received` (existing Resend template, extended with the RFQ body and a reply link) to that address **from the server**; the link carries a signed token (`rfq_reply_tokens`, 30-day expiry, single supplier) that opens `/reply/[token]`: a page with the RFQ, the questions, and a quote form that writes through a new security-definer `rfq_quote_submit_by_token`, and invites the supplier to claim the record (existing claim flow). The buyer never sees the address; `email_log` records the send. Without the flag, the composer shows "This supplier has not claimed its record yet — your RFQ is stored and will be delivered when they do" on that supplier, so the copy never lies.

### 4.7 API routes (new or changed), all under `app/api/v1/`, buyer/admin only via `getServerRole()`, rate class `api_write`/`api_read`

- `GET discover/export?<state>` → CSV (≤ 1,000 rows, the table's columns + source list, no contact fields; filename `sourcebd-suppliers-<date>.csv`). Boundary test asserts a non-entitled caller gets 401 and the body never contains an `@`.
- `POST saved-searches`, `DELETE saved-searches?id=`; `GET saved-searches` with live counts.
- `POST rfqs` (extended), `PUT rfqs/draft`, `GET rfqs/draft`, `POST rfqs/[id]/close`.
- `GET/PUT settings/rfq` (templates, presets, AI flags).
- `POST ai/*` — §5.
- `POST suppliers/[slug]/shipments/unlock`, `GET suppliers/[slug]/shipments` — §4.8.

### 4.8 On-demand Shipments layer — US bill-of-lading customers and shipments per Bangladeshi supplier (added 18 Sep 2026)

Evidence: `design/reference/importyeti/read-2026-09-18.md` (plan, prices, terms, page and API shape) and the "Paid states" section of `design/reference/sourceready/crawl-2026-09-18.md` (what the reference shows once unlocked). Constraints in this section are the founder's (18 Sep brief); the field names are the provider's as documented.

**Terms first.** ImportYeti's Terms §5 make anything fetched through the paid API (or a paid-plan export) "Purchased Data" that we may store, show, redistribute and keep after cancelling — a perpetual covenant not to sue, no audit or field-of-use condition. Two limits bind the design: §6.2 forbids any script against the website, so **the server only ever calls `https://data.importyeti.com/v1.0/*` with a purchased key, never a page**; and §6.4 ("no competitive product") is an account-level risk the founder settles with one email to TheYeti@ImportYeti.com before buying credits (the FAQ invites it). Price on the licensed option, for the founder to decide: pay-as-you-go **$0.090 per credit, minimum 100 credits = $18**, falling to $0.035 at 100,000; one supplier unlock as designed below costs **11 credits (profile 1 + last 100 shipments 10) ≈ $0.99** at the entry tier. Nothing fetched from the free website is stored, ever.

**What the provider can and cannot answer.** US ocean-import bills of lading from 2015: consignee (the US buyer), arrival date, HS 6-digit, description, weight, quantity, ports, house/master B/L numbers. It **cannot** give non-US buyers or destination countries, so "Key export markets" stays "Not on file" (the provider has US only) and the Customers section is labelled "US buyers on bills of lading". Counts differ from SourceReady's (Babylon: 437 US sea shipments here, 3,979 there, because they merge other customs feeds) — every figure carries the provider name.

**Data (migration `0108_supplier_shipments_v32.sql`, additive, dry-run first, founder applies):**

- `sources` gains one row: `('IMPORTYETI', 'ImportYeti (US import bills of lading)', 'tier6_crosscheck', 'https://www.importyeti.com')`. Tier 6 per AGENTS rule 5: shipment data never overwrites a register fact and never publishes a supplier on its own (rule 6 — the stub job only ever attaches to a supplier that already exists).
- `supplier_shipment_stubs (supplier_id uuid pk references suppliers, provider text not null default 'importyeti', provider_ref text null, matched_how text not null check (matched_how in ('exact_alias','name_only','unknown','none')), shipment_count_hint int null, last_seen date null, checked_at timestamptz not null)` — one row per Bangladeshi supplier, filled by the matching job from the **free** `GET /v1.0/supplier/search?name=` list only (`key` → `provider_ref` = the slug, `totalShipments` → hint, `mostRecentShipment` → last_seen, `countryCode = 'BD'` required). Search is free when the slug is later fetched; if the provider ever bills search as the primary call (0.1 per record, their FAQ), the job stops and writes `matched_how = 'unknown'` with a null hint, and matching happens at first unlock instead.
- `supplier_shipments_cache (supplier_id uuid pk, provider text, provider_ref text, fetched_at timestamptz, profile jsonb)` — the trimmed provider profile (`title, also_known_names, address, country_code, total_shipments, date_range, hs_codes[hs_code,shipments,shipments_12m,description], companies_table[company_name, company_address_country, total_shipments_company, shipments_12m, first_shipment, most_recent_shipment]`; `fields=` on the request keeps contact and geocode fields out of the payload altogether).
- `supplier_shipments (id bigserial pk, supplier_id, bl_date date, bl_number text, bl_type text check (bl_type in ('R','H','M')), master_bl_number text null, customer_name text, hs6 text, description text, weight_kg numeric, cif_usd numeric null, quantity numeric, quantity_unit text, departure text, destination text, provider text, provider_ref text, fetched_at timestamptz, unique (supplier_id, bl_number, bl_type))`. `cif_usd` is null on every row the provider returned in testing (its `cif` field is "0"); we keep the column for a second provider and show "—". No contact, notify-party, vessel or geocode field is ever written.
- `supplier_customers (supplier_id, customer_name, shipment_count int, first_seen date, last_seen date, provider, fetched_at, primary key (supplier_id, customer_name, provider))` — derived from `companies_table`, not from the 100 rows.
- `supplier_export_markets (supplier_id, country text, shipment_count int, provider, fetched_at, primary key (supplier_id, country, provider))` — written with the single row `('US', total_shipments)` for this provider; the sheet shows "Key export markets · Not on file · ImportYeti covers US buyers only" until a second provider fills it.
- `provider_spend (id bigserial, provider text, supplier_id uuid, credits numeric not null, user_id uuid, at timestamptz default now(), request_cost_reported numeric null, credits_remaining_reported numeric null)` — one row per paid call, the two reported figures copied from the provider envelope (`requestCost`, `creditsRemaining`).
- RLS: buyers read `supplier_shipments*`, `supplier_customers`, `supplier_export_markets` and the stub through `buyer_supplier_profile` only; `provider_spend` and `supplier_shipments_cache` are service-role only.
- `buyer_supplier_profile` gains `shipments_stub jsonb` (`{matched_how, shipment_count_hint, last_seen, unlocked_at, provider}`) and `shipments_unlocked boolean` (cache younger than 90 days). The RPC never returns rows; the tab fetches them after unlock.

**API (`app/api/v1/suppliers/[slug]/shipments/unlock/route.ts`, `POST`, buyer or admin via `getServerRole()`, rate class `api_write`; a new `suppliers/` folder — today's `supplier/profile` and `supplier/relationships` routes stay where they are).** Order of operations, and the whole point is the first branch:

1. Look up `supplier_shipments_cache` for the slug. If `fetched_at` is within `SHIPMENTS_FRESH_DAYS` (default 90): return `{source: 'cache', fetched_at, rows, customers, markets}` and write **no** `provider_spend` row. A buyer's click buys it once for everyone.
2. Else resolve `provider_ref`: from the stub when `matched_how in ('exact_alias','name_only')`; otherwise call `GET /v1.0/supplier/search?name=<register name>&page_size=10` (free), keep `countryCode = 'BD'`, match by `also_known_names`/title normalisation (`lib/shipments/match-provider.ts`, pure, tested), and update the stub. No BD hit → stub `matched_how = 'none'`, return 200 `{source: 'none'}` and the tab shows the quiet empty state; no credit spent.
3. Charge the org's allowance first — `lib/billing/charge.ts` `charge(org_id, 'shipments_unlock')` (§4.13); exhausted → 402 with the reset date, no provider call, no `provider_spend` row.
4. Fetch server-side with the key from the environment (`IMPORTYETI_API_KEY`; header `IYApiKey`; never in the repo, never in a client bundle): `GET /v1.0/supplier/{ref}?fields=…` (1 credit) then `GET /v1.0/powerquery/us-import/bols?supplier={ref}&page_size=100&fields=bol_number,bol_type,master_bol_number,arrival_date,company_name,hs_code,hs_code_description,product_description,weight,quantity,quantity_unit,exit_port,entry_port,cif` (10 credits; `data.data` holds the rows, `data.totalCount` the population). A 403 "Not enough credits" from the provider returns 503 to the buyer with "Shipment records are temporarily unavailable" and no partial write; a 404 marks the stub `none`.
5. Normalise (`lib/shipments/normalise-importyeti.ts`, pure: provider dates are DD/MM/YYYY in most fields and MM/DD/YYYY in the PowerQuery samples — parse by field, test both), upsert the four tables in one transaction, insert `provider_spend` with the two reported figures, return `{source: 'provider', …}`.

`GET /api/v1/suppliers/[slug]/shipments` (`api_read`) serves the cached rows to the sheet; it returns 404 for a supplier with no cache row, never the provider's data.

**Sheet (§3.3).** A **Shipments N** tab after Certificates, three states from `shipments_stub`: locked = the striped locked card with "Bill-of-lading records · N shipments on file at ImportYeti · Unlock for this record" (N from `shipment_count_hint`; the sentence is "Bill-of-lading records · Unlock to check" when the hint is null); unlocked = the table `Date · B/L (house over master, H/M marks in mono) · US buyer · HS · Description · Weight · Qty · From → To`, 100 rows, a `t6` source mark on the tab that links to `https://www.importyeti.com/supplier/<provider_ref>`, caption "Read <fetched_at> · ImportYeti, US import bills of lading"; none = empty-quiet ("No US bill-of-lading records found under this name"). Under the table, **Customers**: one row per `supplier_customers` entry — name, shipment count, first–last dates, the same mark. In Products stats, **Key export markets** stays "Not on file · ImportYeti lists US buyers only". No chart, no percentage, no "top customer strength", no score — counts, dates, names, HS codes only (Insights-style charts are a later plain table, never a ring). Names wrap; the locked card is striped, never blurred; a sanctioned record keeps its banner above the tab.

**Jobs (Python, `ops/`, dry-run by default per AGENTS 15):**

- `ops/importyeti_match_stubs.py` — walks published Bangladeshi suppliers, calls the free search per register name (and per known alias), writes `supplier_shipment_stubs`. Default run prints counts (`exact_alias / name_only / none / unknown`, sample of 20 matches with both names side by side) and writes nothing; `--apply` writes. It never calls a paid endpoint; a non-zero `requestCost` on any search response aborts the run and reports it.
- `ops/importyeti_refresh.py` — nightly: re-fetches only cache rows with `unlocked_at` in the last 90 days, oldest first, at most 50 per night, and stops when the night's `provider_spend` sum would exceed `IMPORTYETI_DAILY_CREDIT_CAP` (founder-set, default `0` = refresh off). Same dry-run/`--apply` shape.

**Provider choice and credit safety (added after the Volza read, `design/reference/volza/read-2026-09-18.md`).** Two providers fit the same tables: ImportYeti (US bills of lading, free name search, key self-serve) and Volza (Bangladesh customs export declarations — buyers in the EU/UK/Australia/Japan/US with FOB value and destination country, key from their sales desk, **no free search: every call costs $0.10 even when empty**). The `provider` column and `provider_spend` carry both; `lib/shipments/providers/{importyeti,volza}.ts` share one interface (`search`, `profile`, `shipments`) and the route picks by `SHIPMENTS_PROVIDER` (default `importyeti`). Rules that keep the credit balance whole:
- **No code path calls a live provider during build or test.** The provider client throws when `NODE_ENV === 'test'` or the key is empty; every test uses recorded fixtures under `test/fixtures/shipments/` (one real Babylon response per provider, captured by the founder inside each provider's free allowance — Volza gives 100 free API requests, ImportYeti's search is free — and committed with contact fields stripped). A test asserts `fetch` is never invoked by the client without a key.
- **The stub job never runs against Volza.** With `SHIPMENTS_PROVIDER=volza` the matching job exits with "no free search on this provider" and stubs stay `matched_how = 'unknown'`; the locked card reads "Bill-of-lading records · Unlock to check". Matching happens on the first buyer click, inside the one paid call.
- **One click, one paid fetch, cached 90 days for everyone** (step 1 above) and the nightly refresh is off until the founder sets `IMPORTYETI_DAILY_CREDIT_CAP` / `VOLZA_DAILY_CREDIT_CAP` above 0. Expected spend in beta is therefore the number of distinct suppliers buyers actually unlock × ≈ $5, nothing during development.

**Environment (founder sets, `.env.example` documents):** `SHIPMENTS_PROVIDER=importyeti|volza`, `VOLZA_API_KEY`, `VOLZA_DAILY_CREDIT_CAP=0`, and `IMPORTYETI_API_KEY` (empty = the unlock route returns 503 "not configured" and the tab shows the locked card without the Unlock button), `IMPORTYETI_DAILY_CREDIT_CAP=0`, `SHIPMENTS_FRESH_DAYS=90`.

**Acceptance (boundary tests, `node --test`):**

- `POST …/shipments/unlock` for a supplier whose cache row is 10 days old returns 200 with `source: 'cache'` and the `provider_spend` count is unchanged before and after (asserted on the table, not on a helper).
- The same route with a 100-day-old cache row and a mocked provider inserts exactly one `provider_spend` row carrying the mocked `requestCost`, and a second call within the same minute inserts none.
- Rendering `SupplierSheet` for a locked record produces HTML that contains none of the customer names present in `supplier_customers` for that supplier, and contains "on file at ImportYeti"; for an unlocked record the HTML contains no `@` and no field from the provider's contact objects.
- A non-entitled caller gets 401 from both routes; a sanctioned supplier's sheet still shows the sanction banner with the Shipments tab open.
- `ops/importyeti_match_stubs.py` with no flag exits 0, prints the four counts, and leaves `supplier_shipment_stubs` row count unchanged; with a mocked search that reports `requestCost: 0.1` it exits non-zero before any write.
- `normalise-importyeti` round-trips the documented sample rows (H, M and R types; both date formats; `cif: "0"` → null).

Open for the founder (§8): **Q5** is resolved as plan allowances (§4.13); still open whether to buy the first ImportYeti credits / request the Volza key now; **Q6** — send the §6.4 email before the first paid call, or accept the account risk.

### 4.9 Buyer notes and custom fields on a record (SourceReady "Extension fields") — added 18 Sep

- `0109_workspace_v32.sql` (shared with §4.10–4.11): `record_notes (id, org_id, supplier_id, author_id, body text, created_at, updated_at)`; `record_fields (id, org_id, name text, kind text check (kind in ('text','number','date','select')), options jsonb null, position int)`; `record_field_values (org_id, supplier_id, field_id, value jsonb, updated_by, updated_at, primary key (org_id, supplier_id, field_id))`. RLS: rows visible only to members of `org_id` (§4.11). Notes and values never leave the org and never enter `buyer_supplier_profile`.
- Sheet: a **Notes** section under Overview (org-private, striped "Private to <org>" caption, author + date per note, edit/delete own) and a **Your fields** block in the FactsPanel footer that renders the org's fields with an inline editor; `/app/settings/fields` manages the field list (add, rename, reorder, delete with a count of values that go with it).
- API: `GET/POST/DELETE /api/v1/suppliers/[slug]/notes`, `PUT /api/v1/suppliers/[slug]/fields`, `GET/PUT /api/v1/settings/fields` — buyer, `api_write`, org membership enforced in the RPCs, not in the UI.
- Acceptance: a member of org A fetching the sheet for a record noted by org B gets HTML with none of B's note bodies (boundary test on the rendered HTML); a note by a non-member is refused with 403 at the route.

### 4.10 Comments on a record, a search and an RFQ (SourceReady "Comments") — added 18 Sep

- Same migration: `comments (id, org_id, subject_type text check (subject_type in ('supplier','search','rfq')), subject_id text, author_id, body text, created_at, resolved_at null)`. One `CommentsRail` component (right rail, empty state "No comments yet — ask questions and work the record with your team", composer, resolve toggle) mounted on the sheet header, the saved-search page and the RFQ detail. Mentions are plain text in v3.2 (no @-notify).
- API: `GET/POST /api/v1/comments?subject_type=&subject_id=`, `POST /api/v1/comments/[id]/resolve`, `DELETE` own. Org-scoped RLS.
- Acceptance: comments from org B never appear in org A's HTML for the same supplier; posting on a `subject_id` the caller cannot read (unpublished supplier, another org's search) returns 404, not 403 (no existence leak).

### 4.11 Workspaces — one organisation per buyer team, members, invites (SourceReady "Workspace · Members") — added 18 Sep

- Today: no org concept; `profiles.plan_tier` ('starter' | 'growth' | 'enterprise') is per user; `saved_suppliers`, `saved_searches`, `rfqs`, `message_threads` are owner-scoped. Build: `orgs (id, name, plan_tier, created_by, created_at)`, `org_members (org_id, user_id, role text check (role in ('owner','member')), joined_at)`, `org_invites (id, org_id, email, role, token, invited_by, expires_at, accepted_at null)`. Migration backfills **one personal org per existing buyer** (name = display name, owner = the user, `plan_tier` copied) so nothing changes for single buyers; `saved_*`, `rfqs`, `record_notes`, `comments`, `record_fields` gain `org_id` (backfilled from the owner's org) and their RLS switches to org membership; `message_threads` stay per user (a thread is between a person and a supplier).
- `/app/settings/workspace`: name, members list with role, remove member (owner only), invite by email (existing Resend transport, template `org_invite`, 7-day token, `/invite/[token]` accepts into the org for a signed-in user or sends them to sign-up first), leave org. No sub-workspaces. The plan badge in the sidebar reads the org's tier.
- API: `GET/PUT /api/v1/orgs/me`, `POST /api/v1/orgs/invites`, `DELETE /api/v1/orgs/members/[userId]`, `POST /api/v1/invites/[token]/accept`.
- Acceptance: a member sees the org's saved suppliers and RFQs and cannot see another org's (boundary test on `GET /api/v1/saved` for two users in two orgs); an invite token used twice returns 410 the second time; removing the last owner is refused; the backfill dry-run prints the org count = buyer count before `--apply`.

### 4.12 "Chat now" → open the message thread (SourceReady "Chat now") — added 18 Sep

- The sheet action bar gains **Message** next to Send RFQ. For a **claimed** supplier it opens the existing thread (`message_threads`, `/app/messages/[threadId]`, creating one through the existing messages API if none); for an **unclaimed** supplier the button is present but disabled with the caption "This supplier has not claimed its record — send an RFQ instead; it reaches them when they do" (the same sentence the RFQ composer uses, so the copy never contradicts itself). No new tables.
- Acceptance: the disabled state's HTML contains the caption and no `href` to `/app/messages`; the enabled state's route refuses a thread with a sanctioned supplier (server-side, same rule as `rfq_create`).

### 4.13 Unlock allowance instead of credits (resolves §8 Q5) — added 18 Sep

- No purchasable credits in v3.2. `plan_allowances (plan_tier pk, shipment_unlocks_per_month int, contact_reveals_per_month int)` seeded `starter 5 / 10`, `growth 30 / 60`, `enterprise 200 / 400` (founder-editable in SQL, no UI). `org_usage (org_id, period date, shipment_unlocks int, contact_reveals int, primary key (org_id, period))`. `lib/billing/charge.ts` becomes real: `charge(org_id, 'shipments_unlock')` increments the current period inside the unlock transaction and raises `allowance_exhausted` when the count would pass the plan's number; the route returns 402 with `{remaining: 0, resets_on}` and the locked card reads "0 of 30 unlocks left this month · resets 1 Oct". A cache hit never charges (it already served everyone).
- `/app/settings/plan` shows the counters and the reset date; no payment flow (upgrades are by email to the founder in beta, and the page says so).
- Acceptance: the 31st unlock on `growth` in one period returns 402 and writes no `provider_spend` row and no `org_usage` increment; a cache hit after exhaustion still returns 200 with the rows.

---

## 5. V2 AI, end to end (OpenAI)

### 5.1 Foundation — key, module, guards, caps, logging

- **Key provisioning**: `OPENAI_API_KEY` (and optional `OPENAI_MODEL`, `AI_ENABLED`, `AI_DAILY_TOKEN_BUDGET`) are set **by the founder himself** in his local `.env` and in `/opt/sourcebd/.env` on the VPS (`docs/ENTERPRISE_DEPLOYMENT.md` §"Secrets stay on the VPS"). They are never pasted in chat, never in a Linear issue, never in CI (CI does not call OpenAI). Add the names to `.env.example` with empty values. The guard refuses writing `.env`; the implementer asks the founder to add the line and stops.
- **Transport**: plain `fetch` to `https://api.openai.com/v1/responses` from `lib/ai/openai.ts` (`runtime = "nodejs"`), with `store: false`, `max_output_tokens` per task, a 20 s timeout, one retry on 429/5xx with jitter. **No `openai` npm package** (AGENTS rule 4: no new packages) unless the founder grants the exception in writing. Model default `gpt-5-mini`, overridable by `OPENAI_MODEL`; the implementer confirms the current model list on the day and records the choice in the PR.
- **Structured outputs**: every task has a JSON schema in `lib/ai/schemas/*.ts` and is called with `text.format = { type: "json_schema", strict: true }`; the response is validated again in TypeScript before use (hand-written validators, no zod — same reason). Any output that fails validation is dropped and the UI falls back to the V1 rendering; nothing is retried in a loop.
- **Server-only**: `lib/ai/*` is imported only from route handlers and server components. Test `lib/ai/server-only.test.ts` greps every `"use client"` file for `lib/ai` and fails on a hit.
- **PII**: contact fields never enter a prompt (the RPCs already exclude them); buyer identity is never sent — prompts carry facts about suppliers and the buyer's own typed text only.
- **Prompt-injection guards**: supplier-derived text (names, products, addresses, scraped fields) is placed in a fenced `data` block with the instruction that it is data, not instruction; outputs are limited to the schema; any string field is capped (≤ 300 chars) and stripped of URLs not present in the input; the system prompt forbids claims without a `fact_ref`.
- **Grounding**: every task that describes a supplier receives a list of facts `{id, label, value, source_code, source_url}` and must return `claims[]` each with `fact_refs[]`; the server drops any claim whose refs do not resolve, and the UI renders the source mark of the first ref beside the sentence. That is how "every fact has a source mark" survives generated text.
- **Caps**: new rate class `ai` (20/min/user) in `lib/rate-limit/limits.ts`; a daily token budget per user and per instance (`ai_usage (user_id, day, tokens_in, tokens_out, calls)`; default 200k/user/day, `AI_DAILY_TOKEN_BUDGET` for the instance); when exhausted the UI shows "AI is resting until tomorrow" and V1 continues.
- **Cache**: `ai_cache (key sha256(task|model|prompt_version|input_hash), output jsonb, created_at)`; summaries keyed on the record's `read_at` so a re-read invalidates; parse-query cached 24 h per normalised sentence.
- **Log**: `ai_runs (id, user_id, task, model, prompt_version, tokens_in, tokens_out, ms, status, error)` — no prompt text, no output text (the cache holds output keyed by hash). Admin `/admin/ai` page lists runs and spend (admin only; this is the one place a raw model name shows).
- **Kill switch**: `AI_ENABLED=false` hides every V2 surface; the code path is the V1 path, tested independently.
- **Tests**: no network in `pnpm test`; `lib/ai/fixtures/*.json` are recorded responses; `scripts/ai-eval.mjs` runs 40 golden sentences → expected chips against the live API **only** when `OPENAI_API_KEY` is set locally (never in CI), prints precision per chip type, and is run before each AI PR with its output pasted in the PR.
- **Migration** `0107_ai_v2.sql`: `ai_usage`, `ai_cache`, `ai_runs`, `ai_conversations`, `ai_turns`, `rfq_followup_drafts` — all RLS owner-only (admin read on `ai_runs`).

### 5.2 Ask stop — sentence → chips ("Reads as")

`POST /api/v1/ai/parse-query { text }` → `{ chips: [{type:'hs'|'cert'|'cert_state'|'registry'|'brand'|'district'|'city'|'type'|'workers_min'|'workers_max'|'est_from'|'est_to'|'rsc'|'min_sources'|'text', value, label, confidence:'high'|'low'}], unresolved: string[], clarify?: {question, options[]} }`. The prompt receives the closed vocabularies (HS headings with labels from `lib/epb-hscode-labels.ts`, cert kinds, registries, brand codes, the district list from `discover_facets`, the BD place lexicon in `lib/bd-place-lexicon.ts`), and the schema constrains `value` to them. Free text that maps to nothing becomes a `text` chip (plain `q`). UI: the chips appear under the composer as "Reads as:" with an Edit affordance per chip and "Run search"; **nothing runs until the buyer confirms** (one click; Enter confirms). Low-confidence chips render dashed and are excluded by default. `clarify` (e.g. "Denim — fabric mills or garment factories?") renders as a single question with options, at most once per sentence; it replaces Smart Match's wizard. A confirmed sentence + chips is stored as an `ai_conversations` row (title = the sentence, chips, resulting URL) so the sidebar's "Recent searches" and `/app/searches` can list Ask searches the same as saved ones.

### 5.3 Conversation memory (thin)

`ai_conversations (id, owner_id, title, created_at)` and `ai_turns (conversation_id, role, text, chips jsonb, result_url, created_at)`. The Ask stop keeps the last three turns in context so "only Gazipur" after a search refines the chips instead of starting over. No chat UI with long answers: the answer to every Ask turn is chips + one sentence ("320 suppliers export knitted shirts and hold a valid GOTS") + the results panel. Suggested next steps (three chips, like the reference's follow-up chips) are generated from the same call: `next_steps: [{label, chips_delta}]`, each applying a chip change, never free text.

### 5.4 Why matched (per result)

`POST /api/v1/ai/why-matched { chips, results: [{id, facts[]}] }` batched per page (≤ 25), called from the server component after the RPC, cached per (chips hash, supplier id, read_at). Output per result: `{ id, met: [{chip_id, fact_ref, phrase}], unmet: [chip_id] }`. Rendered as the artifact's one-line band: `V2` tag · "Why matched" · phrases like "GOTS-31587 valid to 12 May 2027" · "HS 6105 on the EPB exporter page", each with the source mark of its fact. **No count, no percentage, no adjective.** Deterministic pre-pass: chips whose match is a plain fact (registry present, HS present, cert state) are filled in TypeScript without the model; the model only phrases text-chip matches (product words against `principal_products`). If the model returns a `fact_ref` that does not support the chip (server check: the fact's value contains the chip value for HS/cert/registry), the phrase is dropped.

### 5.5 Record summary (sheet Overview)

`POST /api/v1/ai/record-summary { slug }` → server fetches the same profile the sheet shows, builds the fact list, asks for ≤ 4 sentences, each with `fact_refs`. Rendered as the `summary` paragraph; hovering a sentence shows its facts. Cached until `read_at` changes. Never mentions contact details (not in the input), never a customer the record does not list, never "leading", "trusted", "premier" — the schema has a `banned_words` check server-side and the run is dropped on a hit.

### 5.6 Improve wording (RFQ editor)

`POST /api/v1/ai/rfq-improve { subject, body, variables[] }` → rewritten subject/body that must contain every `{{variable}}` exactly once each (server check; otherwise dropped), shorter or equal length, no new claims. Shown as a diff the buyer accepts or rejects; never auto-applied.

### 5.7 Suggest questions

`POST /api/v1/ai/rfq-questions { product, hs_code, cert_kinds[] }` → ≤ 5 questions drawn from the preset list plus at most 2 new ones specific to the product (schema: `from_preset_id | text`). Added as unchecked suggestions in the Questions step.

### 5.8 Follow-ups and replies — draft only

A scheduled job in the same shape as `lib/email/jobs/cert-expiry.ts` (a callable function, not a route; that job's own cron wiring is still a follow-up — Inngest keys exist in `.env.example` but nothing in the app imports Inngest) runs daily, triggered by one new admin-token route `POST /api/v1/jobs/run?job=rfq-followups|cert-expiry` that the VPS cron calls with a bearer secret (`JOBS_SECRET`, founder-set, same handling as `OPENAI_API_KEY`) — this also gives the cert-expiry digest its missing trigger: for each sent RFQ past its follow-up rule with no supplier message, it calls `POST /api/v1/ai/rfq-followup` internally and writes `rfq_followup_drafts (rfq_id, supplier_id, body, status 'draft')`; the buyer sees "1 follow-up drafted" on the RFQ row and in Messages, reads it, and clicks Send (existing `thread_send_message` + delivery §4.6). Likewise for a supplier reply: a suggested buyer reply is drafted into the thread composer, never sent. **Auto-send is not built**; if the founder wants SourceReady's "AI auto reply" later, it is a separate spec with its own consent copy.

### 5.9 Where V2 shows and where it must not

Shows (always with the `V2` tag and `smart` hue): the Ask stop and its chips · why-matched band · Overview summary · Improve wording · Suggest questions · follow-up drafts. Must not: anywhere as a number, a rank, a badge, a colour on a fact, or a sentence without a source mark.

---

## 6. HS photo catalogue

`design/assets/products/hs/manifest.json` (46 headings; prompt, job id, CDN file, exporter count, source URL per heading). 12 files are in the repo under `design/assets/products/aboni-knitwear/hs-<code>.min.webp`; the other 34 exist only on the Higgsfield CDN (`d8j0ntlcm91z4.cloudfront.net`, blocked from the design sessions). **Founder task before this ships**: save the 34 PNGs into `design/assets/products/hs/` as `hs-<code>.png` (or allowlist the host so the session can). The implementer then runs a one-off script `scripts/build-hs-photos.mjs` → `public/products/hs/hs-<code>.webp` at 512px and 128px (sharp is not a dependency — use the Playwright Chromium already in devDependencies to resize, or ask the founder for the `sharp` exception) and a generated `lib/hs-catalogue.ts` (`{hs, short, heading, exporters, hasPhoto}`). Strips order rarest-first by `exporters`; a heading without a file renders the code on `surface-sunken` with "no photo yet" — never a substitute. Every photo carries the caption "Illustrative photo, keyed to the HS code" on the sheet and in `ProductSheet`; the supplier-attested upload that replaces it is a supplier-portal V2 item, not in this handoff.

---

## 7. Sequence, issues, verification

Nine PRs to `development`, each behind its own gate (AGENTS 9a), each with the four-command verification gate from `CLAUDE.md` pasted raw and compared to the baselines at `e15966c` (602 tests, 86 suites; `tsc` clean). Create the Linear issues before starting, with plain descriptions on first mention:

1. **REZ-A (the code port of the dashboard kit)** — `tokens.ts` → Tailwind utilities for every `dash.css` class the six screens use (`.card`, `.mk.t1–t5`, `.chip.*`, `.tile`, `.strip`, `.sheet`, `.fp`, `.rt`, `.dialog`, `.statusrow`, …) as React pieces under `components/dashboard/*` (not `components/ui/*`); `/dev/ds` gains the six screens rendered from real data. No route changes. Migration none.
2. **REZ-B (results page: cards, table, composer Filters stop, saved searches, export)** — migrations `0104`; `/app/discover`, `/app/products`, `/app/searches`; Smart Match redirect. Boundary tests: URL state round-trip, PII absent from RPC result and HTML, CSV auth.
3. **REZ-C (supplier record sheet and product line)** — migration `0105`; sheet + full page + `ProductSheet` + compare. Boundary tests: contact counts without values; sanctioned banner present in every tab's HTML.
4. **REZ-D (RFQ composer, list, settings, delivery)** — migration `0106`; the composer, list, detail, `/app/settings/rfq`, §4.6 behind its flag (founder decides in §8 Q1 before this PR). Boundary tests: `POST /api/v1/rfqs` 51 targets → 400; sanctioned target → 400 with name; preview = stored body.
5. **REZ-E (AI foundation + Ask + why-matched)** — migration `0107`; `lib/ai/*`, `/api/v1/ai/parse-query`, `why-matched`; kill switch; admin `/admin/ai`; eval script output in the PR.
6. **REZ-F (AI on the record and the RFQ)** — summary, improve wording, suggest questions, follow-up drafts job.
7. **REZ-G (on-demand shipments layer)** — migration `0108`; the unlock and read routes, the Shipments tab and Customers section on the sheet, `ops/importyeti_match_stubs.py` and `ops/importyeti_refresh.py` (dry-run default). Boundary tests: cached unlock writes no `provider_spend` row; locked-sheet HTML carries no customer name; stub job dry-run changes no row. Includes the allowance (§4.13, needs REZ-H's `orgs`). Needs §8 Q6 and the provider key in the founder's `.env`; ships after REZ-H.
8. **REZ-H (workspaces and comments)** — migration `0109`; orgs, members, invites, the personal-org backfill (dry-run first), org-scoped RLS on saved/searches/RFQs, `CommentsRail` on record, search and RFQ. Boundary tests: two orgs cannot read each other's saved rows, notes or comments; invite token single-use; last owner cannot be removed. Ships after REZ-D.
9. **REZ-I (notes, custom fields, Message button)** — `record_notes`, `record_fields`, `/app/settings/fields`, the Message action (§4.12). Boundary tests: cross-org note leak = none in HTML; disabled Message state carries the claim caption and no thread link. Ships after REZ-H.

**Build order (the letters are labels, not sequence): A → B → C → D → H → G → E → F → I.** H (orgs) precedes G because the unlock allowance is per org; E and F (AI) come after the data screens so every AI surface has real facts to sit on; I is last because it only decorates the record. Each PR branches from `development` after the previous one has landed there — never from an unmerged feature branch (closed-loop §19).

Checks before the switch (from the rebuild spec §6, applied to these screens): screenshots at 320 and 1280 of every route above, light only (dark mode is "later"); contrast pairs test green; the 100- and 125-character names on card, table, sheet, compare and RFQ rows; the 11-source and one-source records; the 54-code and 39-product lists; a sanctioned sample on every surface; `ar-fashion` on every surface; every AI surface with `AI_ENABLED=false` (must be invisible) and with the budget exhausted (must degrade to V1).

Each PR ends with the closed-loop protocol (`.cursor/rules/sourcebd-closed-loop.mdc`) and stops at `ACCEPTED_FOR_HUMAN_REVIEW`; landing on `development`, promoting to `main`, and deploying are three separate asks. Migrations `0104`–`0109` are applied by the founder after the dry-run output is posted (AGENTS 15).

---

## 8. Decisions I made, and the questions only the founder can answer

Decisions (say so if any is wrong):
- **No weighted "requirements", no match percentage, no verified badge, no reviews, no purchasable credits** — the first four are the reference's scoring economy (receipts, not opinions); unlocks and contact reveals are metered by plan allowance (§4.13) instead.
- **Workspaces, comments, notes/custom fields and the Message button are in v3.2** (§4.9–4.12, founder's call 18 Sep); sub-workspaces, marketplace suppliers, listing prices, Insights charts, Chat with unclaimed suppliers stay out.
- **Products = the HS catalogue**, not a buyer product library; the buyer's product spec lives in the RFQ.
- **Saved is one list in v3.2**; the sheet button reads "Save"; named lists are V2.1.
- **Orders leaves the primary nav** (reachable from Compliance hub and from an accepted quote) because the approved sidebar has no Orders item.
- **Auto-send by AI is not built**; follow-ups and replies are drafts the buyer sends.
- **Plain `fetch`, no OpenAI SDK, no zod** — to respect "no new packages"; both are one-line exceptions if you prefer them.
- **Ask replaces the Smart Match wizard** (`/app/match` redirects); `buyer_smart_match` stays in the database until nothing calls it.
- **Shipments and US customers are built on demand (§4.8)** through the paid ImportYeti API, never scraped, cached once for every buyer; **key export markets stay a data gap** because that provider lists US buyers only.

Questions:
1. **RFQ delivery to unclaimed suppliers** (§4.6): may the server email the register address (`email_primary`) with a reply link, behind a flag? Without a yes, the composer must say the RFQ waits for the supplier to claim, and the approved sentence "reaches the supplier through SourceBD either way" comes off the locked card.
2. **The 34 HS photos**: will you drop the files into `design/assets/products/hs/`, or allowlist the CDN host for the next session?
3. **OpenAI**: confirm you will set `OPENAI_API_KEY` in your local `.env` and in `/opt/sourcebd/.env` yourself when REZ-E starts, and whether `gpt-5-mini` as the default model is acceptable (cost: parse-query and why-matched are ≤ 2k tokens per call; a results page costs about one call).
4. **Attachments on RFQs** need a Supabase Storage bucket (`rfq-attachments`, private). Create it, or leave attachments out of REZ-D?
5. **Provider and key**: which provider goes live first (`SHIPMENTS_PROVIDER=importyeti|volza`), and will you buy the first 100 ImportYeti credits ($18) or request the Volza key now, so REZ-G's one real smoke test can run? Allowance numbers in §4.13 are defaults — change them if you want.
7. **Workspace roles**: owner/member only in v3.2, invites by email through the existing Resend transport — acceptable, or do you want a read-only role?
6. **ImportYeti Terms §6.4** ("no competitive product"): send the one-line use-case email to TheYeti@ImportYeti.com before the first paid call, or accept the account risk? The data itself is covered by §5 either way.

---

## 9. Session prompt for the build (copy, fill the blanks, paste) — added 18 Sep

Before pasting, on the founder's side — checked 18 Sep against the tree (HEAD `f684684` on `design-rebuild`):
1. `design-rebuild` is approved (spec §9) but sits **30 commits ahead of `development`**, not landed. The prompt's first step asks for the go to land it (AGENTS 9a gate 1); commit this handoff, `design/reference/*` and `design/assets/products/hs/fetch.ps1` with it, and commit or stash the rest of the dirty tree so REZ-A starts clean (AGENTS 11).
2. HS photos: 12 are in the repo (`design/assets/products/aboni-knitwear/hs-<code>.min.webp`), **34 exist only on the Higgsfield CDN**, which the org proxy blocks from both the Cowork shell and the cloud container. Run `powershell -ExecutionPolicy Bypass -File design\assets\products\hs\fetch.ps1` once in a normal PowerShell window; it saves the 34 as `hs-<code>.png` next to the manifest (idempotent, public URLs, no secrets). Then Q2 = "in repo".
3. `.env` today has `SUPABASE_DB_URL` and none of `OPENAI_API_KEY`, `SHIPMENTS_PROVIDER`, `IMPORTYETI_API_KEY` / `VOLZA_API_KEY`, `RFQ_EMAIL_UNCLAIMED`, `RESEND_API_KEY`. Add the ones the answers below need. Say in Q8 whether that `SUPABASE_DB_URL` is production; if it is, the builder makes a Supabase branch for the boundary tests and never runs them against production.
4. The prompt stops at `/deploy-preflight`: applying `0104`–`0109` to production, the deploy, the VPS `.env` and the 30-day zero-P1/P2 Sentry window are yours. The Facilities section on the record ships only when `rez-73-facilities-lean` has landed; until then it renders the quiet empty state.

```
Build the SourceBD buyer dashboard v3.2 end to end from context/feature-specs/handoff-dashboard-v3.2-implementation.md.

Operating mode: closed-loop adversarial acceptance (.cursor/rules/sourcebd-closed-loop.mdc). You are the orchestrator. You never decide work is done; the Acceptance Judge does, per PR, with the literal token ACCEPTED_FOR_HUMAN_REVIEW.

Read once, in this order: AGENTS.md · context/agent-brief.md · context/current-state.md · context/feature-specs/active.md · context/feature-specs/ds-rebuild-must-stay.md §1 §2 §5 §9 · design/README.md · design/dashboard-ux-flow.md · the handoff in full · design/reference/sourceready/crawl-2026-09-18.md · design/reference/importyeti/read-2026-09-18.md · design/reference/volza/read-2026-09-18.md · design/src/. Then only the code paths each PR touches and their tests. Every claim about current state is a hypothesis: verify with git, the database and the tests before relying on it.

Founder answers (authoritative — do not re-ask; if a line is blank, ask that one question and wait):
Q1 Email RFQs to unclaimed suppliers behind RFQ_EMAIL_UNCLAIMED: ___ (yes / no)
Q2 HS photos: ___ ("in repo" after running design/assets/products/hs/fetch.ps1, or "not yet")
Q3 OPENAI_API_KEY is in .env; default model gpt-5-mini: ___ (yes / <model>)
Q4 Storage bucket rfq-attachments: ___ (created / leave attachments out of REZ-D)
Q5 SHIPMENTS_PROVIDER=___ (importyeti / volza); its key is in .env: ___ (yes / no); §4.13 allowance numbers: ___ (keep / <new numbers>)
Q6 Provider terms email: ___ (sent / accept the risk)
Q7 Workspace roles owner/member only: ___ (yes / add read-only)
Q8 SUPABASE_DB_URL in .env is: ___ (dev or branch database / production — if production, create a Supabase branch for tests and use it)

Step 0: `design-rebuild` holds the approved kit, 30 commits ahead of `development`. Verify the tree is clean, then ask me once for the go to land `design-rebuild` on `development`; after that every PR branches from `development`. Do not start REZ-A before that landing.

Scope: the nine PRs of §7 in the build order A → B → C → D → H → G → E → F → I, exactly as §3–§6 specify. Use the route, table, RPC, API and file names as written; where the handoff names a thing, do not rename it; where it says "not building", do not build it. Non-goals are §1's "Not building" rows and §8's decisions.

Per PR: (1) branch from the latest development with a clean tree; (2) create the Linear issue with a plain description; (3) implement exactly the spec, no drive-by refactors; (4) run the four verification commands from CLAUDE.md, paste the raw output, compare with the baselines and explain every difference in either direction; (5) run the checks the handoff names for that PR — boundary tests at the HTTP status / rendered HTML / row-count level, screenshots at 320 and 1280, the named records (Aboni, a one-source record, ar-fashion, the 54-code and 39-product lists, a sanctioned sample), every AI surface with AI_ENABLED=false and with the budget exhausted; (6) fan out the Data Profiler (or Requirements critic for code-only work), Invariant Auditor, Adversarial Critic and Test-adequacy critic with the evidence bundle and none of your reasoning; repair root causes, add a durable guard per defect, re-verify, re-audit until the Judge accepts; (7) open the PR to development and stop with "Ready for human review. Not merged." Wait for my explicit "merge" before landing it, ask again before starting the next PR, never touch main, never deploy, never --apply a migration or backfill — post the dry-run output and wait.

Database: tests that touch the database use SUPABASE_DB_URL from .env, which points at a dev or branch database; refuse to run them against the production URL. Migrations are dry-run against that database and posted; production is mine.

Credit and key safety: no build or test step calls ImportYeti, Volza or OpenAI live. Provider and AI clients throw when NODE_ENV=test or the key is empty; tests run on recorded fixtures under test/fixtures/ with contact fields stripped; the stub job never runs against Volza. One real smoke call per provider and per AI feature runs only when I say so, and its raw response goes in the PR. Never print a key.

No guessing: a rendered value, status code, redirect, email or row count counts as done only when a test asserts it at that boundary. If a spec line is ambiguous or two lines conflict, stop and ask one question. Banned in reports: should, probably, appears, seems, likely.

Reply style: five lines or fewer, plain words, every issue id with a description on first mention. When all nine PRs have landed on development, run /deploy-preflight on the development head, paste its output and stop; deployment is a separate ask.
```
