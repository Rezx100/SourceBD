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
import { COUNT_READS_AT_ONCE, readSearchCount } from "@/lib/dashboard/search-cache";
import { mapLimited } from "@/lib/map-limited";
import { SEARCH_TEMPLATES } from "@/lib/dashboard/search-templates";
import { runSavedSearchesGet, type SavedSearchJson } from "@/lib/saved-searches";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** How long the landing waits for the common searches' counts before drawing the chips without them. */
export const COUNT_WAIT_MS = 1500;

export const metadata = {
  title: "Search · SourceBD",
};

export default async function SearchLandingPage() {
  const supabase = await createSupabaseServerClient();
  const today = new Date();

  // Read in the render, so a chip paints with its count and never behind a skeleton (the critique of
  // 7 Oct 2026, item 6). A count that succeeds is cached for an hour, so the usual read is at once;
  // each is a 2-2.5 s read uncached and the anon role stops at 3 s, so a few go at a time (production
  // log, 6 Oct 2026: 345 statement timeouts in a day), and one still late at the cap is drawn as a
  // chip with no count: its read finishes in the background and fills the cache for the next visit.
  const late = new Promise<Record<string, number | null>>((r) => setTimeout(() => r({}), COUNT_WAIT_MS));
  const counts = await Promise.race([
    mapLimited(SEARCH_TEMPLATES, COUNT_READS_AT_ONCE, async (t) => [t.key, await readSearchCount(t.state)] as const).then((pairs) => Object.fromEntries(pairs)),
    late,
  ]);
  const saved: Promise<SavedSearchJson[] | null> = (async () => {
    try {
      const listed = await runSavedSearchesGet({ role: await getServerRole(), supabase, now: today });
      if (listed.status !== 200 || !listed.body || typeof listed.body !== "object") return null;
      return (listed.body as { searches?: SavedSearchJson[] }).searches ?? [];
    } catch {
      return null;
    }
  })();

  const [published, attention] = await Promise.all([readPublishedCount(), loadNeedsAttention(supabase, today)]);
  return <SearchLanding published={published} attention={attention} counts={counts} saved={saved} />;
}
