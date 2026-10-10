// 14 · Figures (Paper `Z2R-0` / `1FBV-0`): counted straight from the records, through the site's live facts
// (`lib/site-facts.ts`). A figure that was not read is left out, never guessed; "50 per RFQ" and "0 scores" are true
// by definition and always shown. The line under the row dates the read.

import { readDay, withCommas, type SiteFacts } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { measure } from "./ui";

/** The figures as [number, what it counts], each only when it was read. */
export function figureCells(f: SiteFacts): [string, string][] {
  const cells: ([string, string] | null)[] = [
    f.suppliers !== null ? [withCommas(f.suppliers), "Bangladesh garment suppliers published"] : null,
    f.sourcesWithRecords !== null && f.sourcesListed !== null ? [String(f.sourcesWithRecords), `of ${f.sourcesListed} public sources holding records`] : null,
    f.certificatesOnFile !== null ? [withCommas(f.certificatesOnFile), "certificates on file, each with its issuer and number"] : null,
    ["50", "suppliers reached by one RFQ"],
    ["0", "scores, grades or stars on any supplier"],
  ];
  return cells.filter((c): c is [string, string] => c !== null);
}

export function Figures({ facts }: { facts: SiteFacts }) {
  const cells = figureCells(facts);
  const read = readDay(facts.latestRead);
  return (
    <section aria-labelledby="home-figures" className={cn(measure, "flex flex-col items-center gap-8 pb-14 md:gap-14 md:pb-[140px]")}>
      <h2 id="home-figures" className="text-center text-[28px] leading-[34px] tracking-[-0.02em] text-ink-strong md:text-[40px] md:leading-[48px]">
        Counted straight from our records.
        <br className="max-md:hidden" /> Not rounded.
      </h2>
      <ul className="grid w-full border-y border-line sm:grid-cols-2 lg:flex">
        {cells.map(([n, what], i) => (
          <li key={what} className={cn("flex flex-col gap-1.5 py-6 md:py-9 lg:flex-1", i > 0 && "max-sm:border-t max-sm:border-line-subtle lg:border-l lg:border-line-subtle lg:pl-8")}>
            <span className="text-[44px] font-light leading-[52px] tracking-[-0.03em] text-ink-strong md:text-[52px] md:leading-[60px]">{n}</span>
            <span className="text-[15px] leading-5 text-ink-muted">{what}</span>
          </li>
        ))}
      </ul>
      {read ? <p className="text-center text-[13px] leading-4 text-ink-subtle">Counted from production; the latest register read was {read}.</p> : null}
    </section>
  );
}
