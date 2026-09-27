// /app/orders — the buyer's orders (Spec B8), in the dashboard kit.
//
// Server component. Calls `public.order_list()` under the caller's session and
// draws the title with counts, status tabs (`?status=`, filtered here from the
// one read) and the orders table.

import { Button } from "@/components/dashboard/controls";
import { Icon } from "@/components/dashboard/icons";
import { OrderTabs, OrdersTable, inTab, parseOrderTab, type OrderRow } from "@/components/dashboard/orders";
import { PageHeader } from "@/components/dashboard/page";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/dashboard/app-shell";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";

export const dynamic = "force-dynamic";

async function OrdersPageBody({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const tab = parseOrderTab(sp.status);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("order_list", { p_status: null });
  const orders: OrderRow[] = error || data == null ? [] : (data as OrderRow[]);
  const active = orders.filter((o) => inTab(o, "active")).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Orders"
        caption={
          error
            ? "Track production and shipping milestones for your accepted orders."
            : `${active.toLocaleString()} active · ${orders.length.toLocaleString()} in all`
        }
        actions={
          <Button variant="primary" href="/app/orders/new" clientNav>
            <Icon name="plus" /> New order
          </Button>
        }
      >
        {!error && orders.length > 0 ? <OrderTabs orders={orders} tab={tab} /> : null}
      </PageHeader>
      <OrdersTable rows={orders.filter((o) => inTab(o, tab))} error={Boolean(error)} tab={orders.length === 0 ? "all" : tab} />
    </div>
  );
}

// The kit's shell on every buyer page (one sidebar, one topbar), read in the
// same wave as the page's own data.
export default async function OrdersPage(props: Parameters<typeof OrdersPageBody>[0]) {
  const supabase = await createSupabaseServerClient();
  const [shell, body] = await Promise.all([loadBuyerShell(supabase, "/app/orders"), OrdersPageBody(props)]);
  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Orders">
      {body}
    </AppShell>
  );
}
