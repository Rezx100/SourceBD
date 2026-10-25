// Public Discover — anonymous, demo-mode (Spec M5), drawn from the v4 kit (B9h).
//
// Calls the anon-granted `public.discover_suppliers` RPC (migration
// 0023) — same RPC the buyer surface uses. Result rows link to
// `/suppliers/{slug}` (public profile, not the auth-gated one). The filter
// form, the rows and the pages are `components/discover/public`; the search
// box is the `components/discover/search-box` island.
//
// No SaveButton, no saved-set lookup (anon visitors have no auth).
// Contacts are not part of the RPC payload at all (see the doctrine
// notes on `app/(public)/suppliers/[slug]/page.tsx`).

import {
  BRAND_SOURCES,
  CERT_KINDS,
  ENTITY_TYPES,
  PAGE_SIZE,
  REGISTRY_SOURCES,
  asInt,
  asString,
  asStringArray,
  clampSort,
} from "@/components/discover/filter-rail";
import { Suspense } from "react";
import { FacetLists, PublicResults, ResponsiveFilters, filterCount } from "@/components/discover/public";
import { DiscoverSearchBox } from "@/components/discover/search-box";
import { HomeMain } from "@/components/site/home-main";
import { Chips, chipsOf, loadChips } from "@/components/site/sections/chips";
import { PageHead } from "@/components/site/sections/inner";
import { column } from "@/components/site/sections/ui";
import { SEARCH_TEMPLATES } from "@/lib/dashboard/search-templates";
import { trustMetadata } from "@/components/site/trust";
import { fetchDiscoverFacets } from "@/lib/discover-facets";
import { fetchPublicDiscoverSuppliers } from "@/lib/discover-suppliers";
import { resolveDiscoverSmartQuery } from "@/lib/discover-smart-query";
import { LIST_MAX, LIST_VALUE_MAX, Q_MAX } from "@/lib/discover-v32-state";
import { cn } from "@/lib/utils";

export const revalidate = 300;

const BASE_PATH = "/discover";

/** The nine common searches with their counts, from the cached read the home's chips and the app's search share: no new read per visit. Streamed, so the page never waits on it. */
async function CommonSearches() {
  return <Chips chips={await loadChips(SEARCH_TEMPLATES)} labelledBy="discover-common" />;
}

type SearchParams = Record<string, string | string[] | undefined>;

export const metadata = trustMetadata("/discover", "Discover suppliers — SourceBD", "Search published Bangladesh garment suppliers by product, place or certificate. Every fact names its source and the day it was read.");

export default async function PublicDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  // Kept under 0104's refusal (discover_v32_assert_bounded), as the buyer
  // page does: the search would otherwise fail rather than run.
  const q = asString(sp.q).trim().slice(0, Q_MAX).trim();
  // Deduped and capped too: 0104 refuses a list over 50 values or 80 characters.
  const bounded = (values: string[]) => [...new Set(values)].filter((v) => v.length <= LIST_VALUE_MAX).slice(0, LIST_MAX);
  const entityTypes = bounded(asStringArray(sp.entity).filter((v) =>
    ENTITY_TYPES.some((o) => o.value === v),
  ));
  const certKinds = bounded(asStringArray(sp.cert).filter((v) =>
    CERT_KINDS.some((o) => o.value === v),
  ));
  const registries = bounded(asStringArray(sp.registry).filter((v) =>
    REGISTRY_SOURCES.some((o) => o.value === v),
  ));
  const brandCodes = bounded(asStringArray(sp.brand).filter((v) =>
    BRAND_SOURCES.some((o) => o.value === v),
  ));
  const factoryTypes = bounded(asStringArray(sp.ftype));
  const minSourcesRaw = asString(sp.min_sources);
  const minSources =
    minSourcesRaw && /^[1-5]$/.test(minSourcesRaw)
      ? Number.parseInt(minSourcesRaw, 10)
      : null;
  const city = asString(sp.city).trim().slice(0, LIST_VALUE_MAX);
  const district = asString(sp.district).trim().slice(0, LIST_VALUE_MAX);
  const category = asString(sp.category).trim().slice(0, LIST_VALUE_MAX);
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

  const filters = {
    q,
    sort,
    entityTypes,
    certKinds,
    registries,
    brandCodes,
    factoryTypes,
    minSources: minSourcesRaw,
    city,
    district,
    category,
    facets,
  };

  return (
    <HomeMain className="font-sans antialiased">
      {/* The site's head in home's type (25 Oct 2026), on the day ground: the search is the page's one way in. */}
      <PageHead tone="day" label="Discover" title="Find a verified factory." lede="Search by certification, product, or district. Every result is on the record.">
        <div className="flex w-full max-w-[560px] flex-col items-center gap-2 text-left">
          <DiscoverSearchBox basePath={BASE_PATH} profileBase="/suppliers" q={q} sort={sort} />
          <p className="font-book text-site-item text-ink-2">Try “knit dresses Gazipur” or “GOTS”</p>
        </div>
      </PageHead>

      {/* Before anything is typed, the page is the common searches, not an empty field over the footer (critique 22 Oct). */}
      {hasSearchQuery ? (
        <section data-mk-tone="day" aria-label="Results" className="pb-24 max-md:pb-14">
          <div className={cn(column, "flex flex-col gap-6")}>
            <ResponsiveFilters basePath={BASE_PATH} {...filters} />
            <FacetLists facets={facets} />
            <PublicResults
              basePath={BASE_PATH}
              q={q}
              rows={rows}
              total={Number(totalCount)}
              page={pageNum}
              pages={totalPages}
              failed={Boolean(error)}
              filtersOn={filterCount(filters) > 0}
              sort={sort}
              baseQuery={baseQuery}
            />
          </div>
        </section>
      ) : (
        <section data-mk-tone="day" aria-labelledby="discover-common" className="pb-24 max-md:pb-14">
          <div className={cn(column, "flex flex-col items-center gap-5")}>
            <h2 id="discover-common" className="font-display text-site-lead text-ink">
              Common searches
            </h2>
            <Suspense fallback={<Chips chips={chipsOf({}, SEARCH_TEMPLATES)} pending labelledBy="discover-common" />}>
              <CommonSearches />
            </Suspense>
            <p className="max-w-[560px] text-center font-book text-site-item text-ink-2">Each opens in the app, where its filters run: sign in first, at no cost.</p>
          </div>
        </section>
      )}
    </HomeMain>
  );
}
