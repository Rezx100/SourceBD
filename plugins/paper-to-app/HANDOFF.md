# Handoff: buyer phone redesign (stopped 11 Oct 2026)

The founder asked for the phone redesign on Paper pages 35 and 36 in **at most two PRs**, with the
CI split and the speed-and-touch fixes in PR 1. Work stopped when the account hit its weekly usage
limit. Everything is on GitHub as branches off `development` at `951c905`; **no PR is open yet**.
Every WIP commit is unreviewed and not fully tested.

## Branches

PR 1 = `phone-redesign-1` + `p1-*`. PR 2 = `phone-redesign-2` (empty so far) + `p2-*`.
Merge the `p1-*` branches into `phone-redesign-1` and the `p2-*` ones into `phone-redesign-2`
(plain merges, keep both sides of conflicts in `tsconfig.npm-test.json` and the `CASES` list of
`scripts/test-profile-http-boundary.mjs`), then open the two PRs.

| Branch | State |
| -- | -- |
| `phone-redesign-1` | DONE, tested: CI split (`lib/dedup-addresses-fixture.slow-test.ts`, `pnpm test:slow`, job `unit-tests-slow`). DONE, partly tested: middleware and server reads use `lib/supabase/session-user.ts` (`getClaims`, falls back to `getUser`); suspended/signed-out boundary cases; `TabBar` pressed state + `TabFace` (`useLinkStatus`); `active:bg-sunken` on `SupplierRow`; touch CSS in `app/ds.css`; template fade removed (box kept in the layout); saved rows carry `?sid=` into the record page; `searches/page.tsx` role read in parallel; `optimizePackageImports`; PostHog loaded by `import()` after consent + web vitals (INP/LCP/TTFB); `FeedbackDialog` via `next/dynamic`; map library loads when the map nears view; `lib/phone-speed.test.ts`. Also this plugin. Tests run green: phone-speed, v4-kit, frame, feedback, saved-searches; `saved.test.ts` had one assertion fixed after the run, re-run it. Not run: strict `tsc --noEmit`, lint. |
| `p1-search-saved` | Partial: search landing/list/toolbar, saved phone list, saved searches, save-search sheet. Alerts and the filters-sheet UFLPA copy may be unfinished (`components/compliance/uflpa-read.ts` added). |
| `p1-compliance` | Nearly done: hub, MSA drafter, UFLPA checks; its 64 tests passed. 390 px screenshots not taken. |
| `p1-drawer` | Barely started: `components/record/phone-words.ts`, `share-button.tsx` only. All of page 35 + `export-line` + `customs-empty` remain. |
| `p2-quotes-orders` | Partial: RFQ list/detail/new, orders list, new order. Tests not run. Order detail, RFQs empty state to check. |
| `p2-messages-products` | Partial: thread, products list/detail/form. Inbox, empty messages, account sheet, HS codes to check. |
| `p2-settings` | Partial: shell, plan, profile, RFQ template, team. Company, emails, security to check. |

Still to do in PR 1 (speed): remove `prefetch={false}` from phone list rows that lead to routes with a
`loading.tsx` (do it after merging the screen branches). PR 2 (speed): run in parallel the reads in
`orders/new/page.tsx`, `rfqs/new/page.tsx` (draft read before the `Promise.all`), `messages/[thread]/page.tsx`.

## Board → route map

Page 36 (`boards/page-36`, converted in `boards/tsx36`): search-home, search-results, search-320,
filters → `/app`; saved → `/app/saved`; saved-searches, save-search → `/app/searches`; alerts;
compliance-hub, msa, uflpa → `/app/compliance[/msa|/uflpa]`; export-line → `/app/suppliers/[slug]/lines/[hs]`;
customs-empty; rfqs, rfq-detail, rfq-new, rfqs-empty → `/app/rfqs…`; orders, order-detail,
new-order → `/app/orders…`; inbox, thread, messages-empty → `/app/messages…`; account (the account
sheet in `components/frame/phone.tsx`); products, product-detail, product-new → `/app/products…`;
hs-codes → `/app/headings`; settings, profile, company, team, emails, security, plan, rfq-template →
`/app/settings/*`. Page 35 (`boards/page-35`, `boards/tsx35`): the supplier drawer, 15 states.

## Facts that differ from the boards

UFLPA list was read 8 Oct 2026 (253 entries, 0 matches): never "not read yet". Customs data is per
supplier and per market, never per HS code. `/compliance/msa` drafts the buyer's own statement.
Saved-search alerts are one weekly switch. New order ends "Cancel / Create order".

## Founder-only steps (print them, never do them)

1. Add `unit-tests-slow` as a required check on `development` and `main`: the command is in
   `docs/ENTERPRISE_DEPLOYMENT.md` (Branch and release model).
2. The Supabase project already publishes an ES256 signing key (JWKS checked 11 Oct), so the faster
   sign-in check needs no dashboard change, provided tokens are signed with it (confirm in the
   dashboard: Auth → JWT signing keys → the ES256 key is "current").
3. Click Deploy Production after the release PR.

## Resume prompt (paste into a new session)

> Check out branch `phone-redesign-1` (until PR 1 merges, the plugin lives only there), run
> `/plugin marketplace add .` from the repo root and `/plugin install paper-to-app@sourcebd`, or just read `plugins/paper-to-app/` on branch
> `phone-redesign-1`. Read `plugins/paper-to-app/HANDOFF.md` and `skills/paper-to-app/SKILL.md` +
> `screen-rules.md`, then finish the phone redesign: complete each `p1-*`/`p2-*` branch, merge them
> into `phone-redesign-1` and `phone-redesign-2`, run one /code-review per PR, open both PRs to
> `development` with `gh pr merge --auto --squash`, then the release PR with `--auto --merge`.
