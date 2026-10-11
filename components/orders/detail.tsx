// One order (Paper `10 · Order detail`, `11 · Order detail`): one view for the pane beside the list
// and the full page. The title with its status, the supplier and PO under it, four figures, the
// steps that were logged as a timeline, and the order's details (shipping, dates, the RFQ it came
// from, notes). Both sides can log a step; only the buyer edits or cancels; the server enforces
// both. There are no planned steps in the data, so the timeline holds what happened.

import { ArrowLeft, Boat, ChatCircle, CheckCircle, Clock, FileText, PencilSimple, Storefront, X, XCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Timeline } from "@/components/patterns";
import { ActionBar, buttonClass } from "@/components/kit";
import { shortName } from "@/components/rfqs/words";
import { cn } from "@/lib/utils";
import { AddUpdate, OrderMenu } from "./actions";
import { OrderChip } from "./chip";
import { STATUS_WORDS, cancelSummary, cancelTitle, detailGroups, orderPowers, orderSteps, phoneTiles, shipLate, startedLine, summaryCells, supplierLine, type OrderDoc, type OrderStatus } from "./words";

/** The phone's status pill (Paper 36 `order-detail`): caution once the ship-by date has passed. */
const PILL: Record<OrderStatus, { icon: typeof Clock; tone: string; glyph: string }> = {
  draft: { icon: PencilSimple, tone: "bg-sunken text-ink-2", glyph: "text-ink-3" },
  in_production: { icon: Clock, tone: "bg-sunken text-ink-2", glyph: "text-ink-3" },
  shipped: { icon: Boat, tone: "bg-info-tint text-info", glyph: "text-info" },
  in_transit: { icon: Boat, tone: "bg-info-tint text-info", glyph: "text-info" },
  delivered: { icon: CheckCircle, tone: "bg-brand-tint text-brand", glyph: "text-brand" },
  cancelled: { icon: XCircle, tone: "bg-sunken text-ink-3", glyph: "text-ink-3" },
};
const LATE_PILL = { tone: "bg-caution-tint text-caution", glyph: "text-caution-icon" };

/** The phone bar's round buttons: a 44 target around a 36 face, pressed a shade darker. */
const PHONE_ROUND = "group flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus";
const PHONE_ROUND_FACE = "flex size-9 items-center justify-center rounded-full bg-sunken group-active:bg-line";

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
  const menu = (size: 32 | 44, round = false) => (
    <OrderMenu orderId={order.id} initial={edit} edit={powers.edit} cancel={powers.cancel} cancelTitle={cancelTitle(order)} cancelSummary={cancelSummary(order)} supplier={supplier} size={size} round={round} />
  );
  const pill = PILL[order.status] ?? PILL.draft;
  const pillTone = late ? LATE_PILL : pill;
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
        <>
          {/* The phone's bar (Paper 36 `order-detail`): back to Quotes, and the "..." menu when there is one. */}
          <div className="flex h-14 items-center justify-between px-3 sm:hidden">
            <Link href={closeHref} aria-label="Back to orders" className={PHONE_ROUND}>
              <span className={PHONE_ROUND_FACE}>
                <ArrowLeft size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden />
              </span>
            </Link>
            {menu(44, true)}
          </div>
          <div className="flex items-center px-6 pt-4 max-sm:hidden">
            <Link href={closeHref} prefetch={false} className="inline-flex min-h-6 items-center gap-1.5 rounded-sm text-base font-medium text-ink-2 outline-none hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
              <ArrowLeft size={16} className="shrink-0" aria-hidden />
              Back to orders
            </Link>
          </div>
        </>
      ) : null}
      <header className={cn("flex flex-col gap-1 border-b border-line px-4 pb-4 sm:px-6", page ? "pt-2 max-sm:border-b-0 max-sm:px-5 max-sm:pb-1 sm:pt-3" : "pt-4")}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 max-sm:flex-col max-sm:items-start max-sm:gap-3">
            <Title className="text-xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere] max-sm:text-2xl/[36px] max-sm:font-medium max-sm:tracking-tighter">{order.product_title}</Title>
            <OrderChip tone={status.tone} className="max-sm:hidden">
              {status.label}
            </OrderChip>
            <span className={cn("flex h-7 shrink-0 items-center gap-1.5 self-start rounded-full pl-2 pr-2.5 text-sm font-medium sm:hidden max-sm:order-first", pillTone.tone)}>
              <pill.icon size={16} weight="thin" className={cn("shrink-0", pillTone.glyph)} aria-hidden />
              {status.label}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {page ? <span className="flex items-center gap-2 max-sm:hidden">{message}{powers.update ? <AddUpdate orderId={order.id} /> : null}{menu(32)}</span> : null}
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
        <p className="text-base text-ink-2 max-sm:hidden">
          <Link href={`/app/suppliers/${order.supplier.slug}`} prefetch={false} className={NAME}>
            {order.supplier.company_name}
          </Link>
          <span> · {supplierLine(order.supplier)}</span>
          {order.po_number ? <span className="font-mono text-sm"> · {order.po_number}</span> : null}
        </p>
        {/* The phone's identity lines (Paper 36 `order-detail`): who it is with, and the PO. */}
        <div className="flex flex-col gap-1.5 pt-3 sm:hidden">
          <p className="flex items-center gap-2 text-[15px]/[22px] text-ink-2">
            <Storefront size={18} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
            <Link href={`/app/suppliers/${order.supplier.slug}`} prefetch={false} className={cn(NAME, "font-normal text-ink-2")}>
              {order.supplier.company_name}
            </Link>
          </p>
          {order.po_number ? (
            <p className="flex items-center gap-2 font-mono text-sm/[22px] text-ink-2">
              <FileText size={18} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
              {order.po_number}
            </p>
          ) : null}
        </div>
        <p className="text-sm text-ink-3 max-sm:pt-1">{startedLine(order)}</p>
        {!page ? (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {message}
            {powers.update ? <AddUpdate orderId={order.id} /> : null}
            {menu(32)}
          </div>
        ) : null}
      </header>

      <div className={cn("flex min-h-0 flex-1", page && "lg:items-stretch")}>
        <div className="flex min-w-0 flex-1 flex-col gap-6 px-5 py-5 sm:px-6">
          {/* The phone's two tiles (Paper 36 `order-detail`); price and quantity are under the value. */}
          <dl aria-label="Summary" className="flex overflow-clip rounded-[10px] border border-line tabular-nums sm:hidden">
            {phoneTiles(order, today).map((t) => (
              <div key={t.label} className="flex grow basis-0 flex-col gap-1 border-r border-line px-3.5 pb-3 pt-3.5 last:border-r-0">
                <dt className="text-sm text-ink-3">{t.label}</dt>
                <dd className="text-xl font-medium tracking-tighter text-ink">{t.value}</dd>
                {t.sub ? <dd className={cn("text-sm", t.late ? "font-medium text-caution" : "text-ink-2")}>{t.sub}</dd> : null}
              </div>
            ))}
          </dl>
          <dl aria-label="Summary" className="flex flex-col rounded-lg border border-line max-sm:hidden sm:flex-row [font-variant-numeric:tabular-nums]">
            {cells.map((c) => (
              <div key={c.label} className="flex items-start justify-between gap-3 border-t border-line px-3 py-3 first:border-t-0 sm:flex-1 sm:flex-col sm:justify-start sm:gap-0.5 sm:border-r sm:border-t-0 sm:last:border-r-0">
                <dt className="text-md text-ink-2 sm:text-xs sm:text-ink-3">{c.label}</dt>
                <dd className="text-md font-semibold text-ink max-sm:text-right">{c.value}</dd>
              </div>
            ))}
          </dl>

          <section aria-label="Progress" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-2 max-sm:justify-between">
              <h2 className="text-lg font-semibold text-ink max-sm:font-medium max-sm:tracking-tight">
                <span className="sm:hidden">Progress</span>
                <span className="max-sm:hidden">Progress · {steps.length === 1 ? "1 step" : `${steps.length} steps`}</span>
              </h2>
              <p className="text-base text-ink-3 max-sm:text-sm">{steps.length === 0 ? "none logged yet" : `${steps.length} logged`}</p>
            </div>
            {late ? <p className="text-sm font-medium text-caution">{late}</p> : null}
            {steps.length === 0 ? (
              <p className="rounded-md border border-line p-5 text-base text-ink-2">
                {order.status === "cancelled" ? "This order was cancelled. Nothing was logged on it." : "Nothing logged yet. Add an update when something happens (PO issued, production started, shipped) and both sides see the same timeline."}
              </p>
            ) : (
              <Timeline items={steps.map((s) => ({ name: s.name, status: s.status, on: s.on, byline: s.byline }))} today={today} className="max-sm:rounded-none max-sm:border-0 max-sm:p-0" />
            )}
          </section>

          <div className={cn(page && "lg:hidden")}>
            <div className="mb-5 h-px bg-line" />
            {details}
          </div>
        </div>
        {page ? <aside className="w-details shrink-0 border-l border-line px-6 py-5 max-lg:hidden">{details}</aside> : null}
      </div>

      {page && (threadId || powers.update) ? (
        <ActionBar className="sticky bottom-0 sm:hidden">
          {threadId ? (
            <Link
              href={`/app/messages/${threadId}`}
              aria-label={`Message ${supplier}`}
              className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-line text-ink outline-none active:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <ChatCircle size={24} weight="thin" aria-hidden />
            </Link>
          ) : null}
          {powers.update ? (
            <div className="min-w-0 flex-1">
              <AddUpdate orderId={order.id} size="touch" full />
            </div>
          ) : null}
        </ActionBar>
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
