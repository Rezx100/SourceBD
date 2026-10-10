// 5 · Source marks strip (Paper `1EW0-0` / `1F7O-0`): the registers we read, each framed with its code under it.
// Only codes with a row in context/logos.lock.md; BEPZA and DIFE are listed there but hold no records, so they
// are not on the strip.

import { cn } from "@/lib/utils";
import { Mark, measure } from "./ui";

export const STRIP = ["EPB", "RSC", "BGMEA", "BKMEA", "BTMA", "BGAPMEA", "GOTS", "OEKO-TEX", "WRAP"] as const;

export function MarksStrip() {
  return (
    <section aria-labelledby="home-marks" className={cn(measure, "pb-14 md:pb-[120px]")}>
      <div className="flex flex-col items-center gap-7 border-y border-line py-12">
        <h2 id="home-marks" className="text-[15px] leading-[18px] text-ink-subtle">
          Read from the registers that matter
        </h2>
        <ul className="grid grid-cols-3 gap-x-6 gap-y-7 sm:flex sm:flex-wrap sm:justify-center sm:gap-9">
          {STRIP.map((c) => (
            <li key={c} className="flex w-16 flex-col items-center gap-2.5">
              <Mark code={c} large />
              <span className="font-mono text-[11px] leading-[14px] text-ink-subtle">{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
