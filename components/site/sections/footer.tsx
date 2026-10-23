// The site's one footer (M1, 14 Oct 2026; on the night ground since the founder's video of 22 Oct 2026, which found the
// paper one flat): the status line with the latest register read, every column of `map.ts` (all five compliance
// guides, data sources and trademarks), the promise, Cookie settings, and the wordmark set large and faint across the
// foot. Server component: the figures are the site's facts (`lib/site-facts.ts`) and a figure that was not read is
// left out.

import Link from "next/link";
import { factsLine, readDay, type SiteFacts } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { CookieSettingsButton } from "../cookie-banner";
import { FOOTER, PROMISE, STRAPLINE } from "../map";
import { Wordmark, measure, ring } from "./ui";

const link = cn("inline-flex min-h-6 items-center text-base text-ink-muted hover:text-ink-strong max-md:min-h-11", ring);

export function Footer({ facts, year }: { facts: SiteFacts; year: number }) {
  const line = factsLine(facts);
  const lastRead = readDay(facts.latestRead);
  const columns = FOOTER.filter((col) => col.title !== "Status");
  const status = FOOTER.find((col) => col.title === "Status");
  return (
    <footer data-ground="night" className="overflow-hidden bg-[rgb(var(--mk-ground-night))] font-sans text-ink-strong">
      <div className={cn(measure, "flex flex-col gap-12 pb-10 md:gap-16")}>
        <div className="grid gap-12 pt-16 md:pt-24 lg:grid-cols-[minmax(240px,1.2fr)_minmax(0,3fr)]">
          <div className="flex max-w-[320px] flex-col gap-5">
            <Wordmark />
            <p className="text-base text-ink-muted">{STRAPLINE}</p>
            {status ? (
              <div className="flex flex-col gap-1.5">
                <h2 className="text-base font-medium text-ink-strong">{status.title}</h2>
                <p className="flex items-center gap-2 text-base text-ink-strong">
                  <span aria-hidden className="size-2 shrink-0 rounded-full bg-signal" />
                  {lastRead ? <span>Last register read {lastRead}</span> : <span>Every fact dated by its source</span>}
                </p>
                {line ? <p className="text-sm text-ink-subtle">{line}</p> : null}
                {status.links.map((l) => (
                  <Link key={l.href} href={l.href} prefetch={false} className={link}>
                    {l.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            {columns.map((col) => (
              <div key={col.title} className="flex flex-col gap-3">
                <h2 className="text-base font-medium text-ink-strong">{col.title}</h2>
                <ul className="flex flex-col gap-1">
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
          </nav>
        </div>
        <div className="flex flex-col gap-3 border-t border-line-subtle pt-6 text-base text-ink-subtle md:flex-row md:items-center md:justify-between">
          <p>
            &copy; {year} SourceBD. {PROMISE}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>UK GDPR · ICO registration pending</span>
            <CookieSettingsButton />
          </div>
        </div>
      </div>
      {/* The wordmark set across the foot: the page's last mark. Decoration: the link above carries the name. */}
      <p aria-hidden className={cn(measure, "pointer-events-none select-none whitespace-nowrap text-site-wordmark font-semibold text-line")}>
        SourceBD
      </p>
    </footer>
  );
}
