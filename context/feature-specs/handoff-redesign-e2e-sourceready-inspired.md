# Handoff — SourceBD end-to-end redesign, inspired by SourceReady

Founder request, 27 Sep 2026: redesign the buyer app end to end at an
"Apple-level" bar, using the competitor SourceReady's screens
(`.impeccable/review/sourceready/*.png|jpg`, captured this session) as
inspiration — not a copy. Three confirmed bugs to fix in the same pass.
Production-ready, one spec, branch off `development` per the usual workflow.

## 1. Three confirmed fixes (do these regardless of scope below)

**Canvas has a green cast — drop it.**
`lib/design/tokens.ts:25-27` says outright: *"Canvas is warm paper with a
green cast — the ledger's page."* That was a deliberate choice on 18 Sep; the
founder is now reversing it. Retune to a true neutral, keep brand green
(`#1B5E20`, fixed, never touched) as the only green in the UI:

| Token | Now | Replace with (neutral, same lightness) |
| --- | --- | --- |
| `canvas` | `#F6F7F2` | `#F7F7F6` or `#F8F8F7` |
| `surface.sunken` | `#ECEEE7` | `#EEEEEC` |
| `line.subtle` | `#E6E8DF` | `#E7E7E4` |
| `line.DEFAULT` | `#D5D9CC` | `#D8D8D4` |
| `grid.dot` | `#CFD4C6` | `#D2D2CE` |

Re-run the contrast fixture (`lib/design/tokens.test.ts`) after — the pairs
table is generated from these values, nothing else to hand-edit.

**Sidebar scrolls away — pin it.**
`components/dashboard/app-shell.tsx:392` roots the shell in
`flex min-h-full flex-col md:flex-row` with no independent scroll region. On
any page taller than the viewport the whole document scrolls and the rail
goes with it — SourceReady's rail stays put while its center pane scrolls.
Fix: `md:h-screen` on the root, `md:sticky md:top-0 md:h-screen md:overflow-y-auto`
on the `<aside>` in `Sidebar` (components/dashboard/app-shell.tsx:161), and
`overflow-y-auto` on the `<main>` wrapper next to it. Phone layout (nav as a
horizontal strip) is untouched — this only changes behavior at `md:` and up.

**Company profile floats as a narrow box — anchor it.**
`components/dashboard/sheet.tsx:131`, the standalone (non-overlay) path:
`mx-auto min-h-[calc(100vh-11rem)] w-full max-w-[880px]` — a centered 880px
column with no card, no border, no background break from the page canvas. On
a wide monitor that reads as a narrow strip adrift in empty space, which
matches "weird box." Fix direction: give the column a page-level header band
that runs full width (breadcrumb + actions), keep the 880px measure for
readable line-length on the body text only, and either raise the surface
(a subtle `bg-surface` panel with a hairline border) or widen the max measure
on large screens (`xl:max-w-[1040px]`) so it doesn't look orphaned. Confirm
the exact visual before deciding between "raise it" and "widen it" — attach a
screenshot of the live page, not just the source, since this is a look call.

## 2. What SourceReady does that SourceBD doesn't (borrow selectively)

SourceReady is an AI-chat-first sourcing copilot; SourceBD is a structured
supplier database and inquiry tool. Don't copy the chat-home metaphor —
borrow the craft and the screens that map to what SourceBD already does.

Screens captured this session, in `.impeccable/review/sourceready/`:

| SourceReady screen | What to borrow | Maps to |
| --- | --- | --- |
| Credits panel (bottom-left, resets daily) | A visible usage/allowance readout, not just in Settings | `Sidebar`'s `plan` block already computes `pct` (app-shell.tsx:145) but isn't rendered as a mini progress readout in the rail — surface it there |
| Upgrade / Plans modal | Clean plan-comparison modal, monthly/yearly toggle | SourceBD has no in-app upgrade flow today — new screen |
| Earn extra credits ("Quick start" checklist) | Onboarding-as-progress, not a wall of empty states | Feeds the onboarding work already flagged in `onboard[target]` territory — new screen, optional for this pass |
| Account menu (Account / Setting / Log out) | A real menu, not a bare logout link | Confirm what SourceBD's account menu has today before building — likely missing Setting as a distinct screen |
| Search-as-you-type with recents | SourceBD's topbar typeahead (`search-typeahead.tsx`) already does this — no gap |
| Template category tabs on home | Not applicable — SourceBD's home is Discover, not a prompt library |

## 3. Missing screens to add to SourceBD (production-ready, this pass)

In priority order — build top to bottom, stop when the founder says stop:

1. **Account settings page** (`/app/account` or similar) — name, email,
   password change, connected sign-in method. Check first whether this
   already exists under a different route; SourceReady's is a
   click-avatar-then-Account flow.
2. **App settings page** (`/app/settings`) — notification prefs, default
   currency/units if any, session/devices. Same check-first step.
3. **In-app help panel** — even a single static page (contact + FAQ links) is
   better than the missing state today; matches AGENTS's own standing rule
   "No Help button until a help page exists" (24 Sep, REZ-B) — this is what
   unblocks that.
4. **Credits/usage readout in the sidebar** — see table above.
5. **Upgrade/plans modal** — only if SourceBD actually sells tiers today;
   confirm the billing model exists before building UI for it.

Do not build: an AI chat home, a template/prompt library, or "Skills" —
none of those match what SourceBD sells.

## 4. Rollout

Same workflow as the craft pass (PR #185/#186): branch off `development`,
implement, one `/code-review` pass, PR with `gh pr merge --auto --squash`.
Split into two PRs if the scope grows past one sitting: PR A = the three
fixes in §1 (small, mechanical, no new screens — ship this first and fast),
PR B = the new screens in §3 (larger, needs its own DESIGN.md update and
Higgsfield assets only if a screen genuinely needs a new illustration).

Update `context/current-state.md` and archive this spec's entry per the
usual workflow once either PR lands — one line each, not before.
