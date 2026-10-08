"use client";

// The saved suppliers on a desktop (Paper `10 · Saved · 3 selected for one RFQ`): select, Supplier,
// Type and district, Workers, Sources, the first certificate to check, Saved on, and a menu. A
// real <table>; the name opens the record in the pane, arrows move the row, Enter opens, Space
// ticks (the results' keys). Ticking turns the bar above into the ink bulk bar: Remove from saved
// and one RFQ to everyone ticked. Client: it reads the selection and handles the keys.

import { DotsThree, PaperPlaneTilt } from "@phosphor-icons/react";
import Link from "next/link";
import { CertProblem } from "@/components/patterns";
import { BulkBar, IconButton, Menu, MenuItem, SelectCell, Table, Td, Th, Tr, Unpublished, bulkActionClass, rowLinkClass } from "@/components/kit";
import { onRowKey } from "@/components/search/keys";
import { SELECT_ALL_ID, useSelection } from "@/components/search/selection";
import { SEND_RFQ_MAX, clearKeepingFocus } from "@/lib/dashboard/selection";
import { cn } from "@/lib/utils";
import { useRemove } from "./actions";
import { TOO_MANY, rfqHref, typeAndPlace, type CertCell, type SavedItem } from "./words";

/** The certificate cell: the worst certificate to check, nothing to check, or that it could not be read. */
export function CertCellView({ cell, small }: { cell: CertCell; small?: boolean }) {
  if (cell.kind === "line")
    return (
      <CertProblem state={cell.line.state} more={cell.line.more} small={small}>
        {cell.line.text}
      </CertProblem>
    );
  return <Unpublished>{cell.kind === "clear" ? "Nothing to check" : "Not read just now"}</Unpublished>;
}

export function SavedTable({ items, currentSlug }: { items: readonly SavedItem[]; currentSlug?: string | null }) {
  const sel = useSelection();
  const { remove } = useRemove();
  return (
    <div role="region" aria-label="Saved suppliers table" tabIndex={0} className="relative min-w-0 overflow-x-auto rounded-md border border-line outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus">
      <Table className="min-w-[960px]">
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
            <Th className="w-[330px]">Supplier</Th>
            <Th className="w-[150px]">Type and district</Th>
            <Th align="right" className="w-[100px]">
              Workers
            </Th>
            <Th align="right" className="w-[84px]">
              Sources
            </Th>
            <Th>First certificate to check</Th>
            <Th className="w-[120px]">Saved on</Th>
            <th scope="col" className="sticky top-0 z-raised h-row-head w-10 border-b border-line bg-subtle p-0">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody onKeyDown={onRowKey}>
          {items.map((i) => {
            const selected = sel.interactive && sel.isSelected(i.id);
            const current = currentSlug != null && i.slug === currentSlug;
            return (
              <Tr
                key={i.id}
                data-row="result"
                tabIndex={0}
                aria-label={i.name}
                aria-current={current ? "true" : undefined}
                selected={selected || current}
                className="outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
              >
                <SelectCell label={`Select ${i.name}`} checked={selected} disabled={!sel.interactive} onChange={() => sel.toggle(i.id)} />
                <Td>
                  <Link href={i.paneHref} prefetch={false} scroll={false} data-open="record" className={rowLinkClass}>
                    {i.name}
                  </Link>
                </Td>
                <Td>{typeAndPlace(i)}</Td>
                <Td align="right" className="tabular-nums text-ink">
                  {i.workers ?? <Unpublished />}
                  {i.workersSecond ? (
                    <span title={i.workersSecond.words} className="block text-xs text-ink-3">
                      {i.workersSecond.short}
                    </span>
                  ) : null}
                </Td>
                <Td align="right" className="tabular-nums text-ink">
                  {i.sources}
                </Td>
                <Td>
                  <CertCellView cell={i.cert} />
                </Td>
                <Td className="whitespace-nowrap tabular-nums">{i.savedOn ?? <Unpublished>Not dated</Unpublished>}</Td>
                <td className="w-10 border-b border-line p-0 text-center align-middle">
                  <Menu
                    align="end"
                    trigger={<IconButton icon={DotsThree} label={`More actions for ${i.name}`} kind="quiet" />}
                  >
                    <MenuItem href={i.pageHref}>Open full record</MenuItem>
                    <MenuItem href={rfqHref([i.id])}>Send an RFQ</MenuItem>
                    <MenuItem onSelect={() => void remove([{ id: i.id, name: i.name }])}>Remove from saved</MenuItem>
                  </Menu>
                </td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

/** The ink bar over the table while something is ticked: the count, Clear, Remove from saved, one RFQ. */
export function SavedBar({ items }: { items: readonly SavedItem[] }) {
  const sel = useSelection();
  const { remove, busy, error } = useRemove();
  const chosen = items.filter((i) => sel.isSelected(i.id));
  const count = chosen.length;
  if (!sel.interactive) return null;
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {count > 0 ? `${count} selected. Bulk actions are above the table.` : ""}
      </p>
      {count > 0 ? (
        <BulkBar
          summary={`${count} ${count === 1 ? "supplier" : "suppliers"} selected`}
          selectAll={
            <button
              type="button"
              onClick={() => clearKeepingFocus(document.getElementById(SELECT_ALL_ID), sel.clear)}
              className="rounded-sm text-surface underline decoration-1 [text-underline-position:from-font] outline-none hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface"
            >
              Clear
            </button>
          }
          clear={null}
        >
          <button
            type="button"
            aria-busy={busy || undefined}
            onClick={async () => {
              const done = await remove(chosen.map((c) => ({ id: c.id, name: c.name })));
              if (done) sel.clear();
            }}
            className={bulkActionClass()}
          >
            Remove from saved
          </button>
          {count <= SEND_RFQ_MAX ? (
            <Link href={rfqHref(chosen.map((c) => c.id))} className={cn(bulkActionClass(true), "gap-1.5")}>
              <PaperPlaneTilt size={16} aria-hidden />
              Send one RFQ to {count} {count === 1 ? "supplier" : "suppliers"}
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(bulkActionClass(true), "cursor-not-allowed gap-1.5 text-disabled")}>
              <PaperPlaneTilt size={16} aria-hidden />
              Send one RFQ to {count} suppliers
            </span>
          )}
        </BulkBar>
      ) : null}
      {count > SEND_RFQ_MAX ? <p className="pt-1.5 text-xs text-caution">{TOO_MANY}</p> : null}
      {error ? (
        <p role="alert" className="pt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}
