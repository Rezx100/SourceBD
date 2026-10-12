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

## Contact details shown from the Growth plan (12 Oct 2026)

Founder, 12 Oct 2026: "we have decided to show contact details of the suppliers as it's stored on the database from growth plan". Branch `contact-reveal`; migration `0145_supplier_contact_details.sql` built, **not applied**.

- **Who**: an admin, or a buyer on Growth or Enterprise, not suspended; the same gate as the customs records (0137). Everyone else keeps the locked card with the counts. The database decides, in `supplier_contact_details(slug)`; the contact columns stay revoked (0083).
- **What**: emails, phone numbers, website, contact person and role from the register columns, cleaned by the rules the counts use (0105), so the card shows as many as the count said. Supplier-entered contact fields (0034) are not part of it.
- **Where**: the full page's Contact box, and the same box at the end of the overview in the pane and under 1024 (`components/record/contact-card.tsx`). Emails write, numbers dial with the country code, the website opens apart.
- **Recorded**: every sheet that reads the details writes `contact.revealed` to the activity record (`loadRecordSheet`); `supplier.viewed` now says `contact_visible` truthfully. Until this change the code wrote `true` on every open, though no details were shown; those older entries overstate.
- **Until 0145 is applied** the read fails soft and every reader sees the locked card. Guards: `supabase/ci/assert-0145.sql` (who gets what, and that details agree with the counts), `record.test.ts`, `load-record.test.ts`, `record-routes.test.ts`.
- **Open**: the phone record's Contact box is not wired yet (another change was moving it); a sanctioned record shows its details to the same readers; nothing meters or rate-limits a direct call to the function.
