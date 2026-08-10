// Anon-cached wrapper for the `public.discover_suppliers` RPC.
//
// Used by the public marketing surfaces (`/discover`) where every visitor
// sees the same result for a given query string. Wrapped in
// `unstable_cache` keyed on the normalised RPC args + tagged with
// `TAG_DISCOVER_SUPPLIERS` so admin mutations (edit / rescore / import /
// sanctions decide / cert decide) can purge the cache via `revalidateTag`.
//
// Buyer surfaces (`/app/discover`) intentionally do NOT use this helper —
// the saved-set overlay is per-user and a shared cache would leak it.
// Buyer pages keep `force-dynamic`.
//
// RPC is SECURITY DEFINER and granted to anon, so the anon client below
// is sufficient.

import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

import type { DiscoverRow } from "@/components/discover/result-card";
import { TAG_DISCOVER_SUPPLIERS } from "@/lib/cache/tags";
import { enrichDiscoverWorkers } from "@/lib/enrich-discover-workers";

export type DiscoverArgs = {
  p_q: string | null;
  p_entity_types: string[] | null;
  p_min_sources: number | null;
  p_cert_kinds: string[] | null;
  p_rsc_min: number | null;
  p_city: string | null;
  p_district: string | null;
  p_category: string | null;
  p_sort: string;
  p_limit: number;
  p_offset: number;
  p_registries: string[] | null;
  p_factory_types: string[] | null;
  p_brand_codes: string[] | null;
  p_completeness_min: number | null;
  p_workers_min: number | null;
};

export type DiscoverResult = {
  rows: DiscoverRow[];
  error: string | null;
};

async function loadDiscover(args: DiscoverArgs): Promise<DiscoverResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { rows: [], error: "missing-env" };
  }
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("discover_suppliers", args);
  if (error) return { rows: [], error: error.message };
  const rows = await enrichDiscoverWorkers(
    supabase,
    (data ?? []) as DiscoverRow[],
  );
  return { rows, error: null };
}

export async function fetchPublicDiscoverSuppliers(
  args: DiscoverArgs,
): Promise<DiscoverResult> {
  const key = JSON.stringify(args);
  const cached = unstable_cache(
    () => loadDiscover(args),
    ["discover-suppliers", key],
    {
      revalidate: 60,
      tags: [TAG_DISCOVER_SUPPLIERS],
    },
  );
  return cached();
}
