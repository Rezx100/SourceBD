> ARCHIVE — closeout detail moved out of `context/current-state.md` from 29 Sep 2026 on. Read a named section only when a specific historical decision, migration or regression requires it. Not maintained.

# SourceBD - state archive, September 2026

## Buyer app on a phone — BUILT (30 Sep 2026)

`feature-specs/handoff-dashboard-mobile.md`, M0–M5 (PRs #218, #220–#224), front end only, no
migration. Below 768px the window is the one scroller (the record and the composer could
not be scrolled at all); `<main>` clips sideways on a phone. Trays are named disclosures
(`name="sb-menu"`) closed by `lib/dashboard/menu-dismiss.ts` and bottom sheets below
640px. Navigation is a bottom tab bar (`bottom-nav.tsx`) with a More sheet; both app
bars step aside inside a detail (`data-detail`). The phone type step (`phoneFontSize`)
and named sizes live in the tokens. Known limits, left: the bars' hiding needs `:has()`
(iOS 15.4+); a sheet's Done relies on the shell's dismiss (the dev gallery draws menus
outside it); `cn()` drops `text-title`/`text-eyebrow` before an ink (a separate task).

## Dashboard fixes from the founder's 29 Sep video — COMPLETE (29 Sep 2026)

Hand-off `feature-specs/handoff-dashboard-video-29sep.md` (six PRs); the
founder's Q1–Q4 answers and seven design picks are in
`.impeccable/surfaces/app-app-app.md`. Live: `main` `79a59f8`, deployed 29 Sep
03:04 UTC, smoke test passed; rollback ref `d7e6c42`.

- PR 1 (#197) speed and stability. Timings and what is left:
  `ops/plans/buyer-app-speed-29sep.md`; migration `0107` NOT applied. A full
  load of an /app page no longer runs the older shell's five reads: its layout
  wraps only /supplier and /admin, in `app/(app)/(old-shell)` (PR #207, which
  replaced #199).
- PR 2 (#198) the founder's seven picks; `accent` in `tokens.ts`.
- PR 3 (#200) rail collapse, account menu, record Expand.
- PR 4 (#201) filled search field, filter menus, slate in `[data-shell]`, text
  one step up.
- PRs 5–6 (#202) record head, pending mark, no stripes, photo list; composer
  beside an 18rem results rail, shorter copy.
- Harness: `.impeccable/preview/video29.cjs` (gitignored).
- Its leftovers were handed on to `feature-specs/handoff-dashboard-names-and-facts.md`
  (PR D there).

## Moved from current-state (6 Oct 2026)

- **Buyer dashboard v3.2, REZ-A (the code port of the dashboard kit)** —
  DONE. `ACCEPTED_FOR_HUMAN_REVIEW` at cycle 21 (candidate `1ccb4bc`),
  merged to `development` via PR #161 (21 Sep). Dev/admin-only gallery at
  `/dev/ds`; no live route wired yet. Full history:
  `context/feature-specs/handoff-rez-a-cycle21.md`.
- **Buyer dashboard v3.2, REZ-B (results page)** — DONE. Judge
  `ACCEPTED_FOR_HUMAN_REVIEW` at `4f6eff2`; `development` PR #164 (`cfbbf4a`),
  `main` PR #165 (`1780c2c`), deployed 24 Sep, migration `0104` applied 25 Sep.
  Loop history: `feature-specs/handoff-rez-b-cycle15.md`,
  `handoff-rez-b-deploy.md`, `handoff-rez-b-live-migration.md` (its §5 is the
  follow-up list; its first item, the stale "Selection arrives with the results
  work" line, is fixed in REZ-C's PR).
