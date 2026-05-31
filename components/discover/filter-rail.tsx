// Shared Discover filter rail — used by both the buyer (`/app/discover`)
// and the public anonymous (`/discover`) surfaces. Server module only;
// no client island. `basePath` is the form action + Reset href + sort/
// page link prefix.
//
// Extracted from `app/(app)/app/discover/page.tsx` in Spec M5 to keep
// public/buyer in parity without duplicating markup.

import Link from "next/link";

import { Button } from "@/components/ui/button";
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
  { value: "unknown", label: "Unknown" },
] as const;

export const CERT_KINDS = [
  { value: "wrap", label: "WRAP" },
  { value: "oeko_tex", label: "OEKO-TEX" },
  { value: "gots", label: "GOTS" },
  { value: "sa8000", label: "SA8000" },
] as const;

export const MIN_SOURCES_OPTIONS = [
  { value: "", label: "Any" },
  { value: "1", label: "≥ 1" },
  { value: "2", label: "≥ 2" },
  { value: "3", label: "≥ 3" },
  { value: "4", label: "≥ 4" },
  { value: "5", label: "≥ 5" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

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
  minSources,
  rscMin,
  city,
  district,
  category,
  sort,
}: {
  basePath: string;
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
        action={basePath}
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
            <Link href={basePath}>Reset</Link>
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
      className="flex flex-wrap items-center gap-1 text-[12px]"
    >
      <span className="font-mono uppercase tracking-[0.12em] text-ink-tertiary">
        Sort
      </span>
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
