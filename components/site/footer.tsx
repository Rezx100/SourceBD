// The mega footer (Paper `30 Marketing · Global · Footer`): the wordmark and what the product is, the live
// figures line, six columns of links, and the promise. Server component: the figures are the site's facts
// (`lib/site-facts.ts`) and a figure that was not read is left out. "Cookie settings" reopens the cookie banner.

import Link from "next/link";
import { factsLine, readDay, type SiteFacts } from "@/lib/site-facts";
import { CookieSettingsButton } from "./cookie-banner";
import { FOOTER, PROMISE, STRAPLINE } from "./map";

const link = "inline-flex min-h-6 items-center text-base text-ink-2 hover:text-ink hover:underline max-md:min-h-11";

export function SiteFooter({ facts, year }: { facts: SiteFacts; year: number }) {
  const line = factsLine(facts);
  const lastRead = readDay(facts.latestRead);
  return (
    <footer className="border-t border-line bg-subtle font-sans text-ink">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-12 px-6 py-14 lg:px-10">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="flex max-w-[360px] flex-col gap-3">
            <Link href="/" className="text-lg font-semibold tracking-tight text-brand">
              SourceBD
            </Link>
            <p className="text-md text-ink-2">{STRAPLINE}</p>
            {line ? <p className="font-mono text-xs text-ink-3">{line}</p> : null}
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
            {FOOTER.map((col) => (
              <div key={col.title} className="flex flex-col gap-2">
                <h2 className="font-mono text-xs font-normal text-ink-3">{col.title}</h2>
                <ul className="flex flex-col gap-1.5">
                  {col.links.map((l) => (
                    <li key={`${col.title}-${l.label}`}>
                      <Link href={l.href} prefetch={false} className={link}>
                        {l.href === "/methodology#sources" && facts.sourcesListed !== null ? `The ${facts.sourcesListed} sources` : l.label}
                      </Link>
                    </li>
                  ))}
                  {col.title === "Status" && lastRead ? (
                    <li className="text-base text-ink-3">
                      Last register read <span className="font-mono text-xs">{lastRead}</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-3 border-t border-line pt-6 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} SourceBD. {PROMISE}
          </p>
          <CookieSettingsButton />
        </div>
      </div>
    </footer>
  );
}
