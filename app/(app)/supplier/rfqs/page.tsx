// /supplier/rfqs — supplier RFQ inbox (Spec S4).
//
// Server component. Calls the same `public.rfq_list()` RPC as the buyer
// inbox; B7's RPC body already derives a `viewer_role` discriminator
// (`buyer | supplier | both`) and filters visible RFQs to those whose
// `target_supplier_ids` contains a supplier the caller has claimed. We
// filter `viewer_role !== 'buyer'` so the supplier surface is
// unambiguously inbound, mirroring how `/supplier/messages` filters
// `thread_list()` rows.

import Link from "next/link";
import { Tray } from "@phosphor-icons/react/dist/ssr";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
          Supplier
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          RFQs received
        </h1>
      </header>

      {error ? (
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load RFQs.
          </CardContent>
        </Card>
      ) : rfqs.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
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
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <ul className="m-0 flex list-none flex-col p-0">
              {rfqs.map((r) => (
                <li
                  key={r.id}
                  className="border-b border-hairline last:border-b-0"
                >
                  <Link
                    href={`/supplier/rfqs/${r.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand-forest-tint focus:outline-none focus-visible:bg-brand-forest-tint"
                  >
                    <Tray
                      size={20}
                      weight="duotone"
                      className="text-accent-indigo"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-display text-sm font-semibold text-ink-primary">
                          {r.product_title}
                        </span>
                        <Badge tone={statusTone(r.status)}>
                          {statusLabel(r.status)}
                        </Badge>
                      </div>
                      <p className="truncate text-[12px] text-ink-tertiary">
                        {fmtQty(r.quantity, r.quantity_unit)}
                        {r.target_unit_price != null
                          ? ` · target ${fmtMoney(r.target_unit_price, r.currency)}`
                          : ""}
                        {r.ship_by ? ` · ship by ${fmtDate(r.ship_by)}` : ""}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] text-ink-tertiary">
                      {fmtRelative(r.updated_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

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

function fmtDate(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  return new Date(iso).toLocaleDateString();
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
