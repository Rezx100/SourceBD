// 11 · Platform grid (Paper `1EXN-0` / `1F9A-0`): eight things a sourcing desk needs, ruled, over the selvedge at
// 16 %. Four across at 1440, two on a tablet, one on a phone.

import { cn } from "@/lib/utils";
import { HomeIcon, type IconName } from "./icons";
import { H2, Still, measure } from "./ui";

export const GRID: [IconName, string, string][] = [
  ["bookmark", "Saved searches and alerts", "Save a search; new matches arrive by email every Monday."],
  ["export", "Export CSV", "Download any results page or your saved list as a file."],
  ["ledger", "HS headings and product lines", "Every heading we track, with the suppliers who export it."],
  ["team", "Team and roles", "Owner, approver, editor and viewer; invites by email."],
  ["calendar", "Expiry dates", "Every certificate with a date, grouped by when it lapses."],
  ["receipt", "Modern slavery statement", "A section 54 draft composed from your saved suppliers, in your browser."],
  ["shield", "Evidence pack", "The records behind your saved list, downloaded in one file."],
  ["bell", "Notifications", "Replies, quotes and expiry alerts by email, each one a setting."],
];

export function PlatformGrid() {
  return (
    <section aria-labelledby="home-grid" className="relative isolate overflow-hidden py-14 md:py-[120px]">
      <Still name="selvedge" className="opacity-[0.16]" sizes="100vw" />
      <div className={cn(measure, "relative flex flex-col items-center gap-10 md:gap-14")}>
        <H2 id="home-grid" className="text-center">
          Everything else a sourcing desk needs.
        </H2>
        <ul className="grid w-full border-t border-line sm:grid-cols-2 xl:grid-cols-4">
          {GRID.map(([icon, title, body], i) => (
            // A rule left of every cell but a row's first: two to a row on a tablet, four at 1280.
            <li key={title} className={cn("flex flex-col gap-3.5 border-b border-line-subtle px-1 pb-8 pt-7 sm:px-6", i % 2 === 1 && "sm:border-l", i % 4 === 2 && "xl:border-l")}>
              <HomeIcon name={icon} className="text-ink-strong" />
              <h3 className="text-[17px] font-medium leading-[22px] text-ink-strong">{title}</h3>
              <p className="text-[15px] leading-[22px] text-ink-muted">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
