---
target: SourceBD phone screens in Paper
total_score: 15
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 25
target_identity: "file:E:\\SourceBD\\.impeccable\\preview\\paper-import\\out-m"
timestamp: 2026-10-02T19-34-39Z
slug: impeccable-preview-paper-import-out-m
---
Method: dual-agent (A: four design reviewers, one per section, in parallel · B: separate detector and measurement pass)

# SourceBD phone screens (Paper file "SourceBD", page "Phone", 39 artboards at 390px)

Verdict: the desktop app poured into 390px, not a phone design. 675 of 1,102 controls under 44px; desktop tables lose their headings and become bare numbers; the supplier record runs ~6 screens. Receipts and compliance, the product's differentiators, fail hardest: register logos at 14px, "Source pending" on 6 of the first 8 facts under a footer claiming every fact is traced, and the Modern Slavery statement generator asserts claims the buyer never made. Strengths: one filled green button per screen max (18 screens, never two), all 138 text fields at 16px, all text passes contrast except 8 disabled labels, honest locked/missing states.

## Design health score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Good "Still needed" footer; no unread/read in messages; search box doesn't show the query; cert expiry clipped in results |
| 2 | Match system / real world | 2 | Trade words fit; bare HS numbers, hash IDs, "(V2)", "Every filter is a URL", "corpus", {{supplier}} |
| 3 | User control and freedom | 2 | Record from a thread replaces the thread, back says "Results"; Save this search has no exit |
| 4 | Consistency and standards | 1 | Five back patterns; Closed vs Cancelled; pane vs full page reverse section order |
| 5 | Error prevention | 1 | MSA statement asserts policies/Board approval; "[website]" sendable; Accept looks like a chip; Cancel order on shipped order |
| 6 | Recognition rather than recall | 1 | Unlabelled numbers in every list |
| 7 | Flexibility and efficiency | 1 | No whole-row taps, no quote comparison, Page 1 of 186, no attachments |
| 8 | Aesthetic and minimalist design | 2 | Calm palette; 10.5-screen results, 6-screen record repeating facts, RFQ message twice |
| 9 | Error recovery | 1 | "The buildings could not be read." no reason/retry; no form error states drawn |
| 10 | Help and documentation | 2 | Good field hints; nothing explains HS codes, registers, or the Source pending icon |
| **Total** | | **15/40** | **Poor** |

## Design specificity
Record, certificate rows and source marks are SourceBD-specific; RFQs/Orders/Messages/Settings/Products are generic CRUD. Source logos render at 14px in 20px tiles, unreadable even at 2x, so the brand's proof disappears on phone.
Detector: >1,000 flags over five scans, nearly all conversion/desktop-CSS noise. Real: 7-10px text (brand-list marks 8px, HS code 9px, header 10px), nested cards on both results views, issuer names overflowing boxes (TÜV Rheinland 16px over; OEKO-TEX in 12px box), disabled buttons 2.2:1 (exempt). Live overlay ran on 5 screens (7 issues, all covered); servers stopped.

## Priority issues
1. [P0] MSA statement generator hard-codes unbracketed claims (policy suite, staff training, compliance team, "other denied-party lists", Board approval), says "zero active hits" while a Xinjiang region flag exists, and "all certifications remain current" while ignoring expired ones. components/msa-generator-form.tsx 194-269. Fix: [Confirm: ...] brackets that block export; disclose region flags; count expired; name only lists actually screened. /impeccable harden + code fix.
2. [P0] Expired certificates drop off the Compliance hub expiry watch (no Expired bucket; RPC never returns expired, components/dashboard/compliance.tsx:103). Fix: Expired bucket pinned first in danger colour. /impeccable harden.
3. [P1] Desktop reflow: 61% of controls <44px (four screens with none >=44); headings lost -> unlabelled numbers (RFQs "1","3"; Saved "3,166"; Products "4.20 USD 3,000"; Orders three bare dates; quotes "3,000 / 30 Oct / 45 days"; HS headings counts); "Page 1 of 186"; 91 phone-screens total, cards 10.5; global search bar on every screen with placeholder cut at "certificat", not showing the query. /impeccable adapt.
4. [P1] Supplier record: ~6 screens; Certificates at 2.6, Safety 3.2, Sources 3.6 screens; tabs clipped at "Safe…", Sources not a tab; 6/8 first facts "Source pending" icon-only, legend 1,200px later, footer claims every fact traced; RSC labelled "Government register"; hash IDs as evidence; facts repeated; Facilities "could not be read" vs Safety's building record; 100% green remediation bar reads as a score; sanctioned supplier never drawn at 390px. /impeccable distill then clarify.
5. [P1] Phone jobs broken: thread not a chat (all left-aligned, buyer gets bubble, supplier none; composer not pinned, 1.3 screens down, no attach; name cut to "Aboni ..."; record replaces thread, back says "Results", green Send RFQ invites duplicate); quotes start at 800px, values unlabelled, MOQ 5,000 vs 4,500 unflagged, Accept 61x28 grey like the "Submitted" chip; alerts have no action, flagged supplier unnamed, Compliance/Orders/Saved searches/Settings under More; tab bar covers main button centre on 3 screens (full record Send RFQ+Save, new product Save draft+Submit, thread Send), Send RFQ directly above RFQs tab with same icon. /impeccable adapt then harden.

## Section findings (P1 unless marked)
Search: cert chip clipped 16/25 rows ("GOTS 55", "WRAP Go"); cards 371px, 15+ targets, stock "illustration" photos; Filters "1 set" with Sanctioned hidden uncontrollable; [P2] landing two search boxes, six filter entry points, wrapped titles; [P2] product line stock photo + "(V2)", Send RFQ inline 1.4 screens; [P2] composer message twice, [website] sendable, checkbox + x per question; [P2] "Every filter is a URL" footer, Apply 105x32 no count; [P2] full record 278px of stacked bars.
Saved/RFQs/Orders: Saved list at 610px under alerts, saved icon reads unsaved, record from Saved says Save/back Results; RFQ status vocabulary mismatch, All excludes drafts, rows not tappable; Order open Cancel order on shipped order 8px from Edit, ETA buried, tracking not a link, no message; New order dead end ("Discover", no Create order on record); order form submit 108x32 at 1.6 screens, unit/currency free text vs RFQ dropdowns; [P2] pane + full page duplicates, order full page reversed; [P2] Save this search full page, no exit, raw filter name; [P2] "PO PO-", "84,000.00 USD", duplicate date.
Messages/Products: list has no preview/unread/replied state, half empty, "Find a supplier"; Products 12 sub-44 buttons for 4 rows, row not tappable, Send RFQ on Draft/Archived; one-option chooser + "arrives with V2"; product form all 8 sections open, 640px tables in 326px, green Submit beside "Still needed", no HS code field; edit has Save draft on live product, no Save changes/Discard, Send RFQ in header; HS headings second search box, unlabelled counts, 144x18 tap target.
Compliance/Settings: hub urgency by colour+weight only, forced-labour as a sentence, Open generator orphaned at 817px; expiry page no action, cert number outranks deadline, back under title; MSA raw-markdown box scrolling inside page, Download .md at 1,184px, "facility(ies)", org name not prefilled; Settings no green/sticky Save, Workspace Save at 904px, Profile five grey buttons, tabs on two rows; password change without current password; "Inquiry" tab holds RFQ templates, clipped question fields, typed {{supplier}}; Notifications not sending, sanctions bundled; [P2] Subscription enabled/disabled same grey, ticks on unowned features, no usage meter; [P2] UFLPA populated list never drawn, 100px definitions first.
Everywhere: five back patterns; [P2] 11 text sizes, system 12/18 unused, 16/17/24 off-scale, 22px semibold titles, 11px tab labels; [P2] internal words leak; [P2] 25 black initial squares dominate results.

## Probably sample-data seams (verify on production)
WRAP 8 Oct "in 6 days" (Saved) / "in 11 days" (hub) / "Expired 29 Sep" (record); 4 vs 16 saved suppliers; UFLPA counts above "No saved suppliers yet"; RFQ "Quoted · 2" vs "Open"; "3 from your account" above "not sent an RFQ yet" (caption and empty text drawn independently, so a clash is possible if data disagrees); Aboni workers 3,314 vs 3,166 (could be real, different fields).

## Persona red flags
Thumb-only buyer: two cut-off search boxes; 10 screens of cards; 28x28 Save beside Send RFQ; RFQs tab under Send RFQ; conversation lost when opening the record.
Low-vision/screen-reader: 675 sub-44 controls, 16px remove buttons without enlarged hit area, urgency by colour, Source pending icon-only, 11px tab labels (contrast passes).
UK compliance lead: Compliance under More; expired certs absent; flagged supplier unnamed; statement claims Board-approved policies and zero hits; .md export; RSC "government register"; publishes a false statutory statement.
Sourcing manager in Dhaka: bare "3" on RFQs; quotes below own request; unlabelled quote values; Accept looks like a label; New order sends to nonexistent "Discover".

## Minor observations
Mixed time formats; "Find suppliers" vs "Find a supplier"; initials R vs RE; "Gazipur, Gazipur"; RSC building list as location; "results panel" copy on phone.

## Questions to consider
Who is the phone for (PRODUCT.md says "at a desk")? Tabs as Messages, Quotes, Alerts, Saved, Search? A one-screen record that still proves every fact? Units on every number? Does the card view earn its place on phone? Statement export only when every claim is sourced or confirmed?
