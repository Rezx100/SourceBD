# SourceBD buyer dashboard — end-to-end UX flow (V1, with V2 marked)

Companion to `audit-sourceready-dashboard.md`. Components are in the Design System artifact (`3n9MkVaXgFaFokziwhmP5o`); this file is the order they run in and the rules between them. Every count below is production, 18 Sep 2026.

## The spine

```
Home ─▶ Search (composer) ─▶ Results (cards | table) ─▶ Supplier sheet ─▶ RFQ composer ─▶ RFQ list
                 │                    │                       │
                 │                    └─ Save to list          ├─ Product sheet (HS line)
                 └─ Recent / saved searches                    └─ Compare (V1: up to 4 in a table)
```

The sheet never navigates away from the results: it opens over them at 880 px (full width under 1024 px), closes with Esc or the ✕, and the list keeps its scroll and selection.

## 1. Home (`AppShell` + `SearchComposer`)

- Greeting line with one serif word; the composer centred; four saved searches with live counts.
- Sidebar: Search (⌘K) · Suppliers · Products · RFQs (count) · Saved (count) · Messages · Compliance hub; **Recent searches**; plan block with RFQ usage.
- Nothing is hidden as a security control; server decides what a plan can read.
- V2: the composer's **Ask** stop and conversations in the sidebar list.

## 2. Search (`SearchComposer`, Filters mode)

- Query line takes free text (product, HS code, certificate, district, company name) → resolves to chips.
- Filter vocabulary: Product / HS (4-digit chapter 61–62 codes, or a product word that maps to codes), Certificate (kind + state: valid / any), District, Workers (band), Source (register / body), Buyer list (brand).
- Active chips are removable; the count under the composer updates on every change ("312 suppliers").
- Empty result → `EmptyState` offering the two nearest relaxations **with their counts** (drop a chip, widen a state).
- Loading keeps the composer in place; a skeleton query line; caption "Searching 10,266 records…".
- V2 Ask: the sentence resolves to the same chips ("Reads as:") before anything runs, so the buyer corrects the reading, not the answer.

## 3. Results (`ResultsList` → `SupplierResultCard` | `Table`)

- Header: select-all · query title · live count · Sort (default: most sources; then workers, certificates, name) · Save search · Export CSV · card/table toggle.
- Card bands: identity (name wraps to 100 chars; type · district · year · workers · source marks 1–11 + count) · highlight chips · four tiles (Listed by · Certificates · Capacity · Registers) · product strip (3 HS tiles + `+N`) · V2 why-matched.
- Table view: same facts as columns, 36 px rows, sticky header, "1–25 of 312".
- Selection: checkbox per card → bulk bar (Save to list · Compare · Send RFQ to N). Max 4 for Compare.
- Sanctioned: 4 px `sanction` bar, badge first, Send RFQ disabled. (No live case today; gallery shows a labelled sample.)
- Every chip and tile states a fact from a source. No score, grade, star or "verified" badge.

## 4. Supplier record (`SupplierSheet`)

- Bar: close · "Supplier record" · read date + source count · Share · more.
- Head: name (`heading-lg`, wraps) · type badge · district · year · workers · register number (`code`) · full source-mark row.
- Tabs with counts: Overview · Products (HS) · Certificates · Safety (RSC) · Sources · Locations · Facilities · RFQs. Tabs scroll to sections.
- Overview: summary paragraph (facts only, in plain language) · FactsPanel (28 px rows, source mark per row, "Not on file" for the ~half of fields that are empty) · **Contact card, locked by default** (striped, says what is hidden and that the RFQ still reaches the supplier) · Send RFQ / Save to list / Compare.
- Products: StatTiles (HS codes · Product list · Certified scope · Buyer lists) · ProductTile grid (8 shown, "Show all N") · "Photos are illustrative" chip.
- Certificates: one card per certificate with the four data states (valid / expiring ≤90 days / no expiry on file / expired); none-state names the registers checked.
- Safety: RSC active or no-longer-covered; one remediation % meter; training status; five report links, missing ones as dashed quiet chips; `LockedTable` for saved report files beyond the plan.
- Sources: the tier list with per-source read dates and "page changed since read" flags.
- Locations: address rows (wrap; up to 10) with pin confidence as exact / approximate.
- Facilities: only on mother companies (476), buildings inside the mother, never alone.
- RFQs: this buyer's RFQs to this supplier, else `EmptyState`.
- Sticky action bar: Send RFQ · Save to list · Compare · "Every fact links to its source page".
- Sanctioned: `SanctionBanner` under the bar on every tab; Send RFQ disabled.

## 5. Product line (`ProductSheet`)

- Nested sheet with back and breadcrumb (supplier / HS code).
- Photo (illustrative, generated per HS code; V2 supplier upload replaces it) · heading text · facts (chapter, exporter since, other lines, certified scope, product list, EPB source link) · Send RFQ for this line · "Other exporters of NNNN · count" (runs the HS chip across the catalogue).

## 6. RFQ (`RFQComposer` → `RFQList`)

- Entry points: card, sheet action bar, product sheet, bulk bar, RFQ list "+ New RFQ".
- Rail: Suppliers (1–N, first contact / repeat) · Product (name, HS, target price, qty; warnings when missing) · Details 2/6 (RFQ name, reply-by date, incoterm, destination, currency, attachments) · Questions (10 preset, 5 required on first contact) · Follow-up rules (V2).
- Editor: template (First contact / Repeat supplier) · subject and body with variable chips (`brand-tint`; missing = `caution-tint`) · product table · question list · Attach · Insert variable. V2: Improve wording.
- Preview: the message as delivered, missing fields still flagged. SourceBD delivers; the buyer never needs the supplier's address.
- Footer: "N fields missing" · Save draft · Send RFQ. Send is disabled until required fields are filled.
- After send: toast; RFQ list shows Sent → Read by supplier → Quoted / Reply overdue (caution after reply-by) → Closed.
- Sanctioned supplier cannot receive an RFQ; the rail shows the sanction chip and the send is refused server-side too.

## 7. Empty states that almost everyone sees at launch

7 RFQs, 0 quotes, 0 orders, 36 saved suppliers on production. Messages, RFQs, Saved and Compare open on `EmptyState` copy that says what the feature does and offers one action. No apology, no exclamation mark.

## 8. Responsive

- ≥1280: sidebar 232 + content ≤1200; sheet 880.
- 1024–1279: sidebar collapses to icons (56 px); sheet 720.
- <1024: sidebar becomes a top sheet; result card tiles wrap 2×2; product strip scrolls; the sheet is full-screen with the action bar fixed; RFQ composer stacks rail → editor → preview as tabs.
- 320–430: tested widths per the rebuild spec; names still wrap, nothing truncates.

## 9. Rules carried from the rebuild spec

- Colour means something: brand only on primary action, links, active nav, logo. Status hues only on facts. `smart` only on V2 surfaces. `sanction` reserved.
- Hairlines, not shadows; shadows lift only the composer, popovers, sheets and dialogs.
- Locked is striped, never blurred. Empty is quiet, never a warning.
- Names wrap; nothing truncates. Every fact has room for a source mark and a link.
- Works with animation off; keyboard reaches everything; 4.5:1 text, 3:1 controls, 7:1 sanction.
