// /app/rfqs — RFQ inbox (Spec B7), FE-SITEWIDE Phase C4.
//
// Server component. Calls `public.rfq_list()` under the caller's session
// and renders the result list inside a `.proto-card` with `.proto-nav-item`
// rows. The per-row `viewer_role` discriminator lets the UI label each
// entry (buyer vs supplier viewer).

import Link from "next/link";
import { FileText, Plus } from "@phosphor-icons/react/dist/ssr";

import {
  DataList,
  EmptyState,
  PageHeader,
  Pill,
  type PillTone,
} from "@/components/ui/page-kit";
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
      <PageHeader
        kicker="Buyer"
        title="RFQs"
        description="Requests for quotation you've sent, and the responses coming back."
        actions={
          <Link
            href="/app/discover"
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand-forest px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-forest-mid"
          >
            <Plus size={14} weight="bold" aria-hidden /> Find suppliers
          </Link>
        }
      />

      {error ? (
        <div className="rounded-card border border-sem-red/30 bg-sem-red-soft p-4 text-sm text-sem-red">
          Could not load RFQs.
        </div>
      ) : rfqs.length === 0 ? (
        <EmptyState
          icon={<FileText size={26} weight="duotone" aria-hidden />}
          title="No RFQs yet"
          description='Open a supplier profile from Discover and use “Request a quote” to start your first RFQ.'
          action={
            <Link
              href="/app/discover"
              className="inline-flex items-center rounded-pill border border-hairline-strong bg-surface-l1 px-4 py-2 text-sm font-semibold text-ink-primary transition-colors hover:bg-brand-forest-tint"
            >
              Browse Discover
            </Link>
          }
        />
      ) : (
        <DataList>
          {rfqs.map((r) => (
            <li key={r.id}>
              <Link
                href={`/app/rfqs/${r.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-hover ease-smooth hover:bg-brand-forest-tint"
              >
                <FileText
                  size={18}
                  weight="duotone"
                  className="shrink-0 text-brand-forest"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-display text-sm font-semibold text-ink-primary">
                      {r.product_title}
                    </span>
                    <Pill tone={statusTone(r.status)}>{statusLabel(r.status)}</Pill>
                    {r.viewer_role !== "buyer" ? (
                      <Pill tone="neutral">As supplier</Pill>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-ink-tertiary">
                    {fmtQty(r.quantity, r.quantity_unit)} ·{" "}
                    {r.target_supplier_count}{" "}
                    {r.target_supplier_count === 1 ? "supplier" : "suppliers"} ·{" "}
                    {r.quote_count}{" "}
                    {r.quote_count === 1 ? "quote" : "quotes"}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-ink-tertiary">
                  {fmtRelative(r.updated_at)}
                </span>
              </Link>
            </li>
          ))}
        </DataList>
      )}
    </div>
  );
}

function statusTone(s: Rfq["status"]): PillTone {
  if (s === "accepted") return "green";
  if (s === "cancelled") return "red";
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
