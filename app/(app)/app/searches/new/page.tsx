// /app/searches/new — save a search from a deep link. The search pane on
// /app/discover (`?save=1`) is the usual way in; this page keeps old links
// and bookmarks working, in the same page grammar as every other page.

import { Page, PageHeader, PageSection } from "@/components/dashboard/page";
import { SaveSearchForm } from "@/components/dashboard/save-search-form";
import { parseDiscoverState, queryTitle, serializeDiscoverState } from "@/lib/discover-v32-state";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Save search · SourceBD",
};

export default async function SaveSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // A saved search is a query, not a scroll position. Persisting `page` means
  // a search saved on page 3 goes blank the moment the result set shrinks
  // below three pages — the buyer reopens it and reads "no match" for a
  // search that still has results.
  const state = { ...parseDiscoverState(sp), page: 1 };
  const search = serializeDiscoverState(state).toString();
  return (
    <Page className="max-w-[40rem]">
      <PageHeader title="Save this search" caption={queryTitle(state)} />
      <PageSection>
        <div className="p-4">
          <SaveSearchForm search={search} defaultName={queryTitle(state)} />
        </div>
      </PageSection>
    </Page>
  );
}
