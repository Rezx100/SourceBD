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
