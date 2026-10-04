// /app/searches/new: save a search from a deep link, on the v4 frame (B6b-2). The popover under the
// results (`?save=1` on /app/discover) is the usual way in; this page keeps old links and bookmarks
// working with the same form. A saved search is a query, not a scroll position: the page is
// dropped, so a search saved on page 3 does not go blank when the result set shrinks.

import { SaveSearchForm } from "@/components/saved/save-search";
import { parseDiscoverState, queryTitle, serializeDiscoverState } from "@/lib/discover-v32-state";

export const dynamic = "force-dynamic";

export const metadata = { title: "Save search · SourceBD" };

export default async function SaveSearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const state = { ...parseDiscoverState(sp), page: 1 };
  const search = serializeDiscoverState(state).toString();
  return (
    <div className="flex max-w-prose flex-col gap-4 px-6 py-8 max-md:px-4 max-md:py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Save this search</h1>
        <p className="text-base text-ink-2 [overflow-wrap:anywhere]">{queryTitle(state)}</p>
      </header>
      <div className="max-w-[400px]">
        <SaveSearchForm search={search} defaultName={queryTitle(state)} nextHref="/app/searches" cancelHref="/app/searches" touch="auto" />
      </div>
    </div>
  );
}
