// Buyer Home (/app). Calls `public.buyer_dashboard()` (migration 0026) and
// the open-RFQ and active-order counts under the caller's session, and draws
// them with `components/dashboard/buyer-home.tsx` (handoff v3.2 §3.10).
//
// SBI hard contract: the RPC excludes SBI from its payload entirely; this
// file never references `sbi_*` keys. PII hard contract: the RPC excludes
// contact fields; same here.

import { BuyerHome as HomeView, type HomeModel } from "@/components/dashboard/buyer-home";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/dashboard/app-shell";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";

export const dynamic = "force-dynamic";

const EMPTY: HomeModel = {
  saved_count: 0,
  recent_saved: [],
  alerts: [],
  recent_activity: [],
};

async function BuyerHomeBody() {
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { count: openRfqCount }, { count: activeOrderCount }] =
    await Promise.all([
      supabase.rpc("buyer_dashboard"),
      supabase
        .from("rfqs")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["draft", "in_production", "shipped", "in_transit"]),
    ]);
  const doc: HomeModel = error || data == null ? EMPTY : (data as HomeModel);

  return (
    <HomeView
      doc={doc}
      failed={Boolean(error)}
      openRfqs={openRfqCount ?? 0}
      activeOrders={activeOrderCount ?? 0}
    />
  );
}

export default async function BuyerHome() {
  const supabase = await createSupabaseServerClient();
  const [shell, body] = await Promise.all([loadBuyerShell(supabase, "/app"), BuyerHomeBody()]);
  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Home">
      {body}
    </AppShell>
  );
}
