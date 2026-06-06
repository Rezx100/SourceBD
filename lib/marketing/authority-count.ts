// Spec M6a — Counts of authority sources.
//
// Drives the homepage authority markstack ("31 official sources
// reconciled continuously") and the metrics footer pip
// ("31 / 31 sources in sync"). Reads `public.sources` directly;
// the count is small and stable. Cached for an hour.

import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export type SourceCounts = {
  total: number;
  tier1or2: number;
};

async function loadCounts(): Promise<SourceCounts> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { total: 0, tier1or2: 0 };
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const totalQ = await supabase
    .from("sources")
    .select("*", { count: "exact", head: true });
  const t12Q = await supabase
    .from("sources")
    .select("*", { count: "exact", head: true })
    .in("tier", ["tier1_gov", "tier2_industry"]);
  return {
    total: totalQ.count ?? 0,
    tier1or2: t12Q.count ?? 0,
  };
}

export const fetchAuthorityCounts = unstable_cache(
  loadCounts,
  ["mkt-authority-counts"],
  { revalidate: 3600 },
);
