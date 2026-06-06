// Server helper for the Discover filter-rail facet lists.
//
// Calls the `public.discover_facets()` RPC (migration 0053). The RPC is
// SECURITY DEFINER + STABLE and granted to anon, so this works on both
// the buyer and the public surfaces with no auth context — the result
// is identical for every caller, which means we can safely wrap it in
// `unstable_cache` with the `discover-facets` tag (revalidated when an
// admin approves/edits a supplier).

import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

import { TAG_DISCOVER_FACETS } from "@/lib/cache/tags";
import {
  EMPTY_FACETS,
  type DiscoverFacets,
} from "@/components/discover/filter-rail";

type RawFacets = Partial<{
  cities: unknown;
  districts: unknown;
  products: unknown;
  factory_types: unknown;
}>;

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

async function loadFacets(): Promise<DiscoverFacets> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return EMPTY_FACETS;
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("discover_facets");
  if (error || !data) return EMPTY_FACETS;
  const raw = data as RawFacets;
  return {
    cities: asStringArray(raw.cities),
    districts: asStringArray(raw.districts),
    products: asStringArray(raw.products),
    factory_types: asStringArray(raw.factory_types),
  };
}

export const fetchDiscoverFacets = unstable_cache(loadFacets, ["discover-facets"], {
  revalidate: 600,
  tags: [TAG_DISCOVER_FACETS],
});
