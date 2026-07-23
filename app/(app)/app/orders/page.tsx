// /app/orders — Order tracking inbox (Spec B8), FE-SITEWIDE Phase C5.
//
// Server component. Calls `public.order_list()` under the caller's
// session and groups the result by status (active vs settled) inside
// `.proto-card` containers with `.proto-nav-item` rows.

import Link from "next/link";
import { Package, Plus } from "@phosphor-icons/react/dist/ssr";

import {
  DataList,
  EmptyState,
  PageHeader,
  Pill,
  Section,
  type PillTone,
} from "@/components/ui/page-kit";
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
      <PageHeader
        kicker="Buyer"
        title="Orders"
        description="Track production and shipping milestones for your accepted orders."
        actions={
          <Link
            href="/app/orders/new"
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand-forest px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-forest-mid"
          >
            <Plus size={16} weight="bold" aria-hidden /> New order
          </Link>
        }
      />

      {error ? (
        <div className="rounded-card border border-sem-red/30 bg-sem-red-soft p-4 text-sm text-sem-red">
          Could not load orders.
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Package size={26} weight="duotone" aria-hidden />}
          title="No orders yet"
          description="Accept an RFQ quote to seed an order, or create one manually from a supplier profile."
          action={
            <Link
              href="/app/rfqs"
              className="inline-flex items-center rounded-pill border border-hairline-strong bg-surface-l1 px-4 py-2 text-sm font-semibold text-ink-primary transition-colors hover:bg-brand-forest-tint"
            >
              View RFQs
            </Link>
          }
        />
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
      <Section title={title} actions={<span className="font-mono text-[12px] text-ink-tertiary">{meta}</span>}>
        <div className="rounded-card border border-hairline bg-surface-l1 p-6 text-center text-sm text-ink-secondary">
          Nothing here.
        </div>
      </Section>
    );
  }
  return (
    <Section title={title} actions={<span className="font-mono text-[12px] text-ink-tertiary">{meta}</span>}>
      <DataList>
        {rows.map((o) => (
          <li key={o.id}>
            <Link
              href={`/app/orders/${o.id}`}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-hover ease-smooth hover:bg-brand-forest-tint"
            >
              <Package
                size={18}
                weight="duotone"
                className="shrink-0 text-brand-forest"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-display text-sm font-semibold text-ink-primary">
                    {o.product_title}
                  </span>
                  <Pill tone={statusTone(o.status)}>{statusLabel(o.status)}</Pill>
                  {o.viewer_role !== "buyer" ? (
                    <Pill tone="neutral">As supplier</Pill>
                  ) : null}
                  {o.po_number ? (
                    <span className="text-[12px] text-ink-tertiary">
                      PO {o.po_number}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-[13px] text-ink-tertiary">
                  {o.supplier_name} · {fmtQty(o.quantity, o.quantity_unit)}
                  {o.total_value != null
                    ? ` · ${fmtMoney(o.total_value, o.currency)}`
                    : ""}
                  {o.latest_milestone
                    ? ` · ${milestoneLabel(o.latest_milestone)}`
                    : ""}
                </p>
              </div>
              <span className="shrink-0 text-[12px] text-ink-tertiary">
                {fmtRelative(o.updated_at)}
              </span>
            </Link>
          </li>
        ))}
      </DataList>
    </Section>
  );
}

function statusTone(s: OrderStatus): PillTone {
  if (s === "delivered") return "green";
  if (s === "cancelled") return "red";
  return "neutral";
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
