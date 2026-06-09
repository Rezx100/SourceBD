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
// notes on `app/(marketing)/suppliers/[slug]/page.tsx`).

import Link from "next/link";

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
import { MobileFilterSheet } from "@/components/discover/mobile-filter-sheet";
import { DiscoverSearchHero } from "@/components/discover/search-hero";
import {
  DiscoverResultCard,
} from "@/components/discover/result-card";
import { fetchDiscoverFacets } from "@/lib/discover-facets";
import { fetchPublicDiscoverSuppliers } from "@/lib/discover-suppliers";

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
  const rscMin = asInt(sp.rsc_min);
  const completenessMin = asInt(sp.completeness_min);
  const workersMin = asInt(sp.workers_min);
  const city = asString(sp.city).trim();
  const district = asString(sp.district).trim();
  const category = asString(sp.category).trim();
  const sort = clampSort(asString(sp.sort));
  const pageNum = Math.max(1, asInt(sp.page) ?? 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const [{ rows, error }, facets] = await Promise.all([
    fetchPublicDiscoverSuppliers({
      p_q: q || null,
      p_entity_types: entityTypes.length ? entityTypes : null,
      p_min_sources: minSources,
      p_cert_kinds: certKinds.length ? certKinds : null,
      p_rsc_min:
        rscMin !== null && rscMin >= 0 && rscMin <= 100 ? rscMin : null,
      p_city: city || null,
      p_district: district || null,
      p_category: category || null,
      p_sort: sort,
      p_limit: PAGE_SIZE,
      p_offset: offset,
      p_registries: registries.length ? registries : null,
      p_factory_types: factoryTypes.length ? factoryTypes : null,
      p_brand_codes: brandCodes.length ? brandCodes : null,
      p_completeness_min:
        completenessMin !== null &&
        completenessMin >= 0 &&
        completenessMin <= 100
          ? completenessMin
          : null,
      p_workers_min:
        workersMin !== null && workersMin >= 0 ? workersMin : null,
    }),
    fetchDiscoverFacets(),
  ]);

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
    rsc_min: rscMin !== null ? String(rscMin) : "",
    completeness_min: completenessMin !== null ? String(completenessMin) : "",
    workers_min: workersMin !== null ? String(workersMin) : "",
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
    rscMin !== null ||
    completenessMin !== null ||
    workersMin !== null ||
    Boolean(city) ||
    Boolean(district) ||
    Boolean(category);

  // R3 — count of active filter dimensions for the mobile sheet trigger.
  const activeFilterCount =
    (q ? 1 : 0) +
    (entityTypes.length > 0 ? 1 : 0) +
    (certKinds.length > 0 ? 1 : 0) +
    (registries.length > 0 ? 1 : 0) +
    (brandCodes.length > 0 ? 1 : 0) +
    (factoryTypes.length > 0 ? 1 : 0) +
    (minSources !== null ? 1 : 0) +
    (rscMin !== null ? 1 : 0) +
    (completenessMin !== null ? 1 : 0) +
    (workersMin !== null ? 1 : 0) +
    (city ? 1 : 0) +
    (district ? 1 : 0) +
    (category ? 1 : 0);

  const filterRailDesktop = (
    <FilterRail
      basePath={BASE_PATH}
      q={q}
      entityTypes={entityTypes}
      certKinds={certKinds}
      registries={registries}
      brandCodes={brandCodes}
      factoryTypes={factoryTypes}
      minSources={minSourcesRaw}
      rscMin={rscMin}
      completenessMin={completenessMin}
      workersMin={workersMin}
      city={city}
      district={district}
      category={category}
      sort={sort}
      facets={facets}
      baseQuery={baseQuery}
      hideSearchRow
      instanceId="desktop"
    />
  );
  const filterRailMobile = (
    <FilterRail
      basePath={BASE_PATH}
      q={q}
      entityTypes={entityTypes}
      certKinds={certKinds}
      registries={registries}
      brandCodes={brandCodes}
      factoryTypes={factoryTypes}
      minSources={minSourcesRaw}
      rscMin={rscMin}
      completenessMin={completenessMin}
      workersMin={workersMin}
      city={city}
      district={district}
      category={category}
      sort={sort}
      facets={facets}
      baseQuery={baseQuery}
      hideSearchRow
      instanceId="mobile"
    />
  );

  return (
    <>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <header>
          <p className="text-[11px] font-semibold text-ink-tertiary">
            Public preview
          </p>
          <h1 className="mt-1 font-display text-4xl font-light tracking-tight text-ink-primary">
            Discover
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Verified Bangladesh garment factories and buying houses. Results
            ranked by source-backed evidence.
          </p>
        </header>

        <div className="space-y-6">
          {/* R9r4 — primary search bar, always visible above the rail. */}
          <DiscoverSearchHero basePath={BASE_PATH} q={q} sort={sort} />

          {/* R9r4 — desktop: inline filter rail (hero owns search). */}
          <div className="hidden md:block">{filterRailDesktop}</div>
          {/* R9r4 — mobile: opt-in filter sheet behind a Filters trigger. */}
          <div className="md:hidden">
            <MobileFilterSheet
              activeFilterCount={activeFilterCount}
              resultCount={Number(totalCount)}
            >
              {filterRailMobile}
            </MobileFilterSheet>
          </div>

          <section className="space-y-4">
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
              <div className="proto-card space-y-3 text-center">
                <p className="text-sm text-ink-secondary">
                  {anyFilterActive
                    ? "No suppliers match these filters. Try removing the most restrictive one."
                    : "No published suppliers yet."}
                </p>
                {anyFilterActive ? (
                  <Link href={BASE_PATH} className="btn-proto inline-flex">
                    Clear all filters
                  </Link>
                ) : null}
              </div>
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
        </div>
      </main>
    </>
  );
}
