# Hand-off: SourceBD v4, a new design system, every screen on Paper first, then built

Written 3 Oct 2026. The founder asked for this after two harsh critiques
of the 39 phone screens and 39 desktop screens. Both critiques are saved under
`.impeccable/critique/`; their merged issue list is
`context/feature-specs/ui-issue-register-oct-2026.md` (the "register"; IDs
like `T-01`, `S-04`, `RC-03` below point into it).

The founder's words, in short:

1. Create an enterprise-grade design system first, **without looking at the
   design the platform has today**. Use the Mobbin MCP to find related
   businesses, take **one** product's design system and screens as the model,
   keep only **forest green `#1B5E20`** from the app, and recreate everything
   else.
2. Fix every app screen **on Paper first**, desktop and phone.
3. Plan and design enterprise-grade **marketing pages** and a robust
   **onboarding flow** the same way (Mobbin references, Paper first).
4. Then build it all in code and put it live.

Recorded founder answers:

- **2 Oct (phone critique):**
  - Fix truth problems first.
  - The phone app is for **glance and act** (replies, quotes, alerts), not a
    shrunken desk app.
  - The first pass is the P0s plus the top issues, then a re-critique.
- **3 Oct, on the supplier record:**
  - The address must appear **once**, cleanly.
  - No "Also recorded as" spelling variants and no "registry spellings
    merged" on any buyer surface (register `RC-09`; it is in "Fix now").
- **3 Oct, on the map:**
  - The Barikoi map that is already built in the repo must be visible on the
    supplier page (register `RC-10`).
  - It is in "Fix now" for today's record, and part of the v4 Locations
    design.
- **3 Oct, on the whole product:**
  - It is "wordy and text heavy with confusing numbers and dev-jargon-like
    sentences".
  - Humanise it: research how these buyers talk and speak their language
    (register section W, session S0 below).
- **3 Oct, on the home page:**
  - A scroll story of the same quality as the United Carriers home page
    (Awwwards Site of the Day, 6 Sep 2026). It is section 5's "Home page scroll
    story".
  - "We should not clone United Carriers": take its craft as inspiration and
    tell SourceBD's own story.
  - Shipment records (bills of lading, FOB values, buyer names) from Volza come
    in v2 and must be part of that story.

"Model on one product" means: adopt its structure: grid, spacing scale, type
proportions, density, component anatomy, navigation and screen patterns.
Rebuild all of it in SourceBD's own tokens, words and data. Never copy its
logo, brand colours, illustrations, proprietary typeface, icon artwork or
marketing text. That keeps the work ours and keeps the founder out of
trade-dress trouble.

---

## 0. The order, the gates, who approves

```
Phase 0  Words              S0 voice research   -> GATE 0 (glossary + rewritten copy)
Phase 1  Design system      S1 research + spec  -> GATE 1 (reference, type, colour)
                            S2 build in Paper   -> GATE 2 (DS pages)
Phase 2  App screens        S3-S6 on Paper      -> GATE 3 per flow
Phase 3  Onboarding + auth  S7 on Paper         -> GATE 4
Phase 4  Marketing site     S8 on Paper         -> GATE 5
Phase 5  Build              S9+ in code, PRs    -> CI merges; founder approves the deploy
```

- Gates 1-5 are the founder looking at Paper and saying yes. Send screenshots
  with `SendUserFile`; never ask the founder to open a dev server.
- Phase 5 follows AGENTS 9/9a: PRs land when CI is green; the founder's only
  click is Deploy Production. `--apply` and live migrations wait (rule 15).
- One session = one phase step. Clean tree at start (rule 11). Reply to the
  founder in plain words, five lines or fewer unless they ask for more.
- **Not part of the redesign; do these now, in their own small PRs:** the
  truth and guard bugs listed in register section "Fix now". Two are already
  running as separate sessions (started 3 Oct): the Modern Slavery statement
  writing claims the buyer never made (`T-01`), and expired certificates
  missing from the expiry watch (`T-02`).

---

## 1. Rules every session follows

**What a v4 session may NOT open (the old design):**
- `DESIGN.md`, `.impeccable/design.json`, `.impeccable/surfaces/*`
- `lib/design/tokens.ts`, `app/ds.css`, `app/globals.css`, `tailwind.config.ts`
- `components/dashboard/*`, `components/ui/*` (until Phase 5, and then
  for data and behaviour only, never for classes or visual values)
- `context/frontend-design-spec.md`, `context/archive/old-design/*`, `design/*`
- `context/feature-specs/ds-rebuild-must-stay.md` **section 9** ("Locked
  direction") and every older design hand-off
  (`handoff-dashboard-*`, `handoff-enterprise-buyer-app.md`,
  `handoff-one-viewport-shell.md`, `handoff-redesign-*`)
- Paper file "SourceBD" (`01M3XEFXNJ7V1M9YVMP4W8990J`), pages "Desktop" and
  "Phone", **as pictures**. Phase 2 may read their *text* only (`find_nodes`
  by text, `get_node_info`) for the content-parity check in 4.4. No
  `get_screenshot` on them.

**What a v4 session MUST read:**
- `PRODUCT.md` (who the buyers are, the promises: receipts not opinions,
  nothing fake, locked/empty/stale/sanctioned are normal states).
- `context/feature-specs/ds-rebuild-must-stay.md` sections **2 to 6**: what
  never changes, the real-world sizes (name lengths, 1 to 11 sources, 54 HS
  codes, cert states), what each surface holds, the states every piece needs,
  the checks before the switch. These are product facts, not design.
- `context/logos.lock.md` before touching any third-party source logo.
- The register (grep its headings; it is long).

**Before running the impeccable skill's context loader (S1, once):**
`git mv DESIGN.md context/archive/old-design/DESIGN-ledger-2026-09.md`,
`git mv .impeccable/design.json context/archive/old-design/design-ledger.json`,
`git mv .impeccable/surfaces/app-app-app.md context/archive/old-design/`.
Do not open them. Then `impeccable context` loads PRODUCT.md only, and the
session runs as a **redesign** (impeccable `new-work`): the old look is
evidence of what failed, never a starting point. The new `DESIGN.md` is
written by S2 from what is in Paper.

**Paper:**
- Make a **new Paper file "SourceBD v4"** (`create_file`). Its tokens are new;
  the old file's tokens and 30k layers stay untouched as the record of v3.
  Pages: `00 Reference`, `01 Foundations`, `02 Components`, `03 Patterns`,
  `10 App · Desktop · <flow>`, `11 App · Phone · <flow>` (one page per flow,
  because Paper slows past about 20k layers per page), `20 Onboarding`,
  `30 Marketing · Desktop`, `31 Marketing · Phone`, `90 Built` (Phase 5).
- Load `get_guide("paper-mcp-instructions")` once per session. Pass `fileId`
  on every call. Write one visual group per `write_html`; screenshot after
  each section; `finish_working_on_nodes` when done.
- Artboards: desktop 1440x900 (a one-viewport app shell: content panes
  scroll inside; draw long panes as a second artboard "scrolled", never as one
  4,000px artboard), phone 390x844 plus a 320px check for every phone screen.
- Real records only, from must-stay section 3: `aboni-knitwear` (11 sources),
  `sm-knitwear` (6 certificates), the 100-character Zaheen name,
  `adventure-garments` (39 products), `liberty-knitwear` (5 buildings),
  `ar-fashion` (almost no data). The sanctioned state is drawn only as a
  labelled **"Sample state"** artboard (must-stay question 5); no invented
  company.

**Mobbin:**
- Tools: `search_screens`, `search_flows`, `search_sections` (MCP server
  `85d92e90-...`). Set `output_destination: "design_tool"`, `output_tool:
  "Paper"`, and keep one `task_intent` across calls.
- Image URLs expire after 30 days. Download every reference you rely on from
  its `image_url` into `.impeccable/review/mobbin/<app>/<screen>.webp` (that
  folder is git-ignored) and cite the `mobbin_url` in the spec.

**Honesty rules for every surface (from PRODUCT.md; the critiques found each
of these broken at least once):**
- No SourceBD score, grade, rating or star. A progress bar that fills to 100%
  reads as a score: show the figure as text.
- No invented testimonials, customer logos, security badges (SOC 2, ISO),
  benchmarks or prices. If a claim is not true today, it is not on the page.
- Every fact keeps room for its source, **in words**, not only an icon.
- A number always carries its unit or label ("3,166 workers", "MOQ 3,000").
- Each fact appears **once** per screen. No spelling variants, no "Also
  recorded as", no raw ALL-CAPS register text (founder, 3 Oct). Raw strings
  stay in admin.
- Copy follows `voice-v4.md` (session S0). Never reuse today's strings
  without passing them through the inventory.

---

## 2. Phase 0: words and numbers (S0, one session, can run beside S1) -> GATE 0

The founder's complaint is as much about language as about layout: wordy
screens, numbers that don't say what they count, and sentences written like
system logs. This session fixes the words **before** any screen is redrawn,
so Paper never inherits today's copy.

**Who we write for:**

- **Sourcing managers, buyers and merchandisers** at UK, EU, US and Canadian
  clothing brands and retailers. They think in factories, products, MOQ, lead
  time, FOB, samples, tech packs and POs.
- **Ethical-trade, compliance and ESG managers.** They think in audits,
  certificates, expiry, due diligence, forced-labour risk, the UFLPA Entity
  List, the Modern Slavery statement and evidence for auditors.
- **Secondary readers:** Bangladeshi supplier staff, for whom English is a
  second language. Plain English helps everyone.

**Research (web; follow CLAUDE.md's browser rules: plain fetch for public
pages):**

1. The words regulators use, so ours match:
   - UK Home Office statutory guidance on s54 statements;
   - US CBP's UFLPA guidance and FAQ;
   - the EU CSDDD and Forced Labour Regulation summaries.
2. The words the industry uses:
   - Open Supply Hub facility pages (the closest public "facts with sources"
     product);
   - Sedex/SMETA and amfori BSCI glossaries;
   - ETI Base Code;
   - GOTS, OEKO-TEX and WRAP certificate pages;
   - BGMEA and BKMEA member pages;
   - RSC factory pages.
3. The words buyers use about their own jobs:
   - UK and EU job adverts for "sourcing manager", "ethical trade manager"
     and "supplier compliance manager" at apparel brands;
   - trade press (Drapers, Just Style, Sourcing Journal) headlines and
     explainers.
4. The words in adjacent products' interfaces. Mobbin screens of the chosen
   reference product and of procurement and compliance tools.
5. Write down **verbatim phrases** with their URL. A word goes in the
   glossary only with a source.

**Output: `context/feature-specs/voice-v4.md`, about 6 KB:**

- **Ten voice rules:**
  - Plain English at roughly reading age 12, for a second-language reader.
  - One idea per sentence; at most 15 words in the app.
  - Buttons start with a verb.
  - Never narrate the system ("results update when you apply").
  - Say what the buyer gets or must do.
  - Name the source in words.
  - Never apologise in an empty state; say what to do next.
  - (Add three more from the research.)
- **Glossary table:** "we say / buyers say / never say", with a source per
  row. Starting points to verify (each needs research before it's adopted):

  | Today | Direction |
  | --- | --- |
  | "Sources", "registers & certifiers" | "Evidence", or "Listed by" (BGMEA, RSC…) |
  | "Source pending" | "Not yet checked" |
  | "as filed" | "as declared to BGMEA" |
  | "Export lines" | "Products they export" |
  | "Inquiry" | "RFQ template" |
  | "region flag" | "Possible Xinjiang link" |
  | "hit" | "On the UFLPA Entity List" |
  | "Sanctioned hidden" | "Hiding sanctioned suppliers" |
  | "published" | (drop it) |
  | "Discover" | "Search" |

- **Number rules:**
  - Every number carries its noun or unit.
  - One count per idea.
  - Money as "US$6.15 per piece".
  - No counts of form fields.
  - No "+n" without what it counts.
  - Thousands separators.
  - Round where precision doesn't help ("about 3,200 workers" when two
    sources disagree, with both shown on tap).
- **Date rules:** en-GB "8 Oct 2026"; relative only for deadlines within 30
  days ("expires in 5 days"); date inputs in the buyer's locale.
- **Source wording pattern:** "From BGMEA · checked 24 Jul 2026", "Listed on
  ASOS's supplier list · Jul 2026".
- **State wording:** locked, empty, stale, contradicted, sanctioned, error,
  loading. Each one says what it means for the buyer and the next step.
- **The copy inventory:**
  - Every visible string on the 39 app screens, extracted as text from
    `.impeccable/preview/paper-import/raw/*.html`, or from the old Paper
    file by text.
  - One row each: screen, today's text, rewritten text, rule applied.
  - This becomes the copy Paper uses in S3–S6.
  - Start with register section W and the `S-16`/`S-17` lists.

**GATE 0:** the voice rules, the glossary and 20 before/after rewrites from
the worst screens (record, filters, compliance hub, RFQ list, quotes) sent
to the founder in plain words.

**Apply it everywhere after:**

- S3–S8 use the inventory's rewritten column.
- Each screen gets one impeccable `clarify` pass against `voice-v4.md` before
  its gate.
- Marketing (S8) uses the same glossary, so the site and the app speak alike.

---

## 2b. Phase 1: the design system

### S1: research and choose (one session) -> GATE 1

1. Archive the three old design files (section 1). Load `impeccable`
   (`new-work`), Paper guide, Mobbin.
2. **Shortlist 3 to 5 candidate products** on Mobbin, judged on this table
   (score 0 to 3 each):

   | Criterion | Why it matters here |
   | --- | --- |
   | Domain closeness | vendor/supplier lists, risk, compliance evidence, procurement |
   | Dense data tables done well | the results list is where buyers spend the day |
   | Record opens beside the list | PRODUCT principle 4: never lose the search |
   | Evidence and documents pattern | receipts with source, date, link |
   | Compliance dashboard pattern | expiry, flags, "needs attention" |
   | Settings, roles, audit log | the enterprise gaps in register section E |
   | Phone app on Mobbin | the glance-and-act phone needs a model |
   | Marketing site on Mobbin | Phase 4 reuses the same system |

   **Recommended default: Vanta.** It is a compliance and vendor-risk product:
   vendor list with risk chips, review status and due dates, filters in a
   row, a quiet sidebar, and a marketing site of the same family on Mobbin.
   Seen in scouting on 3 Oct:
   - [vendor list](https://mobbin.com/screens/995e29ec-7ba8-4161-b4a1-ba8f9ec25bd9)
   - [hero](https://mobbin.com/sites/sections/09afd018-1fc1-46d7-96b8-47ab66cba532)
   - [footer](https://mobbin.com/sites/sections/2dfbd3f6-5b6e-49b2-bab5-c30d59dae0c5)

   Runners-up worth pulling:
   - Remote's [compliance watchtower table](https://mobbin.com/screens/4ded0f24-17fd-4c6f-998a-6d6d2074d1b0)
   - Airwallex's [vendor panel with a Documents tab](https://mobbin.com/screens/99885b25-e5e2-4d09-b055-567949df077d)
   - 7shifts' [certification expiry list](https://mobbin.com/screens/806539a9-f62a-44fd-aad4-db4283e65b31)

   Vanta likely has no iOS app on Mobbin. Check that. If so, the phone takes
   its *patterns* from:
   - Brex iOS [approvals timeline](https://mobbin.com/screens/ecf850cc-08cc-46ef-b321-8248107afc9e)
   - Revolut Business iOS [grouped request details](https://mobbin.com/screens/64d00289-b1fd-4d1b-8768-884ce9603421)
   - Grailed iOS [order status with a sticky action](https://mobbin.com/screens/0973a155-a055-4ec2-891d-54295e275fcd)

   The phone stays inside the one chosen system's tokens and components.
3. Pull **at least 40 screens** of the chosen product: every list, record and
   detail, dashboard, settings, empty, error, modal, drawer and onboarding
   screen Mobbin has. Also pull its flows (`search_flows "<app> ..."`).
4. Write `context/feature-specs/ds-v4-spec.md` (new file, about 8 KB). It
   measures the reference and records, with a Mobbin link for each:
   - grid and breakpoints
   - spacing scale
   - type ramp (size, weight, line height, tracking per role)
   - radii, borders, elevation
   - density (row heights, control heights)
   - table anatomy, sidebar and topbar
   - drawer/pane widths, form layout, button hierarchy
   - status-chip grammar, empty states, toasts, dialogs, tabs, filters,
     pagination
   - icon style, motion

   For each item, state what SourceBD keeps and what it changes, and why.
5. **Recreate in SourceBD terms:**
   - Colour:
     - Brand: forest green `#1B5E20` and its hover/active/tint ramp. It is
       the *only* carried-over value, spent only where the buyer acts.
     - New neutrals.
     - Semantic colours: success, caution, danger, a distinct **sanction**
       red, info.
     - A separate scale for "valid / expiring / expired / no expiry on file"
       that never relies on hue alone (register `S-07`).
     - Every pair tested to WCAG 2.2 AA.
   - Type:
     - One free family plus one mono, with tabular figures and Latin
       Extended.
     - Licence must allow web use; loaded with `next/font` (no new package,
       must-stay section 2).
     - **Recommended default (D-2): IBM Plex Sans with IBM Plex Mono.**
       - Both are open-licence and on Google Fonts.
       - Plex reads as institutional and engineered, which suits a product
         that sells evidence. It has true tabular figures for tables, and
         Plex Mono is made for certificate numbers, HS codes and dates.
       - It is less generic than Inter.
     - **Runner-up: Inter with JetBrains Mono.** Inter matches the founder's
       18 Sep answer.
     - Test both in a real 40px results row and a 13px fact row. Choose Plex
       unless it measurably loses on density or legibility; log the
       measurements.
     - Today's typeface (Geist) is out, under "everything else gets
       recreated".
   - Icons: Phosphor is the allowed package. Choose weight and sizes anew.
   - Floors the critiques proved necessary (register section S):
     - Text: 12px minimum anywhere.
     - Phone: every tappable thing 44x44px.
     - Desktop: 24px minimum hit area, 32px default control.
     - Phone inputs at 16px.
     - Prose capped at about 72 characters per line.
     - A number never appears without its label.
6. GATE 1: send the founder a one-page Paper board (`00 Reference`) with:
   - the chosen product and why;
   - the two type candidates set in a real SourceBD table row;
   - the colour ramp.

   Wait for the answer.

### S2: build the system in Paper (one or two sessions) -> GATE 2

On `01 Foundations`, `02 Components`, `03 Patterns` of the v4 file:

- **Tokens** via `create_tokens`, Tailwind v4 namespaces (`--color-*`,
  `--text-*`, `--spacing-*`, `--radius-*`, ...). These exact names become
  `lib/design/tokens.ts` in Phase 5.
- **Foundations:** colour with contrast pairs, type ramp, spacing, radius,
  elevation, grid at 1440/1280/390/320.
- **Components, each in every state** (default, hover, focus-visible,
  pressed, disabled, loading, error):
  - button (primary, secondary, quiet, danger)
  - input, select, combobox, checkbox, radio, switch (44px on phone)
  - chip/badge, tabs (with overflow), segmented control
  - table (sortable header, sticky header, selection, bulk bar, column
    chooser, empty, loading)
  - pagination and "Show more"
  - drawer/pane with a resizable divider, dialog, confirm sheet, toast with
    undo, tooltip, popover, menu
  - toolbar/filter bar, date input (locale-aware, never mm/dd/yyyy for UK/EU)
  - file upload, skeleton, empty state, error state
  - phone tab bar, phone sticky action bar, phone sheet
- **SourceBD patterns (the product's character; register `S-01`, `RC-*`):**
  - **Source mark row:** one mark and eleven marks, legible at 24px with the
    register's short name in text; tier order visible.
  - **Fact row:** label, value with unit, source in words ("BGMEA · read
    24 Jul"), states current / stale / contradicted / source page changed /
    not yet sourced.
  - **Certificate row:** valid, expiring within 90 days, expired, no expiry on
    file, each with issuer, number and document link, and urgency not by
    colour alone.
  - **RSC block:** active / no longer covered, progress as text, five report
    links with "missing boiler link" as normal.
  - **Sanction banner:** cannot be hidden by layout, refuses Send RFQ.
  - **Locked contact block:** "Email 1 on file · Phone 3 on file" kept from
    v3, because it worked.
  - **Supplier list row:** desktop table row at 40px, phone row.
  - **Quote comparison:** desktop table with "vs target", MOQ above quantity
    flag, no-reply rows; phone stacked cards; Accept through a confirm sheet.
  - **Timeline:** past and planned milestones with who logged each.
  - **Chat:** bubbles by sender, pinned composer with attach, read state.
  - **"Needs attention" row** with one action.
  - **Locations map (`RC-10`):** the Barikoi map beside or above one clean
    address per premises, synced both ways.
    - Pins show the address kind and exact vs approximate (from the geocode
      confidence).
    - Controls: a satellite/street toggle, and "nearby suppliers" off by
      default.
    - Phone: a map card that opens full screen.
    - In Paper, show a **real** map: a screenshot of the map on the live
      public supplier page for `aboni-knitwear` (public, no login), captured
      with the in-app browser and placed as an image.
    - Never draw invented pin positions. If no real capture is possible, use
      a plain placeholder labelled "Map (Barikoi), live in the build".
  - **Statement claim to confirm:** `[Confirm: ...]` that blocks export.
- **The app shell:**
  - Desktop: sidebar plus topbar plus list and pane, with search living in
    one place only.
  - Phone, glance-and-act:
    - Tabs: **Messages · Quotes · Alerts · Saved · Search**.
    - Settings and Products move under the account menu.
    - Show the phone tab IA to the founder at GATE 2; it changes navigation
      everywhere.
- Then write the new `DESIGN.md` from what is in Paper (impeccable `document`
  or by hand) and update `PRODUCT.md` only where a promise changed (it
  should not).
- GATE 2: screenshots of the three pages.

---

## 3. Phase 2: every app screen on Paper (S3 to S6) -> GATE 3 per flow

Redesign, do not restyle. Each screen starts from the screen inventory and the
register items it must close, not from the old picture.

### 3.1 Flows and screens (desktop 1440 and phone 390 for each)

| Session | Flow | Screens (v3 names) | Register items to close |
| --- | --- | --- | --- |
| S3 | Search and the record | Landing (with the returning-user work queue), Results table, Results cards (decide: keep or drop, `SR-05`), Filters, Supplier record (pane + full page, one design; Locations with the Barikoi map and one address per premises, `RC-09`/`RC-10`), Product line, Sanctioned record (sample state), empty results, loading, error | `T-03`..`T-07`, `SR-*`, `RC-*`, `S-*` |
| S4 | RFQs, quotes, orders | RFQ composer (to 1 and to 50 suppliers), RFQ list, RFQ detail with **quote comparison** (one design for pane and page, `RQ-04`), Accept confirm sheet, Orders list, Order detail with timeline, New order (picker inline, no dead end, `OR-04`), order form | `RQ-*`, `OR-*` |
| S5 | Messages, Saved, Compliance | Messages list, thread, thread with record beside it (desktop three-pane; phone sheet over the thread), Saved (with bulk RFQ), Saved searches (with alerts), Save-this-search popover, Compliance hub as a ranked "Needs attention" view, Certificate expiry (with an **Expired** group), UFLPA tracker populated with hit / region flag / clear, MSA statement editor (confirm-every-claim, PDF/DOCX export) | `MS-*`, `SV-*`, `CP-*`, `T-01`, `T-02` |
| S6 | Products, HS headings, Settings, account | Products list, product editor (spreadsheet-like size chart across sizes, BOM with units, `PR-*`), HS headings by chapter, Settings as a grouped list (Profile, Security, Workspace, Members & roles, RFQ templates, Plan & usage, Notifications), Members with invite and roles, Security (2FA, sessions), Audit log (if the founder says yes to `E-03`) | `PR-*`, `ST-*`, `E-*` (only those approved) |

### 3.2 States every screen ships with

From must-stay section 5:

- empty (it must sell the feature, because almost every launch user sees it)
- locked
- loading
- error with a way forward
- sanctioned
- for facts: current / stale / contradicted / source changed
- for certificates: the four states
- the 100-character name
- 1 source and 11 sources
- `ar-fashion` with almost nothing on file

### 3.3 Phone, glance-and-act

The phone shows each job's answer on its first screen:

- **Messages:** who replied and what they said.
- **Quotes:** best vs target and MOQ against quantity, with Accept through a
  confirm sheet.
- **Alerts:** what expired or got flagged, with one action each.
- **The record:** one summary screen (identity, sanction status,
  certificates "4 · 2 expired", RSC, number of sources), then collapsed
  sections under sticky, scrolling tabs.

Structure and size:

- No global search bar on task screens.
- The tab bar hides while a sticky action bar or the keyboard is up (`S-09`).
- Targets are 44px.

### 3.4 Content parity

Before GATE 3 for a flow, list every fact, action and state the v3 screens
held. Read them as text from the old Paper file with `find_nodes` and
`get_node_info`, no screenshots. Tick each one off against the v4 screen
("kept", "moved to ...", "dropped because ..."). Nothing disappears by accident.

### 3.5 GATE 3

Per flow:

- Screenshots of desktop and phone.
- The parity table.
- The list of register IDs closed.

Then run `/impeccable critique` on the v4 page and post its score next to the
v3 baseline:

- phone 15/40;
- desktop 17/40.

---

## 4. Phase 3: onboarding, sign-in and the first session (S7) -> GATE 4

Today: `/signup`, `/login`, `/forgot-password`, `/reset-password` exist. There
is no onboarding at all after sign-up, and the supplier claim flow lives in
the old shell. The success the product promises, *shortlist and send an RFQ
in one sitting*, has no path designed for it.

References pulled on 3 Oct (pull the full flows in S7):

- Productboard [verify email, create workspace, "tell us about your work"](https://mobbin.com/flows/54bce0a9-613c-4770-85e0-92c09b001e90)
- Customer.io [role, personalisation, then a workspace setup checklist](https://mobbin.com/flows/69c8b311-0703-4bcc-89ba-a425cc9029d8)
- ClickUp [use-case chooser and invite step](https://mobbin.com/flows/d46b7798-ba1e-4e4b-b8be-3c05123dd7aa)
- Outseta [numbered setup guide](https://mobbin.com/flows/bd71adf0-7324-4769-b552-42b2cd5125e0)
- Langdock [minimal steps plus a "Get started" card in the sidebar](https://mobbin.com/flows/f9fb590d-2e3f-474d-8072-8061aa06075a)

Also search the chosen reference product's own onboarding.

**The buyer flow, designed end to end (desktop and phone):**

1. **Sign up.**
   - Work email and password, or a magic link.
   - Terms acceptance in words, not a pre-ticked box.
   - Errors to design: existing account, a personal-email notice (allowed,
     but explained), a weak password.
   - Google/Microsoft sign-in only if the founder says yes (Supabase supports
     it; no new package).
2. **Verify email.**
   - Code or link, "Open Gmail / Open Outlook", resend with a timer.
   - Wrong-email escape.
   - Expired-link state.
3. **About you.**
   - Name and role (Sourcing, Compliance, Merchandising, Founder/Owner,
     Other).
   - Role decides the first screen: Compliance lands on Alerts, everyone
     else on Search.
4. **Your company.**
   - Company name and type (brand, retailer, importer, agent).
   - Country and size.
   - These fill Settings, so they are never asked twice.
5. **What you source.**
   - Product types: HS heading picker with plain names.
   - Certificates you require: GOTS, OEKO-TEX, WRAP, SA8000.
   - Markets you sell into: UK, EU, US, Canada.
   - Markets switch on the matching compliance tools: UK leads to the Modern
     Slavery statement, US to UFLPA screening.
6. **Your first results.**
   - The search runs with those answers, showing the real count from
     production ("312 suppliers match").
   - One coach mark: "Every fact shows where it came from: tap a source".
     No tours.
7. **Getting-started checklist.** A sidebar card on desktop and a card on the
   Alerts tab on phone; dismissible, progress saved. Steps:
   - Save 3 suppliers.
   - Open a record and check a source.
   - Send your first RFQ.
   - Turn on certificate alerts (they're automatic for saved suppliers).
   - Set your RFQ template.
   - Invite a colleague.
8. **Invite teammates.**
   - Optional, skippable.
   - Role per invite.
   - The invited user's own path: accept, set password, land in the
     workspace with what the inviter shared.

Also to design:

- Empty states for Messages, RFQs, Orders and Saved that sell the feature
  (must-stay: "almost every user will see these").
- Suspended account, not found, generic error, signed-out session.
- Password reset, both ends.

**The supplier flow (separate track, same system):** "For suppliers" page,
then claim your profile (search your company), then verify (company email
domain or a document), then pending, then approved, then edit profile, then
answer RFQs. Today this lives in the old shell; design it in v4 now, build it
when the founder says the supplier portal is next.

**Data the flow needs.** Map every answer to an existing column first (the
Settings fields "company type", "customer base", the RFQ template). Any new
column (role, markets, required certificates, checklist progress) is a
migration. Write it and dry-run it; it waits for the founder (rule 15).

GATE 4: the whole flow as one Paper page, desktop and phone, plus the list of
data each step writes.

---

## 5. Phase 4: the marketing site (S8) -> GATE 5

Today's pages:

- `/` (home)
- `/discover` (public, contacts locked)
- `/compliance` and `/compliance/[slug]` (guides)
- `/pricing`, `/status`
- `/legal/{privacy,terms,cookies,data-sources,trademarks}`
- `/home-demo`

Must-stay section 4: the site must show the live supplier count, how
verification works, and the source tiers.

References (pull the full sites in S8):

- the chosen product's own marketing site; for Vanta: hero, mega-footer,
  "request a demo" pattern
- Attio's [security section](https://mobbin.com/sites/sections/e084ac8f-73d7-47e5-b1e9-22a7bd938f82)
- 1Password's [security and privacy index](https://mobbin.com/sites/sections/0bbf6616-9d82-44a5-a1ab-bdb39c77b7d2)
- Firecrawl's [plan columns with an Enterprise "Contact sales"](https://mobbin.com/sites/sections/ad916f56-9bd1-4fe7-a9b3-b8eaf824a7c1)
- Dovetail's [free / pro / enterprise pricing](https://mobbin.com/sites/sections/53746604-f99e-44bf-ac03-c8813dee7883)

Clone the section *structure* only. Any badge, logo wall or testimonial in a
reference is replaced by a SourceBD fact, never by an imitation.

**Visual direction: "evidence, in the open."**

- **Same system as the app.** The marketing site is the app's design system
  at editorial scale, not a separate brand.
- **Colour.**
  - Ground: pure white.
  - Ink: near-black.
  - Forest green `#1B5E20`: the one strong colour, spent on calls to action
    and on the thin "trace" lines that link a fact to its source.
  - Greys only for structure.
  - No gradients, no purple, no blobs, no glow.
- **Type.**
  - Very large IBM Plex Sans headlines (tight tracking, at most two lines).
  - Short plain sentences under them.
  - IBM Plex Mono for the "receipt" texture: register numbers, read dates,
    counts.
- **Imagery: the product and the data are the pictures.** No stock photos of
  factories or people, no illustrations, no mascots.
  1. **The receipt.** One real fact drawn as a receipt: "Aboni Knitwear Ltd ·
     BGMEA member 3498 · checked 24 Jul 2026", traced by a green line to the
     BGMEA mark.
  2. **The Barikoi map of Bangladesh** with real supplier counts by district
     (Dhaka, Gazipur, Narayanganj, Savar, Chattogram). It is the hero visual
     or the methodology visual, captured from real data.
  3. **The source-tier ladder** (government, then industry bodies, then
     certification bodies, then brand lists, then foreign regulators) with
     real logos per `logos.lock.md`.
  4. **Real v4 app screens,** framed plainly (no device mock-ups with fake
     reflections).
- **Proof strip.** Live counts in big numerals with "updated <date>":
  published suppliers, certificates on file, RSC records, sources read in the
  last 30 days.
- **Rhythm.** The home page follows the scroll story below. Every other
  marketing page has a hero (one line, a search box that runs on public
  Discover, Start free and Book a demo), then alternating text and real
  screen sections, then a mega footer. Generous white space; the evidence carries
  the page.
- **Motion.**
  - The home page is a scroll story (below). Every other marketing page keeps
    motion minimal.
  - The `motion` library is allowed only on marketing pages. Respect reduced
    motion.
  - No count-up animations on the live numbers; they must read as facts, not
    effects. Stat rows reveal one after another instead.

**Proof without fakes.** SourceBD has no customer logos, testimonials or
security certifications (PRODUCT.md). Enterprise trust comes from the data
itself:

- live counts from production (published suppliers, certificates on file,
  RSC records, sources read in the last 30 days);
- the named registers with their logos per `logos.lock.md`;
- a real record shown as a receipt (`aboni-knitwear`);
- the methodology in the open;
- a security page that states only what is true.

**Home page scroll story: "Know who you're buying from" (founder, 3 Oct).**

**Inspired, not cloned (founder, 3 Oct).** The founder showed the
[United Carriers](https://unitedcarriers.com/) home page (Awwwards Site of
the Day, 6 Sep 2026) as the quality bar. Take only its craft:

- one idea per screen;
- scenes that stay pinned while the scroll drives them;
- one object carried through the whole page;
- stats set as plain facts, split by thin rules;
- big, calm type with plenty of white space.

Take nothing else: not its globe, dark hero, two-tone headline, machinery
scene, fonts, colours, structure or words.

**The spine is SourceBD's own.** It follows the questions a sourcing or
compliance manager asks about a new factory, in the order they ask them.

- Each chapter opens with that question as a small Plex Mono label. Under it
  sits the answer as the headline.
- The object carried through the page is **one supplier record**. It starts
  as a dot on a map and gains a row in every chapter. At the end it is
  complete and an RFQ has gone out.
- Use one real factory (`aboni-knitwear`) all the way through.

Nine chapters, then the FAQ and the footer:

1. **Opening.**
   - **Picture.** Bangladesh, drawn only from real factory dots: one dot per
     geocoded published supplier, from the geocode cache. There is no
     outline, no tiles and no photo.
   - **Words.** The headline is "Know who you're buying from." One sentence
     follows, with the live count ("10,266 Bangladesh garment suppliers, each
     checked against the registers that list them"). Then the public search
     box, Start free and Book a demo.
   - **Scroll.** The dots gather into district clusters with real counts
     (Dhaka, Gazipur, Narayanganj, Savar, Chattogram). Then one dot lifts out
     and becomes the record card.
2. **"Who are they?"** One factory, one name.
   - **Picture.** The factory's name shows the way each register writes it,
     using real strings from its own sources. As you scroll, the strings slide
     together into one name.
   - **Words.** "One factory, written N ways across N registers. We match
     them, so you see one record."
   - This is the only place variants ever appear: as the "before", and they
     vanish. If the founder would rather show none (rule `RC-09`), use the
     register marks converging instead.
3. **"Is that true?"** Every claim, next to where it is written.
   - **Picture.** Each beat sets a claim in the supplier's words (grey, in
     quotes) against a receipt in Plex Mono: source mark, number, read date.
     A green line joins the two.
   - **Beats.** BGMEA membership, the OEKO-TEX certificate (number and
     expiry), the RSC record.
   - Each beat adds a row to the record.
4. **"Where are they?"**
   - **Picture.** The Barikoi map (`bkoi-gl`) flies to the factory: one pin
     and the address once, with the satellite/street switch.
   - This chapter adds the Location row.
5. **"Who do they ship to?"** (v2, Volza.)
   - **Picture.** A bill of lading prints line by line: shipper, buyer, HS
     code and product, port of loading, port of discharge, FOB value, date.
     Then twelve months of the factory's shipments appear: shipments per
     month, destination ports, HS codes shipped.
   - **Words.** Benefits in buyer words:
     - see which brands it already ships to;
     - check it really makes what it claims;
     - know the FOB going rate before you negotiate;
     - spot a factory that has stopped shipping.
   - This chapter adds the Shipments row.
6. **"Will it still be true next month?"**
   - **Picture.** A calendar strip runs forward as you scroll. On day 0 the
     factory is shortlisted. On day 45 an alert says "OEKO-TEX expires in 30
     days". Later, the Entity List is re-checked.
   - Show only checks the product really runs, worded as the voice guide says.
   - The record gains the watch mark.
7. **"Can they make my order?"**
   - **Picture.** Real v4 screens. The record joins a shortlist, an RFQ goes
     out to several factories, and the quotes come back side by side.
   - **Words.** Two tabs show the same loop through each role's eyes:
     Sourcing and Compliance.
8. **"Why should I trust you?"**
   - **What we never do:**
     - no scores;
     - no paid placement;
     - no fact without a source and a date.
   - The source ladder, tier by tier, with real marks per `logos.lock.md`,
     linking to `/methodology`.
   - The live stats as facts, with "updated <date>" and no count-up:
     published suppliers, certificates on file, registers read, districts
     mapped.
9. **Close.**
   - The record is now complete: every row we built, one RFQ sent.
   - **Words.** "Now you know who you're buying from." Then the search box,
     Start free and Book a demo.
   - Then the FAQ and the mega footer. The compliance guides live in the
     footer and under Resources, not as a home chapter.

Craft rules:

- **Type.** As above:
  - very large Plex Sans headlines in sentence case, at most two lines;
  - Plex Mono for the question labels and the receipts;
  - Plex Sans for body text.
- **Colour.** As above. A white page all the way down, ink near-black, forest
  green only on actions and trace lines.
- **Build.** Add no new packages:
  - `motion` (`useScroll` / `useTransform`) with CSS `position: sticky` for
    the pinned chapters;
  - the dot map on a canvas or SVG from cached coordinates;
  - `bkoi-gl` for chapter 4.
- **Performance.** One canvas live at a time. The map loads only when near.
- **Reduced motion and phone.** Every pinned chapter becomes a short stack of
  still cards.
- **Paper (S8).** Draw every chapter at 1440 and 390. Draw each pinned chapter
  as a row of 3–5 frames, one per beat, so the founder can read the story
  without code.

Shipment records: rules before they appear anywhere:

- **No fake data.** Until v2 is live, chapter 5 carries "Coming in v2" and no
  number runs anywhere.
- **Only per-supplier examples.** REZ-G (on-demand shipment records) fetches
  Volza per supplier, on a buyer's click, cached 90 days. So there is no
  "N shipments on record" total. The page shows one real record, captured
  once with the founder's approval, unless bulk data is bought.
- **Buyer names stay off the marketing site.** There they read "a UK
  high-street retailer". Real names appear in the app only, and only if
  Volza's licence allows showing them. Check the licence before S8.
- **Decide the tier first.** Settle the trust tier of a bill of lading bought
  through a reseller (AGENTS rule 5) before any page calls it proof. It must
  never overwrite register data.

**Site map v4 (desktop and phone for each):**

| Page | Job | Key sections |
| --- | --- | --- |
| Home `/` | Convince a sourcing or compliance lead in one scroll | The nine chapters of "Know who you're buying from" above: the dot map of Bangladesh with search and live count, then Who are they?, Is that true?, Where are they?, Who do they ship to? (v2), Will it still be true next month?, Can they make my order?, Why should I trust you?, and the close (Start free · Book a demo), then FAQ and mega footer |
| Product: Supplier search `/product/search` | Show the list and record | Filters that matter (HS, certificate, place, size), record beside results, real counts |
| Product: Supplier records `/product/records` | Show receipts | Fact rows with sources, certificate states, RSC, locked contacts explained |
| Product: RFQs and messages `/product/rfqs` | Show the sourcing loop | RFQ to up to 50, quote comparison, messages |
| Product: Compliance `/product/compliance` | Show the watch | Expiry watch, UFLPA screening (what is checked, list version, date), MSA statement (only after `T-01` ships) |
| Solutions: Sourcing teams / Compliance teams | Speak each role's language | Their jobs, their screens, their outcome |
| Data & methodology `/methodology` | Enterprise trust | All 25 sources by tier, what each provides, refresh cadence, how matching works, corrections process, "listed, no records yet", what SourceBD never does (no scores). Absorbs `/legal/data-sources` content |
| Compliance guides `/compliance/*` | Search traffic, education | UFLPA, UK MSA s54, EU CSDDD, German LkSG, Canada S-211; each with a dated "last reviewed" and sources |
| Pricing `/pricing` | Clarity | Plans as they really are (Beta / Growth / Enterprise per the founder), comparison table, usage limits, FAQ, Contact sales. No invented prices (founder decision D-6) |
| Security `/security` | Pass the first security question | Hosting and region, encryption, access control, row-level security, backups, sub-processors, GDPR, DPA on request, contact. No badges unless real |
| For suppliers `/suppliers` | Claim path | Why claim, what you can edit, verification, then the claim flow |
| About and Contact sales `/about`, `/contact` | Company and lead capture | Mission, Bangladesh focus; form (name, work email, company, role, markets, annual volume) that emails the founder (no new package) |
| Public supplier page | SEO and conversion | Public record with locked contacts, "Sign up to contact" |
| Status, Legal | Keep | Restyled only |

Global elements:

- Navigation: Product, Solutions, Resources, Pricing, Sign in, Start free,
  Book a demo.
- A mega footer (Product, Data & methodology, Compliance guides, Company,
  Legal, Status).
- Cookie banner: privacy-preserving by default.

GATE 5: every page at 1440 and 390 in Paper.

---

## 6. Phase 5: build in code, then put it live (S9 onward)

**Branching (must-stay section 1: "built on its own branch, one switch at
the end, old and new never run together"):**

- An integration branch `ds-v4` off `development`. Every sub-PR targets
  `ds-v4`, gets one `/code-review`, and auto-merges on green.
- CI today only runs on PRs into `main` and `development`
  (`.github/workflows/ci.yml` lines 4-7). The first sub-PR adds `ds-v4` to
  `pull_request.branches`.
- Keep `ds-v4` current with `development` (ccd `sync_with_base_branch` in a
  worktree, otherwise merge `origin/development` in).
- The switch is one PR `ds-v4` into `development`, then the usual
  `development` into `main` with `--auto --merge`. The founder approves
  Deploy Production.

**Order:**

| PR | Content |
| --- | --- |
| B0 | Tokens: replace `lib/design/tokens.ts`, the Tailwind theme and `app/ds.css` with the v4 tokens from Paper (same names). Load the font with `next/font`. Regenerate the contrast fixture (`lib/design/tokens.test.ts`). Lint rule: no hand-typed colour outside the token file (must-stay section 6) |
| B1 | Kit primitives (a fresh folder, e.g. `components/kit/`), each with its states, rendered in `/dev/ds` |
| B2 | SourceBD patterns (source marks, fact row, certificate row, RSC, sanction banner, locked contact, quote comparison, timeline, chat) |
| B3 | Shell: desktop sidebar, topbar and panes; phone tab bar with the glance-and-act tabs |
| B4-B7 | One PR per Paper flow (S3, S4, S5, S6 order). Pages read the same data as v3: read old components for data and behaviour, never for classes |
| B8 | Onboarding and auth (new routes such as `/welcome/*`). Migrations dry-run only, founder applies |
| B9 | Marketing (`app/(marketing)` rebuilt, new routes from section 5) |
| B10 | Delete the old kit (`components/dashboard/*` primitives, `components/ui/*` as their last importer goes) |

**Every PR:**

- Run only its own test file locally; CI runs the rest.
- Before pushing a markup change, grep `*.test.ts` for the old markup (it
  has turned CI red twice).
- A boundary test for anything a buyer observes. Rendered values count,
  e.g. "a number is never rendered without its label" on the list rows.

**Proof against the design:**

- Shoot the built pages with the static harness (`build-ent.cjs`, desktop)
  and the phone harness (`build-mobile.cjs`, `touch-check.cjs`). Recipes are
  in the founder's memory notes.
- Import them into the v4 file's `90 Built` page with the paper-import kit
  (`.impeccable/preview/paper-import/`, `PHONE=1` for phone), beside the
  design.
- Attach both to the PR. The local dev server is unusable (11-minute
  compiles), so don't try it.

Before the switch PR, every check in must-stay section 6:

- typecheck and tests green;
- no hand-typed colours;
- every page at 320 and 1280;
- contrast on every pair;
- 100- and 125-character names;
- 1 and 11 sources;
- 54 codes and 39 products;
- the sanctioned sample state;
- `ar-fashion` everywhere.

Then `/impeccable critique` on the built phone and desktop screens. The bar
is in section 7.

---

## 7. The bar (measured, not felt)

| Measure | v3 today (3 Oct) | v4 target |
| --- | --- | --- |
| Heuristic score, phone | 15/40 | 30+/40 |
| Heuristic score, desktop | 17/40 | 30+/40 |
| Phone controls under 44px | 675 of 1,102 | 0 |
| Desktop click targets under 24px | 364 of 2,161 (15 fail WCAG 2.5.8) | 0 |
| Text under 12px | 169 nodes (phone), 392 (desktop) | 0 |
| First 900px with no content, list screens (desktop) | 85–95% on 12 screens | under 50% |
| Prose line length (desktop) | up to 161 characters | 72 or fewer |
| UI sentences over 15 words; strings from the W list | many (register W) | 0 |
| Addresses per premises on the record | 2 places plus spelling variants | 1 |
| Distinct text sizes | 11 (phone) | the type ramp only |
| Numbers without a label in lists | every list | 0 |
| Supplier record to first certificate (phone) | 2.6 screens | 1 screen (summary) |
| Results per 1440x900 screen (table) | about 10 | 15+ at 40px rows |
| Facts with their source in words | icon only, legend 1,200px away | every fact |
| States drawn: sanctioned, error, loading, empty | missing on phone | all, per flow |
| Back patterns | 5 | 1 per platform |

---

## 8. Session plan

| Session | Phase | Output | Gate |
| --- | --- | --- | --- |
| S0 | Words (beside S1) | `voice-v4.md`, copy inventory, 20 before/afters | GATE 0 |
| S1 | Research and spec | `ds-v4-spec.md`, `00 Reference` board, archived old design files | GATE 1 |
| S2 | DS in Paper | `01`-`03` pages, new `DESIGN.md` | GATE 2 |
| S3-S6 | App flows in Paper | `10`/`11` pages per flow, parity tables, critique scores | GATE 3 x4 |
| S7 | Onboarding in Paper | `20 Onboarding`, data map | GATE 4 |
| S8 | Marketing in Paper | `30`/`31` pages | GATE 5 |
| S9+ | Build B0-B10 | PRs into `ds-v4`, then the switch | Deploy approval |

Each session ends by updating `context/current-state.md` with one line and
this hand-off's progress block (section 10). Do not start the next phase
before its gate is passed.

---

## 9. Founder decisions (recommended default first)

- **D-1 Reference product:** Vanta (recommended), or another from the S1
  shortlist. GATE 1.
- **D-2 Type family:** IBM Plex Sans with IBM Plex Mono (recommended), or
  Inter with JetBrains Mono. GATE 1.
- **D-3 Phone tabs:** Messages · Quotes · Alerts · Saved · Search
  (recommended), or keep today's five. GATE 2.
- **D-4 Enterprise features in scope for design:** roles and invites, 2FA and
  sessions, audit log, CSV/PDF evidence export (all recommended for design
  now; building each is its own spec). Register section E.
- **D-5 Sign-in options:** email and password plus magic link (recommended);
  add Google/Microsoft later.
- **D-6 Pricing page:** show "Free during beta" plus "Enterprise: talk to us"
  until real prices exist (recommended). No invented numbers.
- **D-7 Card view on results:** drop it on phone, keep a compact version on
  desktop only if S3 can prove it earns its place (recommended).

---

## 9b. Overnight run: Paper only (founder, 3 Oct)

The founder wants phases 0 to 4 (S0 to S8) done unattended overnight, **on
Paper only**:

- No app code changes and nothing near production. Phase 5 waits until the
  founder has seen the Paper work.
- The lead session orchestrates; each step runs as a sub-agent with fresh
  context.

**Founder gates overnight.** The founder pre-approves taking the recommended
default at GATE 0 to GATE 5 and at D-1 to D-7. Each decision is logged with
its reason in `context/feature-specs/ds-v4-progress.md`, and its screenshots
go to the founder with `SendUserFile` (status `proactive`). Anything
irreversible is out of scope.

**Never overnight:**
- edit `app/`, `components/`, `lib/`, `supabase/`, `etl/`, `ops/`,
  `.github/`, `DESIGN.md` or `.impeccable/design.json`;
- run migrations, `--apply`, deploys or promotions;
- write to the old Paper file "SourceBD";
- call `get_screenshot` on the old pages;
- run `impeccable context` (it prints the old `DESIGN.md`).

Read `PRODUCT.md` directly instead. The new system is written to
`context/feature-specs/ds-v4/DESIGN-v4.md`. `DESIGN.md` is swapped only in
Phase 5, so sessions still working on today's app keep their context.

**Order and parallelism.**
1. S0 and S1 run in parallel.
2. Then S2.
3. Then S3, S4, S5 and S6, at most three at a time, each on its own Paper
   pages.
4. Then S7 and S8 in parallel.
5. Then one bounded quality round:
   - `/impeccable critique` on the v4 desktop and phone pages;
   - fix what it finds once;
   - re-score once.
6. Then the morning report.

**Real data.** Use these, all real records captured from production:
- `lib/dashboard/fixtures.production.json`;
- `lib/dashboard/gallery-data.ts`;
- the must-stay section 3 records.

Read-only SQL through the Supabase MCP is allowed for live counts (rule 15:
reading production is safe). Never write.

**Repository output.** Docs only, on branch `ds-v4-paper`:
- `voice-v4.md`, `ds-v4-spec.md`, `ds-v4/DESIGN-v4.md`;
- the copy inventory;
- the progress file.

Open one PR to `development` with `--auto --squash`. Docs on `development`
change nothing a buyer sees; deploys happen only from `main` with the
founder's approval.

**Resumable.**
- On start, read `ds-v4-progress.md` and continue from the first unfinished
  step.
- A step is finished only when its outputs exist and its gate entry is
  logged.
- If Paper or Mobbin is unreachable after three tries, log it, skip to the
  next step that does not need it, and report it in the morning.

**Morning report** (plain words, five lines in chat):
- what got done;
- the decisions taken;
- the scores before and after;
- what's left.

Attach a combined PDF of the v4 Paper pages (`export_combined_pdf`) and the
progress file.

---

## 10. Progress (each session appends one line)

- 3 Oct 2026:
  - Hand-off and register written.
  - Phone critique scored 15/40; desktop critique 17/40.
  - `T-01` and `T-02` started as separate sessions.
  - Founder added the address rule (`RC-09`) and the words pass (S0).
  - Founder asked for a scroll story on the home page as good as United
    Carriers', inspired by it rather than cloned, with Volza shipment records
    in v2. It is written up as "Know who you're buying from" in section 5.
