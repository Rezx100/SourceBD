import "server-only";

// Shared, short-lived copies of what the search reads for EVERY buyer alike.
//
// `discover_suppliers` and `production_workers_display_batch` are granted to
// anon and carry no buyer's data (the shell's published count is read the
// same way, `load-buyer-shell.ts`). Two things on the search paid for them
// on every click:
//
// - Opening a record beside the results is a navigation to the same search
//   with `record=` added, and the page re-ran the whole search before it could
//   draw the pane (founder's walkthrough, 28 Sep 2026: "when I click Open it
//   takes ages"). The results are now read from here for two minutes, so the
//   record's own reads are the only ones an open waits on.
// - The search landing's templates each show how many suppliers they find.
//
// Both are purged with the public search's tag when a moderator publishes or
// changes a supplier. A failed read throws inside the cache, so a failure is
// never kept; the caller falls back to its own session's read.

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import { TAG_DISCOVER_SUPPLIERS } from "@/lib/cache/tags";
import { COUNT_ONLY_SORT, fetchDiscoverV32, parseTotalCount, type DiscoverV32Row } from "@/lib/discover-v32-rpc";
import { discoverRpcArgs, serializeDiscoverState, type DiscoverState } from "@/lib/discover-v32-state";

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("missing-env");
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

type SearchRead = Awaited<ReturnType<typeof fetchDiscoverV32>>;

/** The cache key of a search: its serialized state, which is what the URL carries. */
export function searchKey(state: DiscoverState): string {
  const sp = serializeDiscoverState(state);
  sp.sort();
  return sp.toString();
}

/**
 * The search's rows, count and worker figures, cached two minutes per
 * search. `own` is the caller's session read, used when the shared read is
 * unavailable, so the page never fails for want of the cache.
 */
export async function readSearch(state: DiscoverState, own: () => Promise<SearchRead>): Promise<SearchRead> {
  try {
    return await unstable_cache(
      async () => {
        const read = await fetchDiscoverV32(anonClient(), state);
        if (read.error) throw new Error(read.error);
        return read;
      },
      ["app-search-v1", searchKey(state)],
      { revalidate: 120, tags: [TAG_DISCOVER_SUPPLIERS] },
    )();
  } catch {
    return own();
  }
}

/**
 * The count behind the filter pane's "Show N suppliers": the same read the results make (the
 * keyword's smart query included, so the pane and the page never disagree), one row, the cheap
 * order, cached two minutes per search. Null when it could not be read.
 */
export async function readFilterCount(state: DiscoverState): Promise<number | null> {
  const counted = { ...state, sort: COUNT_ONLY_SORT, page: 1 };
  try {
    return await unstable_cache(
      async () => {
        const read = await fetchDiscoverV32(anonClient(), counted, { limit: 1, offset: 0 });
        if (read.error || read.total === null) throw new Error("count not read");
        return read.total;
      },
      ["app-filter-count-v1", searchKey(counted)],
      { revalidate: 120, tags: [TAG_DISCOVER_SUPPLIERS] },
    )();
  } catch {
    return null;
  }
}

/** How many published suppliers a search finds, cached an hour; null when it could not be read. */
export async function readSearchCount(state: DiscoverState): Promise<number | null> {
  try {
    return await unstable_cache(
      async () => {
        const res = await anonClient().rpc("discover_suppliers", discoverRpcArgs({ ...state, page: 1 }, { limit: 1, offset: 0 }));
        if (res.error || !Array.isArray(res.data)) throw new Error("count not read");
        const n = parseTotalCount(res.data as DiscoverV32Row[]);
        // No rows is a count of zero only when the read itself succeeded.
        if (n === null && res.data.length > 0) throw new Error("count not parsed");
        return n ?? 0;
      },
      ["app-search-count-v1", searchKey(state)],
      { revalidate: 3600, tags: [TAG_DISCOVER_SUPPLIERS] },
    )();
  } catch {
    return null;
  }
}
