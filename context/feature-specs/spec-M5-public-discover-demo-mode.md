# Spec M5 — Public Discover demo mode

Fifth Phase-5 spec (M1 → M2 → M3 → M4 → **M5**; per
`context/phases.md` line 102). Upgrades the public anonymous Discover
list and supplier profile from the F3 minimal-SELECT placeholders to
the same RPC-backed surfaces the buyer app uses, with all contact PII
suppressed at render time and a "Sign up free" CTA in place of the
F3 "Sign in to view contacts" CTA.

No new tools, no new dependencies, no DB migration, no new RPC, no new
API route, no new env var, no new client island. Reuses the existing
`public.discover_suppliers` (migration 0023) and
`public.buyer_supplier_profile` (migrations 0024 / 0034 / 0036) RPCs —
both already `grant execute … to anon, authenticated`.

---

## Hard constraints

1. **Receipts-first + SBI doctrine carry forward.** No `sbi_scores`,
   no register PII (`nid_number`, `trade_license_number`,
   `proprietor_nid`, `owner_phone`), no encrypted-body / token columns
   on any rendered surface. The RPCs already exclude these keys at the
   payload boundary — smoke check (i) does a recursive forbidden-token
   scan on the rendered source as a regression guard.
2. **Source-trust hierarchy is law.** Public surfaces only show
   `is_published=true` rows (already enforced inside both RPCs).
   Sanctioned suppliers remain visible with a red banner — parity with
   M4 JC #9 (the public profile is in the sitemap so a buyer Googling
   the supplier still sees the sanctions disclosure).
3. **No new tools, no new deps, no DB migration, no new RPC, no new
   env var.** Everything is FE composition over already-shipped RPCs.
4. **No new client island.** Public Discover + profile are pure server
   components. The buyer-side `SaveButton`, `ClaimCtaButton`, RFQ
   button, and `Tabs` (client) are deliberately NOT used on the public
   surfaces — anonymous visitors cannot save, claim, or RFQ. The
   profile lays out top-to-bottom rather than tabbed; this also keeps
   the page indexable as a single document.
5. **Contact PII suppression is a render decision, not a wire-level
   one.** `buyer_supplier_profile.addresses[]` carries `phone` and
   `email` keys (registry-published, e.g. BGAPMEA) — the public render
   strips these two fields via a small inline mapper local to the page
   file and renders only `kind + address + source_code`. The RPC is
   NOT forked or wrapped; the buyer profile at `/app/suppliers/[slug]`
   keeps rendering them unchanged. A one-liner under the addresses card
   reads "Phone & email — sign up free to view." so the omission is
   honest. JC #12 (a).
6. **CTA links target routes that exist.** Primary CTA → `/signup?next=…`
   (verified: `app/(auth)/signup/page.tsx`). Secondary CTA → `/login?next=…`
   (verified: `app/(auth)/login/page.tsx`). The pre-existing broken
   `/auth/sign-in` link in `components/marketing/top-nav.tsx` is OUT
   OF SCOPE for this commit — logged as a follow-up in the closeout
   entry.
7. **Filter rail is shared between buyer and public discover.** The
   F1/B1 rail is currently inline in `app/(app)/app/discover/page.tsx`
   as a private helper coupled to `action="/app/discover"` and the
   buyer `/app/discover` reset href. Extract `FilterRail` +
   `SortControl` + `Pagination` + `FilterGroup` + `CheckboxRow` +
   `buildQuery` to a new shared module `components/discover/filter-rail.tsx`
   parameterised by `basePath` (server-only — no `'use client'`).
   `ResultCard` stays per-page (the buyer variant carries `SaveButton`
   and the saved-set lookup; the public variant doesn't). Small refactor
   is acceptable per JC #10 because parity is required by the spec.
8. **JSON-LD shape is preserved verbatim from M4.** The supplier
   profile's `Organization`/`LocalBusiness` JSON-LD block stays
   structurally identical (M4 JC #8). It is re-sourced from
   `payload.supplier.*` instead of a separate SELECT — that means
   the M4 smoke (g) source-inspection regex (`type="application/ld+json"`,
   `"LocalBusiness"`, `"Organization"`) still passes against the
   rewritten file. `website` is no longer in the payload (the buyer
   RPC doesn't return it) so `sameAs` is dropped from the LD block —
   accepted, the buyer profile already lives without it.
9. **`generateMetadata` is re-sourced from the RPC, not a second
   SELECT.** Avoid double-fetching: call `buyer_supplier_profile` once
   per render path; both `generateMetadata` and the page body read
   from the same payload shape. Implementation note: `generateMetadata`
   runs in its own request scope (Next dedupes via `cache()`), so it
   issues its own RPC call — but the call is the same RPC the page
   body uses, not the F3 minimal-SELECT variant.
10. **No `revalidate`, no `force-static`.** Both pages keep
    `dynamic = 'force-dynamic'` (same as today). Anonymous Discover is
    filter-driven; profile carries live sanctions/cert state.
11. **No `role="status"` on the demo banner.** The banner is static
    marketing chrome, not a live region or dynamic update — using
    `role="status"` would mis-signal "screen-reader, announce me on
    update" to AT. Plain `<aside>` is correct.

---

## Locked-in JCs (12 — acked by user this session)

| # | Decision |
|---|----------|
| 1 | Rich-demo interpretation: public Discover calls `discover_suppliers` RPC with filter-rail parity to `/app/discover`; public profile calls `buyer_supplier_profile` RPC for full pills / certs / RSC / brand attributions / sanctions / provenance / addresses (contacts-stripped) / documents / partner factories. Anon-grants on both RPCs verified clean of PII + SBI. |
| 2 | New `components/marketing/demo-banner.tsx` — server component, plain `<aside>` with "Sign up free" primary + "Sign in" secondary CTAs both carrying `next=` query param. Rendered above the main on both `/discover` and `/suppliers/[slug]`. |
| 3 | Public Discover reuses the buyer rail via extracted `components/discover/filter-rail.tsx`. PAGE_SIZE = 24. Same `SORT_OPTIONS`, `ENTITY_TYPES`, `CERT_KINDS`, `MIN_SOURCES_OPTIONS` constants exported from the shared module. |
| 4 | Public ResultCard is inline in the public page (no `SaveButton`, no saved-set lookup, link target `/suppliers/{slug}`). |
| 5 | Sanctions banner on public profile is inline server markup (same red strip as the buyer header). No client island. |
| 6 | Pills / Certs / RSC / Brand attributions / Provenance / Documents / Addresses / Partner factories cards are inline server markup on the public profile — visually mirror the buyer layout but flat-scroll, not tabbed. |
| 7 | Demo banner uses `<aside aria-label="Demo mode">` — no `role="status"`. |
| 8 | Primary CTA `/signup?next=<encoded-current-path>`. Secondary `/login?next=…`. Both routes verified to exist. |
| 9 | RFQ button, Save button, Claim CTA are all omitted from the public profile header. The header `<div>` carries the title, entity badge, location, completeness, and the sanctions banner only. |
| 10 | Buyer-side `FilterRail`/`SortControl`/`Pagination` extracted to shared module — small refactor acceptable because parity is required and duplication would silently drift. `ResultCard` stays per-page (different shape due to SaveButton). |
| 11 | Smoke is disk-based against `.next/server/app/*.html` for prerendered surfaces + source-file regex for the two `force-dynamic` pages, mirroring the M3/M4 pattern. |
| 12 | (a) — Strip `addresses[].phone` and `addresses[].email` at render time via a small inline mapper in `app/(marketing)/suppliers/[slug]/page.tsx`; render only `kind + address + source_code`. One-liner under the card: "Phone & email — sign up free to view." Do NOT fork or wrap the RPC; do NOT add a util in `lib/`. |

---

## File list

- `components/discover/filter-rail.tsx` — NEW. Server module exporting:
  - constants `PAGE_SIZE = 24`, `SORT_OPTIONS`, `ENTITY_TYPES`,
    `CERT_KINDS`, `MIN_SOURCES_OPTIONS`;
  - helpers `asString`, `asStringArray`, `asInt`, `clampSort`,
    `buildQuery`;
  - components `FilterRail({ basePath, q, entityTypes, … })`,
    `SortControl({ basePath, current, baseQuery })`,
    `Pagination({ basePath, page, totalPages, baseQuery })`.
  - `basePath` is the form action + Reset href + sort/page link prefix
    (e.g. `/discover` or `/app/discover`).
- `app/(app)/app/discover/page.tsx` — EDIT. Replace the inline
  `FilterRail`/`SortControl`/`Pagination`/`FilterGroup`/`CheckboxRow`/
  `buildQuery`/constants with imports from the shared module. Pass
  `basePath="/app/discover"`. No other behavioural change. Keeps
  `ResultCard` + `StatLine` inline (they carry SaveButton).
- `app/(marketing)/discover/page.tsx` — REWRITE. Server component,
  `dynamic='force-dynamic'`, calls `discover_suppliers` RPC, renders
  demo banner + shared filter rail (`basePath="/discover"`) + inline
  `PublicResultCard` (no SaveButton; href `/suppliers/{slug}`) +
  pagination + sort control. Same filter parsing & query shape as
  buyer. No new query params beyond what buyer uses.
- `app/(marketing)/suppliers/[slug]/page.tsx` — REWRITE. Server
  component, `dynamic='force-dynamic'`, calls `buyer_supplier_profile`
  RPC, renders demo banner + header (title, entity badge, location,
  completeness, sanctions banner if `is_sanctioned`) + pills card +
  certs card + RSC card + brand attributions card + sanctions hits
  card + provenance details + addresses card (phone/email stripped) +
  documents card + partner factories card + bottom CTA block.
  `generateMetadata` re-sourced from the RPC payload (one extra RPC
  call per request via Next's per-request scope). JSON-LD shape
  preserved verbatim from M4 (`Organization`/`LocalBusiness` branches,
  same fields; `sameAs` dropped because RPC payload has no `website`).
- `components/marketing/demo-banner.tsx` — NEW. Server component,
  plain `<aside aria-label="Demo mode">`, takes a `next` prop
  (current path), renders one-liner + two CTAs.
- `ops/_m5_smoke.py` — NEW. 11 checks (a)–(k) per § "Smoke checks".

Route count delta on `pnpm build`: **0** (the two routes already exist
from F3; M4 added the +2 metadata routes). Tracker stays at 83.

---

## Smoke checks (disk-based, mirror of `_m4_smoke.py`)

- **(a)** Public Discover (`app/(marketing)/discover/page.tsx`) source
  contains `supabase.rpc("discover_suppliers"` and does NOT contain
  `.from("suppliers")` (regression guard against re-introducing the
  F3 minimal SELECT).
- **(b)** Public profile (`app/(marketing)/suppliers/[slug]/page.tsx`)
  source contains `supabase.rpc("buyer_supplier_profile"` (twice — once
  in the page body, once in `generateMetadata`).
- **(c)** Public profile source does NOT import `SaveButton`,
  `ClaimCtaButton`, or `Tabs` — regression guard against client-island
  drift onto an anonymous surface.
- **(d)** Demo banner module (`components/marketing/demo-banner.tsx`)
  exists, has zero `"use client"` pragma, and renders both
  `/signup?next=` and `/login?next=` substrings.
- **(e)** Both public pages import `DemoBanner` from
  `@/components/marketing/demo-banner`.
- **(f)** Shared filter-rail module
  (`components/discover/filter-rail.tsx`) exists, has zero
  `"use client"` pragma, and exports `FilterRail`, `SortControl`,
  `Pagination`, `PAGE_SIZE`, `SORT_OPTIONS`, `ENTITY_TYPES`,
  `CERT_KINDS`, `MIN_SOURCES_OPTIONS`, `buildQuery`.
- **(g)** Buyer Discover (`app/(app)/app/discover/page.tsx`) imports
  from `@/components/discover/filter-rail` — regression guard against
  the shared module silently regressing back into a private copy.
- **(h)** Sitemap on disk still emits `/discover` and at least the
  hardcoded marketing URLs (M4 (a) subset — confirms the M4 sitemap
  was not broken by M5 changes).
- **(i)** Forbidden-token leak — recursive scan of the two rewritten
  source files for `FORBIDDEN_TOKENS` (same set as M3/M4 +
  `supplier_score_internal`, `internal_score`, `\bSBI\b`,
  `nid_number`, `trade_license_number`, `proprietor_nid`,
  `owner_phone`, plus `email_primary`, `phones`, `contact_name`,
  `contact_role`). Diff `[]`.
- **(j)** JSON-LD source inspection of the public profile (mirror of
  M4 (g)): `type="application/ld+json"` present, both
  `"LocalBusiness"` and `"Organization"` branch strings present —
  proves M4 (g) regression is not introduced.
- **(k)** Address-PII render gate: the public profile source must
  read `addresses[…].address` (positive assertion) but must NOT read
  `addresses[…].phone` or `addresses[…].email` (negative assertions).
  Pair check.

PASS → `print("M5 smoke PASSED — 11/11 checks, …")`, exit 0. FAIL →
print each failure, exit 1.

---

## Out of scope

- Fixing `components/marketing/top-nav.tsx`'s broken `/auth/sign-in`
  link. Logged as a follow-up in the M5 closeout entry; no edit in
  this commit.
- Mobile filter-rail collapse on the public surface. Same desktop
  rail layout as the buyer side; mobile UX is a future polish ticket.
- Saved-suppliers / claim / RFQ surfacing on the public profile.
  Anonymous visitors have no auth context; these belong on the
  authenticated equivalents.
- Per-locale OG/twitter overrides for individual supplier slugs.
  Marketing-layout defaults carry through M4-style.
