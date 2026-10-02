# UI issue register: buyer app, phone and desktop (Oct 2026)

**Sources.**
- Phone critique of the 39 phone screens, 2 Oct, scored 15/40.
- Desktop critique of the 39 desktop screens, 3 Oct.
- Both read the Paper file "SourceBD" (`01M3XEFXNJ7V1M9YVMP4W8990J`), pages
  "Phone" and "Desktop". Each used four section reviewers plus a separate
  measurement and detector pass.
- Snapshots are in `.impeccable/critique/`.
- Claims marked **code** were checked in the repository on 3 Oct.

**The screens are drawn from sample data dated on different days.**
Contradictions that only come from that are listed in section X, not
scored. Several measured figures from the screens are not live facts either
(for example "6 of 8 facts Source pending"). They show what the design does
in that state.

**Key.**
- Surface: **D** = desktop 1440×900, **P** = phone 390×844.
- Severity:
  - **P0**: blocks the task or breaks a promise with legal weight.
  - **P1**: major.
  - **P2**: annoyance.
  - **P3**: polish.
- Owner (where it gets fixed; phases are in `handoff-ds-v4-paper-first.md`):
  - **Now**: a small code fix outside the redesign.
  - **DS**: the design system.
  - **Screens**: Paper redesign of the app.
  - **Onb**: onboarding.
  - **Mkt**: marketing.
  - **Founder**: a decision.

---

## Fix now (code, outside the redesign; one small PR each)

| ID | What | Where |
| --- | --- | --- |
| T-01 | The Modern Slavery statement asserts policies, training, a compliance team, "other denied-party lists" and Board approval the buyer never declared. It says "zero active hits" despite a region flag, and "all certifications remain current" while expired ones are never counted | **code** `components/msa-generator-form.tsx` 189-270. **Running** as its own session since 3 Oct |
| T-02 | Expired certificates never appear in the expiry watch | **code** `components/dashboard/compliance.tsx:103` ("The RPC never returns an expired one"). **Running** since 3 Oct |
| T-03 | RSC (the RMG Sustainability Council, an industry-led programme) is labelled "Government register" | **code** `lib/dashboard/source-tiers.ts:35` ranks RSC tier 1, and `tierWords(1)` prints "Government register". Fix the words now; the rank is a founder call |
| T-04 | The record footer says "Every fact traces to the issuing authority shown in Sources" above facts marked "Source pending" | Copy. Say what is true until each fact shows its source |
| RQ-07 | An RFQ can be sent with literal "[website]" or "[product]" in the message to the supplier | Block Send while any bracket remains, and list them under "Still needed" |
| OR-02 | "Cancel order" is offered on a shipped order, styled like a dismiss link, with no confirmation | Hide it after shipping. Otherwise use danger style plus a confirmation that names the PO |
| PR-02 | Send RFQ is offered on Draft and Archived products | Hide it, or show "Activate to send" |
| ST-03 | Changing the password does not ask for the current one | Require re-authentication |
| T-09 | Roadmap words reach buyers: "(V2)", "arrives with V2" | Copy |
| RC-09 | **The address appears twice on the supplier record, and in registry spellings.** Founder, 3 Oct: *"we don't need that, we must not confuse the user and keep clean"* | **code** `lib/dashboard/build-models.ts:1253` (Overview "Factory address", in the register's own ALL-CAPS text), `components/dashboard/sheet.tsx:798-804` ("Also recorded as: …"), `components/dashboard/supplier-sheet.tsx:424` ("· registry spellings merged"). Show each premises **once**, under Locations: one clean address in normal capitals, its kind (Factory, Registered office) and its source mark. Overview shows only the district ("Savar, Dhaka"). Remove "Also recorded as" and "registry spellings merged" from buyer surfaces. The address matcher (`lib/dedup-addresses.ts`) stays, because it is what merges duplicate premises. Tests that assert the pill (`components/dashboard/record-sheet.test.ts:334`, the `lib/locations-section-render.test.ts` boundary block) flip to assert its absence on the buyer record |
| A-01 | Result rows remove the keyboard focus outline. Focus shows only as a background change from white to `#EEEEEC` (1.16:1), so a keyboard user loses their place in the results | **code** `components/dashboard/results-table.tsx:232` (`outline-none focus-visible:bg-surface-sunken`). Restore the focus ring |

---

## T: Truth and trust (product-level)

| ID | Sev | Surf | Problem | Evidence | Fix direction | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | P0 | D+P | Statement generator writes unconfirmed legal claims | Section above. On desktop the generator is four inputs producing six statutory sections, with nothing editable | `[Confirm: …]` on every unconfirmed claim, export blocked until all are resolved. Editor per section; versions; approver | Now + Screens |
| T-02 | P0 | D+P | Expired certificates drop out of the watch | Section above | An "Expired" group first, in danger style | Now + Screens |
| T-03 | P1 | D+P | RSC called a government register | Section above | Correct wording; decide the tier | Now + Founder |
| T-04 | P1 | D+P | Sourcing promise vs icon-only "Source pending" | Sample record: 6 of 8 Overview facts carry only a 16px icon; the legend is about 1,200px later (phone) | Source in words on each fact; a labelled "Not yet sourced" group | Now (copy) + DS + Screens |
| T-05 | P2 | D+P | Internal IDs shown as evidence | Sources rows: "b376ef6e0404ae78", "aae431e7c9e0b1c9", "619:detail", "general:3498" | The list name and date read, linked out | Screens |
| T-06 | P2 | D+P | The remediation bar looks like a score | Full-width green bar at 100%, shown twice on the record | The figure as text: "RSC: 100% of items closed · read 30 Jul" | DS |
| T-07 | P1 | D+P | Stock garment photos beside real suppliers | Six 48px photos per card plus a 200px photo on the product line. The only label is a 13px "illustration" and "Not the supplier's own product… (V2)" | Remove them. Show the HS heading as text | Screens |
| T-08 | P1 | D+P | Numbers disagree on one screen | Sources "8" vs 11 marks vs "11 sources". Two unlabelled worker figures per cell ("1,300 / 3,546 with buildings", "with" vs "in"). List 3,314 vs record 3,166 | One definition per number, labelled, with its source. Check the field mapping on live | Screens + Founder |
| T-09 | P2 | D+P | Roadmap leaks | "(V2)", "arrives with V2", "supplier-attested fields, shown when attested" | Plain words about what exists | Now |
| T-10 | P1 | D+P | Sanctioned supplier never drawn | No screen on either page; text search finds only a "Sanctioned hidden" chip and notification copy | A sample-state artboard of the banner on list, record, RFQ and message, plus refused Send RFQ | Screens |

---

## S: Systemic (the design system must solve these once)

| ID | Sev | Surf | Problem | Evidence |
| --- | --- | --- | --- | --- |
| S-01 | P1 | D+P | Source marks unreadable, so the product's signature disappears | 14px glyph in a 20px tile (P). 18px logos (D). Brand-list marks at 8-9.5px. BGAPMEA's wordmark is about 3px tall |
| S-02 | P1 | D+P | Desktop control sizes everywhere | P: 675 of 1,102 controls under 44px tall. Four screens have nothing at 44px. 16×16 remove buttons; 19×28 move and remove buttons 6px apart. D: see Measurements |
| S-03 | P1 | D+P | Tables lose their headings, so numbers are bare | P: RFQs "1", "3"; Saved "3,166"; Products "4.20 USD 3,000"; three unlabelled dates per order row; quotes "3,000 / 30 Oct / 45 days"; HS counts. D: "Quoted · 2", "Saved 16" |
| S-04 | P2 | D+P | Type ramp ignored | P: 11 distinct sizes, the system's 12 and 18 never used, 16/17/24 off-scale, tab labels 11px (150 nodes). D: 9.5, 10, 11, 15, 16, 17, 28px; page titles 14, 18 and 22 for one role; section heads larger than their page titles |
| S-05 | P1 | D+P | One grey for every kind of button | `#EEEEEC` on white is 1.16:1. Primary saves, secondary, Sign out, destructive and disabled all look alike. Enabled "View pricing" and disabled "Manage plan" share a fill |
| S-06 | P2 | D | Four different "selected" treatments | Sidebar tint plus bar; conversation tint only (1.16:1); status filter bottom bar; record tabs underline |
| S-07 | P1 | D+P | Colour semantics broken | Amber for both "expires in 72 days" and "expired 5 years ago". Urgency told by hue (urgent vs calm ink 1.15:1 to 1.81:1 luminance). Two greens (brand `#1B5E20` and positive `#0B7A5C`) read as one. Green spent on illustrations and a status dot |
| S-08 | P2 | D+P | Links don't look like links | Supplier names are links in one place and plain text in another, styled the same (14/500, no underline) |
| S-09 | P1 | P | The tab bar covers main actions | Button centre under the tab bar on: full record (Send RFQ, Save), new product (Save draft, Submit), thread (Send). Send RFQ sits above the RFQs tab with the same paper-plane icon |
| S-10 | P2 | D | Line length uncontrolled | Prose at 111, 132, 141, 147, 151, 152 characters per line. Messages about 115. Mono preview about 93 |
| S-11 | P1 | D | Splits and widths don't fit the content | Fixed 50/50 list and pane. Wide tables squeezed (1,041 in 572; quotes 800 in 563, scrolling sideways with the sticky Accept hiding names and "valid until"). Dead canvas of 264-470px. Field widths from 288 to 928px |
| S-12 | P2 | D+P | Back and close differ everywhere | P: five patterns. D: back links at top right; "All RFQs" a link but "All orders" a button; Save this search has no exit |
| S-13 | P2 | D+P | Search in two places | Two Ctrl K boxes on the desktop landing. The phone's placeholder is cut ("…certificat") on every screen. The search box doesn't show the current query on results |
| S-14 | P3 | D | Chrome repeated | Two account menus. "10,266" twice. Count badges that don't say what they count |
| S-15 | P2 | D+P | Monogram tiles are the loudest thing | 25 near-black 40×40 initial squares down the results list |
| S-16 | P2 | D+P | Internal words reach buyers | "Every filter is a URL", "Sanctioned hidden", "corpus", `{{supplier}}`, "results panel", "Discover" (the nav says Search), "Shown in the sidebar", "retailer", "0 d", "Its state", "What it holds" |
| S-17 | P1 | D+P | Vocabulary drift | Inquiry vs RFQ. Match vs hit. "Xinjiang-linked text" vs "region flag". Closed vs Cancelled. Accepted vs Quote accepted. One RFQ in three status vocabularies (list, pane, "Other RFQs") |
| S-18 | P1 | D+P | States missing | No sanctioned state (T-10); no error, loading or offline; no form validation drawn. Empty states apologise instead of selling. "The buildings could not be read." with no cause or retry |
| S-19 | P1 | D+P | Placeholders look like data | Filters "6105 / 1990 / 2026" at full size. Size-chart and BOM example rows in grey with no "e.g.". The BOM note "Enzyme wash" reads as saved |
| S-20 | P1 | D+P | The fold is ignored | P: 91 phone screens of scrolling across 39 screens; cards 10.5 screens for 25 suppliers; record about 6. D: Apply about 300px below the fold; MSA download at y 910; "Send RFQ for this line" below the fold; certificates at y 1,647 (pane) and 1,240 (page) |
| S-21 | P1 | D | No power-user tools | One sortable column in the whole app. No in-list search, bulk select and action bar, column chooser or export. Keyboard support is only Ctrl K and Ctrl Enter |
| S-22 | P3 | D+P | Dates in mixed formats | "5d ago", "12 Aug 2026", "Updated 7d ago". Dates are printed twice per message |
| S-23 | P2 | D+P | Accessibility | The structure is clean (see Measurements). Faults: result rows hide the focus ring (A-01); 364 click targets under 24px on desktop, 15 failing WCAG 2.5.8 (the stacked ASOS/H&M/NEXT marks); 12×12 "remove filter" ×; filters page has no h1; New RFQ has no headings at all; two h1s on two pages |
| S-24 | P2 | D | Two type scales | `DESIGN.md` says body 14 / label 13 / caption 12. The app shell uses `appFontSize` in `lib/design/tokens.ts:251` (body 15 / label 14 / caption 13 / eyebrow 12). Nobody can say which is the system. v4 ships one scale |

---

## W: Words and numbers (founder, 3 Oct: "wordy and text heavy with confusing numbers and dev-jargon-like sentences; humanise it, research and talk in the users' language")

The buyers are sourcing, merchandising and ethical-trade or compliance people
at UK, EU, US and Canadian clothing brands. The secondary readers are
Bangladeshi supplier staff, for whom English is a second language. Today the
product often speaks like its database. Every example below is real screen
text.

| ID | Sev | Problem | Examples on screen today | Direction |
| --- | --- | --- | --- | --- |
| W-01 | P1 | System narration and developer words | "Every filter is a URL: the results update when you apply, and each chip removes one." · "registry spellings merged" · "Also recorded as" · "as filed" · "supplier-attested fields, shown when attested" · "Not attested" · "Sanctioned hidden" · "corpus" · "published" · "`{{supplier}}`" · "results panel" · "Shown in the sidebar" · "Its state" · "What it holds" · "Who lists it" · "Who filed it" · "The buildings could not be read." · "(V2)" | Say what the buyer gets or must do. "Sanctioned suppliers are hidden. Show them" instead of "Sanctioned hidden" |
| W-02 | P1 | Numbers with no meaning attached | Bare "1", "3", "8" in rows · "+6", "+7 lines" · "9 registers & certifiers · 3 brand lists" vs "11 sources" vs "11 of 14 registers read" · two worker figures ("1,300 / 3,546 with buildings") · "Quoted · 2" · "3 from your account" · "GOTS 72 d" · "0 d" · "Commercial 5 / Route 6 / Dates 3" · "84,000.00 USD" · "PO PO-2026-0917" · "facility(ies)" · "1–5 of 5" · "Page 1 of 186" | Every number carries its noun ("3 suppliers", "MOQ 3,000 pcs", "expires in 5 days"). One count per idea. Round where precision doesn't help. No counts of form fields |
| W-03 | P1 | Paragraphs where a label would do | UFLPA page: 5 lines of definitions before any result. Compliance hub: one 141-character sentence carrying three numbers. MSA intro: 148 characters per line. Notifications: a 4-line disclaimer above the settings. Product line: a 3-line disclaimer under a stock photo | In-app text is labels and short sentences (≤15 words). Definitions go in a tooltip or a legend. Counts become tiles |
| W-04 | P1 | The same thing in different words | See S-17: Inquiry/RFQ, match/hit, "Xinjiang-linked text"/"region flag", Closed/Cancelled, Accepted/Quote accepted, Search/Discover | One glossary, used everywhere |
| W-05 | P1 | Register text shown raw | ALL-CAPS register addresses ("PLOT-169-171, UNION: TETULZHORA…"). A building inventory as the location ("Shed - 3, 4, 5, 10, 11, 12, 13 · Building - Security, ETP and Fire Pump"). Hash IDs as evidence ("b376ef6e0404ae78", "619:detail") | Clean display text (normal capitals, district-level location); the raw text stays in admin |
| W-06 | P2 | Labels that name the system's mechanics, not the buyer's question | "Source pending" (icon), "Read 18 May – 18 Sep 2026 · 11 sources", "Government register", tier words | Answer the buyer's question: "Where does this come from?" → "From BGMEA, checked 24 Jul 2026" |
| W-07 | P2 | Dates in three styles | "5d ago", "12 Aug 2026", "Updated 7d ago", "0 d", mm/dd/yyyy inputs | en-GB "8 Oct 2026"; "in 5 days" only for deadlines within 30 days; date inputs follow the buyer's locale |

The fix is a voice guide plus a rewrite of every visible string. The research
protocol is in the hand-off (session S0). The redesign uses the rewritten
copy, never today's.

---

## SR: Search and results

| ID | Sev | Surf | Problem | Evidence | Fix direction |
| --- | --- | --- | --- | --- | --- |
| SR-01 | P1 | D | The landing ignores a returning user's work | A marketing-style hero and 9 fixed "Common searches", while the sidebar shows Saved 16 and RFQs 5 | A "Needs attention" queue above the searches: expiring certificates, replies, new matches |
| SR-02 | P2 | D+P | Two search boxes, hints cut off | See S-13 | One search per screen |
| SR-03 | P1 | D+P | The results table doesn't work as a table | P: certificate chip clipped in 16 of 25 rows ("GOTS 55", "WRAP Go"). D: chips wrap 2-3 lines in a 212px column; four row heights (57-87px); about 10 rows per screen; three unlabelled 28px icons per row | 40px rows. Certificate on one line with its date. Sortable headers. Bulk bar. Column chooser |
| SR-04 | X | D | Sort "Most registers & certifiers" vs the Sources column running 9, 8, 1, 8, 2, 1, 1, 5 | Probably sample data. **Verify on production**; if real, P0 | Sort by the shown number, with the arrow on that header |
| SR-05 | P1 | D+P | The card view earns nothing | P: 371px cards, 1.8 per screen, 15+ targets. D: 185px cards, about 3.8 per screen; stock photos (T-07); logo wall | Founder D-7: drop on phone; compact version on desktop only if it proves its worth |
| SR-06 | P1 | D+P | Filters | "1 set" with nothing visibly set, and "Sanctioned hidden" has no control. D: 603px panel hides the Certificates column; Apply about 300px below the fold; no live count; "Its state" labels; "Every filter is a URL" | About 360px panel, pinned footer with "Show 312 suppliers", active filters listed at the top, a sanctions switch |
| SR-07 | P2 | D+P | Desktop paging on phone | "25 per page · Page 1 of 186", 28px arrows | "Show 25 more" on phone; real pagination on desktop |
| SR-08 | P3 | D | Likely duplicate company with no hint | "Zaheen Knitwears Limited" (1 source) and "Zaheen Knitwears Ltd" (5) | A data-side "possibly the same company" note (ETL owns it) |
| SR-09 | P1 | D+P | Bulk selection and "RFQ these 50" never drawn | Checkboxes exist; no selected state or action bar | Design it |

## RC: Supplier record

| ID | Sev | Surf | Problem | Evidence | Fix direction |
| --- | --- | --- | --- | --- | --- |
| RC-01 | P1 | D+P | Receipts are buried | P: about 6 screens; Certificates at 2.6, Safety 3.2, Sources 3.6. D: certificates at y 1,647 under a 27-item product list | A one-screen summary (identity, sanction, certificates "4 · 2 expired", RSC, number of sources), then collapsed sections |
| RC-02 | P2 | D+P | Tabs clipped | "Safe…", "Locat". Sources is not a tab | Scrolling tabs with an edge fade, or an overflow menu |
| RC-03 | P2 | D+P | Facts repeated | Type, year, workforce and BGMEA number in the header and in Overview; the safety block twice | Each fact once |
| RC-04 | P2 | D+P | Contradiction about buildings | Facilities "could not be read" after Safety rendered the building's RSC record | One source for buildings; an error that says what and when |
| RC-05 | P2 | D+P | Full page and phone chrome | D: 1,120px centred column, 56px unlabelled rail, action bar detached. P: five stacked bars, 278px | Full page uses the width with a side panel. Phone drops the global bar and tab bar on the record |
| RC-06 | P1 | D+P | The record misreports its own state | "Save" offered on an already-saved supplier. The back link says "Results" when the record was opened from Saved or Messages | Saved state from the server; the back link names where the buyer came from. **Verify saved state on live** |
| RC-07 | P1 | D+P | Product line | Stock photo first; "(V2)"; "Not attested · supplier-attested fields, shown when attested"; Send RFQ below the fold | Drop the photo; "Not published: ask in your RFQ"; pinned action |
| RC-08 | P3 | D | Implausible figure shown plainly | "1,000,000 pcs/day" beside 850 machines | A quiet "unusual figure" note (data quality) |
| RC-09 | P1 | D+P | The address is shown twice, plus spelling variants | Overview "Location · Factory address: PLOT-169-171, UNION: TETULZHORA, HAMAYETPUR, SAVAR, DHAKA". Locations then shows the same premises again with "Also recorded as: 160-171, Tetulgora, Hemayetpur, Dhaka, Savar · PLOT-169-171, UNION: TETULZHORA…" and the caption "3 premises · registry spellings merged". The founder reads this as noise (3 Oct) | See Fix now. Founder decision: **no spelling variants on buyer surfaces** (reverses the "Also recorded as" pills of the 11 Sep premises-merge spec). Admin may keep them |

## RQ: RFQs and quotes

| ID | Sev | Surf | Problem | Evidence | Fix direction |
| --- | --- | --- | --- | --- | --- |
| RQ-01 | P1 | D+P | The RFQ list can't support a decision | Unlabelled numbers and dates. No New RFQ button (D). "All 5" leaves out the draft. Rows not tappable as a whole. No best-quote-vs-target, replies x/y or ship-by columns | Labelled columns; New RFQ; whole-row links |
| RQ-02 | P1 | D+P | Status words | See S-17 | One status model |
| RQ-03 | P1 | D+P | The composer | Message printed twice (textarea plus preview). A checkbox and a × on each question. The preview lists all recipients ("To Aboni…, S M…"), a commercial leak if suppliers see it. The privacy note sits under a signature that contains the website | The preview shows structured terms; "Sent individually to N suppliers"; × only on questions |
| RQ-04 | P1 | D+P | Quote comparison isn't a comparison | P: quotes start 800px down. D: table 800px in a 563px pane (scrolls sideways, sticky Accept hides names and "valid until"); full page quotes column 528px. No difference against target. MOQ 5,000 vs 4,500 requested not flagged. A supplier with no reply is missing from Quotes | One design for pane and page: quotes first, full width; "vs target"; MOQ flag; "No reply · Remind" rows. Phone stacked cards |
| RQ-05 | P1 | D+P | Accept is casual | 61×28 grey, like the "Submitted" chip; two identical buttons; no consequence shown | "Choose" opens a confirmation sheet naming price, supplier and what happens next |
| RQ-06 | P2 | D+P | Pane and full page are duplicates | Different headers and back links; both are full-screen on phone | One RFQ screen |
| RQ-07 | P1 | D+P | Brackets can be sent | See Fix now | Now |
| RQ-08 | P3 | D | The composer title is 14px | The "Product" section heading has the same style as a field label | Type ramp |

## OR: Orders

| ID | Sev | Surf | Problem | Evidence | Fix direction |
| --- | --- | --- | --- | --- | --- |
| OR-01 | P2 | D+P | Row text | Three unlabelled dates; "PO PO-2026-0917"; "84,000.00 USD"; one date printed twice | "Ships by 20 Nov · In production since 22 Sep" |
| OR-02 | P1 | D+P | Cancel on a shipped order | See Fix now | Now |
| OR-03 | P2 | D+P | The timeline | Past events only; no author or source; ETA buried (13px, 545px down); tracking number not a link; no way to message the supplier | Planned and past steps; "Logged by …"; tracking link; message action |
| OR-04 | P1 | D+P | New order is a dead end | Lands on "Open a supplier profile from Discover and use 'Create order'"; no Discover tab; no Create order on the record | An inline supplier picker, saved and recent-RFQ suppliers first |
| OR-05 | P2 | D+P | The order form contradicts the RFQ form | Card vs full-bleed; inline vs sticky footer; free-text unit and currency vs selects; different labels | One form shell |
| OR-06 | P2 | D | Pane and full page reverse the section order | Actions 2 screens down on the full page | One order screen |

## MS: Messages

| ID | Sev | Surf | Problem | Evidence | Fix direction |
| --- | --- | --- | --- | --- | --- |
| MS-01 | P1 | D+P | The list can't be triaged | No preview, unread state or "supplier replied". D: no search, filters or new message; the reading pane is empty by default | Preview line, unread, status; open the latest thread |
| MS-02 | P1 | D+P | The thread isn't a chat | All messages left-aligned; the buyer's get the bubble and the supplier's none; composer not pinned (P); no attachments; no read state; name cut to "Aboni ..." | Native chat conventions; pinned single-row composer with attach |
| MS-03 | P1 | D+P | The record beside the thread | P: replaces the conversation, and back says "Results". D: replaces the conversation list. No RFQ context beside the thread | D: three panes (list, thread, context). P: the record as a sheet over the thread |
| MS-04 | P1 | D+P | The record inside a thread invites a duplicate RFQ | "3 from your account" above "You have not sent this supplier an RFQ yet", with a green Send RFQ. **Code:** the caption and the empty text are drawn independently (`components/dashboard/supplier-sheet.tsx:423`) | Show the thread's RFQ; the primary action is Reply |
| MS-05 | P3 | D | Reading comfort | About 115-character lines; the date printed twice per message | About 640px measure; time only within a day group |

## SV: Saved and saved searches

| ID | Sev | Surf | Problem | Evidence | Fix direction |
| --- | --- | --- | --- | --- | --- |
| SV-01 | P1 | D+P | The shortlist can't be worked | D: no checkbox column or bulk RFQ. P: the list starts 610px down, under alerts and activity | Bulk select plus "Send RFQ to selected"; list first |
| SV-02 | P2 | D+P | Row content | Unlabelled workers and saved date; raw register text as the location ("Shed - 3, 4, 5…") | Labelled; district only |
| SV-03 | P2 | D+P | Unsaving | One click on an unlabelled bookmark, no undo; the saved icon is an outline that reads as unsaved | Filled icon; menu "Remove"; undo toast |
| SV-04 | P2 | D+P | Saved searches | Under More (P); the empty state ignores the recent search; "results panel" copy | Offer to save the recent search; move under Saved |
| SV-05 | P1 | D+P | Save this search | A whole page for one field; no exit; raw filter string as the name; no match count; no alert option | A popover: name, count, "tell me about new matches" |

## CP: Compliance

| ID | Sev | Surf | Problem | Evidence | Fix direction |
| --- | --- | --- | --- | --- | --- |
| CP-01 | P1 | D+P | The hub doesn't rank risk | Three equal sections; UFLPA below certificate paperwork; the flagged supplier is a 13px chip at the end of a 141-character sentence | "Needs attention" ordered sanction > UFLPA hit > region flag > expired > expiring in 30 days, one action each |
| CP-02 | P1 | D+P | No "as of" anywhere | No check date or Entity List version on any compliance screen | "Checked against DHS UFLPA Entity List (updated …) · run …", linked |
| CP-03 | P1 | D+P | Urgency and naming | Colour-only urgency; expired and expiring the same; the flagged supplier unnamed and not clickable | Shape and words for urgency; named, linked rows |
| CP-04 | P1 | D+P | Expiry list is read-only | No "ask for renewal", sort, filter, export, owner or status; the certificate number outranks the deadline | Row action; sort, filter, CSV; deadline first |
| CP-05 | P1 | D+P | The MSA statement page | Download below the fold (D y 910; P 1,184px). Raw markdown in a 496px inner scroll box (18% visible). `.md` export. No editing per section. No versions or approval. "facility(ies)". Organisation name not prefilled | Editor per §54 area with confirmed / needs input / not applicable; rendered document; PDF/DOCX; versions and approver |
| CP-06 | P2 | D+P | UFLPA tracker | The populated list was never drawn; definitions as a 152-character paragraph; hub and page use different words | Count tiles, a legend, a populated list with evidence and check date |
| CP-07 | P2 | P | Compliance is under More | Two taps deep for the compliance buyer | The Alerts tab (founder D-3) |

## PR: Products and HS headings

| ID | Sev | Surf | Problem | Evidence | Fix direction |
| --- | --- | --- | --- | --- | --- |
| PR-01 | P2 | D+P | The products list | P: unlabelled values; 12 small buttons for 4 rows; row not tappable. D: hover-only actions leave a blank 234px column; Draft and Archived look the same; no RFQ or best-quote columns | Whole-row link; one ⋯ menu; status styles; RFQ columns |
| PR-02 | P2 | D+P | Send RFQ on Draft and Archived | See Fix now | Now |
| PR-03 | P2 | D+P | The one-option chooser | "Start manually" is the only option; "arrives with V2" | Delete the step |
| PR-04 | P1 | D+P | The product form | All 8 sections open; tables 640px in 326px (P); boxed per-cell inputs; free-text units; green Submit beside "Still needed"; no HS code field | Core fields first, the rest on demand; spreadsheet-like grids; units; disabled-until-ready with the reason; HS heading picker |
| PR-05 | P1 | D+P | The size chart holds one size | Code, Description, Tol −, Tol +, Base only; no graded size columns although size variants exist | Size columns from the variants, plus base and grade rules |
| PR-06 | P1 | D+P | Example rows read as saved data | See S-19 | Empty tables with "Add measurement", or "e.g." |
| PR-07 | P1 | D+P | Editing a live product | "Save draft" on an Active product; no "Save changes" or "Discard"; status and Archive/Delete hidden; redundant variants table; the description box clips | Save changes / Discard; status chip; lifecycle menu |
| PR-08 | P2 | D+P | HS headings | Second search box; counts unlabelled (P); no order or chapter hierarchy; 820px column | Group by chapter, sort by code, labelled counts |

## ST: Settings and account

| ID | Sev | Surf | Problem | Evidence | Fix direction |
| --- | --- | --- | --- | --- | --- |
| ST-01 | P2 | D+P | Settings layout | Two-row wrapped tabs; personal and company mixed; "Inquiry" holds RFQ templates | A grouped list (P), a grouped left nav (D); "RFQ templates" |
| ST-02 | P1 | D+P | Saving | Grey, non-sticky saves; five forms on Profile; two saves on one template page | One primary save per form; a sticky bar when there are unsaved changes |
| ST-03 | P1 | D+P | Password without the current password | See Fix now | Now |
| ST-04 | P1 | D+P | No security settings | No 2FA, session list or "sign out everywhere" | Security page (E-02) |
| ST-05 | P1 | D+P | Members | No invite and no roles; "Contact support" | Invite plus roles (E-01) |
| ST-06 | P2 | D+P | Plan and usage | No prices, usage meter or upgrade path. Enabled and disabled buttons look the same. Plan copy lists RFQs under Growth while this Free user has RFQs | Usage meter; honest plan copy (founder D-6) |
| ST-07 | P2 | D+P | Notifications | Not sending yet; sanctions bundled into the digest. D: toggles about 910px from their labels. No channels | Sanctions always on; rows about 640px; channels later |
| ST-08 | P2 | D+P | The RFQ template editor | Question text clipped; 19×28 buttons 6px apart (P); `{{variables}}` typed by hand; no preview | Insert-variable chips; preview with a real saved supplier |
| ST-09 | P3 | D+P | Small things | Initials "R" vs "RE"; "retailer" in lower case | — |

---

## E: Enterprise gaps (product decisions; founder D-4 decides design scope)

| ID | Gap | Why a UK or EU compliance team asks for it |
| --- | --- | --- |
| E-01 | Roles and invites (owner, editor, viewer, approver) | Sourcing, compliance and legal share the work |
| E-02 | 2FA, session list, SSO/SAML later | The first question on a security questionnaire |
| E-03 | Audit log: who saved, sent, accepted, cancelled or generated what, and when | Auditors ask "who approved this and when" |
| E-04 | Evidence export: dated, sourced CSV/PDF of expiries, UFLPA results, supplier footprint | The auditor's evidence pack |
| E-05 | Approval steps (statement sign-off; optional quote approval) | §54 needs Board approval and a director's signature |
| E-06 | Shared shortlists ("Only you can see this list" today) | Team buying |
| E-07 | Usage metering and billing | The buyer must see where they are against the plan |
| E-08 | Alert channels (email live first; Slack or Teams later) and an always-on sanctions alert | Risk changes reach the right person |

---

## M: Marketing and onboarding gaps (handled in hand-off phases 3 and 4)

| ID | Gap |
| --- | --- |
| M-01 | Nothing happens after sign-up: no welcome, no sourcing profile, no first-result moment |
| M-02 | No activation path to the promised outcome (shortlist and send an RFQ in one sitting); no getting-started checklist |
| M-03 | No invite flow and no invited-user path |
| M-04 | Marketing lacks product pages, a methodology page, a security page, role pages and Contact sales. Proof must come from live data, because no testimonials, logos or certifications exist |
| M-05 | The supplier claim flow lives in the old shell |

---

## X: Sample-data seams (verify on production before acting)

- Aboni's WRAP: "expires 8 Oct · in 6 days" (Saved), "in 11 days" (hub), "Expired 29 Sep" (record), "0 d" (desktop table). If the live data does this, it is P0.
- "4 saved suppliers" vs "16" (hub) vs the badge "Saved 16" vs "10" on other screens; RFQs 5 vs 4.
- The UFLPA counts above "No saved suppliers yet".
- One RFQ reads "Quoted · 2" in the list, "Open" in the pane and in "Other RFQs".
- "3 from your account" vs "You have not sent this supplier an RFQ yet" (see MS-04 for the code side).
- SR-04: the sort order vs the Sources column.
- Order PO-2026-0902: "PO issued 2 Sep" before "Created 17 Sep". The Men's cotton trousers RFQ is still Open while its order has shipped. The Socks RFQ is Cancelled while a Socks order sits in Draft.
- The account is "Rezaul Karim" on one screen, "admin" elsewhere, and the RFQ is signed "Sam Taylor, Northwind Apparel Ltd".
- "Gazipur, Gazipur" (check whether the location display removes duplicates).
- Paper conversion artifacts, not bugs: the Inquiry "move up" arrow points down (the source rotates it, `components/settings-inquiry-form.tsx:130`); the sidebar label "Recent searches" at 15px (check live).

---

## Measurements

**Phone (Paper page "Phone", 2 Oct; 2,926 text nodes, 1,102 visible controls).**

*Tap targets*
- 675 controls (61%) are under 44px tall after their enlarged hit areas.
- On four screens every control is under 44px: Product line, Filters, Order open, RFQ open.

*Text*
- 11 distinct text sizes.
- 169 text nodes under 12px: 164 at 11px (150 of them are tab labels), 1 at 10px, 1 at 9px, 3 at 8px.

*Fields and contrast*
- All 138 text fields use 16px text, so iOS will not zoom (good).
- Contrast is below 4.5:1 only on 8 disabled-button labels (`#9AA39A` on `#EEEEEC`, 2.24:1).

*Colour*
- Filled green buttons: 18 screens with one each, none with two.
- Signal green is not used.

*Length*
- The 39 artboards add up to 76,851px, about 91 phone screens.
- Seven artboards are longer than 3 screens:

| Artboard | Screens long |
| --- | --- |
| Results as cards | 10.5 |
| Thread with record | 6.5 |
| Record full page | 6.1 |
| Saved · supplier open | 6.0 |
| Record in pane | 5.9 |
| Product edit | 4.0 |
| Results table | 3.2 |

**Desktop (Paper page "Desktop", 3 Oct; 4,918 text nodes, 2,161 visible click targets, 1440×900).**

*Text*
- 392 text nodes are under 12px (8%):
  - 3 at 8px and 1 at 9px;
  - 24 at 9.5px (source marks);
  - 101 at 10px (supplier initials);
  - 263 at 11px (sidebar counts, "Ctrl K").
- 12px is never used.
- Off-scale sizes: 16px (section headings and the wordmark) and 17px.
- The steps between heading sizes are 1.13 to 1.14 (target 1.25): body 15 / h2 16 / h1 18 is a flat hierarchy.

*Contrast*
- 30 text-on-background pairs. One fails: disabled buttons at 2.24:1 (exempt under WCAG).
- The lowest passing pair is 4.54:1.
- No text is drawn in brand green.

*Click targets*
- 364 targets are under 24×24. 15 of them fail WCAG 2.5.8 (the stacked brand-list mark links).
- 1,248 targets are under 32px tall.
- The smallest are 12×12 "remove filter" × links, and 16×16 row checkboxes with no enlarged hit area on desktop.

*Layout*
- Sidebar 232px, main area 1,208px.
- Every list-plus-pane split is 604/603.
- The Saved table is 1,041px inside 572 and the quotes table 800px inside 563. Both scroll sideways.
- On 12 list screens, 85–95% of the first 900px holds no text or controls.

*Line length*
- Prose runs up to about 148–161 characters per line. Worst: Compliance (141), MSA (148), Expiry (132), UFLPA (122).

*Below the fold at 1440×900*
- MSA "Download .md" (y 910) and "Copy" (950).
- "Send RFQ for this line" (932).
- "Save template" (943).
- "Update password" (940).

*Green*
- Every screen carries the logo and a signal dot.
- At most 2 filled green buttons per screen (search icon plus Apply or Send RFQ). 14 screens have none.

*Design-system spread*
- 12 radii (only 2.5px is a genuine extra); 12 shadows, 9 of them used as borders; 17 fills (7 light greys); 1 raw border colour (`#767676`, the browser default).
- 38 of the file's 65 colour tokens are never used.

*Accessibility (40 real pages)*
- 0 unnamed buttons or links, 0 unlabelled fields, 0 images without alt.
- 0 skipped heading levels, 0 duplicate IDs, 0 positive tabindex.
- Landmarks are present.
- A 2px focus ring passes 3:1 everywhere except result rows (A-01).
- Reduced motion is honoured globally.
