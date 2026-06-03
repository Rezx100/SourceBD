// Saved suppliers list — Spec B5 (/app/saved), FE-SITEWIDE Phase C2.
//
// Calls `public.buyer_saved_list(p_sort, p_limit, p_offset)` (migration
// 0026) under the caller's session and renders the result-card grid using
// the shared `DiscoverResultCard`. Each card carries a SaveButton (star)
// so buyers can unsave inline.
//
// SBI hard contract: the RPC excludes SBI from its RETURNS whitelist;
// nothing here references `sbi_*`. Contact PII fields are never fetched.

import Link from "next/link";

import { DiscoverResultCard, type DiscoverRow } from "@/components/discover/result-card";
import { SaveButton } from "@/components/save-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;
const SORT_OPTIONS = [
  { value: "recent", label: "Recently saved" },
  { value: "receipts", label: "Most receipts" },
  { value: "completeness", label: "Most complete" },
  { value: "name", label: "Name (A–Z)" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

type SavedRow = {
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
  saved_at: string;
  total_count: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

function asString(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function clampSort(v: string): SortValue {
  const found = SORT_OPTIONS.find((o) => o.value === v);
  return found ? found.value : "recent";
}

export default async function SavedSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const sort = clampSort(asString(sp.sort));
  const pageNum = Math.max(1, Number.parseInt(asString(sp.page), 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("buyer_saved_list", {
    p_sort: sort,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  const rows = (data ?? []) as SavedRow[];
  const totalCount = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(Number(totalCount) / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-tertiary">
          Buyer
        </p>
        <h1 className="font-display text-3xl font-light tracking-tight text-ink-primary">
          Saved suppliers
        </h1>
        <p className="affiliation-disclaimer mt-2">
          Your personal shortlist. Visible only to you.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-tertiary">
          {error ? (
            <span className="text-sem-red">Could not load saved suppliers.</span>
          ) : (
            <>
              <span className="font-semibold text-ink-primary">
                {Number(totalCount).toLocaleString()}
              </span>{" "}
              saved
            </>
          )}
        </p>
        <SortControl current={sort} />
      </div>

      {!error && rows.length === 0 ? (
        <div className="proto-card space-y-3 text-center">
          <p className="affiliation-disclaimer">
            You haven&apos;t saved any suppliers yet.
          </p>
          <Link href="/app/discover" className="btn-proto inline-flex">
            Browse Discover
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4">
          {rows.map((row) => (
            <li key={row.id}>
              <DiscoverResultCard
                row={toDiscoverRow(row)}
                hrefBase="/app/suppliers"
                actionSlot={
                  <SaveButton supplierId={row.id} initialSaved={true} shape="icon" />
                }
              />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <Pagination page={pageNum} totalPages={totalPages} sort={sort} />
      ) : null}
    </div>
  );
}

function toDiscoverRow(r: SavedRow): DiscoverRow {
  return {
    id: r.id,
    slug: r.slug,
    company_name: r.company_name,
    entity_type: r.entity_type,
    city: r.city,
    district: r.district,
    source_tags: r.source_tags,
    t13_source_count: r.t13_source_count,
    completeness_pct: r.completeness_pct,
    employees_total: r.employees_total,
    established_date: r.established_date,
    principal_products: r.principal_products,
    factory_types: r.factory_types,
    rsc_progress_pct: r.rsc_progress_pct,
    parent_group_name: r.parent_group_name,
    total_count: r.total_count,
  };
}

function SortControl({ current }: { current: SortValue }) {
  return (
    <form method="get" className="flex items-center gap-2">
      <label
        htmlFor="sort"
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-tertiary"
      >
        Sort
      </label>
      <select
        id="sort"
        name="sort"
        defaultValue={current}
        className="h-8 rounded-input border border-hairline-strong bg-surface-l1 px-2 text-[12px] text-ink-primary focus:border-brand-forest focus:outline-none"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button type="submit" className="btn-proto">
        Apply
      </button>
    </form>
  );
}

function Pagination({
  page,
  totalPages,
  sort,
}: {
  page: number;
  totalPages: number;
  sort: SortValue;
}) {
  const prev = page > 1 ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (sort !== "recent") u.set("sort", sort);
    if (p !== 1) u.set("page", String(p));
    const s = u.toString();
    return s ? `?${s}` : "";
  };
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-tertiary">
        Page {page} of {totalPages}
      </div>
      <div className="flex gap-2">
        {prev !== null ? (
          <Link href={`/app/saved${qs(prev)}`} className="btn-proto">
            Previous
          </Link>
        ) : (
          <span className="btn-proto cursor-not-allowed opacity-50">Previous</span>
        )}
        {next !== null ? (
          <Link href={`/app/saved${qs(next)}`} className="btn-proto">
            Next
          </Link>
        ) : (
          <span className="btn-proto cursor-not-allowed opacity-50">Next</span>
        )}
      </div>
    </nav>
  );
}
