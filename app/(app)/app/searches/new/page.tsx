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
  const state = parseDiscoverState(sp);
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
