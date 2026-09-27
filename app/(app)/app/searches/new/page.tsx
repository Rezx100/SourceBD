import { Page } from "@/components/dashboard/page";
import { SaveSearchForm } from "@/components/dashboard/save-search-form";
import { Caption, Title } from "@/components/dashboard/type";
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
    <Page>
      <Title as="h1">Save this search</Title>
      <Caption className="mb-4">{queryTitle(state)}</Caption>
      <SaveSearchForm search={search} defaultName={queryTitle(state)} />
    </Page>
  );
}
