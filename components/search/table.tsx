"use client";

// The results table (Paper `10 · Results table`): select, Supplier, Type, Location, Workers,
// Sources, then the first certificate problem. A real <table>, head 36 and sticky, rows 40
// (they grow when a name wraps: nothing is cut off). The name opens the record in the pane;
// arrows move between rows, Enter opens, Space ticks. Hover is brand-wash, a ticked row
// brand-tint with the 2px bar. Client: it reads the selection and handles the keys.

import Link from "next/link";
import { CertProblem, LinkPending, SanctionTag, sanctionRowClass } from "@/components/patterns";
import { SelectCell, Table, Td, Th, Tr, Unpublished, rowLinkClass, type SortState } from "@/components/kit";
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
  return (
    <div role="region" aria-label="Results table" tabIndex={0} className="relative min-w-0 overflow-x-auto outline-none xl:overflow-visible focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand">
      <Table className="min-w-[860px]">
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
          </tr>
        </thead>
        <tbody onKeyDown={onRowKey}>
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
                className={cn("outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand", r.sanctioned && !selected && !current && sanctionRowClass)}
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
                <Td>
                  {r.cert ? (
                    <CertProblem state={r.cert.state} more={r.cert.more}>
                      {r.cert.text}
                    </CertProblem>
                  ) : (
                    <Unpublished>No certificates found</Unpublished>
                  )}
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
