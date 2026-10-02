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
| S2 design system | | GATE 2, D-3 |
| S3 search and record | | GATE 3 |
| S4 RFQs, quotes, orders | | GATE 3 |
| S5 messages, saved, compliance | | GATE 3 |
| S6 products, settings | | GATE 3, D-4 |
| S7 onboarding | | GATE 4, D-5 |
| S8 marketing | | GATE 5, D-6 |
| Quality round | | critique before/after |

## Log (one line per step)

- 3 Oct · **S0 words done.** `voice-v4.md` (7.6 KB: ten rules, glossary with sources, number/date/source/state wording) and `ds-v4/copy-inventory.md` (421 rows; 20 GATE 0 before/afters on top; text taken from the 39 screens in `.impeccable/preview/paper-import/raw/`, so the old Paper file was not needed). **GATE 0: passed on the recommended default** (founder pre-approval, 9b). Decisions: "Source pending" becomes "Source not linked yet" (the plan's "Not yet checked" would be false: the source was read); "clear" becomes "No link found" (we never say a supplier is cleared); RSC is described as the industry safety council it is, never "Government register" (its trust tier in the data is unchanged); registration numbers use BGMEA's own label "BGMEA reg. no.". Gaps: Sedex, amfori, Indeed and Just Style blocked plain fetch; quotes came from a summarising fetch and are spot-checked before marketing uses them.
- 3 Oct · **S1 research and spec done.** `ds-v4-spec.md` (9.9 KB, every measurement with its Mobbin link); 91 references downloaded to `.impeccable/review/mobbin/` with `manifest.tsv`; GATE 1 board on `00 Reference`. **D-1: Vanta** (default kept; scores out of 24: Vanta 19, Airwallex 17, Remote 13, 7shifts 11; Drata not on Mobbin). Vanta has no iOS app on Mobbin, so the phone takes patterns from Brex, Revolut Business and Grailed iOS. **D-2: IBM Plex Sans + IBM Plex Mono** (default kept; in Chromium with the Google Fonts files Plex is 6.8% narrower on the 14px results row and 6.0% on the 13px fact row; Inter's x-height is a touch taller, 0.55 vs 0.52 em; legibility judged equal). Colour: forest green #1B5E20 (7.87:1 on white) is the only carried-over value; no supplier status uses green (closes `S-07`); every defined pair passes WCAG 2.2 AA. **GATE 1: passed on the recommended default.** Note: Paper cannot measure nodes on a page the founder is not viewing, so type widths came from headless Chromium.
