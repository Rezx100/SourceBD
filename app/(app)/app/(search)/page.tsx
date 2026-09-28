// The buyer app's first viewport (/app): the search landing (founder, 28 Sep
// 2026 — "the first viewport should be the search window"). One large field,
// one-click filters, the common searches with live counts and the buyer's
// saved searches; no supplier is listed until the buyer searches. The desk
// that used to be Home — certificate alerts, recent activity, saved
// suppliers — is on Saved (`/app/saved`).
//
//   ?filters=1   the full filter pane beside the landing; Apply runs the search.
//
// In the `(search)` route group so its loading state (the landing's own
// silhouette) covers this page only, not every /app route under it.

import { DiscoverFilters } from "@/components/dashboard/discover-filters";
import { SearchLanding } from "@/components/dashboard/search-landing";
import { RecordPane } from "@/components/dashboard/sheet";
import { getServerRole } from "@/lib/auth";
import { readPublishedCount } from "@/lib/dashboard/load-buyer-shell";
import { readSearchCount } from "@/lib/dashboard/search-cache";
import { SEARCH_TEMPLATES } from "@/lib/dashboard/search-templates";
import { EMPTY_STATE } from "@/lib/discover-v32-state";
import { runSavedSearchesGet, type SavedSearchJson } from "@/lib/saved-searches";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search · SourceBD",
};

const LANDING_PATH = "/app";

export default async function SearchLandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filtersOpen = (Array.isArray(sp.filters) ? sp.filters[0] : sp.filters) === "1";
  const supabase = await createSupabaseServerClient();

  // Streamed: the field is usable before any count arrives.
  const counts: Promise<Record<string, number | null>> = Promise.all(
    SEARCH_TEMPLATES.map(async (t) => [t.key, await readSearchCount(t.state)] as const),
  ).then((pairs) => Object.fromEntries(pairs));
  const saved: Promise<SavedSearchJson[] | null> = (async () => {
    try {
      const listed = await runSavedSearchesGet({ role: await getServerRole(), supabase, now: new Date() });
      if (listed.status !== 200 || !listed.body || typeof listed.body !== "object") return null;
      return (listed.body as { searches?: SavedSearchJson[] }).searches ?? [];
    } catch {
      return null;
    }
  })();

  const landing = (
    <SearchLanding published={await readPublishedCount()} counts={counts} saved={saved} filtersHref={`${LANDING_PATH}?filters=1`} />
  );
  if (!filtersOpen) return landing;
  return (
    // The filter pane sits beside the landing as it sits beside the results;
    // Apply submits the search, Close comes back here.
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="hidden min-h-0 min-w-0 flex-1 overflow-y-auto lg:block">{landing}</div>
      <RecordPane closeHref={LANDING_PATH} openKey="filters">
        <DiscoverFilters state={EMPTY_STATE} closeHref={LANDING_PATH} />
      </RecordPane>
    </div>
  );
}
