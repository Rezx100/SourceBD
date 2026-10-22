import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind-merge reads an unknown `text-*` as a colour, so a named size followed by an ink (`text-nav-label …
// text-ink-muted`) lost the size, and an ink followed by a named size (a kit button's label, then `text-site-body`)
// lost the ink. Every named size and radius of the token file is declared here (listed, so the token file stays out
// of the browser's bundle); tokens.test.ts fails when one is added there and not here.
/** The token file's named spacing (`spacing`): heights, and the marketing rhythm's paddings (`md:pb-section`). */
const SPACING = ["control-sm", "control", "row-head", "row", "control-lg", "touch", "input-touch", "row-tall", "topbar", "tabbar", "action-bar", "section"];

const twMerge = extendTailwindMerge({
  extend: {
    // A named padding or margin gives way to a caller's: `md:pb-section` then `md:pb-16` is `md:pb-16` (critique 22 Oct review: the pricing hero kept its 120 px).
    theme: { spacing: SPACING },
    classGroups: {
      "font-size": [{ text: ["display-1", "display-2", "display-3", "site-hero", "site-hero-sm", "site-h1", "site-h1-sm", "site-h2", "site-h2-sm", "site-h3", "site-figure", "site-figure-sm", "site-title", "site-lede", "site-body", "site-wordmark", "eyebrow", "title", "page-title", "nav-label"] }],
      rounded: [{ rounded: ["pane", "pane-phone", "frame", "card", "stage"] }],
      // The named heights (`spacing` in the token file): a kit button's `h-control-lg` gives way to a caller's `h-12`.
      h: [{ h: SPACING }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
