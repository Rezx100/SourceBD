// Spec B1 — buyer Discover (authenticated, /app/discover).
//
// Distinct from the public anonymous `(marketing)/discover` route — that
// one calls the same RPC but renders without SaveButton and adds the
// demo-mode banner (Spec M5). The filter rail / sort / pagination
// markup is shared via `components/discover/filter-rail`.
//
// SBI hard contract: the RPC orders by `sbi_scores.total DESC NULLS LAST`
// inside its body under `security definer`, but the RETURNS TABLE never
// includes the SBI value. The trust glyph centre is the count of distinct
// Tier 1–3 verified sources (`t13_source_count`).

import Link from "next/link";

import { SaveButton } from "@/components/save-button";
import {
  BRAND_SOURCES,
  CERT_KINDS,
  ENTITY_TYPES,
  FilterRail,
  PAGE_SIZE,
  Pagination,
  REGISTRY_SOURCES,
  SortControl,
  asInt,
  asString,
  asStringArray,
  clampSort,
} from "@/components/discover/filter-rail";
import { DiscoverResultCard, type DiscoverRow } from "@/components/discover/result-card";
import { DiscoverSearchHero } from "@/components/discover/search-hero";
import { MobileFilterSheet } from "@/components/discover/mobile-filter-sheet";
import { EmptyState, PageHeader } from "@/components/ui/page-kit";
import { fetchDiscoverFacets } from "@/lib/discover-facets";
import { resolveDiscoverSmartQuery } from "@/lib/discover-smart-query";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BASE_PATH = "/app/discover";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function BuyerDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = asString(sp.q).trim();
  const entityTypes = asStringArray(sp.entity).filter((v) =>
    ENTITY_TYPES.some((o) => o.value === v),
  );
  const certKinds = asStringArray(sp.cert).filter((v) =>
    CERT_KINDS.some((o) => o.value === v),
  );
  const registries = asStringArray(sp.registry).filter((v) =>
    REGISTRY_SOURCES.some((o) => o.value === v),
  );
  const brandCodes = asStringArray(sp.brand).filter((v) =>
    BRAND_SOURCES.some((o) => o.value === v),
  );
  const factoryTypes = asStringArray(sp.ftype);
  const minSourcesRaw = asString(sp.min_sources);
  const minSources =
    minSourcesRaw && /^[1-5]$/.test(minSourcesRaw)
      ? Number.parseInt(minSourcesRaw, 10)
      : null;
  const city = asString(sp.city).trim();
  const district = asString(sp.district).trim();
  const category = asString(sp.category).trim();
  const smartQuery = resolveDiscoverSmartQuery(q, category);
  const sort = clampSort(asString(sp.sort));
  const pageNum = Math.max(1, asInt(sp.page) ?? 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  const rpcPromise = supabase.rpc("discover_suppliers", {
    p_q: smartQuery.rpcQ || null,
    p_entity_types: entityTypes.length ? entityTypes : null,
    p_min_sources: minSources,
    p_cert_kinds: certKinds.length ? certKinds : null,
    p_rsc_min: null,
    p_city: city || null,
    p_district: district || null,
    p_category: category || smartQuery.inferredCategory || null,
    p_sort: sort,
    p_limit: PAGE_SIZE,
    p_offset: offset,
    p_registries: registries.length ? registries : null,
    p_factory_types: factoryTypes.length ? factoryTypes : null,
    p_brand_codes: brandCodes.length ? brandCodes : null,
    p_completeness_min: null,
    p_workers_min: null,
  });

  // Chain the saved-set lookup onto the RPC promise so it runs in parallel
  // with `fetchDiscoverFacets` (which is anon-cached and usually a hit).
  const savedPromise = rpcPromise.then(async ({ data }) => {
    const rows = (data ?? []) as DiscoverRow[];
    if (rows.length === 0) return new Set<string>();
    const { data: savedRows } = await supabase
      .from("saved_suppliers")
      .select("supplier_id")
      .in(
        "supplier_id",
        rows.map((r) => r.id),
      );
    const set = new Set<string>();
    if (savedRows) {
      for (const r of savedRows as { supplier_id: string }[]) {
        set.add(r.supplier_id);
      }
    }
    return set;
  });

  const [{ data, error }, facets, savedSet] = await Promise.all([
    rpcPromise,
    fetchDiscoverFacets(),
    savedPromise,
  ]);

  const rows = (data ?? []) as DiscoverRow[];
  const totalCount = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(Number(totalCount) / PAGE_SIZE));
  const baseQuery = {
    q,
    entity: entityTypes,
    cert: certKinds,
    registry: registries,
    brand: brandCodes,
    ftype: factoryTypes,
    min_sources:
      minSourcesRaw && /^[1-5]$/.test(minSourcesRaw) ? minSourcesRaw : "",
    city,
    district,
    category,
    sort: sort === "default" ? "" : sort,
  };

  const anyFilterActive =
    Boolean(q) ||
    entityTypes.length > 0 ||
    certKinds.length > 0 ||
    registries.length > 0 ||
    brandCodes.length > 0 ||
    factoryTypes.length > 0 ||
    minSources !== null ||
    Boolean(city) ||
    Boolean(district) ||
    Boolean(category);

  // R9r4 — surfaced to the mobile filter trigger so the buyer can see
  // at a glance how many filters they have stacked without opening the
  // sheet. Counts every non-empty filter param including `q`.
  const activeFilterCount =
    (q ? 1 : 0) +
    entityTypes.length +
    certKinds.length +
    registries.length +
    brandCodes.length +
    factoryTypes.length +
    (minSources !== null ? 1 : 0) +
    (city ? 1 : 0) +
    (district ? 1 : 0) +
    (category ? 1 : 0);
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        kicker="Buyer"
        title="Discover"
        description="Verified Bangladesh garment factories and buying houses, ranked by source-backed evidence."
      />

      <div className="space-y-6">
        {/* R9r4 — primary search bar, always visible. */}
        <DiscoverSearchHero basePath={BASE_PATH} q={q} sort={sort} />

        {/* R9r4 — mobile: hide the inline rail behind a Filters trigger
            that opens a bottom sheet. The hero above already covers the
            search-by-name case, so the sheet is opt-in for power filters. */}
        <div className="md:hidden">
          <MobileFilterSheet
            activeFilterCount={activeFilterCount}
            resultCount={Number(totalCount)}
          >
            <FilterRail
              basePath={BASE_PATH}
              q={q}
              entityTypes={entityTypes}
              certKinds={certKinds}
              registries={registries}
              brandCodes={brandCodes}
              factoryTypes={factoryTypes}
              minSources={minSourcesRaw}
              city={city}
              district={district}
              category={category}
              sort={sort}
              facets={facets}
              baseQuery={baseQuery}
              hideSearchRow
              instanceId="mobile"
            />
          </MobileFilterSheet>
        </div>

        {/* Desktop: inline rail below the hero (no duplicate search row). */}
        <div className="hidden md:block">
          <FilterRail
            basePath={BASE_PATH}
            q={q}
            entityTypes={entityTypes}
            certKinds={certKinds}
            registries={registries}
            brandCodes={brandCodes}
            factoryTypes={factoryTypes}
            minSources={minSourcesRaw}
            city={city}
            district={district}
            category={category}
            sort={sort}
            facets={facets}
            baseQuery={baseQuery}
            hideSearchRow
            instanceId="desktop"
          />
        </div>

        <section id="discover-results" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-secondary">
              {error ? (
                <span className="text-sem-red">Could not load suppliers.</span>
              ) : (
                <>
                  <span className="font-semibold text-ink-primary">
                    {Number(totalCount).toLocaleString()}
                  </span>{" "}
                  result{Number(totalCount) === 1 ? "" : "s"}
                </>
              )}
            </p>
            <SortControl
              basePath={BASE_PATH}
              current={sort}
              baseQuery={baseQuery}
            />
          </div>

          {!error && rows.length === 0 ? (
            <EmptyState
              title={anyFilterActive ? "No matches" : "No published suppliers yet"}
              description={
                anyFilterActive
                  ? "No suppliers match these filters. Try removing the most restrictive one."
                  : "Published suppliers will appear here as the index fills."
              }
              action={
                anyFilterActive ? (
                  <Link
                    href={BASE_PATH}
                    className="inline-flex items-center rounded-pill bg-brand-forest px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-forest-mid"
                  >
                    Clear all filters
                  </Link>
                ) : null
              }
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4">
              {rows.map((row) => (
                <li key={row.id}>
                  <DiscoverResultCard
                    row={row}
                    hrefBase="/app/suppliers"
                    actionSlot={
                      <SaveButton
                        supplierId={row.id}
                        initialSaved={savedSet.has(row.id)}
                        shape="icon"
                      />
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 ? (
            <Pagination
              basePath={BASE_PATH}
              page={pageNum}
              totalPages={totalPages}
              baseQuery={baseQuery}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}
