// 16 · Three things we never do: beside them, the latest shipments on Aboni Knitwear's record, each with its date, its
// buyer and the record it came from, cut from a recording of the real app and stood on the product panel (the
// founder's videos of 22 Oct 2026).

import { cn } from "@/lib/utils";
import { Cut } from "./browser";
import { HomeIcon, type IconName } from "./icons";
import { H2, measure } from "./ui";

export const NEVER: [IconName, string, string][] = [
  ["stop", "Score a supplier", "We show what the registers say and when we read them. You decide what it means."],
  ["receipt", "Show a fact without its source", "Every row names the register, the number it was filed under and the day we read it."],
  ["lock", "Guess a contact", "Contact details stay locked until the supplier or a register provides them."],
];

export function NeverDo() {
  return (
    <section aria-labelledby="home-never" className="py-16 md:py-section">
      <div className={cn(measure, "grid items-center gap-10 lg:grid-cols-12 lg:gap-16")}>
        <div className="mk-panel order-2 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-card p-6 md:aspect-[16/11] md:rounded-stage md:p-12 lg:order-1 lg:col-span-7">
          <Cut name="shipments" className="max-w-[640px]" />
        </div>
        <div className="order-1 flex flex-col gap-8 lg:order-2 lg:col-span-5 md:gap-10">
          <H2 id="home-never">
            Three things <span className="text-ink-subtle">we never do.</span>
          </H2>
          <ul className="flex flex-col gap-7">
            {NEVER.map(([icon, title, body]) => (
              <li key={title} className="flex gap-4">
                <HomeIcon name={icon} className="mt-0.5 text-ink-strong" />
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-site-title font-medium text-ink-strong">{title}</h3>
                  <p className="text-md text-ink-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
