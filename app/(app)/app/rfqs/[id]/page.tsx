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
import { AppShell } from "@/components/dashboard/app-shell";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";

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

// The kit's shell on every buyer page (one sidebar, one topbar), read in the
// same wave as the page's own data.
export default async function RfqDetailPage(props: Parameters<typeof RfqDetailPageBody>[0]) {
  const supabase = await createSupabaseServerClient();
  const [shell, body] = await Promise.all([loadBuyerShell(supabase, "/app/rfqs/x"), RfqDetailPageBody(props)]);
  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="RFQ">
      {body}
    </AppShell>
  );
}
