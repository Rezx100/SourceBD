// The closing band every page ends on: since the founder's video of 22 Oct 2026 (a black box with a soft shadow and
// nothing in it) the buyer's studio at dusk, the London skyline lit through its windows, with a light headline and the
// ways in over it: Start free and Book a demo. Since his video 3 ("these images are not visible properly") the skyline shows:
// a scrim only under the headline, the middle of the photograph clear. (The home page's own close is `Finale`,
// close.tsx, since the founder's walkthrough of 23 Oct 2026; the two cards it carried here went with it.)
// The band is night whatever the page's tone, so the tokens are the dark set's; the primary button keeps the nav's
// green with its white label.

import type { ReactNode } from "react";
import { ButtonLink } from "@/components/kit";
import { cn } from "@/lib/utils";
import { Still, TextLink, measure } from "./ui";

const primary = "h-11 rounded-frame px-5 text-site-body text-brand-on";

export function Closing({ headline, lede }: { headline: ReactNode; lede?: ReactNode }) {
  return (
    <section aria-labelledby="site-close" className={cn(measure, "py-16 md:py-section")}>
      <div data-ground="night" className="relative isolate flex flex-col items-center gap-10 overflow-hidden rounded-card px-5 pb-6 pt-16 text-ink md:gap-14 md:rounded-stage md:px-16 md:pb-14 md:pt-24">
        <Still name="dusk" sizes="(min-width: 1440px) 1280px, 100vw" className="object-[50%_40%]" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[rgb(var(--mk-ground-night)/0.6)] via-transparent via-40% to-[rgb(var(--mk-ground-night)/0.7)]" />
        <div className="relative flex flex-col items-center gap-5 text-center">
          <h2 id="site-close" className="max-w-[880px] text-site-h1-sm font-light text-ink [text-wrap:balance] md:text-site-h1">
            {headline}
          </h2>
          {lede ? <p className="text-md text-ink-2 md:text-site-lede">{lede}</p> : null}
        </div>
        <div className="relative flex flex-wrap items-center justify-center gap-2.5 pb-10 md:pb-0">
          <ButtonLink href="/signup" prefetch={false} kind="primary" size="lg" className={primary}>
            Start free
          </ButtonLink>
          <TextLink href="/contact" className="px-4 text-ink">
            Book a demo
          </TextLink>
        </div>
      </div>
    </section>
  );
}
