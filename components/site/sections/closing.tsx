// The closing band every page ends on: since the founder's video of 22 Oct 2026 (a black box with a soft shadow and
// nothing in it) the buyer's studio at dusk, the London skyline lit through its windows, with a light headline and the
// ways in over it. The home page shows its two cards, one for buyers and one for suppliers; every other page its own
// line with Start free and Book a demo. The band is night whatever the page's tone, so the tokens are the dark set's;
// the primary button keeps the nav's green with its white label.

import type { ReactNode } from "react";
import { ButtonLink } from "@/components/kit";
import { cn } from "@/lib/utils";
import { Still, TextLink, measure } from "./ui";

export const HOME_CARDS = [
  { who: "For buyers", line: "Free while we are in beta. No card needed.", body: "UK, US, EU and Canadian brands and retailers. Shortlist, vet and message verified factories in one sitting.", cta: ["Start free", "/signup"], link: ["See what is included", "/pricing"], primary: true },
  { who: "For suppliers", line: "Your record is already here. Claim it.", body: "Bangladesh factories and buying houses. Keep your profile current and answer RFQs at no cost.", cta: ["Claim your record", "/signup?role=supplier"], link: ["How claiming works", "/suppliers"], primary: false },
] as const;

type Card = (typeof HOME_CARDS)[number];

const primary = "h-11 rounded-frame px-5 text-site-body text-brand-on";

export function Closing({ headline, lede, cards }: { headline: ReactNode; lede?: ReactNode; cards?: readonly Card[] }) {
  return (
    <section aria-labelledby="site-close" className={cn(measure, "py-16 md:py-section")}>
      <div data-ground="night" className="relative isolate flex flex-col items-center gap-10 overflow-hidden rounded-card px-5 pb-6 pt-16 text-ink md:gap-14 md:rounded-stage md:px-16 md:pb-16 md:pt-28">
        <Still name="dusk" sizes="(min-width: 1440px) 1280px, 100vw" className="object-[50%_40%]" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[rgb(var(--mk-ground-night)/0.55)] via-[rgb(var(--mk-ground-night)/0.25)] to-[rgb(var(--mk-ground-night)/0.85)]" />
        <div className="relative flex flex-col items-center gap-5 text-center">
          <h2 id="site-close" className="max-w-[880px] text-site-h1-sm font-light text-ink [text-wrap:balance] md:text-site-h1">
            {headline}
          </h2>
          {lede ? <p className="text-md text-ink-2 md:text-site-lede">{lede}</p> : null}
        </div>
        {cards ? (
          <div className="relative grid w-full max-w-[1120px] gap-4 md:gap-6 lg:grid-cols-2">
            {cards.map((c) => (
              <div key={c.who} className="flex flex-col gap-5 rounded-card bg-surface/80 p-6 ring-1 ring-ink/10 backdrop-blur-md md:p-9">
                <p className="text-base font-medium text-ink-2">{c.who}</p>
                <h3 className="text-xl text-ink md:text-site-h3">{c.line}</h3>
                <p className="text-md text-ink-2">{c.body}</p>
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <ButtonLink href={c.cta[1]} prefetch={false} kind={c.primary ? "primary" : "secondary"} size="lg" className={c.primary ? primary : "h-11 rounded-frame px-5 text-site-body"}>
                    {c.cta[0]}
                  </ButtonLink>
                  <TextLink href={c.link[1]} className="px-4 text-ink">
                    {c.link[0]}
                  </TextLink>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative flex flex-wrap items-center justify-center gap-2.5 pb-10 md:pb-0">
            <ButtonLink href="/signup" prefetch={false} kind="primary" size="lg" className={primary}>
              Start free
            </ButtonLink>
            <TextLink href="/contact" className="px-4 text-ink">
              Book a demo
            </TextLink>
          </div>
        )}
      </div>
    </section>
  );
}
