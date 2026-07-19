# Session brief — /home-demo polish (handoff, 15 Jul 2026)

Continue polishing the demo homepage at `app/(marketing)/home-demo/page.tsx`.
A 38-item founder-approved audit remediation was just completed and verified.
Your job is refinement on top of that baseline — not re-architecture.

## Boot reading (in order)

1. `AGENTS.md`
2. `context/agent-brief.md`
3. `context/current-state.md` → "Recent Frontend Polish" (15 Jul 2026 entry)
4. This file
5. `context/frontend-design-spec.md` — only the sections you need (§1 tokens,
   §13 marketing, §14 invariants, §17 a11y, §19 live coverage snapshot)

## Hard guardrails (do not violate)

- **Demo page only.** Production `/` (`app/(marketing)/page.tsx`) is untouched
  and must stay untouched.
- No DB changes, no new routes, no new dependencies, no new icon/font/
  component systems. Magic UI + shadcn + Phosphor + Tailwind only.
- **No fabricated numbers.** Every count on this page is live. Aggregates come
  from the `marketing_stats` RPC or from `discover_suppliers` via
  `components/marketing/home/discover-count.ts`. If data is unavailable,
  hide the element — never hardcode a snapshot figure.
- **Count↔link precision contract:** any count shown next to a `/discover`
  deep link must be computed with exactly the RPC args that URL produces
  (see `explore-index-teaser.tsx` header comment).
- No SBI numerics/scores/grades anywhere. Contact PII stays server-gated.
- Brand strip wording ("disclosed on {brand}'s published factory list",
  text-only, no brand logos) is **pending legal sign-off** — polish visuals if
  needed, do not change the wording direction.
- Founder explicitly **skipped** these audit items — do NOT do them without
  fresh approval: MessageFloat focusable-buttons fix, marquee edge-fade
  removal, marquee off-system tint/hex cleanup (`#60917E`, `#F68D2E`),
  IntersectionObserver animation gating, MoatStats RGB comet recolor,
  MoatStats stat destination links.

## Current page structure (all in `app/(marketing)/home-demo/page.tsx`)

1. Hero wash band — `HomeHero` (`hero-product-window.tsx`) + `HeroBackdrop`
   (`hero-backdrop.tsx`), live supplier count prop, abstract monogram tiles,
   product window with lived-in fixtures
2. `MoatStats` (`moat-stats.tsx`) — 4 live columns + mono strip (sanctions
   lists screened · last refreshed)
3. `EvidenceAnatomy` (`evidence-anatomy.tsx` + `evidence-anatomy-stage.tsx`) —
   tablist/tab/tabpanel with arrow-key nav, fluid stage `min(720px,56vw)`,
   Contact in slot 03, AUTO_MS 4200; light stone stage wash; auto-advance
   does not pause on hover
4. `CapabilityFeatureGrid` (`capability-feature-grid.tsx`) — buyer workflow
   live stage + capability cards
5. `WorkflowAgentsMarquee` (`workflow-agents-marquee.tsx`) — 15 cards / 15
   slots, all text ≥12px
6. `IsometricDecisionPath` (`isometric-decision-path.tsx`) — fixed-height
   illustration stage, Discover link
7. `VerifiedRecordSteps` (`verified-record-steps.tsx`) — find · build · verify
8. Closing CTA (inline in page) — solid forest band

Removed from page (component may still exist): `ExploreIndexTeaser`.

## Design system decisions already locked (keep consistent)

- One container: `mx-auto w-full max-w-[1200px] px-4 sm:px-6`
- Two vertical-rhythm steps: `py-16 md:py-20` (standard) ·
  `py-24 md:py-28` (feature: MoatStats, Evidence, closing CTA)
- One eyebrow: `Kicker` from `components/marketing/home/kicker.tsx`
- Separators: `border-b border-neutral-200` on every section except closing
  CTA; backgrounds alternate white / neutral-50; closing CTA is the solid
  forest accent (evidence stage is light stone, not dark forest)
- Heading scale: H1 48px > Evidence H2 36px > all other H2 ≤ 30px (closing CTA
  36px allowed). Do not let any section H2 reach H1 size.
- Text ≥ 12px everywhere; no `text-neutral-400` for meaningful text (contrast)
- Live numbers render exact with no "+"; "+" appears only on rounded fallbacks

## Known rough edges / suggested polish targets

- Marquee cards still fade to an empty cell for ~750ms between cycles
  (transient by design, but could crossfade in place instead).
- Evidence stage inner panels weren't re-audited after the stage narrowed to
  `min(720px,56vw)` — check `evidence-demo-panels.tsx` density at 1024–1280px.
- MoatStats `NumberTicker` starts at 0 before animating — check how the band
  reads if JS is slow; consider SSR-visible values.
- Safety band tile grid (`sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3`)
  stacks vertically at lg only — verify it doesn't look orphaned at 1024px.
- Mobile pass across all new sections (brand strip 2-col at <640px, teaser
  cards, safety bar) was not deeply verified — worth a viewport sweep.
- Data freshness stamp currently shows 27 Jun 2026 (honest but stale); if the
  founder wants it fresher, scrapers need a run — that is ops, not frontend.

## Verification loop

- `pnpm typecheck` and `pnpm lint` must pass (lint has pre-existing warnings
  in untouched files; zero errors).
- Dev on Windows: if `next dev` dies with `.next\trace` EPERM, delete
  `.next\trace` and free ports 3000/3001 first, then restart.
- Smoke: `/home-demo` returns 200 and contains the live-number sections
  (safety band, brand strip, teaser counts, moat footer strip).
- Do not commit unless the founder asks; tree carries prior user work.
