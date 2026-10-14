// Six things in a grid (M4, handoff-mercury-m4-onward.md §4.1): an icon, a title and one line each, three across from
// 1024, two on a tablet, one on a phone. The items fade up 60 ms apart as the grid scrolls in (`Reveal`: the server
// draws them in place; only a grid still below the fold waits, and reduced motion never waits). The search page's
// filters first; pricing later.

import { cn } from "@/lib/utils";
import { HomeIcon, type IconName } from "./icons";
import { Reveal } from "./reveal";
import { H2, Lede, measure } from "./ui";

export type IconItem = { icon: IconName; title: string; body: string };

export function IconGrid({ id, title, lede, items, tone = "paper" }: { id: string; title: string; lede?: string; items: readonly IconItem[]; tone?: "paper" | "subtle" }) {
  return (
    <section aria-labelledby={id} className={cn("py-14 md:py-section", tone === "subtle" && "bg-surface")}>
      <div className={cn(measure, "flex flex-col gap-10 md:gap-14")}>
        <div className="flex flex-col gap-4">
          <H2 id={id}>{title}</H2>
          {lede ? <Lede>{lede}</Lede> : null}
        </div>
        <Reveal as="ul" className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <li
              key={it.title}
              style={{ transitionDelay: `${i * 60}ms` }}
              className="flex flex-col gap-3.5 border-t border-line pb-8 pt-6 transition duration-reveal ease-reveal motion-reduce:transition-none group-data-[reveal=wait]/reveal:translate-y-4 group-data-[reveal=wait]/reveal:opacity-0"
            >
              <HomeIcon name={it.icon} className="text-ink-strong" />
              <h3 className="text-site-title font-medium text-ink-strong">{it.title}</h3>
              <p className="text-site-body text-ink-muted">{it.body}</p>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
