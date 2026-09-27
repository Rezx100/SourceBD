// /app/orders/[id] — Order detail (Spec B8), in the dashboard kit.
//
// Server component. Calls `public.order_get(p_id)` under the caller's session,
// and `thread_list()` beside it to link the conversation with this supplier
// about this RFQ. Facts on the left, the milestone timeline in the middle, and
// a side card with the status, the links and — for the buyer — the editor.
// Both parties can append milestones; the server enforces who may do what.

import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/dashboard/controls";
import { Icon } from "@/components/dashboard/icons";
import { entityLabel, fmtRelative } from "@/components/dashboard/inbox";
import {
  MilestoneTimeline,
  OrderFacts,
  OrderStatusBadge,
  fmtDate,
  fmtMoney,
  fmtNum,
  type Milestone,
  type OrderStatus,
} from "@/components/dashboard/orders";
import { PageHeader, PageSection } from "@/components/dashboard/page";
import { Caption } from "@/components/dashboard/type";
import { OrderMilestoneForm } from "@/components/order-milestone-form";
import { OrderStatusEditor } from "@/components/order-status-editor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/dashboard/app-shell";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";

export const dynamic = "force-dynamic";

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

type ThreadRef = { id: string; supplier_id: string; rfq_id: string | null };

async function OrderDetailPageBody({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, threadsRes] = await Promise.all([
    supabase.rpc("order_get", { p_id: id }),
    supabase.rpc("thread_list"),
  ]);
  if (error || data == null) {
    notFound();
  }
  const order = data as OrderDoc;
  const isBuyer = order.viewer_role === "buyer" || order.viewer_role === "both";
  const canEdit = isBuyer && order.status !== "cancelled";
  const canMilestone = order.status !== "cancelled";
  const thread = ((threadsRes.data ?? []) as ThreadRef[]).find(
    (t) => t.supplier_id === order.supplier.id && t.rfq_id === order.rfq_id,
  );

  const place = [order.supplier.city, order.supplier.district].filter(Boolean).join(", ");
  const facts: { label: string; value: ReactNode }[] = [
    {
      label: "Supplier",
      value: (
        <>
          <Link
            href={`/app/suppliers/${order.supplier.slug}`}
            prefetch={false}
            className="font-medium text-brand-ink hover:underline"
          >
            {order.supplier.company_name}
          </Link>
          <Caption className="block">
            {entityLabel(order.supplier.entity_type)}
            {place ? ` · ${place}` : ""}
          </Caption>
        </>
      ),
    },
    {
      label: "Quantity",
      value: (
        <span className="tabular-nums">
          {fmtNum(order.quantity)} {order.quantity_unit}
        </span>
      ),
    },
  ];
  const add = (label: string, value: ReactNode) => {
    if (value != null && value !== "") facts.push({ label, value });
  };
  add("Unit price", order.unit_price != null ? fmtMoney(order.unit_price, order.currency) : null);
  add("Total value", order.total_value != null ? fmtMoney(order.total_value, order.currency) : null);
  add("PO number", order.po_number);
  add("Incoterm", order.incoterm);
  add("Origin port", order.origin_port);
  add("Destination port", order.destination_port);
  add("Ship to", order.ship_to_country);
  add("Target ship", order.target_ship_date ? fmtDate(order.target_ship_date) : null);
  add("Target delivery", order.target_delivery_date ? fmtDate(order.target_delivery_date) : null);
  add("Actual ship", order.actual_ship_date ? fmtDate(order.actual_ship_date) : null);
  add("Actual delivery", order.actual_delivery_date ? fmtDate(order.actual_delivery_date) : null);
  add("Carrier", order.carrier_name);
  add("Tracking #", order.tracking_number ? <span className="font-mono">{order.tracking_number}</span> : null);
  add("Notes", order.notes ? <span className="whitespace-pre-wrap">{order.notes}</span> : null);

  const events = order.milestones.length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={order.product_title}
        caption={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <OrderStatusBadge status={order.status} />
            <span>
              Order {order.id.slice(0, 8)}
              {order.po_number ? ` · PO ${order.po_number}` : ""} · Created {fmtDate(order.created_at)} · Updated{" "}
              {fmtRelative(order.updated_at)}
            </span>
          </span>
        }
        actions={
          <Button href="/app/orders" clientNav>
            <Icon name="chev-l" /> All orders
          </Button>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <PageSection title="Order facts">
          <OrderFacts rows={facts} />
        </PageSection>

        <PageSection title="Milestones" caption={`${events} ${events === 1 ? "event" : "events"}`}>
          <div className="p-4 sm:p-5">
            <MilestoneTimeline milestones={order.milestones} />
          </div>
          {canMilestone ? (
            <div className="border-t border-line-subtle p-4 sm:p-5">
              <OrderMilestoneForm orderId={order.id} />
            </div>
          ) : null}
        </PageSection>

        <PageSection title="Status" className="lg:col-span-2 xl:col-span-1">
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={order.status} />
              <Caption>Updated {fmtRelative(order.updated_at)}</Caption>
            </div>
            {order.rfq_id || thread ? (
              <div className="flex flex-wrap gap-2">
                {order.rfq_id ? (
                  <Button href={`/app/rfqs/${order.rfq_id}`} clientNav>
                    View RFQ
                  </Button>
                ) : null}
                {thread ? (
                  <Button href={`/app/messages/${thread.id}`} clientNav>
                    <Icon name="chat" /> Open conversation
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="border-t border-line-subtle p-4">
            {canEdit ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <h3 className="m-0 text-sm font-semibold text-ink-strong">Update order</h3>
                  <Caption>Only the buyer can change the status and shipping details.</Caption>
                </div>
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
              </div>
            ) : (
              <p className="m-0 text-sm text-ink-muted">
                {order.status === "cancelled"
                  ? "This order was cancelled. Its details and milestones stay on file."
                  : "Only the buyer can change the status and shipping details. You can log milestones."}
              </p>
            )}
          </div>
        </PageSection>
      </div>
    </div>
  );
}

// The kit's shell on every buyer page (one sidebar, one topbar), read in the
// same wave as the page's own data.
export default async function OrderDetailPage(props: Parameters<typeof OrderDetailPageBody>[0]) {
  const supabase = await createSupabaseServerClient();
  const [shell, body] = await Promise.all([loadBuyerShell(supabase, "/app/orders/x"), OrderDetailPageBody(props)]);
  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Order">
      {body}
    </AppShell>
  );
}
