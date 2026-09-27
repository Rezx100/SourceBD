// The Saved list (/app/saved), in the dashboard kit: title and count, a sort,
// one table, a "1–24 of 57" footer. Server component; the page reads
// `buyer_saved_list` and enriches the worker figures, then passes rows in.
//
// SBI and contact PII never reach this file: the RPC's RETURNS excludes both.

import Link from "next/link";
import { displayName, entityLabel, formatCount, formatDay, initials, placeLabel } from "@/lib/dashboard/facts";
import { marksFromTags, topTier } from "@/lib/dashboard/source-tiers";
import { Button } from "./controls";
import { SelectInput } from "./fields";
import { LogoTile, SourceMarks } from "./marks";
import { Cell, DataTable, EmptyState, ErrorNote, HeadCell, PageHeader } from "./page";
import { SaveRecordButton } from "./save-record-button";
import { Caption } from "./type";

export const SAVED_SORTS = [
  { value: "recent", label: "Recently saved" },
  { value: "receipts", label: "Most evidence" },
  { value: "name", label: "Name (A–Z)" },
] as const;

export type SavedSort = (typeof SAVED_SORTS)[number]["value"];

export type SavedListRow = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  source_tags: string[] | null;
  employees_total: number | null;
  saved_at: string;
};

/** `?sort=…&page=…`, dropping the defaults so page 1 of "recent" is plain `/app/saved`. */
export function savedHref(sort: SavedSort, page: number): string {
  const u = new URLSearchParams();
  if (sort !== "recent") u.set("sort", sort);
  if (page !== 1) u.set("page", String(page));
  const s = u.toString();
  return s ? `/app/saved?${s}` : "/app/saved";
}

export function SavedList({
  rows,
  total,
  page,
  pageSize,
  sort,
  failed,
}: {
  rows: readonly SavedListRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: SavedSort;
  failed: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = first + rows.length - 1;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Saved"
        caption={
          failed
            ? "Only you can see this list."
            : `${total.toLocaleString("en-GB")} saved ${total === 1 ? "supplier" : "suppliers"} · only you can see this list`
        }
        actions={
          <form method="get" className="flex items-center gap-2">
            <label htmlFor="saved-sort" className="text-sm font-medium text-ink-muted">
              Sort
            </label>
            <SelectInput id="saved-sort" name="sort" defaultValue={sort} className="w-auto">
              {SAVED_SORTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectInput>
            <Button type="submit">Apply</Button>
          </form>
        }
      />

      {failed ? (
        <ErrorNote>Could not load your saved suppliers. Nothing was removed; reload the page to try again.</ErrorNote>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-line-subtle bg-surface">
          {page > 1 ? (
            <EmptyState
              icon="bookmark"
              title="Nothing on this page"
              action={
                <Button href={savedHref(sort, 1)} clientNav>
                  Back to page 1
                </Button>
              }
            >
              Your saved list is shorter than this page number.
            </EmptyState>
          ) : (
            <EmptyState
              icon="bookmark"
              title="No saved suppliers yet"
              action={
                <Button variant="primary" href="/app/discover" clientNav>
                  Search suppliers
                </Button>
              }
            >
              Save a supplier from search or from its record, and it appears here.
            </EmptyState>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-line-subtle bg-surface">
          <DataTable label="Saved suppliers" minWidth="44rem">
            <thead>
              <tr>
                <HeadCell>Supplier</HeadCell>
                <HeadCell>Sources</HeadCell>
                <HeadCell className="text-right">Workers</HeadCell>
                <HeadCell>Saved on</HeadCell>
                <HeadCell>
                  <span className="sr-only">Actions</span>
                </HeadCell>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tags = r.source_tags ?? [];
                const name = displayName(r.company_name);
                const place = placeLabel(r.city, r.district);
                const href = `/app/suppliers/${r.slug}`;
                return (
                  <tr key={r.id}>
                    <th scope="row" className="h-11 border-b border-line-subtle px-4 py-2 text-left align-middle font-normal">
                      <div className="flex items-center gap-2.5">
                        <LogoTile initials={initials(name)} tier={topTier(tags)} size="sm" />
                        <div className="min-w-0">
                          <Link prefetch={false} href={href} className="font-medium text-ink-strong [overflow-wrap:anywhere] hover:text-brand-ink">
                            {name}
                          </Link>
                          <Caption className="block">{[entityLabel(r.entity_type), place].filter(Boolean).join(" · ")}</Caption>
                        </div>
                      </div>
                    </th>
                    <Cell>
                      {tags.length > 0 ? <SourceMarks marks={marksFromTags(tags)} sm /> : <span className="text-quiet-ink">None on file</span>}
                    </Cell>
                    <Cell className="text-right tabular-nums">
                      {formatCount(r.employees_total) ?? <span className="text-quiet-ink">—</span>}
                    </Cell>
                    <Cell className="whitespace-nowrap tabular-nums text-ink-muted">{formatDay(r.saved_at) ?? "—"}</Cell>
                    <Cell>
                      <span className="flex justify-end gap-1.5">
                        <SaveRecordButton supplierId={r.id} saved icon />
                        <Button href={href} clientNav className="h-7 px-2.5 text-xs" aria-label={`Open ${name}`}>
                          Open
                        </Button>
                      </span>
                    </Cell>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
          <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <Caption className="tabular-nums">
              {first}–{last} of {total.toLocaleString("en-GB")}
            </Caption>
            {totalPages > 1 ? (
              <span className="flex gap-2">
                <Button href={page > 1 ? savedHref(sort, page - 1) : undefined} disabled={page <= 1} clientNav>
                  Previous
                </Button>
                <Button href={page < totalPages ? savedHref(sort, page + 1) : undefined} disabled={page >= totalPages} clientNav>
                  Next
                </Button>
              </span>
            ) : null}
          </nav>
        </div>
      )}
    </div>
  );
}
