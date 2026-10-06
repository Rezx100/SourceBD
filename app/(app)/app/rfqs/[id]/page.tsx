// /app/rfqs/[id]: one RFQ as a full page (B5a, Paper `10 · RFQ detail quotes (page)`, `11 · RFQ
// detail quote cards`), kept for deep links and for a phone. The same `RfqDetail` the list's
// pane draws, read with the same `rfq_get`. The buyer sees every quote with an Accept while the
// RFQ is open; a supplier sees only their own quote. An RFQ the caller cannot read is a 404, so
// no `loading.tsx` sits above this route; a read that FAILED is not a 404 and says so.

import { notFound } from "next/navigation";
import { RfqDetail, RfqDetailError } from "@/components/rfqs/detail";
import { otherRfqLine, type RfqDoc } from "@/components/rfqs/doc";
import { normaliseRow } from "@/components/rfqs/load";
import { noteActivity } from "@/lib/ledger/note";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [got, list, orders] = await Promise.all([
    supabase.rpc("rfq_get", { p_id: id }),
    supabase.rpc("rfq_list", { p_status: null }),
    // Soft: with no order read the page offers to create one rather than failing.
    Promise.resolve(supabase.rpc("order_list", { p_status: null })).then(
      (r) => (!r.error && Array.isArray(r.data) ? (r.data as { id: string; rfq_id: string | null }[]) : []),
      () => [] as { id: string; rfq_id: string | null }[],
    ),
  ]);
  const rows = !list.error && Array.isArray(list.data) ? (list.data as Record<string, unknown>[]).map(normaliseRow) : [];
  if (got.error) {
    const known = rows.find((r) => r.id === id);
    if (!known) notFound();
    return <RfqDetailError rfq={{ id, product_title: known.product_title }} mode="page" closeHref="/app/rfqs" retryHref={`/app/rfqs/${id}`} />;
  }
  if (got.data == null) notFound();
  const rfq = got.data as RfqDoc;
  // Who viewed which RFQ, for the record (moderation plan 1d): a supplier reading a buyer's RFQ is an event.
  void noteActivity(supabase, "rfq.viewed", { targetTable: "rfqs", targetId: rfq.id, rfqId: rfq.id, content: { viewer_role: rfq.viewer_role, via: "page" } });
  const order = orders.find((o) => o.rfq_id === rfq.id) ?? null;
  const others = rows.filter((r) => r.id !== rfq.id && r.viewer_role !== "supplier").slice(0, 3).map((r) => ({ id: r.id, line: otherRfqLine(r) }));
  return <RfqDetail rfq={rfq} mode="page" today={new Date()} closeHref="/app/rfqs" order={order ? { id: order.id } : null} others={others} />;
}
