"use client";

// Real records, in the place of mercury.com's customer stories (the founder's walkthrough of 23 Oct 2026: the page to
// match exactly). Mercury plays a founder on camera with their words over the picture; SourceBD has no customer stories
// to tell and invents none (dummy testimonials were declined on 22 Oct: illegal under the UK DMCC Act 2024 and the US
// FTC's 2024 rule), so each slide is a real record instead: the company's public page playing, scrolled for real down
// to the fact named on the slide (clips composed in code from captures of the public pages, PROVENANCE.md), and over
// it, where Mercury sets the quote, that fact, the company's name and its line, as production holds them now
// (`lib/home-records.ts`). One slide at a time across the page's width, sliding to the next when its page has played;
// the three rules under it say which is showing and fill as it plays, and a click on one shows that record. A record
// that could not be read is not drawn; with none read, the section is not drawn at all.

import Link from "next/link";
import { useRef, useState } from "react";
import type { HomeRecord } from "@/lib/home-records";
import { cn } from "@/lib/utils";
import { Clip } from "./browser";
import { column, ring } from "./ui";

/** The public page clip of each record, and what it shows. */
export const PAGES: Record<string, { clip: string; says: string }> = {
  "mondol-fabrics": { clip: "real-mondol", says: "Mondol Fabrics' public record, scrolled from its header down to its GOTS certificate, which expires on 15 Dec 2026, then back to the top." },
  "aboni-knitwear": { clip: "real-aboni", says: "Aboni Knitwear's public record, scrolled from its header down to its WRAP certificate, valid until 25 Aug 2027, then back to the top." },
  "liberty-knitwear": { clip: "real-liberty", says: "Liberty Knitwear's public record, scrolled from its header down to its RSC safety inspections, 100% of initial items fixed, then back to the top." },
};

/** A record's line split as the slide sets it: its kind as the tag ("Factory"), the rest under its name. */
export function slideLines(meta: string): { tag: string | null; line: string } {
  const [tag, ...rest] = meta.split(" · ");
  return rest.length ? { tag: tag ?? null, line: rest.join(" · ") } : { tag: null, line: meta };
}

export function RealRecords({ cards }: { cards: HomeRecord[] }) {
  const shown = cards.filter((r) => PAGES[r.slug]);
  const [on, setOn] = useState(0);
  const bar = useRef<HTMLSpanElement>(null);
  if (!shown.length) return null;
  return (
    <section data-mk-tone="night" aria-labelledby="home-records" className="overflow-hidden pb-14 pt-12 md:pb-20 md:pt-[72px]">
      <h2 id="home-records" className="sr-only">
        Real records, as production holds them
      </h2>
      <div className="flex transition-transform duration-reveal ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${on * 100}%)` }}>
        {shown.map((r, i) => {
          const fact = r.facts[0];
          const { tag, line } = slideLines(r.meta);
          const showing = i === on;
          return (
            <div key={r.slug} inert={!showing} aria-hidden={!showing} className="w-full shrink-0">
              <div className={cn(column, "relative aspect-[4/5] overflow-hidden rounded-frame bg-sunken sm:aspect-[2/1]")}>
                {/* The page plays in the card's right part, as mercury.com's founder sits right of the words; the words keep the night under them. */}
                <div className="absolute inset-y-0 right-0 w-full sm:w-[68%]">
                  <Clip name={PAGES[r.slug]!.clip} says={PAGES[r.slug]!.says} active={showing} onEnded={() => setOn((n) => (n + 1) % shown.length)} bar={showing ? bar : undefined} />
                </div>
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-sunken via-sunken/60 via-45% to-transparent sm:bg-[linear-gradient(90deg,rgb(var(--ds-sunken))_33%,rgb(var(--ds-sunken)/0.88)_41%,rgb(var(--ds-sunken)/0.6)_51%,rgb(var(--ds-sunken)/0.28)_62%,rgb(var(--ds-sunken)/0.08)_72%,transparent_80%)]" />
                {tag ? <span className="pointer-events-none absolute left-5 top-5 flex h-8 items-center rounded-sm bg-[rgb(var(--mk-ground-night))] px-2 text-site-item text-ink md:left-8 md:top-8">{tag}</span> : null}
                <div className="pointer-events-none absolute inset-x-5 bottom-5 flex max-w-[400px] flex-col gap-6 md:inset-x-8 md:bottom-8 md:gap-8">
                  {fact ? <p className="font-display text-site-card text-ink md:text-xl">{fact.title}</p> : null}
                  <div className="flex flex-col">
                    <Link href={`/suppliers/${r.slug}`} prefetch={false} className={cn("pointer-events-auto w-fit font-display text-site-card text-ink underline-offset-4 hover:underline md:text-xl", ring)}>
                      {r.name}
                    </Link>
                    <p className="font-book text-site-card text-ink-2 md:text-xl">{line}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {shown.length > 1 ? (
        <div className="mt-6 flex justify-center gap-1 md:mt-8">
          {shown.map((r, i) => (
            <button key={r.slug} type="button" aria-label={`Show ${r.name}`} aria-pressed={i === on} onClick={() => setOn(i)} className={cn("flex h-8 w-20 items-center", ring)}>
              <span className="relative h-0.5 w-full overflow-hidden rounded-full bg-ink/20">
                {i === on ? <span ref={bar} className="absolute inset-0 origin-left scale-x-0 bg-ink" /> : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
