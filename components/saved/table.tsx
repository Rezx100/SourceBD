"use client";

// The saved suppliers on a desktop (Paper `10 · Saved · 3 selected for one RFQ`): the results
// table's columns and widths exactly (select, Supplier, Type, Location, Workers, Sources,
// Certificates; the critique of 7 Oct 2026: Saved was a second, slightly different table of the
// same entity, with Workers wrapping "Not published" at 100px), then Saved on and a menu. A
// real <table>; the name opens the record in the pane, arrows move the row, Enter opens, Space
// ticks (the results' keys). Ticking turns the bar above into the ink bulk bar: Remove from saved
// and one RFQ to everyone ticked. Client: it reads the selection and handles the keys.

import { DotsThree, PaperPlaneTilt } from "@phosphor-icons/react";
import Link from "next/link";
import { ABSENT, CertSummaryCell, SupplierRow } from "@/components/patterns";
import { BulkBar, Checkbox, IconButton, Menu, MenuItem, SelectCell, Table, Td, Th, Tr, Unpublished, bulkActionClass, oneLine, rowLinkClass } from "@/components/kit";
import { onRowKey } from "@/components/search/keys";
import { SELECT_ALL_ID, useSelection } from "@/components/search/selection";
import { splitQualifier } from "@/lib/dashboard/facts";
import { SEND_RFQ_MAX, clearKeepingFocus, rfqHref } from "@/lib/dashboard/selection";
import { cn } from "@/lib/utils";
import { useRemove } from "./actions";
import { TOO_MANY, type CertCell, type SavedItem } from "./words";

/** The certificate cell: the same compact cell the results draw, nothing to check, or that it could not be read. */
export function CertCellView({ cell }: { cell: CertCell }) {
  if (cell.kind === "line") return <CertSummaryCell cert={cell.summary} />;
  // A failed read is a sentence, not an absence: the lists were not read, so nothing is claimed.
  if (cell.kind === "unread") return <span className="text-sm text-ink-3">{ABSENT.unread}</span>;
  return <Unpublished>{ABSENT.toCheck}</Unpublished>;
}

export function SavedTable({ items, currentSlug }: { items: readonly SavedItem[]; currentSlug?: string | null }) {
  const sel = useSelection();
  return (
    // Full-bleed like the results table (critique of 8 Oct 2026, item 4): the two tables are one grammar, no frame around this one.
    <div role="region" aria-label="Saved suppliers table" className="relative min-w-0 overflow-x-auto">
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
            <Th className="w-80">Supplier</Th>
            <Th className="w-[120px]">Type</Th>
            <Th className="w-[140px]">Location</Th>
            <Th align="right" className="w-[110px]">
              Workers
            </Th>
            <Th align="right" className="w-[90px]">
              Sources
            </Th>
            <Th>Certificates</Th>
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
            const { base, qualifier } = splitQualifier(i.name);
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
                <Td className="max-w-0">
                  <Link href={i.paneHref} prefetch={false} scroll={false} data-open="record" data-name="" title={i.name} className={cn(rowLinkClass, oneLine)}>
                    {base}
                  </Link>
                  {qualifier ? (
                    <span data-name="" title={qualifier} className={cn(oneLine, "text-xs text-ink-3")}>
                      {qualifier}
                    </span>
                  ) : null}
                </Td>
                <Td>{i.type}</Td>
                <Td>{i.place ?? <Unpublished />}</Td>
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
                {/* The 24px marks in a 40 row: 6 above and below, not the cell's 8. */}
                <Td className="py-1.5">
                  <CertCellView cell={i.cert} />
                </Td>
                <Td className="whitespace-nowrap tabular-nums">{i.savedOn ?? <Unpublished>{ABSENT.dated}</Unpublished>}</Td>
                <td className="w-10 border-b border-line p-0 text-center align-middle">
                  <SavedRowMenu item={i} />
                </td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

/** A saved row's ⋯ menu: the results' row menu, word for word (Save is what this list is), then this list's own action. */
export function SavedRowMenu({ item: i }: { item: SavedItem }) {
  const { remove } = useRemove();
  return (
    <Menu align="end" trigger={<IconButton icon={DotsThree} label={`More actions for ${i.name}`} kind="quiet" />}>
      <MenuItem href={i.rfqHref}>Send RFQ</MenuItem>
      <MenuItem href={i.pageHref}>Open full page</MenuItem>
      <MenuItem onSelect={() => void remove([{ id: i.id, name: i.name }])}>Remove from saved</MenuItem>
    </Menu>
  );
}

/** Beside a pane: the table's tick, keys and ⋯ menu on the narrow rows (critique of 8 Oct 2026, round 3, item 2). */
export function SavedPaneRows({ items, currentSlug }: { items: readonly SavedItem[]; currentSlug: string | null }) {
  const sel = useSelection();
  return (
    <ul onKeyDown={onRowKey} data-follow={currentSlug != null ? "record" : undefined}>
      {items.map((i) => {
        const ticked = sel.interactive && sel.isSelected(i.id);
        return (
          <li key={i.id} data-row="result" tabIndex={0} className="outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus">
            <SupplierRow
              layout="pane"
              href={i.paneHref}
              name={i.name}
              type={i.type}
              place={i.place}
              sources={i.sources}
              problem={<CertCellView cell={i.cert} />}
              selected={i.slug === currentSlug}
              ticked={ticked}
              select={<Checkbox aria-label={`Select ${i.name}`} checked={ticked} disabled={!sel.interactive} onChange={() => sel.toggle(i.id)} />}
              actions={<SavedRowMenu item={i} />}
            />
          </li>
        );
      })}
    </ul>
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
            <Link href={rfqHref(chosen[0]!.listHref, chosen.map((c) => c.id))} scroll={false} className={cn(bulkActionClass(true), "gap-1.5")}>
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
