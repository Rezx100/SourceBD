// Spec B1 — buyer Discover (authenticated, /app/discover).
//
// Distinct from the public anonymous `(marketing)/discover` route (F3 exit
// gate) — that one shows blurred contacts to anonymous visitors. This one
// is gated behind the `(app)/app/*` middleware, calls the
// `public.discover_suppliers` RPC (migration 0023), and renders the filter
// rail + result card list per `context/frontend-design-spec.md` §5.
//
// SBI hard contract (ai-workflow-rules.md, frontend-design-spec.md §0):
//   * The RPC orders by `sbi_scores.total DESC NULLS LAST` inside its body
//     under `security definer`, but the RETURNS TABLE never includes the
//     SBI value. Nothing in this file selects, derives, or renders
//     `sbi_scores.*` — we only read the row ORDER that came back.
//   * Receipts Ring centre = count of distinct Tier 1–3 sources
//     (`t13_source_count`), not the SBI numeric.
//   * Contact PII (`email_primary`, `phones`, `contact_name`, `contact_role`)
//     is never fetched here; that surface ships behind /pricing in a later
//     Phase-2 spec.

import Link from "next/link";

import { ReceiptsRing } from "@/components/receipts-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;
const SORT_OPTIONS = [
  { value: "default", label: "Best match" },
  { value: "receipts", label: "Most receipts" },
  { value: "completeness", label: "Most complete" },
  { value: "name", label: "Name (A–Z)" },
] as const;
const ENTITY_TYPES = [
  { value: "factory", label: "Factory" },
  { value: "buying_house", label: "Buying house" },
  { value: "unknown", label: "Unknown" },
] as const;
const CERT_KINDS = [
  { value: "wrap", label: "WRAP" },
  { value: "oeko_tex", label: "OEKO-TEX" },
  { value: "gots", label: "GOTS" },
  { value: "sa8000", label: "SA8000" },
] as const;
const MIN_SOURCES_OPTIONS = [
  { value: "", label: "Any" },
  { value: "1", label: "≥ 1" },
  { value: "2", label: "≥ 2" },
  { value: "3", label: "≥ 3" },
  { value: "4", label: "≥ 4" },
  { value: "5", label: "≥ 5" },
] as const;

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

function asString(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function asStringArray(v: string | string[] | undefined): string[] {
  if (Array.isArray(v)) return v.filter((s) => s.length > 0);
  if (typeof v === "string" && v.length > 0) return [v];
  return [];
}

function asInt(v: string | string[] | undefined): number | null {
  const s = asString(v).trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function clampSort(v: string): (typeof SORT_OPTIONS)[number]["value"] {
  const found = SORT_OPTIONS.find((o) => o.value === v);
  return found ? found.value : "default";
}

function buildQuery(params: Record<string, string | string[] | null | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      for (const item of v) if (item) usp.append(k, item);
    } else if (v !== "") {
      usp.set(k, v);
    }
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

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
  const minSources = minSourcesRaw && /^[1-5]$/.test(minSourcesRaw)
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
    min_sources: minSourcesRaw && /^[1-5]$/.test(minSourcesRaw) ? minSourcesRaw : "",
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
            <SortControl current={sort} baseQuery={baseQuery} />
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
                    <Link href="/app/discover">Clear all filters</Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <ul className="grid grid-cols-1 gap-4">
              {rows.map((row) => (
                <li key={row.id}>
                  <ResultCard row={row} />
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 ? (
            <Pagination
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

function ResultCard({ row }: { row: DiscoverRow }) {
  const location = [row.city, row.district].filter(Boolean).join(", ");
  const entityLabel =
    ENTITY_TYPES.find((o) => o.value === row.entity_type)?.label ??
    row.entity_type.replace(/_/g, " ");
  const visiblePills = row.source_tags.slice(0, 4);
  const extraPills = Math.max(0, row.source_tags.length - visiblePills.length);

  return (
    <Link
      href={`/app/suppliers/${row.slug}`}
      className="block rounded-card transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-indigo"
    >
      <Card className="transition hover:shadow-l2">
        <CardContent className="flex items-start gap-4 py-4">
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
        </CardContent>
      </Card>
    </Link>
  );
}

function StatLine({ row }: { row: DiscoverRow }) {
  const parts: string[] = [];
  if (row.established_date) parts.push(`Established ${row.established_date}`);
  if (row.employees_total)
    parts.push(`${row.employees_total.toLocaleString()} employees`);
  if (row.factory_types.length > 0) parts.push(row.factory_types.slice(0, 2).join(" · "));
  if (row.principal_products.length > 0)
    parts.push(row.principal_products.slice(0, 3).join(", "));
  if (row.rsc_progress_pct !== null)
    parts.push(`RSC ${Number(row.rsc_progress_pct).toFixed(0)}%`);
  if (parts.length === 0) return null;
  return (
    <p className="text-[12px] text-ink-secondary">{parts.join(" · ")}</p>
  );
}

function FilterRail({
  q,
  entityTypes,
  certKinds,
  minSources,
  rscMin,
  city,
  district,
  category,
  sort,
}: {
  q: string;
  entityTypes: string[];
  certKinds: string[];
  minSources: string;
  rscMin: number | null;
  city: string;
  district: string;
  category: string;
  sort: string;
}) {
  return (
    <aside className="md:sticky md:top-20 md:self-start">
      <form
        method="get"
        action="/app/discover"
        className="space-y-5 rounded-card border border-hairline bg-surface-l1 p-4 shadow-l1"
      >
        {sort && sort !== "default" ? (
          <input type="hidden" name="sort" value={sort} />
        ) : null}

        <div>
          <label
            htmlFor="discover-q"
            className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary"
          >
            Search
          </label>
          <input
            id="discover-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Company name…"
            className="w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent-indigo"
          />
        </div>

        <FilterGroup label="Entity type">
          {ENTITY_TYPES.map((opt) => (
            <CheckboxRow
              key={opt.value}
              name="entity"
              value={opt.value}
              label={opt.label}
              checked={entityTypes.includes(opt.value)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Receipts (Tier 1–3 sources)">
          <select
            name="min_sources"
            defaultValue={minSources}
            className="w-full rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm text-ink-primary outline-none focus:border-accent-indigo"
          >
            {MIN_SOURCES_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FilterGroup>

        <FilterGroup label="Certifications">
          {CERT_KINDS.map((opt) => (
            <CheckboxRow
              key={opt.value}
              name="cert"
              value={opt.value}
              label={opt.label}
              checked={certKinds.includes(opt.value)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="RSC remediation ≥ %">
          <input
            type="number"
            name="rsc_min"
            min={0}
            max={100}
            step={1}
            inputMode="numeric"
            defaultValue={rscMin !== null ? String(rscMin) : ""}
            placeholder="e.g. 95"
            className="w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent-indigo"
          />
        </FilterGroup>

        <FilterGroup label="Location">
          <input
            type="text"
            name="city"
            defaultValue={city}
            placeholder="City"
            className="w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent-indigo"
          />
          <input
            type="text"
            name="district"
            defaultValue={district}
            placeholder="District"
            className="mt-2 w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent-indigo"
          />
        </FilterGroup>

        <FilterGroup label="Category / product">
          <input
            type="text"
            name="category"
            defaultValue={category}
            placeholder="e.g. knitwear"
            className="w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent-indigo"
          />
        </FilterGroup>

        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" variant="primary" size="sm" className="flex-1">
            Apply
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/app/discover">Reset</Link>
          </Button>
        </div>
      </form>
    </aside>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-2 border-0 p-0">
      <legend className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary">
        {label}
      </legend>
      <div className="space-y-1.5">{children}</div>
    </fieldset>
  );
}

function CheckboxRow({
  name,
  value,
  label,
  checked,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-secondary">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={checked}
        className="h-4 w-4 cursor-pointer accent-accent-indigo"
      />
      <span>{label}</span>
    </label>
  );
}

function SortControl({
  current,
  baseQuery,
}: {
  current: (typeof SORT_OPTIONS)[number]["value"];
  baseQuery: Record<string, string | string[]>;
}) {
  return (
    <nav
      aria-label="Sort results"
      className="flex flex-wrap items-center gap-1 text-[12px]"
    >
      <span className="font-mono uppercase tracking-[0.12em] text-ink-tertiary">
        Sort
      </span>
      {SORT_OPTIONS.map((opt) => {
        const href =
          "/app/discover" +
          buildQuery({
            ...baseQuery,
            sort: opt.value === "default" ? "" : opt.value,
            page: "",
          });
        const isActive = opt.value === current;
        return (
          <Link
            key={opt.value}
            href={href}
            className={cn(
              "rounded-pill border px-2.5 py-1 transition",
              isActive
                ? "border-accent-indigo bg-accent-indigo/10 text-ink-primary"
                : "border-hairline text-ink-secondary hover:border-hairline-strong",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {opt.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Pagination({
  page,
  totalPages,
  baseQuery,
}: {
  page: number;
  totalPages: number;
  baseQuery: Record<string, string | string[]>;
}) {
  const prevHref =
    "/app/discover" +
    buildQuery({
      ...baseQuery,
      page: page > 2 ? String(page - 1) : "",
    });
  const nextHref =
    "/app/discover" + buildQuery({ ...baseQuery, page: String(page + 1) });
  const atFirst = page <= 1;
  const atLast = page >= totalPages;
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between border-t border-hairline pt-4 text-sm"
    >
      <span className="text-ink-tertiary">
        Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        {atFirst ? (
          <Button variant="ghost" size="sm" disabled>
            Previous
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={prevHref}>Previous</Link>
          </Button>
        )}
        {atLast ? (
          <Button variant="ghost" size="sm" disabled>
            Next
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={nextHref}>Next</Link>
          </Button>
        )}
      </div>
    </nav>
  );
}
