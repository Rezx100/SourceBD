"use client";

// The results table with no record open (Paper page 37, board 07b): select, Supplier with the two
// products that answer the search under its name, Location, Workers, the brands whose supplier lists
// name it, what it exported in two years and where to, then the certificates it holds today as marks.
// A real <table>, head 36 and sticky, rows 64. The column heads carry the words, the rows only values,
// and an empty cell is a dash. Type and Sources are not columns (founder, 12 Oct 2026): the type is on
// the record and the source count still orders the list from the Sort menu.
// A name is one line (the One-Line Name Rule): the base name cut at the end with the whole name in
// `title` and the row's accessible name, its qualifier (a shed, a building, a group) on the line
// under. The name opens the record in the pane;
// arrows move between rows, Enter opens, Space ticks. Hover is brand-wash, a ticked row
// brand-tint with the 2px bar. Every row ends in the ⋯ menu Saved's rows have (Save, Send RFQ,
// Open full page), so the two tables share one grammar. Client: it reads the selection and handles the keys.

import { DotsThree } from "@phosphor-icons/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import Link from "next/link";
import { startTransition, useContext, useEffect, useState, type ReactNode } from "react";
import { ABSENT, LinkPending, SanctionTag, sanctionRowClass } from "@/components/patterns";
import { Define, IconButton, Menu, MenuItem, SelectCell, Table, Td, Th, Toast, Tr, Unpublished, oneLine, rowLinkClass, toastActionClass, type SortState } from "@/components/kit";
import { splitQualifier } from "@/lib/dashboard/facts";
import { define } from "@/lib/dashboard/glossary";
import { rowSaveMessage } from "@/lib/dashboard/selection";
import { cn } from "@/lib/utils";
import { onRowKey } from "./keys";
import type { ResultRow } from "./model";
import { ExportedLocked, HeldMarks, Products, ShipsTo } from "./row-parts";
import { SELECT_ALL_ID, useSelection } from "./selection";

/** What the exports column's figures are, said on its head. */
export const EXPORTED_TITLE = "From customs records of the last two years on file: the export value, then the markets it ships to, biggest share first";

/** "793 RSC": the figure, then its source as a defined term when the glossary holds it. */
export function SecondFigure({ short }: { short: string }) {
  const m = /^(.*\S)\s+(\S+)$/.exec(short);
  if (!m || !define(m[2]!)) return <>{short}</>;
  return (
    <>
      {`${m[1]} `}
      <Define term={m[2]!} />
    </>
  );
}

/**
 * The visible base name, with the whole name for a screen reader when they differ: the row has no
 * `aria-label` (it silenced the cells), so the name link carries the whole name (round 3, item 6).
 */
export function WholeName({ name, base }: { name: string; base: string }) {
  if (base === name) return <>{base}</>;
  return (
    <>
      <span aria-hidden="true">{base}</span>
      <span className="sr-only">{name}</span>
    </>
  );
}

export type ResultSort = { key: "workers" | "sources" | string; dir: "asc" | "desc" };

export function ResultsTable({
  rows,
  currentSlug,
  sort,
  sortHrefs,
  exportsHead,
}: {
  rows: readonly ResultRow[];
  /** The exports view (an exports filter or sort is on): its column's head ("Average shipment") and the sorted figure, in the exports column. */
  exportsHead?: string | null;
  /** The record open beside the results, so its row is marked. */
  currentSlug?: string | null;
  sort: ResultSort;
  /** The page sorted by each column that sorts: strings, since this is a client component and the page a server one. */
  sortHrefs: { workers: string; name?: string };
}) {
  const sel = useSelection();
  // A column sorts from its head when its cells show what it sorts by: the name and the workers. The source count and
  // the soonest certificate expiry order the list from the Sort menu, which names them.
  const state = (key: "workers" | "name"): SortState => (sort.key === key ? sort.dir : "none");
  const { save, toast } = useRowSave();
  // Not a tab stop (critique of 8 Oct 2026, item 7: two Tabs before the first name): the rows are.
  return (
    <div role="region" aria-label="Results table" className="relative min-w-0 overflow-x-auto xl:overflow-visible">
      <Table className="min-w-[980px]">
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
            <Th sort={sortHrefs.name ? state("name") : undefined} href={sortHrefs.name}>
              Supplier
            </Th>
            <Th className="w-[130px]">Location</Th>
            <Th align="right" className="w-24" sort={state("workers")} href={sortHrefs.workers}>
              Workers
            </Th>
            <Th className="w-[150px]" title="The brands whose own published supplier lists name this company">
              On the supplier list of
            </Th>
            {exportsHead ? (
              <Th className="w-[250px]" title="Export shipment records, Sep 2024 – Aug 2026">
                {exportsHead}
              </Th>
            ) : (
              <Th className="w-[250px]" title={EXPORTED_TITLE}>
                Exported in 2 years · ships to
              </Th>
            )}
            <Th className="w-[110px]" title="Certificates held today">
              Certificates
            </Th>
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
            const { base, qualifier } = splitQualifier(r.name);
            return (
              <Tr
                key={r.slug}
                data-row="result"
                tabIndex={0}
                aria-current={current ? "true" : undefined}
                selected={selected || current}
                className={cn("h-16 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus", r.sanctioned && !selected && !current && sanctionRowClass)}
              >
                <SelectCell
                  label={`Select ${r.name}`}
                  checked={selected}
                  disabled={!selectable}
                  onChange={selectable ? () => sel.toggle(r.supplierId!) : () => {}}
                />
                {/* `max-w-0`: the column keeps the header's width and the name is cut inside it, instead of the cell growing to the name. */}
                <Td className="max-w-0">
                  <Link href={r.paneHref} prefetch={false} scroll={false} data-open="record" data-name="" title={r.name} className={cn(rowLinkClass, oneLine, "text-[15px]/[20px] font-semibold")}>
                    <WholeName name={r.name} base={base} />
                    <LinkPending className="ml-1.5 inline-block align-[-2px]" />
                  </Link>
                  {qualifier ? (
                    <span data-name="" title={qualifier} className={cn(oneLine, "text-xs text-ink-3")}>
                      {qualifier}
                    </span>
                  ) : null}
                  {/* What it makes, the search's matches first: the reason to open the row. "Factory" goes unsaid; anything else is said first. */}
                  {r.products || r.type !== "Factory" ? (
                    <span className="flex items-baseline gap-x-[5px] pt-0.5">
                      {r.type !== "Factory" ? <span className="shrink-0 whitespace-nowrap text-sm text-ink-3">{r.products ? `${r.type} ·` : r.type}</span> : null}
                      {r.products ? <Products products={r.products} /> : null}
                    </span>
                  ) : null}
                  {r.sanctioned ? (
                    <div className="pt-0.5">
                      <SanctionTag list="sanctions list" />
                    </div>
                  ) : null}
                </Td>
                <Td className="text-ink">{r.place ?? <Unpublished />}</Td>
                <Td align="right" className="tabular-nums text-ink">
                  {r.workers ?? <Unpublished />}
                  {r.workersSecond ? (
                    <span title={r.workersSecond.words} className="block text-xs text-ink-3">
                      <SecondFigure short={r.workersSecond.short} />
                    </span>
                  ) : null}
                </Td>
                <Td className="text-ink">{r.brands?.length ? r.brands.join(", ") : <Unpublished>On none of the brand lists read</Unpublished>}</Td>
                <Td className="tabular-nums text-ink">
                  {exportsHead ? (
                    r.exports ? (
                      <>
                        {r.exports.key}
                        <span className="block text-xs text-ink-3">{r.exports.detail}</span>
                      </>
                    ) : null
                  ) : r.exported === "locked" ? (
                    <ExportedLocked />
                  ) : r.exported ? (
                    <span className="flex items-center gap-2">
                      {r.exported.value ? <span className="w-[76px] shrink-0 text-[15px]/[20px] font-medium">{r.exported.value}</span> : null}
                      <ShipsTo to={r.exported.to} />
                    </span>
                  ) : r.exported === null ? (
                    <Unpublished>No customs records on file</Unpublished>
                  ) : (
                    // Never read (or the read failed): the dash says that, never that there are none.
                    <Unpublished>{ABSENT.unread}</Unpublished>
                  )}
                </Td>
                <Td>{r.held?.length ? <HeldMarks held={r.held} /> : <Unpublished>{ABSENT.certificates}</Unpublished>}</Td>
                <td className="w-10 border-b border-line p-0 text-center align-middle">
                  <RowActions r={r} save={save} />
                </td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      {toast}
    </div>
  );
}

/** Save from a row's menu: the record's Save behaviour (one request, a toast, a background refresh). Shared by the table and the pane list. */
export function useRowSave(): { save: (id: string) => Promise<void>; toast: ReactNode } {
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
  return {
    save,
    toast: toast ? (
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
    ) : null,
  };
}

/** A row's ⋯ menu (Save, Send RFQ, Open full page) and the same two actions for the keyboard; the table and the pane list draw the same. */
export function RowActions({ r, save }: { r: ResultRow; save: (id: string) => void | Promise<void> }) {
  return (
    <>
      <Menu align="end" trigger={<IconButton icon={DotsThree} label={`More actions for ${r.name}`} kind="quiet" />}>
        {r.supplierId ? (
          <MenuItem hint="S" onSelect={() => void save(r.supplierId!)}>
            Save
          </MenuItem>
        ) : null}
        {r.rfqHref ? (
          <MenuItem hint="R" href={r.rfqHref}>
            Send RFQ
          </MenuItem>
        ) : null}
        <MenuItem href={r.pageHref}>Open full page</MenuItem>
      </Menu>
      {/* The same two actions for the keyboard (s, r): drawn nowhere, out of the tab order, driven by `onRowKey`. */}
      {r.supplierId ? <button type="button" data-action="save" tabIndex={-1} aria-hidden className="hidden" onClick={() => void save(r.supplierId!)} /> : null}
      {r.rfqHref ? <Link href={r.rfqHref} prefetch={false} scroll={false} data-action="rfq" tabIndex={-1} aria-hidden className="hidden" /> : null}
    </>
  );
}
