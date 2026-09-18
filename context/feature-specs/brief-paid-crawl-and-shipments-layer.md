# Brief for the next session — paid SourceReady states, ImportYeti read-only, on-demand Shipments layer

Written 18 Sep 2026 at the end of the session that produced `handoff-dashboard-v3.2-implementation.md`. This brief is the only thing the next session needs besides the boot files in `AGENTS.md` rule 3. Read those four first, then this, then the two files it points at. Do not re-crawl what is already captured.

## Where things stand

- Approved screens: the Design System artifact (https://claude.ai/artifact/3n9MkVaXgFaFokziwhmP5o) and `design/src/`. Handoff to build them: `context/feature-specs/handoff-dashboard-v3.2-implementation.md` (queued in `active.md`). Its §8 holds four founder questions still open.
- What SourceReady's dashboard contains, read signed in on the free workspace and on the paid **Entry** workspace (`WSP01M2S7Y6…`, $35/month, 300 paid + 30 daily credits, expires 18 Oct 2026): `design/reference/sourceready/crawl-2026-09-18.md`. On Entry, bill-of-lading customers and shipment rows are open; contacts (20 credits per "Unlock all N"), product stats unlocks, Insights charts (Pro), Extension fields (Pro) are not.
- Not yet seen anywhere: an **unlocked** contact block, an unlocked product stats block, the "View all 3,979 shipments" page, `/supplier/[supplierId]` and `/inquiry/[inquiryId]` as full pages (only their side-sheet forms were captured), the "1 sort" popover.
- Side effects so far: one supplier (Yiwu Zhihong Clothing) was added to the **free** workspace's favourites by a test click; a draft inquiry to Dreamcolor Scientic BD Ltd exists in the paid workspace (founder-made; opened, never sent). Nothing has been sent from either account.

## Task 1 — spend at most 60 SourceReady credits, capture every unlocked state

Budget: 60 of the 300 paid credits (30 daily credits reset 00:00 UTC — use those first). Stop at 60 even if something is unseen; report what was skipped.

1. Open a **Bangladeshi** record with a full data set (Babylon Garments Ltd. from the chat "Dhaka Shirt Manufacturers", or Mega Denim Limited from "Denim Style Discussion"). Click **Unlock all N** on Contact (20 credits). Capture the unlocked block exactly: what is a "public" vs "private" contact, which fields (name, role, email, phone, WeChat/WhatsApp, LinkedIn), whether a source is named, whether unlocking is per contact or per supplier, whether it persists across sessions. Do **not** write the values themselves into the repo — record shape and labels only.
2. On a Chinese marketplace record (Meiga (Xiamen) Garments, `reportId=10373257` in the seamless-leggings chat on the free workspace, or any from the paid one), click one **Unlock (20 credits)** on the Products stats (Products / Categories / Average price / MOQ range) — one unlock only — and capture what changes.
3. Click **View all 3,979 shipments** on Babylon (0 credits expected; stop if it asks for credits). Capture the full-page shipments table: columns, filters (date range, customer, HS category, port), sort, export, paging, what "H" vs "M" bills of lading mean on screen.
4. Open `/WSP01M2S7Y6YBCC18R7RJHV4WCKC1/supplier/list`, click a row, and capture `/supplier/[supplierId]` as a **full page** (header, tabs, action bar, URL). Then `/inquiry/list` → the draft → capture the composer once more only if something differs from the crawl file; do not press Send now.
5. Try the "1 sort" popover and the Comments panel once each with a real click; if nothing opens, note it and move on.

Add the findings as a new section "Paid states (Entry, <date>)" at the end of `crawl-2026-09-18.md`. No new file.

## Task 2 — ImportYeti, read-only, no bulk pull

The founder has an ImportYeti account and will sign in **himself** in the built-in browser pane before this task (the session never types passwords, never creates accounts, never accepts new terms — if a consent or plan-change dialog appears, stop and ask).

Capture, for the handoff's data-gap items (bill-of-lading customers, shipments, key export markets) and **only for Bangladesh-origin suppliers**:

1. The account's plan, what a "credit" or "unlock" is, what one supplier page costs, what an export costs, monthly limits, and the wording of the terms about automated access and redistribution (quote at most one short line; link the page). If automated access or storing the data is disallowed by the plan, say so in the report — the integration design below then needs a licensed feed instead, and the session must not scrape around it.
2. The shape of one Bangladesh supplier page (search "Babylon Garments" or "Ha-Meem Denim"): fields, the shipment table columns, customers list, HS categories, destination countries, date range, the supplier identifiers ImportYeti uses (name, address, any id), and how a supplier is matched to a company name (aliases, "also known as").
3. Search behaviour: can it be filtered to country = Bangladesh; what the results list shows per supplier without opening the page (shipment count, last shipment date, top customer); paging and result caps.
4. Whether there is an **API** or a data-export product, its pricing page, and the exact fields in an export sample if one is free.
5. Do not open more than 10 supplier pages and do not spend any credit without the founder saying which supplier to spend it on.

Write the findings to `design/reference/importyeti/read-2026-09-XX.md` (shape and labels; no customer names copied beyond the one example page; no contact data at all).

## Task 3 — extend the handoff with an on-demand Shipments layer

Add a §4.8 to `handoff-dashboard-v3.2-implementation.md` and one row to its §1 "Supplier record" table (replacing the "Data gap" verdict on customers/shipments/key markets with "Build, on demand"). Design constraints, fixed by the founder:

- **Stub for every Bangladeshi supplier, full data only on demand.** One row per supplier in `supplier_shipment_stubs (supplier_id, provider 'importyeti', provider_ref, matched_how, shipment_count_hint int null, last_seen date null, checked_at)` filled by a matching job that uses only what the provider's search list shows without spending credit. If the search list itself costs credit, the stub holds only `matched: unknown` and the matching happens at first unlock.
- **A buyer's click buys it once for everyone.** `POST /api/v1/suppliers/[slug]/shipments/unlock` (buyer, rate class `api_write`): if `supplier_shipments_cache` has the supplier and it is younger than the freshness window (90 days), return it — no credit spent; otherwise the server fetches the provider page/API **server-side with the provider key from the environment** (`IMPORTYETI_API_KEY` or session token, founder-set in `.env`, never in the repo), normalises into `supplier_shipments (supplier_id, bl_date, bl_number, customer_name, hs6, description, weight_kg, cif_usd, quantity, quantity_unit, departure, destination, fetched_at)` and `supplier_customers (supplier_id, customer_name, shipment_count, first_seen, last_seen)` and `supplier_export_markets (supplier_id, country, shipment_count)`, records the spend in `provider_spend (provider, supplier_id, credits, user_id, at)`, and returns the data. The buyer who clicked is charged on **our** side (plan allowance or credits — the billing piece is the founder's call; the API takes a `charge` step that is a no-op in beta).
- **Every fact keeps a source mark.** Shipment rows carry the provider as source (a new `sources` row, tier 6 cross-check per AGENTS rule 5 — shipment data never overwrites register facts and never publishes a supplier on its own) and link to the provider page. In the sheet: a **Shipments** tab (locked state = the striped locked card: "Bill-of-lading records · N shipments on file at ImportYeti · Unlock for this record"), a Customers section under it, and "Key export markets" in the Products stats — all three empty-quiet when the stub says none.
- **No score.** Counts, dates, names, HS categories only; no "top customer strength" percentages, no charts in v3.2 (SourceReady's Insights are Pro upsell; ours can come later as plain tables).
- **Refresh**: a nightly job re-checks only records unlocked in the last 90 days, at most 50 per night, and never spends more than `IMPORTYETI_DAILY_CREDIT_CAP` (founder-set, default 0 = refresh off).
- **Terms**: if Task 2 finds that storing or redistributing is not allowed on the current plan, the section says so first and the design is written against the licensed option, with its price, for the founder to decide.

Acceptance the handoff must state: a boundary test that the unlock route for a cached supplier records **no** `provider_spend` row; a test that the sheet's Shipments tab HTML contains no customer name for a locked record; the stub job runs as a dry-run by default and prints counts before any `--apply` (AGENTS rule 15).

## Browser mechanics that cost an hour to learn — do not relearn

- `app.sourceready.com` is treated as high-risk: every browser action needs `request_access` first (scope "site" still grants one action). Batch everything possible into one `javascript_tool` call (≤ 45 s per call; ≤ 6 page loads per call with `window.next.router.push` + 3.8 s waits).
- The app mobile-gates narrow panes: emulate 1600×1000 with `resize_window`; reset to preset `desktop` at the end. Settings pages are desktop-only.
- Synthetic `.click()` opens sheets, results blocks and sidebar chats **sometimes**; popovers, Save to list, tab buttons and row clicks need a **real** click. Real clicks map from the screenshot frame to the page by a factor that changes with the pane size: instrument once with `document.addEventListener('click', e => …clientX/Y…, true)`, click a harmless spot, read the recorded page coordinate, derive the factor, then click at `page/factor`. Reading `ref_N` coordinates from `find` is not reliable under emulation.
- Chat ids are not in the DOM; open a chat by real-clicking its sidebar row. Results blocks open by clicking their title; the supplier sheet opens by clicking a name in the results **panel**, not in the inline chat table.
- Escape closes the whole results panel, not just a popover — close popovers by clicking the trigger again.
- The free session was logged out mid-crawl once; Google's account chooser then asks for a password — stop there and ask the founder to sign in.
- ImportYeti: unknown as of this brief. Expect a sign-in wall, cookie banner (decline non-essential), and possibly a "downloads count as credits" rule — read the pricing page before opening supplier pages.

## What the founder does before starting the next session

1. Keep the SourceReady Entry login alive in the browser pane, and sign in to ImportYeti there.
2. Answer the four questions in the handoff's §8 if ready (RFQ delivery to unclaimed suppliers, the 34 HS photo files, the OpenAI default model, the attachments bucket). None blocks this brief's three tasks.
3. Say which single supplier the 20-credit contact unlock and the 20-credit product unlock may be spent on, or accept the defaults above (Babylon Garments Ltd.; Meiga (Xiamen) Garments).
