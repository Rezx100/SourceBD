// Server helper for the Discover filter-rail facet lists.
//
// Calls the `public.discover_facets()` RPC (migration 0053) and returns
// a typed `DiscoverFacets`. The RPC is SECURITY DEFINER + STABLE and
// granted to anon, so this works on both the buyer and the public
// surfaces with no auth context.
//
// If the RPC errors (e.g. migration not yet applied), returns empty
// arrays so the Discover page still renders — the datalists just won't
// suggest anything.

import type { SupabaseClient } from "@supabase/supabase-js";

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

export async function fetchDiscoverFacets(
  supabase: SupabaseClient,
): Promise<DiscoverFacets> {
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
