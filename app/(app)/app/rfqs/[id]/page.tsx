// /app/rfqs/[id] — one RFQ as a full page (Spec B7), kept for deep links.
//
// Server component. Calls `public.rfq_get(p_id)` under the caller's session —
// the same read the list's pane uses — and draws the same `RfqDetailBody`
// with `mode="page"`. The buyer sees every quote with an Accept (while the
// RFQ is open); a supplier sees only their own quote and the RFQ. `rfq_list`
// feeds the side column's links to the buyer's other RFQs. An RFQ the caller
// cannot read is a 404, so no `loading.tsx` sits above this route.

import { notFound } from "next/navigation";

import { Page } from "@/components/dashboard/page";
import { RfqDetailBody, type RfqDoc, type RfqListItem } from "@/components/dashboard/rfq-pages";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function RfqDetailPageBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rfq_get", { p_id: id });
  if (error || data == null) {
    notFound();
  }
  const { data: listData } = await supabase.rpc("rfq_list", { p_status: null });
  return <RfqDetailBody rfq={data as RfqDoc} list={(listData as RfqListItem[] | null) ?? []} mode="page" />;
}

export default async function RfqDetailPage(props: Parameters<typeof RfqDetailPageBody>[0]) {
  return <Page>{await RfqDetailPageBody(props)}</Page>;
}
