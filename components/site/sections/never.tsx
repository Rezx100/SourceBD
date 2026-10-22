// 16 · Three things we never do. Since the founder's video 3 of 22 Oct 2026 no part of the app stands beside them (the
// shipments it showed moved to the showcase, so no screen appears twice): the heading over three promises, side by side.

import { cn } from "@/lib/utils";
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
      <div className={cn(measure, "flex flex-col gap-10 md:gap-14")}>
        <H2 id="home-never">
          Three things <span className="text-ink-subtle">we never do.</span>
        </H2>
        <ul className="grid gap-8 md:grid-cols-3 md:gap-10">
          {NEVER.map(([icon, title, body]) => (
            <li key={title} className="flex flex-col gap-4 border-t border-line pt-6">
              <HomeIcon name={icon} size={40} className="text-ink-strong" />
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xl font-medium text-ink-strong md:text-site-h3 md:font-normal">{title}</h3>
                <p className="text-md text-ink-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
