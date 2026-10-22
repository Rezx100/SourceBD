"use client";

// 9 · Real records, not reviews: three records as production holds them (Mondol Fabrics, Aboni Knitwear, Liberty
// Knitwear), read live through `lib/home-records.ts`. Since the founder's video 3 of 22 Oct 2026 the whole section moves:
// above the cards, each company's public page plays in turn, scrolled for real down to the fact on its card, zoomed in
// on it and out again (clips composed in code from captures of the public pages, PROVENANCE.md). The cards are flat:
// no heavy shadow, no underlined names; the one playing carries a line that fills as it plays, and pointing at a card
// plays its page. A record that could not be read is not drawn; with none read, the section is not drawn at all.

import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { SourceMark } from "@/components/patterns/source-mark";
import type { HomeRecord } from "@/lib/home-records";
import { cn } from "@/lib/utils";
import { Clip } from "./browser";
import { HomeIcon } from "./icons";
import { H2, measure, ring } from "./ui";

/** The public page clip of each record on the cards, and what it shows. */
export const PAGES: Record<string, { clip: string; says: string }> = {
  "mondol-fabrics": { clip: "real-mondol", says: "Mondol Fabrics' public record, scrolled from its header down to its GOTS certificate, which expires on 15 Dec 2026." },
  "aboni-knitwear": { clip: "real-aboni", says: "Aboni Knitwear's public record, scrolled from its header down to its WRAP certificate, valid until 25 Aug 2027." },
  "liberty-knitwear": { clip: "real-liberty", says: "Liberty Knitwear's public record, scrolled from its header down to its RSC safety inspections, 100% of initial items fixed." },
};

export function RealRecords({ cards }: { cards: HomeRecord[] }) {
  const shown = cards.filter((r) => PAGES[r.slug]);
  const [on, setOn] = useState(0);
  const bar = useRef<HTMLSpanElement>(null);
  if (!cards.length) return null;
  return (
    <section aria-labelledby="home-records" className={cn(measure, "flex flex-col gap-10 py-16 md:gap-14 md:py-section")}>
      <H2 id="home-records" className="max-w-[720px]">
        Real records, not reviews. <span className="text-ink-subtle">Open one and check it yourself.</span>
      </H2>
      {shown.length ? (
        <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-surface shadow-window md:aspect-[16/10] md:rounded-stage">
          {shown.map((r, i) => (
            <Clip key={r.slug} name={PAGES[r.slug]!.clip} says={PAGES[r.slug]!.says} active={i === on} onEnded={() => setOn((n) => (n + 1) % shown.length)} bar={i === on ? bar : undefined} />
          ))}
        </div>
      ) : null}
      <ul className="grid w-full gap-5 md:gap-6 lg:grid-cols-3">
        {cards.map((r) => {
          const i = shown.indexOf(r);
          const playing = i >= 0 && i === on;
          return (
            <li key={r.slug} className="flex">
              <Link
                href={`/suppliers/${r.slug}`}
                prefetch={false}
                onMouseEnter={() => i >= 0 && setOn(i)}
                onFocus={() => i >= 0 && setOn(i)}
                className={cn("group relative flex w-full flex-col gap-6 overflow-hidden rounded-card bg-surface p-7 transition-colors duration-slow hover:bg-surface/70 md:p-8", ring)}
              >
                {playing ? <span ref={bar} aria-hidden className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-ink-strong" /> : null}
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-xl font-medium text-ink-strong">{r.name}</h3>
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
                <span className="flex items-center gap-1.5 text-site-body font-medium text-ink-muted transition-colors group-hover:text-ink-strong">
                  Open the record
                  <ArrowRight size={16} aria-hidden className="transition-transform duration-slow group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
