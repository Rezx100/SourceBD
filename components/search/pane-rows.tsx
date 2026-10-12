"use client";

// The list beside an open record or the composer (Paper page 37, boards 08 and 08b). A row answers
// before the click, in three levels, loudest first: the name, with the export value when customs
// records exist; what it makes, the search's matches first, with where it ships; then small facts led
// by a glyph (place, workers, the brands that list it) and the certificates it holds today as marks.
// Left out on purpose: "Factory" (the record says it), the source count, any certificate's time left.
// At the list's narrowest (the pane dragged wide, the list at 400) each level wraps whole item by whole
// item and the exports become one line of their own; nothing is cut.
//
// The list is a ledger too (critique of 8 Oct 2026, round 3, item 2): each row has the table's tick,
// its keys (↑ ↓ j k, Enter, Space, r, s) and its ⋯ menu, so a buyer can open a record, tick five
// suppliers and write one RFQ to them without closing the pane. The name opens the record; the open
// one keeps `aria-current`. Client: it reads the selection.

import { Buildings, MapPin, Storefront, UsersThree } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { LinkPending, SanctionTag } from "@/components/patterns";
import { Checkbox } from "@/components/kit";
import { splitQualifier } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { onRowKey } from "./keys";
import type { ResultRow } from "./model";
import { ExportedLocked, HeldMarks, Products, ShipsTo } from "./row-parts";
import { useSelection } from "./selection";
import { RowActions, useRowSave } from "./table";

// One line, cut at the end with the whole words in `title` (the One-Line Name Rule); at the list's narrowest it wraps instead.
const LINE = "block min-w-0 overflow-hidden whitespace-nowrap [text-overflow:ellipsis] [@container_(max-width:459px)]:overflow-visible [@container_(max-width:459px)]:whitespace-normal";

/** A small fact led by its glyph; `label` says to a screen reader what the glyph says to the eye. */
function Fact({ icon: G, label, children }: { icon: Icon; label?: string; children: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-ink-2 [@container_(min-width:460px)]:whitespace-nowrap">
      <G size={14} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
      {label ? <span className="sr-only">{label}: </span> : null}
      {children}
    </span>
  );
}

/** Beside a pane: tick, the three levels, the ⋯ menu. */
export function PaneRows({ rows, currentSlug }: { rows: readonly ResultRow[]; currentSlug?: string | null }) {
  const sel = useSelection();
  const { save, toast } = useRowSave();
  return (
    <>
      {/* With a record open the arrows change it, as in the table (`data-follow`). The list measures itself, so a row wraps by the list's own width, not the window's. */}
      <ul onKeyDown={onRowKey} data-follow={currentSlug != null ? "record" : undefined} className="[container-type:inline-size]">
        {rows.map((r) => {
          const selectable = sel.interactive && Boolean(r.supplierId);
          const ticked = selectable && sel.isSelected(r.supplierId!);
          const open = r.slug === currentSlug;
          const { base, qualifier } = splitQualifier(r.name);
          return (
            <li key={r.slug} data-row="result" tabIndex={0} aria-current={open ? "true" : undefined} className="outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus">
              <div
                className={cn(
                  "relative flex items-start gap-2 border-b border-l-2 border-b-line py-2.5 pl-2 pr-1 hover:bg-subtle",
                  // The open row is sunken behind an ink bar; a ticked one keeps the table's brand tint.
                  open ? "border-l-ink bg-sunken hover:bg-sunken" : ticked ? "border-l-brand-ink bg-brand-tint hover:bg-brand-tint" : "border-l-transparent",
                )}
              >
                <span className="relative z-raised flex h-5 shrink-0 items-center">
                  <Checkbox aria-label={`Select ${r.name}`} checked={ticked} disabled={!selectable} onChange={selectable ? () => sel.toggle(r.supplierId!) : () => {}} />
                </span>
                {/* Wide: the name, what it makes and the facts down the left; the exports and the marks down the right.
                    Narrow: one column, the exports on a line of their own before the marks. One drawing, placed by the list's width. */}
                <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-[3px] [@container_(max-width:459px)]:grid-cols-1 [@container_(max-width:459px)]:gap-y-1">
                  {/* The name's link covers the row (`after:inset-0`), so a click anywhere opens the record; the tick and the menu sit above it. */}
                  <Link
                    href={r.paneHref}
                    prefetch={false}
                    scroll={false}
                    data-open="record"
                    aria-current={open ? "true" : undefined}
                    className="col-start-1 row-start-1 flex min-w-0 flex-col rounded-sm outline-none after:absolute after:inset-0 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    <span data-name="" title={r.name} className={cn(LINE, "text-[15px]/[20px] font-semibold text-ink")}>
                      {qualifier ? (
                        <>
                          <span aria-hidden="true">{base}</span>
                          <span className="sr-only">{r.name}</span>
                        </>
                      ) : (
                        base
                      )}
                      <LinkPending className="ml-1.5 inline-block align-[-2px]" />
                    </span>
                    {qualifier ? (
                      <span data-name="" title={qualifier} className={cn(LINE, "text-xs text-ink-3")}>
                        {qualifier}
                      </span>
                    ) : null}
                  </Link>
                  {r.products ? <Products products={r.products} className="col-start-1 row-start-2 [@container_(max-width:459px)]:flex-wrap [@container_(max-width:459px)]:overflow-visible" /> : null}
                  {r.exported ? (
                    <span className="col-start-2 row-span-2 row-start-1 flex flex-col items-end gap-[3px] tabular-nums [@container_(max-width:459px)]:col-start-1 [@container_(max-width:459px)]:row-span-1 [@container_(max-width:459px)]:row-start-4 [@container_(max-width:459px)]:flex-row [@container_(max-width:459px)]:flex-wrap [@container_(max-width:459px)]:items-center [@container_(max-width:459px)]:gap-x-2">
                      {r.exported === "locked" ? (
                        <ExportedLocked className="h-5" />
                      ) : (
                        <>
                          {r.exported.value ? (
                            <span className="flex items-baseline gap-[5px] whitespace-nowrap">
                              <span className="text-[15px]/[20px] font-medium text-ink [@container_(max-width:459px)]:text-xs [@container_(max-width:459px)]:font-semibold">{r.exported.value}</span>
                              <span className="text-xs text-ink-3">exported, 2 years</span>
                            </span>
                          ) : null}
                          {/* "ships to", or "to" where the list is at its narrowest and the line must hold the value too. */}
                          <ShipsTo
                            to={r.exported.to}
                            label={
                              <>
                                <span className="[@container_(max-width:459px)]:hidden">ships </span>to
                              </>
                            }
                          />
                        </>
                      )}
                    </span>
                  ) : null}
                  <span className="col-start-1 row-start-3 flex min-w-0 items-center gap-x-3 gap-y-1 pt-1 [@container_(max-width:459px)]:flex-wrap [@container_(max-width:459px)]:pt-0.5">
                    {r.sanctioned ? <SanctionTag list="sanctions list" /> : null}
                    {/* "Factory" goes unsaid; a buying house, or anything else, is said. */}
                    {r.type && r.type !== "Factory" ? <Fact icon={Buildings}>{r.type}</Fact> : null}
                    {r.place ? (
                      <Fact icon={MapPin} label="Place">
                        {r.place}
                      </Fact>
                    ) : null}
                    {r.workers ? <Fact icon={UsersThree}>{`${r.workers} ${r.workers === "1" ? "worker" : "workers"}`}</Fact> : null}
                    {r.brands?.length ? (
                      <Fact icon={Storefront} label="On the supplier list of">
                        {r.brands.join(", ")}
                      </Fact>
                    ) : null}
                  </span>
                  {r.held?.length ? (
                    <HeldMarks held={r.held} className="col-start-2 row-start-3 self-center justify-self-end pt-1 [@container_(max-width:459px)]:col-start-1 [@container_(max-width:459px)]:row-start-5 [@container_(max-width:459px)]:justify-self-start [@container_(max-width:459px)]:pt-0.5" />
                  ) : null}
                </div>
                <span className="relative z-raised -my-1 shrink-0">
                  <RowActions r={r} save={save} />
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {toast}
    </>
  );
}
