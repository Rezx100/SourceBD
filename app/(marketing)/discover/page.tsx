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

import { DemoBanner } from "@/components/marketing/demo-banner";
import {
  CERT_KINDS,
  ENTITY_TYPES,
  FilterRail,
  PAGE_SIZE,
  Pagination,
  SortControl,
  asInt,
  asString,
  asStringArray,
  clampSort,
} from "@/components/discover/filter-rail";
import {
  DiscoverResultCard,
  type DiscoverRow,
} from "@/components/discover/result-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
  const minSourcesRaw = asString(sp.min_sources);
  const minSources =
    minSourcesRaw && /^[1-5]$/.test(minSourcesRaw)
      ? Number.parseInt(minSourcesRaw, 10)
      : null;
  const rscMin = asInt(sp.rsc_min);
  const city = asString(sp.city).trim();
  const district = asString(sp.district).trim();
  const category = asString(sp.category).trim();
  const sort = clampSort(asString(sp.sort));
  const pageNum = Math.max(1, asInt(sp.page) ?? 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("discover_suppliers", {
    p_q: q || null,
    p_entity_types: entityTypes.length ? entityTypes : null,
    p_min_sources: minSources,
    p_cert_kinds: certKinds.length ? certKinds : null,
    p_rsc_min: rscMin !== null && rscMin >= 0 && rscMin <= 100 ? rscMin : null,
    p_city: city || null,
    p_district: district || null,
    p_category: category || null,
    p_sort: sort,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  const rows = (data ?? []) as DiscoverRow[];
  const totalCount = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(Number(totalCount) / PAGE_SIZE));

  const baseQuery = {
    q,
    entity: entityTypes,
    cert: certKinds,
    min_sources:
      minSourcesRaw && /^[1-5]$/.test(minSourcesRaw) ? minSourcesRaw : "",
    rsc_min: rscMin !== null ? String(rscMin) : "",
    city,
    district,
    category,
    sort: sort === "default" ? "" : sort,
  };

  const anyFilterActive =
    Boolean(q) ||
    entityTypes.length > 0 ||
    certKinds.length > 0 ||
    minSources !== null ||
    rscMin !== null ||
    Boolean(city) ||
    Boolean(district) ||
    Boolean(category);

  return (
    <>
      <DemoBanner next={BASE_PATH} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <header>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-tertiary">
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

        <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
          <FilterRail
            basePath={BASE_PATH}
            q={q}
            entityTypes={entityTypes}
            certKinds={certKinds}
            minSources={minSourcesRaw}
            rscMin={rscMin}
            city={city}
            district={district}
            category={category}
            sort={sort}
          />

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
