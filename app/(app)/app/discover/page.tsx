// Spec B1 — buyer Discover (authenticated, /app/discover).
//
// Distinct from the public anonymous `(marketing)/discover` route — that
// one calls the same RPC but renders without SaveButton and adds the
// demo-mode banner (Spec M5). The filter rail / sort / pagination
// markup is shared via `components/discover/filter-rail`.
//
// SBI hard contract: the RPC orders by `sbi_scores.total DESC NULLS LAST`
// inside its body under `security definer`, but the RETURNS TABLE never
// includes the SBI value. Receipts Ring centre = count of distinct
// Tier 1–3 sources (`t13_source_count`).

import Link from "next/link";

import { ReceiptsRing } from "@/components/receipts-ring";
import { SaveButton } from "@/components/save-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
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
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BASE_PATH = "/app/discover";

type DiscoverRow = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  source_tags: string[];
  t13_source_count: number;
  completeness_pct: number;
  employees_total: number | null;
  established_date: string | null;
  principal_products: string[];
  factory_types: string[];
  rsc_progress_pct: number | null;
  parent_group_name: string | null;
  total_count: number;
};

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

  const savedSet = new Set<string>();
  if (rows.length > 0) {
    const { data: savedRows } = await supabase
      .from("saved_suppliers")
      .select("supplier_id")
      .in(
        "supplier_id",
        rows.map((r) => r.id),
      );
    if (savedRows) {
      for (const r of savedRows as { supplier_id: string }[]) {
        savedSet.add(r.supplier_id);
      }
    }
  }
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
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
          Buyer
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          Discover
        </h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Verified Bangladesh garment factories and buying houses. Results
          ranked by source-backed evidence.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
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
            <Card>
              <CardContent className="space-y-3 py-8 text-center">
                <p className="text-sm text-ink-secondary">
                  {anyFilterActive
                    ? "No suppliers match these filters. Try removing the most restrictive one."
                    : "No published suppliers yet."}
                </p>
                {anyFilterActive ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={BASE_PATH}>Clear all filters</Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <ul className="grid grid-cols-1 gap-4">
              {rows.map((row) => (
                <li key={row.id}>
                  <ResultCard row={row} initialSaved={savedSet.has(row.id)} />
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

function ResultCard({
  row,
  initialSaved,
}: {
  row: DiscoverRow;
  initialSaved: boolean;
}) {
  const location = [row.city, row.district].filter(Boolean).join(", ");
  const entityLabel =
    ENTITY_TYPES.find((o) => o.value === row.entity_type)?.label ??
    row.entity_type.replace(/_/g, " ");
  const visiblePills = row.source_tags.slice(0, 4);
  const extraPills = Math.max(0, row.source_tags.length - visiblePills.length);

  return (
    <Card className="transition hover:shadow-l2">
      <CardContent className="flex items-start gap-4 py-4">
        <Link
          href={`/app/suppliers/${row.slug}`}
          className="flex flex-1 items-start gap-4 min-w-0 rounded-card focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-indigo"
        >
          <ReceiptsRing sources={row.t13_source_count} size={48} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 className="font-display text-base font-semibold text-ink-primary">
                {row.company_name}
              </h2>
              <span className="text-[12px] uppercase tracking-[0.04em] text-ink-tertiary">
                {entityLabel}
              </span>
              {location ? (
                <span className="text-[12px] text-ink-tertiary">· {location}</span>
              ) : null}
              {row.completeness_pct > 0 ? (
                <Badge tone="neutral" className="ml-1">
                  {row.completeness_pct}% complete
                </Badge>
              ) : null}
            </div>

            {visiblePills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {visiblePills.map((tag) => (
                  <Tag key={tag} tone="neutral">
                    {tag}
                  </Tag>
                ))}
                {extraPills > 0 ? (
                  <Tag tone="muted">+ {extraPills} more</Tag>
                ) : null}
              </div>
            ) : null}

            <StatLine row={row} />
          </div>
        </Link>
        <SaveButton supplierId={row.id} initialSaved={initialSaved} shape="icon" />
      </CardContent>
    </Card>
  );
}

function StatLine({ row }: { row: DiscoverRow }) {
  const parts: string[] = [];
  if (row.established_date) parts.push(`Established ${row.established_date}`);
  if (row.employees_total)
    parts.push(`${row.employees_total.toLocaleString()} employees`);
  if (row.factory_types.length > 0)
    parts.push(row.factory_types.slice(0, 2).join(" · "));
  if (row.principal_products.length > 0)
    parts.push(row.principal_products.slice(0, 3).join(", "));
  if (row.rsc_progress_pct !== null)
    parts.push(`RSC ${Number(row.rsc_progress_pct).toFixed(0)}%`);
  if (parts.length === 0) return null;
  return <p className="text-[12px] text-ink-secondary">{parts.join(" · ")}</p>;
}
