// 9 · Real records, not reviews (Paper `1FH0-0` / `1FO9-0`): three records as production holds them (Mondol Fabrics,
// Aboni Knitwear, Liberty Knitwear), read live through `lib/home-records.ts`: name, the line under it, the framed
// marks of the sources that list it, and two facts each with its source and read date. A record that could not be
// read is not drawn; with none read, the section is not drawn at all. Each card stands on the paper ground with a real
// edge: the hang-tag photograph behind it fought the card (critique 22 Oct, S3).

import Link from "next/link";
import type { HomeRecord } from "@/lib/home-records";
import { cn } from "@/lib/utils";
import { HomeIcon } from "./icons";
import { H2, Lede, Mark, measure, ring } from "./ui";

const COUNT = ["", "One record", "Two records", "Three records"];

export function RealRecords({ cards }: { cards: HomeRecord[] }) {
  if (!cards.length) return null;
  return (
    <section aria-labelledby="home-records" className={cn(measure, "flex flex-col items-center gap-8 py-14 md:gap-14 md:py-section")}>
      <div className="flex flex-col items-center gap-4 text-center">
        <H2 id="home-records">Real records, not reviews.</H2>
        <Lede className="max-w-[720px]">We have no testimonials and will not invent them. {COUNT[cards.length] ?? `${cards.length} records`} as production holds {cards.length === 1 ? "it" : "them"}, each fact with its source and the day we read it.</Lede>
      </div>
      <ul className="grid w-full gap-5 md:gap-8 lg:grid-cols-3">
        {cards.map((r) => (
          <li key={r.slug} className="flex">
            <div className="flex w-full flex-col gap-4 rounded-frame border border-line-strong bg-surface px-6 py-[22px] shadow-sm">
              <div className="flex flex-col gap-1">
                <h3 className="text-site-title font-medium text-ink-strong">
                  <Link href={`/suppliers/${r.slug}`} prefetch={false} className={cn("hover:underline", ring)}>
                    {r.name}
                  </Link>
                </h3>
                <p className="text-base text-ink-muted">{r.meta}</p>
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
                      <span className={cn("text-base font-medium", f.tone === "caution" ? "text-caution" : "text-ink-strong")}>{f.title}</span>
                      <span className="text-xs text-ink-subtle">{f.sub}</span>
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
