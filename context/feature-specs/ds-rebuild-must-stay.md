# Design rebuild — the "must stay" list

Status: build started 18 Sep 2026 on branch `design-rebuild` (founder go-ahead). Tokens + gallery at `/dev/ds` built; direction locked 18 Sep (section 9); no page rebuilds yet.
Written from product rules and the live database only. No old design file was opened for this list.
Rebuilt 18 Sep 2026 with the production database connected. Every number in section 3 was counted on production that day (read-only). The first draft was written without database access and several of its sizes were wrong — section 8 lists what changed.

## 1. Rules of the rebuild

- The old design is deleted, not adapted. Nothing from it is kept "because it worked".
- The builder may not open: `app/globals.css`, `tailwind.config.ts`, `components/ui/*`, `context/frontend-design-spec.md`, `context/design-brief-phase1.md`, `ops/design-mockups/`, `ops/visual/`.
- Those files move to `context/archive/` on day one of the build so nobody reads them by accident. Done 18 Sep: all are under `context/archive/old-design/` except `components/ui/*`, which 138 files still import — each piece moves out as the last page using it is rebuilt. The new `tailwind.config.ts`, `app/ds.css` and `lib/design/tokens.ts` are the rebuild's own files and are open to the builder.
- Built on its own branch. One switch at the end. Old and new never run together.
- Every page on all four surfaces is rebuilt. No page keeps old styling.
- One spec. Clean working tree at start. Founder approves each gate.

## 2. Fixed by the product (never changes)

- Buyers see receipts, not opinions. Cert badges, register numbers, remediation %, named sources. Never a SourceBD score, grade, rating, or star.
- Admin is the only place the internal score may appear.
- A sanctioned supplier shows a red warning on every surface. That warning cannot be hidden by layout.
- Contact details (email, phone, contact name, role) are hidden unless the server allows them. The design must have a proper "locked" state, not a blur trick.
- Every fact can show where it came from. Each field needs room for a small source mark and a link.
- Sources have a rank: government first, then industry bodies, then cert bodies, then brand lists, then foreign regulators. The design must make that rank visible at a glance.
- No SourceBD trademark on third-party marks. Their logos stay as they are (`context/logos.lock.md` still applies).
- Nothing fake. Demos and animations use real records or nothing.
- No new packages. Allowed: Tailwind, shadcn/Radix pieces, Phosphor icons, the `motion` library (marketing and login pages only). Everything else is plain CSS or React.
- Tailwind classes only. No hand-typed colours anywhere except one token file.
- Works without animation when the user's device asks for that.

## 3. Real-world facts that set the sizes

Counted on production, 18 Sep 2026.

### Companies and names
- 10,922 companies. 10,266 are published, 656 are not. Lists must scroll and page well.
- 8,920 factories, 1,459 buying houses, 543 of unknown type. "Unknown type" needs its own quiet label.
- Company names: median 22 characters, nine in ten are 33 or under, 99 in 100 are 47 or under. 171 names run past 44, 28 past 60.
- Longest name: 125 characters (not published, so admin lists only). Longest a buyer can see: 100 characters. Test cards and headers with both.
- About 1,630 names carry brackets, "Unit", or "Extension" — often the only thing telling two sister factories apart. Wrap, never cut these off.
- Only one name per company is in use today. No separate short display name exists to fall back on.

### Sources
- 25 named sources across five tiers: 5 government, 4 industry bodies, 4 cert bodies, 6 brand lists, 6 foreign regulators.
- 14 of them hold live records today. Silent so far: DIFE, RJSC, BEPZA, Inditex, Primark, and all six foreign regulators. The source list page needs a "listed, no records yet" state.
- Sources per company: two in three companies have exactly one. Nine in ten have three or fewer. 122 have seven or more. The most is 11.
- So a row of source marks must look right with one mark (the usual case) and still hold 11 without breaking.
- Register and membership marks per company (BGMEA, BKMEA, BGAPMEA, BTMA, EPB and so on): 8,175 have one, 939 have two, 52 have three or four, 1,756 have none.
- Biggest sources by companies covered: BGMEA 5,754 · BKMEA 2,578 · OEKO-TEX 2,479 · EPB 2,472 · RSC 2,245 · BGAPMEA 1,080 · GOTS 878.

### Profile facts — how often each one is filled
- Workers, total: 59% of companies. Male: 30%. Female: 29%. The split is missing far more often than the total. Largest figure on file is six digits (170,357).
- Machines: 50%. Year established: 40%. Daily capacity: 15%. Website: 17%. Group name: 12%.
- Product list: 58%. Longest list is 39 items; 44 companies have 20 or more.
- Export product codes (HS codes, from EPB): 2,456 companies. Median 17 codes each, one in ten has 34 or more, the most is 54. This needs a "show first few, expand" pattern.
- Email on file: 81%. Phone on file: 79%. So the locked contact state is what most visitors see on most cards — design it as a first-class state.
- Only 8 published companies have none of the main facts at all. "Nothing at all" is rare; "half the fields missing" is normal. Design the per-field empty state first.

### Certifications
- 4,275 certificates on 2,761 companies. Four kinds: OEKO-TEX 2,923 · GOTS 911 · WRAP 434 · SA8000 7. Up to 9 on one company.
- Every certificate has an issuer and a number. 4,084 have a document link.
- Only 1,352 have an expiry date: 893 valid, 459 expired, 353 of the valid ones expire within 90 days. The other 2,923 have no expiry on file — a third state, "no expiry date on file", is the most common one.
- Issue date exists on 7 certificates. Do not design a slot that assumes it.
- Scope text can run to 422 characters. Issuer names up to 66.

### Facilities (mother company with several buildings)
- 476 mother companies hold 598 buildings. The most on one mother is 5.
- Buildings are never published on their own; they only appear inside the mother's profile.

### RSC safety data
- 2,245 companies, one RSC record each. 1,613 are active with RSC, 632 are not — "no longer covered" needs its own look.
- One percentage only: progress %. Present on every record. (The first draft listed two percentages; there is one.)
- Training status on every record: completed 1,010 · yet to start 852 · ongoing 382 · unknown 1.
- Remediation status is five real states (behind schedule, initial plan completed, not implemented, on track, not finalised) stored under nine spellings, plus 97 blank. The design shows five labels and a blank state; the clean-up is data work, not design work.
- Five links, not four: structural 2,021 · fire 2,021 · electrical 2,031 · boiler 1,124 · corrective action plan 2,073. Only 1,086 records have all four inspection links — a missing boiler link is normal.
- Saved copies of those reports: 8,106 files on 1,578 companies, up to 10 on one company.

### Addresses and maps
- About 9,250 companies have at least one address. About half of those have two or more; one in ten has three or more; the most is 10. (Approximate — counted by matching address text.)
- Address text: median 48 characters, nine in ten under 73, longest 978. Must wrap cleanly.
- 17,973 map pins stored. Every pin has a confidence figure from 0 to 100, median 70. That figure is the only usable "how exact is this pin" signal — the separate address-status field says "incomplete" on every row and must not drive the design.
- Each address carries a kind: factory, registered office, mailing, other.

### Evidence ("where this came from")
- 72,796 field-level citations on 4,179 companies, across 49 kinds of field.
- Their states today: current 47,330 · replaced by a newer value 21,589 · stale 2,808 · orphaned 861 · contradicted 208.
- Source pages behind them: 5,531 still live and unchanged, 915 changed since we read them.

### Sanctions
- No company is flagged as sanctioned today. Three past screening hits exist; all three were closed as not a match.
- So there is no real record to test the red warning with. See question 5.

### People using the product today
- 38 accounts: 25 buyers, 12 suppliers, 1 admin. 36 saved suppliers, 7 message threads, 7 RFQs, 0 quotes, 0 orders, 0 partner links, 3 profile claims (all waiting on email confirmation).
- For Messages, RFQs, Orders and Partners the empty state is the state almost every user will see at launch. It must sell the feature, not apologise for it.
- Admin: 1,394 review tickets (48 open), 1,435 audit-log entries. Admin tables must page.

### Screens
- Phones from 320px wide up. Test at 320, 360, 390, 414, 430.
- Readable for everyone: text contrast passes the standard check. Keyboard works everywhere.

### Real records to test with
All real, all on production. Use these in the gallery and in screenshots; never invent one.
- Ordinary name (22 characters): whichever the gallery already uses from the measured median.
- Longest name a buyer sees (100): `zaheen-knitwear-limited-shed-3-4-5-10-11-12-13-and-building-security-etp-and-fire-pump`
- Longest name of all (125, admin only): `indochine-apparel-bangladesh-limited-plot-54-56-previously-baxter-brenton-bd-clothing-manufacturing-co-ltd-extension`
- Most sources (11): `aboni-knitwear`. Many sources plus 6 certificates: `sm-knitwear`.
- Longest product list (39): `adventure-garments`.
- Most buildings (5): `liberty-knitwear`.
- Almost no data: `ar-fashion`.

## 4. What each surface must hold

### Marketing (no login)
Home, Discover (public, contacts locked), Compliance guides, Pricing, Status, Legal pages (privacy, terms, cookies, data sources, trademarks).
Must show: live supplier count, how verification works, the source tiers.

### Buyer app
Dashboard, Smart Match (3-step wizard with "why matched"), Discover with filters, Supplier profile, Saved, Messages, RFQs, Orders, Compliance Hub (expiry, MSA, UFLPA), Settings (profile, plan, notifications).
Profile tabs: Overview, Compliance, Capacity, Brands, Contact, Provenance, Locations, Facilities.

### Supplier portal
Dashboard, Claim profile (search, verify, status), Edit profile, Documents, Messages, RFQs, Partners.

### Admin
Dashboard, Suppliers (list, edit, import), Users, Claims, Certifications queue, Evidence queue, Review queue, Sanctions queue, Sources, Audit log, Beta, Feedback.
Admin is the only surface that may show the internal score and tier labels.

Shared: login, signup, forgot/reset password, suspended, not found, error.

## 5. States every piece must have

- Empty (no data yet) — the normal case per field, see section 3.
- Locked (needs plan or login) — the normal case for contact details.
- Loading.
- Error.
- Sanctioned (red, cannot be missed).
- For facts: current, stale, contradicted, and "the source page has changed since we read it". (The first draft said unverified / verified / contradicted; the database's real states are these.)
- For certs: valid, expiring soon (within 90 days), expired, and no expiry date on file.
- For sources: has records, and listed with no records yet.
- For RSC: active, and no longer covered.
- For map pins: exact, and approximate (low confidence).
- For companies: factory, buying house, unknown type.

## 6. Checks before the switch

- Typecheck clean. All tests pass.
- No hand-typed colour outside the token file. A lint rule enforces this.
- Every page screenshot at 320 and 1280.
- Contrast check on every text colour pair.
- The 100-character and 125-character real names on every card type they can reach.
- The 11-source company and a one-source company on every place source marks appear.
- The 54-code and 39-product lists on the profile.
- A sanctioned supplier on every surface — blocked on question 5.
- `ar-fashion` (almost no data) on every surface.

## 7. Questions for you

1. Dark mode: yes, no, or later? — **Later** (18 Sep). Tokens are named by job so a dark set drops in.
2. Fonts: one family or two? Any you want or refuse? — **Answered 18 Sep: one family, Inter.** Locked in section 9.
3. Do the third-party source logos stay as images, or become text marks?
4. Do public Discover cards show product icons, or text only?
5. No company is sanctioned today, and the rules say nothing fake. How do we test the red warning? Options: a clearly labelled "sample" state that exists only in the `/dev/ds` gallery, or wait for a real one. The builder will not invent a sanctioned company.
6. Certificates are never marked as checked by an admin today (0 of 4,275). Should the design carry a "checked by SourceBD" mark at all, or leave it out until the checking starts?

## 8. What changed from the first draft (written without database access)

- Name length: median is 22, not 34. One in ten is over 33, not 44. Longest stays 125, but the longest a buyer sees is 100.
- Sources: 25 named, 14 with records — not 17.
- Source marks in a row: usually 1, up to 11 — not "about 8".
- Products: longest list 39. Added HS codes (up to 54), which the first draft missed.
- Certificates: issue date is almost never there; expiry is missing on two in three. The first draft assumed both were always present.
- RSC: one percentage, five links. The first draft said two percentages, four links.
- Buildings per mother: at most 5 today.
- Workers: the total is there 59% of the time, the male/female split only 30%.
- Sanctions: none flagged today — added as a test problem.
- Added: evidence states, map-pin confidence, product usage numbers, a named set of real test records.

## 9. Locked direction (18 Sep 2026)

Reference-led, chosen on Mobbin. We take the pattern from each reference — layout, density, type scale, spacing, how colour is spent — never its logo, colours or illustrations.

### References, by product name
- Shell (app frame): **Vanta** — controls page. Left sidebar, a summary strip, a filter bar, then one dense table with a source column.
- Directory (Discover, admin lists): **Zendesk Reach** — company prospecting list. Compact rows, facts inline under the name, filters in a collapsible right rail, built for millions of rows.
- Profile: **Attio** — company record. Header with tabs, a label/value facts panel where every row has room for a source mark and a link.
- Tone: **Midday** — invoices. Hairline dividers, near-monochrome, colour only where it means something.
- Steps 2–6 (piece-level picks, phone, marketing, direction board, drawn drafts) were not recorded in this repository. Section 9 locks what was chosen in step 1 and what the tokens now encode. If picks for those steps exist elsewhere, add them under this heading; do not re-open the choices above.

### Type
- One family: **Inter** (Q2 answered). Loaded once in `app/layout.tsx` as `--font-sans`; tabular figures on every number.
- Scale (px / line): 12/16 captions and source marks · 13/20 table cells and labels · 14/22 app body · 16/26 marketing body · 18/28 · 20/28 · 24/32 · 30/38 · 36/44 · 48/56 · 60/64. Tracking tightens from 20 up (−0.005em to −0.03em).
- Weights: 400 body, 500 labels and links, 600 headings and company names, 700 only for the page title and key figures.
- Company names wrap at every size. Nothing truncates a name (§3).

### Colour roles (hex · contrast on white unless stated)
- Brand green **#1B5E20**, fixed. White on it 7.87:1. Hover #164D1A (9.95:1), pressed #103A13 (12.83:1). Tint #E9F3EA and tint-strong #D3E7D5 carry brand ink #1B5E20 at 6.92:1 and 6.06:1. Line #A7CFAB (decorative only, not a text or control edge).
- Brand green is spent on: primary button, link text, the active nav mark, the logo. It is never a badge fill, never a state colour, so it cannot be read as "verified".
- Focus ring #2E7D32: 5.13:1 on surface, 4.78:1 on canvas.
- Ink: strong #12171D (18.01:1) · body #2A323B (12.98:1) · muted #4A5561 (7.60:1) · subtle #5F6B78 (4.80:1 on the sunken panel, its worst case) · disabled #8D99A6 (exempt).
- Surfaces: canvas #F6F7F9 · surface #FFFFFF · sunken #EEF1F4 · inverse #12171D. Lines: subtle #E6EAEE · default #D5DBE2 · strong #7F8B98 (3.47:1, control outlines).
- Positive (verified, valid) #0F7A45 solid / ink #0B5F36 on tint #E7F6EC. Caution (contradicted, expiring, expired) #A85604 / #7A4300 on #FFF4E0. Danger (system errors) #D92D20 / #B42318 on #FEF3F2. Quiet (unverified, empty) ink #4A5561 on #F6F7F9. Locked ink #4A5561 on #EEF1F4 with #DDE3E9 stripe.
- Sanction red **#8F1711**, reserved: 9.14:1 both ways, held to 7:1 in the test. No other role may reuse it.
- Source rank is a neutral lightness ramp on the ink scale, tier 1 darkest: #12171D · #2A323B · #4A5561 · #DDE3E9 (ink on it 13.93:1) · white with a #7F8B98 outline. It reads without a legend and leaves colour free for status.
- Every pair above is in `contrastPairs` in `lib/design/tokens.ts`; `pnpm test` fails if one drops below its minimum.

### Spacing
- 4px grid. Card padding 16. Panel (profile section) padding 20. Page gutter 24 at 1024px and up, 16 below. Sidebar 232. Content max width 1200; prose max 68ch.
- Facts panel: label/value rows 28 high, label in muted 13px, value in body 14px, source mark 12px at the row end.

### Radius
- 5px on controls, badges, cards and table containers' inner rows · 6px on panels and tables · 8px on dialogs and toasts · 3px on skeleton bars · full on avatars and count pills. 12px is not used inside the app.

### Density
- Tables: 36px rows for admin and the directory (13px text), 44px for buyer-facing lists. Header row 13px muted, sticky. Paging control on every table; page size shown as "1–25 of 10,266".
- Controls: 32px inputs, filters and secondary buttons; 40px primary buttons and marketing forms.
- Dividers are hairlines (`line-subtle`); no shadows on rows or cards in lists. Shadow only lifts overlays (md) and dialogs (lg).
- Supplier card: name (14/600, wraps), type label, then one line of facts, then the source-mark row (1 to 11 marks, wraps), then the contact block in its locked state by default.

### Values the code carries
- Colours: `lib/design/tokens.ts` (`light`). Density stops: `density` in the same file. Type, radius, shadow, timing: same file. The gallery at `/dev/ds` renders all of it, including this section's numbers.
