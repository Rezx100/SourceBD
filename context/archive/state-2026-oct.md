> ARCHIVE — closeout detail moved out of `context/current-state.md` from 8 Oct 2026 on. Read a named section only when a specific historical decision or regression requires it. Not maintained.

# SourceBD - state archive, October 2026

## Six-screen critique fixes, round one (8 Oct 2026)

- **Six-screen critique fixes (8 Oct)** — the nine PRs of `.impeccable/handoff-critique-fixes.md` landed on `development` (#386–#394): one receipt per fact, green spent on the primary action and the logo only, the composer silent until Send, one certificate cell, one word for nothing on file, the landing without skeletons, the rail's mono pills and account row, the pane following the arrows, the small tidy. Re-critique against 24/40 next.

## Six-screen critique fixes, round two (8 Oct 2026)

- **Six-screen critique, round two (8 Oct)** — the seven PRs of `.impeccable/handoff-critique-round-2.md` landed on `development` (#395–#401): Send talks when a field is empty, every in-shell door opens the composer beside its list, expired is amber, the One-Line Name Rule in both tables and the pane list, the record says its sources once, a glossary with `Define` and a shortcuts sheet, the minors. Re-critique 31/40 (`.impeccable/critique/` latest `app-app-app`), up from 27: P0 the full record page's Send RFQ still loses the search; P1 the pane list has no tick, keys or bulk bar; P1 a fifty-supplier send has no confirmation. Round one and the pre-September entries are in `archive/state-2026-oct.md`.

## Entries older than September 2026, moved out of "In progress" on 8 Oct 2026

- Address premises merge (PR #159) and EPB evidence + HS codes (0103, applied 15 Aug): done; detail in `archive/state-2026-sep.md`.
- **REZ-73 — Facilities section + labelled group figures on mother profiles**,
  on branch `rez-73-facilities-lean`. Lean rewrite: migration `0097_` + thin
  UI; SQL owns the roll-up; under 400 product lines.

## Buyer phone redesign from Paper pages 35 and 36 (11 Oct 2026)

Two PRs into `development`, phone only (from 768 px every page draws as before), no migration.

- **Part 1, branch `phone-redesign-1`**: search landing, results, filters sheet, saved suppliers, saved searches, save-search sheet, alerts, the compliance hub, the statement drafter, UFLPA checks, the supplier record as tabs (Paper page 35, 15 states) and the export line. Speed: the sign-in check reads the session token on the server (`lib/supabase/session-user.ts`, falls back to Auth), no page fade, pressed states, analytics and the feedback form loaded on demand, the map loaded when near view, prefetch on phone rows whose target has a skeleton. CI: the 25-minute address fixture runs in its own job, `unit-tests-slow`.
- **Part 2, PR #474**: RFQs, orders, messages, products, HS codes, the account page, every settings page; `orders/new` and `rfqs/new` read side by side.
- **Tools**: `plugins/paper-to-app` (pull, convert, pixel-check a Paper board).
- **Facts kept against the boards**: the UFLPA list was read 8 Oct (the date comes from `sanctions_lists_read()`); customs figures are per supplier and per market, never per HS code; "no customs records" claims no lookup.
- **Founder steps**: add `unit-tests-slow` as a required check (`docs/ENTERPRISE_DEPLOYMENT.md`); confirm the ES256 signing key is "current" in Supabase; approve Deploy Production.
- **Left as found by the one review pass**: reads only a phone draws also run from 768 (filters sheet, expiry, statement, settings list); the record renders both drawings; a team row on a phone no longer prints the email.

## Phone fixes from the founder's live review (12 Oct 2026)

Ten notes on the live phone site, one PR (`phone-fixes-1`), phone only, no migration.

- **Record**: the name shares the bar's row with Share and Close (the bar has no ground until the name leaves it); every section is on the one page and the strip follows the scroll (`phone-tabs.tsx`, the desktop's `sectionInView`); the strip cannot move up or down (its hairline is the box's); the amber "records end" notice is gone from Exports (the footnote stays); customs buyers are pills in Exports only; a certificate card is scheme, state, date, number, issuer (no scope text); the drawer a narrow window gets says the name.
- **Search**: the results start at the field (the frame's title bar is hidden over `data-own-top`); a row says its worst certificate in words, not marks; a suggested company opens the record page with the way back.
- **"Your RFQs didn't load"**: the phone no longer draws it. Cause: migration 0126 (claimed-supplier policies) was never applied to production, so every direct read of `rfqs` as a buyer fails. Waits for the founder's "apply 0126".
- **Not built**: the month-by-month exports chart on the board. The customs data holds a two-year total and four markets, no monthly figures; drawing it needs a new fetch.

## Phone fixes, round 2 (12 Oct 2026)

Three more notes from the founder once PR #477 was live; branch `phone-fixes-2`, phone only, no migration.

- **Divider**: what parts two sections of the record is a 12px gap of the page's ground between two hairlines, not a solid grey band.
- **Contact** is the last card of the record's scroll, after Products (`PhoneContact` in `phone-record.tsx`). Still the locked card here; the real details for Growth, Enterprise and admins are a separate branch (`contact-reveal`, a new database function that waits for the founder's "apply").
- **HS line page**: cut to the line's own receipts (the EPB exporter page, the certificates whose scope covers it, anything the supplier attests), the supplier's customs total in one card, and the shipments coded to the heading. The desktop's fact list, the three tiles and "By market" are no longer drawn on a phone; they are on the record.
- **Still not built**: the month-by-month exports chart (no monthly figures in the customs data).

## Contact details shown from the Growth plan (12 Oct 2026)

Founder, 12 Oct 2026: "we have decided to show contact details of the suppliers as it's stored on the database from growth plan". Branch `contact-reveal`; migration `0145_supplier_contact_details.sql` built, **not applied**.

- **Who**: an admin, or a buyer on Growth or Enterprise, not suspended; the same gate as the customs records (0137). Everyone else keeps the locked card with the counts. The database decides, in `supplier_contact_details(slug)`; the contact columns stay revoked (0083).
- **Never for a sanctioned supplier**: the function answers nothing for one and the sheet holds the same line, so the record keeps the locked card. SourceBD refuses to send it an RFQ; a mail link would undo that.
- **What**: emails, phone numbers, website, contact person and role from the register columns, cleaned by the rules the counts use (0105), so the card shows as many as the count said. Supplier-entered contact fields (0034) are not part of it.
- **Where**: the full page's Contact box, the same box at the end of the overview in the pane and under 1024, and a phone's Contact section, the last of its scroll (`components/record/contact-card.tsx`, `PhoneContact`). Emails write, numbers dial with the country code, the website opens apart.
- **Recorded in the database**: the function itself writes `contact.revealed` to the activity record (as 0141 writes `shipments.revealed`), so a call made straight to the API is recorded too. One entry per account and supplier in a rolling 24 hours; a re-open inside it writes nothing more. The app writes no reveal of its own. `supplier.viewed` now says `contact_visible` truthfully; until this change the code wrote `true` on every open, though no details were shown, so those older entries overstate.
- **Daily limit**: an account that is not an admin opens the contact details of at most 200 different suppliers in a rolling 24 hours, counted from those entries (no new table); one already opened in the window is free. Past it the function answers `{"limit": 200}` and no value, and both cards stay locked with "You've reached today's limit for contact details. They open again tomorrow." Only entries the function wrote itself count, for the limit and for the free re-open: `ledger_note` (0134) takes `contact.revealed` from any signed-in caller, so the function marks its own (`reason = 'supplier_contact_details'`, which `ledger_note` cannot set) and reads only those. 200 is a starting value in one constant of the function; the founder has not chosen a number. Opening a record is what opens its contact details, so a buyer who opens more than 200 different records in a day meets the limit by browsing.
- **Until 0145 is applied** the read fails soft and every reader sees the locked card. Guards: `supabase/ci/assert-0145.sql` (who gets what, sanctioned, what is written, under the limit, at it, a re-open, and that details agree with the counts), `record.test.ts`, `load-record.test.ts`, `record-routes.test.ts`.

## Phone fixes, round 3: every figure says what it is (12 Oct 2026)

The founder's note on the live Sources section: a date with "108 days ago" under it and nothing saying it was the last read. Branch `phone-labels`, phone only, no migration. The whole phone record, the HS line page and the search rows were rendered and read for a value standing alone; six were found.

- **Sources**: "Last read" over the first date of the list, once, like a table's head (`data-phone-read-head`). The sanctions box has the same label, and a late read of a daily list says how late ("13 Sep · 5 days ago") instead of only turning amber.
- **Key facts**: where a figure came from reads "From BKMEA" under it. The bare code at the row's end is gone, so every row has one shape.
- **Exports, Buyers**: "5 of 254 shown" at the title's end, not "Buyers of 254".
- **Certificates**: a listing with no date carries its number under the label a dated certificate's has ("Certificate 9741-100"), not a bare grey chip.
- **Safety, three buildings or more**: "Safety issues fixed, worst first. 2 behind." over the rows, whose figure is a bare percentage. The unlabelled strip of coloured segments over them is removed.
- **Search rows**: a supplier with no certificate says "No certificates on file", not a dash.
- Guards: `record.test.ts` ("says what every figure is"), `search.test.ts` (the phone row).
