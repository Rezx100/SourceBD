// The other three products at the foot of a product or solutions page (M4, handoff-mercury-m4-onward.md §4.1): a
// card each with its title, the one line the navigation says, a small loop of that product on the snapshot's real
// records, and the link to its page. On the night ground, so each loop stands on the night material and its window
// keeps the product's light ground.

import type { ComponentType } from "react";
import { VignetteExpiry, VignetteMarks, VignetteQuotes, VignetteSearch } from "@/components/site/demos";
import type { Frame } from "@/components/site/demos/stage";
import { PRODUCT } from "@/components/site/map";
import { cn } from "@/lib/utils";
import { HomeIcon } from "./icons";
import { H2, Lede, TextLink, measure } from "./ui";

/** Each product's small loop (a search typed, the marks settling, two quotes landing, a certificate counting down) and the words of its link (the home's showcase links). */
const LOOP: Record<string, { Loop: ComponentType<Frame>; link: string }> = {
  "/product/search": { Loop: VignetteSearch, link: "See the search" },
  "/product/records": { Loop: VignetteMarks, link: "See the record pane" },
  "/product/rfqs": { Loop: VignetteQuotes, link: "How RFQs work" },
  "/product/compliance": { Loop: VignetteExpiry, link: "Inside the Compliance hub" },
};

export function CrossSell({ current, only }: { /** A product page's own address, left out of the three. */ current?: string; /** A solutions page names its three, in order. */ only?: readonly string[] }) {
  const others = only ? only.map((href) => PRODUCT.find((p) => p.href === href)).filter((p): p is (typeof PRODUCT)[number] => p !== undefined) : PRODUCT.filter((p) => p.href !== current);
  return (
    <section aria-labelledby="site-cross-sell" className={cn(measure, "flex flex-col gap-10 py-14 md:gap-14 md:py-section")}>
      <div className="flex flex-col gap-4">
        <H2 id="site-cross-sell">The rest of the desk, on the same records.</H2>
        <Lede>Find suppliers, ask them for quotes and watch what changes. Each one reads the record you just saw.</Lede>
      </div>
      {/* Each card spans the two shared rows (loop, words), so the three titles line up whatever each loop's height. */}
      <ul className="grid gap-8 md:grid-cols-3 md:grid-rows-[auto_auto]">
        {others.map((p) => {
          const loop = LOOP[p.href];
          return (
            <li key={p.href} className="row-span-2 grid grid-rows-subgrid gap-4">
              {loop ? <loop.Loop stage="night" /> : null}
              <div className="flex flex-col gap-1.5">
                <h3 className="flex items-center gap-2.5 text-site-title font-medium text-ink-strong">
                  {p.icon ? <HomeIcon name={p.icon} size={20} className="text-ink-strong" /> : null}
                  {p.title}
                </h3>
                {p.body ? <p className="text-site-body text-ink-muted">{p.body}</p> : null}
                <TextLink href={p.href}>{loop?.link ?? p.title}</TextLink>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
