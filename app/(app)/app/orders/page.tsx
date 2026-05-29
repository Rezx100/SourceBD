// /app/orders — Order tracking inbox (Spec B8).
//
// Server component. Calls `public.order_list()` under the caller's
// session and groups the result by status (active vs settled). Buyers
// and suppliers both land here; the per-row `viewer_role` discriminator
// lets the UI label each entry.

import Link from "next/link";
import { Package, Plus } from "@phosphor-icons/react/dist/ssr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
            Buyer
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
            Orders
          </h1>
        </div>
        <Button asChild variant="primary" size="sm">
          <Link href="/app/orders/new">
            <Plus size={14} aria-hidden /> New order
          </Link>
        </Button>
      </header>

      {error ? (
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load orders.
          </CardContent>
        </Card>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <Package
              size={32}
              weight="duotone"
              className="mx-auto text-ink-tertiary"
              aria-hidden
            />
            <p className="text-sm text-ink-secondary">
              You don&apos;t have any orders yet.
            </p>
            <p className="text-[12px] text-ink-tertiary">
              Accept an RFQ quote to seed an order, or create one manually from
              a supplier profile.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/rfqs">View RFQs</Link>
            </Button>
          </CardContent>
        </Card>
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
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardMeta>{meta}</CardMeta>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-ink-secondary">
          Nothing here.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardMeta>{meta}</CardMeta>
      </CardHeader>
      <CardContent className="px-0 py-0">
        <ul className="m-0 flex list-none flex-col p-0">
          {rows.map((o) => (
            <li key={o.id} className="border-b border-hairline last:border-b-0">
              <Link
                href={`/app/orders/${o.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand-forest-tint focus:outline-none focus-visible:bg-brand-forest-tint"
              >
                <Package
                  size={20}
                  weight="duotone"
                  className="text-accent-indigo"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-display text-sm font-semibold text-ink-primary">
                      {o.product_title}
                    </span>
                    <Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge>
                    {o.viewer_role !== "buyer" ? (
                      <Badge tone="neutral">As supplier</Badge>
                    ) : null}
                    {o.po_number ? (
                      <span className="font-mono text-[11px] text-ink-tertiary">
                        PO {o.po_number}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-[12px] text-ink-tertiary">
                    {o.supplier_name} · {fmtQty(o.quantity, o.quantity_unit)}
                    {o.total_value != null
                      ? ` · ${fmtMoney(o.total_value, o.currency)}`
                      : ""}
                    {o.latest_milestone
                      ? ` · ${milestoneLabel(o.latest_milestone)}`
                      : ""}
                  </p>
                </div>
                <span className="font-mono text-[11px] text-ink-tertiary">
                  {fmtRelative(o.updated_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function statusTone(s: OrderStatus): "active" | "neutral" | "alert" | "success" {
  if (s === "delivered") return "success";
  if (s === "cancelled") return "alert";
  if (s === "draft") return "neutral";
  return "active";
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
