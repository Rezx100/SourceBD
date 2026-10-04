"use client";

// The orders table (Paper `10 · Orders list`): Order with its PO number, Supplier, Quantity and
// Value (right-aligned figures), Status, and "Ship by · latest update". A real table, head 36 and
// sticky; the whole row opens the order beside the list, and arrows move between rows and Enter
// opens, as on the results. Client: it handles the keys.

import Link from "next/link";
import { Table, Td, Th, Tr, TypeChip, rowLinkClass } from "@/components/kit";
import { onRowKey } from "@/components/search/keys";
import { cn } from "@/lib/utils";
import { OrderChip } from "./chip";
import { ordersHref, type OrderItem, type OrderTab } from "./words";

const FLUSH = "px-0 pr-3";
const CELL = "px-0 pr-3 py-2";

export function OrdersTable({ items, tab, currentId = null }: { items: readonly OrderItem[]; tab: OrderTab; currentId?: string | null }) {
  return (
    <div role="region" aria-label="Orders table" tabIndex={0} className="relative min-w-0 overflow-x-auto outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand">
      <Table className="min-w-[1100px] table-fixed">
        <thead>
          <tr>
            <Th className="w-[300px]" inner={FLUSH}>
              Order
            </Th>
            <Th className="w-[270px]" inner={FLUSH}>
              Supplier
            </Th>
            <Th align="right" className="w-[130px]" inner={FLUSH}>
              Quantity
            </Th>
            <Th align="right" className="w-[130px]" inner="px-0 pr-6 pl-3">
              Value
            </Th>
            <Th className="w-[150px]" inner={FLUSH}>
              Status
            </Th>
            <Th inner={FLUSH}>Ship by · latest update</Th>
          </tr>
        </thead>
        <tbody onKeyDown={onRowKey}>
          {items.map((i) => (
            <Tr
              key={i.id}
              data-row="result"
              tabIndex={0}
              aria-label={i.title}
              aria-current={i.id === currentId ? "true" : undefined}
              selected={i.id === currentId}
              className="relative min-h-14 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
            >
              <Td className={CELL}>
                <Link href={ordersHref(tab, i.id)} prefetch={false} scroll={false} data-open="record" className={`${rowLinkClass} after:absolute after:inset-0 after:content-['']`}>
                  {i.title}
                </Link>
                <span className="block pt-0.5 font-mono text-sm text-ink-3">{i.po ?? <span className="font-sans">No PO number yet</span>}</span>
              </Td>
              <Td className={CELL}>
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className="text-ink [overflow-wrap:anywhere]">{i.supplier}</span>
                  {i.asSupplier ? <TypeChip>As supplier</TypeChip> : null}
                </span>
              </Td>
              <Td align="right" className={cn(CELL, "text-ink-2")}>
                {i.qty}
              </Td>
              <Td align="right" className={cn("px-0 py-2 pl-3 pr-6", i.value ? "font-semibold text-ink" : "text-ink-3")}>
                {i.value ?? "No price yet"}
              </Td>
              <Td className={CELL}>
                <OrderChip tone={i.chip.tone}>{i.chip.label}</OrderChip>
              </Td>
              <Td className={CELL}>
                <span className="block text-ink-2">{i.dates.line}</span>
                {i.dates.late ? <span className="block pt-0.5 text-xs font-medium text-caution">{i.dates.late}</span> : null}
                {i.dates.sub ? <span className="block pt-0.5 text-sm text-ink-3">{i.dates.sub}</span> : null}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
