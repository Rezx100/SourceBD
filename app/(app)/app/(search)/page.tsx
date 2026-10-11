// The buyer app's first viewport (/app): the search landing (founder, 28 Sep 2026 — "the
// first viewport should be the search window"; v4 keeps it: the topbar's field is the one
// search box and this page is the work queue under it). Needs attention, recent and saved
// searches, a filter to start from, the common searches with live counts; no supplier is
// listed until the buyer searches. The filter pane is the results page's (`?filters=1` there).
//
// In the `(search)` route group so its loading state (the landing's own silhouette) covers
// this page only, not every /app route under it.

import { SearchLanding } from "@/components/search/landing";
import { getServerRole } from "@/lib/auth";
import { loadNeedsAttention } from "@/lib/dashboard/needs-attention";
import { readPublishedCount } from "@/lib/dashboard/load-buyer-shell";
import { readTemplateCounts } from "@/lib/dashboard/search-cache";
import { SEARCH_TEMPLATES } from "@/lib/dashboard/search-templates";
import { runSavedSearchesGet, type SavedSearchJson } from "@/lib/saved-searches";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search · SourceBD",
};

export default async function SearchLandingPage() {
  const supabase = await createSupabaseServerClient();
  const today = new Date();

  const saved: Promise<SavedSearchJson[] | null> = (async () => {
    try {
      const listed = await runSavedSearchesGet({ role: await getServerRole(), supabase, now: today });
      if (listed.status !== 200 || !listed.body || typeof listed.body !== "object") return null;
      return (listed.body as { searches?: SavedSearchJson[] }).searches ?? [];
    } catch {
      return null;
    }
  })();

  // Read in the render, so a chip paints with its count and never behind a skeleton (the critique of
  // 7 Oct 2026, item 6), and beside the page's other reads rather than before them: the counts wait up to
  // COUNT_WAIT_MS, and the reads after them used to start only then (11 Oct 2026).
  const [counts, published, attention] = await Promise.all([readTemplateCounts(SEARCH_TEMPLATES), readPublishedCount(), loadNeedsAttention(supabase, today)]);
  return <SearchLanding published={published} attention={attention} counts={counts} saved={saved} />;
}
