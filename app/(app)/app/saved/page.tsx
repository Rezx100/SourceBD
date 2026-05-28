// Saved suppliers list — Spec B5 (/app/saved).
//
// Calls `public.buyer_saved_list(p_sort, p_limit, p_offset)` (migration
// 0026) under the caller's session and renders the result-card grid per
// `context/frontend-design-spec.md` §7. Sort affordance preserves the
// established Discover pattern (link-based, no client state). Each card
// carries a SaveButton (star) so buyers can unsave inline.
//
// SBI hard contract: the RPC excludes SBI from its RETURNS whitelist;
// nothing here references `sbi_*`. Contact PII fields are never fetched.

import Link from "next/link";

import { ReceiptsRing } from "@/components/receipts-ring";
import { SaveButton } from "@/components/save-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
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
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
          Buyer
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          Saved suppliers
        </h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Your personal shortlist. Visible only to you.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-secondary">
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
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-sm text-ink-secondary">
              You haven&apos;t saved any suppliers yet.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/discover">Browse Discover</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4">
          {rows.map((row) => (
            <li key={row.id}>
              <SavedCardRow row={row} />
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

// ---------- result row ----------------------------------------------------

function SavedCardRow({ row }: { row: SavedRow }) {
  const location = [row.city, row.district].filter(Boolean).join(", ");
  const visiblePills = row.source_tags.slice(0, 4);
  const extraPills = Math.max(0, row.source_tags.length - visiblePills.length);
  const entityLabel =
    row.entity_type === "factory"
      ? "Factory"
      : row.entity_type === "buying_house"
        ? "Buying house"
        : row.entity_type.replace(/_/g, " ");

  return (
    <Card className="transition hover:shadow-l2">
      <CardContent className="flex items-start gap-4 py-4">
        <Link
          href={`/app/suppliers/${row.slug}`}
          className="flex flex-1 items-start gap-4 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-indigo rounded-card"
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
              <div className="flex flex-wrap items-center gap-1.5">
                {visiblePills.map((p) => (
                  <Tag key={p} tone="neutral">
                    {p}
                  </Tag>
                ))}
                {extraPills > 0 ? (
                  <span className="font-mono text-[11px] text-ink-tertiary">
                    +{extraPills} more
                  </span>
                ) : null}
              </div>
            ) : null}

            <p className="font-mono text-[11px] text-ink-tertiary">
              Saved {fmtRelative(row.saved_at)}
            </p>
          </div>
        </Link>
        <SaveButton supplierId={row.id} initialSaved={true} shape="icon" />
      </CardContent>
    </Card>
  );
}

// ---------- controls ------------------------------------------------------

function SortControl({ current }: { current: SortValue }) {
  return (
    <form method="get" className="flex items-center gap-2 text-[12px]">
      <label htmlFor="sort" className="font-mono uppercase tracking-[0.04em] text-ink-tertiary">
        Sort
      </label>
      <select
        id="sort"
        name="sort"
        defaultValue={current}
        className="h-8 rounded-input border border-hairline-strong bg-surface-l1 px-2 text-[12px] text-ink-primary"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline" size="sm">
        Apply
      </Button>
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
      <div className="text-[12px] text-ink-tertiary">
        Page {page} of {totalPages}
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm" disabled={prev === null}>
          {prev !== null ? <Link href={`/app/saved${qs(prev)}`}>Previous</Link> : <span>Previous</span>}
        </Button>
        <Button asChild variant="outline" size="sm" disabled={next === null}>
          {next !== null ? <Link href={`/app/saved${qs(next)}`}>Next</Link> : <span>Next</span>}
        </Button>
      </div>
    </nav>
  );
}

function fmtRelative(iso: string): string {
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return "";
  const diff = Date.now() - d;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}
