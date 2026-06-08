// /app/orders — Order tracking inbox (Spec B8), FE-SITEWIDE Phase C5.
//
// Server component. Calls `public.order_list()` under the caller's
// session and groups the result by status (active vs settled) inside
// `.proto-card` containers with `.proto-nav-item` rows.

import Link from "next/link";
import { Package, Plus } from "@phosphor-icons/react/dist/ssr";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ResponsiveTable,
  type Column,
} from "@/components/ui/responsive-table";

export const dynamic = "force-dynamic";

type OrderStatus =
  | "draft"
  | "in_production"
  | "shipped"
  | "in_transit"
  | "delivered"
  | "cancelled";

type OrderRow = {
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
  latest_milestone: {
    kind: string;
    label: string | null;
    occurred_on: string;
  } | null;
  viewer_role: "buyer" | "supplier" | "both";
  created_at: string;
  updated_at: string;
};

const ACTIVE: OrderStatus[] = ["draft", "in_production", "shipped", "in_transit"];

export default async function OrdersPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("order_list", { p_status: null });
  const orders: OrderRow[] = error || data == null ? [] : (data as OrderRow[]);
  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const settled = orders.filter((o) => !ACTIVE.includes(o.status));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-ink-tertiary">
            Buyer
          </p>
          <h1 className="font-display text-3xl font-light tracking-tight text-ink-primary">
            Orders
          </h1>
        </div>
        <Link
          href="/app/orders/new"
          className="btn-proto primary inline-flex items-center gap-1.5"
        >
          <Plus size={12} weight="bold" aria-hidden /> New order
        </Link>
      </header>

      {error ? (
        <div className="proto-card text-sm text-sem-red">Could not load orders.</div>
      ) : orders.length === 0 ? (
        <div className="proto-card space-y-3 text-center">
          <Package
            size={32}
            weight="duotone"
            className="mx-auto text-ink-tertiary"
            aria-hidden
          />
          <p className="affiliation-disclaimer">
            You don&apos;t have any orders yet.
          </p>
          <p className="affiliation-disclaimer">
            Accept an RFQ quote to seed an order, or create one manually from a
            supplier profile.
          </p>
          <Link href="/app/rfqs" className="btn-proto inline-flex">
            View RFQs
          </Link>
        </div>
      ) : (
        <>
          <OrderGroup title="Active" meta={`${active.length}`} rows={active} />
          {settled.length > 0 ? (
            <OrderGroup title="Settled" meta={`${settled.length}`} rows={settled} />
          ) : null}
        </>
      )}
    </div>
  );
}

function OrderGroup({
  title,
  meta,
  rows,
}: {
  title: string;
  meta: string;
  rows: OrderRow[];
}) {
  if (rows.length === 0) {
    return (
      <section className="proto-card">
        <div className="proto-card-head">
          <h2 className="proto-card-title">{title}</h2>
          <span className="proto-card-meta">{meta}</span>
        </div>
        <p className="text-center text-sm text-ink-secondary">Nothing here.</p>
      </section>
    );
  }
  return (
    <section className="proto-card p-0">
      <div className="proto-card-head px-5 pt-5">
        <h2 className="proto-card-title">{title}</h2>
        <span className="proto-card-meta pr-5">{meta}</span>
      </div>
      <div className="px-5 pb-5 pt-3">
        <ResponsiveTable
          columns={ORDER_COLUMNS}
          rows={rows}
          rowKey={(o) => o.id}
          rowHref={(o) => `/app/orders/${o.id}`}
          caption={`${title} orders`}
        />
      </div>
    </section>
  );
}

const ORDER_COLUMNS: Column<OrderRow>[] = [
  {
    key: "product",
    label: "Product",
    render: (o) => (
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-sm font-medium text-ink-primary">
          {o.product_title}
        </span>
        <span className={statusChip(o.status)}>{statusLabel(o.status)}</span>
        {o.viewer_role !== "buyer" ? (
          <span className="chip">As supplier</span>
        ) : null}
        {o.po_number ? (
          <span className="text-[11px] text-ink-tertiary">PO {o.po_number}</span>
        ) : null}
      </div>
    ),
  },
  {
    key: "supplier",
    label: "Supplier",
    render: (o) => o.supplier_name,
  },
  {
    key: "quantity",
    label: "Quantity",
    render: (o) => fmtQty(o.quantity, o.quantity_unit),
  },
  {
    key: "value",
    label: "Value",
    numeric: true,
    render: (o) =>
      o.total_value != null ? fmtMoney(o.total_value, o.currency) : "\u2014",
  },
  {
    key: "milestone",
    label: "Latest",
    render: (o) => (o.latest_milestone ? milestoneLabel(o.latest_milestone) : "\u2014"),
  },
  {
    key: "updated",
    label: "Updated",
    numeric: true,
    render: (o) => fmtRelative(o.updated_at),
  },
];

function statusChip(s: OrderStatus): string {
  if (s === "delivered") return "chip claim-verified";
  if (s === "cancelled")
    return "chip !bg-sem-red-soft !text-sem-red !border-sem-red";
  if (s === "draft") return "chip";
  return "chip";
}
function statusLabel(s: OrderStatus): string {
  if (s === "in_production") return "In production";
  if (s === "in_transit") return "In transit";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function milestoneLabel(m: { kind: string; label: string | null; occurred_on: string }): string {
  const base = m.label && m.label.trim() ? m.label : prettyKind(m.kind);
  return `${base} (${fmtDate(m.occurred_on)})`;
}
function prettyKind(k: string): string {
  return k.replace(/_/g, " ");
}
function fmtQty(qty: number, unit: string): string {
  const n = Number(qty);
  if (!Number.isFinite(n)) return `${qty} ${unit}`;
  return `${n.toLocaleString()} ${unit}`;
}
function fmtMoney(n: number, ccy: string): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return `${n} ${ccy}`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${ccy}`;
}
function fmtDate(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return t.toLocaleDateString();
}
function fmtRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const delta = Date.now() - t;
  const day = 86_400_000;
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < day) return `${Math.floor(delta / 3_600_000)}h ago`;
  if (delta < 30 * day) return `${Math.floor(delta / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}
