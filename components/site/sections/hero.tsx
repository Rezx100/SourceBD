// The home page's hero copy, drawn over the studio photograph by `Opening` (opening.tsx). The lede carries the live
// published count when it was read and says the same thing without a number when it was not. The email field hands its
// address to sign-up in this tab's storage, never the URL. Since the founder's videos of 22 Oct 2026: one line of
// headline from 1024 up, no small print under the form (the closing band says free and no card); since his review of
// 22 Oct 14:18 the form is the one call to action, centred over the laptop, with no link beside it to throw the
// composition off (the real records have their own section).

import { buttonClass } from "@/components/kit/button-class";
import { withCommas } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { HeroEmailForm } from "./hero-email";
import { measure } from "./ui";

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

export function HeroCopy({ suppliers }: { suppliers: number | null }) {
  return (
    // From 1024 up the navigation floats over the studio, so the copy starts a bar's height lower.
    <div className={cn(measure, "relative flex flex-col items-center gap-5 pb-10 pt-12 text-center md:gap-6 lg:pb-0 lg:pt-[calc(9vh+theme(spacing.nav))]")}>
      <h1 id="home-title" className="text-site-h1-sm font-light text-ink-strong [text-wrap:balance] md:text-site-h1">
        Bangladesh sourcing, on the record.
      </h1>
      <p className="max-w-[340px] text-md text-ink-muted md:max-w-[600px] md:text-site-lede">{heroLede(suppliers)}</p>
      <HeroEmailForm className="flex w-full max-w-[350px] flex-col gap-2.5 pt-1 md:w-auto md:max-w-none md:flex-row md:items-center md:justify-center">
        <label htmlFor="home-email" className="sr-only">
          Work email
        </label>
        <input
          id="home-email"
          type="email"
          autoComplete="email"
          placeholder="Work email"
          className="h-12 w-full rounded-frame border border-line bg-surface px-4 text-site-body text-ink-strong shadow-sm outline-none placeholder:text-ink-subtle focus:border-accent focus:[box-shadow:inset_0_0_0_1px_theme(colors.accent)] md:w-80"
        />
        <button type="submit" className={buttonClass({ kind: "primary", size: "lg", className: "h-12 rounded-frame px-[22px] text-site-body" })}>
          Start free
        </button>
      </HeroEmailForm>
    </div>
  );
}
