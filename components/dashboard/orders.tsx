// Orders in the dashboard kit (Spec B8): the status badge, the status tabs,
// the orders table and the milestone timeline. Server components; the forms
// that write are `components/order-*.tsx`.
//
// Status tones follow the kit: delivered is positive; every other state —
// draft, in production, shipped, in transit, cancelled — is a neutral `type`
// fact. Sanction red is never a status.

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "./chips";
import { Button } from "./controls";
import { Icon } from "./icons";
import { fmtRelative } from "./inbox";
import { Cell, DataTable, EmptyState, ErrorNote, HeadCell } from "./page";
import { Caption } from "./type";

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

export function statusLabel(s: OrderStatus): string {
  if (s === "in_production") return "In production";
  if (s === "in_transit") return "In transit";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function statusTone(s: OrderStatus): BadgeTone {
  return s === "delivered" ? "positive" : "type";
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={statusTone(status)} icon={status === "delivered" ? "check-c" : undefined}>
      {statusLabel(status)}
    </Badge>
  );
}

export function prettyKind(k: string): string {
  return k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function fmtNum(n: number): string {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString() : String(n);
}

export function fmtMoney(n: number, ccy: string): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return `${n} ${ccy}`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${ccy}`;
}

export function fmtDate(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return t.toLocaleDateString();
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
            href={t.value === "all" ? "/app/orders" : `/app/orders?status=${t.value}`}
            prefetch={false}
            aria-current={on ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[26px] items-center gap-1.5 rounded-sm border px-2.5 text-sm font-medium transition-colors duration-fast",
              on ? "border-transparent bg-brand-tint-strong text-brand-ink" : "border-line bg-surface text-ink hover:bg-surface-sunken",
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

/** The orders table. The whole row opens the order (the title link stretches over it). */
export function OrdersTable({ rows, error, tab }: { rows: readonly OrderRow[]; error: boolean; tab: OrderTab }) {
  if (error) return <ErrorNote>{ORDERS_ERROR_COPY}</ErrorNote>;
  if (rows.length === 0 && tab === "all") {
    return (
      <div className="rounded-md border border-line-subtle bg-surface">
        <EmptyState
          icon="box"
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
  return (
    <div className="rounded-md border border-line-subtle bg-surface">
      {n === 0 ? (
        <p className="m-0 px-4 py-8 text-sm text-ink-muted">
          No {ORDER_TABS.find((t) => t.value === tab)?.label.toLowerCase()} orders.
        </p>
      ) : (
        <DataTable label="Orders" minWidth="56rem">
          <thead>
            <tr>
              <HeadCell>Order</HeadCell>
              <HeadCell>Supplier</HeadCell>
              <HeadCell className="text-right">Quantity</HeadCell>
              <HeadCell className="text-right">Value</HeadCell>
              <HeadCell>Status</HeadCell>
              <HeadCell>Ship by · latest milestone</HeadCell>
              <HeadCell className="text-right">Updated</HeadCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="relative transition-colors duration-fast hover:bg-surface-sunken">
                <Cell className="py-2.5">
                  <Link
                    href={`/app/orders/${o.id}`}
                    prefetch={false}
                    className="font-medium text-ink-strong [overflow-wrap:anywhere] after:absolute after:inset-0 after:content-['']"
                  >
                    {o.product_title}
                  </Link>
                  {o.po_number || o.viewer_role !== "buyer" ? (
                    <Caption className="block">
                      {[o.po_number ? `PO ${o.po_number}` : null, o.viewer_role !== "buyer" ? "As supplier" : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </Caption>
                  ) : null}
                </Cell>
                <Cell className="[overflow-wrap:anywhere]">{o.supplier_name}</Cell>
                <Cell className="whitespace-nowrap text-right tabular-nums">
                  {fmtNum(o.quantity)} {o.quantity_unit}
                </Cell>
                <Cell className="whitespace-nowrap text-right tabular-nums">
                  {o.total_value != null ? fmtMoney(o.total_value, o.currency) : <span className="text-quiet-ink">—</span>}
                </Cell>
                <Cell>
                  <OrderStatusBadge status={o.status} />
                </Cell>
                <Cell className="py-2.5">
                  <span className="block tabular-nums">
                    {o.target_ship_date ? fmtDate(o.target_ship_date) : <span className="text-quiet-ink">—</span>}
                  </span>
                  {o.latest_milestone ? (
                    <Caption className="block">
                      {o.latest_milestone.label?.trim() || prettyKind(o.latest_milestone.kind)} ·{" "}
                      {fmtDate(o.latest_milestone.occurred_on)}
                    </Caption>
                  ) : null}
                </Cell>
                <Cell className="whitespace-nowrap text-right tabular-nums text-ink-muted">{fmtRelative(o.updated_at)}</Cell>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
      <div className="px-4 py-3">
        <Caption>{n === 0 ? "0 orders" : `1–${n} of ${n}`}</Caption>
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
        const title = m.label?.trim() || prettyKind(m.kind);
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
                  <time dateTime={m.occurred_on}>{fmtDate(m.occurred_on)}</time>
                </Caption>
              </span>
              {m.label?.trim() ? <Caption>{prettyKind(m.kind)}</Caption> : null}
              {m.notes ? <p className="m-0 whitespace-pre-wrap text-sm text-ink-muted [overflow-wrap:anywhere]">{m.notes}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** A detail page's facts in a narrow column: label over value, only the facts on file. */
export function OrderFacts({ rows }: { rows: readonly { label: string; value: ReactNode }[] }) {
  return (
    <dl className="m-0 flex flex-col">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col gap-0.5 border-t border-line-subtle px-4 py-2.5 first:border-t-0">
          <dt className="text-xs font-medium text-ink-muted">{r.label}</dt>
          <dd className="m-0 text-sm text-ink [overflow-wrap:anywhere]">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
