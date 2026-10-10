// 16 · Three things we never do (Paper `Z3A-0`, desktop only on the boards; the phone stacks it under the screen).

import { cn } from "@/lib/utils";
import { Screen, Still, measure } from "./ui";

export const NEVER: [string, string][] = [
  ["Score a supplier", "We show what the registers say and when we read them. You decide what it means."],
  ["Show a fact without its source", "Every row names the register, the number it was filed under and the day we read it, with a link to the source page."],
  ["Guess a contact", "Contact details stay locked until the supplier or a register provides them. Locked is a real state, not a blur."],
];

export function NeverDo() {
  return (
    <section aria-labelledby="home-never" className="border-y border-line-subtle bg-surface py-14 md:py-[120px]">
      <div className={cn(measure, "flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-20")}>
        <div className="relative isolate flex items-center justify-center overflow-hidden rounded-pane-phone px-4 py-6 max-lg:order-2 md:rounded-pane md:p-10 lg:h-[560px] lg:w-[720px] lg:shrink-0">
          <Still name="hangtag" className="object-[50%_40%]" sizes="(min-width: 1440px) 720px, 100vw" />
          <Screen name="full" phone={null} alt="A supplier's full record: every row with its source and the day it was read" sizes="(min-width: 1440px) 640px, 90vw" className="mx-auto max-w-[640px]" />
        </div>
        <div className="flex flex-col gap-8 md:gap-10 lg:w-[480px]">
          <h2 id="home-never" className="text-[30px] leading-[38px] tracking-[-0.025em] text-ink-strong md:text-[44px] md:leading-[52px]">
            Three things
            <br className="max-md:hidden" /> we never do.
          </h2>
          <ul className="flex flex-col gap-7">
            {NEVER.map(([title, body]) => (
              <li key={title} className="flex flex-col gap-1.5">
                <h3 className="text-[19px] font-medium leading-6 text-ink-strong">{title}</h3>
                <p className="text-[16px] leading-[25px] text-ink-muted">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
