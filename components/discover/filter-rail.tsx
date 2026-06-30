// Shared Discover filter rail — debug batch 6 (2026-06-06, I-016..I-019).
//
// Replaces the previous left-aside sticky rail with a horizontal,
// NON-FIXED bar that sits on top of the result list. Used by both
// `/app/discover` (buyer) and `/discover` (public anonymous).
//
// Server module only; the only client interaction is native HTML
// (form GET, <details>, <datalist> autocomplete). No JS island, so
// no extra bundle cost and no hydration mismatch risk.
//
// Layout (top to bottom inside the bar):
//   Row 1 — search input when this rail is standalone
//   Row 2 — quick-pick product chips (deep-links, preserve other filters)
//   Row 3 — common compact filters: City · District · Category ·
//           Verified sources · RSC % ≥ · Min workforce
//   Row 3b — Profile completeness ≥ %
//   Row 4 — collapsible <details> "More filters":
//           Entity type · Certifications · Registry membership ·
//           Brand factory list · Factory type
//   Row 5 — quiet Apply/Clear filter actions when the page has a primary
//           search hero above the rail.
//
// A filter is rendered with subtle brand-color emphasis (forest-soft
// background + forest-50 border) when it has a non-empty value, so the
// user can see at a glance which filters are active without us having
// to render a separate "selected filters" chip row above the rail.

import Link from "next/link";

import { cn } from "@/lib/utils";

export const PAGE_SIZE = 24;

export const SORT_OPTIONS = [
  { value: "default", label: "Best match" },
  { value: "receipts", label: "Most evidence" },
  { value: "completeness", label: "Most complete" },
  { value: "name", label: "Name (A–Z)" },
] as const;

export const ENTITY_TYPES = [
  { value: "factory", label: "Factory" },
  { value: "buying_house", label: "Buying house" },
] as const;

export const CERT_KINDS = [
  { value: "wrap", label: "WRAP" },
  { value: "oeko_tex", label: "OEKO-TEX" },
  { value: "gots", label: "GOTS" },
  { value: "sa8000", label: "SA8000" },
] as const;

export const REGISTRY_SOURCES = [
  { value: "BGMEA", label: "BGMEA member" },
  { value: "BKMEA", label: "BKMEA member" },
  { value: "BGAPMEA", label: "BGAPMEA member" },
  { value: "BTMA", label: "BTMA member" },
  { value: "EPB", label: "EPB exporter" },
  { value: "RSC", label: "RSC inspected" },
] as const;

export const BRAND_SOURCES = [
  { value: "BRAND_HM", label: "H&M factory list" },
  { value: "BRAND_NEXT", label: "Next factory list" },
  { value: "BRAND_MS", label: "M&S supplier map" },
  { value: "BRAND_ASOS", label: "ASOS factory list" },
] as const;

export const MIN_SOURCES_OPTIONS = [
  { value: "", label: "Any" },
  { value: "1", label: "≥ 1" },
  { value: "2", label: "≥ 2" },
  { value: "3", label: "≥ 3" },
  { value: "4", label: "≥ 4" },
  { value: "5", label: "≥ 5" },
] as const;

// Curated quick-pick products. Each chip is a deep-link with
// `category=<value>`. The existing `p_category` RPC param does ilike
// substring match against `principal_products[]`, so 'denim' will
// hit "Denim Pant", "Denim Shirt", "All Kinds of Denim Wear", etc.
export const PRODUCT_QUICK_PICKS = [
  "Denim",
  "Knitwear",
  "Woven",
  "Sweater",
  "T-Shirt",
  "Polo",
  "Jeans",
  "Trouser",
  "Jacket",
  "Hoodie",
  "Sportswear",
  "Childrens",
  "Lingerie",
  "Shirt",
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export type DiscoverFacets = {
  cities: string[];
  districts: string[];
  products: string[];
  factory_types: string[];
};

export const EMPTY_FACETS: DiscoverFacets = {
  cities: [],
  districts: [],
  products: [],
  factory_types: [],
};

export function asString(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export function asStringArray(v: string | string[] | undefined): string[] {
  if (Array.isArray(v)) return v.filter((s) => s.length > 0);
  if (typeof v === "string" && v.length > 0) return [v];
  return [];
}

export function asInt(v: string | string[] | undefined): number | null {
  const s = asString(v).trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export function clampSort(v: string): SortValue {
  const found = SORT_OPTIONS.find((o) => o.value === v);
  return found ? found.value : "default";
}

export function buildQuery(
  params: Record<string, string | string[] | null | undefined>,
): string {
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

export function FilterRail({
  basePath,
  q,
  entityTypes,
  certKinds,
  registries,
  brandCodes,
  factoryTypes,
  minSources,
  city,
  district,
  category,
  sort,
  facets,
  baseQuery,
  hideSearchRow,
  instanceId,
}: {
  basePath: string;
  q: string;
  entityTypes: string[];
  certKinds: string[];
  registries: string[];
  brandCodes: string[];
  factoryTypes: string[];
  minSources: string;
  city: string;
  district: string;
  category: string;
  sort: string;
  facets: DiscoverFacets;
  baseQuery: Record<string, string | string[]>;
  hideSearchRow?: boolean;
  instanceId?: string;
}) {
  const qId = `discover-q-${instanceId ?? "default"}`;
  const hasAdvancedActive =
    entityTypes.length > 0 ||
    certKinds.length > 0 ||
    registries.length > 0 ||
    brandCodes.length > 0 ||
    factoryTypes.length > 0;
  const advancedCount =
    entityTypes.length +
    certKinds.length +
    registries.length +
    brandCodes.length +
    factoryTypes.length;
  const hasAnyFilterActive =
    Boolean(q) ||
    Boolean(city) ||
    Boolean(district) ||
    Boolean(category) ||
    Boolean(minSources) ||
    hasAdvancedActive;
  const visibleFilterCount =
    (city ? 1 : 0) +
    (district ? 1 : 0) +
    (category ? 1 : 0) +
    (minSources ? 1 : 0) +
    advancedCount;

  const inputBase =
    "w-full rounded-input border bg-neutral-50 px-3 py-2 text-[13px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-500 focus:border-brand-forest/50 focus:bg-white focus:ring-2 focus:ring-brand-forest/15";

  return (
    <section aria-label="Filter suppliers" className="rounded-card border border-neutral-200 bg-white p-3 sm:p-4">
      <form method="get" action={basePath} className="space-y-3">
        {sort && sort !== "default" ? (
          <input type="hidden" name="sort" value={sort} />
        ) : null}

        {/* Row 1 — search. When the page already renders the
            primary search hero above the rail (hideSearchRow), we omit the
            duplicate input and keep `q` as a hidden field so Apply preserves
            the active query. */}
        {hideSearchRow ? (
          q ? <input type="hidden" name="q" value={q} /> : null
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor={qId}
                className="mb-1.5 block text-xs font-semibold text-ink-tertiary"
              >
                Search
              </label>
              <input
                id={qId}
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Products, factories, locations, sources..."
                className={cn(inputBase, activeRing(Boolean(q)))}
              />
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" className="btn-proto primary px-5">
                Apply
              </button>
              <Link
                href={basePath}
                className="inline-flex items-center justify-center rounded-input border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50"
              >
                Reset
              </Link>
            </div>
          </div>
        )}

        {/* Row 2 — quick product chips. Plain anchors that preserve
            current filters but set category. No JS needed. */}
        <div className="flex flex-col gap-2 border-b border-neutral-100 pb-3 lg:flex-row lg:items-center">
          <div className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-tertiary">
            Quick pick
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRODUCT_QUICK_PICKS.map((label) => {
              const value = label.toLowerCase();
              const isActive = category.trim().toLowerCase() === value;
              const href =
                basePath +
                buildQuery({ ...baseQuery, category: value, page: "" });
              return (
                <Link
                  key={label}
                  href={href}
                  className={cn(
                    "inline-flex items-center rounded-pill border px-2.5 py-1 text-[12px] font-medium transition-colors",
                    isActive
                      ? "border-brand-forest/20 bg-brand-forest-soft text-brand-forest"
                      : "border-transparent text-neutral-600 hover:border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900",
                  )}
                  aria-current={isActive ? "true" : undefined}
                >
                  {label}
                </Link>
              );
            })}
            {category && !isQuickPickValue(category) ? (
              <span className="inline-flex items-center rounded-pill border border-brand-forest/20 bg-brand-forest-soft px-2.5 py-1 text-[12px] font-medium text-brand-forest">
                {category}
              </span>
            ) : null}
          </div>
        </div>

        <details className="group overflow-hidden rounded-card border border-hairline bg-surface-l1 transition-colors open:border-hairline-strong">
          <summary
            className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-ink-primary"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-forest-soft text-brand-forest">
                +
              </span>
              <span className="min-w-0">
                <span className="block">Refine filters</span>
                <span className="block truncate text-[11px] font-medium text-ink-tertiary">
                  City, product, registry and compliance filters
                </span>
              </span>
              {visibleFilterCount > 0 ? (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-forest px-1.5 text-[11px] font-semibold text-white">
                  {visibleFilterCount}
                </span>
              ) : null}
            </span>
            <span className="rounded-pill border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-ink-tertiary">
              Open
            </span>
          </summary>

          <div className="space-y-4 border-t border-hairline bg-neutral-50/40 px-3 py-3">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="City">
                <input
                  type="text"
                  name="city"
                  list="discover-cities"
                  defaultValue={city}
                  placeholder="e.g. Dhaka"
                  autoComplete="off"
                  className={cn(inputBase, activeRing(Boolean(city)))}
                />
              </Field>
              <Field label="District">
                <input
                  type="text"
                  name="district"
                  list="discover-districts"
                  defaultValue={district}
                  placeholder="e.g. Gazipur"
                  autoComplete="off"
                  className={cn(inputBase, activeRing(Boolean(district)))}
                />
              </Field>
              <Field label="Category / product">
                <input
                  type="text"
                  name="category"
                  list="discover-products"
                  defaultValue={category}
                  placeholder="e.g. knitwear"
                  autoComplete="off"
                  className={cn(inputBase, activeRing(Boolean(category)))}
                />
              </Field>
              <Field label="Verified sources">
                <select
                  name="min_sources"
                  defaultValue={minSources}
                  className={cn(inputBase, activeRing(Boolean(minSources)))}
                >
                  {MIN_SOURCES_OPTIONS.map((o) => (
                    <option key={o.label} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="rounded-card border border-hairline bg-white p-3 shadow-[0_1px_2px_rgba(15,15,20,0.03)]">
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-hairline pb-3">
                <div>
                  <p className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink-primary">
                    Advanced filters
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-tertiary">
                    Entity, certifications, memberships and brand lists
                  </p>
                </div>
                {advancedCount > 0 ? (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-forest px-1.5 text-[11px] font-semibold text-white">
                    {advancedCount}
                  </span>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
                <CheckboxGroup
                  label="Entity type"
                  name="entity"
                  options={ENTITY_TYPES}
                  selected={entityTypes}
                  className="xl:col-span-2"
                />
                <CheckboxGroup
                  label="Certifications"
                  name="cert"
                  options={CERT_KINDS}
                  selected={certKinds}
                  className="xl:col-span-2"
                />
                <CheckboxGroup
                  label="Registry membership"
                  name="registry"
                  options={REGISTRY_SOURCES}
                  selected={registries}
                  className="xl:col-span-2"
                />
                <CheckboxGroup
                  label="Brand factory list"
                  name="brand"
                  options={BRAND_SOURCES}
                  selected={brandCodes}
                  className="xl:col-span-3"
                />
                {facets.factory_types.length > 0 ? (
                  <CheckboxGroup
                    label="Factory type"
                    name="ftype"
                    options={facets.factory_types
                      .slice(0, 12)
                      .map((t) => ({ value: t, label: t }))}
                    selected={factoryTypes}
                    className="xl:col-span-3"
                    optionGridClassName="sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"
                  />
                ) : null}
              </div>
            </div>

            {hideSearchRow ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-white px-3 py-2.5">
                <p className="text-xs text-ink-tertiary">
                  Refine the list below without changing the main search field.
                </p>
                <div className="flex items-center gap-2">
                  {hasAnyFilterActive ? (
                    <Link
                      href={basePath}
                      className="inline-flex items-center justify-center rounded-input border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                    >
                      Clear filters
                    </Link>
                  ) : null}
                  <button type="submit" className="btn-proto px-4">
                    Apply filters
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </details>
      </form>

      {/* Datalists for native type-ahead, re-used across the City /
          District / Category inputs above. Server-rendered from the
          live database via `discover_facets()`. */}
      <SuggestionList id="discover-cities" values={facets.cities} />
      <SuggestionList id="discover-districts" values={facets.districts} />
      <SuggestionList id="discover-products" values={facets.products} />
    </section>
  );
}

function activeRing(active: boolean): string {
  return active
    ? "border-brand-forest/50 bg-brand-forest-tint"
    : "border-neutral-200";
}

function isQuickPickValue(category: string): boolean {
  const v = category.trim().toLowerCase();
  return PRODUCT_QUICK_PICKS.some((p) => p.toLowerCase() === v);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-ink-tertiary">
        {label}
      </span>
      {children}
    </label>
  );
}

function CheckboxGroup({
  label,
  name,
  options,
  selected,
  className,
  optionGridClassName,
}: {
  label: string;
  name: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string[];
  className?: string;
  optionGridClassName?: string;
}) {
  return (
    <fieldset className={cn("rounded-lg border border-hairline bg-surface-l1 p-2.5", className)}>
      <legend className="sr-only">{label}</legend>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-tertiary">
          {label}
        </span>
        {selected.length > 0 ? (
          <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-forest px-1 text-[10px] font-semibold text-white">
            {selected.length}
          </span>
        ) : null}
      </div>
      <div className={cn("grid gap-1", optionGridClassName)}>
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <label
              key={opt.value}
              className={cn(
                "group flex min-h-8 cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                checked
                  ? "border-brand-forest/25 bg-brand-forest-soft text-brand-forest shadow-[inset_0_0_0_1px_rgba(15,82,70,0.04)]"
                  : "border-transparent bg-transparent text-ink-secondary hover:border-hairline hover:bg-white hover:text-ink-primary",
              )}
            >
              <input
                type="checkbox"
                name={name}
                value={opt.value}
                defaultChecked={checked}
                className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-hairline accent-brand-forest"
              />
              <span className="min-w-0 truncate">{opt.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function SuggestionList({ id, values }: { id: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <datalist id={id}>
      {values.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  );
}

export function SortControl({
  basePath,
  current,
  baseQuery,
}: {
  basePath: string;
  current: SortValue;
  baseQuery: Record<string, string | string[]>;
}) {
  return (
    <nav
      aria-label="Sort results"
      className="flex flex-wrap items-center gap-1.5 text-[12px]"
    >
      <span className="text-xs font-semibold text-ink-tertiary">Sort</span>
      {SORT_OPTIONS.map((opt) => {
        const href =
          basePath +
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
              "inline-flex items-center rounded-pill border px-2.5 py-1 text-[12px] font-medium transition-colors",
              isActive
                ? "border-brand-forest/30 bg-brand-forest-soft text-brand-forest"
                : "border-hairline-strong bg-surface-l1 text-ink-secondary hover:bg-brand-forest-tint",
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

export function Pagination({
  basePath,
  page,
  totalPages,
  baseQuery,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  baseQuery: Record<string, string | string[]>;
}) {
  const prevHref =
    basePath +
    buildQuery({
      ...baseQuery,
      page: page > 2 ? String(page - 1) : "",
    });
  const nextHref =
    basePath + buildQuery({ ...baseQuery, page: String(page + 1) });
  const atFirst = page <= 1;
  const atLast = page >= totalPages;
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between border-t border-neutral-200 pt-4 text-sm"
    >
      <span className="text-[11px] text-ink-tertiary">
        Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        {atFirst ? (
          <span className="inline-flex cursor-not-allowed items-center rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 opacity-50">
            Previous
          </span>
        ) : (
          <Link href={prevHref} className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50">
            Previous
          </Link>
        )}
        {atLast ? (
          <span className="inline-flex cursor-not-allowed items-center rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 opacity-50">Next</span>
        ) : (
          <Link href={nextHref} className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50">
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}
