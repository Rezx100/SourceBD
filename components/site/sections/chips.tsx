// 3 · The common-search chips under the hero form (Paper `Z05-0`): the first five of the nine searches the app offers
// before a buyer has typed (`SEARCH_TEMPLATES`; five, not nine: critique 22 Oct, S8), each a link to that search, with its live count (`readTemplateCounts`, cached an hour, waited for 1.5 s at most)
// when the count was read and no number at all when it was not. The searches set HS headings and certificate states,
// which public Discover cannot express, so each opens in the app (sign-in first for a visitor). On a phone the chips are
// one strip that scrolls sideways, fading over its last 24 px, with more room than that after the last chip, so the
// chip a visitor scrolls to ends clear of the fade (critique 22 Oct, S10).

import Link from "next/link";
import { readTemplateCounts } from "@/lib/dashboard/search-cache";
import { SEARCH_TEMPLATES } from "@/lib/dashboard/search-templates";
import { discoverHref } from "@/lib/discover-v32-state";
import { withCommas } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { ring } from "./ui";

export type Chip = { key: string; title: string; href: string; count: number | null };

/** The searches the hero offers. */
const HERO = SEARCH_TEMPLATES.slice(0, 5);

/** The hero's five with their counts from `counts`, or null where none was read: with no counts, the chips the first paint draws. */
export function chipsOf(counts: Record<string, number | null> = {}): Chip[] {
  return HERO.map((t) => ({ key: t.key, title: t.title, href: discoverHref(t.state), count: counts[t.key] ?? null }));
}

/** The hero's five with their counts, or null for a count that was not read in time. Never throws. */
export async function loadChips(): Promise<Chip[]> {
  return chipsOf(await readTemplateCounts(HERO).catch((): Record<string, number | null> => ({})));
}

/** `pending`: the counts are still being read, so each chip keeps a count's room and the strip does not grow when they land. */
export function Chips({ chips, pending = false }: { chips: Chip[]; pending?: boolean }) {
  return (
    <ul aria-label="Common searches" className="flex w-full max-w-[900px] gap-2 pt-1 max-md:-mx-5 max-md:w-[calc(100%+40px)] max-md:overflow-x-auto max-md:px-5 max-md:[mask-image:linear-gradient(to_right,black_calc(100%_-_24px),transparent)] max-md:after:w-5 max-md:after:shrink-0 max-md:after:content-[''] md:flex-wrap md:justify-center md:pt-3">
      {chips.map((c) => (
        <li key={c.key} className="shrink-0">
          <Link href={c.href} prefetch={false} className={cn("flex h-[34px] items-center max-md:h-11 gap-2 rounded-full border border-line bg-surface px-3.5 hover:border-line-strong", ring)}>
            <span className="text-base font-medium text-ink-strong">{c.title}</span>
            {c.count !== null ? <span className="text-xs tabular-nums text-ink-subtle">{withCommas(c.count)}</span> : pending ? <span aria-hidden className="invisible text-xs tabular-nums">0,000</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
