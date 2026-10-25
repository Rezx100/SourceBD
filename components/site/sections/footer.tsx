// The site's one footer (M1, 14 Oct 2026; on the night ground since the founder's video of 22 Oct 2026, which found the
// paper one flat): every column of `map.ts` (all five compliance guides, data sources and trademarks), the status line
// with the latest register read, the promise and Cookie settings. Since the founder's walkthrough of 23 Oct 2026 it is
// laid out as mercury.com's: four columns to a row in the home page's column (on every page since they all took the
// home page's design, 25 Oct 2026, so it lines up with what is above it), each a quiet heading over its links, then
// a hairline and the notes, the wordmark and the strapline at the left and the small print at the right. Server
// component: the figures are the site's facts (`lib/site-facts.ts`) and a figure that was not read is left out.

import Link from "next/link";
import { factsLine, readDay, type SiteFacts } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { CookieSettingsButton } from "../cookie-banner";
import { FOOTER, PROMISE, STRAPLINE } from "../map";
import { Wordmark, column, ring } from "./ui";

const link = cn("inline-flex min-h-5 items-center text-site-item text-ink hover:underline hover:underline-offset-4 max-md:min-h-11", ring);

export function Footer({ facts, year }: { facts: SiteFacts; year: number }) {
  const line = factsLine(facts);
  const lastRead = readDay(facts.latestRead);
  const columns = FOOTER.filter((col) => col.title !== "Status");
  const status = FOOTER.find((col) => col.title === "Status");
  return (
    <footer data-ground="night" className="bg-[rgb(var(--mk-ground-night))] pb-16 pt-12 font-sans text-ink md:pt-24">
      <div className={cn(column, "flex flex-col gap-16 md:gap-24")}>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-4 md:gap-y-20">
          {columns.map((col) => (
            <div key={col.title} className="flex flex-col gap-2.5">
              <h2 className="text-site-item text-ink-2">{col.title}</h2>
              <ul className="flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={`${col.title}-${l.label}`}>
                    <Link href={l.href} prefetch={false} className={link}>
                      {l.href === "/methodology#sources" && facts.sourcesListed !== null ? `The ${facts.sourcesListed} sources` : l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {status ? (
            <div className="flex flex-col gap-2.5">
              <h2 className="text-site-item text-ink-2">{status.title}</h2>
              <p className="flex items-center gap-2 text-site-item text-ink">
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-signal" />
                {lastRead ? <span>Last register read {lastRead}</span> : <span>Every fact dated by its source</span>}
              </p>
              {status.links.map((l) => (
                <Link key={l.href} href={l.href} prefetch={false} className={link}>
                  {l.label}
                </Link>
              ))}
            </div>
          ) : null}
        </nav>
        <div className="grid gap-6 border-t border-line pt-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-16">
          <div className="flex flex-col gap-3">
            <Wordmark />
            <p className="max-w-[300px] text-xs text-ink-2">{STRAPLINE}</p>
          </div>
          <div className="flex flex-col gap-3 text-xs text-ink-2">
            {line ? <p>{line}</p> : null}
            <p>
              &copy; {year} SourceBD. {PROMISE}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span>UK GDPR · ICO registration pending</span>
              <CookieSettingsButton />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
