// /app/rfqs — RFQ inbox (Spec B7), FE-SITEWIDE Phase C4.
//
// Server component. Calls `public.rfq_list()` under the caller's session
// and renders the result list inside a `.proto-card` with `.proto-nav-item`
// rows. The per-row `viewer_role` discriminator lets the UI label each
// entry (buyer vs supplier viewer).

import Link from "next/link";
import { FileText, Plus } from "@phosphor-icons/react/dist/ssr";

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
          <p className="text-[11px] font-semibold text-ink-tertiary">
            Buyer
          </p>
          <h1 className="font-display text-3xl font-light tracking-tight text-ink-primary">
            RFQs
          </h1>
        </div>
        <Link
          href="/app/discover"
          className="btn-proto primary inline-flex items-center gap-1.5"
        >
          <Plus size={12} weight="bold" aria-hidden /> Find suppliers
        </Link>
      </header>

      {error ? (
        <div className="proto-card text-sm text-sem-red">Could not load RFQs.</div>
      ) : rfqs.length === 0 ? (
        <div className="proto-card space-y-3 text-center">
          <FileText
            size={32}
            weight="duotone"
            className="mx-auto text-ink-tertiary"
            aria-hidden
          />
          <p className="affiliation-disclaimer">
            You haven&apos;t composed any RFQs yet.
          </p>
          <p className="affiliation-disclaimer">
            Open a supplier profile from Discover and use &quot;Request a quote&quot;
            to start your first RFQ.
          </p>
          <Link href="/app/discover" className="btn-proto inline-flex">
            Browse Discover
          </Link>
        </div>
      ) : (
        <nav aria-label="RFQs" className="proto-card p-0">
          <ul className="m-0 flex list-none flex-col p-0">
            {rfqs.map((r) => (
              <li key={r.id} className="border-b border-hairline last:border-b-0">
                <Link
                  href={`/app/rfqs/${r.id}`}
                  className="proto-nav-item !rounded-none !px-5 !py-3"
                >
                  <FileText
                    size={18}
                    weight="duotone"
                    className="shrink-0 text-brand-forest"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-display text-sm font-medium text-ink-primary">
                        {r.product_title}
                      </span>
                      <span className={statusChip(r.status)}>
                        {statusLabel(r.status)}
                      </span>
                      {r.viewer_role !== "buyer" ? (
                        <span className="chip">As supplier</span>
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
          </ul>
        </nav>
      )}
    </div>
  );
}

function statusChip(s: Rfq["status"]): string {
  if (s === "open") return "chip";
  if (s === "accepted") return "chip claim-verified";
  if (s === "cancelled")
    return "chip !bg-sem-red-soft !text-sem-red !border-sem-red";
  return "chip";
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
