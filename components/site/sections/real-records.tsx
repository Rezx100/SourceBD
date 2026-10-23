"use client";

// 9 · Real records, not reviews: three records as production holds them (Mondol Fabrics, Aboni Knitwear, Liberty
// Knitwear), read live through `lib/home-records.ts`. Since the founder's video 3 of 22 Oct 2026 the whole section moves:
// each company's public page plays in turn, scrolled for real down to the fact named under it, the fact lifting while
// the camera comes in on it and out again (clips composed in code from captures of the public pages, PROVENANCE.md).
// Since his recording of 22 Oct 13:17 (the three cards under the clip "look odd, try a different design") the records
// are a plain strip under the page, three columns parted by hairlines, no card, no mark, no icon: the company's name,
// its line, the one fact the page scrolls to, and Open the record; the one playing carries a line that fills as it
// plays, and pointing at a record plays its page. A record that could not be read is not drawn; with none read, the
// section is not drawn at all.

import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useRef, useState } from "react";
import type { HomeRecord } from "@/lib/home-records";
import { cn } from "@/lib/utils";
import { Clip } from "./browser";
import { H2, measure, ring } from "./ui";

/** The public page clip of each record, and what it shows. */
export const PAGES: Record<string, { clip: string; says: string }> = {
  "mondol-fabrics": { clip: "real-mondol", says: "Mondol Fabrics' public record, scrolled from its header down to its GOTS certificate, which expires on 15 Dec 2026, then back to the top." },
  "aboni-knitwear": { clip: "real-aboni", says: "Aboni Knitwear's public record, scrolled from its header down to its WRAP certificate, valid until 25 Aug 2027, then back to the top." },
  "liberty-knitwear": { clip: "real-liberty", says: "Liberty Knitwear's public record, scrolled from its header down to its RSC safety inspections, 100% of initial items fixed, then back to the top." },
};

export function RealRecords({ cards }: { cards: HomeRecord[] }) {
  const shown = cards.filter((r) => PAGES[r.slug]);
  const [on, setOn] = useState(0);
  const bar = useRef<HTMLSpanElement>(null);
  if (!cards.length) return null;
  return (
    <section aria-labelledby="home-records" className={cn(measure, "flex flex-col gap-10 py-16 md:gap-12 md:py-section")}>
      <H2 id="home-records" className="max-w-[720px]">
        Real records, not reviews. <span className="text-ink-subtle">Open one and check it yourself.</span>
      </H2>
      {shown.length ? (
        <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-sunken md:aspect-[16/10] md:rounded-stage">
          {shown.map((r, i) => (
            <Clip key={r.slug} name={PAGES[r.slug]!.clip} says={PAGES[r.slug]!.says} active={i === on} onEnded={() => setOn((n) => (n + 1) % shown.length)} bar={i === on ? bar : undefined} />
          ))}
        </div>
      ) : null}
      <ol className="grid border-t border-line lg:grid-cols-3">
        {cards.map((r) => {
          const i = shown.indexOf(r);
          const playing = i >= 0 && i === on;
          const fact = r.facts[0];
          return (
            <li key={r.slug} className="relative flex border-b border-line lg:border-b-0 lg:border-r lg:last:border-r-0">
              <Link
                href={`/suppliers/${r.slug}`}
                prefetch={false}
                onMouseEnter={() => i >= 0 && setOn(i)}
                onFocus={() => i >= 0 && setOn(i)}
                className={cn("group flex w-full flex-col gap-4 py-6 lg:px-8 lg:first:pl-0", ring)}
              >
                {playing ? <span ref={bar} aria-hidden className="absolute -top-px left-0 h-0.5 w-full origin-left scale-x-0 bg-ink-strong lg:w-[calc(100%-2rem)]" /> : null}
                <div className="flex flex-col gap-1">
                  <h3 className={cn("text-xl font-medium transition-colors duration-slow", playing ? "text-ink-strong" : "text-ink-muted group-hover:text-ink-strong")}>{r.name}</h3>
                  <p className="text-site-body text-ink-muted">{r.meta}</p>
                </div>
                {fact ? <p className={cn("text-site-title", fact.tone === "caution" ? "text-caution" : "text-ink-strong")}>{fact.title}</p> : null}
                <span className="mt-auto flex items-center gap-1.5 text-site-body font-medium text-ink-muted transition-colors group-hover:text-ink-strong">
                  Open the record
                  <ArrowRight size={16} aria-hidden className="transition-transform duration-slow group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
