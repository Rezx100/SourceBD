// Spec M6a — Count of Tier-1 + Tier-2 authority sources.
//
// Drives the "authorities" copy line under the markstack on the
// homepage ("Indexes N primary registers across government and
// trade associations."). Reads `public.sources` directly; the count
// is small and stable. Cached for an hour.

import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

async function loadAuthorityCount(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return 0;
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { count, error } = await supabase
    .from("sources")
    .select("*", { count: "exact", head: true })
    .in("tier", ["tier1_gov", "tier2_industry"]);
  if (error) return 0;
  return count ?? 0;
}

export const fetchAuthorityCount = unstable_cache(
  loadAuthorityCount,
  ["mkt-authority-count"],
  { revalidate: 3600 },
);
