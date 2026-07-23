// Live result counts for marketing sections, via the same anon-cached
// `discover_suppliers` RPC the public /discover page uses.
//
// Precision rule: when a section shows a count next to a /discover deep
// link, the count MUST be computed with exactly the args that URL will
// produce, so the number a visitor clicks is the number they land on.
// Returns null on any error — callers hide the row instead of guessing.

import {
  fetchPublicDiscoverSuppliers,
  type DiscoverArgs,
} from "@/lib/discover-suppliers";

const BASE_ARGS: DiscoverArgs = {
  p_q: null,
  p_entity_types: null,
  p_min_sources: null,
  p_cert_kinds: null,
  p_rsc_min: null,
  p_city: null,
  p_district: null,
  p_category: null,
  p_sort: "receipts",
  p_limit: 1,
  p_offset: 0,
  p_registries: null,
  p_factory_types: null,
  p_brand_codes: null,
  p_completeness_min: null,
  p_workers_min: null,
};

export async function fetchDiscoverTotal(
  overrides: Partial<DiscoverArgs>,
): Promise<number | null> {
  try {
    const { rows, error } = await fetchPublicDiscoverSuppliers({
      ...BASE_ARGS,
      ...overrides,
    });
    if (error) return null;
    if (rows.length === 0) return 0;
    const total = Number(rows[0]?.total_count ?? 0);
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}
