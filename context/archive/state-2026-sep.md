> ARCHIVE — closeout detail moved out of `context/current-state.md` from 29 Sep 2026 on. Read a named section only when a specific historical decision, migration or regression requires it. Not maintained.

# SourceBD - state archive, September 2026

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
