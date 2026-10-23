// The promise, centred, where mercury.com sets a customer's words (the founder's walkthrough of 23 Oct 2026). It is
// ours, not a customer's: SourceBD invents no testimonial (declined 22 Oct), so the line under it says whose rule it is
// and where to read how it is kept. Mercury's measure: the words at 28 in the book weight across 808 at most, the two
// lines under them at 21.

import Link from "next/link";
import { cn } from "@/lib/utils";
import { measure, ring } from "./ui";

export const STATEMENT = "Every fact on a SourceBD record names the register it came from and the day we read it. No scores. No paid placement.";

export function Statement() {
  return (
    <section data-mk-tone="day" aria-labelledby="home-statement" className="py-20 md:pb-0 md:pt-36">
      <figure className={cn(measure, "m-0 flex flex-col items-center gap-8 text-center")}>
        <blockquote id="home-statement" className="max-w-[808px] font-book text-xl text-ink-2 [text-wrap:balance] md:text-site-h3 md:tracking-normal">
          “{STATEMENT}”
        </blockquote>
        <figcaption className="flex flex-col text-lg md:text-xl">
          <span className="font-display text-ink">Our methodology</span>
          <Link href="/methodology" prefetch={false} className={cn("font-book text-ink-2 underline-offset-4 hover:underline", ring)}>
            Read how we check every fact
          </Link>
        </figcaption>
      </figure>
    </section>
  );
}
