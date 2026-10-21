// A list of short points in hairline rows (critique 22 Oct: bordered cards of icon, title and line read cheap): a title
// and one line each, no icon, two columns from 768. The search page's six filters and the home's eight things a
// sourcing desk needs. The rows fade up 60 ms apart as the list scrolls in (`Reveal`: the server draws them in place;
// only a list still below the fold waits, and reduced motion never waits).

import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";
import { H2, Lede, measure } from "./ui";

export type GridItem = { title: string; body: string };

export function HairlineGrid({ id, title, lede, items, tone = "paper", center = false }: { id: string; title: string; lede?: string; items: readonly GridItem[]; tone?: "paper" | "subtle"; /** The heading centred over the list (the home's). */ center?: boolean }) {
  return (
    <section aria-labelledby={id} className={cn("py-14 md:py-section", tone === "subtle" && "bg-surface")}>
      <div className={cn(measure, "flex flex-col gap-10 md:gap-14", center && "items-center")}>
        <div className={cn("flex flex-col gap-4", center && "items-center text-center")}>
          <H2 id={id}>{title}</H2>
          {lede ? <Lede className={center ? "mx-auto" : undefined}>{lede}</Lede> : null}
        </div>
        <Reveal as="ul" className="grid w-full gap-x-16 border-t border-line md:grid-cols-2">
          {items.map((it, i) => (
            <li
              key={it.title}
              style={{ transitionDelay: `${i * 60}ms` }}
              className="flex flex-col gap-1.5 border-b border-line py-5 transition duration-reveal ease-reveal motion-reduce:transition-none group-data-[reveal=wait]/reveal:translate-y-4 group-data-[reveal=wait]/reveal:opacity-0 lg:flex-row lg:items-baseline lg:gap-8"
            >
              <h3 className="text-site-title font-medium text-ink-strong lg:w-[240px] lg:shrink-0">{it.title}</h3>
              <p className="text-site-body text-ink-muted">{it.body}</p>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
