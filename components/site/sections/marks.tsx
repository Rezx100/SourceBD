// 5 · Source marks strip (Paper `1EW0-0` / `1F7O-0`): the registers we read, each mark at 32 px with its code under
// it, loaded with the page and with no box around it (critique 22 Oct: nine empty hairline boxes showed while lazy
// marks arrived, and boxed 22 px marks read as placeholders). Only codes with a row in context/logos.lock.md; BEPZA and
// DIFE are listed there but hold no records, so they are not on the strip.

import { SourceMark } from "@/components/patterns/source-mark";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";
import { measure } from "./ui";

export const STRIP = ["EPB", "RSC", "BGMEA", "BKMEA", "BTMA", "BGAPMEA", "GOTS", "OEKO-TEX", "WRAP"] as const;

export function MarksStrip() {
  return (
    <section aria-labelledby="home-marks" className={cn(measure, "pb-14 md:pb-section")}>
      <div className="flex flex-col items-center gap-7 border-y border-line py-12">
        <h2 id="home-marks" className="text-site-body text-ink-subtle">
          Read from the registers that matter
        </h2>
        {/* The marks fade in left to right, 40 ms apart, once. */}
        <Reveal as="ul" className="grid grid-cols-3 gap-x-6 gap-y-7 sm:flex sm:flex-wrap sm:justify-center sm:gap-9">
          {STRIP.map((c, i) => (
            <li key={c} style={{ transitionDelay: `${i * 40}ms` }} className="flex w-16 flex-col items-center gap-2.5 transition-opacity duration-slow motion-reduce:transition-none group-data-[reveal=wait]/reveal:opacity-0">
              <SourceMark source={c} bare />
              <span className="text-xs font-medium text-ink-subtle">{c}</span>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
