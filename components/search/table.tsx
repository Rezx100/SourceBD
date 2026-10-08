"use client";

// The results table (Paper `10 · Results table`): select, Supplier, Type, Location, Workers,
// Sources, then the certificates as marks and the worst one's state. A real <table>, head 36 and sticky, rows 40
// (they grow when a name wraps: nothing is cut off). The name opens the record in the pane;
// arrows move between rows, Enter opens, Space ticks. Hover is brand-wash, a ticked row
// brand-tint with the 2px bar. Every row ends in the ⋯ menu Saved's rows have (Save, Send RFQ,
// Open full page), so the two tables share one grammar. Client: it reads the selection and handles the keys.

import { DotsThree } from "@phosphor-icons/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import Link from "next/link";
import { startTransition, useContext, useEffect, useState } from "react";
import { ABSENT, CertSummaryCell, LinkPending, SanctionTag, sanctionRowClass } from "@/components/patterns";
import { IconButton, Menu, MenuItem, SelectCell, Table, Td, Th, Toast, Tr, Unpublished, rowLinkClass, toastActionClass, type SortState } from "@/components/kit";
import { rowSaveMessage } from "@/lib/dashboard/selection";
import { cn } from "@/lib/utils";
import { onRowKey } from "./keys";
import type { ResultRow } from "./model";
import { SELECT_ALL_ID, useSelection } from "./selection";

export type ResultSort = { key: "workers" | "sources" | string; dir: "asc" | "desc" };

export function ResultsTable({
  rows,
  currentSlug,
  sort,
  sortHrefs,
}: {
  rows: readonly ResultRow[];
  /** The record open beside the results, so its row is marked. */
  currentSlug?: string | null;
  sort: ResultSort;
  /** The page sorted by Workers and by Sources: strings, since this is a client component and the page a server one. */
  sortHrefs: { workers: string; sources: string };
}) {
  const sel = useSelection();
  const state = (key: "workers" | "sources"): SortState => (sort.key === key ? sort.dir : "none");
  // Save from a row's menu: the record's Save behaviour (one request, a toast, a background refresh).
  const router = useContext(AppRouterContext);
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  async function save(id: string) {
    try {
      const res = await fetch("/api/v1/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplier_id: id }) });
      setToast(res.ok ? "Saved to your list" : rowSaveMessage(res.status, true));
      if (res.ok) startTransition(() => router?.refresh());
    } catch {
      setToast(rowSaveMessage("network", true));
    }
  }
  return (
    <div role="region" aria-label="Results table" tabIndex={0} className="relative min-w-0 overflow-x-auto outline-none xl:overflow-visible focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus">
      <Table className="min-w-[900px]">
        <thead>
          <tr>
            <SelectCell
              header
              id={sel.interactive ? SELECT_ALL_ID : undefined}
              label="Select all on this page"
              checked={sel.interactive && sel.allState === true}
              mixed={sel.interactive && sel.allState === "mixed"}
              disabled={!sel.interactive}
              onChange={sel.toggleAllOnPage}
            />
            <Th className="w-80">Supplier</Th>
            <Th className="w-[120px]">Type</Th>
            <Th className="w-[140px]">Location</Th>
            <Th align="right" className="w-[110px]" sort={state("workers")} href={sortHrefs.workers}>
              Workers
            </Th>
            <Th align="right" className="w-[90px]" sort={state("sources")} href={sortHrefs.sources}>
              Sources
            </Th>
            <Th>Certificates</Th>
            <th scope="col" className="sticky top-0 z-raised h-row-head w-10 border-b border-line bg-subtle p-0">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        {/* With a record open beside the list the arrows change it (`data-follow`); without one they move focus. */}
        <tbody onKeyDown={onRowKey} data-follow={currentSlug != null ? "record" : undefined}>
          {rows.map((r) => {
            const selectable = sel.interactive && Boolean(r.supplierId);
            const selected = selectable && sel.isSelected(r.supplierId!);
            const current = currentSlug != null && r.slug === currentSlug;
            return (
              <Tr
                key={r.slug}
                data-row="result"
                tabIndex={0}
                aria-label={r.name}
                aria-current={current ? "true" : undefined}
                selected={selected || current}
                className={cn("outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus", r.sanctioned && !selected && !current && sanctionRowClass)}
              >
                <SelectCell
                  label={`Select ${r.name}`}
                  checked={selected}
                  disabled={!selectable}
                  onChange={selectable ? () => sel.toggle(r.supplierId!) : () => {}}
                />
                <Td>
                  <Link href={r.paneHref} prefetch={false} scroll={false} data-open="record" className={rowLinkClass}>
                    {r.name}
                    <LinkPending className="ml-1.5 inline-block align-[-2px]" />
                  </Link>
                  {r.sanctioned ? (
                    <div className="pt-0.5">
                      <SanctionTag list="sanctions list" />
                    </div>
                  ) : null}
                </Td>
                <Td>{r.type}</Td>
                <Td>{r.place ?? <Unpublished />}</Td>
                <Td align="right" className="tabular-nums text-ink">
                  {r.workers ?? <Unpublished />}
                  {r.workersSecond ? (
                    <span title={r.workersSecond.words} className="block text-xs text-ink-3">
                      {r.workersSecond.short}
                    </span>
                  ) : null}
                </Td>
                <Td align="right" className="tabular-nums text-ink">
                  {r.sources}
                </Td>
                {/* The 24px marks in a 40 row: 6 above and below, not the cell's 8. */}
                <Td className="py-1.5">
                  {r.certCell ? (
                    <CertSummaryCell cert={r.certCell} />
                  ) : (
                    <Unpublished>{ABSENT.certificates}</Unpublished>
                  )}
                </Td>
                <td className="w-10 border-b border-line p-0 text-center align-middle">
                  <Menu align="end" trigger={<IconButton icon={DotsThree} label={`More actions for ${r.name}`} kind="quiet" />}>
                    {r.supplierId ? (
                      <MenuItem hint="S" onSelect={() => void save(r.supplierId!)}>
                        Save
                      </MenuItem>
                    ) : null}
                    {r.supplierId && !r.sanctioned ? (
                      <MenuItem hint="R" href={`/app/rfqs/new?supplier=${encodeURIComponent(r.supplierId)}`}>
                        Send RFQ
                      </MenuItem>
                    ) : null}
                    <MenuItem href={r.pageHref}>Open full page</MenuItem>
                  </Menu>
                  {/* The same two actions for the keyboard (s, r): drawn nowhere, out of the tab order, driven by `onRowKey`. */}
                  {r.supplierId ? <button type="button" data-action="save" tabIndex={-1} aria-hidden className="hidden" onClick={() => void save(r.supplierId!)} /> : null}
                  {r.supplierId && !r.sanctioned ? <Link href={`/app/rfqs/new?supplier=${encodeURIComponent(r.supplierId)}`} prefetch={false} data-action="rfq" tabIndex={-1} aria-hidden className="hidden" /> : null}
                </td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-toast flex justify-center px-4">
          <Toast
            tone="brand"
            className="pointer-events-auto"
            action={
              toast === "Saved to your list" ? (
                <Link href="/app/saved" prefetch={false} className={toastActionClass}>
                  View saved
                </Link>
              ) : undefined
            }
          >
            {toast}
          </Toast>
        </div>
      ) : null}
    </div>
  );
}
