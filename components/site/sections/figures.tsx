"use client";

// 14 · Figures: counted straight from the records, through the site's live facts (`lib/site-facts.ts`). A figure that
// was not read is left out, never guessed; "50 per RFQ" and "0 scores" are true by definition and always shown. Since
// the founder's video of 22 Oct 2026 (the row looked dead, with small print under it) the numbers count up once as
// the row scrolls in, ending on the figure the server already drew; nothing counts with no script, under reduced
// motion, or when the row is on screen as the page opens. The dated line under the row is gone: the footer carries it.

import { useEffect, useRef, useState } from "react";
import { stillPreferred } from "@/components/site/motion";
import { withCommas, type SiteFacts } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { H2, measure } from "./ui";

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

const COUNT_MS = 1600;

/** How far through the count `t` (0 to 1) is shown: fast, then settling. */
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function Figures({ facts }: { facts: SiteFacts }) {
  const cells = figureCells(facts);
  const row = useRef<HTMLUListElement>(null);
  const [t, setT] = useState(1);
  useEffect(() => {
    const el = row.current;
    if (!el || stillPreferred() || el.getBoundingClientRect().top < innerHeight || typeof IntersectionObserver === "undefined") return;
    setT(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / COUNT_MS);
        setT(k);
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { rootMargin: "0px 0px -15% 0px" });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <section aria-labelledby="home-figures" className={cn(measure, "flex flex-col gap-10 pb-16 md:gap-14 md:pb-section")}>
      <H2 id="home-figures" className="max-w-[720px]">
        Counted straight from our records.
      </H2>
      <ul ref={row} className="grid w-full gap-px overflow-hidden rounded-card bg-line-subtle ring-1 ring-line-subtle sm:grid-cols-2 lg:grid-cols-5">
        {cells.map(([n, what]) => {
          const target = Number(n.replace(/,/g, ""));
          const shown = t >= 1 ? n : withCommas(Math.round(target * ease(t)));
          return (
            <li key={what} className="flex flex-col gap-2 bg-surface p-6 md:p-8">
              <span className="text-site-figure-sm font-light tabular-nums text-ink-strong md:text-site-figure">{shown}</span>
              <span className="text-site-body text-ink-muted">{what}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
