// 11 · Everything else a sourcing desk needs (the founder's video of 22 Oct 2026: the hairline list read as a dated
// table with no icons and no visual; his second video pointed at mercury.com's centred icon grid). Eight things, each
// an icon over a short name and one line, four to a row from 1024, on the paper ground.

import { cn } from "@/lib/utils";
import { HomeIcon, type IconName } from "./icons";
import { H2, measure } from "./ui";

export type GridItem = { icon: IconName; title: string; body: string };

export const GRID: GridItem[] = [
  { icon: "bell", title: "Saved searches and alerts", body: "Save a search; new matches arrive by email every Monday." },
  { icon: "export", title: "Export CSV", body: "Download any results page or your saved list as a file." },
  { icon: "carton", title: "HS headings and product lines", body: "Every heading we track, with the suppliers who export it." },
  { icon: "team", title: "Team and roles", body: "Owner, approver, editor and viewer; invites by email." },
  { icon: "calendar", title: "Expiry dates", body: "Every certificate with a date, grouped by when it lapses." },
  { icon: "ledger", title: "Modern slavery statement", body: "A section 54 draft composed from your saved suppliers." },
  { icon: "listcheck", title: "Evidence pack", body: "Certificates, UFLPA checks and sources for your list, in one file." },
  { icon: "thread", title: "Notifications", body: "Replies, quotes and expiry alerts by email, each one a setting." },
];

export function PlatformGrid() {
  return (
    <section aria-labelledby="home-grid" className="py-16 md:py-section">
      <div className={cn(measure, "flex flex-col items-center gap-12 md:gap-16")}>
        <H2 id="home-grid" className="text-center">
          Everything else a sourcing desk needs.
        </H2>
        <ul className="grid w-full gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {GRID.map((it) => (
            <li key={it.title} className="flex flex-col items-center gap-3 text-center">
              <span className="mb-1 flex size-14 items-center justify-center rounded-card bg-surface text-ink-strong shadow-sm ring-1 ring-ink/5">
                <HomeIcon name={it.icon} size={24} />
              </span>
              <h3 className="text-site-title font-medium text-ink-strong">{it.title}</h3>
              <p className="max-w-[260px] text-site-body text-ink-muted">{it.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
