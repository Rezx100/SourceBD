// The Saved pages in the dashboard kit. Server components; the pages read the
// rows and pass them in.
//
// `SavedList` (/app/saved): title and count, a sort that applies on choice,
// one table whose names open the record in the pane beside the list
// (`?open=<slug>`), a "1–24 of 57" footer. `SavedSearchesTable`
// (/app/searches): each saved search with how many suppliers it found and
// when that was counted, and a Delete that asks first.
//
// SBI and contact PII never reach this file: the RPC's RETURNS excludes both.

import Link from "next/link";
import type { ReactNode } from "react";
import { discoverWorkers, workersSecondShort } from "@/lib/dashboard/build-discover-row";
import { displayName, entityLabel, formatCount, formatDay, formatRelative, initials, placeLabel, splitQualifier } from "@/lib/dashboard/facts";
import type { WorkersBasis } from "@/lib/enrich-discover-workers";
import { marksFromTags, topTier } from "@/lib/dashboard/source-tiers";
import type { SavedSearchJson } from "@/lib/saved-searches";
import { Button } from "./controls";
import { LogoTile, SourceMarks } from "./marks";
import { Cell, DataTable, EmptyState, ErrorNote, HeadCell, PageHeader, rowClass } from "./page";
import { DeleteSavedSearch, SavedSort } from "./saved-controls";
import { SaveRecordButton } from "./save-record-button";
import { Caption, OneLine } from "./type";
import { WorkersCell } from "./workers-cell";

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
  /** From `enrichDiscoverWorkers`: the record's own figure, before the profile's replaced `employees_total`. */
  workers_own?: number | null;
  workers_basis?: WorkersBasis;
  workers_source?: "RSC" | "registry";
};

/** How many source marks a row draws before "+N", as the results table does. */
const MARKS_SHOWN = 5;

/** `?sort=…&page=…&open=…`, dropping the defaults so page 1 of "recent" with nothing open is plain `/app/saved`. */
export function savedHref(sort: SavedSort, page: number, open?: string | null): string {
  const u = new URLSearchParams();
  if (sort !== "recent") u.set("sort", sort);
  if (page !== 1) u.set("page", String(page));
  if (open) u.set("open", open);
  const s = u.toString();
  return s ? `/app/saved?${s}` : "/app/saved";
}

/** The Sources cell: the marks on one line, five at most, and "+N" for the rest. */
export function SourcesCell({ tags }: { tags: readonly string[] }) {
  if (tags.length === 0) return <span className="text-quiet-ink">None on file</span>;
  const marks = marksFromTags(tags);
  return (
    <span className="inline-flex flex-nowrap items-center gap-1.5">
      <SourceMarks marks={marks.slice(0, MARKS_SHOWN)} caption="none" sm className="flex-nowrap gap-0.5" />
      {marks.length > MARKS_SHOWN ? <span className="text-xs text-ink-subtle">+{marks.length - MARKS_SHOWN}</span> : null}
    </span>
  );
}

export function SavedList({
  rows,
  total,
  page,
  pageSize,
  sort,
  failed,
  openSlug = null,
  desk,
}: {
  rows: readonly SavedListRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: SavedSort;
  failed: boolean;
  /** The record open in the pane beside the list; its row is marked. */
  openSlug?: string | null;
  /** The certificate alerts and recent activity on these suppliers (`SavedDesk`), above the list. */
  desk?: ReactNode;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = first + rows.length - 1;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Saved"
        caption={
          failed
            ? "Only you can see this list."
            : `${formatCount(total)} saved ${total === 1 ? "supplier" : "suppliers"} · only you can see this list`
        }
        actions={<SavedSort sort={sort} options={SAVED_SORTS} />}
      />

      {desk}

      {failed ? (
        <ErrorNote>Could not load your saved suppliers. Nothing was removed; reload the page to try again.</ErrorNote>
      ) : rows.length === 0 ? (
        <div className="rounded-md bg-surface">
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
              art="saved"
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
        <div className="rounded-md bg-surface">
          <DataTable label="Saved suppliers" minWidth="40rem">
            <thead>
              <tr>
                <HeadCell>Supplier</HeadCell>
                <HeadCell>Sources</HeadCell>
                <HeadCell align="right">Workers</HeadCell>
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
                const split = splitQualifier(name);
                const place = placeLabel(r.city, r.district);
                const open = r.slug === openSlug;
                const w = discoverWorkers({
                  employees_total: r.employees_total,
                  workers_own: r.workers_own,
                  workers_basis: r.workers_basis,
                  workers_source: r.workers_source,
                });
                return (
                  <tr key={r.id} className={rowClass({ current: open })}>
                    <th scope="row" className="h-11 border-b border-line-subtle px-4 py-2 text-left align-middle font-normal">
                      <div className="flex items-center gap-2.5">
                        <LogoTile initials={initials(name)} tier={topTier(tags)} size="sm" />
                        <div className="min-w-0 flex-1">
                          {/* The name opens the record beside the list; the list, its sort and its page stay put.
                              Two lines, each cut to one (the One-Line Name Rule). */}
                          <Link
                            prefetch={false}
                            scroll={false}
                            href={savedHref(sort, page, r.slug)}
                            aria-current={open ? "true" : undefined}
                            aria-label={split.qualifier ? name : undefined}
                            className="block min-w-0 font-medium text-ink-strong hover:text-brand-ink"
                          >
                            <OneLine text={split.base} title={name} />
                          </Link>
                          <OneLine text={[split.qualifier, entityLabel(r.entity_type), place].filter(Boolean).join(" · ")} className="text-xs text-ink-subtle" />
                        </div>
                      </div>
                    </th>
                    <Cell>
                      <SourcesCell tags={tags} />
                    </Cell>
                    <Cell align="right">
                      {/* The same two figures, in the same words, as the search's
                          ledger: Saved used to print the profile's figure alone
                          and read 5,195 where the search read 2,030. */}
                      <WorkersCell own={w.own} ownWords={w.ownLabel} second={workersSecondShort(w)} />
                    </Cell>
                    <Cell className="whitespace-nowrap tabular-nums text-ink-muted">{formatDay(r.saved_at) ?? "—"}</Cell>
                    <Cell className="text-right">
                      <SaveRecordButton supplierId={r.id} saved icon />
                    </Cell>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
          <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <Caption className="tabular-nums">
              {first}–{last} of {formatCount(total)}
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

/** "counted 2h ago", from `formatRelative` — or that the search has not been counted. */
export function countedCaption(countedAt: string | null, now: Date): string {
  const when = formatRelative(countedAt, now);
  return when ? `counted ${when}` : "not counted yet";
}

/**
 * The saved searches as a kit table: Name (opens the search), Suppliers (the
 * remembered count and when it was taken — most are not live), Saved on, and
 * Delete. Empty is the illustrated state that says where saving happens.
 */
export function SavedSearchesTable({ searches, now }: { searches: readonly SavedSearchJson[]; now: Date }) {
  if (searches.length === 0) {
    return (
      <div className="rounded-md bg-surface">
        <EmptyState
          art="saved"
          title="No saved searches yet"
          action={
            <Button variant="primary" href="/app/discover" clientNav>
              Search suppliers
            </Button>
          }
        >
          Save a search from the results panel and it appears here, with how many suppliers it finds.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="rounded-md bg-surface">
      <DataTable label="Saved searches" minWidth="36rem">
        <thead>
          <tr>
            <HeadCell>Name</HeadCell>
            <HeadCell align="right">Suppliers</HeadCell>
            <HeadCell>Saved on</HeadCell>
            <HeadCell>
              <span className="sr-only">Actions</span>
            </HeadCell>
          </tr>
        </thead>
        <tbody className="[&>tr:last-child>*]:border-b-0">
          {searches.map((s) => (
            <tr key={s.id} className={rowClass()}>
              <th scope="row" className="h-11 border-b border-line-subtle px-4 py-2 text-left align-middle font-normal">
                <Link prefetch={false} href={s.href} className="font-medium text-ink-strong [overflow-wrap:anywhere] hover:text-brand-ink">
                  {s.name || "Untitled search"}
                </Link>
              </th>
              <Cell align="right" className="whitespace-nowrap">
                {s.last_count === null ? (
                  <span className="text-quiet-ink">—</span>
                ) : (
                  <span className="font-medium text-ink-strong">{formatCount(s.last_count)}</span>
                )}
                <Caption className="block">{countedCaption(s.last_count === null ? null : s.last_counted_at, now)}</Caption>
              </Cell>
              <Cell className="whitespace-nowrap tabular-nums text-ink-muted">{formatDay(s.created_at) ?? "—"}</Cell>
              <Cell className="text-right">
                <DeleteSavedSearch id={s.id} name={s.name || "Untitled search"} />
              </Cell>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
