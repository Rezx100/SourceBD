# Spec R3 — Responsive marketing + auth

> Reflows every anon-allowed surface. CSS-only on `force-static` / ISR pages — no `'use client'` hooks added to static pages. Independent of R2 (depends only on R1).

## 1. Scope (routes)
- `/` (M6a homepage, `force-static`, `revalidate=600`)
- `/pricing` (`force-static`)
- `/discover` (marketing demo, anon cookie short-circuit, currently `force-dynamic` on disk)
- `/suppliers/[slug]` (marketing, `revalidate=300` ISR)
- `/compliance` (`force-static`) + 5 prerendered `/compliance/[slug]` (`force-static`, `dynamicParams=false`)
- `/legal/terms`, `/legal/privacy`, `/legal/cookies`, `/legal/trademarks`, `/legal/data-sources` (`force-static`)
- `/login`, `/signup`, `/forgot-password`, `/reset-password` (auth shell, M6b split-pane)
- `/suspended`

## 2. Dependencies
- R1 merged (uses `Sheet`, `MobileDrawer` via the marketing top-nav rewrite from R2 if R2 has shipped, otherwise R3 inlines a minimal hamburger trigger using R1's `MobileDrawer` directly).

## 3. Per-route responsive intents
- **Homepage**: hero grid 2-col → 1-col `<lg`. Dossier card moves below hero text `<lg`. Metric band 5-col → 2-col `<md` → 1-col `<xs`. Authority markstack wraps. Trust ladder 2-col → 1-col `<md`. Integrity engine 3-col → 1-col `<md` (the three "scanning windows" stack vertically with a thinner flow path). Receipts-first sticky aside un-stickies `<md`. CTA box stacks `<md`.
- **Pricing**: 3-col plan cards → 1-col `<sm`. Feature list bullets keep readable measure. CTA buttons 44 px tap.
- **Public Discover**: FilterRail uses `FilterRailResponsive` from R1 — desktop horizontal top-bar form unchanged; `<md` collapses to "Filters (N)" `<Sheet>` trigger + `<Chip>` row of applied filters above results. Result cards `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. DemoBanner stacks vertically `<sm`.
- **Public supplier profile**: header dossier already collapses below 900 (I-028); extend to ensure `<dl>` grids inside addresses/products/cert sections never overflow `<xs`. Address rows use `grid-template-areas` stacks. The locked methodology card stays readable.
- **Compliance hub + 5 details**: tile grid 3-col → 2-col → 1-col. Detail page section nav becomes an in-page jump menu (`<details open>` or anchor list) at `<md`.
- **Legal pages**: long text, `prose` width clamped to 70ch on `≥md`, 100% width `<md`. Trademarks table converts to `ResponsiveTable mode="stacked"`.
- **Auth (M6b)**: split-pane stays at `≥md`; the dark brand panel hides `<md` (form-only mobile). Form inputs use R1's 16 px baseline; `Wizard` not needed (single-step pages).
- **`/suspended`**: centered card grows fluid width.

## 4. Hard constraints
- Preserve every caching directive (`force-static`, `revalidate=600`, `revalidate=300`, `revalidate=3600`, `dynamicParams=false`).
- Preserve I-033 session island, I-034 redirects, DemoBanner, JSON-LD `Organization` + `LocalBusiness` + `Article`, the verbatim methodology + authenticity-rule + OSH-extension paragraphs from `logos.lock.md` §3.
- No `'use client'` added to any of the `force-static` pages — every interactive bit goes through an existing island (FilterRailResponsive sheet trigger is the only new island; it's tree-shaken on routes that don't use it).
- Marketing `[data-surface="marketing"]` tokens untouched.

## 5. Smoke — `ops/_r3_smoke.py`
- Disk scan: each route source still declares its `dynamic` / `revalidate` / `generateStaticParams` / `dynamicParams` value.
- Compiled CSS contains the R1 utilities (regression check that R3 didn't strip them).
- Live HTTP smoke against prod for each marketing/auth route — 200 + correct cache headers.
- HTML body checks: homepage still contains 2× "Authenticity rule", JSON-LD blocks, the locked footer disclaimer. Public profile still calls `buyer_supplier_profile` (regression on the F3 minimal-SELECT path).
- Forbidden-token scan — diff `[]`.

## 6. Validation
- typecheck / lint / build clean.
- Route count 64 unchanged.
- Manual QA matrix per route × breakpoint (xs/sm/md/lg/xl, portrait + landscape phone).
