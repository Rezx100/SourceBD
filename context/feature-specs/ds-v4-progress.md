# SourceBD v4: unattended Paper run, progress and decisions

The run follows `handoff-ds-v4-paper-first.md` section 9b, steps 1 to 5 (Paper
and docs only). Step 0 (the "Fix now" PRs) and step 6 (Phase 5 code) are out of
scope for this run (founder, 3 Oct). Each step appends one line; each gate and
decision is logged with its reason.

Paper file: **SourceBD v4** (`01M3Z77QNSZKYX715Y21B8RKC2`). The old file
"SourceBD" is read as text only, never written.

## Setup (3 Oct 2026)

- Plan read from `origin/handoff-v4-scroll-story`: PR #229 (the home page
  story, the Volza export records, the end-to-end run) is still open.
- Branch `ds-v4-paper` off `origin/development`.
- Keep-awake: no keep-awake tool in this session, so a background Windows
  `SetThreadExecutionState` loop holds the machine awake.
- Paper pages made: 00 Reference, 01 Foundations, 02 Components, 03 Patterns,
  10/11 App Desktop/Phone for each of the four flows, 20 Onboarding,
  30/31 Marketing Desktop/Phone, 90 Built.
- Mobbin reachable (Vanta screens return).

## Decisions

- **S1 archive step skipped.** Section 2b says `git mv DESIGN.md` and
  `.impeccable/design.json` into the archive; section 9b forbids touching
  either during the Paper phases. 9b is newer and stricter, so the files stay
  put and no session opens them. `DESIGN.md` is swapped in Phase 5.
- **`impeccable context` is never run** (it prints the old `DESIGN.md`).
  Sessions read `PRODUCT.md` directly.
- **Copy inventory source.** The 39 screens' text comes from
  `.impeccable/preview/paper-import/raw/` (all 39 are there), so the old Paper
  file is not opened at all for words.

## Steps

| Step | State | Gate |
| --- | --- | --- |
| S0 words | done 3 Oct | GATE 0 passed (default) |
| S1 research and spec | done 3 Oct | GATE 1 passed; D-1 Vanta; D-2 Plex |
| S2 design system | done 3 Oct | GATE 2 passed; D-3 glance-and-act tabs |
| S3 search and record | done 3 Oct | GATE 3 passed; D-7 cards dropped |
| S4 RFQs, quotes, orders | done 3 Oct | GATE 3 passed (default) |
| S5 messages, saved, compliance | done 3 Oct | GATE 3 passed (default) |
| S6 products, settings | done 3 Oct | GATE 3 passed; D-4 all four designed; D-6 applied |
| S7 onboarding | | GATE 4, D-5 |
| S8 marketing | | GATE 5, D-6 |
| Quality round | | critique before/after |

## Log (one line per step)

- 3 Oct · **S0 words done.** `voice-v4.md` (7.6 KB: ten rules, glossary with sources, number/date/source/state wording) and `ds-v4/copy-inventory.md` (421 rows; 20 GATE 0 before/afters on top; text taken from the 39 screens in `.impeccable/preview/paper-import/raw/`, so the old Paper file was not needed). **GATE 0: passed on the recommended default** (founder pre-approval, 9b). Decisions: "Source pending" becomes "Source not linked yet" (the plan's "Not yet checked" would be false: the source was read); "clear" becomes "No link found" (we never say a supplier is cleared); RSC is described as the industry safety council it is, never "Government register" (its trust tier in the data is unchanged); registration numbers use BGMEA's own label "BGMEA reg. no.". Gaps: Sedex, amfori, Indeed and Just Style blocked plain fetch; quotes came from a summarising fetch and are spot-checked before marketing uses them.
- 3 Oct · **S1 research and spec done.** `ds-v4-spec.md` (9.9 KB, every measurement with its Mobbin link); 91 references downloaded to `.impeccable/review/mobbin/` with `manifest.tsv`; GATE 1 board on `00 Reference`. **D-1: Vanta** (default kept; scores out of 24: Vanta 19, Airwallex 17, Remote 13, 7shifts 11; Drata not on Mobbin). Vanta has no iOS app on Mobbin, so the phone takes patterns from Brex, Revolut Business and Grailed iOS. **D-2: IBM Plex Sans + IBM Plex Mono** (default kept; in Chromium with the Google Fonts files Plex is 6.8% narrower on the 14px results row and 6.0% on the 13px fact row; Inter's x-height is a touch taller, 0.55 vs 0.52 em; legibility judged equal). Colour: forest green #1B5E20 (7.87:1 on white) is the only carried-over value; no supplier status uses green (closes `S-07`); every defined pair passes WCAG 2.2 AA. **GATE 1: passed on the recommended default.** Note: Paper cannot measure nodes on a page the founder is not viewing, so type widths came from headless Chromium.
- 3 Oct · **S2 part A done.** 98 tokens in Tailwind v4 namespaces (colour 33 incl. 8 certificate-state aliases); `01 Foundations` 6 boards (colour with contrast, type, spacing/radius/elevation, grid 1440/1280/390/320, floors, Phosphor icons); `02 Components` 7 boards, every component in its states, real suppliers in the tables. Decisions: below 1440 the sidebar becomes a 64px rail so list + pane fit 1280, and below 1280 the pane becomes a drawer (the spec was silent); counts that could not be verified are written generically ("Show results"), never invented. Paper limits logged for Phase 5: it renames `--text-*--line-height` to `--text-*-line-height` (restore the double dash in `tokens.ts`), has no shadow tokens, ignores `currentColor` in clones.
- 3 Oct · **S2 part B done; S2 complete.** `03 Patterns`: 14 pattern boards (source marks, fact row, certificate row, RSC block, sanction banner, locked contact, supplier row, quote comparison, timeline, chat, needs attention, locations map with the real Barikoi captures, statement claim, exports v2 from the Volza sample) and 5 shell boards (desktop 1440; phone Messages 390 and 320; phone record with the action bar up; phone navigation). `ds-v4/DESIGN-v4.md` written from Paper (15.2 KB). Parts A's pages had been drawn in the system font; 838 text nodes were switched to the Plex token and re-exported. **GATE 2 passed on the default. D-3: phone tabs Messages · Quotes · Alerts · Saved · Search** (Settings and Products under the account menu). Decisions: sister-company export rows stay on their own record (plan §5), so Mondol Fabrics shows 4 of the 5 sample rows; brand lists appear as names, never logos; the expiring-certificate example is Mondol Intimates GOTS-26992 (8 Oct) because Aboni has none expiring. Register closed in design: S-01, S-03, S-06, S-07, S-09, S-12, S-13, S-15, RC-01, RC-02, RC-06, RC-09, RC-10. Follow-up for Phase 5: `logos.lock.md` allows marks at 16/20/32px; the 24px source-mark row (S-01) needs a 24px entry added there.
- 3 Oct · S3, S4 and S5 started together (the at-most-three rule); S6 waits for the first to finish. Decision: the scored `/impeccable critique` per flow (GATE 3) is folded into the one bounded quality round after S8, so every page is scored once against the same bar; each flow ships its parity table and closed-register list in `.impeccable/review/ds-v4/<step>/`.
- 3 Oct · **S4 RFQs, quotes, orders done.** Desktop 16 boards; phone 12 at 390 and 12 at 320. **GATE 3 passed on the default.** Decisions: one two-line quote layout fits both the 640px pane and the page (`RQ-04`); the composer is its own page and serves 1 or 50 suppliers with a one-line To summary plus "Review all 50"; orders open as a page because the timeline needs the width (`OR-06`), Cancel sits behind a danger confirm naming the PO (`OR-02`); on phone RFQs and orders share the Quotes tab via a two-option switch. Real data: the two real RFQs (French terry hoodies) drawn as they are; five test RFQs left out; every quote, order and timeline is labelled "Sample state". Register closed in design: 29 (RQ-01..08, OR-01..06, S-02/03/05/06/09/11/12/16/17/18/19/20/22, W-02, W-04); T-10 partly; RQ-07 and OR-02 still need their "Fix now" code. Parity: 85 v3 items, 68 kept, 11 moved, 6 dropped with reasons.
- 3 Oct · S6 started in S4's slot.
- 3 Oct · **S5 messages, saved, compliance done.** Desktop 10 screens + a states board; phone 12 at 390 and 12 at 320. **GATE 3 passed on the default.** Decisions: the main thread is the real Thermax Woven Dyeing RFQ thread with its message text labelled "Sample state"; Saved shows 11 real suppliers labelled "Sample list · every fact on it is live"; the UFLPA tracker's real state is 0 on the Entity List, 0 possible Xinjiang link, 11 no link found (the 3 screening rows in production are inactive OFAC name matches, so they never reach a buyer screen) and flagged examples use "[Supplier name]" so no real supplier is shown as flagged; list "as of" dates are real (UFLPA list 14 May 2026, 160 entries); the statement's unconfirmed facts are "[Confirm: …]" claims and PDF/DOCX export stays blocked until all are confirmed. Register closed in design: 35 (T-01, T-02, MS-01..05, SV-01..05, CP-01..07, S-03/06/09/12/16/17/18/20/21/22, W-02/03/07; E-04/05/08 design only). Parity: 23 kept, 17 moved, 12 dropped, 5 added. Cross-flow consistency flags (source counts include brand lists; a stale Hossain certificate; Mondol Fabrics' differing worker figures) sent to S3 and carried into the quality round.
- 3 Oct · **S3 search and the record done.** Desktop 21 boards (17 results per 1440x900 at 40px; Aboni as pane, full page and Sites with the Barikoi map; Liberty's 5 RSC buildings; Mondol with "2 sources differ" and Exports v2 · Sample; Adventure's 39 products; product line HS 6105; Zaheen; A.R. Fashion; empty, loading, errors, sanctioned and 12-month views as labelled states); phone 13 screens at 390, each with a 320 check, plus 5 state boards; the first certificate is on phone screen 1. **GATE 3 passed on the default. D-7: result cards dropped on phone and desktop** (a compact card fits 16 per screen against the table's 17 and loses column heads and sorting; its only extras were stock photos, `T-07`). Decisions: one worker figure everywhere (RSC's, "in N buildings"), the other behind "2 sources differ"; the source count is the distinct sources on the record (S M Knitwears 10, Aboni 11, Mondol 5), and sorting must use that shown number in Phase 5 (live search sorts by `t13_source_count` today); Adventure's 39 declared entries group into 11 products with "Show all 39 as declared". Register closed in design: 36 (T-03..08, SR-01..09, RC-01..05/07/09/10, 13 S items; T-10 for record and list). Open: RC-06, RC-08. Parity: 66 rows, 49 kept, 9 moved, 6 dropped, 1 merged, 1 added. Leftovers for the quality round: one board elsewhere still shows Hossain "GOTS expires 15 Nov 2026"; the 02 table shows declared worker figures; re-export `b-20`.
- 3 Oct · The keep-awake loop reached its two-hour background limit and stopped; the harness does not allow restarting it, so the rest of the run relies on the machine's own power settings.
- 3 Oct · **S6 products, settings done.** Desktop 19 boards (products list, empty, size-chart editor, materials and tech pack, HS picker, loading and error; HS codes by chapter with Plummy Fashions' 54 codes and Adventure's 39 products; Profile, Company details, Team and roles, Security, RFQ templates, Plan and usage, Emails, Audit log; invite and evidence-pack dialogs); phone 13 at 390 and 13 at 320. **GATE 3 passed on the default. D-4: roles and invites, 2FA and sessions, audit log and evidence export all designed now**, each marked "Design only · not built" where the product lacks it. **D-6 applied:** "Free during the beta" and "Enterprise · talk to us", no prices; the Growth tier and a "no limits" line were dropped because neither could be shown true. Decisions: settings names come from the copy inventory ("Your account" / "Your company"); HS codes are real (210 headings in 46 chapters from 2,456 suppliers, EPB checked 14 Aug 2026); buyer products and people are labelled samples (production has none; no real account shown); sanctions emails are always on instead of folded into the weekly digest (`ST-07`). Register closed in design: 32 (PR-01..08, ST-01..09, E-01/02/03/04/07/08, S-03/05/09/12/16/19, W-01/02); PR-02 and ST-03 still need their "Fix now" code. Parity: 44 v3 items, 30 kept, 5 moved, 9 dropped.
- 3 Oct · All four app flows done. S7 (onboarding) and S8 (marketing; split into the home story and the other pages so the two halves run beside S7) started.
