// Public Discover — anonymous, demo-mode (Spec M5).
//
// Calls the anon-granted `public.discover_suppliers` RPC (migration
// 0023) — same RPC the buyer surface uses. Result cards link to
// `/suppliers/{slug}` (public profile, not the auth-gated one). The
// shared filter rail / sort / pagination markup lives in
// `components/discover/filter-rail`.
//
// No SaveButton, no saved-set lookup (anon visitors have no auth).
// Contacts are not part of the RPC payload at all (see the doctrine
// notes on `app/(public)/suppliers/[slug]/page.tsx`).

import Link from "next/link";

import { EmptyState } from "@/components/ui/page-kit";
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
import {
  DiscoverResultCard,
} from "@/components/discover/result-card";
import { DiscoverSearchHero } from "@/components/discover/search-hero";
import { MobileFilterSheet } from "@/components/discover/mobile-filter-sheet";
import { fetchDiscoverFacets } from "@/lib/discover-facets";
import { fetchPublicDiscoverSuppliers } from "@/lib/discover-suppliers";
import { resolveDiscoverSmartQuery } from "@/lib/discover-smart-query";

export const revalidate = 300;

const BASE_PATH = "/discover";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PublicDiscoverPage({
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
  const hasSearchQuery = q.length > 0;
  const sort = clampSort(asString(sp.sort));
  const pageNum = Math.max(1, asInt(sp.page) ?? 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const facets = await fetchDiscoverFacets();
  let rows: Awaited<ReturnType<typeof fetchPublicDiscoverSuppliers>>["rows"] = [];
  let error: unknown = null;
  let totalCount = 0;
  let totalPages = 1;

  if (hasSearchQuery) {
    const result = await fetchPublicDiscoverSuppliers({
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
    rows = result.rows;
    error = result.error;
    totalCount = rows[0]?.total_count ?? 0;
    totalPages = Math.max(1, Math.ceil(Number(totalCount) / PAGE_SIZE));
  }

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
    <>
      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <DiscoverSearchHero
          basePath={BASE_PATH}
          profileBase="/suppliers"
          q={q}
          sort={sort}
          centered={!hasSearchQuery}
          subcopy="Search by certification, product, or district - every result is on the record."
        />

        {hasSearchQuery ? (
          <>
            <div className="space-y-4">
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
                    hideSearchRow
                    instanceId="mobile"
                  />
                </MobileFilterSheet>
              </div>

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
                  hideSearchRow
                  instanceId="desktop"
                />
              </div>
            </div>

            <section id="discover-results" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-secondary">
                  {error ? (
                    <span className="text-sem-red">
                      Could not load suppliers.
                    </span>
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
                  title={anyFilterActive ? "No results for these filters" : "No published suppliers yet"}
                  description={anyFilterActive ? "Try removing the most restrictive filter to broaden your search." : undefined}
                  action={
                    anyFilterActive ? (
                      <Link href={BASE_PATH} className="btn-proto primary">
                        Clear filters
                      </Link>
                    ) : null
                  }
                />
              ) : (
                <ul className="grid grid-cols-1 gap-4">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <DiscoverResultCard row={row} hrefBase="/suppliers" />
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
          </>
        ) : null}
      </main>
    </>
  );
}
