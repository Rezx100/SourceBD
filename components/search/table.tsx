"use client";

// The results table with no record open (founder's cut of 14 Oct 2026, from the Paper page 37 table,
// and his round 2 of 15 Oct 2026): select, Supplier with the two products that answer the search under
// its name, Location, Workers, the certificate schemes it holds today by name, what it exported in two
// years and where it ships, how many sources hold it, then Save and Open. The list only has to
// answer "which of these do I open": the receipts (the second worker figure, the source marks, each
// certificate's date, the brand lists) are the record's business, one click away in the pane. The
// search's terms are lit where they match, in the name and in the products, so the reason a row is on
// the page is seen, not said.
// A real <table>, head 36 and sticky, rows 64. The column heads carry the words, the rows only values,
// and an empty cell is a dash; no cell wraps (round 2: a place, a workers range and the certificates
// each ran to two lines). Type is not a column: "Factory" goes unsaid, anything else is said
// before what it makes.
// A name is one line (the One-Line Name Rule): the base name cut at the end with the whole name in
// `title` and the row's accessible name, its qualifier (a shed, a building, a group) on the line
// under. The name opens the record in the pane;
// arrows move between rows, Enter opens, Space ticks. Hover is brand-wash, a ticked row
// brand-tint with the 2px bar. Every row ends in a Save bookmark and an Open-as-a-page link
// (founder, 15 Oct 2026, in place of the ⋯ menu), seen while the row is hovered, focused or
// selected and always on a touch screen; Send RFQ is the selection bar's. The pane list and
// Saved keep the ⋯ menu. Client: it reads the selection and handles the keys.

import { DotsThree, SidebarSimple } from "@phosphor-icons/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import Link from "next/link";
import { startTransition, useContext, useEffect, useState, type ReactNode } from "react";
import { ABSENT, LinkPending, SanctionTag, sanctionRowClass } from "@/components/patterns";
import { IconButton, Menu, MenuItem, SelectCell, Table, Td, Th, Toast, Tr, Unpublished, buttonClass, oneLine, rowLinkClass, toastActionClass, type SortState } from "@/components/kit";
import { RecordSave } from "@/components/record/save-button";
import { splitQualifier } from "@/lib/dashboard/facts";
import { rowSaveMessage } from "@/lib/dashboard/selection";
import { cn } from "@/lib/utils";
import { onRowKey } from "./keys";
import type { ResultRow } from "./model";
import { ExportedLocked, HeldMarks, Products, ShipsTo } from "./row-parts";
import { SELECT_ALL_ID, useSelection } from "./selection";

/** What the exports column's figure is, said on its head. */
export const EXPORTED_TITLE = "From customs records of the last two years on file: the export value and the markets it ships to. The record's Exports tab has the shipments";

/**
 * The visible base name, with the whole name for a screen reader when they differ: the row has no
 * `aria-label` (it silenced the cells), so the name link carries the whole name (round 3, item 6).
 * The search's words are not lit in it (founder, 15 Oct 2026: the grey marks were visual noise).
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

/** "Gazipur" from "Gazipur, Dhaka": the row's place is the town, then its district (`placeLabel`); the cell says the town. */
const townOf = (place: string) => place.split(",")[0]!.trim();

/** A plain figure as it is; a range ("1,050–1,900", `rangeWords`) as its low end with a plus, the range in `title` and for a screen reader. */
function Workers({ figure }: { figure: string }) {
  const dash = figure.indexOf("–");
  if (dash < 0) return <>{figure}</>;
  return (
    <span title={`${figure} workers`}>
      {figure.slice(0, dash)}+<span className="sr-only"> ({figure})</span>
    </span>
  );
}

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
  sortHrefs: { workers: string; name?: string; sources?: string };
}) {
  const sel = useSelection();
  // A column sorts from its head when its cells show what it sorts by: the name, the workers and the source count.
  const state = (key: "workers" | "name" | "sources"): SortState => (sort.key === key ? sort.dir : "none");
  // Not a tab stop (critique of 8 Oct 2026, item 7: two Tabs before the first name): the rows are.
  return (
    <div role="region" aria-label="Results table" className="relative min-w-0 overflow-x-auto xl:overflow-visible">
      {/* The fixed columns sum to 918 (select 40, Location 160, Workers 112, Certificates 260, Exports 180, Sources 90, actions 76), so the floor keeps Supplier 240 or more. It is what fits at xl, where the region stops scrolling: 1280 − 64 (the rail below 2xl) − 48 (the page's px-6) = 1168; a floor over that would spill past the region instead of scrolling. */}
      <Table className="min-w-[1160px]">
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
            <Th className="w-[160px]">Location</Th>
            <Th align="right" className="w-28" sort={state("workers")} href={sortHrefs.workers}>
              Workers
            </Th>
            <Th className="w-[260px]" title="The certificate schemes it holds today; their dates are on the record's Certificates tab">
              Certificates
            </Th>
            {exportsHead ? (
              <Th className="w-[250px]" title="Export shipment records, Sep 2024 – Aug 2026">
                {exportsHead}
              </Th>
            ) : (
              <Th className="w-[180px]" title={EXPORTED_TITLE}>
                Exported in 2 years
              </Th>
            )}
            <Th align="right" className="w-[90px]" title="Registers and certifiers that hold this company" sort={sortHrefs.sources ? state("sources") : undefined} href={sortHrefs.sources}>
              Sources
            </Th>
            <th scope="col" className="sticky top-0 z-raised h-row-head w-[76px] border-b border-line bg-subtle p-0">
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
                {/* The town alone ("Gazipur", not "Gazipur, Dhaka": founder, 15 Oct 2026), the whole place in `title`; one line, the name cell's way (`max-w-0`: the column keeps the head's width). */}
                <Td className="max-w-0 text-ink">{r.place ? <span title={r.place} className={oneLine}>{townOf(r.place)}</span> : <Unpublished />}</Td>
                {/* The record's own figure alone: a second source's figure is on the record (founder, 14 Oct 2026). A company with buildings has a range; the cell says its low end with a plus, the range in `title` (founder, 15 Oct 2026). */}
                <Td align="right" className="whitespace-nowrap tabular-nums text-ink">
                  {r.workers ? <Workers figure={r.workers} /> : <Unpublished />}
                </Td>
                {/* The schemes held today by name; one whose certificate has ended is not among them (founder, 15 Oct 2026: no state pill in the list, the record has every date). A holder whose every certificate has ended is a dash that says so; `r.cert` is null only when none is on file. */}
                <Td className="py-1.5">{r.held?.length ? <HeldMarks held={r.held} words /> : <Unpublished>{r.cert ? ABSENT.certificatesLapsed : ABSENT.certificates}</Unpublished>}</Td>
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
                    <>
                      {r.exported.value ? (
                        <span className="text-[15px]/[20px] font-medium">{r.exported.value}</span>
                      ) : (
                        // A record with markets but no value on file: it exported, and the row says where.
                        <span className="text-sm text-ink-2">Value not on file</span>
                      )}
                      {/* Where it ships, under the figure (founder, 15 Oct 2026: "include the ships to data"); only an entitled reader's row carries markets. */}
                      <ShipsTo to={r.exported.to} label="ships to" className="mt-0.5 flex" />
                    </>
                  ) : r.exported === null ? (
                    <Unpublished>No customs records on file</Unpublished>
                  ) : (
                    // Never read (or the read failed): the dash says that, never that there are none.
                    <Unpublished>{ABSENT.unread}</Unpublished>
                  )}
                </Td>
                <Td align="right" className="tabular-nums text-ink">
                  {r.sources}
                </Td>
                <td className="w-[76px] border-b border-line p-0 align-middle">
                  <RowEnd r={r} />
                </td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

/**
 * Seen while the row is hovered, holds focus, or is selected (`Tr` is `group/row` and sets
 * `aria-selected` for a ticked row and the open record alike); never `hidden`, so a Tab stop and a
 * screen reader always have them, and always shown where there is no hover to reveal them.
 */
const rowControl = "opacity-0 transition-opacity duration-fast group-hover/row:opacity-100 group-focus-within/row:opacity-100 group-aria-selected/row:opacity-100 [@media(hover:none)]:opacity-100";

/**
 * The row's end: Save (the record's own bookmark, saves and unsaves, `aria-pressed`, a toast) and Open
 * (the record in the pane beside the results, as the name does: founder, 15 Oct 2026, in place of the
 * page). `data-action="save"` is the `s` key's target (keys.ts); the hidden RFQ link keeps `r` working,
 * Send RFQ otherwise lives in the selection bar.
 */
function RowEnd({ r }: { r: ResultRow }) {
  return (
    <span className="flex items-center justify-center gap-1">
      {r.supplierId ? <RecordSave supplierId={r.supplierId} saved={r.saved} appearance="icon" size={32} kind="quiet" data-action="save" className={rowControl} /> : null}
      <Link href={r.paneHref} prefetch={false} scroll={false} aria-label={`Open ${r.name} beside the results`} title="Open beside the results" className={cn(buttonClass({ kind: "quiet", size: "icon-32" }), rowControl)}>
        {/* The glyph's panel sits on the left; the pane opens on the right, so it is mirrored. */}
        <SidebarSimple size={20} className="shrink-0 -scale-x-100" aria-hidden />
      </Link>
      {r.rfqHref ? <Link href={r.rfqHref} prefetch={false} scroll={false} data-action="rfq" tabIndex={-1} aria-hidden className="hidden" /> : null}
    </span>
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
