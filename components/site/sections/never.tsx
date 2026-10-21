// 16 · Three things we never do (Paper `Z3A-0`, desktop only on the boards; the phone stacks it under the picture):
// beside them, Aboni Knitwear's record at its Sources section, every register in trust order with the day it was
// read (critique 22 Oct: the 3 Oct window is gone).

import { DemoRecord } from "@/components/site/demos";
import { cn } from "@/lib/utils";
import { measure } from "./ui";

export const NEVER: [string, string][] = [
  ["Score a supplier", "We show what the registers say and when we read them. You decide what it means."],
  ["Show a fact without its source", "Every row names the register, the number it was filed under and the day we read it, with a link to the source page."],
  ["Guess a contact", "Contact details stay locked until the supplier or a register provides them. Locked is a real state, not a blur."],
];

export function NeverDo() {
  return (
    <section aria-labelledby="home-never" className="border-y border-line-subtle bg-surface py-14 md:py-section">
      <div className={cn(measure, "flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-20")}>
        <div className="min-w-0 max-lg:order-2 lg:w-[720px] lg:shrink-0">
          <DemoRecord tab="sources" stage="weave" />
        </div>
        <div className="flex flex-col gap-8 md:gap-10 lg:w-[480px]">
          <h2 id="home-never" className="text-site-h2-sm text-ink-strong md:text-site-h2">
            Three things
            <br className="max-md:hidden" /> we never do.
          </h2>
          <ul className="flex flex-col gap-7">
            {NEVER.map(([title, body]) => (
              <li key={title} className="flex flex-col gap-1.5">
                <h3 className="text-site-title font-medium text-ink-strong">{title}</h3>
                <p className="text-md text-ink-muted">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
