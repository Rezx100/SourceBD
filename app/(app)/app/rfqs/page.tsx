// /app/rfqs — RFQ inbox (Spec B7).
//
// Server component. Calls `public.rfq_list()` under the caller's session
// and groups the result by status. Buyers and suppliers both land here;
// the per-row `viewer_role` discriminator lets the UI label each entry.

import Link from "next/link";
import { FileText, Plus } from "@phosphor-icons/react/dist/ssr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default async function RfqsPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rfq_list", { p_status: null });
  const rfqs: Rfq[] = error || data == null ? [] : (data as Rfq[]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
            Buyer
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
            RFQ Manager
          </h1>
        </div>
        <Button asChild variant="primary" size="sm">
          <Link href="/app/discover">
            <Plus size={14} aria-hidden /> Find suppliers
          </Link>
        </Button>
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
            <FileText
              size={32}
              weight="duotone"
              className="mx-auto text-ink-tertiary"
              aria-hidden
            />
            <p className="text-sm text-ink-secondary">
              You haven&apos;t composed any RFQs yet.
            </p>
            <p className="text-[12px] text-ink-tertiary">
              Open a supplier profile from Discover and use &quot;Request a
              quote&quot; to start your first RFQ.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/discover">Browse Discover</Link>
            </Button>
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
                    href={`/app/rfqs/${r.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand-forest-tint focus:outline-none focus-visible:bg-brand-forest-tint"
                  >
                    <FileText
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
                        {r.viewer_role !== "buyer" ? (
                          <Badge tone="neutral">As supplier</Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-[12px] text-ink-tertiary">
                        {fmtQty(r.quantity, r.quantity_unit)} ·{" "}
                        {r.target_supplier_count}{" "}
                        {r.target_supplier_count === 1 ? "supplier" : "suppliers"}{" "}
                        · {r.quote_count}{" "}
                        {r.quote_count === 1 ? "quote" : "quotes"}
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
