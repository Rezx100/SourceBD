// The footer of every marketing page, redone (founder's video, 7 Oct 2026: "the footer needs to be redone entirely,
// this looks like an undone website"). Night in either theme, as the film's close is, so the page ends on the same
// ground it opened on: the strapline at display size with the two ways in, the live figures beside a live dot, the
// link columns, the promise, and the wordmark set large across the foot. Server component: the figures are the
// site's facts (`lib/site-facts.ts`) and a figure that was not read is left out. "Cookie settings" reopens the banner.

import Link from "next/link";
import { ButtonLink } from "@/components/kit";
import { factsLine, readDay, type SiteFacts } from "@/lib/site-facts";
import { CookieSettingsButton } from "./cookie-banner";
import { FOOTER, PROMISE, STRAPLINE } from "./map";

const link = "inline-flex min-h-7 items-center text-base text-ink-2 transition-colors duration-fast hover:text-ink max-md:min-h-11";

export function SiteFooter({ facts, year }: { facts: SiteFacts; year: number }) {
  const line = factsLine(facts);
  const lastRead = readDay(facts.latestRead);
  const columns = FOOTER.filter((col) => col.title !== "Status");
  const status = FOOTER.find((col) => col.title === "Status");
  return (
    <footer data-ground="night" className="relative isolate overflow-hidden bg-surface font-sans text-ink">
      <div className="mx-auto flex max-w-[1440px] flex-col px-6 lg:px-10">
        <div className="flex flex-col gap-10 border-b border-line py-20 max-md:py-14 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-[760px] text-display-3 font-medium leading-[1.06] tracking-[-0.03em] [text-wrap:balance] max-md:text-3xl lg:text-display-2">{STRAPLINE}</p>
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/signup" prefetch={false} kind="primary" size="lg" className="max-sm:h-input-touch">
              Start free
            </ButtonLink>
            <ButtonLink href="/contact" prefetch={false} kind="secondary" size="lg" className="max-sm:h-input-touch">
              Book a demo
            </ButtonLink>
          </div>
        </div>

        <div className="grid gap-12 py-14 max-md:py-10 lg:grid-cols-[minmax(240px,1.3fr)_minmax(0,3fr)]">
          <div className="flex max-w-[340px] flex-col gap-5">
            <Link href="/" className="w-fit text-xl font-semibold tracking-[-0.02em] text-ink">
              SourceBD
            </Link>
            {status ? (
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-ink-3">{status.title}</h2>
                <p className="flex items-center gap-2 text-base text-ink">
                  <span aria-hidden className="size-2 shrink-0 rounded-full bg-signal shadow-bloom" />
                  {lastRead ? (
                    <span>
                      Last register read <span className="font-mono text-sm">{lastRead}</span>
                    </span>
                  ) : (
                    <span>Registers read daily</span>
                  )}
                </p>
                {line ? <p className="font-mono text-xs leading-5 text-ink-3">{line}</p> : null}
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
                <h2 className="text-sm font-medium text-ink-3">{col.title}</h2>
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

        <div className="flex flex-col gap-3 border-t border-line py-6 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} SourceBD. {PROMISE}
          </p>
          <CookieSettingsButton />
        </div>
      </div>
      {/* The wordmark set across the foot: the page's last mark. Decoration: the link above carries the name. */}
      <p aria-hidden className="pointer-events-none mx-auto max-w-[1440px] select-none whitespace-nowrap px-6 text-[clamp(88px,19vw,288px)] font-semibold leading-[0.78] tracking-[-0.055em] text-line lg:px-10">
        SourceBD
      </p>
    </footer>
  );
}
