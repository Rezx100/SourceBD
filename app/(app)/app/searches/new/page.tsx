import { SaveSearchForm } from "@/components/dashboard/save-search-form";
import { AppShell } from "@/components/dashboard/app-shell";
import { Caption, Title } from "@/components/dashboard/type";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";
import { parseDiscoverState, queryTitle, serializeDiscoverState } from "@/lib/discover-v32-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const supabase = await createSupabaseServerClient();
  const shell = await loadBuyerShell(supabase, "search");
  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Save search">
      <Title as="h1">Save this search</Title>
      <Caption className="mb-4">{queryTitle(state)}</Caption>
      <SaveSearchForm search={search} defaultName={queryTitle(state)} />
    </AppShell>
  );
}
