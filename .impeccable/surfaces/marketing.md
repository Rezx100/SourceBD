---
version: 2
slug: "marketing"
primary_target: "components/site"
related_targets: ["app/(home)", "app/(marketing)", "app/(public)"]
---

# Marketing site — one design (14 Oct 2026; rebuilt from the founder's videos of 22 Oct 2026)

The bar: mercury.com for structure, pacing and motion, never its copy, purple or font. The visitor is a UK, US, EU or
Canadian buyer: every picture comes from their world, and every picture of the product is the real app.

## Direction contract

THESIS: the buyer watches the real app do their vetting; refuse drawn mock-ups, captions under the product and cloth
backdrops.
OWN-WORLD: warm paper and the night ground as fixed section grounds; a London sourcing studio, its swatches, a port at
night, the studio at dusk; the real app in one browser window (16:10, SVG bar); app fragments as cards on the grid
panel; Geist light display; green only on the main button.
STORY: the buyer sees their own desk, zooms into the app, follows Find, Check, Ask, Watch, sees who the factories
already make for, then checks it themselves.
FIRST VIEWPORT: studio photograph full-bleed, one-line headline and lede centred in the window light, email and
Start free under it, the laptop below showing the app.
FORM: Mercury opening (zoom into the laptop, the window settles into the tour); tours and feature lists click or
advance, never hold the scroll; seed key: brief-pinned (founder's videos), no roll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## The library (`components/site/sections`)

- `ui.tsx`: `measure`, `ring`, `H2`, `Lede`, `TextLink`, `HeroCentered`, `Section`, `FeatureRow`, `Still` (the
  photographs), `Stage` (a window on a photograph).
- `browser.tsx`: `BrowserFrame`, `AppVideo`, `Screen` (a recording in its window), `Cut` / `LiveCut` (a part of the
  app), `PauseButton`, `FitPage` (a coded demo at app scale).
- `tour.tsx` (`TourList`, `TourWindow`, `Tour`), `features.tsx` (`FeatureTour`, `FeatureGrid` on `.mk-panel`).
- `opening.tsx` (the home's zoom), `brands.tsx` (names in our type, never logos: context/logos.lock.md).
- Motion: `components/site/motion.tsx` (`useScene`, `DemoStage`, `PageMain`: grounds are fixed, nothing crossfades).

## Rules the tests hold (`components/site/*.test.ts`, `lib/design/tokens.test.ts`)

- No size, line height or radius by hand: the `site-*` type scale, `rounded-frame|card|stage`, `py-section`.
- One `<footer>`, one `<details>` FAQ, no green link, no hand-typed colour.
- No dated caption under any product picture; every playing picture has its pause button.
- Every file in public/site/home is named in its PROVENANCE.md.
