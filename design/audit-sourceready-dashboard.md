# Audit — sourceready.com dashboard (screen recording, 18 Sep 2026)

Reference for the SourceBD buyer dashboard. We take the journey and the density; we take none of the chrome. Recording: `dashboard-sourceready.com.webm` (2:42, repo root). Frames were sampled every 3 s.

## 1. What the reference does (inventory)

| # | Screen / piece | What it holds | Interaction |
|---|---|---|---|
| 1 | Home | Greeting, one big chat composer, mode chips (Supplier search · Product research · Product ideation · More · Manual filter), template gallery with tabs | Type or pick a template |
| 2 | Sidebar | New chat · Search chats · Supplier · Product · Inquiry; "Chats / Today" list; plan + credits footer; "Earn credits" | Chats are the history; nav is 3 objects |
| 3 | Search chats | Popover with recent chats | Filter as you type |
| 4 | Answer | "Thought for 21 s", one summary sentence ("90 scored suppliers, 89 perfect"), then a results block | Streams in |
| 5 | Results block | Title, toolbar (search · sort · comments · expand · table / card toggle), "Total 30 suppliers", select-all | View toggle keeps the query |
| 6 | Table view | Columns: name, match score, product images, business types, factory certs, employees, actions | Dense, 36 px rows |
| 7 | Card view | Logo, name, Verified, country · year · size · type; highlight chips (+N more); 4 mini tiles (Description · Shipments · Key customer · Key market); product carousel; "100 % matched" + "why matched" expander | Card = the unit of comparison |
| 8 | Highlights popover | Grouped list (Manufacturing & capability · Enterprise & brands · Trading & flexibility), each with a one-line meaning | Opens from "+3 more" |
| 9 | Supplier details sheet | Right sheet (~55 % width). Header: logo, name, verified, "100 % matched"; meta line; tabs (Overview · Products 584 · Reviews · Customers · Certifications · Shipments · Insights · Extension fields · Inquiries) | Tabs scroll to sections; sheet keeps results behind it |
| 10 | Overview | Paragraph + "View more"; Contact card (Private 0 / Public 5, emails, Send inquiry, Save to list); highlights grid; Products stats (Products · Categories · Avg price · MOQ range) + grid | |
| 11 | Reviews / Customers | 4.5 ★ with tag counts; customer chips with "Unlock all 11 customers" | Paid unlock |
| 12 | Certifications | Card with "+3", detail popover with plain description | |
| 13 | Key export market | Flag chips | |
| 14 | Factory images | 4-up photo grid | |
| 15 | Shipments | Table with 1 real row then blurred rows and "Unlock all 61 shipments (20 credits)" | Credits gate |
| 16 | Insights | Four blurred chart cards, each "Upgrade plan" | Plan gate |
| 17 | Extension fields / Inquiries | Upgrade note; "Start your first inquiry" empty state | |
| 18 | Sticky action bar | Send inquiry ▾ · Save to list · Chat now — dark pill, bottom-centre of the sheet | Always reachable |
| 19 | Product detail | Nested sheet with back: image, price, MOQ, Send inquiry / Save / Create product; attribute table (model, collar, size, material…) | |
| 20 | Inquiry list | Page: status chips (All · Email replied · Quotes received · More), Filter, search, fields, sort, "+ Add inquiry"; table | |
| 21 | Select supplier | Modal with tabs (All · Favorites · this chat), empty state "No suppliers added or saved" | |
| 22 | Send inquiry | Modal, three columns: left rail (Selected supplier · Selected product · Basic info 1/6 · Preset questions 10 · Advance settings); template editor with variable chips and a product table; right live preview with "Missing inquiry name" flags; footer Save as draft · Send now | "Improve with AI" |
| 23 | Advance settings | Auto CC · AI follow-up (interval, stop rules) · AI auto reply · Custom prompt · Knowledge bases | |
| 24 | Toast | "Saved as draft" | |
| 25 | Product list / Product detail | Table with status (Private · Active); detail with image and attribute chips (colour, size, material, fit) | |

## 2. What we keep (pattern, not pixels)

- **One journey**: ask → list → record → contact, and the record opens as a sheet so the list stays. This is the spine of our dashboard.
- **The rich result card**: identity line, highlight chips, four small fact tiles, a product strip, an optional "why". Ours swaps their tiles (Description · Shipments · Key customer · Key market) for the facts we actually hold (Listed by · Certificates · Capacity · Registers).
- **Tabs with counts** on the record; a **sticky action bar** at its foot.
- **Composer with a mode switch** — theirs is chat-first with "Manual filter" as an afterthought; ours is filter-first with "Ask" as V2.
- **The three-column inquiry composer** (rail · editor with variables · live preview) and the missing-field flags. Ours is the RFQ composer.
- **Product detail as a nested sheet with back.**
- **Status chips on the list page**, table, toast.
- **Plan-gated rows** — but shown as a state, not a blur (below).

## 3. What we change, and why

| Reference | SourceBD | Reason |
|---|---|---|
| "100 % matched", match-score column, 4.5 ★ reviews | None on any buyer surface. V2 "why matched" names the filters met, never a number | Product rule: receipts, not opinions. No score, grade or star. |
| Verified badge (blue) | Source-mark row (tier ramp) + certificate states | "Verified" by whom? We show the register and its rank instead. |
| Blurred shipments / customers with a credits price | `locked` striped rows that say how many exist and which plan reads them | Locked is a state, not a veil; no credits economy in V1. |
| Photos are supplier uploads / scraped | Per-HS-code catalogue photos, labelled illustrative; supplier upload replaces in V2 | We hold EPB HS codes, not SKUs. Nothing fake presented as real. |
| Products 584 · categories · avg price · MOQ | HS codes · product list · certified scope · buyer lists | The facts we have. Price and MOQ are supplier-attested fields, shown only when attested. |
| Chat history as the sidebar list | Recent searches (V1); conversations join the list in V2 | No AI in V1. |
| Blue primary, lavender AI, shadows on cards, rounded 12 px | Forest brand, `smart` lavender only for V2 surfaces, hairlines, radius 6 / 10 / 14 | v3 tokens (artifact `3n9MkVaXgFaFokziwhmP5o`). |
| Credits, "Earn extra 1000+ credits" | Plan block with RFQ usage meter | Plan model, not credits. |
| Reviews, Insights charts, Extension fields | Dropped for V1 (Insights returns in V2 as EPB export analytics) | No data behind them today. |
| Sanctions: none | `sanction` bar on the card and banner on the sheet, Send RFQ disabled | Rule: cannot be hidden by layout. |

## 4. Mapping their objects to ours

| Theirs | Ours | Source of truth |
|---|---|---|
| Supplier | Supplier (10,266 published) | registers + cert bodies |
| Product | HS export line (EPB, 2,476 companies) + supplier product list (BGMEA/BKMEA) | EPB, BGMEA, BKMEA |
| Inquiry | RFQ | RFQs table |
| Chat | Search (V1) / Ask (V2) | — |
| Customers | Buyer lists (H&M, ASOS, NEXT, Inditex, Primark) | brand disclosures (tier 4) |
| Certifications | Certificates: OEKO-TEX, GOTS, WRAP, SA8000 with number, issuer, expiry state | cert bodies (tier 3) |
| Shipments | Not held. V2: EPB export detail | — |
| Factory images | Not held in V1. Facilities (598 buildings on 476 mothers) instead | RSC / BGMEA |
| Key export market | Not held. RSC safety + inspection links instead | RSC |
| Extension fields | Not in V1 | — |

## 5. V1 / V2 split

- **V1 (ships):** AppShell, SearchComposer in Filters mode, ResultsList, SupplierResultCard (without the why-matched band), ProductTile with illustrative photos, SupplierSheet, ProductSheet, CertificateCard, StatTiles, LockedTable, RFQComposer (without AI controls), RFQList, EmptyState, Highlights, Toast.
- **V2 (design only now):** Ask mode and its "Reads as" chips, why-matched band, "Improve wording", auto follow-up / auto reply, conversation history in the sidebar, supplier-uploaded photos replacing generated ones, Insights. Everything V2 is `smart` lavender and wears the `V2` mono tag so it cannot be mistaken for live.

## 6. Where the pieces live

- Design System artifact (source of truth): https://claude.ai/artifact/3n9MkVaXgFaFokziwhmP5o — group **Data display** (ResultsList, ResultsTable, RFQList) and **Overlays** (SupplierSheet, ProductSheet, RFQComposer); v3.2, 18 Sep 2026.
- Reference screenshots: `design/reference/sourceready/`.
- Screen sources and renders: `design/src/`, `design/renders/v3.2/`.
- UX flow spec: `design/dashboard-ux-flow.md`.
- Product photo manifest: `design/assets/products/aboni-knitwear/manifest.json` (the 12 WebPs sit beside it).
