// REZ-B — saved searches. Live counts from discover_suppliers, cached 10 min
// on the row.

import { Button } from "@/components/dashboard/controls";
import { EmptyState, ErrorNote, PageHeader, PageSection } from "@/components/dashboard/page";
import Link from "next/link";
import { AppShell } from "@/components/dashboard/app-shell";
import { Caption } from "@/components/dashboard/type";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";
import { formatCount } from "@/lib/dashboard/facts";
import { runSavedSearchesGet, savedCountLabel, type SavedSearchJson } from "@/lib/saved-searches";
import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Saved searches · SourceBD",
};

export default async function SearchesPage() {
  const supabase = await createSupabaseServerClient();
  const [role, shell] = await Promise.all([getServerRole(), loadBuyerShell(supabase, "/app/searches")]);
  const now = new Date();
  const listed = await runSavedSearchesGet({ role, supabase, now });
  const payload =
    listed.status === 200 && listed.body && typeof listed.body === "object"
      ? (listed.body as { searches?: SavedSearchJson[]; capped?: boolean })
      : {};
  const searches = payload.searches ?? [];

  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Saved searches">
      <PageHeader
        title="Saved searches"
        caption={
          listed.status !== 200
            ? "Saved searches could not be read"
            : searches.length === 0
              ? undefined
              : payload.capped
                ? `The ${formatCount(searches.length)} most recent of your saved searches`
                : `${formatCount(searches.length)} saved`
        }
        actions={
          <Button variant="primary" href="/app/discover" clientNav>
            New search
          </Button>
        }
      />
      {listed.status !== 200 ? (
        <ErrorNote>Your saved searches could not be read just now. Nothing has been lost; try again in a moment.</ErrorNote>
      ) : (
        <PageSection>
          {searches.length === 0 ? (
            <EmptyState icon="funnel" title="No saved searches yet">
              Run a search, then use Save search above the results. It comes back here with its count.
            </EmptyState>
          ) : (
            <ul className="m-0 list-none p-0">
              {searches.map((s) => (
                <li key={s.id} className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line-subtle px-4 py-2.5 last:border-b-0">
                  <Link prefetch={false} href={s.href} className="min-w-0 font-medium text-ink-strong [overflow-wrap:anywhere] hover:text-brand-ink">
                    {s.name}
                  </Link>
                  {/* Bare, the count read as live. Only ten stale counts refresh
                      per call, so most of these are remembered numbers and the
                      page has to say when each was taken. */}
                  <Caption>{savedCountLabel(s.last_count, s.last_counted_at, now)}</Caption>
                </li>
              ))}
            </ul>
          )}
        </PageSection>
      )}
    </AppShell>
  );
}
