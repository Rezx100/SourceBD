# Spec M4 — Public marketing SEO baseline

Fourth Phase-5 spec (M1 → M2 → M3 → **M4** → M5; per
`context/phases.md` line 102). Ships the SEO baseline across the public
marketing surface: sitemap, robots, default OpenGraph + Twitter card
metadata in the marketing route-group layout, and inline JSON-LD
(`Organization` on `/`, `Article` on every `/compliance/[slug]`,
`Organization` / `LocalBusiness` on every public `/suppliers/[slug]`
with `is_published=true`).

No new tools, no new dependencies, no DB migration, no new API route.
Re-uses the existing Supabase anon server client + the existing M1/M2/M3
`SITE_URL` constant pattern.

---

## Hard constraints

1. **Receipts-first + SBI doctrine carry forward.** No `sbi_scores`,
   no register PII (`nid_number`, `trade_license_number`,
   `proprietor_nid`, `owner_phone`), no encrypted-body / token columns
   in any JSON-LD payload, OG meta, twitter meta, sitemap entry, or
   robots line.
2. **Source-trust hierarchy is law.** Sitemap entries for
   `/suppliers/[slug]` filter on `is_published=true` — the same gate
   used by F3 / B1 / S1 etc. Sanctioned suppliers stay in the sitemap
   (the public profile already renders for direct visits with a red
   banner; hiding from search would also hide the sanctions banner
   from buyers who Google a supplier name).
3. **No new tools, no new deps, no DB migration.** All work is:
   - 2 new App-Router metadata routes (`app/sitemap.ts`,
     `app/robots.ts`) using Next 15's `MetadataRoute` convention.
   - 1 edit to the existing `app/(marketing)/layout.tsx` to export
     `metadata` defaults.
   - 3 edits to existing marketing pages to inject inline JSON-LD via
     `<script type="application/ld+json">` with
     `dangerouslySetInnerHTML={{__html: JSON.stringify(...)}}`.
   - 1 new disk-based smoke `ops/_m4_smoke.py` mirroring `_m3_smoke.py`.
4. **`next/script` is forbidden for JSON-LD.** It is a runtime-loader
   component designed for behaviour, not metadata; using it adds
   client-side cost on a fully-static page and gates the JSON-LD on
   hydration. Inline `<script type="application/ld+json">` injected
   with `dangerouslySetInnerHTML` is the React-idiomatic way to ship
   SEO metadata on a server component.
5. **Supabase anon client only in `app/sitemap.ts`.** No service-role.
   The `select slug, updated_at from public.suppliers where
   is_published = true` query is already covered by
   `pol_suppliers_pub_read`. The sitemap is public output served to
   crawlers — running it under the service-role key would be a
   defence-in-depth regression.
6. **Sitemap query is fault-tolerant.** Wrap the SELECT in
   `try/catch`; on failure return only the static routes so a
   transient Supabase outage doesn't fail `pnpm build`. Log the
   supplier count to stdout via `console.log("[m4] sitemap suppliers:
   <N>")` so the build log shows the count (same convention as
   `[m1]` logs in M1's `marketing_stats` fetch).
7. **JSON-LD on `/suppliers/[slug]` only emits fields already in the
   page's SELECT.** Do not widen the SELECT. Today the page reads
   `id, slug, company_name, entity_type, city, district, country,
   website, source_tags, bgmea_verified, bkmea_verified,
   bgapmea_verified, btma_verified, claimed_by, is_sanctioned` — only
   those fields may appear in the JSON-LD payload (none of them is
   contact PII or SBI by construction).
8. **`metadataBase` set on the marketing layout, not the root.** The
   root `app/layout.tsx` has no `openGraph` / `twitter` /
   `metadataBase` keys today (verified) — leave it alone so the
   marketing route-group is the single owner of marketing OG
   defaults. If a future spec needs OG on authenticated surfaces it
   can ship its own layout-level metadata.
9. **Robots disallow list is the security boundary for crawler
   exposure, not for auth.** Auth is enforced by middleware on every
   `/app/**`, `/supplier/**`, `/admin/**` route; the disallow list is
   just a politeness signal to compliant crawlers so they don't waste
   crawl budget. Smoke check (b.2) explicitly asserts
   `Disallow: /compliance` and `Disallow: /pricing` do NOT appear —
   these are the indexable money pages.

---

## Locked-in JCs (12 — acked by user this session)

| # | Decision |
|---|----------|
| 1 | Sitemap is a single `app/sitemap.ts` (`MetadataRoute.Sitemap`). Static routes + 5 compliance slugs + paged supplier read. No sitemap index. |
| 2 | `revalidate = 3600` on the sitemap — daily ETL cadence + hourly ISR is fine. Supabase **anon** client; SELECT wrapped in try/catch; counts logged to stdout. |
| 3 | Robots disallow: `/app/`, `/supplier/`, `/admin/`, `/api/`, `/auth/`, `/dev/`, `/suspended/`. Allow `/`, `/discover`, `/suppliers/`, `/pricing`, `/compliance`, `/legal/`, `/login`, `/signup`. `Sitemap: ${SITE_URL}/sitemap.xml`. |
| 4 | `app/(marketing)/layout.tsx` exports `metadata` with `metadataBase: new URL(SITE_URL)`, `openGraph: { siteName, locale: 'en_GB', type: 'website', title, description }`, `twitter: { card: 'summary_large_image', title, description }`. Pages that already set `openGraph` (home, compliance detail) override. Root `app/layout.tsx` is untouched (verified no conflicting keys today). |
| 5 | No `twitter.site` / `twitter.creator` — no verified @-handle exists; do not fabricate. |
| 6 | No OG image asset — none exists in `public/`. Cards render as text-only previews; nothing fabricated. |
| 7 | `Article` JSON-LD on each `/compliance/[slug]` uses `last_reviewed_at` for both `datePublished` and `dateModified`. Inline comment explains why (single review-date field). |
| 8 | Supplier JSON-LD: `@type: LocalBusiness` when `city \|\| district` present, else `@type: Organization`. Always emit `name`, `url` (canonical), `sameAs: [website]` when present, `address: { addressLocality, addressRegion, addressCountry }` when any present. No `telephone` / `email` (gated PII). |
| 9 | Sanctioned suppliers stay in the sitemap (parity with the public profile being visible to direct visitors). |
| 10 | `lastModified` per supplier = `suppliers.updated_at`. `changeFrequency: 'weekly'`, `priority: 0.6`. |
| 11 | Smoke is disk-based against `.next/server/app/*.html` + the sitemap/robots `.body` artefacts. Force-dynamic surfaces (`/discover`, `/suppliers/[slug]`) are validated by source-file regex (mirroring the `assertContentFresh` fallback in M3 step f). |
| 12 | Smoke globs `.next/server/app/sitemap*` and `robots*` and picks the largest text file — avoids hardcoding the Next 15.5.18 layout. |

---

## File list

- `app/sitemap.ts` — NEW. `MetadataRoute.Sitemap`, `revalidate = 3600`,
  static routes + 5 compliance slugs (from `COMPLIANCE_PAGES`) +
  `/discover` + every `is_published=true` supplier slug. Supabase anon
  read in try/catch.
- `app/robots.ts` — NEW. `MetadataRoute.Robots`, single rule allowing
  all + disallow array per JC #3, sitemap URL per JC #3.
- `app/(marketing)/layout.tsx` — EDIT. Add `export const metadata`
  with `metadataBase` + default `openGraph` + default `twitter`.
- `app/(marketing)/page.tsx` — EDIT. Inject JSON-LD `Organization`
  inline. No other change.
- `app/(marketing)/compliance/[slug]/page.tsx` — EDIT. Inject JSON-LD
  `Article` inline per page.
- `app/(marketing)/suppliers/[slug]/page.tsx` — EDIT. Add
  `generateMetadata` + inject JSON-LD `Organization` /
  `LocalBusiness` inline.
- `ops/_m4_smoke.py` — NEW. 8 checks (a)–(h) per § "Smoke checks"
  below.

Route count delta on `pnpm build`: **+2** (`/sitemap.xml`,
`/robots.txt`). Tracker advances 81 → 83. Anything else is a bug.

---

## Smoke checks (disk-based, mirror of `_m3_smoke.py`)

- **(a)** Sitemap on disk (glob `.next/server/app/sitemap*`, pick
  largest text artefact): contains `/`, `/pricing`,
  `/legal/trademarks`, `/compliance`, all 5 `/compliance/{slug}`,
  `/discover`, and ≥1,000 `/suppliers/{slug}` entries.
- **(b)** Robots on disk (glob `.next/server/app/robots*`): has
  `User-agent: *`, the 7 `Disallow:` lines per JC #3, and a
  `Sitemap:` line ending in `/sitemap.xml`.
- **(b.2)** Robots body does NOT contain `Disallow: /compliance` or
  `Disallow: /pricing` (regression guard against typo'ing money
  pages into the disallow list).
- **(c)** Marketing-layout OG defaults inherited — `/pricing` HTML
  has `og:site_name="SourceBD"` + `og:locale="en_GB"` (proves layout
  defaults reach a page that does not itself set `openGraph`).
- **(d)** Twitter card meta — `/` and `/pricing` both carry
  `<meta name="twitter:card" content="summary_large_image">`.
- **(e)** JSON-LD `Organization` on `/` — at least one
  `<script type="application/ld+json">` block parses to an object
  with `@type: "Organization"`, `name: "SourceBD"`, `url: SITE_URL`.
- **(f)** JSON-LD `Article` on each `/compliance/{slug}` — one block
  per page with `@type: "Article"`, non-empty `headline`,
  non-empty `datePublished` + `dateModified`, `mainEntityOfPage`
  equals the canonical URL.
- **(g)** JSON-LD on `/suppliers/[slug]` — source inspection of
  `app/(marketing)/suppliers/[slug]/page.tsx`: regex-assert the
  inline JSON-LD `<script>` block exists and contains both
  `"Organization"` and `"LocalBusiness"` branches.
- **(h)** Forbidden-token leak — recursive scan of all M4-touched
  HTML for SBI / register-PII tokens (same forbidden set as M3
  step g). Diff `[]`.

PASS → `print("M4 smoke PASSED — 8/8 checks, …")`, exit 0. FAIL →
print each failure, exit 1.

---

## Out of scope

- OG image asset (`/og-default.png`). Deferred to a future
  marketing/design ask; the spec ships text-only previews.
- Twitter `@-handle`. No verified account exists yet; add when it
  does.
- Sitemap index / pagination. Single sitemap fits comfortably under
  the 50k-URL cap.
- `BreadcrumbList` JSON-LD. Out of scope for the baseline; can be
  added in a follow-up if SERP breadcrumbs become a priority.
- Faceted-search canonicalisation for `/discover?q=…`. The public
  discover page is force-dynamic and not in the sitemap; its
  canonical handling is its own spec.
