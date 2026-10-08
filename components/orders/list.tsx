// The parts of the orders list around its table (Paper `10 · Orders list`, `· empty`, `11 · Quotes
// tab · Orders`): the header with its status tabs, the narrow list beside a pane, the phone's
// rows, the empty teaching state, the failed read and the loading skeleton. Server components;
// the table itself is the client `OrdersTable`.

import { Check, Clock, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ButtonLink, ErrorPanel, Skeleton, TabLink, buttonClass } from "@/components/kit";
import { cn } from "@/lib/utils";
import { OrderChip } from "./chip";
import { ORDER_TABS, inTab, ordersHref, type OrderItem, type OrderRow, type OrderTab } from "./words";

export const NEW_ORDER_HREF = "/app/orders/new";

export function OrdersHeader({ caption, rows, tab }: { caption: string; rows: readonly Pick<OrderRow, "status">[]; tab: OrderTab }) {
  return (
    <header className="flex shrink-0 flex-col gap-4 border-b border-line px-6 pt-6 max-md:hidden">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Orders</h1>
          <p className="text-base text-ink-3">{caption}</p>
        </div>
        <ButtonLink href={NEW_ORDER_HREF} kind="primary" icon={Plus} prefetch={false}>
          New order
        </ButtonLink>
      </div>
      {rows.length > 0 ? (
        <nav aria-label="Order status" className="-mx-3 flex flex-wrap gap-3">
          {ORDER_TABS.map((t) => (
            <TabLink key={t.key} href={ordersHref(t.key)} current={t.key === tab} count={rows.filter((o) => inTab(o, t.key)).length} prefetch={false}>
              {t.label}
            </TabLink>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

export function OrdersPaneHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
      <h1 className="text-md font-semibold text-ink">
        {title} · {count}
      </h1>
      <ButtonLink href={NEW_ORDER_HREF} kind="primary" prefetch={false}>
        New order
      </ButtonLink>
    </div>
  );
}

/** Beside a pane: the title and "PO · supplier", the chip on the right; the open row has the brand bar. */
export function OrderPaneRows({ items, tab, currentId }: { items: readonly OrderItem[]; tab: OrderTab; currentId: string | null }) {
  return (
    <ul>
      {items.map((i) => {
        const current = i.id === currentId;
        return (
          <li key={i.id}>
            <Link
              href={ordersHref(tab, i.id)}
              prefetch={false}
              scroll={false}
              aria-current={current ? "true" : undefined}
              className={cn(
                "flex min-h-14 items-start gap-3 border-b border-l-2 border-line py-2.5 pl-3.5 pr-4 outline-none hover:bg-brand-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus",
                current ? "border-l-brand-ink bg-brand-tint" : "border-l-transparent",
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-medium text-ink">{i.title}</span>
                <span className="text-sm text-ink-2">{[i.po ?? "No PO number yet", i.supplier].join(" · ")}</span>
              </span>
              <OrderChip tone={i.chip.tone}>{i.chip.label}</OrderChip>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** On a phone a row opens the order as a page: title and chip, supplier · value · quantity, a late ship-by in caution, the dates. */
export function OrderPhoneRows({ items }: { items: readonly OrderItem[] }) {
  return (
    <ul>
      {items.map((i) => (
        <li key={i.id}>
          <Link
            href={`/app/orders/${i.id}`}
            prefetch={false}
            className="flex min-h-11 flex-col gap-1.5 border-b border-line px-4 py-4 outline-none hover:bg-brand-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="text-md font-medium text-ink">{i.title}</span>
              <OrderChip tone={i.chip.tone}>{i.chip.label}</OrderChip>
            </span>
            <span className="text-base text-ink-2">{i.phone}</span>
            {i.dates.late ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-caution">
                <Clock size={16} className="shrink-0 text-caution-icon" aria-hidden />
                {i.dates.late}
              </span>
            ) : null}
            <span className="text-sm text-ink-3">{[i.dates.line, i.dates.sub].filter(Boolean).join(" · ")}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function TabEmpty({ tab }: { tab: Exclude<OrderTab, "all"> }) {
  const words: Record<Exclude<OrderTab, "all">, string> = {
    draft: "An order is a draft until its status moves on.",
    progress: "An order is here from production until it is delivered.",
    delivered: "An order moves here once it is delivered.",
    cancelled: "A cancelled order is kept here with its steps.",
  };
  const label = ORDER_TABS.find((t) => t.key === tab)!.label.toLowerCase();
  return (
    <div className="flex flex-col gap-1 px-6 py-10">
      <p className="text-md font-semibold text-ink">No {label} orders</p>
      <p className="text-base text-ink-2">{words[tab]}</p>
    </div>
  );
}

const PROMISES = ["Each step is logged with its date.", "You see who logged each step: you or the supplier.", "A ship-by date that has passed is flagged, in days."];

/** No orders yet (`10 · Orders empty`): what it is for, three promises that are true of the product, and the way to start. */
export function OrdersEmpty() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-col gap-1 border-b border-line px-6 py-6 max-md:hidden">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Orders</h1>
        <p className="text-base text-ink-3">Track each order from PO to delivery.</p>
      </header>
      <div className="flex max-w-prose flex-col gap-4 px-6 py-12 max-md:px-4 max-md:py-8">
        <h2 className="text-xl font-semibold tracking-tight text-ink">No orders yet</h2>
        <p className="text-md text-ink-2">Accept a quote and its order starts here. You can also add an order you placed outside SourceBD.</p>
        <ul className="flex flex-col gap-3">
          {PROMISES.map((p) => (
            <li key={p} className="flex items-start gap-3 text-base text-ink-2">
              <Check size={20} className="mt-px shrink-0 text-brand-ink" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href={NEW_ORDER_HREF} prefetch={false} className={buttonClass({ kind: "primary", size: "lg", className: "max-md:h-input-touch" })}>
            New order
          </Link>
          <Link href="/app/rfqs" prefetch={false} className={buttonClass({ kind: "secondary", size: "lg", className: "max-md:h-input-touch" })}>
            View RFQs
          </Link>
        </div>
      </div>
    </div>
  );
}

/** `order_list` failed. "No orders yet" would be a claim about the account that a failed read cannot make. */
export function OrdersError({ retryHref }: { retryHref: string }) {
  return (
    <div className="p-6 max-md:p-4">
      <ErrorPanel
        title="We couldn't load your orders."
        retry={
          <Link href={retryHref} prefetch={false} className={buttonClass({ kind: "primary" })}>
            Try again
          </Link>
        }
      >
        Nothing has been lost. Your orders and their steps are safe.
      </ErrorPanel>
    </div>
  );
}

export function OrdersSkeleton() {
  const widths = [250, 220, 280, 240];
  return (
    <div role="status" aria-busy="true" aria-label="Loading orders" className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-4 border-b border-line px-6 pb-4 pt-6 max-md:hidden">
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-ink">Orders</h1>
            <Skeleton className="h-3 w-[200px]" />
          </div>
          <ButtonLink href={NEW_ORDER_HREF} kind="primary" prefetch={false}>
            New order
          </ButtonLink>
        </div>
        <div className="flex gap-6" aria-hidden>
          {[48, 56, 80, 64].map((w, i) => (
            <Skeleton key={i} className="h-3" style={{ width: w }} />
          ))}
        </div>
      </div>
      <div className="mx-6 hidden h-row-head items-center border-b border-line bg-subtle text-xs font-medium text-ink-3 md:flex">
        <span className="w-[300px]">Order</span>
        <span className="w-[270px]">Supplier</span>
        <span className="w-[130px] text-right">Quantity</span>
        <span className="w-[130px] pr-6 text-right">Value</span>
        <span className="w-[150px]">Status</span>
        <span>Ship by · latest update</span>
      </div>
      <div className="mx-6 max-md:mx-4" aria-hidden>
        {widths.map((w, i) => (
          <div key={i} className="flex h-14 items-center gap-6 border-b border-line max-md:flex-col max-md:items-start max-md:justify-center max-md:gap-2">
            <div className="flex w-[276px] shrink-0 flex-col gap-1.5 max-md:w-full">
              <Skeleton className="h-3" style={{ width: w }} />
              <Skeleton tone="subtle" className="h-2.5 w-[120px]" />
            </div>
            <Skeleton className="h-3 w-[200px] shrink-0 max-md:hidden" />
            <Skeleton className="h-3 w-20 shrink-0 max-md:hidden" />
            <Skeleton className="h-3 w-20 shrink-0 max-md:hidden" />
            <Skeleton className="h-6 w-24 shrink-0 max-md:hidden" />
          </div>
        ))}
      </div>
    </div>
  );
}
