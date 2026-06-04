// /app/orders/[id] — Order detail (Spec B8).
//
// Server component. Calls `public.order_get(p_id)` under the caller's
// session. Buyer sees status editor + cancel; both parties can append
// milestones.

import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Package, Storefront } from "@phosphor-icons/react/dist/ssr";

import { OrderMilestoneForm } from "@/components/order-milestone-form";
import { OrderStatusEditor } from "@/components/order-status-editor";
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

type Milestone = {
  id: string;
  kind: string;
  label: string | null;
  occurred_on: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

type OrderDoc = {
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
  supplier: {
    id: string;
    slug: string;
    company_name: string;
    entity_type: string;
    city: string | null;
    district: string | null;
  };
  viewer_role: "buyer" | "supplier" | "both";
  milestones: Milestone[];
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("order_get", { p_id: id });
  if (error || data == null) {
    notFound();
  }
  const order = data as OrderDoc;
  const isBuyer = order.viewer_role === "buyer" || order.viewer_role === "both";
  const canEdit = isBuyer && order.status !== "cancelled";
  const canMilestone = order.status !== "cancelled";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-1">
        <p className="text-[11px] text-ink-tertiary">
          Order · {order.id.slice(0, 8)}
          {order.po_number ? ` · PO ${order.po_number}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
            {order.product_title}
          </h1>
          <Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge>
        </div>
        <p className="text-[12px] text-ink-tertiary">
          Created {fmtDate(order.created_at)} · Updated {fmtRelative(order.updated_at)}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Supplier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <Storefront
              size={20}
              weight="duotone"
              className="mt-0.5 text-accent-indigo"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <Link
                href={`/app/suppliers/${order.supplier.slug}`}
                className="font-display text-sm font-semibold text-ink-primary hover:underline"
              >
                {order.supplier.company_name}
              </Link>
              <p className="text-[12px] text-ink-tertiary">
                {entityLabel(order.supplier.entity_type)}
                {order.supplier.city ? ` · ${order.supplier.city}` : ""}
                {order.supplier.district ? `, ${order.supplier.district}` : ""}
              </p>
            </div>
            {order.rfq_id ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/app/rfqs/${order.rfq_id}`}>View RFQ</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Specification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          <Row label="Quantity">
            {fmtNum(order.quantity)} {order.quantity_unit}
          </Row>
          {order.unit_price != null ? (
            <Row label="Unit price">
              {fmtMoney(order.unit_price, order.currency)}
            </Row>
          ) : null}
          {order.total_value != null ? (
            <Row label="Total value">
              {fmtMoney(order.total_value, order.currency)}
            </Row>
          ) : null}
          {order.notes ? (
            <div className="space-y-1">
              <p className="text-[11px] text-ink-tertiary">
                Notes
              </p>
              <p className="whitespace-pre-wrap text-ink-primary">{order.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          {order.incoterm ? <Row label="Incoterm">{order.incoterm}</Row> : null}
          {order.origin_port ? <Row label="Origin port">{order.origin_port}</Row> : null}
          {order.destination_port ? (
            <Row label="Destination port">{order.destination_port}</Row>
          ) : null}
          {order.ship_to_country ? (
            <Row label="Ship to">{order.ship_to_country}</Row>
          ) : null}
          {order.target_ship_date ? (
            <Row label="Target ship">{fmtDate(order.target_ship_date)}</Row>
          ) : null}
          {order.target_delivery_date ? (
            <Row label="Target delivery">{fmtDate(order.target_delivery_date)}</Row>
          ) : null}
          {order.actual_ship_date ? (
            <Row label="Actual ship">{fmtDate(order.actual_ship_date)}</Row>
          ) : null}
          {order.actual_delivery_date ? (
            <Row label="Actual delivery">{fmtDate(order.actual_delivery_date)}</Row>
          ) : null}
          {order.carrier_name ? <Row label="Carrier">{order.carrier_name}</Row> : null}
          {order.tracking_number ? (
            <Row label="Tracking #">
              <span className="font-mono">{order.tracking_number}</span>
            </Row>
          ) : null}
          {!order.incoterm &&
          !order.origin_port &&
          !order.destination_port &&
          !order.ship_to_country &&
          !order.target_ship_date &&
          !order.target_delivery_date &&
          !order.actual_ship_date &&
          !order.actual_delivery_date &&
          !order.carrier_name &&
          !order.tracking_number ? (
            <p className="text-ink-tertiary">No logistics details recorded yet.</p>
          ) : null}
        </CardContent>
      </Card>

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
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
          <CardMeta>
            {order.milestones.length}{" "}
            {order.milestones.length === 1 ? "event" : "events"}
          </CardMeta>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.milestones.length === 0 ? (
            <p className="py-2 text-center text-sm text-ink-secondary">
              <Package
                size={24}
                weight="duotone"
                className="mx-auto block text-ink-tertiary"
                aria-hidden
              />
              No milestones logged yet.
            </p>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {order.milestones.map((m) => (
                <li key={m.id} className="flex items-start gap-3">
                  <CheckCircle
                    size={18}
                    weight="fill"
                    className="mt-0.5 text-accent-indigo"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-semibold text-ink-primary">
                      {m.label && m.label.trim() ? m.label : prettyKind(m.kind)}
                    </p>
                    <p className="text-[12px] text-ink-tertiary">
                      {prettyKind(m.kind)} · {fmtDate(m.occurred_on)}
                    </p>
                    {m.notes ? (
                      <p className="mt-1 whitespace-pre-wrap text-[12px] text-ink-secondary">
                        {m.notes}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {canMilestone ? (
            <div className="border-t border-hairline pt-4">
              <OrderMilestoneForm orderId={order.id} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-40 shrink-0 text-[11px] text-ink-tertiary">
        {label}
      </span>
      <span className="text-ink-primary">{children}</span>
    </div>
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
function entityLabel(et: string) {
  if (et === "factory") return "Factory";
  if (et === "buying_house") return "Buying house";
  return "Supplier";
}
function prettyKind(k: string): string {
  return k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
function fmtNum(n: number) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString() : String(n);
}
function fmtMoney(n: number, ccy: string) {
  const v = Number(n);
  if (!Number.isFinite(v)) return `${n} ${ccy}`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${ccy}`;
}
function fmtDate(iso: string) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return t.toLocaleDateString();
}
function fmtRelative(iso: string) {
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
