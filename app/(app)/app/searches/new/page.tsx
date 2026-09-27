import { PageHeader, PageSection } from "@/components/dashboard/page";
import { SaveSearchForm } from "@/components/dashboard/save-search-form";
import { AppShell } from "@/components/dashboard/app-shell";
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
  const shell = await loadBuyerShell(supabase, "/app/searches/new");
  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Save search">
      <PageHeader title="Save this search" caption={queryTitle(state)} />
      <PageSection className="max-w-2xl">
        <div className="p-4">
          <SaveSearchForm search={search} defaultName={queryTitle(state)} />
        </div>
      </PageSection>
    </AppShell>
  );
}
