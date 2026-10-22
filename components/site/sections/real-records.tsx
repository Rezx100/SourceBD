// 9 · Real records, not reviews: three records as production holds them (Mondol Fabrics, Aboni Knitwear, Liberty
// Knitwear), read live through `lib/home-records.ts`. Since the founder's video of 22 Oct 2026 each card says less and
// says it larger: the name, where and how big, the marks of the registers that list it, and two facts, with no small
// source lines under them (the record a click away carries those). A record that could not be read is not drawn; with
// none read, the section is not drawn at all.

import Link from "next/link";
import { SourceMark } from "@/components/patterns/source-mark";
import type { HomeRecord } from "@/lib/home-records";
import { cn } from "@/lib/utils";
import { HomeIcon } from "./icons";
import { H2, measure, ring } from "./ui";

export function RealRecords({ cards }: { cards: HomeRecord[] }) {
  if (!cards.length) return null;
  return (
    <section aria-labelledby="home-records" className={cn(measure, "flex flex-col gap-10 py-16 md:gap-14 md:py-section")}>
      <H2 id="home-records" className="max-w-[720px]">
        Real records, not reviews. <span className="text-ink-subtle">Open one and check it yourself.</span>
      </H2>
      <ul className="grid w-full gap-5 md:gap-6 lg:grid-cols-3">
        {cards.map((r) => (
          <li key={r.slug} className="flex">
            <Link
              href={`/suppliers/${r.slug}`}
              prefetch={false}
              className={cn("group flex w-full flex-col gap-6 rounded-card bg-surface p-7 shadow-sm ring-1 ring-ink/5 transition-shadow duration-slow hover:shadow-window md:p-8", ring)}
            >
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xl font-medium text-ink-strong group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{r.name}</h3>
                <p className="text-md text-ink-muted">{r.meta}</p>
              </div>
              {r.marks.length ? (
                <ul className="flex flex-wrap gap-2" aria-label={`Listed by ${r.marks.join(", ")}`}>
                  {r.marks.map((m) => (
                    <li key={m}>
                      <SourceMark source={m} className="size-9 border-ink-strong/10 [&>img]:max-h-[24px] [&>img]:max-w-[24px]" />
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className="mt-auto flex flex-col gap-3 border-t border-line-subtle pt-5">
                {r.facts.map((f) => (
                  <li key={f.title} className="flex items-center gap-3">
                    <HomeIcon name={f.icon} size={20} className="text-ink-strong" />
                    <span className={cn("text-md", f.tone === "caution" ? "text-caution" : "text-ink-strong")}>{f.title}</span>
                  </li>
                ))}
              </ul>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
