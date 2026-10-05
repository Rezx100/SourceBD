// The words and sums of the buyer's order pages (Paper `10`/`11` · RFQs, quotes, orders: Orders
// list, Order detail timeline, New order, Cancel order). Pure: no React and no data access, so
// a test can pin every sentence a buyer reads. Only what `order_list` and `order_get` hold is
// said: there are no planned steps and no "late" step, so lateness is the ship-by date passing on
// an order that has not shipped.

import { money, perUnit, quantityWords } from "@/components/rfqs/words";
import { daysUntil, formatDay, formatRelative } from "@/lib/dashboard/facts";

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
  status: OrderStatus;
  milestone_count: number;
  latest_milestone: { kind: string; label: string | null; occurred_on: string } | null;
  viewer_role: "buyer" | "supplier" | "both";
  created_at: string;
  updated_at: string;
};

export type OrderMilestone = { id: string; kind: string; label: string | null; occurred_on: string; notes: string | null; created_by: string | null; created_at: string };

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
  milestones: OrderMilestone[];
};

// ---- tabs ----

export const ORDER_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "progress", label: "In progress" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
] as const;
export type OrderTab = (typeof ORDER_TABS)[number]["key"];

const IN_PROGRESS: readonly OrderStatus[] = ["in_production", "shipped", "in_transit"];

export function inTab(o: { status: OrderStatus }, tab: OrderTab): boolean {
  if (tab === "all") return true;
  if (tab === "progress") return IN_PROGRESS.includes(o.status);
  return o.status === tab;
}

/** `?status=`: today's links used `active`, and still open the right tab. */
export function parseOrderTab(v: unknown): OrderTab {
  if (v === "active") return "progress";
  return ORDER_TABS.some((t) => t.key === v) ? (v as OrderTab) : "all";
}

/** The list at a tab, with an order open beside it or not. Close is this without `open`. */
export function ordersHref(tab: OrderTab, open?: string | null): string {
  const q = new URLSearchParams();
  if (tab !== "all") q.set("status", tab);
  if (open) q.set("open", open);
  const s = q.toString();
  return s ? `/app/orders?${s}` : "/app/orders";
}

// ---- status ----

export type OrderChipTone = "draft" | "production" | "shipped" | "delivered" | "cancelled";

export const STATUS_WORDS: Record<OrderStatus, { tone: OrderChipTone; label: string }> = {
  draft: { tone: "draft", label: "Draft" },
  in_production: { tone: "production", label: "In production" },
  shipped: { tone: "shipped", label: "Shipped" },
  in_transit: { tone: "shipped", label: "In transit" },
  delivered: { tone: "delivered", label: "Delivered" },
  cancelled: { tone: "cancelled", label: "Cancelled" },
};

/** Once goods are on their way the order cannot be cancelled from here (OR-02; `order_cancel` refuses it too). */
export const CANCELLABLE: readonly OrderStatus[] = ["draft", "in_production"];

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

export function milestoneName(m: { kind: string; label: string | null }): string {
  return m.label?.trim() || MILESTONE_KINDS.find(([k]) => k === m.kind)?.[1] || m.kind.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

// ---- the list ----

export type OrderItem = {
  id: string;
  title: string;
  /** "PO-2026-0917" or "No PO number yet". */
  po: string | null;
  supplier: string;
  qty: string;
  /** "US$84,000", or null when the order has no price yet. */
  value: string | null;
  chip: { tone: OrderChipTone; label: string };
  /** The two lines under "Ship by · latest update"; `late` is caution. */
  dates: { line: string; sub: string | null; late: string | null };
  /** The phone's one line: "Mondol Fabrics Ltd. · US$84,000 · 20,000 pieces". */
  phone: string;
  asSupplier: boolean;
};

/** "3 days late": a ship-by date that has passed on an order that is still a draft or in production. */
export function shipLate(o: Pick<OrderRow, "status" | "target_ship_date">, today: Date): string | null {
  if (o.status !== "draft" && o.status !== "in_production") return null;
  const d = daysUntil(o.target_ship_date, today);
  if (d === null || d >= 0) return null;
  return `Ship by date passed: ${-d} ${d === -1 ? "day" : "days"} late`;
}

function dateLines(o: OrderRow, today: Date): OrderItem["dates"] {
  const ship = formatDay(o.target_ship_date);
  const latest = o.latest_milestone ? `${milestoneName(o.latest_milestone)} · ${formatDay(o.latest_milestone.occurred_on) ?? "—"}` : null;
  switch (o.status) {
    case "delivered":
      return { line: `Delivered ${formatDay(o.actual_delivery_date) ?? formatDay(o.updated_at) ?? "—"}`, sub: null, late: null };
    case "cancelled":
      return { line: "Cancelled", sub: `Updated ${formatDay(o.updated_at) ?? "—"}`, late: null };
    case "shipped":
    case "in_transit": {
      const left = formatDay(o.actual_ship_date);
      const due = formatDay(o.target_delivery_date);
      return { line: left ? `Shipped ${left}` : ship ? `Ship by ${ship}` : "Shipped", sub: due ? `Due ${due}` : latest, late: null };
    }
    case "draft":
      return { line: ship ? `Ship by ${ship}` : "No ship-by date yet", sub: `Saved ${formatDay(o.created_at) ?? "—"}`, late: shipLate(o, today) };
    default:
      return { line: ship ? `Ship by ${ship}` : "No ship-by date yet", sub: latest, late: shipLate(o, today) };
  }
}

export function buildOrderItems(rows: readonly OrderRow[], today: Date): OrderItem[] {
  return rows.map((o) => {
    const value = o.total_value !== null && o.total_value !== undefined ? money(Number(o.total_value), o.currency) : null;
    const qty = quantityWords(o.quantity, o.quantity_unit);
    const dates = dateLines(o, today);
    return {
      id: o.id,
      title: o.product_title,
      po: o.po_number,
      supplier: o.supplier_name,
      qty,
      value,
      chip: STATUS_WORDS[o.status] ?? STATUS_WORDS.draft,
      dates,
      phone: [o.supplier_name, value ?? "no price yet", qty].join(" · "),
      asSupplier: o.viewer_role === "supplier",
    };
  });
}

/** "4 orders · 2 in progress". */
export function listCaption(rows: readonly Pick<OrderRow, "status">[]): string {
  const n = rows.length;
  return `${n} ${n === 1 ? "order" : "orders"} · ${rows.filter((o) => inTab(o, "progress")).length} in progress`;
}

// ---- the order ----

export type SummaryCell = { label: string; value: string };

export function summaryCells(o: OrderDoc): SummaryCell[] {
  return [
    { label: "Order value", value: o.total_value !== null ? money(Number(o.total_value), o.currency) : "No price yet" },
    { label: "Price", value: o.unit_price !== null ? `${money(Number(o.unit_price), o.currency)} per ${perUnit(o.quantity_unit)}` : "No price yet" },
    { label: "Quantity", value: quantityWords(o.quantity, o.quantity_unit) },
    { label: "Ship by", value: formatDay(o.target_ship_date) ?? "Not set" },
  ];
}

const entityLabel = (et: string) => (et === "factory" ? "Factory" : et === "buying_house" ? "Buying house" : "Supplier");

/** "Factory · Kashimpur, Gazipur". */
export function supplierLine(s: OrderDoc["supplier"]): string {
  return [entityLabel(s.entity_type), [s.city, s.district].filter(Boolean).join(", ") || null].filter(Boolean).join(" · ");
}

export type DetailRow = { label: string; value: string };
export type DetailGroup = { title: string; rows: DetailRow[] };

/** "Shipping" and "Dates": only the facts on file; a group with none is left out. "Tracking" says when it will be added. */
export function detailGroups(o: OrderDoc): DetailGroup[] {
  const on = (rows: [string, string | null][]): DetailRow[] => rows.filter((r): r is [string, string] => r[1] != null && r[1] !== "").map(([label, value]) => ({ label, value }));
  const shipping = on([
    ["Incoterm", o.incoterm],
    ["From port", o.origin_port],
    ["To port", o.destination_port],
    ["Ship to", o.ship_to_country],
    ["Carrier", o.carrier_name],
    ["Tracking", o.tracking_number ?? (o.status === "cancelled" || o.status === "delivered" ? null : "Added when it ships")],
  ]);
  const dates = on([
    ["Ship by", formatDay(o.target_ship_date)],
    ["Left", formatDay(o.actual_ship_date)],
    ["Deliver by", formatDay(o.target_delivery_date)],
    ["Delivered", formatDay(o.actual_delivery_date)],
  ]);
  return [
    ...(shipping.length ? [{ title: "Shipping", rows: shipping }] : []),
    ...(dates.length ? [{ title: "Dates", rows: dates }] : []),
  ];
}

export type OrderStep = { name: string; status: "done" | "now"; on: string; byline: string };

/**
 * The timeline's steps, oldest first (`order_get` returns newest first). Every step is one that
 * was logged; while the order is in progress the latest one is "now". The byline says who logged
 * it: "you" when the milestone's author is the viewer, else the supplier.
 */
export function orderSteps(o: OrderDoc, viewerId: string | null): OrderStep[] {
  const asc = [...o.milestones].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on) || a.created_at.localeCompare(b.created_at));
  const live = o.status === "in_production" || o.status === "shipped" || o.status === "in_transit";
  return asc.map((m, i) => {
    const who = m.created_by === null ? null : viewerId && m.created_by === viewerId ? "you" : o.supplier.company_name;
    const note = m.notes?.trim();
    return {
      name: milestoneName(m),
      status: live && i === asc.length - 1 ? "now" : "done",
      on: m.occurred_on,
      byline: [who ? `Logged by ${who}` : "Logged", note ? note : null].filter(Boolean).join(" · "),
    };
  });
}

/** "Started 22 Aug 2026 from your accepted quote · updated 2 days ago". */
export function startedLine(o: OrderDoc): string {
  return `Started ${formatDay(o.created_at) ?? "—"}${o.rfq_id ? " from your accepted quote" : ""} · updated ${formatRelative(o.updated_at) ?? formatDay(o.updated_at) ?? "—"}`;
}

/** What the cancel dialog names: "Women's knitted dresses · Mondol Fabrics Ltd. · 20,000 pieces · US$84,000". */
export function cancelSummary(o: OrderDoc): string {
  return [o.product_title, o.supplier.company_name, quantityWords(o.quantity, o.quantity_unit), o.total_value !== null ? money(Number(o.total_value), o.currency) : null].filter(Boolean).join(" · ");
}

export const cancelTitle = (o: Pick<OrderDoc, "po_number" | "product_title">) => `Cancel order ${o.po_number ?? o.product_title}?`;

/** What an order of this status lets the viewer do. The server enforces each of these too. */
export function orderPowers(o: Pick<OrderDoc, "viewer_role" | "status">) {
  const buyer = o.viewer_role === "buyer" || o.viewer_role === "both";
  return {
    buyer,
    edit: buyer && o.status !== "cancelled",
    cancel: buyer && CANCELLABLE.includes(o.status),
    update: o.status !== "cancelled",
  };
}
