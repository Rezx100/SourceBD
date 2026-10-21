// 3 · Hero copy (Paper `Z05-0` / `Z5H-0`) and 4 · Hero stage (`Z0H-0` / `Z5R-0`). The lede carries the live
// published count when it was read and says the same thing without a number when it was not. The email field
// hands its address to sign-up in this tab's storage, never the URL; the record link opens Aboni Knitwear's public record. The chips under the form
// are the nine common searches (PR 3 gives them their live counts).

import { buttonClass } from "@/components/kit/button-class";
import { SearchEnd } from "@/components/site/demos";
import { withCommas } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { HeroEmailForm } from "./hero-email";
import { HeroLoop } from "./hero-loop";
import { TextLink, measure } from "./ui";

export const RECORD_HREF = "/suppliers/aboni-knitwear";

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

export function HeroCopy({ suppliers, chips }: { suppliers: number | null; chips?: ReactNode }) {
  return (
    <div className={cn(measure, "flex flex-col items-center gap-[18px] pb-7 pt-10 text-center md:gap-7 md:pb-14 md:pt-[104px]")}>
      <h1 id="home-title" className="text-site-hero-sm font-light text-ink-strong md:text-site-hero">
        Bangladesh sourcing,
        <br />
        on the record.
      </h1>
      <p className="max-w-[330px] text-md text-ink-muted md:max-w-[620px] md:text-site-title">{heroLede(suppliers)}</p>
      <HeroEmailForm className="flex w-full max-w-[350px] flex-col gap-2.5 pt-1.5 md:w-auto md:max-w-none md:flex-row md:items-center md:pt-2">
        <label htmlFor="home-email" className="sr-only">
          Work email
        </label>
        <input
          id="home-email"
          type="email"
          autoComplete="email"
          placeholder="Work email"
          className="h-12 w-full rounded-frame border border-line bg-surface px-4 text-site-body text-ink-strong outline-none placeholder:text-ink-subtle focus:border-accent focus:[box-shadow:inset_0_0_0_1px_theme(colors.accent)] md:w-80"
        />
        <button type="submit" className={buttonClass({ kind: "primary", size: "lg", className: "h-12 rounded-frame px-[22px] text-site-body" })}>
          Start free
        </button>
        <TextLink href={RECORD_HREF} className="h-12 justify-center px-3.5">
          See a real record
        </TextLink>
      </HeroEmailForm>
      {chips}
      <p className="text-sm text-ink-subtle">Search is free. No card needed. Suppliers claim their record at no cost.</p>
    </div>
  );
}

/**
 * The hero (M3, handoff-mercury-motion-sitewide.md §4.1, phase 1): the copy, then the search's end frame on the cotton
 * stage, drawn from the snapshot's real records as the tour's Find plays them (critique 22 Oct: no 3 Oct screenshot). From 768 up, where the browser scrubs animations by scroll and nothing asks for reduced motion, app/ds.css
 * makes it a 220vh scene: the copy fades over the first 30% of the scroll while the stage rises to the content
 * width, its cloth zooming and dimming towards the night tone, so the dark tour's first frame follows (`.mk-hero-*`).
 * Everywhere else, and with no script, the page is this markup in flow.
 */
export function HeroScrub({ suppliers, chips }: { suppliers: number | null; chips?: ReactNode }) {
  return (
    <section data-tone="photo" aria-labelledby="home-title" className="mk-hero relative">
      <div className="mk-hero-pin">
        <div className="mk-hero-copy w-full">
          <HeroCopy suppliers={suppliers} chips={chips} />
        </div>
        <div className={cn(measure, "mk-hero-stage-wrap pb-14 md:pb-section")}>
          <div className="mk-hero-stage relative isolate mx-auto flex max-w-[350px] items-center justify-center overflow-hidden rounded-card px-4 py-6 md:max-w-none md:rounded-stage md:px-16 md:py-[68px]">
            <HeroLoop />
            <div aria-hidden className="mk-hero-dim pointer-events-none absolute inset-0 bg-ink opacity-0" />
            <SearchEnd className="relative mx-auto max-w-[1152px]" />
          </div>
        </div>
      </div>
    </section>
  );
}
