// /app/rfqs — the buyer's RFQ list (Spec B7, handoff §3.7).
//
// Server component. Calls `public.rfq_list()` under the caller's session once,
// unfiltered, so the status tabs can count every row; `?status=` picks the
// tab. The view is `RfqListBody` in the dashboard kit.

import { RfqListBody, parseRfqTab, type RfqRow } from "@/components/dashboard/rfq-pages";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/dashboard/app-shell";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";

export const dynamic = "force-dynamic";

async function RfqsPageBody({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rfq_list", { p_status: null });
  const rows: RfqRow[] | null = error ? null : ((data as RfqRow[] | null) ?? []);
  return <RfqListBody rows={rows} tab={parseRfqTab(sp.status)} today={new Date()} />;
}

// The kit's shell on every buyer page (one sidebar, one topbar), read in the
// same wave as the page's own data.
export default async function RfqsPage(props: Parameters<typeof RfqsPageBody>[0]) {
  const supabase = await createSupabaseServerClient();
  const [shell, body] = await Promise.all([loadBuyerShell(supabase, "/app/rfqs"), RfqsPageBody(props)]);
  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="RFQs">
      {body}
    </AppShell>
  );
}
