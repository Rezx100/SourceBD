// /app/rfqs/[id] — RFQ detail (Spec B7).
//
// Server component. Calls `public.rfq_get(p_id)` under the caller's
// session. Buyer sees every quote with an Accept button (when RFQ
// status='open'); supplier sees only their own quote and the RFQ
// metadata. Per-supplier message thread is linked when available.
// `rfq_list` feeds the side card's links to the buyer's other RFQs.

import { notFound } from "next/navigation";

import { RfqDetailBody, type RfqDoc, type RfqListItem } from "@/components/dashboard/rfq-pages";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Page } from "@/components/dashboard/page";

export const dynamic = "force-dynamic";

async function RfqDetailPageBody({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rfq_get", { p_id: id });
  if (error || data == null) {
    notFound();
  }
  const { data: listData } = await supabase.rpc("rfq_list", { p_status: null });
  return <RfqDetailBody rfq={data as RfqDoc} list={(listData as RfqListItem[] | null) ?? []} />;
}

export default async function RfqDetailPage(props: Parameters<typeof RfqDetailPageBody>[0]) {
  return <Page>{await RfqDetailPageBody(props)}</Page>;
}
