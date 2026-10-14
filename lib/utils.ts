import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind-merge reads an unknown `text-*` as a colour, so a named size followed by an ink (`text-nav-label …
// text-ink-muted`) lost the size, and an ink followed by a named size (a kit button's label, then `text-site-body`)
// lost the ink. Every named size and radius of the token file is declared here (listed, so the token file stays out
// of the browser's bundle); tokens.test.ts fails when one is added there and not here.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display-1", "display-2", "display-3", "site-hero", "site-hero-sm", "site-h1", "site-h1-sm", "site-h2", "site-h2-sm", "site-h3", "site-figure", "site-figure-sm", "site-title", "site-lede", "site-body", "site-wordmark", "eyebrow", "title", "page-title", "nav-label"] }],
      rounded: [{ rounded: ["pane", "pane-phone", "frame", "card", "stage"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
