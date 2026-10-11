"use client";

// The products on a desktop and a phone (Paper `10 · Products`, `11 · Products`): a real <table>
// with Product, Target price, MOQ, Status and Updated and a menu per row; under 768 each product is
// a row of its own with the menu at its end. The name opens the product; the menu has Open, Send an
// RFQ (an active product only), Archive or Restore, and Delete. Client: the menu runs the actions.

import { CheckCircle, DotsThree, Package, PencilSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { IconButton, Menu, MenuItem, Table, Td, Th, Tr, Unpublished, rowLinkClass } from "@/components/kit";
import { cn } from "@/lib/utils";
import { LinkPending } from "@/components/patterns/link-pending";
import { useProductActions } from "./actions";
import { STATUS_LABEL, moqWords, openHref, phoneFigures, phoneUpdated, priceWords, rfqHref, styleLine, updatedWords, type ProductRow, type ProductStatus } from "./words";

/** Active is a plain chip, a draft a dashed one, an archived product a quiet one (the Paper chips). */
export function StatusChip({ status }: { status: ProductStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-sm border px-2 text-sm font-medium leading-4 text-ink-2",
        status === "active" && "border-line bg-surface",
        status === "draft" && "border-dashed border-line-strong bg-surface",
        status === "archived" && "border-sunken bg-sunken",
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function RowMenu({ row, className }: { row: ProductRow; className?: string }) {
  const { toggleArchive, askDelete } = useProductActions();
  const archived = row.status === "archived";
  return (
    <Menu align="end" trigger={<IconButton icon={DotsThree} label={`More actions for ${row.name}`} kind="quiet" className={className} />}>
      <MenuItem href={openHref(row.id)}>Open</MenuItem>
      {row.status === "active" ? <MenuItem href={rfqHref(row.id)}>Send an RFQ</MenuItem> : null}
      <MenuItem onSelect={() => void toggleArchive(row)}>{archived ? "Restore" : "Archive"}</MenuItem>
      <MenuItem onSelect={() => askDelete(row)}>Delete</MenuItem>
    </Menu>
  );
}

export function ProductTable({ rows }: { rows: readonly ProductRow[] }) {
  return (
    <div role="region" aria-label="Products table" tabIndex={0} className="relative min-w-0 overflow-x-auto outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus">
      <Table className="min-w-[860px]">
        <thead>
          <tr>
            <Th>Product</Th>
            <Th className="w-[170px]">Target price</Th>
            <Th className="w-[140px]">MOQ</Th>
            <Th className="w-[110px]">Status</Th>
            <Th className="w-[130px]">Updated</Th>
            <th scope="col" className="sticky top-0 z-raised h-row-head w-12 border-b border-line bg-subtle p-0">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.id} data-product={r.id}>
              <Td>
                <Link href={openHref(r.id)} prefetch={false} className={rowLinkClass}>
                  {r.name}
                </Link>
                {styleLine(r) ? <span className="block text-xs text-ink-3">{styleLine(r)}</span> : null}
              </Td>
              <Td className="whitespace-nowrap">{priceWords(r.price_usd) ?? <Unpublished>No price yet</Unpublished>}</Td>
              <Td className="whitespace-nowrap">{moqWords(r.moq) ?? <Unpublished>No MOQ yet</Unpublished>}</Td>
              <Td>
                <StatusChip status={r.status} />
              </Td>
              <Td className="whitespace-nowrap tabular-nums text-ink-2">{updatedWords(r.updated_at)}</Td>
              <td className="w-12 border-b border-line p-0 text-center align-middle">
                <RowMenu row={r} />
              </td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

const PHONE_STATUS: Record<ProductStatus, { icon: typeof CheckCircle; tone: string }> = {
  active: { icon: CheckCircle, tone: "text-ink-2" },
  draft: { icon: PencilSimple, tone: "text-ink-3" },
  archived: { icon: Package, tone: "text-ink-3" },
};

/**
 * The phone's cards (`11 · Products`): the status and style, the name, "US$4.20 per piece · MOQ 3,000
 * pieces", when it was updated and what a draft or an archived product needs. Paper's caret is the
 * row's menu here, so Archive, Restore and Delete stay on a phone; Paper's "in 1 order" is not here:
 * the list returns no order or RFQ count.
 */
export function ProductPhoneList({ rows }: { rows: readonly ProductRow[] }) {
  return (
    <ul className="mx-5 flex flex-col overflow-clip rounded-[10px] border border-line md:hidden">
      {rows.map((r) => {
        const { icon: G, tone } = PHONE_STATUS[r.status] ?? PHONE_STATUS.draft;
        return (
          <li key={r.id} className="relative border-t border-line first:border-t-0">
            <Link href={openHref(r.id)} prefetch={false} className="flex flex-col gap-2.5 p-4 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus active:bg-sunken">
              <span className="flex items-center gap-1.5 pr-9">
                <G size={16} weight="thin" className={cn("shrink-0", tone)} aria-hidden />
                <span className={cn("text-xs font-medium", tone)}>{STATUS_LABEL[r.status] ?? r.status}</span>
                {r.product_number ? <span className="min-w-0 truncate font-mono text-xs text-ink-3">{`· ${r.product_number}`}</span> : null}
                <LinkPending />
              </span>
              <span className="text-md/[22px] font-medium text-ink">{r.name}</span>
              <span className="text-sm text-ink-2">{phoneFigures(r)}</span>
              <span className="text-xs text-ink-3">{phoneUpdated(r)}</span>
            </Link>
            <RowMenu row={r} className="absolute right-1 top-1 size-11" />
          </li>
        );
      })}
    </ul>
  );
}
