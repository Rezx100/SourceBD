// /app/searches: the buyer's saved searches on the v4 frame (B6b, Paper `10 · Saved · saved
// searches`, `11 · Saved · searches`), the second tab of Saved. Each search with its filters in
// words, how many suppliers it finds (cached 10 minutes on the row; the row says when the count was
// taken, because most are remembered rather than live), Run search and Delete.
//
// A failed read is an error where the list was: "No saved searches yet" is a claim about the
// account that a failed read cannot make. `/app/searches/[id]` is a route handler that redirects
// to the search; `/app/searches/new` keeps old save links working.

import { PhoneTabs, SavedHead, SearchesEmpty, SearchesError } from "@/components/saved/list";
import { loadSearches } from "@/components/saved/load";
import { SearchList } from "@/components/saved/searches";
import { buildSearchItems, SEARCHES_HREF } from "@/components/saved/words";
import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Saved searches · SourceBD" };

export default async function SearchesPage() {
  const supabase = await createSupabaseServerClient();
  const role = await getServerRole();
  const now = new Date();
  const data = await loadSearches(supabase, role, now);
  const items = data.searches ? buildSearchItems(data.searches, now) : [];
  const count = data.searches === null ? null : items.length;
  const view = { sort: "recent" as const, page: 1 };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SavedHead tab="searches" suppliers={data.suppliers} searches={count} view={view} capped={data.capped} />
      <PhoneTabs tab="searches" suppliers={data.suppliers} searches={count} />
      {data.searches === null ? <SearchesError retryHref={SEARCHES_HREF} /> : items.length === 0 ? <SearchesEmpty /> : <SearchList items={items} />}
    </div>
  );
}
