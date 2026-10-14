"use client";

// The vignette grid (M3, handoff-mercury-motion-sitewide.md §3): four small moments of the product, each looping on
// real records (`components/site/demos/vignettes.tsx`), two by two from 768. In the place "Start in a minute" held.
// A client component only because the vignettes' list is exported from one.

import { VIGNETTES } from "@/components/site/demos";
import { cn } from "@/lib/utils";
import { H2, Lede, measure } from "./ui";

export const VIGNETTES_TITLE = "Four moments from a day's sourcing.";

export function VignetteGrid() {
  return (
    <section aria-labelledby="home-vignettes" className={cn(measure, "flex flex-col items-center gap-10 py-14 md:gap-14 md:py-section")}>
      <div className="flex flex-col items-center gap-4 text-center">
        <H2 id="home-vignettes">{VIGNETTES_TITLE}</H2>
        <Lede className="mx-auto">Each loops one thing the product does, on the records as we hold them.</Lede>
      </div>
      <ul className="grid w-full gap-6 md:grid-cols-2 md:gap-8">
        {VIGNETTES.map((v) => (
          <li key={v.key} className="flex flex-col gap-4">
            <v.Demo />
            <div className="flex flex-col gap-1.5">
              <h3 className="text-site-title font-medium text-ink-strong">{v.title}</h3>
              <p className="text-site-body text-ink-muted">{v.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
