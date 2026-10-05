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
import Link from "next/link";

import { Empty, ErrorPanel, Table, TableFrame, Td, Th, Tr, rowLinkClass } from "@/components/kit";
import { RfqChip } from "@/components/rfqs/chip";
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
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">RFQs received</h1>
        <p className="text-md text-ink-2">
          Quotes buyers have requested from the companies you&apos;ve claimed.
        </p>
      </header>

      {error ? (
        <ErrorPanel title="Could not load RFQs." />
      ) : rfqs.length === 0 ? (
        <Empty icon={Tray} title="No RFQs yet.">
          When a buyer addresses an RFQ to one of your claimed companies
          it will appear here.
        </Empty>
      ) : (
        <TableFrame>
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <caption className="sr-only">RFQs received</caption>
              <thead>
                <tr>
                  <Th>RFQ</Th>
                  <Th>Status</Th>
                  <Th>Quantity</Th>
                  <Th align="right">Target</Th>
                  <Th align="right">Quotes</Th>
                  <Th align="right">Updated</Th>
                </tr>
              </thead>
              <tbody>
                {rfqs.map((r) => (
                  <Tr key={r.id} className="relative">
                    <Td>
                      <Link
                        href={`/supplier/rfqs/${r.id}`}
                        className={`${rowLinkClass} after:absolute after:inset-0 after:content-['']`}
                      >
                        {r.product_title}
                      </Link>
                    </Td>
                    <Td>
                      <RfqChip tone={statusTone(r.status)}>{statusLabel(r.status)}</RfqChip>
                    </Td>
                    <Td>{fmtQty(r.quantity, r.quantity_unit)}</Td>
                    <Td align="right" className="tabular-nums">
                      {r.target_unit_price != null
                        ? fmtMoney(r.target_unit_price, r.currency)
                        : "—"}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {r.quote_count.toLocaleString()}
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-ink-3">
                      {fmtRelative(r.updated_at)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </TableFrame>
      )}
    </div>
  );
}

function statusTone(s: Rfq["status"]): "waiting" | "accepted" | "closed" {
  if (s === "open") return "waiting";
  if (s === "accepted") return "accepted";
  return "closed";
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
