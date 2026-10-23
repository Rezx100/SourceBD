// The home page's hero copy, drawn over the studio photograph by `Opening` (opening.tsx). The lede carries the live
// published count when it was read and says the same thing without a number when it was not. The email field hands its
// address to sign-up in this tab's storage, never the URL. Since the founder's videos of 22 Oct 2026: one line of
// headline from 1024 up, no small print under the form (the closing band says free and no card); since his
// walkthrough of 23 Oct 2026 (mercury.com's page, to be matched exactly) the form is a glass pill with Book a demo
// beside it, as mercury.com's Launch demo sits beside its form, the pair centred over the laptop.

import Link from "next/link";
import { buttonClass } from "@/components/kit/button-class";
import { withCommas } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { HeroEmailForm } from "./hero-email";
import { measure, ring } from "./ui";

export function heroLede(suppliers: number | null): string {
  return suppliers !== null
    ? `Search ${withCommas(suppliers)} verified garment suppliers. Every fact on a record names the public register it came from and the day we read it.`
    : "Search verified Bangladesh garment suppliers. Every fact on a record names the public register it came from and the day we read it.";
}

/** The home page's meta description: the live published count, as the hero says it, or no number at all (never "10,000+"). */
export function homeDescription(suppliers: number | null): string {
  const search = suppliers !== null ? `Search ${withCommas(suppliers)} factories and buying houses` : "Search factories and buying houses";
  return `Every fact on a Bangladesh garment supplier, with its source and the date we read it. ${search} checked against the registers that list them. No scores. No paid placement.`;
}

/** The glass a control on the photograph is drawn in: a light fill, a fine edge and the photograph blurred behind it (mercury.com's). */
export const glass = "border border-ink/15 bg-surface/45 backdrop-blur-xl";

export function HeroCopy({ suppliers }: { suppliers: number | null }) {
  return (
    // From 1024 up the navigation floats over the studio, so the copy starts a bar's height lower. Since the founder's
    // walkthrough of 23 Oct 2026 the composition is mercury.com's: one line of headline in its weight, the lede in two
    // lines, then the email in a glass pill with Start free inside it, and Book a demo as a glass pill beside it.
    <div className={cn(measure, "relative flex flex-col items-center pb-10 pt-12 text-center lg:pb-0 lg:pt-[calc(theme(spacing.nav)+22px)]")}>
      <h1 id="home-title" className="font-display text-site-display-sm text-ink [text-wrap:balance] md:text-site-display">
        Bangladesh sourcing, on the record.
      </h1>
      <p className="mt-4 max-w-[340px] text-md text-ink-2 md:max-w-[600px] md:text-site-card">{heroLede(suppliers)}</p>
      <div className="mt-8 flex w-full max-w-[350px] flex-col items-stretch gap-2 md:w-auto md:max-w-none md:flex-row md:items-center">
        <HeroEmailForm className={cn("flex h-12 items-center gap-2 rounded-full py-1 pl-5 pr-1 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent", glass)}>
          <label htmlFor="home-email" className="sr-only">
            Work email
          </label>
          <input
            id="home-email"
            type="email"
            autoComplete="email"
            placeholder="Enter your work email"
            className="h-10 min-w-0 flex-1 bg-transparent text-site-item text-ink outline-none placeholder:text-ink-2 md:w-[230px] md:flex-none"
          />
          <button type="submit" className={buttonClass({ kind: "primary", size: "lg", className: "h-10 shrink-0 rounded-full px-5 text-site-item" })}>
            Start free
          </button>
        </HeroEmailForm>
        <Link href="/contact" prefetch={false} className={cn("flex h-10 items-center justify-center rounded-full px-5 text-site-item text-ink hover:bg-surface/70", glass, ring)}>
          Book a demo
        </Link>
      </div>
    </div>
  );
}
