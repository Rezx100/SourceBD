// One order (Paper `10 · Order detail`, `11 · Order detail`): one view for the pane beside the list
// and the full page. The title with its status, the supplier and PO under it, four figures, the
// steps that were logged as a timeline, and the order's details (shipping, dates, the RFQ it came
// from, notes). Both sides can log a step; only the buyer edits or cancels; the server enforces
// both. There are no planned steps in the data, so the timeline holds what happened.

import { ArrowLeft, ChatCircle, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Timeline } from "@/components/patterns";
import { buttonClass } from "@/components/kit";
import { shortName } from "@/components/rfqs/words";
import { cn } from "@/lib/utils";
import { AddUpdate, OrderMenu } from "./actions";
import { OrderChip } from "./chip";
import { STATUS_WORDS, cancelSummary, cancelTitle, detailGroups, orderPowers, orderSteps, shipLate, startedLine, summaryCells, supplierLine, type OrderDoc } from "./words";

const ICON_LINK = "inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-ink-2 outline-none hover:bg-sunken hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const NAME = "rounded-sm font-medium text-ink underline decoration-line-strong decoration-1 [text-underline-position:from-font] outline-none hover:decoration-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export type OrderDetailProps = {
  order: OrderDoc;
  mode: "pane" | "page";
  today: Date;
  /** The conversation with the supplier about this order's RFQ, when there is one. */
  threadId: string | null;
  /** The viewer's user id, to say "Logged by you". */
  viewerId: string | null;
  closeHref: string;
};

export function OrderDetail({ order, mode, today, threadId, viewerId, closeHref }: OrderDetailProps) {
  const page = mode === "page";
  const Title = page ? "h1" : "h2";
  const powers = orderPowers(order);
  const status = STATUS_WORDS[order.status] ?? STATUS_WORDS.draft;
  const steps = orderSteps(order, viewerId);
  const cells = summaryCells(order);
  const groups = detailGroups(order);
  const late = shipLate(order, today);
  const supplier = shortName(order.supplier.company_name);
  const edit = {
    status: order.status,
    incoterm: order.incoterm,
    origin_port: order.origin_port,
    destination_port: order.destination_port,
    ship_to_country: order.ship_to_country,
    target_ship_date: order.target_ship_date,
    target_delivery_date: order.target_delivery_date,
    actual_ship_date: order.actual_ship_date,
    actual_delivery_date: order.actual_delivery_date,
    carrier_name: order.carrier_name,
    tracking_number: order.tracking_number,
    po_number: order.po_number,
    notes: order.notes,
  };
  const menu = (size: 32 | 44) => (
    <OrderMenu orderId={order.id} initial={edit} edit={powers.edit} cancel={powers.cancel} cancelTitle={cancelTitle(order)} cancelSummary={cancelSummary(order)} supplier={supplier} size={size} />
  );
  const message = threadId ? (
    <Link href={`/app/messages/${threadId}`} prefetch={false} className={buttonClass({ kind: "secondary", className: "gap-1.5 pl-2.5" })}>
      <ChatCircle size={16} className="shrink-0 text-ink-2" aria-hidden />
      <span className="min-w-0 truncate">Message {supplier}</span>
    </Link>
  ) : null;

  const details = (
    <div className="flex flex-col gap-5">
      <section aria-label="Order details" className="flex flex-col gap-4">
        <h2 className="text-md font-semibold text-ink">Order details</h2>
        {groups.length === 0 ? <p className="text-base text-ink-2">No shipping details or dates were added yet.</p> : null}
        {groups.map((g, i) => (
          <div key={g.title} className={cn("flex flex-col gap-2", i > 0 && "border-t border-line pt-4")}>
            <h3 className="text-xs font-semibold text-ink-3">{g.title}</h3>
            <dl className="flex flex-col gap-1.5 text-base">
              {g.rows.map((r) => (
                <div key={r.label} className="flex justify-between gap-4">
                  <dt className="text-ink-3">{r.label}</dt>
                  <dd className={cn("text-right text-ink", r.label === "Tracking" && order.tracking_number ? "font-mono text-sm" : "")}>{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>
      {order.rfq_id ? (
        <div className="flex flex-col gap-1 border-t border-line pt-4">
          <p className="text-xs font-semibold text-ink-3">From RFQ</p>
          <Link href={`/app/rfqs/${order.rfq_id}`} prefetch={false} className="inline-flex w-fit text-base text-ink underline decoration-line-strong decoration-1 [text-underline-position:from-font] hover:decoration-ink max-sm:min-h-11 max-sm:items-center">
            {order.product_title}
          </Link>
        </div>
      ) : null}
      {order.notes ? (
        <div className="flex flex-col gap-1 border-t border-line pt-4">
          <p className="text-xs font-semibold text-ink-3">Notes</p>
          <p className="whitespace-pre-wrap text-base text-ink-2 [overflow-wrap:anywhere]">{order.notes}</p>
        </div>
      ) : null}
    </div>
  );

  return (
    <section aria-label={`Order: ${order.product_title}`} data-record-pane={page ? undefined : ""} data-detail={page ? "" : undefined} tabIndex={page ? undefined : -1} className="flex min-h-0 flex-1 flex-col bg-surface outline-none">
      {page ? (
        <div className="flex h-12 items-center px-4 sm:h-auto sm:px-6 sm:pt-4">
          <Link href={closeHref} prefetch={false} className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-md font-medium text-ink-2 outline-none hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:min-h-6 sm:text-base">
            <ArrowLeft size={16} className="shrink-0" aria-hidden />
            <span className="sm:hidden">Orders</span>
            <span className="max-sm:hidden">Back to orders</span>
          </Link>
        </div>
      ) : null}
      <header className={cn("flex flex-col gap-1 border-b border-line px-4 pb-4 sm:px-6", page ? "pt-2 sm:pt-3" : "pt-4")}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Title className="text-xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere] max-sm:text-lg">{order.product_title}</Title>
            <OrderChip tone={status.tone}>{status.label}</OrderChip>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {page ? <span className="flex items-center gap-2 max-sm:hidden">{message}{powers.update ? <AddUpdate orderId={order.id} /> : null}{menu(32)}</span> : null}
            {page ? <span className="sm:hidden">{menu(44)}</span> : null}
            {!page ? (
              <>
                <Link href={`/app/orders/${order.id}`} prefetch={false} className="rounded-sm p-1.5 text-base font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] outline-none hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus max-sm:hidden">
                  Open full page
                </Link>
                <Link href={closeHref} scroll={false} prefetch={false} aria-label="Close" className={cn(ICON_LINK, "max-xl:hidden")}>
                  <X size={20} aria-hidden />
                </Link>
              </>
            ) : null}
          </div>
        </div>
        <p className="text-base text-ink-2 max-sm:text-md">
          <Link href={`/app/suppliers/${order.supplier.slug}`} prefetch={false} className={NAME}>
            {order.supplier.company_name}
          </Link>
          <span className="max-sm:hidden"> · {supplierLine(order.supplier)}</span>
          {order.po_number ? <span className="font-mono text-sm"> · {order.po_number}</span> : null}
        </p>
        <p className="text-sm text-ink-3">{startedLine(order)}</p>
        {!page ? (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {message}
            {powers.update ? <AddUpdate orderId={order.id} /> : null}
            {menu(32)}
          </div>
        ) : null}
      </header>

      <div className={cn("flex min-h-0 flex-1", page && "lg:items-stretch")}>
        <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-5 sm:px-6">
          <dl aria-label="Summary" className="flex flex-col rounded-lg border border-line sm:flex-row [font-variant-numeric:tabular-nums]">
            {cells.map((c) => (
              <div key={c.label} className="flex items-start justify-between gap-3 border-t border-line px-3 py-3 first:border-t-0 sm:flex-1 sm:flex-col sm:justify-start sm:gap-0.5 sm:border-r sm:border-t-0 sm:last:border-r-0">
                <dt className="text-md text-ink-2 sm:text-xs sm:text-ink-3">{c.label}</dt>
                <dd className="text-md font-semibold text-ink max-sm:text-right">{c.value}</dd>
              </div>
            ))}
          </dl>

          <section aria-label="Progress" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h2 className="text-lg font-semibold text-ink">Progress · {steps.length === 1 ? "1 step" : `${steps.length} steps`}</h2>
              <p className="text-base text-ink-3">{steps.length === 0 ? "none logged yet" : `${steps.length} logged`}</p>
            </div>
            {late ? <p className="text-sm font-medium text-caution">{late}</p> : null}
            {steps.length === 0 ? (
              <p className="rounded-md border border-line p-5 text-base text-ink-2">
                {order.status === "cancelled" ? "This order was cancelled. Nothing was logged on it." : "Nothing logged yet. Add an update when something happens (PO issued, production started, shipped) and both sides see the same timeline."}
              </p>
            ) : (
              <Timeline items={steps.map((s) => ({ name: s.name, status: s.status, on: s.on, byline: s.byline }))} today={today} />
            )}
          </section>

          <div className={cn(page && "lg:hidden")}>
            <div className="mb-5 h-px bg-line" />
            {details}
          </div>
        </div>
        {page ? <aside className="w-details shrink-0 border-l border-line px-6 py-5 max-lg:hidden">{details}</aside> : null}
      </div>

      {page && (message || powers.update) ? (
        <div className="sticky bottom-0 flex min-h-action-bar items-center gap-2 border-t border-line bg-surface px-4 pb-[env(safe-area-inset-bottom)] sm:hidden">
          {message ? <div className="min-w-0 flex-1 [&>a]:h-input-touch [&>a]:w-full [&>a]:min-w-0 [&>a]:justify-center [&>a]:text-md">{message}</div> : null}
          {powers.update ? (
            <div className="min-w-0 flex-1">
              <AddUpdate orderId={order.id} size="touch" full />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** The order could not be read: the title stands if it is known, and the way back. */
export function OrderDetailError({ title, mode, closeHref, retryHref }: { title: string; mode: "pane" | "page"; closeHref: string; retryHref: string }) {
  const page = mode === "page";
  const Title = page ? "h1" : "h2";
  return (
    <section aria-label={`Order: ${title}`} data-record-pane={page ? undefined : ""} data-detail={page ? "" : undefined} tabIndex={page ? undefined : -1} className="flex min-h-0 flex-1 flex-col bg-surface outline-none">
      <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
        <Title className="text-xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">{title}</Title>
        <Link href={closeHref} scroll={false} prefetch={false} aria-label={page ? "Back to orders" : "Close"} className={ICON_LINK}>
          {page ? <ArrowLeft size={20} aria-hidden /> : <X size={20} aria-hidden />}
        </Link>
      </header>
      <div className="flex flex-col items-start gap-3 px-4 py-5 sm:px-6">
        <p className="text-md font-semibold text-ink">We couldn&apos;t load this order.</p>
        <p className="text-base text-ink-2">It took too long to load. Your order is safe.</p>
        <Link href={retryHref} prefetch={false} className={buttonClass({ kind: "secondary" })}>
          Try again
        </Link>
      </div>
    </section>
  );
}
