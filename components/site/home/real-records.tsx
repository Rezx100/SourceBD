// 9 · Real records, not reviews (Paper `1FH0-0` / `1FO9-0`): three records as production holds them (Mondol Fabrics,
// Aboni Knitwear, Liberty Knitwear), read live through `lib/home-records.ts`: name, the line under it, the framed
// marks of the sources that list it, and two facts each with its source and read date. A record that could not be
// read is not drawn; with none read, the section is not drawn at all.

import Link from "next/link";
import type { HomeRecord } from "@/lib/home-records";
import { cn } from "@/lib/utils";
import { HomeIcon } from "./icons";
import { H2, Lede, Mark, Still, measure, ring } from "./ui";

const COUNT = ["", "One record", "Two records", "Three records"];

/** Where each card's crop of the hang tags sits, as the board has it. */
const AT = ["object-[50%_40%]", "object-center", "object-[50%_60%]"];

export function RealRecords({ cards }: { cards: HomeRecord[] }) {
  if (!cards.length) return null;
  return (
    <section aria-labelledby="home-records" className={cn(measure, "flex flex-col items-center gap-8 py-14 md:gap-14 md:py-[120px]")}>
      <div className="flex flex-col items-center gap-4 text-center">
        <H2 id="home-records">Real records, not reviews.</H2>
        <Lede className="max-w-[720px]">We have no testimonials and will not invent them. {COUNT[cards.length] ?? `${cards.length} records`} as production holds {cards.length === 1 ? "it" : "them"}, each fact with its source and the day we read it.</Lede>
      </div>
      <ul className="grid w-full gap-5 md:gap-8 lg:grid-cols-3">
        {cards.map((r, i) => (
          <li key={r.slug} className="relative isolate flex min-h-[409px] items-end overflow-hidden rounded-pane-phone p-4 md:rounded-pane md:p-7 lg:min-h-[460px]">
            <Still name="hangtags-fanned" className={AT[i] ?? "object-center"} sizes="(min-width: 1440px) 405px, (min-width: 1024px) 33vw, 100vw" />
            <div className="relative flex w-full flex-col gap-4 rounded-[12px] border border-ink-strong/10 bg-surface px-6 py-[22px] shadow-lg">
              <div className="flex flex-col gap-1">
                <h3 className="text-[20px] font-medium leading-6 text-ink-strong">
                  <Link href={`/suppliers/${r.slug}`} prefetch={false} className={cn("hover:underline", ring)}>
                    {r.name}
                  </Link>
                </h3>
                <p className="text-[14px] leading-[18px] text-ink-muted">{r.meta}</p>
              </div>
              {r.marks.length ? (
                <ul className="flex flex-wrap gap-1.5" aria-label={`Listed by ${r.marks.join(", ")}`}>
                  {r.marks.map((m) => (
                    <li key={m}>
                      <Mark code={m} />
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className="flex flex-col gap-3 border-t border-line-subtle pt-1">
                {r.facts.map((f) => (
                  <li key={f.title} className="flex gap-2.5 pt-3">
                    <HomeIcon name={f.icon} size={20} className="text-ink-strong" />
                    <span className="flex flex-col gap-0.5">
                      <span className={cn("text-[14px] font-medium leading-[18px]", f.tone === "caution" ? "text-caution" : "text-ink-strong")}>{f.title}</span>
                      <span className="text-[12px] leading-4 text-ink-subtle">{f.sub}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
