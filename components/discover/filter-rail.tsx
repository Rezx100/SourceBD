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
//   Row 1 — search input + Apply + Reset (always visible)
//   Row 2 — quick-pick product chips (deep-links, preserve other filters)
//   Row 3 — common compact filters: City · District · Category ·
//           Receipts ≥ · RSC % ≥ · Min workforce
//   Row 3b — Profile completeness ≥ %
//   Row 4 — collapsible <details> "More filters":
//           Entity type · Certifications · Registry membership ·
//           Brand factory list · Factory type
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
  { value: "receipts", label: "Most receipts" },
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
  rscMin,
  completenessMin,
  workersMin,
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
  rscMin: number | null;
  completenessMin?: number | null;
  workersMin: number | null;
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

  const inputBase =
    "w-full rounded-input border bg-bg-l0 px-3 py-2.5 text-sm text-ink-primary outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/15";

  return (
    <section
      aria-label="Filter suppliers"
      className="rounded-card border border-hairline bg-surface-l1 p-4 shadow-[0_1px_2px_rgba(15,15,20,0.03)] sm:p-5"
    >
      <form method="get" action={basePath} className="space-y-4">
        {sort && sort !== "default" ? (
          <input type="hidden" name="sort" value={sort} />
        ) : null}

        {/* Row 1 — search + apply/reset. When the page already renders the
            primary search hero above the rail (hideSearchRow), we omit the
            duplicate input and keep `q` as a hidden field so Apply preserves
            the active query; Apply/Reset move to a compact right-aligned row. */}
        {hideSearchRow ? (
          <>
            {q ? <input type="hidden" name="q" value={q} /> : null}
            <div className="flex items-center justify-end gap-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-pill bg-brand-forest px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-forest-mid"
              >
                Apply filters
              </button>
              <Link
                href={basePath}
                className="inline-flex items-center justify-center rounded-pill border border-hairline-strong bg-surface-l1 px-4 py-2 text-sm font-semibold text-ink-primary transition-colors hover:bg-brand-forest-tint"
              >
                Reset
              </Link>
            </div>
          </>
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
                placeholder="Company name, e.g. Naafco, Standard Group…"
                className={cn(inputBase, activeRing(Boolean(q)))}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-pill bg-brand-forest px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-forest-mid"
              >
                Apply
              </button>
              <Link
                href={basePath}
                className="inline-flex items-center justify-center rounded-pill border border-hairline-strong bg-surface-l1 px-4 py-2.5 text-sm font-semibold text-ink-primary transition-colors hover:bg-brand-forest-tint"
              >
                Reset
              </Link>
            </div>
          </div>
        )}

        {/* Row 2 — quick product chips. Plain anchors that preserve
            current filters but set category. No JS needed. */}
        <div>
          <div className="mb-1.5 text-xs font-semibold text-ink-tertiary">
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
                      ? "border-brand-forest/30 bg-brand-forest-soft text-brand-forest"
                      : "border-hairline-strong bg-surface-l1 text-ink-secondary hover:bg-brand-forest-tint",
                  )}
                  aria-current={isActive ? "true" : undefined}
                >
                  {label}
                </Link>
              );
            })}
            {category && !isQuickPickValue(category) ? (
              <span className="inline-flex items-center rounded-pill border border-brand-forest/30 bg-brand-forest-soft px-2.5 py-1 text-[12px] font-medium text-brand-forest">
                {category}
              </span>
            ) : null}
          </div>
        </div>

        {/* Row 3 — common compact filters */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
          <Field label="Receipts (T1–3)">
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
          <Field label="RSC % ≥">
            <input
              type="number"
              name="rsc_min"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              defaultValue={rscMin !== null ? String(rscMin) : ""}
              placeholder="e.g. 95"
              className={cn(inputBase, activeRing(rscMin !== null))}
            />
          </Field>
          <Field label="Min workforce">
            <input
              type="number"
              name="workers_min"
              min={0}
              step={50}
              inputMode="numeric"
              defaultValue={workersMin !== null ? String(workersMin) : ""}
              placeholder="e.g. 500"
              className={cn(inputBase, activeRing(workersMin !== null))}
            />
          </Field>
        </div>

        {/* Row 3b — profile completeness on its own line. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Profile completeness ≥ %">
            <input
              type="number"
              name="completeness_min"
              min={0}
              max={100}
              step={5}
              inputMode="numeric"
              defaultValue={
                completenessMin !== null ? String(completenessMin) : ""
              }
              placeholder="e.g. 60"
              className={cn(inputBase, activeRing(completenessMin !== null))}
            />
          </Field>
        </div>

        {/* Row 4 — disclosure for the long-tail checkbox groups, so
            the bar stays uncluttered when buyers only need the
            common filters. */}
        <details
          className="group rounded-card border border-hairline bg-bg-l0 px-4 py-3 open:bg-surface-l1"
          open={hasAdvancedActive}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-ink-primary">
            <span className="flex items-center gap-2">
              More filters
              {hasAdvancedActive ? (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-forest-soft px-1.5 text-[11px] font-semibold text-brand-forest">
                  {advancedCount}
                </span>
              ) : null}
            </span>
            <span className="text-xs text-ink-tertiary transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>

          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <CheckboxGroup
              label="Entity type"
              name="entity"
              options={ENTITY_TYPES}
              selected={entityTypes}
            />
            <CheckboxGroup
              label="Certifications"
              name="cert"
              options={CERT_KINDS}
              selected={certKinds}
            />
            <CheckboxGroup
              label="Registry membership"
              name="registry"
              options={REGISTRY_SOURCES}
              selected={registries}
            />
            <CheckboxGroup
              label="Brand factory list"
              name="brand"
              options={BRAND_SOURCES}
              selected={brandCodes}
            />
            {facets.factory_types.length > 0 ? (
              <CheckboxGroup
                label="Factory type"
                name="ftype"
                options={facets.factory_types
                  .slice(0, 12)
                  .map((t) => ({ value: t, label: t }))}
                selected={factoryTypes}
              />
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
    : "border-hairline";
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
      <span className="mb-1.5 block text-xs font-semibold text-ink-tertiary">
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
}: {
  label: string;
  name: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string[];
}) {
  return (
    <fieldset className="space-y-2 border-0 p-0">
      <legend className="text-xs font-semibold text-ink-tertiary">
        {label}
        {selected.length > 0 ? (
          <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-forest-soft px-1 text-[10px] font-semibold text-brand-forest">
            {selected.length}
          </span>
        ) : null}
      </legend>
      <div className="grid grid-cols-1 gap-1.5">
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                checked
                  ? "bg-brand-forest-soft text-brand-forest"
                  : "text-ink-secondary hover:bg-bg-l0",
              )}
            >
              <input
                type="checkbox"
                name={name}
                value={opt.value}
                defaultChecked={checked}
                className="h-[18px] w-[18px] cursor-pointer accent-brand-forest"
              />
              <span>{opt.label}</span>
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
      className="flex items-center justify-between border-t border-hairline pt-4 text-sm"
    >
      <span className="text-[11px] text-ink-tertiary">
        Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        {atFirst ? (
          <span className="inline-flex cursor-not-allowed items-center rounded-pill border border-hairline-strong bg-surface-l1 px-4 py-2 text-sm font-semibold text-ink-primary opacity-50">
            Previous
          </span>
        ) : (
          <Link href={prevHref} className="inline-flex items-center rounded-pill border border-hairline-strong bg-surface-l1 px-4 py-2 text-sm font-semibold text-ink-primary transition-colors hover:bg-brand-forest-tint">
            Previous
          </Link>
        )}
        {atLast ? (
          <span className="inline-flex cursor-not-allowed items-center rounded-pill border border-hairline-strong bg-surface-l1 px-4 py-2 text-sm font-semibold text-ink-primary opacity-50">Next</span>
        ) : (
          <Link href={nextHref} className="inline-flex items-center rounded-pill border border-hairline-strong bg-surface-l1 px-4 py-2 text-sm font-semibold text-ink-primary transition-colors hover:bg-brand-forest-tint">
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}
