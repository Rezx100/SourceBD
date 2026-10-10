// 3 · Hero copy (Paper `Z05-0` / `Z5H-0`) and 4 · Hero stage (`Z0H-0` / `Z5R-0`). The lede carries the live
// published count when it was read and says the same thing without a number when it was not. The email field
// hands its address to sign-up; the record link opens Aboni Knitwear's public record. The chips under the form
// are the nine common searches (PR 3 gives them their live counts).

import { buttonClass } from "@/components/kit/button-class";
import { withCommas } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Screen, Still, TextLink, measure } from "./ui";

export const RECORD_HREF = "/suppliers/aboni-knitwear";

export function heroLede(suppliers: number | null): string {
  return suppliers !== null
    ? `Search ${withCommas(suppliers)} verified garment suppliers. Every fact on a record names the public register it came from and the day we read it.`
    : "Search verified Bangladesh garment suppliers. Every fact on a record names the public register it came from and the day we read it.";
}

export function HeroCopy({ suppliers, chips }: { suppliers: number | null; chips?: ReactNode }) {
  return (
    <section aria-labelledby="home-title" className={cn(measure, "flex flex-col items-center gap-[18px] pb-7 pt-10 text-center md:gap-7 md:pb-14 md:pt-[104px]")}>
      <h1 id="home-title" className="text-[42px] font-light leading-[46px] tracking-[-0.03em] text-ink-strong md:text-[76px] md:leading-[84px]">
        Bangladesh sourcing,
        <br />
        on the record.
      </h1>
      <p className="max-w-[330px] text-[16px] leading-6 text-ink-muted md:max-w-[620px] md:text-[19px] md:leading-7">{heroLede(suppliers)}</p>
      <form action="/signup" method="get" className="flex w-full max-w-[350px] flex-col gap-2.5 pt-1.5 md:w-auto md:max-w-none md:flex-row md:items-center md:pt-2">
        <label htmlFor="home-email" className="sr-only">
          Work email
        </label>
        <input
          id="home-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Work email"
          className="h-12 w-full rounded-[10px] border border-line bg-surface px-4 text-[15px] text-ink-strong outline-none placeholder:text-ink-subtle focus:border-accent focus:[box-shadow:inset_0_0_0_1px_theme(colors.accent)] md:w-80"
        />
        <button type="submit" className={buttonClass({ kind: "primary", size: "lg", className: "h-12 rounded-[10px] px-[22px] text-[15px]" })}>
          Start free
        </button>
        <TextLink href={RECORD_HREF} className="h-12 justify-center px-3.5">
          See a real record
        </TextLink>
      </form>
      {chips}
      <p className="text-[13px] leading-4 text-ink-subtle">Search is free. No card needed. Suppliers claim their record at no cost.</p>
    </section>
  );
}

/** The cotton backdrop and the results screen on top. */
export function HeroStage() {
  return (
    <div className={cn(measure, "pb-14 md:pb-[120px]")}>
      <div className="relative isolate mx-auto flex max-w-[350px] items-center justify-center overflow-hidden rounded-pane-phone px-4 py-6 md:max-w-none md:rounded-[24px] md:px-16 md:py-[68px]">
        <Still name="hero-cotton" eager />
        <Screen name="results" eager alt="SourceBD search results: suppliers with their source marks, one record open beside the list" className="mx-auto max-w-[1152px]" />
      </div>
    </div>
  );
}
