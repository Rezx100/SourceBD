# circle0 — design system (web marketing site)

Mode: Persuade. Light mode only. Reference structure: Covex Webflow template; palette: the circle0 dashboard.

## Color (sampled from my dashboard.jpg)
| token | value | use |
|---|---|---|
| --bg | #F7F7F6 | page ground (off-white, neutral with a hair of warmth) |
| --surface | #FFFFFF | cards, inputs, nav pill |
| --surface-2 | #F0F1EE | secondary buttons, quiet panels, table header |
| --ink | #0B0C0A | headlines, primary buttons (near-black from the dashboard's card) |
| --ink-2 | #63655F | body copy (mid grey, 5.0:1 on surface-2) |
| --ink-3 | #63655F | captions and icons at rest (placeholders use #6F716D) |
| --line | #E6E7E3 | 1px dividers and card borders |
| --lime | #ADF74C | brand accent: highlighted bars, active states, CTA panels |
| --lime-soft | #D7F591 | tints, chips, hover fills |
| --lime-pale | #EEFBD6 | very light tint behind success/positive stats |
| --green | #4F7A08 | positive deltas, check icons, small text (AA on bg and white) |
| --forest | #173A14 | deep end of brand gradients, text on lime panels |
| --blue | #81C0F5, --red #D03E3E, --orange #DE9D59 | semantic icon chips only, never layout |

Gradient panels (hero image frame, CTA band, newsletter): forest #173A14 → green #3F7A12 → lime #ADF74C, with a 6% grain overlay and a soft vignette. They replace the reference's red/orange-blue panels.

## Type (Google Fonts)
- Display: "Figtree" 500 (geometric grotesque, stands in for Bdogrotesk 500). Tracking -0.03em at 48px+, -0.02em at 36px.
- Body: "Instrument Sans" 400/500 (humanist, stands in for Interdisplay).
- Scale: hero 56/48px (desktop/tablet) 500 lh 1.05 · h2 40px 500 lh 1.1 · h3 24px 500 · body 16px/1.6 · small 14px · label 13px.

## Shape
- Cards and panels: radius 24px. Buttons, chips, inputs: pill (999px) at 44px height. Small tiles: 16px.
- Borders: 1px --line. Shadow: 0 1px 2px rgba(11,12,10,.04), 0 12px 32px -12px rgba(11,12,10,.12).

## Spacing
- Container 1200px max, 24px gutters (160px side margins at 1600). Section padding 120px desktop / 80px tablet / 64px phone. Grid 3-up at ≥960px, 2-up ≥640px, 1-up below. Card width ≈ 368px at 1200.

## Motion
- GSAP 3 + ScrollTrigger from cdnjs. Hero headline: word-split rise (stagger 0.05, 0.9s, power3.out). Section reveals: `[data-reveal]` fade + 24px rise, once, from an already visible fallback when JS is off. Stat counters tween once in view. Hover lift on tiles: scale 1.03 / 200ms. Carousels: translateX tweens, keyboard + buttons + dots. Accordion: height tween 0.35s. CTA panel background: 8% parallax. All disabled under prefers-reduced-motion.

## Iconography
Inline SVG, 24px, 1.75px stroke, round caps. No emoji.

## Imagery
Warm editorial office portraits with 24px corners (Higgsfield), gradient panels in the brand gradient, product previews are the real circle0 dashboard inset in a white card with the system shadow.
