// 5 · The registers we read (the founder's video of 22 Oct 2026: the marks were too small, faded and black, the heading
// too quiet). Each mark at 48 px in its frame, which says it is an outside authority's (context/logos.lock.md §1), at
// full strength with its code under it, loaded with the page. Only codes with a row in the lock; BEPZA and DIFE are
// listed there but hold no records, so they are not on the strip.

import { SourceMark } from "@/components/patterns/source-mark";
import { cn } from "@/lib/utils";
import { measure } from "./ui";

export const STRIP = ["EPB", "RSC", "BGMEA", "BKMEA", "BTMA", "BGAPMEA", "GOTS", "OEKO-TEX", "WRAP"] as const;

export function MarksStrip() {
  return (
    <section aria-labelledby="home-marks" className={cn(measure, "py-16 md:py-24")}>
      <div className="flex flex-col items-center gap-10 md:gap-12">
        <h2 id="home-marks" className="max-w-[640px] text-center text-xl text-ink-strong [text-wrap:balance] md:text-site-h3">
          Every fact comes from a register you already trust.
        </h2>
        <ul className="grid grid-cols-3 gap-x-6 gap-y-8 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-10 md:gap-x-14">
          {STRIP.map((c) => (
            <li key={c} className="flex flex-col items-center gap-3">
              <SourceMark source={c} lazy={false} className="size-12 border-ink-strong/10 bg-surface shadow-sm [&>img]:max-h-[34px] [&>img]:max-w-[34px]" />
              <span className="text-sm font-medium text-ink-muted">{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
