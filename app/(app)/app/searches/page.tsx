// REZ-B — saved searches (/app/searches). Live counts from
// discover_suppliers, cached 10 min on the row; the table says when each
// count was taken, because most are remembered rather than live.

import { ErrorNote, Page, PageHeader } from "@/components/dashboard/page";
import { SavedSearchesTable } from "@/components/dashboard/saved-list";
import { formatCount } from "@/lib/dashboard/facts";
import { runSavedSearchesGet, type SavedSearchJson } from "@/lib/saved-searches";
import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Saved searches · SourceBD",
};

export default async function SearchesPage() {
  const supabase = await createSupabaseServerClient();
  const role = await getServerRole();
  const now = new Date();
  const listed = await runSavedSearchesGet({ role, supabase, now });
  const payload =
    listed.status === 200 && listed.body && typeof listed.body === "object"
      ? (listed.body as { searches?: SavedSearchJson[]; capped?: boolean })
      : {};
  const searches = payload.searches ?? [];
  const failed = listed.status !== 200;

  return (
    <Page>
      <PageHeader
        title="Saved searches"
        caption={
          failed
            ? "Only you can see this list."
            : searches.length === 0
              ? "None saved yet · only you can see this list"
              : payload.capped
                ? `The ${formatCount(searches.length)} most recent of your saved searches`
                : `${formatCount(searches.length)} saved`
        }
      />
      {failed ? (
        <ErrorNote>Saved searches could not be read. Nothing was removed; reload the page to try again.</ErrorNote>
      ) : (
        <SavedSearchesTable searches={searches} now={now} />
      )}
    </Page>
  );
}
