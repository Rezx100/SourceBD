# Spec M6 — Marketing v2 (homepage + auth + chrome redesign)

> Phase 7 spec authored 6 Jun 2026. Re-skin every anonymous and
> conversion surface (homepage, auth, pricing, legal, demo chrome) to
> the dark + light "cinematic register" visual language landed in
> `sourcebd-design-system/` (Claude Design handoff bundle). Keeps the
> existing data contracts, RPC names, server actions, rate-limit
> classes and ISR boundaries — **only** the visual layer, tokens,
> typography, animations and copy *outside the locked blocks* change.

## 0. Why this spec exists

The Phase-5 marketing surface (M1–M5) shipped a functional but
under-designed visual layer (single-column, light-only, no motion).
The Claude Design bundle delivers a cohesive cinematic dark + light
homepage and split-pane auth pages that match SourceBD's positioning
(neutral public-record index, receipts-first, government-grade
authority). M6 ports that visual language into the production stack
while preserving every guard rail that Phase 1–6 put in place.

This is **not a token migration for the app**. Tokens are scoped to
the marketing + auth surfaces only; buyer / supplier / admin chrome
inside `/app`, `/supplier`, `/admin` is untouched.

## 1. Hard constraints (re-read every session before touching code)

1. **No SBI numeric, no "score" headline.** α/β/γ doctrine
   (20 May 2026, `progress-tracker.md`; `ai-workflow-rules.md` Hard
   Prohibitions; `architecture.md` Invariants). No numeric SBI on
   any redesigned surface. No word "score", "rating", "ranking", or
   A-D letter-grade in any new copy. Methodology block stays
   receipts-first.
2. **Per-factory authenticity rule.** `logos.lock.md` §3 Tier 4
   header (the **Authenticity rule (hard)** paragraph + the
   **Narrow OSH extension (2026-05-19)** paragraph) is a
   smoke-asserted lockfile block. Reproduce verbatim — no
   paraphrase, no truncation, no editorial smoothing.
3. **Source-trust hierarchy is law.** Tier 1 → Tier 6 ordering and
   per-tier `display label / meaning` text reproduced verbatim from
   `logos.lock.md` §1. Tier **numeric weights** are NOT published.
   New tier color tokens (`--mkt-tier-gov`, `--mkt-tier-assoc`, etc.)
   replace the legacy non-scoped tier colors only on marketing
   surfaces; admin tier badges (`--tier-bronze` … `--tier-platinum`)
   are untouched.
4. **Anonymous data boundary unchanged.** Marketing surfaces continue
   to use `public.marketing_stats()` (M1) and
   `public.discover_facets()` + `public.discover_suppliers(...)`
   (B1, refactored in I-029). **No new RPC.** No new column. No new
   ETL job. No fake numbers in the rendered HTML — every counter,
   every "10,122" must come from the RPC at render time.
5. **No new tools.** Tailwind + shadcn-style primitives + Phosphor
   SSR icons + Supabase server client + Next.js 15 RSC. The new
   homepage's two animated regions (hero particle field + integrity
   engine reveal) are CSS-only where possible; one tiny client island
   per region for `IntersectionObserver` triggers. No GSAP, no
   Framer Motion, no Lottie, no Three.js, no `<canvas>` particle
   library, no font subsetter beyond Google Fonts' own delivery.
6. **No SSO.** The bundle ships Google / Microsoft SSO buttons. Our
   Supabase project has no OAuth providers configured and adding
   them is out of scope. SSO buttons are dropped from the auth
   redesign; the split-pane composition stays. (Future SSO work is
   a separate Phase-8 spec.)
7. **Rate limits, server actions, RLS unchanged.** H2 limits on
   `/login` `/signup` `/forgot-password` `/reset-password` stay
   (`LIMIT_AUTH=10/min`, IP-bucketed). Existing server actions in
   `app/(auth)/actions.ts` are reused unchanged. No route paths
   change. The I-033 client island for `MarketingTopNav` stays —
   nav still SSRs the anon variant and swaps via
   `/api/session/me`. The I-034 marketing→app redirect for
   buyers/admins on `/discover` and `/suppliers/<slug>` stays.
8. **ISR boundaries preserved.** `/` stays `force-static` +
   `revalidate=600`. `/pricing` stays `force-static`. `/discover`
   stays `revalidate=300`. `/suppliers/[slug]` stays
   `revalidate=300`. `/legal/trademarks` stays `force-static`.
   `/compliance/*` stays `force-static`.
9. **Fonts: marketing-scoped only.** The bundle uses Archivo (display)
   + Hanken Grotesk (body) + IBM Plex Mono (data). The existing
   `/app /supplier /admin` surfaces use Bricolage Grotesque + Plus
   Jakarta Sans + JetBrains Mono and stay on those fonts. Add the
   new triad via `next/font/google` loaded **only** in
   `app/(marketing)/layout.tsx` + `app/(auth)/layout.tsx`. Update
   `context/frontend-design-spec.md` §1 to document the split
   (marketing typeface stack vs product typeface stack) as part of
   this spec — that file is the authoritative source of truth and
   must reflect reality.
10. **No regression of the I-027 skeletons or the I-029..I-032
    caching batch.** Skeletons live under each route segment's
    `loading.tsx`; the marketing redesign provides matching dark
    skeleton shapes where the new shell is dark, light shapes where
    it is light. `unstable_cache`-wrapped helpers (`fetchDiscoverFacets`,
    `fetchPublicDiscoverSuppliers`) are not touched.
11. **Accessibility floor.** Exactly one `<h1>` per page. All
    interactive elements reachable by keyboard. Every animation
    honours `prefers-reduced-motion: reduce` via the global
    override already in `app/globals.css`. WCAG 2.2 AA contrast on
    every text-on-image surface; dark hero ink ≥ 7:1 on the green-950
    background.
12. **JSON-LD preserved.** The M4 Organization + LocalBusiness JSON-LD
    blocks already rendered inline by `app/(marketing)/page.tsx`
    must survive the rewrite — they are SEO-load-bearing.
13. **No Tier 6 source rendered as primary.** The "live ticker" and
    "integrity engine" sections name only Tier 1–4 authorities
    (BGMEA, BKMEA, BTMA, BGAPMEA, EPB, RJSC, DIFE, RSC, OEKO-TEX,
    GOTS, WRAP, brand authorities under the M1 allow-list).
    Brand authority logos may appear; cross-check Tier 6 sources
    (third-party exporter PDFs, LinkedIn) must not.
14. **`affiliation-disclaimer` paragraph stays.** The existing
    "SourceBD is not affiliated with or endorsed by BGMEA…" footer
    paragraph in `app/(marketing)/page.tsx` is a legal posture; it
    is preserved verbatim in the rewritten homepage.

## 2. Judgement-call ledger (resolved at spec-author time)

| JC | Question | Decision |
|---|---|---|
| 1 | Adopt the bundle's full forest 50→950 ramp **app-wide** or **marketing-only**? | **Marketing-only.** Add tokens under `[data-surface="marketing"]` selector in `globals.css` so app surfaces are not perturbed. Marketing layout sets `data-surface="marketing"` on its root `<div>`. |
| 2 | Replace existing `--brand-forest` (`#1f4d3a`) with new `--mkt-green-700` (`#19543A`)? | **No.** Keep the existing single-token brand color on the app side. New `--mkt-green-*` ramp is additive and scoped. Marketing wordmark uses `--mkt-green-300` on dark, `--mkt-green-700` on light. |
| 3 | Adopt new font triad (Archivo / Hanken / Plex Mono) app-wide or marketing-only? | **Marketing-only.** Load via `next/font/google` in `app/(marketing)/layout.tsx` and `app/(auth)/layout.tsx`. Apply through scoped CSS variables (`--mkt-font-display`, `--mkt-font-body`, `--mkt-font-mono`) so the buyer app's Bricolage / Plus Jakarta remain unchanged. Amend `context/frontend-design-spec.md` §1 to document the split as part of M6a's commit. |
| 4 | Hero "10,122 indexed suppliers" copy in the headline — hardcode or live? | **Live, via `marketing_stats()`.** Headline pattern: "The verified register of **{n}** Bangladesh garment factories." with `{n}` from `suppliers_indexed`. On RPC failure → fall back to "the verified register of Bangladesh garment factories" with `{n}` omitted (not "—"). |
| 5 | Hero "verified dossier" mock-up: real supplier or synthetic? | **Real, pre-selected.** Hard-code one well-known published supplier (`slug = 'cotton-club-bd-ltd'` if present in prod; otherwise the alphabetically-first published supplier with ≥4 Tier 1–3 sources). Render its real `t13_source_count` bar and 3 source-pill rows. No PII (no email, no phone, no contact name). Fetched once at build via the existing anon `buyer_supplier_profile` RPC. If the supplier is missing or sanctioned, fall back to a fully synthetic card flagged `aria-hidden="true"`. |
| 6 | Live integrity-engine "scanning" mock-up — animate over real source URLs or generic? | **Generic decorative cards.** The three scanning windows show `bgmea.com.bd`, `dife.gov.bd`, `oeko-tex.com` as URL strings (the public publisher domains we already cite in `lib/source-links.ts`); the "captured" output row is hard-coded to the same supplier as JC #5. No live scrape, no XHR, no streaming. Purely decorative animation states. |
| 7 | Animated word-up text reveal on hero `<h1>`: keep? | **Keep, behind `prefers-reduced-motion`.** Hero `<h1>` words wrapped in `<span class="mkt-word">` with `overflow: hidden`; inner `<span>` translates up via CSS `@keyframes mkt-wordUp` triggered by adding a `.in` class to the parent hero on mount (single client island). When `prefers-reduced-motion: reduce` is set, words render at final position with `transform: none` and no animation. |
| 8 | Particle canvas in hero: keep? | **Keep, lightweight.** Single `<canvas>` element drawn by a 60-line client island (`components/marketing/hero-particles.tsx`). Particle count ≤ 50, paused on tab blur (`document.hidden`), paused on `prefers-reduced-motion: reduce`, paused on `matchMedia('(max-width: 720px)')`. No external library. |
| 9 | "Trusted by" markstack (avatar pop-in) — what initials? | **Tier 1/2 authority codes.** Render the first 5 codes from `MARKETING_QUALIFYING_SOURCES` (BEPZA, DIFE, EPB, RJSC, RSC) as 2-letter monogram tiles. Not a customer logo wall — we have no customer logos to publish. Adjacent copy: "Indexes **{tier1+tier2 source count}** primary registers across government and trade associations." Number from `marketing_stats.sanctions_lists_screened + suppliers_with_tier1or2_source` is wrong; use a new `loadAuthorityCount()` helper that counts `sources where tier in ('tier1_gov','tier2_industry')` server-side at render. |
| 10 | "Live ticker" marquee content | **Static, pre-curated.** A const array of 16 short status lines composed at build (e.g. `"BGMEA member register · refreshed daily"`, `"RSC remediation index · 1,605 factories"`, `"OEKO-TEX STANDARD 100 · 412 certificates mirrored"`). No DB fetch on the ticker itself. The numbers cited in the ticker must be smoke-verified against the live DB at build (smoke step §6.A.3). |
| 11 | Auth pages: keep magic-link option? | **Yes.** The redesigned `/login` keeps both password and magic-link forms; just restyled. `/signup` keeps the role selector (buyer / supplier) hidden behind a small dropdown rather than the prominent two-button choice. `/forgot-password` and `/reset-password` re-skinned. All four pages share the new `AuthShellLayout` (split-pane brand left, form right, mobile = form only). |
| 12 | Drop legacy `app/(auth)/layout.tsx` `<Card>` wrapper? | **Yes.** Replace with the split-pane `AuthShellLayout`. Existing `Card` primitive elsewhere in the app is unaffected. |
| 13 | "DemoBanner" on `/discover` and `/suppliers/<slug>` — keep or restyle? | **Restyle.** Same component, new visual language (dark glass strip with `mkt-` tokens). Copy unchanged. Component stays in `components/marketing/`. |
| 14 | New top-nav design with the bundle's animated underline hover | **Keep current `MarketingTopNav` client island** (shipped in I-033) and re-skin the inside. The session-aware swap, the `/api/session/me` fetch, and the SSR anon-variant fallback all stay. Only CSS / spacing / colors change. |
| 15 | Marketing footer redesign | **New `MarketingFooter`.** Bundle adds columns (Product · Verification · Company · Legal). Real links only: Product → `/discover` `/pricing`. Verification → `/compliance`. Company → external company page (n/a v1 — omit column header rather than ship a dead link). Legal → `/legal/trademarks`. **No "About" / "Blog" / "Careers" placeholder links** — H7 has not landed yet. |
| 16 | New tier color tokens vs existing `--tier-bronze`..`--tier-platinum` | **Coexist.** `--mkt-tier-gov` `--mkt-tier-assoc` `--mkt-tier-cert` `--mkt-tier-brand` `--mkt-tier-sanction` `--mkt-tier-xcheck` are new (per-tier-of-evidence colors used in marketing dossier mocks). `--tier-bronze`..`--tier-platinum` are admin-only Bronze/Silver/Gold/Platinum tier badge colors and are not touched. The two sets do not collide because they don't share names. |
| 17 | `/pricing` page redesign scope | **In scope (M6b).** Re-skin to dark+light marketing chrome; copy stays "Pricing coming after public beta" per the Phase-5 M2 decision and the H3 deferral. No Stripe checkout, no plan picker. |
| 18 | `/compliance/*` pages redesign scope | **Out of scope.** M3 already shipped substantial content there; touching it forces a separate copy-lockfile pass. M6 leaves `/compliance/*` on the legacy chrome. If a follow-up redesign is needed, file a separate spec. |
| 19 | `/legal/trademarks` redesign scope | **Light-touch chrome only.** Wrap the existing verbatim content in the new marketing chrome (top-nav, footer, new tokens) but do not edit copy. The trademark page text is from `logos.lock.md` §5 rule #5 — verbatim. |
| 20 | Reduce-motion fallback for the sheen sweep / scan lines / spin rings | **Static state.** Under `prefers-reduced-motion: reduce`, sheen / scan / ring spin / bob / marquee / word-reveal all render at their *settled* visual state (no CSS animation, no transform), per the global override in `app/globals.css`. Smoke check 6.A.6 asserts every new `@keyframes` rule has a `prefers-reduced-motion: reduce` companion (or relies on the global `animation-duration: 0` reset, which is sufficient). |

## 3. Token additions (M6a, scoped to marketing + auth)

All new tokens live under a `[data-surface="marketing"]` selector
block in `app/globals.css`. The marketing root layout
(`app/(marketing)/layout.tsx`) and the auth root layout
(`app/(auth)/layout.tsx`) add `data-surface="marketing"` on their
outermost `<div>`. **Nothing else** sets that attribute.

Token set (lifted from `sourcebd-design-system/project/colors_and_type.css`
+ the homepage's dark-mode block — superset of both):

```css
[data-surface="marketing"] {
  /* Forest green ramp */
  --mkt-green-50:  #EEF5EF;
  --mkt-green-100: #DBEBE0;
  --mkt-green-200: #B7D6C1;
  --mkt-green-300: #8CBC9D;
  --mkt-green-400: #4E9268;
  --mkt-green-500: #2E7D52;
  --mkt-green-600: #1F6843;
  --mkt-green-700: #19543A;
  --mkt-green-800: #123E2B;
  --mkt-green-900: #0C2C1F;
  --mkt-green-950: #071c14;

  /* Warm-ink neutrals */
  --mkt-ink-900: #16191B;
  --mkt-ink-800: #23272A;
  --mkt-ink-700: #3A3F40;
  --mkt-ink-500: #6B6F69;
  --mkt-ink-400: #8C9088;

  /* Canvas / hairlines (light surface) */
  --mkt-line:        #E4E3D7;
  --mkt-line-strong: #D2D1C3;
  --mkt-canvas:   #F5F4EC;
  --mkt-canvas-2: #ECEADE;
  --mkt-paper:    #FFFFFF;

  /* Tier-of-evidence (dark-on-light + light-on-dark variants) */
  --mkt-tier-gov:        #5B7CFF; --mkt-tier-gov-d:      #2A3A78; --mkt-tier-gov-bg:      #E7EAF6;
  --mkt-tier-assoc:      #3FBE86; --mkt-tier-assoc-d:    #19543A; --mkt-tier-assoc-bg:    #DEEDE3;
  --mkt-tier-cert:       #26C0CE; --mkt-tier-cert-d:     #0E7C86; --mkt-tier-cert-bg:     #DCF0F1;
  --mkt-tier-brand:      #E0A93C; --mkt-tier-brand-d:    #8A6310; --mkt-tier-brand-bg:    #F4EAD3;
  --mkt-tier-sanction:   #F0766B; --mkt-tier-sanction-d: #A22B25; --mkt-tier-sanction-bg: #F6E1DF;
  --mkt-tier-xcheck:     #9aa39c;                                  --mkt-tier-xcheck-bg:   #EAE9DE;

  /* Glass (dark-mode hero, integrity engine, metrics band) */
  --mkt-glass:        rgba(255,255,255,.035);
  --mkt-glass-2:      rgba(255,255,255,.055);
  --mkt-glass-border: rgba(140,188,157,.15);
  --mkt-glass-border-h: rgba(140,188,157,.44);

  /* Text on dark hero */
  --mkt-text-1: #fff;
  --mkt-text-2: rgba(232,242,235,.74);
  --mkt-text-3: rgba(214,230,220,.5);

  /* Radii — distinct from app to allow pill/hero variants */
  --mkt-r-sm:  8px;
  --mkt-r-md:  12px;
  --mkt-r-lg:  18px;
  --mkt-r-xl:  24px;
  --mkt-r-pill: 999px;

  /* Shadows — heavier than the app's L1/L2 for cinematic depth */
  --mkt-shadow-sm: 0 1px 2px rgba(16,32,24,.05), 0 1px 1px rgba(16,32,24,.04);
  --mkt-shadow-md: 0 4px 16px -4px rgba(16,40,28,.12), 0 2px 6px -2px rgba(16,40,28,.07);
  --mkt-shadow-lg: 0 24px 60px -20px rgba(10,44,31,.22), 0 8px 22px -12px rgba(10,44,31,.14);

  /* Layout */
  --mkt-maxw: 1200px;

  /* Type stack — populated by next/font CSS variables (see §4) */
  /* font families are wired via className on the layout root, not via raw @font-face */
}
```

The new tokens do not appear in `tailwind.config.ts` — marketing
components consume them via raw CSS (`style={{...}}`) or via
`@apply` inside the marketing block in `globals.css`. This keeps
the app-side Tailwind token surface unchanged.

## 4. Font wiring

`app/(marketing)/layout.tsx` and `app/(auth)/layout.tsx` each load:

```tsx
import { Archivo, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--mkt-font-display",
  display: "swap",
});
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--mkt-font-body",
  display: "swap",
});
const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--mkt-font-mono",
  display: "swap",
});
```

The font className triple
(`${archivo.variable} ${hanken.variable} ${plex.variable}`) is
applied to the marketing/auth root `<div>` alongside
`data-surface="marketing"`. Marketing CSS then references the
families via `font-family: var(--mkt-font-display)` etc.

The app surfaces continue to load Bricolage Grotesque + Plus
Jakarta Sans + JetBrains Mono via `app/layout.tsx`'s existing wiring
(do not modify it). The new fonts add ~120 KB of compressed font
binaries but only on marketing + auth routes (Next splits font
delivery per layout).

`context/frontend-design-spec.md` §1 amended in the M6a commit to
document:

> | Display font (marketing) | Archivo |
> | Body font (marketing) | Hanken Grotesk |
> | Mono font (marketing) | IBM Plex Mono |
> | Display font (app) | Bricolage Grotesque |
> | Body font (app) | Plus Jakarta Sans |
> | Mono font (app) | JetBrains Mono |

## 5. App surfaces — sub-batch plan

M6 ships as **two sub-batches**, each one a clean session per the
"one spec per session" discipline (specs may be batched when each
sub-spec is small and one acceptance gate covers both).

### M6a — Tokens, fonts, homepage, top-nav, footer, demo banner

**New files**

- `components/marketing/hero-particles.tsx` (`"use client"`) — ≤60-line
  canvas particle field with the reduce-motion + tab-hidden + mobile
  guards in JC #8.
- `components/marketing/hero-reveal.tsx` (`"use client"`) — single
  `IntersectionObserver` mount that toggles `.in` on `[data-mkt-reveal]`
  elements once they enter the viewport. Also adds `.in` to
  `[data-mkt-hero]` on mount for the word-up animation. Reduce-motion
  short-circuits both.
- `components/marketing/integrity-engine.tsx` (server component) —
  the three "scanning" source-window mocks + the captured output
  card. Pure CSS animation; opens a tiny client island only if
  IntersectionObserver-triggered staging is needed. Otherwise CSS
  keyframes loop unconditionally (cheap).
- `components/marketing/live-ticker.tsx` (server component) — the
  bottom-of-metrics marquee using the JC #10 static array.
- `components/marketing/footer.tsx` rewrite (existing
  `MarketingFooter` is replaced; same export name; same component
  signature so `app/(marketing)/layout.tsx` need only swap nothing).
- `lib/marketing/showcase-supplier.ts` (server-only) — fetches the
  JC #5 showcase supplier dossier via the existing anon-granted
  `buyer_supplier_profile` RPC, wrapped in `unstable_cache(...,
  { revalidate: 3600, tags: [TAG_DISCOVER_FACETS] })`. Returns a
  narrow `ShowcaseSupplier` type with `name`, `city`, `district`,
  `entity_type`, `t13_source_count`, and the top 3
  `source_records` rows (no PII).
- `lib/marketing/authority-count.ts` (server-only) — reads
  `sources where tier in ('tier1_gov','tier2_industry')` once per
  build via `unstable_cache(..., { revalidate: 3600 })`.

**Rewritten files**

- `app/(marketing)/layout.tsx` — adds `data-surface="marketing"` +
  font CSS variables to the outermost `<div>`. Mounts the new
  `MarketingFooter`. `MarketingTopNav` import unchanged
  (I-033 client island re-skinned but exported under the same name).
- `app/(marketing)/page.tsx` — full rewrite. Section order:
  1. **Hero** (dark) — eyebrow chip, headline (JC #4 live number,
     word-up reveal), lede, search bar that POST-GETs to
     `/discover?q=`, hero-tags row, plus the 3-D-tilted "verified
     dossier" mock-up on the right side fed by the JC #5
     `ShowcaseSupplier`. `hero-particles` canvas underlays. JSON-LD
     Organization/LocalBusiness blocks preserved verbatim from
     current `page.tsx`.
  2. **Metrics band** — five tiles inside a glass card overlapping
     the hero seam, fed by `loadStats()` (existing). Last-updated
     footer row + a `live-pip` element. Tile labels unchanged from
     M1 / JC #4 of M1.
  3. **Live ticker** marquee using `live-ticker.tsx`.
  4. **Trust ladder + receipts sticky aside** — the bundle's
     `.ladder` layout. Left column = 6 tier rows from
     `TIER_HIERARCHY` (verbatim from `logos.lock.md` §1 — same
     constant currently in `page.tsx`, reused). Right column =
     sticky "Receipts on every claim" card.
  5. **Authorities logo wall** — the JC #9 monogram tiles for the
     5 Tier-1 + 4 Tier-2 authority codes (`BEPZA`, `DIFE`, `EPB`,
     `RJSC`, `RSC`, `BGMEA`, `BKMEA`, `BTMA`, `BGAPMEA`). Typography
     wordmarks only per Spec M1 JC #1 — no SVG, no `<img>`.
  6. **Integrity engine** — three scanning windows + captured
     output card via `integrity-engine.tsx`. JC #6 generic
     domain strings; output card uses the JC #5 showcase supplier.
  7. **Positioning** — "What SourceBD isn't" 3-card row using
     bundle's `.pos-cols` layout. Cards: "Not a marketplace",
     "Not a broker", "Not a rating agency". Body copy lifted from
     `architecture.md`'s α/β/γ rationale (the marketplace-vs-rater
     paragraph) — re-phrased into 3 cards. **Must not invent
     additional positioning claims.**
  8. **Trust sources** — the existing typography wordmark grid
     grouped by tier label (kept from current `page.tsx`,
     re-styled). Verbatim from M1 JC #1.
  9. **How we verify** — same three subsections as M1: source trust
     hierarchy (`<dl>` reused), per-factory authenticity rule
     (`<blockquote>` reused **verbatim** — locked block), receipts-first
     posture (one paragraph, reused verbatim from M1 / JC #3).
 10. **Founder story** — `<h2>Why we built this</h2>` + existing
     `FOUNDER_STORY` constant unchanged. `<!-- FOUNDER: replace
     before launch -->` comment preserved.
 11. **CTA box** — green-700 gradient card with "Start free" + "See
     a sample profile" CTAs. Latter links to the JC #5 showcase
     supplier slug.
 12. **`affiliation-disclaimer` paragraph** — preserved verbatim
     from current `page.tsx`.
 13. Footer rendered by layout.

- `components/marketing/top-nav.tsx` (I-033 client island) — copy +
  styling updated to use `mkt-` tokens and the green-950 dark band
  with backdrop-blur "scrolled" state. Logic (anon SSR variant +
  fetch `/api/session/me` + swap) unchanged. Add the bundle's
  `.wm-glyph` shield SVG to the wordmark.
- `components/marketing/demo-banner.tsx` (I-013 / M5 component) —
  restyle only.

**M6a smoke** — `ops/_m6a_smoke.py`. Mirrors `_m1_smoke.py` shape,
single-SSH-at-a-time. Checks listed in §6.A below.

**M6a acceptance gate**

1. Build green (`pnpm exec tsc --noEmit`, `pnpm exec next lint`,
   `pnpm build`).
2. `/`, `/legal/trademarks`, `/discover` (anon), `/suppliers/<slug>`
   (anon), `/login`, `/signup` all return 200 on the VPS.
3. `pnpm exec next build` static-prerender output for `/` ≤ 80 KB
   gzipped HTML.
4. `/api/health` reports ok, container healthy.
5. M1 smoke (`ops/_m1_smoke.py`) still passes — same RPC contract,
   same lock-block text on the page.

### M6b — Auth pages + pricing + legal chrome

**New files**

- `components/auth/auth-shell-layout.tsx` — split-pane (brand
  panel left, form panel right; mobile = form only). Brand panel
  takes `headline` + `sub` + `proofCard` props so each auth page can
  set its own copy without forking the layout.

**Rewritten files**

- `app/(auth)/layout.tsx` — drops the existing centred `<Card>`
  shell. Mounts the new `AuthShellLayout`. Adds
  `data-surface="marketing"` + the new font CSS variables (same
  treatment as marketing layout). Children become the form panel.
- `app/(auth)/login/login-form.tsx` — full restyle. Server actions
  (`signInWithPassword`, `signInWithMagicLink`) imported unchanged
  from `app/(auth)/actions.ts`. Magic-link form stays. Add the
  bundle's animated underline, password show/hide toggle (client
  component), "Keep me signed in" checkbox (cosmetic only —
  Supabase session lifetime is set server-side; the checkbox
  surfaces server's existing behaviour, not a new feature).
- `app/(auth)/signup/page.tsx` + form — restyled. Role-picker
  collapsed into a small dropdown per JC #11.
- `app/(auth)/forgot-password/page.tsx` + form — restyled.
- `app/(auth)/reset-password/page.tsx` + form — restyled.
- `app/(marketing)/pricing/page.tsx` — restyled to new chrome.
  Copy unchanged ("Pricing coming after public beta").
- `app/(marketing)/legal/trademarks/page.tsx` — chrome restyled,
  body copy untouched.

**M6b smoke** — `ops/_m6b_smoke.py`. Single-SSH-at-a-time.

**M6b acceptance gate**

1. Build green; lint green; typecheck green.
2. All four auth routes return 200; submitting an invalid login
   surfaces the existing server-action error string in the
   re-styled chrome.
3. Magic-link form still triggers the existing Supabase email
   path (verified by checking server logs for the existing magic-link
   server-action invocation; no live email assertion).
4. `/pricing` and `/legal/trademarks` 200 with new chrome.
5. F3 happy-path E2E (already in `tests/e2e/`) still passes if the
   project has it; otherwise manual sign-in smoke via curl.

## 6. Smoke harness specs

### 6.A `ops/_m6a_smoke.py`

Disk + on-VPS checks (PASS / FAIL per check, hard-fail if any FAIL):

1. **Token block on disk.** `app/globals.css` contains a
   `[data-surface="marketing"]` block declaring every `--mkt-*`
   token listed in §3. (`grep` for each name.)
2. **Layout wires `data-surface`.** `app/(marketing)/layout.tsx`
   contains `data-surface="marketing"` on the outermost element.
3. **Locked copy blocks.** `app/(marketing)/page.tsx` contains the
   verbatim "Authenticity rule (hard)" + "Narrow OSH extension
   (2026-05-19)" paragraphs from `context/logos.lock.md` §3 — byte
   equality check after stripping React JSX scaffolding.
4. **Tier hierarchy rows.** The 6-row `TIER_HIERARCHY` constant
   matches `context/logos.lock.md` §1 verbatim.
5. **No banned tokens.** `app/(marketing)/page.tsx` contains zero
   occurrences of: `"sbi"`, `"SBI"`, `"score"` (except inside the
   negation phrase "never a SourceBD-proprietary supplier score"),
   `"rating"`, `"A grade"`, `"B grade"`. Case-insensitive regex.
6. **Reduced-motion safety.** Every new `@keyframes` rule in
   `app/globals.css` has either (a) a matching
   `@media (prefers-reduced-motion: reduce)` block, or (b) is
   declared as `animation` (not `animation-name`) so the global
   reduce-motion override (`animation-duration: 0`) catches it.
7. **JSON-LD preserved.** `page.tsx` contains both the
   `"@type": "Organization"` and `"@type": "LocalBusiness"`
   JSON-LD blocks. Substring check on the JSON serialised inside
   the inline `<script type="application/ld+json">`.
8. **`affiliation-disclaimer`.** Preserved verbatim.
9. **VPS health.** `/api/health` returns 200.
10. **VPS smoke routes.** `/`, `/legal/trademarks`, `/discover`,
    `/suppliers/<slug>`, `/login`, `/signup` all return 200.
11. **HTML size.** `curl /` HTML body ≤ 80 KB.
12. **`marketing_stats()` RPC.** Returns 200 with all 6 documented
    keys. Smoke fails if any key is missing or the shape changes
    (regression-guarding the M1 lock).
13. **Ticker numbers.** Every number cited inside
    `live-ticker.tsx` is within ±10% of the corresponding live count
    in prod (e.g. RSC factory count, OEKO-TEX cert count). Smoke
    queries the DB once and compares.
14. **JC #5 showcase supplier exists.** The hard-coded showcase
    slug is published in prod; if absent, smoke fails and prompts
    the author to update the constant.

### 6.B `ops/_m6b_smoke.py`

1. **Auth route returns.** `/login`, `/signup`, `/forgot-password`,
   `/reset-password` all return 200 with the new `data-surface`
   attribute on the root.
2. **Server actions intact.** A POST with an invalid CSRF token
   to `/login` is rejected as today (no regression in the existing
   Next 15 server-action guard).
3. **Rate limit unchanged.** A 12-burst of `/login` hits from the
   same source IP returns at least one 429 (`LIMIT_AUTH=10/min`).
4. **No SSO references.** No file under `app/(auth)/` contains the
   strings `"google"`, `"microsoft"`, `"sso"`, `"oauth"`
   (case-insensitive) — confirms JC #6 was honoured.
5. **`/pricing` copy unchanged.** Substring `"Pricing coming
   after public beta"` present.
6. **`/legal/trademarks` body unchanged.** Smoke captures the
   current body innerText hash before edit and asserts it after
   edit.

## 7. Out-of-scope explicit list

- Compliance pages `/compliance/*` (separate spec if needed).
- Blog scaffold (deferred per `phases.md`).
- Stripe checkout / billing portal (deferred per `phases.md` →
  "Deferred until post-beta").
- SSO providers (Google / Microsoft / Apple).
- Internationalisation / locale switching.
- OG image asset (M4 deferred; favicon stays as stopgap).
- Dark mode on `/app`, `/supplier`, `/admin` surfaces.
- Any change to the `discover_suppliers` RPC or `buyer_supplier_profile`
  RPC.
- Any change to ETL pipeline.
- Any change to `middleware.ts` (I-033 + I-034 redirects stay
  unchanged).

## 8. Approach for a fresh agent

1. Read every `/context/` file in the order in `AGENTS.md` rule #3.
2. Read this spec end-to-end.
3. Decide which sub-batch (M6a or M6b) is active — only ever ship
   one in a session.
4. Mark spec **"in progress"** in `progress-tracker.md` with the
   sub-batch tag (e.g. `Spec M6a — in progress`).
5. Author the new + rewritten files exactly as enumerated under
   §5.M6a or §5.M6b. No drive-by edits.
6. Write the smoke (`ops/_m6a_smoke.py` or `ops/_m6b_smoke.py`)
   alongside the implementation.
7. `pnpm exec tsc --noEmit` → `pnpm exec next lint` → local
   `pnpm build` (if fast enough, otherwise rely on the VPS build).
8. Deploy via `ops/deploy-quick.ps1 <explicit files>` per the
   `/memories/scraping-ops.md` discipline.
9. Run the smoke; fix every FAIL; do not allow soft warnings.
10. Mark **"complete"** in `progress-tracker.md` with the dated
    decisions log entry + the live data-moat metrics table refresh
    (no change expected — this spec adds no data).
11. Commit on `development`; push; never `main`.
12. Stop. Do not start the other sub-batch in the same session.

## 9. Open questions (answer before kicking off M6a)

- **(Q1)** Is `cotton-club-bd-ltd` the right JC #5 showcase
  supplier slug, or should the spec pick a different one?
  *Default fallback*: alphabetically-first published supplier with
  `t13_source_count ≥ 4` and no active sanctions hit.
- **(Q2)** Should the M6a commit also amend
  `context/frontend-design-spec.md` §1 to document the marketing
  vs product type-stack split, or should that amendment land as a
  separate `chore(docs)` commit first?
  *Default*: amend within M6a — the spec is the architectural
  decision and the doc must move with it.

These questions are not blockers for ship; defaults apply if the
implementer does not raise them before starting M6a.
