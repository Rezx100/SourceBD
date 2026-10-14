---
version: 1
slug: "marketing"
primary_target: "components/site"
related_targets: ["app/(home)", "app/(marketing)", "app/(public)"]
---

# Marketing site — one design, 14 Oct 2026

The bar (founder, 14 Oct): mercury.com, for structure, pacing and motion, never for its copy, images, purple or
font. Every marketing page is one design in the home page's direction: light display type, warm paper, ink links,
green only on the main button and the wordmark (and the icons' one detail), real records with dated receipts.
Plan and recordings: `.impeccable/handoff-mercury-motion-sitewide.md`, `.impeccable/reference/mercury-14oct/`.

## The library (`components/site/sections`)

- `ui.tsx`: `measure` (1280 of content at 1440, `max-w-site`), `ring` (the one focus ring, near-black), `inkLink`,
  `Wordmark`, `H2`, `Lede`, `Label`, `Display`, `TextLink`, `HeroActions`, `HeroCentered` (every page but home),
  `Section` (`tone` paper, subtle, dark), `FeatureRow` (text beside the product, `flip` alternates), `Still`,
  `Screen`, `Stage` (a screen on a textile still), `Mark`.
- `faq.tsx` (the one FAQ), `closing.tsx` (the one closing band; home passes its two cards), `footer.tsx` (the one
  footer, drawn by `components/site/chrome.tsx` only, content from `map.ts`).
- The home page's own sections sit beside them; `components/site/home.tsx` composes them.
- Motion: `components/site/motion.tsx` (`useScene`, `DemoStage` with its pause button, `ToneShift`).

## Rules the tests hold (`components/site/site.test.ts`, `lib/design/tokens.test.ts`)

- No size, line height or radius by hand under `components/site`: the `site-*` type scale, `rounded-frame` (12),
  `rounded-card` (16), `rounded-stage` (24), `py-section` (120) instead.
- One `<footer>`, one `<details>` FAQ, one footer importer, no green focus ring.
- Green classes only on the wordmark; links are ink.
- No hand-typed colour, no old palette class, no arbitrary radius anywhere under `components/site`.

## Not yet (M2 onwards)

The product pictures are still stills; M2 turns them into coded demos in `DemoStage`, M3 rebuilds the home page
(hero scrub, pinned tour, tone rhythm) and stops for the founder's recording review.
