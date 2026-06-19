// /supplier/rfqs — supplier RFQ inbox (Spec S4).
//
// Server component. Calls the same `public.rfq_list()` RPC as the buyer
// inbox; B7's RPC body already derives a `viewer_role` discriminator
// (`buyer | supplier | both`) and filters visible RFQs to those whose
// `target_supplier_ids` contains a supplier the caller has claimed. We
// filter `viewer_role !== 'buyer'` so the supplier surface is
// unambiguously inbound, mirroring how `/supplier/messages` filters
// `thread_list()` rows.

import { Tray } from "@phosphor-icons/react/dist/ssr";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveTable, type Column } from "@/components/ui/responsive-table";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-kit";

export const dynamic = "force-dynamic";

type Rfq = {
  id: string;
  product_title: string;
  product_description: string | null;
  quantity: number;
  quantity_unit: string;
  target_unit_price: number | null;
  currency: string;
  ship_to_country: string | null;
  ship_by: string | null;
  status: "open" | "accepted" | "closed" | "cancelled";
  accepted_quote_id: string | null;
  target_supplier_count: number;
  quote_count: number;
  viewer_role: "buyer" | "supplier" | "both";
  created_at: string;
  updated_at: string;
};

export default async function SupplierRfqsPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rfq_list", { p_status: null });
  const all: Rfq[] = error || data == null ? [] : (data as Rfq[]);
  const rfqs = all.filter((r) => r.viewer_role !== "buyer");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        kicker="Supplier"
        title="RFQs received"
        description="Quotes buyers have requested from the companies you've claimed."
      />

      {error ? (
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load RFQs.
          </CardContent>
        </Card>
      ) : (
        <ResponsiveTable
          mode="stacked"
          columns={RFQ_COLUMNS}
          rows={rfqs}
          rowKey={(r) => r.id}
          rowHref={(r) => `/supplier/rfqs/${r.id}`}
          caption="RFQs received"
          emptyState={
            <div className="space-y-3 py-4">
              <Tray
                size={32}
                weight="duotone"
                className="mx-auto text-ink-tertiary"
                aria-hidden
              />
              <p className="text-sm text-ink-secondary">No RFQs yet.</p>
              <p className="text-[12px] text-ink-tertiary">
                When a buyer addresses an RFQ to one of your claimed companies
                it will appear here.
              </p>
            </div>
          }
        />
      )}
    </div>
  );
}

const RFQ_COLUMNS: Column<Rfq>[] = [
  {
    key: "rfq",
    label: "RFQ",
    render: (r) => (
      <span className="font-display text-sm font-semibold text-ink-primary">
        {r.product_title}
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (r) => <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>,
  },
  {
    key: "quantity",
    label: "Quantity",
    render: (r) => fmtQty(r.quantity, r.quantity_unit),
  },
  {
    key: "target",
    label: "Target",
    numeric: true,
    render: (r) =>
      r.target_unit_price != null
        ? fmtMoney(r.target_unit_price, r.currency)
        : "—",
  },
  {
    key: "quotes",
    label: "Quotes",
    numeric: true,
    render: (r) => r.quote_count.toLocaleString(),
  },
  {
    key: "updated",
    label: "Updated",
    numeric: true,
    render: (r) => (
      <span className="font-mono text-[11px] text-ink-tertiary">
        {fmtRelative(r.updated_at)}
      </span>
    ),
  },
];

function statusTone(s: Rfq["status"]): "active" | "neutral" | "alert" | "success" {
  if (s === "open") return "active";
  if (s === "accepted") return "success";
  if (s === "cancelled") return "alert";
  return "neutral";
}

function statusLabel(s: Rfq["status"]): string {
  if (s === "open") return "Open";
  if (s === "accepted") return "Accepted";
  if (s === "cancelled") return "Cancelled";
  return "Closed";
}

function fmtQty(qty: number, unit: string): string {
  const n = Number(qty);
  if (!Number.isFinite(n)) return `${qty} ${unit}`;
  return `${n.toLocaleString()} ${unit}`;
}

function fmtMoney(n: number, ccy: string) {
  const v = Number(n);
  if (!Number.isFinite(v)) return `${n} ${ccy}`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${ccy}`;
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
