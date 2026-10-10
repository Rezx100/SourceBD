// 6 · Overview (Paper `Z0M-0` / `Z5U-0`): what a buyer does, in four blocks, each under its 40 px icon.

import { cn } from "@/lib/utils";
import { HomeIcon, type IconName } from "./icons";
import { H2, measure } from "./ui";

export const OVERVIEW: [IconName, string, string][] = [
  ["search", "Find", "Search by product, district, certificate or source. Open a record beside the results and never lose your place."],
  ["receipt", "Check", "Every fact carries the register it came from and the day we read it. When two sources disagree, you see both."],
  ["send", "Ask", "Save a shortlist and send one RFQ to up to 50 suppliers. Quotes come back side by side."],
  ["bell", "Watch", "Certificates that expire, registers that change, names that appear on the UFLPA list. We check again and tell you."],
];

export function Overview() {
  return (
    <section aria-labelledby="home-overview" className={cn(measure, "flex flex-col items-center gap-10 pb-14 pt-6 md:gap-[72px] md:pb-[140px] md:pt-10")}>
      <H2 id="home-overview" className="text-center">
        Everything you do to vet a factory.
        <br className="max-md:hidden" /> In one record.
      </H2>
      <ul className="grid w-full gap-10 md:grid-cols-2 md:gap-12 xl:grid-cols-4">
        {OVERVIEW.map(([icon, title, body]) => (
          <li key={title} className="flex flex-col gap-2.5">
            <HomeIcon name={icon} size={40} className="mb-1.5 text-ink-strong" />
            <h3 className="text-[20px] font-medium leading-6 tracking-[-0.01em] text-ink-strong">{title}</h3>
            <p className="text-[16px] leading-[25px] text-ink-muted">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
