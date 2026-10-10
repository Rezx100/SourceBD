// 3 · The common-search chips under the hero form (Paper `Z05-0`): the nine searches the app offers before a buyer has
// typed (`SEARCH_TEMPLATES`), each a link to that search, with its live count (`readSearchCount`, cached an hour)
// when the count was read and no number at all when it was not. The searches set HS headings and certificate states,
// which public Discover cannot express, so each opens in the app (sign-in first for a visitor).

import Link from "next/link";
import { readSearchCount } from "@/lib/dashboard/search-cache";
import { SEARCH_TEMPLATES } from "@/lib/dashboard/search-templates";
import { discoverHref } from "@/lib/discover-v32-state";
import { withCommas } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { ring } from "./ui";

export type Chip = { key: string; title: string; href: string; count: number | null };

/** Every template with its count, or null for a count that was not read. Never throws. */
export async function loadChips(): Promise<Chip[]> {
  return Promise.all(SEARCH_TEMPLATES.map(async (t) => ({ key: t.key, title: t.title, href: discoverHref(t.state), count: await readSearchCount(t.state).catch(() => null) })));
}

export function Chips({ chips }: { chips: Chip[] }) {
  return (
    <ul aria-label="Common searches" className="flex w-full max-w-[900px] gap-2 pt-1 max-md:-mx-5 max-md:w-[calc(100%+40px)] max-md:overflow-x-auto max-md:px-5 md:flex-wrap md:justify-center md:pt-3">
      {chips.map((c) => (
        <li key={c.key} className="shrink-0">
          <Link href={c.href} prefetch={false} className={cn("flex h-[34px] items-center gap-2 rounded-full border border-line bg-surface px-3.5 hover:border-line-strong", ring)}>
            <span className="text-[14px] font-medium leading-4 text-ink-strong">{c.title}</span>
            {c.count !== null ? <span className="font-mono text-[12px] leading-[14px] text-ink-subtle">{withCommas(c.count)}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
