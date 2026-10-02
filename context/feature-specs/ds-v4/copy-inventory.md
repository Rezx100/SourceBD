# Copy inventory: v3 strings rewritten for v4

Session S0, 3 Oct 2026. Rules: `context/feature-specs/voice-v4.md`. S3 to S8 take the
**v4** column; never today's text.

**Where the strings came from.** Visible text, placeholders and accessible names
pulled from the 39 server-rendered screens in `.impeccable/preview/paper-import/raw/*.html`
(`landing.html` left out; it is marketing). Desktop and phone render from the same
markup, so one row covers both. 2,016 raw strings; supplier names, HS names, dates and
per-row figures are data, so each data shape gets **one pattern row** (`{n}`, `{date}`,
`{body}`) instead of one row per supplier. The old Paper file was not needed.

**Rule codes.** R1 to R10 are the ten voice rules. N = number rules, D = date rules,
SRC = source pattern, ST = state wording, G = glossary (all in `voice-v4.md`).
Register IDs (W-, S-) say which listed fault the row closes.

Screen keys: `results` `cards` `filters` `record` (pane) `full` (record page) `line`
(product page) `headings` · `rfqs` `rfq-detail` `rfq-new` `rfq` · `orders` `order-detail`
`orders-new` `orders-new-form` · `messages` `messages-thread` · `saved` `searches`
`searches-new` · `compliance` `compliance-expiry` `compliance-uflpa` `compliance-msa` ·
`products` `product-new` `product-form` `product-edit` · `settings*` · `shell` = all 39.

---

## GATE 0: 20 before/afters

From the five worst screens. Pre-approved (overnight run, founder default).

| # | Screen | Today | v4 | Rule |
| --- | --- | --- | --- | --- |
| 1 | record | Read 18 May – 18 Sep 2026 · 11 sources | 11 sources · last checked 18 Sep 2026 | SRC, D, W-06 |
| 2 | record | 3 premises · registry spellings merged | 3 sites | R4, W-01, RC-09 |
| 3 | record | Factory Plot- 169-171, 195-196 … Also recorded as: 160-171, Tetulgora … PLOT-169-171, UNION: TETULZHORA … | Plot 169–171, Hemayetpur, Savar, Dhaka | W-05, RC-09 (one address, no variants) |
| 4 | record | Capacity, as filed 1,000,000 pcs/day | 1,000,000 pieces a day, as declared to BGMEA | R6, N, W-01 |
| 5 | record | Source pending: the register that filed this is not linked per fact yet | Source not linked yet. It is one of the 11 below. | R4, ST |
| 6 | record | Bangladesh Garment Manufacturers & Exporters Association Industry body · general:3498 read 24 Jul 2026 | BGMEA reg. no. 3498 · checked 24 Jul 2026 | SRC, W-05 (no hash IDs) |
| 7 | record | The buildings could not be read. | We couldn't load the sites. Try again. | ST error, S-18 |
| 8 | filters | Every filter is a URL: the results update when you apply, and each chip removes one. | (delete) | R4, W-01 |
| 9 | filters | Who filed it / Who lists it / What it holds / Its state | Member of / Brand supplier lists / Certificates / Certificate status | R1, W-01 |
| 10 | filters | Registers and certifiers on file, at least | At least this many sources | R1, G |
| 11 | filters | Apply filters | Show 4,645 suppliers | R3, R5 |
| 12 | results | knit · Sanctioned hidden | knit · hiding sanctioned suppliers | G, S-16 |
| 13 | compliance | Of your 16 saved suppliers that are published, 0 match the U.S. UFLPA Entity List, 1 has Xinjiang-linked text in the record and 15 are clear. | Three tiles: 0 on the UFLPA Entity List · 1 possible Xinjiang link · 15 no link found | R2, W-03, G |
| 14 | compliance | Built from 16 published saved suppliers, 11 covered by the RSC and 3 certificates expiring in 90 days. | Three tiles: 16 saved suppliers · 11 covered by RSC · 3 certificates expire within 90 days | R2, N, W-03 |
| 15 | compliance-uflpa | 0 hits · 1 region flag · 15 clear | 0 on the Entity List · 1 possible Xinjiang link · 15 no link found | G, S-17 |
| 16 | rfqs | 5 sent · 4 quotes | 5 RFQs sent · 4 quotes received | N, W-02 |
| 17 | rfqs | Open · no quote yet / Quoted · 2 / Quote accepted / Closed | Waiting for quotes / 2 quotes / Accepted / Cancelled | G (one status set), S-17 |
| 18 | rfq-detail | 5.90 USD / pcs | US$5.90 per piece | N |
| 19 | rfq-detail | 2 submitted | 2 quotes | N, G |
| 20 | rfq-detail / quotes | Action (column) + Accept | (no column title) + Accept quote | R3 |

---

## 1. Search and record

### Search, results, cards, filters

| Screen | Today | v4 | Rule |
| --- | --- | --- | --- |
| shell | Search suppliers, HS codes, certificates (placeholder, cut on phone) | Supplier, product or certificate | R2, S-13 |
| shell | Recent searches | Recent searches | keep |
| shell | knit · GOTS 42 (recent search) | knit · GOTS · 42 suppliers | N |
| results, cards | Discover (anywhere) | Search | G, S-16 |
| results | 4,645 suppliers · 1–25 | 4,645 suppliers | N (one count per idea) |
| results | 1–25 of 4,645 | Showing 1–25 of 4,645 suppliers | N |
| results | Page 1 of 186 | Page 1 of 186 | keep |
| results | 25 per page / 50 per page / 100 per page | 25 / 50 / 100 per page | keep |
| results | Selecting rows is not available on this list | (delete; hide the checkbox) | R4 |
| results | Select all on this page | Select all 25 on this page | N |
| results | Filters · 1 | Filters · 1 on | N |
| results | Add filter | Add filter | keep |
| results | Remove Sanctioned hidden (chip label) | Show sanctioned suppliers | R3, G |
| results | Sanctioned hidden (chip) | Hiding sanctioned suppliers | G |
| results | Sort: Most registers & certifiers | Sort: most sources | G |
| results | Most HS headings | Most products exported | G |
| results | Certificate expiry soonest | Certificate expiring soonest | R1 |
| results | Workers on the supplier record (sort) | Most workers | R1 |
| results | Established (sort) | Year founded | R1 |
| results | Density / Compact / Comfortable / Default | Row height: compact / comfortable | R1 |
| results | Table / Cards (view) | Table / Cards | keep |
| results | Export CSV | Download CSV | R3 |
| results, cards | Save search | Save search | keep |
| results | More for this search | More actions | R1 |
| results | Export lines (column) | Products exported | G |
| results | `{n}{hs} · {hs}` e.g. "12 6115 · 6114" | 12 products · HS 6115, 6114 … | N, S-03 |
| results | `{cert} · Expires {date} · {n} days` | GOTS expires in 18 days (≤30 days) / GOTS expires 1 Nov 2026 (>30) | D |
| results | WRAP Gold · Expires 29 Sep 2026 · 0 days | WRAP Gold expires today | D, W-02 |
| results | GOTS 1 d WRAP Gold +3 | GOTS expires tomorrow · 3 more certificates | N, D |
| results | `{cert} · Valid to {date}` | GOTS valid until 12 May 2027 | D, R10 |
| results | `{cert} · Expired {date}` | SA8000 expired 23 Jul 2021 | keep (D) |
| results | OEKO-TEX Standard 100 · No expiry on file | OEKO-TEX Standard 100 · no expiry date published | ST, R1 |
| results | none on file | None found | ST |
| results | not on EPB list | Not on the EPB exporter list | R1 |
| results | `{n} workers` + bare row figure | `{n} workers` | N |
| results, record | `{a} workers · on the supplier record (· {b} workers · across this record and its buildings)` | `{b} workers at {k} sites` (BGMEA figure `{a}` on tap) | N (one count), W-02 |
| results | `{a} workers · on the supplier record · {b} workers · RSC inspection` | `{a} workers` (RSC counted `{b}`, on tap) | N, SRC |
| results | `{a} … · {b} workers · across its buildings, not this record` | `{b} workers at its sites` | N |
| results | Buying house · Workers not on file | Buying house · workforce not published | ST |
| results | Factory · Narayanganj | Factory · Narayanganj | keep |
| results | Unit-2 · Factory · Gazipur | Factory · Gazipur (Unit 2) | W-05 |
| results | Shed - 3, 4, 5, 10 … · Building - Security, ETP and Fire Pump · Factory · Narayanganj | Factory · Narayanganj · 5 buildings | W-05 |
| results | Saved · click to remove | Saved · remove | R3, R4 |
| results | Send an RFQ | Send RFQ | R3, G |
| results | Open {supplier} beside the results (aria) | Open {supplier} | R2 |
| cards | `{n} registers & certifiers · Brand lists: not on a brand list we read` | `{n} sources · on no brand supplier list` | G, N |
| cards | 1 register or certifier | 1 source | G |
| cards | AS HM +27 registers & certifiers · 2 brand lists | 29 sources · listed by ASOS and H&M | SRC, N |
| cards | EPB exporter · 12 lines | Registered exporter · 12 products | G |
| cards | +12 lines · illustration | 12 more products · example photo | N, G |
| cards | illustration | Example photo | R1 |
| cards | `+{n}: {cert} · no expiry on file, …` (overflow tooltip) | `{n} more certificates` + list on tap | N, R2 |
| cards | RSC inspected | Inspected by RSC | SRC |
| cards | Not on the EPB exporter list · No certificate on file · Nothing else on file · 0 of the sources read | Not found in the 14 sources we check | ST empty |
| cards | Nothing else on file · 1 of the sources read | Found in 1 of 14 sources | N |
| cards | GOTS expired 4 Apr 2026 · OEKO-TEX Standard 100 · no expiry on file | GOTS expired 4 Apr 2026 · 1 more certificate | R2 |
| cards | HS 6211 · Track suits, swimwear vs HS 6112 · Tracksuits, swimwear | One HS name list (filters' names) everywhere | G, W-04 |
| filters | Filters (no h1) | Filters | S-23 |
| filters | What kind of company / Factories / Buying houses | Company type / Factories / Buying houses | R1 |
| filters | Where it is / District / City | Location / District / City | R1 |
| filters | What it exports / HS heading | Products exported / HS code | G |
| filters | Several headings: separate them with commas. | Add several HS codes, separated by commas. | R3, G |
| filters | 6105 / 1990 / 2026 (placeholders at full size) | e.g. 6105 · e.g. 1990 · e.g. 2026 | S-19 |
| filters | What it holds / Certificate | Certificates | R1 |
| filters | Its state: Valid / Expiring / Expired / Lapsed | Certificate status: valid / expiring / expired | R10, W-01 |
| filters | Who files it (BGMEA, BKMEA, BGAPMEA …) | Member of (BGMEA, BKMEA …) | G |
| filters | Who lists it (Inditex, M&S, Primark …) | Brand supplier lists | G |
| filters | RSC safety record / Active | RSC safety programme: active | G |
| filters | RSC safety record active (chip) | In the RSC safety programme | G |
| filters | Registers and certifiers on file, at least | At least this many sources | G |
| filters | Workers, at least / Workers, at most | Workers from / to | R1 |
| filters | Established from / Established to | Founded from / to | R1 |
| filters | Any | Any | keep |
| filters | Clear all | Clear all | keep |
| filters | Apply filters | Show {n} suppliers | R3, R5 |
| filters | Filters 1 set | 1 filter on | N |
| filters | Every filter is a URL: … | (delete) | R4 |
| headings | HS headings (nav, title) | HS codes | G |
| headings | 8 HS headings · exporter counts leave out sanctioned suppliers, as the search does | 8 HS codes · counts leave out sanctioned suppliers | R2, R4 |
| headings | Chapter / Heading / Exporters / Photo | Chapter / HS code / Suppliers exporting / Photo | G, N |
| headings | Search headings (placeholder) | Search HS codes | G |
| headings | Knit apparel / Woven apparel / Leather goods / Made-up textiles | keep | keep |

### Supplier record (pane, full page, product page)

| Screen | Today | v4 | Rule |
| --- | --- | --- | --- |
| record | Supplier record (eyebrow) | (delete) | R4 |
| record | Supplier record Aboni Knitwear Ltd Read 18 May – 18 Sep 2026 · 11 sources | Aboni Knitwear Ltd · 11 sources · last checked 18 Sep 2026 | SRC, D |
| record | 11 of 14 registers read hold a record for this company | Found in 11 of the 14 sources we check | R1, N |
| record | 11 sources +3 | 11 sources | N (no bare +n) |
| record | Factory Dhaka Est. 1985 3,166 workers across 2 sites BGMEA 3498 | Factory · Dhaka · founded 1985 · 3,166 workers at 2 sites · BGMEA reg. no. 3498 | N |
| record | Overview / Operations / Locations / Certificates / Sources / Products (tabs) | Overview / Products / Certificates / Safety / Sites / Sources | G |
| record | Locations 3 | Sites · 3 | G |
| record | 3 premises · registry spellings merged | 3 sites | R4, RC-09 |
| record | Factory address PLOT-169-171, UNION: TETULZHORA, HAMAYETPUR, SAVAR, DHAKA | Plot 169–171, Hemayetpur, Savar, Dhaka | W-05 |
| record | Also recorded as: … | (delete) | RC-09 |
| record | Registered · Mailing 2-B/1, Darussalam Road, Mirpur, Dhaka-1216 Also recorded as: … | Registered office: 2-B/1 Darussalam Road, Mirpur, Dhaka 1216 | W-05, RC-09 |
| record | Registered name ABONI KNITWEAR LTD. | Registered name: Aboni Knitwear Ltd. | W-05 |
| record | Type Factory · Dyeing, Knit, Packaging, Woven | Factory · dyeing, knit, packaging, woven | R1 |
| record | Parent group Babylon Group | Part of Babylon Group | R1 |
| record | Established 1985 | Founded 1985 | R1 |
| record | Workers 3,166 across 2 sites | 3,166 workers at 2 sites | N |
| record | Workforce and capacity | Workers and capacity | R1 |
| record | Sewing machines 850 | 850 sewing machines | N |
| record | Capacity, as filed 1,000,000 pcs/day | 1,000,000 pieces a day, as declared to BGMEA | R6, N |
| record | Product list / 27 items as filed / 27 as filed | Products declared to BGMEA · 27 | SRC, N |
| record | +19 more as filed / Show fewer | Show 19 more / Show fewer | R3 |
| record | EPB export lines · / HS lines | Products they export | G |
| record | 12 EPB, chapter 61 | 12 products in HS chapter 61 · from EPB | N, SRC |
| record | All 12 lines | All 12 products | G |
| record | Buyer lists / 3 ASOS · H&M · NEXT | Brand supplier lists: ASOS, H&M, NEXT | G, N |
| record | Registrations | Memberships and registrations | G |
| record | BGMEA General 3498 | BGMEA reg. no. 3498 | SRC |
| record | BKMEA 625 - B/2002 | BKMEA reg. no. 625-B/2002 | SRC |
| record | BGAPMEA 597 | BGAPMEA reg. no. 597 | SRC |
| record | EPB Reg BD04293 / exporter page 3335 | EPB exporter BD04293 / EPB exporter page | SRC |
| record | Certificates 4 / 4 on file | Certificates · 4 | N |
| record | GOTS GOTS-27605 GSCS International Ltd. Expired 4 Apr 2026 | GOTS · GOTS-27605 · issued by GSCS International · expired 4 Apr 2026 | SRC, R10 |
| record | GOTS GOTS-31587 TÜV Rheinland (China) Ltd. Valid to 12 May 2027 | GOTS · GOTS-31587 · issued by TÜV Rheinland · valid until 12 May 2027 | R10, D |
| record | WRAP Gold 7865 WRAP Expires 29 Sep 2026 · 11 days | WRAP Gold · 7865 · expires in 11 days | D |
| record | WRAP Gold 7865 WRAP Expired 29 Sep 2026 | WRAP Gold · 7865 · expired 29 Sep 2026 | keep (D) |
| record | OEKO-TEX Standard 100 32597-100 OEKO-TEX No expiry on file | OEKO-TEX Standard 100 · 32597-100 · no expiry date published | ST |
| record | Certified scope / Scope of GOTS GOTS-27605 | What the certificate covers | R1 |
| record | GOTS dyeing; embroidery, embellishment; finishing +6 · products: men's apparel | Covers dyeing, embroidery, finishing and 6 more · men's apparel | N, R1 |
| record | Open the certificate | Open certificate | R3 |
| record | Safety RSC / Safety | Safety (RSC) | SRC |
| record | Remediation 100% Active initial plan completed · training completed | RSC remediation: 100% done · programme active | G, R1 |
| record | Structural / Fire / Electrical / Boiler | keep (RSC's own categories) | R8 |
| record | Aboni Knitwear (New Shed) — the building's own RSC record · read 30 Jul 2026 | Aboni Knitwear (New Shed) · RSC record for this building · checked 30 Jul 2026 | SRC |
| record | RSC factory 9342 · read 30 Jul 2026 | RSC factory 9342 · checked 30 Jul 2026 | SRC |
| record | The buildings could not be read. | We couldn't load the sites. Try again. | ST error |
| record | Sources 11 | Sources · 11 | keep |
| record | ASOS Brand disclosure list · b376ef6e0404ae78 read 30 Jul 2026 | Listed on ASOS's supplier list · checked 30 Jul 2026 | SRC, W-05 |
| record | H&M / NEXT Brand disclosure list · {hash} read {date} | Listed on H&M's supplier list · checked 26 Jun 2026 | SRC |
| record | Export Promotion Bureau Government register · 3335 read 14 Aug 2026 | EPB exporter 3335 · checked 14 Aug 2026 | SRC |
| record | RMG Sustainability Council Government register · 9342 read 18 Sep 2026 | RSC factory 9342 · checked 18 Sep 2026 (RSC is not a government body) | SRC, truth |
| record | Bangladesh Knitwear Manufacturers & Exporters Association Industry body · 619:detail read 2 Aug 2026 | BKMEA reg. no. 625-B/2002 · checked 2 Aug 2026 | SRC, W-05 |
| record | Global Organic Textile Standard Certification body · gots-SCO039488 read 26 Jun 2026 | GOTS database · checked 26 Jun 2026 | SRC |
| record | OEKO-TEX / WRAP Certification body · {slug} read {date} | OEKO-TEX Label Check · checked 26 Jun 2026 | SRC |
| record | Source: {body}, {tier} (opens the register page) (aria) | Source: {body}. Opens its page. | SRC |
| record | Source pending | Source not linked yet | ST |
| record | Source pending: the register that filed this is not linked per fact yet | Source not linked yet. It is one of the 11 below. | R4, ST |
| record | Authority logos identify the data sources we aggregate from. SourceBD is not affiliated … | Logos show where each fact comes from. None of these bodies endorses SourceBD. | R2 |
| record | Contact details | Contact details | keep |
| record | Contact details are not shown on the record. Send an RFQ from the record instead. | Contact details are locked. Send an RFQ and the supplier replies here. | ST locked |
| record | Contact person / Email / Phone / Website · 1 on file / 3 on file | Contact person · 1 email · 3 phone numbers · website | N |
| record | You have not sent this supplier an RFQ yet. | No RFQs to this supplier yet. | R7 |
| record | RFQs 3 / 3 from your account | RFQs · 3 you sent | N |
| record | Saving a record needs a signed-in account | Sign in to save suppliers. | R3, ST |
| record | Save / Saved / Share / Copy a link to this record | Save / Saved / Share / Copy link | R3 |
| record | Send RFQ | Send RFQ | keep |
| record | Expand to full page | Open full page | R3 |
| record | Results / Back to results | Back to results | R3 |
| record | Report a problem / What is wrong or missing on this record? / Send report | keep | keep |
| record | Record sections (aria) | Sections | R1 |
| line | Back to the record / Back | Back to Aboni Knitwear | R3 |
| line | Aboni Knitwear Ltd / HS 6105 (breadcrumb) | Aboni Knitwear › HS 6105 | keep |
| line | Chapter 61 · Articles of apparel, knitted or crocheted HS nomenclature | Chapter 61 · knitted or crocheted clothing | R1 |
| line | Exporters of 6105 · 1,634 | 1,634 suppliers export HS 6105 | N |
| line | Exporting since Not on file · EPB lists lines, not dates | Exporting since: not published by EPB | ST |
| line | Illustrative photo, keyed to the HS code 6105. Not the supplier's own product; a supplier-attested upload replaces it (V2). | Example photo for HS 6105. Not this supplier's product. | R2, W-01 |
| line | Price · MOQ · lead time Not attested · supplier-attested fields, shown when attested | Price, MOQ and lead time: ask in an RFQ | R5, W-01 |
| line | Other lines 6102 · 6103 · … | Other products they export: HS 6102, 6103 … | G |
| line | Product list All Kind of Knit Item · … +23 items | Products declared to BGMEA · 27 | SRC, N |
| line | Buyer lists ASOS · H&M · NEXT disclosure lists | Listed by ASOS, H&M and NEXT | SRC |
| line | Certified scope GOTS-31587 · dyeing; … +6 · products: men's apparel Valid to 12 May 2027 | GOTS-31587 covers dyeing, embroidery, finishing and 6 more · valid until 12 May 2027 | R10 |
| line | edb.epb.gov.bd · exporter 3335 / read 14 Aug 2026 / Exporter page | From EPB · exporter 3335 · checked 14 Aug 2026 | SRC |
| line | Send RFQ for this line | Send RFQ for this product | G |

---

## 2. RFQs, quotes, orders

| Screen | Today | v4 | Rule |
| --- | --- | --- | --- |
| rfqs | RFQs (title) / RFQ status (aria) | RFQs / Status | keep |
| rfqs | 5 sent · 4 quotes | 5 RFQs sent · 4 quotes received | N |
| rfqs | All 5 / Drafts 1 / Open 1 / Quoted 2 / Accepted 1 / Closed 1 | All · 5 / Draft · 1 / Waiting · 1 / Quoted · 2 / Accepted · 1 / Cancelled · 1 | G, S-17 |
| rfqs | Open · no quote yet | Waiting for quotes | ST, G |
| rfqs | Quoted · 1 / Quoted · 2 | 1 quote / 2 quotes | N, S-03 |
| rfqs | Quote accepted | Accepted | G |
| rfqs | Closed / Cancelled | Cancelled | G (one word) |
| rfqs | 1–5 of 5 | 5 RFQs | N |
| rfqs | 4,500 pcs / 800 pcs / 100,000 pairs | 4,500 pieces / 800 pieces / 100,000 pairs | N |
| rfqs | 20 Sep 2026 (bare date in row) | Sent 20 Sep 2026 | N (label every number) |
| rfqs | Find suppliers | Find suppliers | keep |
| rfqs | Full page | Open full page | R3 |
| rfq-detail | All RFQs | Back to RFQs | R3, S-12 |
| rfq-detail | Request / Quotes (tabs) | Your request / Quotes · 2 | R1, N |
| rfq-detail | 2 submitted | 2 quotes | G |
| rfq-detail | Created / Updated 20 Sep 2026 | Sent 20 Sep 2026 / Updated 20 Sep 2026 | D |
| rfq-detail | Quantity / Ship by / Target unit price / Ship to | Quantity / Ship by / Target price per piece / Ship to | N |
| rfq-detail | Questions asked | Your questions | R1 |
| rfq-detail | Supplier / Unit price / Lead time / Valid until / Submitted / Action | Supplier / Price per piece / Lead time / Valid until / Received / (no title) | N, G |
| rfq-detail | 5.90 USD / pcs · 6.15 USD / pcs · 6.40 USD | US$5.90 per piece · US$6.15 per piece · US$6.40 per piece | N |
| rfq-detail | 45 days / 60 days (lead time) | 45 days | keep |
| rfq-detail | Price FOB Chattogram. Wash and finishing included; trims at cost. | keep (supplier's words, quoted) | R6 |
| rfq-detail | Accept | Accept quote | R3 |
| rfq-detail | Open message thread | Open messages | R3 |
| rfq-detail | Other RFQs · {title} {status} · {date} | Other RFQs · {title} · {status} · sent {date} | G |
| rfq-detail | Factory, Narayanganj / Factory · Gazipur, Gazipur | Factory · Narayanganj / Factory · Gazipur | W-05 |
| rfq-new, rfq | New RFQ / New RFQ to 2 suppliers · HS 6105 | New RFQ · to 2 suppliers · HS 6105 | N |
| rfq-new | To 2 suppliers · up to 50 / To 1 supplier · up to 50 | To: 2 suppliers (you can add up to 50) | N |
| rfq-new | Add suppliers | Add suppliers | keep |
| rfq-new | What this RFQ carries | What you're asking for | R1 |
| rfq-new | 1 product line · 5 questions | 1 product · 5 questions | G |
| rfq-new | Product title (required) / Quantity (required) / Unit (required) | Product / Quantity / Unit (marked required) | R2 |
| rfq-new | e.g. Men's knitted piqué polo, 220 gsm | keep | keep |
| rfq-new | pcs / pairs / sets / dozens / kg / m | pieces / pairs / sets / dozens / kg / metres | N |
| rfq-new | Currency / Target unit price / Ship by / Ship to / Country | Currency / Target price per piece / Ship by / Ship to / e.g. United Kingdom | N, S-19 |
| rfq-new | Fabric, sizes, colours, packaging, certifications required. (placeholder) | e.g. fabric, sizes, colours, packing, certificates needed | S-19 |
| rfq-new | Questions 5 of 5 asked / Questions 3 of 3 asked | Questions · 5 | N (no form-field counts) |
| rfq-new | Unit price at this quantity, FOB Chattogram | Price per piece at this quantity, FOB Chattogram | N |
| rfq-new | Minimum order quantity per colour / Sample lead time and cost / Payment terms you can offer / Which certificate scope this line ships under | MOQ per colour / Sample lead time and cost / Payment terms you offer / Which certificate covers this product? | R9, R1 |
| rfq-new | Add a question / Add / Remove question: {q} | Add question / Add / Remove question | R3 |
| rfq-new | Message from your template | Message · from your RFQ template | G |
| rfq-new | Dear supplier, / Dear Aboni Knitwear Ltd, | Dear {supplier name}, | keep |
| rfq-new | We read your record on SourceBD and would like a quotation for the line below. | We found you on SourceBD and would like a quote for this product. | G |
| rfq-new | Please answer the questions under the product. Reply inside SourceBD. | Please answer the questions below and reply here on SourceBD. | R2 |
| rfq | Missing from your workspace, so shown in [brackets]: website. | Your website is missing, so it shows as [website]. | R4 |
| rfq | Add in Settings | Add it in Settings | R3 |
| rfq | [product] / [website] | [product] / [website] | keep |
| rfq-new | Still needed: product title, quantity / Still needed: quantity | Add a product and quantity to send | R5 |
| rfq-new | Preview message | Preview message | keep |
| rfq-new | Send RFQ Ctrl ↵ | Send RFQ · Ctrl+Enter | R3 |
| rfq-new | Sends to every supplier listed. Control plus Enter also sends. | Sends to all 2 suppliers. | R4, N |
| rfq-new | Your contact details are not shared; the supplier replies inside SourceBD. | Suppliers reply here. Your email stays private. | R2 |
| rfq-new | Save draft | Save draft | keep |
| rfq-new | To Aboni Knitwear Ltd RFQ · [product] (preview header) | To Aboni Knitwear · RFQ: [product] | keep |
| orders | Orders | Orders | keep |
| orders | 3 active · 4 in all | 4 orders · 3 in progress | N |
| orders | All 4 / Active 3 / Delivered 1 / Cancelled 0 | All · 4 / In progress · 3 / Delivered · 1 / Cancelled · 0 | G |
| orders | Order / Ship by · latest milestone / Value | Order / Ship by · latest update / Value | G |
| orders | Draft / In production / Shipped / Delivered | keep (one order status set) | G |
| orders | 20 Nov 2026 Production started · 22 Sep 2026 | Ship by 20 Nov 2026 · production started 22 Sep 2026 | N, S-03 |
| orders | PO PO-2026-0917 | PO-2026-0917 | W-02 |
| orders | 26,550.00 USD / 84,000.00 USD / 37,200.00 USD | US$26,550 / US$84,000 / US$37,200 | N |
| orders-open | {supplier} · PO PO-2026-0902 | {supplier} · PO-2026-0902 | W-02 |
| order-detail | All orders | Back to orders | R3, S-12 |
| order-detail | Shipped PO PO-2026-0902 · Created 17 Sep 2026 | Shipped · PO-2026-0902 · created 17 Sep 2026 | W-02 |
| order-detail | Shipped Updated 7d ago | Shipped · updated 26 Sep 2026 | D |
| order-detail | Order facts | Order details | R1 |
| order-detail | Commercial 5 / Route 6 / Dates 3 | Price and value / Shipping / Dates | N (no form-field counts) |
| order-detail | Unit price / Total value / PO number / Incoterm | Price per piece / Order value / PO number / Incoterm | N |
| order-detail | 5.90 USD | US$5.90 per piece | N |
| order-detail | Origin port / Destination port / Carrier / Tracking number | From port / To port / Carrier / Tracking number | R1 |
| order-detail | Target ship / Target delivery / Actual ship | Ship by / Deliver by / Shipped on | R1 |
| order-detail | MAEU123456789 · ETA Felixstowe 24 Oct | Due in Felixstowe 24 Oct 2026 · Maersk MAEU123456789 | D |
| order-detail | Milestones / 3 events | Progress · 3 updates | G |
| order-detail | PO issued 2 Sep 2026 / Production started 8 Sep 2026 / Left Chattogram 25 Sep 2026 Shipped | PO sent 2 Sep 2026 / Production started 8 Sep 2026 / Left Chattogram 25 Sep 2026 | R1 |
| order-detail | Log milestone | Add update | R3 |
| order-detail | Edit order / Cancel order | keep | keep |
| order-detail | View RFQ | View RFQ | keep |
| orders-new | Pick a supplier first | Choose a supplier first | R1 |
| orders-new | Open a supplier profile from Discover and use "Create order" — or accept an RFQ quote to seed an order automatically. | Start an order from a supplier's page, or accept a quote. | R2, G |
| orders-new | View RFQs | View RFQs | keep |
| orders-new-form | Back to profile | Back to supplier | G |
| orders-new-form | Shipping / Ship to country / Target ship date / Target delivery date / Optional | Shipping / Ship to / Ship by / Deliver by / Optional | R1 |
| orders-new-form | Create order / Cancel | keep | keep |

---

## 3. Messages, saved, compliance

| Screen | Today | v4 | Rule |
| --- | --- | --- | --- |
| messages | 3 conversations with suppliers | 3 conversations | R2 |
| messages | Find a supplier (search) | Search conversations | R1 |
| messages | Pick a conversation / Choose a supplier on the left to read and reply. | Choose a conversation to read and reply. | R7 |
| messages | {supplier} 5d ago Men's cotton trousers · 5 messages | {supplier} · 26 Sep 2026 · Men's cotton trousers · 5 messages | D |
| messages-thread | Factory Men's cotton trousers (thread header) | RFQ: Men's cotton trousers | G |
| messages-thread | You 10 Sep 2026, 10:02 (date also in day divider) | You · 10:02 | S-22 (date once) |
| messages-thread | Write a message… | Write a message | keep |
| messages-thread | Send / ⌘/Ctrl + Enter to send | Send / Ctrl+Enter to send | keep |
| messages-thread | Back to messages | Back to messages | keep |
| saved | 4 saved suppliers · only you can see this list | 4 saved suppliers · only you see this list | R1 |
| saved | Recently saved / Most evidence / Name (A–Z) / Apply | Recently saved / Most sources / Name A–Z / (no Apply; sorts on choose) | G, R4 |
| saved | Saved on | Saved on | keep |
| saved | 3,166 / 1,240 / 4,820 (bare in phone rows) | 3,166 workers | N, S-03 |
| saved | +2 / +1 | 2 more certificates | N |
| saved | Alerts | Alerts | keep |
| saved | Certificates expiring in the next 30 days | Certificates expiring within 30 days | D |
| saved | WRAP expires 8 Oct 2026 in 6 days | WRAP expires in 6 days · 8 Oct 2026 | D |
| saved | Recent activity / · added to your saved list / · GOTS certification recorded | Recent activity / You saved this supplier / New GOTS certificate found | R1 |
| searches | No saved searches yet / None saved yet · only you can see this list | No saved searches yet | R7 |
| searches | Save a search from the results panel and it appears here, with how many suppliers it finds. | Save a search to run it again in one click. | R4, R7 |
| searches | Search suppliers | Search suppliers | keep |
| searches-new | Save this search | Save this search | keep |
| searches-new | knit · Certificate · GOTS · Sanctioned hidden | knit · GOTS · hiding sanctioned suppliers | G |
| compliance | Compliance hub | Compliance | R1 |
| compliance | Certificate renewals, UFLPA exposure and your Modern Slavery Act statement, drawn from your 16 saved suppliers. | Certificates, forced-labour checks and your modern slavery statement for 16 saved suppliers. | R2, R8 |
| compliance | Built from 16 published saved suppliers, 11 covered by the RSC and 3 certificates expiring in 90 days. | Tiles: 16 saved suppliers · 11 covered by RSC · 3 certificates expire within 90 days | W-03 |
| compliance | Certificate expiry / Next 90 days, soonest first / View all | Certificate expiry / Expired and expiring within 90 days / View all | D, T-02 |
| compliance | Forced-labour exposure / UFLPA tracker / Open tracker | Forced labour: UFLPA checks / Open UFLPA checks | R8 |
| compliance | 1 region flag | 1 possible Xinjiang link | G |
| compliance | Of your 16 saved suppliers that are published, 0 match … 15 are clear. | Tiles: 0 on the UFLPA Entity List · 1 possible Xinjiang link · 15 no link found | W-03 |
| compliance | UK Modern Slavery Act 2015, §54 | UK Modern Slavery Act 2015, section 54 | R1, R8 |
| compliance | Drafts your §54 transparency statement … It is composed in your browser and nothing is uploaded. | Draft your modern slavery statement. Nothing leaves your browser. | R2 |
| compliance | Open generator | Draft statement | R3 |
| compliance-expiry | Renewal dates for your saved suppliers over the next 90 days, soonest first, so your team can follow up before a certificate lapses. | Ask suppliers for renewals before certificates expire. | R2, R5 |
| compliance-expiry | 2 within 30 days / 0 in 30–60 days / 1 in 60–90 days | 2 expire within 30 days / 0 in 30–60 days / 1 in 60–90 days | N |
| compliance-expiry | 1–3 of 3 | 3 certificates | N |
| compliance-expiry | Certificate / Number / Supplier / Expires / Document | Certificate / Number / Supplier / Expires / File | R1 |
| compliance-expiry | 8 Oct 2026 in 11 days / 30 Nov 2026 in 64 days | In 11 days · 8 Oct 2026 / 30 Nov 2026 | D |
| compliance-expiry | GOTS Issued by Control Union | GOTS · issued by Control Union | SRC |
| compliance-expiry | No document / Open document | No file / Open certificate | ST, R3 |
| compliance-expiry | Gazipur, Gazipur | Gazipur | W-05 |
| compliance-uflpa | UFLPA tracker | UFLPA checks | R1 |
| compliance-uflpa | Checks your saved suppliers against the U.S. Department of Homeland Security's UFLPA Entity List. A supplier is a hit when … | Saved suppliers checked against the UFLPA Entity List (US DHS). Legend: three terms below. | R2, W-03 |
| compliance-uflpa | hit / match | On the UFLPA Entity List | G, S-17 |
| compliance-uflpa | region flag / Xinjiang-linked text | Possible Xinjiang link: the record mentions Xinjiang, XUAR or Uyghur | G, S-17 |
| compliance-uflpa | clear | No link found | G, truth |
| compliance-uflpa | 0 hits · 1 region flag · 15 clear | 0 on the Entity List · 1 possible Xinjiang link · 15 no link found | G |
| compliance-uflpa | No saved suppliers yet / Every supplier you save is checked against the UFLPA Entity List and listed here. | No saved suppliers yet. Save suppliers to check them here. | R7 |
| compliance-uflpa, orders-new | Browse Discover | Search suppliers | G, R3 |
| compliance-msa | Modern Slavery Act statement / Modern slavery statement | Modern slavery statement | G (one name) |
| compliance-msa | Composes a draft UK Modern Slavery Act 2015 §54 transparency statement … Review it with counsel before publishing. | Draft your statement from saved suppliers. Have it reviewed before you publish. | R2 |
| compliance-msa | This is a starting draft only. The UK Home Office guidance … requires board approval and a signed PDF on your homepage. … | A first draft only. Your board approves it and a director signs it. | R2, R8 |
| compliance-msa | Draft your statement | Draft your statement | keep |
| compliance-msa | Organisation name / Reporting financial year / Signatory name / Signatory role | Organisation name / Financial year / Signed by / Their role | R1 |
| compliance-msa | e.g. Example Apparel Ltd / e.g. Jane Smith / Director | keep / keep / e.g. Director | S-19 |
| compliance-msa | Your supplier footprint / From your 16 published saved suppliers | Your suppliers / From your 16 saved suppliers | G (drop "published") |
| compliance-msa | Saved suppliers / Published / Countries / Bangladesh · 16 | Saved suppliers / (delete) / Countries / Bangladesh · 16 suppliers | G, N |
| compliance-msa | Covered by the RSC / Certifications / Certificates expiring in 90 days | Covered by RSC / Certificates / Certificates expiring within 90 days | G |
| compliance-msa | EPB · 14 BGMEA · 12 RSC · 11 BKMEA · 6 | Found on: EPB 14 · BGMEA 12 · RSC 11 · BKMEA 6 suppliers | N |
| compliance-msa | Preview / Markdown, updates as you type | Preview · updates as you type | R4 |
| compliance-msa | Composed in your browser. Nothing is uploaded. | Nothing leaves your browser. | R2 |
| compliance-msa | Copy to clipboard / Download .md | Copy text / Download draft | R3, R1 |
| compliance-msa | Statement body ("facility(ies)", "certification(s)", "**0**") | Proper plurals; never "(s)"; body wording follows the T-01 fix (PR #226) | N |

---

## 4. Products and settings

| Screen | Today | v4 | Rule |
| --- | --- | --- | --- |
| products | Products / 4 products · only you can see them | Products / 4 products · only you see these | R1 |
| products | Add product | Add product | keep |
| products | Active 2 / Draft 1 / Archived 1 | Active · 2 / Draft · 1 / Archived · 1 | N |
| products | Product / Category / Price / Status | Product / Category / Target price / Status | N |
| products | 1.10 USD / 4.20 USD / 8.90 USD | US$1.10 per piece | N, S-03 |
| products | NW-701 (bare code) | Style NW-701 | N |
| products | Edit / Archive / Restore / Delete / More actions for {product} | keep | keep |
| product-new | Create a product / How do you want to start? / Next | keep | keep |
| product-new | Start manually Enter the name, price, size chart and BOM yourself. Only the name is required. | Start from scratch. Only the name is required. | R2 |
| product-new | Drafting a product from a description arrives with V2. | Coming later: draft a product from a description. | W-01 (no "V2") |
| product-new | Only you can see your products. | keep | keep |
| product-form | Only the name is required. Add the rest now or later. | keep | keep |
| product-form | Still needed: a name | Add a name to save | R5 |
| product-form | Basic / Classification / Media / Production / Variants / Tech pack | Basics / Category / Images / Production / Options / Tech pack | R1 |
| product-form | Name (required) | Name (required) | keep |
| product-form | What you call it. An RFQ sent from this product starts with this name. | Your name for it. RFQs from this product use it. | R2 |
| product-form | Product number / Your own style or article number. | Style number / Your own style or article number. | G |
| product-form | Customer product number / Your customer's reference, if they gave one. | keep | keep |
| product-form | Price (USD) / Your target price per piece, in US dollars. | Target price (US$) / Per piece. | N |
| product-form | Minimum order quantity, in pieces. | MOQ, in pieces | R9 |
| product-form | Main material / The composition as it goes on the care label. | keep | keep |
| product-form | Fit, fabric feel, wash, trims — whatever a factory needs to quote it. | keep | keep |
| product-form | Choose a category / Tags / Press Enter or a comma after each tag. | keep | keep |
| product-form | Add images / JPG, PNG, WebP or GIF, up to 10 MB each. / The first image is the one your product list shows. | Add images / JPG, PNG, WebP or GIF, up to 10 MB each / The first image shows in your list | R2 |
| product-form | Size chart (POM) / Points of measure, in the unit your spec uses. | Size chart / Points of measure, in your spec's unit | R1 |
| product-form | Base / Base measurement / Tol + / Tol − / Tolerance plus / Tolerance minus | Base size / Base measurement / Tolerance + / Tolerance − | R1 |
| product-form | Add measurement / Add material / Add option / Remove | keep | keep |
| product-form | Bill of materials: every fabric and trim that goes into one piece. | keep | keep |
| product-form | Part / Material / Colour / Code / Qty / Notes | Part / Material / Colour / Code / Quantity / Notes | R1 |
| product-form | Body fabric / Single jersey, 180 gsm / Navy / 1.2 m / Enzyme wash / Chest, 2 cm below armhole (placeholders, read as data) | e.g. Body fabric / e.g. Single jersey, 180 gsm / e.g. Navy … | S-19 |
| product-form | Options and their values; every combination is listed below. / Add an option and its values to see every combination. | Add options such as colour and size. We list every combination. | R2 |
| product-edit | 6 combinations / Every combination | 6 combinations / All combinations | keep |
| product-form | Upload tech pack / A PDF or an image, up to 10 MB. | keep | keep |
| product-form | Save draft / Submit | Save draft / Make active | R3 |
| product-edit | Save draft keeps it a draft; Submit makes it active. Only you can see your products. | Only you can see your products. | R4 |
| settings* | Settings / Signed in as rez@example.invalid · Free plan · public beta | Settings / rez@example.invalid · Free plan (beta) | R2 |
| settings* | Profile / Workspace / Members / Inquiry / Notifications / Subscription (tabs) | Profile / Company / Team / RFQ template / Emails / Plan | G, S-17 |
| settings | Company info / Company name / Website / Business description | Company / Company name / Website / What you sell | R1 |
| settings | Your company name and website sign the RFQs you send | Suppliers see your company name and website on every RFQ. | R5 |
| settings | What you make or sell, in a sentence or two | keep | keep |
| settings | Customer base / Who buys from you, for example UK high-street retail | Who you sell to / e.g. UK high-street retail | S-19 |
| settings | Brand / Retailer / Importer / Agent / Other / retailer (lowercase value) | Brand / Retailer / Importer / Agent / Other (one capitalisation) | S-16 |
| settings | Employees · 1-10 / 11-50 / 51-200 / 201-1000 | Employees · 1–10 / 11–50 / 51–200 / 201–1,000 | N |
| settings | Not set | Not added | ST |
| settings | Save company info | Save changes | R3 |
| settings-inquiry | Email template / Question template | RFQ message / RFQ questions | G |
| settings-inquiry | The message a new RFQ opens with. You can still edit it on each RFQ. | keep | keep |
| settings-inquiry | Variables / {{supplier}} {{product}} {{company}} {{user}} {{website}} | Fill-ins: Supplier name · Product · Your company · Your name · Your website | S-16, W-01 |
| settings-inquiry | the supplier's name / the product line: title, quantity, target price and ship date / your company name, from Workspace / your display name, from Profile / your website, from Workspace | Supplier name / Product, quantity, price and ship date / From Company / From Profile / From Company | R2 |
| settings-inquiry | Dear {{supplier}}, | Dear [Supplier name], | S-16 |
| settings-inquiry | A fact you have not filled in shows in brackets on the RFQ, so you see the gap before the supplier does. | Anything missing shows in [brackets], so you can fill it first. | R2 |
| settings-inquiry | The questions every new RFQ asks, in this order. Up to 20. | Questions every new RFQ asks, in this order. Up to 20. | keep |
| settings-inquiry | Question 1 / Move question 1 up / Remove question 1 / Add question | keep | keep |
| settings-inquiry | Save questions / Save template | Save questions / Save message | R3 |
| settings-members | Team seats / 1 member / Owner / Role / Email | Team / 1 person / Owner / Role / Email | N |
| settings-members | Seats for colleagues arrive with the Enterprise plan, with a role for each. To bring your team onto SourceBD before then, contact support. | Team seats come with the Enterprise plan. Contact support to add colleagues now. | R2 |
| settings-members | Contact support | Contact support | keep |
| settings-notifications | Email preferences | Emails | R1 |
| settings-notifications | Choose which emails you receive. Sending starts in a later release; what you set here is recorded now, … | Choose your emails. Sending starts later in the beta; your choices are saved now. | R2, W-03 |
| settings-notifications | Changes save automatically | Saved automatically | keep |
| settings-notifications | RFQ replies · Email when a targeted supplier submits or revises a quote on one of your RFQs. | Quotes · Email me when a supplier sends or changes a quote. | R1, G |
| settings-notifications | Saved-supplier alerts · Cert expiry warnings, RSC remediation updates, and sanctions changes on suppliers you've saved. | Saved suppliers · Certificate expiry, RSC safety updates and sanctions changes. | R2, G |
| settings-notifications | Weekly digest · Monday summary of new suppliers, cert updates, and sanctions changes across the corpus. | Weekly summary · Every Monday: new suppliers, certificate and sanctions changes. | S-16 |
| settings-profile | Display name / Shown in the sidebar, top bar, and your activity / How you appear in messages and order activity | Your name / Suppliers see it in messages and orders. | S-16, R5 |
| settings-profile | e.g. Jane Doe / Up to 120 characters | keep | keep |
| settings-profile | Profile picture / PNG, JPEG, WebP, or GIF · up to 5 MB. / Upload picture | keep | keep |
| settings-profile | Email / Current: rez@example.invalid / New email / you@example.com | keep / keep / New email / e.g. you@company.com | S-19 |
| settings-profile | We'll send a confirmation link to the new address. Your email won't change until you click it. | We'll email a link to the new address. Click it to confirm. | R2 |
| settings-profile | Send confirmation | Send link | R3 |
| settings-profile | Password / New password / Confirm new password / Minimum 8 characters / Update password | keep / keep / keep / At least 8 characters / keep | R1 |
| settings-profile | Session / End your session on this device | Sign out / Sign out of this device | R1 |
| settings-subscription | Your plan / Free Current public beta | Your plan / Free · current plan · beta | R2 |
| settings-subscription | Billing / Not set up yet / Opens once billing is set up / Self-service plan changes, payment methods and invoices open here once billing is set up. … | Billing isn't set up yet. Contact support to change plan. | R2, ST |
| settings-subscription | Manage plan (disabled, same fill as enabled) | (hide until billing exists) | S-05 |
| settings-subscription | View pricing / Other plans / Growth / Enterprise | keep | keep |
| settings-subscription | Available after the public beta | After the beta | R2 |
| settings-subscription | Discover up to 50 suppliers per month / Unlimited Discover | Search up to 50 suppliers a month / Unlimited search | G |
| settings-subscription | Saved-supplier dashboard / RFQs + order tracking / Compliance (UFLPA + MSA) | Saved suppliers / RFQs and order tracking / Compliance: UFLPA checks and modern slavery statement | R1 |
| settings-subscription | Everything in Growth / Find-matches wizard / Team seats + role-based access / API access + bulk export / Dedicated compliance review | Everything in Growth / Supplier matching / Team seats with roles / API access and bulk download / Dedicated compliance review | R1 |

---

## 5. Shell and navigation (all 39 screens)

| Screen | Today | v4 | Rule |
| --- | --- | --- | --- |
| shell | SB SourceBD / SourceBD home (aria) | SourceBD | keep |
| shell | Search / Saved / Saved searches / RFQs / Orders / Messages / Products / HS headings / Compliance hub / Settings (nav) | Search / Saved / Saved searches / RFQs / Orders / Messages / Products / HS codes / Compliance / Settings | G |
| shell | Suppliers 10,266 / 10,266 published suppliers | 10,266 suppliers | G (drop "published"), S-14 |
| shell | Saved 16 / RFQs 5 (badges) | Saved · 16 / RFQs · 5 (aria: "16 saved suppliers", "5 RFQs") | N, S-14 |
| shell | Rezaul Karim · Free plan · Beta / Free plan · public beta | Rezaul Karim · Free plan (beta) | G (one wording) |
| shell | Account, {name}, Free plan · Beta (aria) | Account: {name} | R2 |
| shell | Sign out / Subscription / Settings (account menu) | Sign out / Plan / Settings | G |
| shell | Collapse sidebar / Expand sidebar | keep | keep |
| shell | Ctrl K / Control K / Suggestions / More / Done | keep | keep |
| shell | Skip to content, {screen} / Primary, {screen} / Sidebar, {screen} / Tab bar, {screen} (aria) | Skip to content / Main menu / Menu / Tabs | R2 |
| shell | Next page / Previous page / Pagination / Rows per page / Close | keep | keep |

Row count: 20 gate rows plus 401 inventory rows in 5 sections (data shapes are one pattern row each).
