"use client";

// The RFQ table (Paper `10 · RFQs list`): RFQ and its facts, Sent to, Status with what is
// missing under it, Best quote vs your target, Ship by (a sort), Sent. A real table, head 36
// and sticky, rows grow to 56 when a name wraps. The whole row opens the RFQ beside the list
// (a draft reopens in the composer); arrows move between rows and Enter opens, as on the
// results. Client: it handles the keys.

import Link from "next/link";
import { Table, Td, Th, Tr, TypeChip, rowLinkClass, type SortState } from "@/components/kit";
import { onRowKey } from "@/components/search/keys";
import { RfqChip } from "./chip";
import { rfqsHref, type ListItem, type RfqSort, type RfqTab } from "./words";

/** Where a row goes: an RFQ opens beside the list, a draft reopens in the composer. */
export const openHref = (i: Pick<ListItem, "kind" | "id">, tab: RfqTab, sort: RfqSort) =>
  i.kind === "draft" ? `/app/rfqs/new?draft=${encodeURIComponent(i.id)}` : rfqsHref(tab, i.id, sort);

const FLUSH = "px-0 pr-3";
const CELL = "px-0 pr-3 py-2";

export function RfqTable({ items, tab, sort, currentId = null }: { items: readonly ListItem[]; tab: RfqTab; sort: RfqSort; currentId?: string | null }) {
  const shipSort: SortState = sort === "ship_by" ? "asc" : "none";
  return (
    <div role="region" aria-label="RFQs table" tabIndex={0} className="relative min-w-0 overflow-x-auto outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand">
      {/* Paper's column widths (360 / 110 / 200 / 250 / 120 / 128) with no side padding, so the text has the room the board gives it. */}
      <Table className="min-w-[1168px] table-fixed">
        <thead>
          <tr>
            <Th className="w-[360px]" inner={FLUSH}>
              RFQ
            </Th>
            <Th className="w-[110px]" inner={FLUSH}>
              Sent to
            </Th>
            <Th className="w-[200px]" inner={FLUSH}>
              Status
            </Th>
            <Th className="w-[250px]" inner={FLUSH}>
              Best quote vs your target
            </Th>
            <Th className="w-[120px]" inner={FLUSH} sort={shipSort} href={rfqsHref(tab, null, sort === "ship_by" ? "recent" : "ship_by")}>
              Ship by
            </Th>
            <Th className="w-32" inner={FLUSH}>
              Sent
            </Th>
          </tr>
        </thead>
        <tbody onKeyDown={onRowKey}>
          {items.map((i) => (
            <Tr
              key={`${i.kind}:${i.id}`}
              data-row="result"
              tabIndex={0}
              aria-label={i.title}
              aria-current={i.id === currentId ? "true" : undefined}
              selected={i.id === currentId}
              className="relative min-h-14 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
            >
              <Td className={CELL}>
                <span className="flex flex-wrap items-center gap-x-2">
                  <Link
                    href={openHref(i, tab, sort)}
                    prefetch={false}
                    scroll={false}
                    data-open="record"
                    className={`${rowLinkClass} after:absolute after:inset-0 after:content-['']`}
                  >
                    {i.title}
                  </Link>
                  {i.asSupplier ? <TypeChip>As supplier</TypeChip> : null}
                </span>
                <span className="block pt-0.5 text-sm text-ink-3">{i.detail}</span>
              </Td>
              <Td className={CELL}>{i.suppliers}</Td>
              <Td className={CELL}>
                <RfqChip tone={i.chip.tone}>{i.chip.label}</RfqChip>
                {i.chipNote ? <span className="block pt-0.5 text-xs text-ink-3">{i.chipNote}</span> : null}
              </Td>
              <Td className={CELL}>
                {i.best ? (
                  <>
                    <span className="block font-semibold text-ink">{i.best.price}</span>
                    {i.best.versus || i.best.supplier ? (
                      <span className="block pt-0.5 text-sm text-ink-2">{[i.best.versus, i.best.supplier].filter(Boolean).join(" · ")}</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-ink-3">{i.bestEmpty}</span>
                )}
              </Td>
              <Td className={CELL}>
                {i.shipBy.date ?? <span className="text-ink-3">Not set</span>}
                {i.shipBy.near ? <span className="block pt-0.5 text-xs font-medium text-caution">{i.shipBy.near}</span> : null}
              </Td>
              <Td className={i.sent ? CELL : `${CELL} text-ink-3`}>{i.sent ?? "Not sent"}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
