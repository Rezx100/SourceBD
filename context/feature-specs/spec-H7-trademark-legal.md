# Spec H7 — Trademark + legal pages

> Phase 6 hardening spec #7. Follows H1 (Sentry + PostHog), H2 (rate
> limiting), H3 (Stripe webhook hardening), H4 (Resend email templates),
> H5 (in-app onboarding tour), H6 (a11y skip link + loading skeletons).
> One spec = one PR on `development`.

## Scope

Ship the four statutory legal surfaces required before public launch
and wire them into the marketing chrome:

1. **`/legal/terms`** — Terms of Service.
2. **`/legal/privacy`** — Privacy Notice. Renders the **ICO
   registration number** and the **UK GDPR Representative** contact
   block from env vars (`NEXT_PUBLIC_ICO_REGISTRATION_NUMBER`,
   `NEXT_PUBLIC_UK_GDPR_REP_NAME`, `NEXT_PUBLIC_UK_GDPR_REP_ADDRESS`,
   `NEXT_PUBLIC_UK_GDPR_REP_EMAIL`). When unset, each field renders
   the explicit literal `"Pending appointment"` / `"Pending
   registration"` so the page is honest about its in-progress state
   rather than fabricating a number.
3. **`/legal/cookies`** — Cookie Notice. Enumerates the three cookie
   classes actually in use today (Supabase Auth session, PostHog
   `_ph` analytics, Next.js prefs) plus the categorical "no
   advertising / no cross-site tracking" stance.
4. **`/legal/data-sources`** — Data Source Policy. Restates the source
   trust hierarchy from `architecture.md` (Tier 1–6, hard rule #5)
   in buyer-facing language, names the takedown / correction contact,
   and links the existing `/legal/trademarks` page for third-party
   marks.

The four pages are added to the marketing footer (between Compliance
and Trademarks) and to the public sitemap (`changeFrequency: 'yearly'`,
`priority: 0.3`).

## Out of scope (operational)

These are real-world, out-of-band tasks the **user** owns. The spec
does NOT execute them; it only renders the resulting identifiers when
the user has them.

- **ICO registration** (UK Data Protection Act 2018 fee tier). Once
  paid, set `NEXT_PUBLIC_ICO_REGISTRATION_NUMBER=ZA######` in
  `.env` on the VPS and redeploy — the Privacy page picks it up
  automatically.
- **UK GDPR Representative appointment** (UK GDPR Art. 27, required
  for non-UK established controllers serving UK data subjects). Once
  appointed, set the three `NEXT_PUBLIC_UK_GDPR_REP_*` env vars.
- **UKIPO trademark filing** for SOURCEBD word mark + logo (Class 35
  — business intelligence services; Class 42 — SaaS).
- **USPTO trademark filing** for the same marks on the US side
  (intent-to-use basis acceptable pre-MAGIC Las Vegas).

None of these unblock the spec — the pages ship today with
"Pending" sentinels and the env vars flip them to real values without
a code change.

## Out of scope (deferred)

- **Cookie consent banner / preference centre.** PostHog is configured
  in H1 with `disable_session_recording: true` + `autocapture: true`;
  no advertising cookies, no cross-site trackers. Under PECR a banner
  is required only for non-essential cookies that we don't currently
  set. If we add ad pixels or session replay, a separate consent-banner
  spec will land first.
- **Data Subject Access Request (DSAR) self-serve flow.** v1 routes
  DSARs through the email address in the Privacy page. A self-serve
  endpoint is a follow-up spec.
- **`current-issues.md`-style legal review pass.** The shipped copy
  is the engineering draft; counsel review happens out-of-band and
  edits land via normal PR.

## Architectural choices

1. **No new tools.** Architecture.md rule #4. Pages are pure server
   components rendering Tailwind + the existing `Card` chrome.
2. **One file per page, no shared content module.** Each legal page
   carries different copy with different update cadences (Terms
   changes on commercial pivot; Privacy on data-flow change; Cookies
   on tool change; Data Sources on hierarchy change). A shared
   `lib/marketing/legal-pages.ts` would imply coupled refresh
   cycles that don't exist in practice. Mirror the existing
   `/legal/trademarks/page.tsx` pattern — `force-static`, per-page
   metadata, inline copy.
3. **ICO + UK GDPR Rep are env-var driven, not committed constants.**
   These values change out-of-band (ICO fee renewal cycle, rep
   contract changes) and must not require a code change to update.
   `NEXT_PUBLIC_*` because they render on a public static page and
   carry no secrecy.
4. **Effective-date constant per page.** Each page has a
   `LAST_UPDATED = '2026-06-03'` constant rendered in the footer.
   When copy changes, the contributor updates the constant in the
   same PR — the user-visible signal that the document changed.
5. **Footer order: Pricing → Compliance → Terms → Privacy → Cookies →
   Data sources → Trademarks → © year.** Statutory pages cluster
   together; Trademarks stays last in the legal cluster (it predates
   this spec). The smoke check asserts the order so a future
   contributor cannot silently re-alphabetise.
6. **Sitemap: `changeFrequency: 'yearly'`, `priority: 0.3`.** Same
   posture as `/legal/trademarks`. Legal pages do not compete for
   ranking; they exist for compliance and discoverability via
   direct deep-link.
7. **`robots` policy: indexable.** Public legal terms must be
   crawlable so external counsel / regulators / partners can reach
   them by search. `robots: { index: true, follow: true }` on every
   page (mirrors `/legal/trademarks`).
8. **No new DB migration.** Pure FE surface. Migration head stays
   at `0047_onboarding_state.sql`.

## Deliverables

### Code

- `app/(marketing)/legal/terms/page.tsx` — Terms of Service.
  `force-static`, per-page metadata + canonical, inline copy.
- `app/(marketing)/legal/privacy/page.tsx` — Privacy Notice. Renders
  ICO + UK GDPR Rep block from env with "Pending" sentinels.
- `app/(marketing)/legal/cookies/page.tsx` — Cookie Notice.
- `app/(marketing)/legal/data-sources/page.tsx` — Data Source Policy.

### Chrome wiring

- `components/marketing/footer.tsx` — insert Terms / Privacy /
  Cookies / Data sources links between Compliance and Trademarks.
- `app/sitemap.ts` — append 4 entries with the same shape as the
  existing `/legal/trademarks` row.
- `.env.example` — add 4 new public env keys with empty values
  and a comment block.

### Smoke

`ops/_h7_smoke.py` — disk-only, no network. Checks:

1. Each of the 4 page files exists and exports a default function;
   each contains a `LAST_UPDATED` literal and a `<main>` wrapper.
2. Each page sets `metadata.alternates.canonical` matching its own
   URL and `metadata.robots = { index: true, follow: true }`.
3. The Privacy page references all four env var names
   (`NEXT_PUBLIC_ICO_REGISTRATION_NUMBER`,
   `NEXT_PUBLIC_UK_GDPR_REP_NAME`,
   `NEXT_PUBLIC_UK_GDPR_REP_ADDRESS`,
   `NEXT_PUBLIC_UK_GDPR_REP_EMAIL`) and contains both the
   "Pending appointment" and "Pending registration" sentinels.
4. `components/marketing/footer.tsx` contains all four
   `/legal/terms`, `/legal/privacy`, `/legal/cookies`,
   `/legal/data-sources` hrefs, and the link order
   (Pricing < Compliance < Terms < Privacy < Cookies <
   Data sources < Trademarks) is preserved.
5. `app/sitemap.ts` references all four `/legal/*` paths.
6. `.env.example` contains all four new env keys.
7. Forbidden-token scan on every new TS — none of the M5
   forbidden tokens (`email_primary`, `phones`, `contact_name`,
   `contact_role`, `nid_number`, `password`, `body_ciphertext`,
   `sbi`, `pillar_`, `internal_score`) appear in any new file.
8. `.next/routes-manifest.json` route count = 68 (= H6 baseline
   64 + 4 new static routes).

## Validation

```
pnpm typecheck
pnpm lint
pnpm build           # expect route count 68
python ops/_h7_smoke.py
```

No DB migration to apply. No live VPS work for this spec — the
out-of-band ICO / UK GDPR Rep / UKIPO / USPTO actions are owned by
the user.

## Commit

`feat(legal): ship Spec H7 legal pages + footer + sitemap wiring`
on `development`. Push. Surface the commit ref.
