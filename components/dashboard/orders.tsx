// Orders in the dashboard kit (Spec B8): the status badge, the status tabs,
// the orders table, the milestone timeline and the order itself. The order is
// drawn two ways by ONE component: in a pane beside the table
// (`/app/orders?open=<id>`) and as the full page (`/app/orders/[id]`, kept
// for deep links). Server components; the forms that write are
// `components/order-*.tsx`.
//
// Status tones follow the kit: delivered is positive; every other state —
// draft, in production, shipped, in transit, cancelled — is a neutral `type`
// fact, told apart by its glyph as well as its word. Sanction red is never a
// status.

import Link from "next/link";
import type { ReactNode } from "react";
import { OrderMilestoneForm } from "@/components/order-milestone-form";
import { OrderStatusEditor } from "@/components/order-status-editor";
import { formatCount, formatDay, formatMoney, formatQuantity, formatRelative } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "./chips";
import { Button, Count } from "./controls";
import { Icon, type IconName } from "./icons";
import { entityLabel } from "./inbox";
import { Cell, DataTable, DetailList, EmptyState, ErrorNote, HeadCell, PageHeader, PageSection, rowClass } from "./page";
import { Sheet, SheetBar, SheetScroll } from "./sheet";
import { Caption, Title } from "./type";

export type OrderStatus = "draft" | "in_production" | "shipped" | "in_transit" | "delivered" | "cancelled";

export type OrderRow = {
  id: string;
  supplier_id: string;
  supplier_slug: string;
  supplier_name: string;
  rfq_id: string | null;
  po_number: string | null;
  product_title: string;
  quantity: number;
  quantity_unit: string;
  unit_price: number | null;
  currency: string;
  total_value: number | null;
  incoterm: string | null;
  ship_to_country: string | null;
  target_ship_date: string | null;
  target_delivery_date: string | null;
  actual_ship_date: string | null;
  actual_delivery_date: string | null;
  carrier_name: string | null;
  tracking_number: string | null;
  status: OrderStatus;
  milestone_count: number;
  latest_milestone: { kind: string; label: string | null; occurred_on: string } | null;
  viewer_role: "buyer" | "supplier" | "both";
  created_at: string;
  updated_at: string;
};

export type Milestone = {
  id: string;
  kind: string;
  label: string | null;
  occurred_on: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

/** What `order_get` returns. */
export type OrderDoc = {
  id: string;
  rfq_id: string | null;
  accepted_quote_id: string | null;
  po_number: string | null;
  product_title: string;
  quantity: number;
  quantity_unit: string;
  unit_price: number | null;
  currency: string;
  total_value: number | null;
  incoterm: string | null;
  origin_port: string | null;
  destination_port: string | null;
  ship_to_country: string | null;
  target_ship_date: string | null;
  target_delivery_date: string | null;
  actual_ship_date: string | null;
  actual_delivery_date: string | null;
  carrier_name: string | null;
  tracking_number: string | null;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier: { id: string; slug: string; company_name: string; entity_type: string; city: string | null; district: string | null };
  viewer_role: "buyer" | "supplier" | "both";
  milestones: Milestone[];
};

type OrderRpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

/**
 * One order, and the conversation with its supplier about its RFQ: the reads
 * the page and the pane share, so the two cannot disagree. Null when
 * `order_get` fails or answers nothing (not the caller's, a wrong id) — the
 * page turns that into a 404, the pane into a notice.
 */
export async function readOrder(supabase: OrderRpc, id: string): Promise<{ order: OrderDoc; threadId: string | null } | null> {
  const [{ data, error }, threads] = await Promise.all([supabase.rpc("order_get", { p_id: id }), supabase.rpc("thread_list")]);
  if (error || data == null) return null;
  const order = data as OrderDoc;
  const list = Array.isArray(threads.data) ? (threads.data as { id: string; supplier_id: string; rfq_id: string | null }[]) : [];
  const thread = list.find((t) => t.supplier_id === order.supplier?.id && t.rfq_id === order.rfq_id);
  return { order, threadId: thread?.id ?? null };
}

const ACTIVE: readonly OrderStatus[] = ["draft", "in_production", "shipped", "in_transit"];

export type OrderTab = "all" | "active" | "delivered" | "cancelled";

export const ORDER_TABS: readonly { value: OrderTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export const ORDERS_EMPTY_TITLE = "No orders yet";
export const ORDERS_EMPTY_COPY =
  "Accept an RFQ quote to seed an order, or create one manually from a supplier profile.";
export const ORDERS_ERROR_COPY = "Your orders could not be read just now. Nothing has been lost — try again in a moment.";

export function parseOrderTab(v: string | undefined): OrderTab {
  return ORDER_TABS.some((t) => t.value === v) ? (v as OrderTab) : "all";
}

export function inTab(o: { status: OrderStatus }, tab: OrderTab): boolean {
  if (tab === "all") return true;
  if (tab === "active") return ACTIVE.includes(o.status);
  return o.status === tab;
}

/** The orders list at a tab, with an order open beside it or not. Close is this without `open`. */
export function ordersHref(tab: OrderTab, open?: string | null): string {
  const q = new URLSearchParams();
  if (tab !== "all") q.set("status", tab);
  if (open) q.set("open", open);
  const s = q.toString();
  return s ? `/app/orders?${s}` : "/app/orders";
}

export function statusLabel(s: OrderStatus): string {
  if (s === "in_production") return "In production";
  if (s === "in_transit") return "In transit";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function statusTone(s: OrderStatus): BadgeTone {
  return s === "delivered" ? "positive" : "type";
}

/** Each state's glyph, so five neutral badges are told apart by more than their word. A draft has none. */
export const ORDER_STATUS_ICON: Record<OrderStatus, IconName | undefined> = {
  draft: undefined,
  in_production: "clock",
  shipped: "box",
  in_transit: "box",
  delivered: "check-c",
  cancelled: "x",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={statusTone(status)} icon={ORDER_STATUS_ICON[status]}>
      {statusLabel(status)}
    </Badge>
  );
}

/** The milestone kinds `order_add_milestone` accepts, in the buyer's words. The form offers these; the timeline reads them. */
export const MILESTONE_KINDS = [
  ["po_issued", "PO issued"],
  ["materials_sourced", "Materials sourced"],
  ["production_started", "Production started"],
  ["qc_passed", "QC passed"],
  ["shipped", "Shipped"],
  ["customs_cleared", "Customs cleared"],
  ["delivered", "Delivered"],
  ["custom", "Custom"],
] as const;

export function milestoneKindLabel(kind: string): string {
  return (
    MILESTONE_KINDS.find(([k]) => k === kind)?.[1] ?? kind.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
  );
}

/** The status tabs under the Orders title, each with its count. Links, so a tab is a URL. */
export function OrderTabs({ orders, tab }: { orders: readonly { status: OrderStatus }[]; tab: OrderTab }) {
  return (
    <nav aria-label="Order status" className="flex flex-wrap gap-2">
      {ORDER_TABS.map((t) => {
        const on = t.value === tab;
        const count = orders.filter((o) => inTab(o, t.value)).length;
        return (
          <Link
            key={t.value}
            href={ordersHref(t.value)}
            prefetch={false}
            aria-current={on ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[26px] items-center gap-1.5 rounded-sm border px-2.5 text-sm font-medium transition-colors duration-fast",
              on
                ? "border-transparent bg-brand-tint-strong text-brand-ink shadow-[inset_0_-2px_0_rgb(var(--ds-brand))]"
                : "border-line bg-surface text-ink hover:bg-surface-sunken",
            )}
          >
            {t.label}
            <span className="font-mono text-xs tabular-nums">{count}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const dash = <span className="text-quiet-ink">—</span>;

/**
 * The orders table. The whole row opens the order beside the table (the
 * title link stretches over it, a client navigation that keeps the list's
 * scroll). With an order open (`openId`) the row is marked and the table
 * narrows to what identifies an order — its name, supplier, status and ship
 * date — so it keeps a readable column beside the pane.
 */
export function OrdersTable({
  rows,
  error,
  tab,
  openId = null,
}: {
  rows: readonly OrderRow[];
  error: boolean;
  tab: OrderTab;
  openId?: string | null;
}) {
  if (error) return <ErrorNote>{ORDERS_ERROR_COPY}</ErrorNote>;
  if (rows.length === 0 && tab === "all") {
    return (
      <div className="rounded-md border border-line-subtle bg-surface">
        <EmptyState
          art="orders"
          title={ORDERS_EMPTY_TITLE}
          action={
            <Button href="/app/rfqs" clientNav>
              View RFQs
            </Button>
          }
        >
          {ORDERS_EMPTY_COPY}
        </EmptyState>
      </div>
    );
  }
  const n = rows.length;
  const compact = openId !== null;
  return (
    <div className="rounded-md border border-line-subtle bg-surface">
      {n === 0 ? (
        <p className="m-0 px-4 py-8 text-sm text-ink-muted">
          No {ORDER_TABS.find((t) => t.value === tab)?.label.toLowerCase()} orders.
        </p>
      ) : (
        <DataTable label="Orders" minWidth={compact ? "26rem" : "56rem"}>
          <thead>
            <tr>
              <HeadCell>Order</HeadCell>
              {compact ? null : <HeadCell>Supplier</HeadCell>}
              {compact ? null : <HeadCell align="right">Quantity</HeadCell>}
              {compact ? null : <HeadCell align="right">Value</HeadCell>}
              <HeadCell>Status</HeadCell>
              <HeadCell>Ship by · latest milestone</HeadCell>
              {compact ? null : <HeadCell align="right">Updated</HeadCell>}
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const current = o.id === openId;
              const caption = [
                compact ? o.supplier_name : null,
                o.po_number ? `PO ${o.po_number}` : null,
                o.viewer_role !== "buyer" ? "As supplier" : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <tr key={o.id} aria-current={current ? "true" : undefined} className={rowClass({ current, className: "relative" })}>
                  <Cell className="py-2.5">
                    <Link
                      href={ordersHref(tab, o.id)}
                      prefetch={false}
                      scroll={false}
                      className="font-medium text-ink-strong [overflow-wrap:anywhere] after:absolute after:inset-0 after:content-['']"
                    >
                      {o.product_title}
                    </Link>
                    {caption ? <Caption className="block [overflow-wrap:anywhere]">{caption}</Caption> : null}
                  </Cell>
                  {compact ? null : <Cell className="[overflow-wrap:anywhere]">{o.supplier_name}</Cell>}
                  {compact ? null : (
                    <Cell align="right" className="whitespace-nowrap">
                      {formatQuantity(o.quantity, o.quantity_unit) ?? dash}
                    </Cell>
                  )}
                  {compact ? null : (
                    <Cell align="right" className="whitespace-nowrap">
                      {formatMoney(o.total_value, o.currency) ?? dash}
                    </Cell>
                  )}
                  <Cell>
                    <OrderStatusBadge status={o.status} />
                  </Cell>
                  <Cell className="py-2.5">
                    <span className="block whitespace-nowrap tabular-nums">{formatDay(o.target_ship_date) ?? dash}</span>
                    {o.latest_milestone ? (
                      <Caption className="block">
                        {o.latest_milestone.label?.trim() || milestoneKindLabel(o.latest_milestone.kind)} ·{" "}
                        {formatDay(o.latest_milestone.occurred_on) ?? "—"}
                      </Caption>
                    ) : null}
                  </Cell>
                  {compact ? null : (
                    <Cell align="right" className="whitespace-nowrap text-ink-muted">
                      {formatDay(o.updated_at) ?? "—"}
                    </Cell>
                  )}
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
      <div className="px-4 py-3">
        <Caption>{n === 0 ? "0 orders" : `1–${formatCount(n)} of ${formatCount(n)}`}</Caption>
      </div>
    </div>
  );
}

/** Milestones as a vertical timeline: date, what happened, and any note. Oldest first, as `order_get` returns them. */
export function MilestoneTimeline({ milestones }: { milestones: readonly Milestone[] }) {
  if (milestones.length === 0) {
    return (
      <EmptyState icon="clock" title="No milestones logged yet" className="px-4 py-6">
        Log each step as it happens — PO issued, production started, shipped — and both sides see the same timeline.
      </EmptyState>
    );
  }
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {milestones.map((m, i) => {
        const title = m.label?.trim() || milestoneKindLabel(m.kind);
        const last = i === milestones.length - 1;
        return (
          <li key={m.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? <span aria-hidden className="absolute bottom-0 left-[7px] top-5 w-px bg-line" /> : null}
            <span
              aria-hidden
              className={cn(
                "mt-1 grid size-[15px] shrink-0 place-items-center rounded-full border",
                m.kind === "delivered" ? "border-positive bg-positive-tint text-positive-ink" : "border-line-strong bg-surface text-ink-muted",
              )}
            >
              <Icon name="check" small className="size-[9px]" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium text-ink-strong [overflow-wrap:anywhere]">{title}</span>
                <Caption className="tabular-nums">
                  <time dateTime={m.occurred_on}>{formatDay(m.occurred_on) ?? m.occurred_on}</time>
                </Caption>
              </span>
              {m.label?.trim() ? <Caption>{milestoneKindLabel(m.kind)}</Caption> : null}
              {m.notes ? <p className="m-0 whitespace-pre-wrap text-sm text-ink-muted [overflow-wrap:anywhere]">{m.notes}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

type Fact = { label: string; value: ReactNode };
const onFile = (rows: Fact[]) => rows.filter((r) => r.value != null && r.value !== "");

/** The order's facts in three groups, each with only the facts on file and its count; a group with none is left out. */
export function orderFactGroups(order: OrderDoc): { title: string; rows: Fact[] }[] {
  const place = [order.supplier.city, order.supplier.district].filter(Boolean).join(", ");
  return [
    {
      title: "Commercial",
      rows: onFile([
        {
          label: "Supplier",
          value: (
            <>
              <Link href={`/app/suppliers/${order.supplier.slug}`} prefetch={false} className="font-medium text-brand-ink hover:underline">
                {order.supplier.company_name}
              </Link>
              <Caption className="block">
                {entityLabel(order.supplier.entity_type)}
                {place ? ` · ${place}` : ""}
              </Caption>
            </>
          ),
        },
        { label: "Quantity", value: formatQuantity(order.quantity, order.quantity_unit) },
        { label: "Unit price", value: formatMoney(order.unit_price, order.currency) },
        { label: "Total value", value: formatMoney(order.total_value, order.currency) },
        { label: "PO number", value: order.po_number },
      ]),
    },
    {
      title: "Route",
      rows: onFile([
        { label: "Incoterm", value: order.incoterm },
        { label: "Origin port", value: order.origin_port },
        { label: "Destination port", value: order.destination_port },
        { label: "Ship to", value: order.ship_to_country },
        { label: "Carrier", value: order.carrier_name },
        { label: "Tracking number", value: order.tracking_number ? <span className="font-mono">{order.tracking_number}</span> : null },
      ]),
    },
    {
      title: "Dates",
      rows: onFile([
        { label: "Target ship", value: formatDay(order.target_ship_date) },
        { label: "Target delivery", value: formatDay(order.target_delivery_date) },
        { label: "Actual ship", value: formatDay(order.actual_ship_date) },
        { label: "Actual delivery", value: formatDay(order.actual_delivery_date) },
      ]),
    },
  ].filter((g) => g.rows.length > 0);
}

/**
 * The order: its facts, its milestone timeline and its status with the
 * buyer's editor. `pane` draws it beside the orders table in a sheet with a
 * Close (`closeHref`, the list it came from) and one column; `page` is the
 * full page at `/app/orders/[id]`, three columns from `xl`. Both parties can
 * log milestones; only the buyer edits; the server enforces both.
 */
export function OrderDetail({
  order,
  threadId,
  mode = "page",
  closeHref = "/app/orders",
}: {
  order: OrderDoc;
  threadId: string | null;
  mode?: "page" | "pane";
  closeHref?: string;
}) {
  const isBuyer = order.viewer_role === "buyer" || order.viewer_role === "both";
  const canEdit = isBuyer && order.status !== "cancelled";
  const canMilestone = order.status !== "cancelled";
  const events = order.milestones.length;
  const caption = [order.po_number ? `PO ${order.po_number}` : null, `Created ${formatDay(order.created_at) ?? "—"}`]
    .filter(Boolean)
    .join(" · ");

  const facts = (
    <PageSection title="Order facts">
      {orderFactGroups(order).map((g, i) => (
        <div key={g.title} className={cn("pt-3", i > 0 && "border-t border-line-subtle")}>
          <h3 className="m-0 flex items-baseline gap-1.5 px-4 text-sm font-semibold text-ink-strong">
            {g.title}
            <Count>{g.rows.length}</Count>
          </h3>
          <DetailList rows={g.rows} />
        </div>
      ))}
      {order.notes ? (
        <div className="flex flex-col gap-1 border-t border-line-subtle px-4 py-3">
          <h3 className="m-0 text-sm font-semibold text-ink-strong">Notes</h3>
          <p className="m-0 whitespace-pre-wrap text-base text-ink [overflow-wrap:anywhere]">{order.notes}</p>
        </div>
      ) : null}
    </PageSection>
  );

  const milestones = (
    <PageSection title="Milestones" caption={`${formatCount(events)} ${events === 1 ? "event" : "events"}`}>
      <div className="p-4 sm:p-5">
        <MilestoneTimeline milestones={order.milestones} />
      </div>
      {canMilestone ? (
        <div className="border-t border-line-subtle px-4 py-3 sm:px-5">
          <OrderMilestoneForm orderId={order.id} kinds={MILESTONE_KINDS} />
        </div>
      ) : null}
    </PageSection>
  );

  const status = (
    <PageSection title="Status">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <Caption>Updated {formatRelative(order.updated_at) ?? "—"}</Caption>
        </div>
        {order.rfq_id || threadId ? (
          <div className="flex flex-wrap gap-2">
            {order.rfq_id ? (
              <Button href={`/app/rfqs?open=${encodeURIComponent(order.rfq_id)}`} clientNav>
                View RFQ
              </Button>
            ) : null}
            {threadId ? (
              <Button href={`/app/messages/${threadId}`} clientNav>
                <Icon name="chat" /> Open conversation
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="border-t border-line-subtle p-4">
        {canEdit ? (
          <OrderStatusEditor
            orderId={order.id}
            initial={{
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
            }}
          />
        ) : (
          <p className="m-0 text-sm text-ink-muted">
            {order.status === "cancelled"
              ? "This order was cancelled. Its details and milestones stay on file."
              : "Only the buyer can change the status and shipping details. You can log milestones."}
          </p>
        )}
      </div>
    </PageSection>
  );

  if (mode === "pane") {
    return (
      <Sheet label={`Order: ${order.product_title}`}>
        <SheetBar>
          <Button variant="ghost" icon size="sm" aria-label="Close" href={closeHref} clientNav scroll={false}>
            <Icon name="x" />
          </Button>
          <div className="flex min-w-0 flex-1 flex-col">
            <Title as="h2">{order.product_title}</Title>
            <Caption>{caption}</Caption>
          </div>
          <Button variant="ghost" size="sm" href={`/app/orders/${order.id}`} clientNav>
            Full page
          </Button>
        </SheetBar>
        <SheetScroll>
          {/* The page's own ground, so the sections read as they do on the full page. */}
          <div className="flex min-h-full flex-col gap-5 bg-canvas p-4 sm:p-5">
            {status}
            {milestones}
            {facts}
          </div>
        </SheetScroll>
      </Sheet>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={order.product_title}
        caption={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <OrderStatusBadge status={order.status} />
            <span>{caption}</span>
          </span>
        }
        actions={
          <Button href="/app/orders" clientNav>
            <Icon name="chev-l" /> All orders
          </Button>
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)_20rem]">
        {facts}
        {milestones}
        <div className="lg:col-span-2 xl:col-span-1">{status}</div>
      </div>
    </div>
  );
}
