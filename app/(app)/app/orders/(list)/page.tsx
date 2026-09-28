// /app/orders — the buyer's orders (Spec B8), a workbench in the dashboard kit.
//
// Server component. Calls `public.order_list()` under the caller's session and
// draws the title with counts, status tabs (`?status=`, filtered here from the
// one read) and the orders table. `?open=<id>` draws that order beside the
// table in a pane, read with the same `order_get` the full page uses; the
// table narrows beside it, and below `lg` the pane takes the region. An id
// that cannot be read is a notice in the pane, never a 404 on the list.
//
// In the `(list)` group so its loading state does not wrap `orders/[id]`.

import { Button } from "@/components/dashboard/controls";
import { Icon } from "@/components/dashboard/icons";
import { OrderDetail, OrderTabs, OrdersTable, inTab, ordersHref, parseOrderTab, readOrder, type OrderRow } from "@/components/dashboard/orders";
import { PageHeader } from "@/components/dashboard/page";
import { RecordPane, ResultsColumn, SheetNotice, Workbench } from "@/components/dashboard/sheet";
import { formatCount } from "@/lib/dashboard/facts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; open?: string | string[] }>;
}) {
  const sp = await searchParams;
  const tab = parseOrderTab(one(sp.status));
  const openId = one(sp.open)?.trim() || null;
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, opened] = await Promise.all([
    supabase.rpc("order_list", { p_status: null }),
    openId ? readOrder(supabase, openId) : Promise.resolve(null),
  ]);
  const orders: OrderRow[] = error || data == null ? [] : (data as OrderRow[]);
  const active = orders.filter((o) => inTab(o, "active")).length;
  const closeHref = ordersHref(tab);

  return (
    // The workbench: the list scrolls in its own column, and an open order
    // sits beside it from `lg`; below that it takes the region and Close
    // brings the list back.
    <Workbench>
      <ResultsColumn besideRecord={openId !== null}>
        <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-5">
          <PageHeader
            title="Orders"
            caption={
              error
                ? "Track production and shipping milestones for your accepted orders."
                : `${formatCount(active)} active · ${formatCount(orders.length)} in all`
            }
            actions={
              <Button variant="primary" href="/app/orders/new" clientNav>
                <Icon name="plus" /> New order
              </Button>
            }
          >
            {!error && orders.length > 0 ? <OrderTabs orders={orders} tab={tab} /> : null}
          </PageHeader>
          <OrdersTable
            rows={orders.filter((o) => inTab(o, tab))}
            error={Boolean(error)}
            tab={orders.length === 0 ? "all" : tab}
            openId={openId}
          />
        </div>
      </ResultsColumn>
      {openId !== null ? (
        <RecordPane closeHref={closeHref} openKey={`${opened ? "order" : "notice"}:${openId}`}>
          {opened ? (
            <OrderDetail order={opened.order} threadId={opened.threadId} mode="pane" closeHref={closeHref} />
          ) : (
            <SheetNotice
              label="Order"
              title="This order could not be opened"
              body="It may not be one of yours, the link may be wrong, or it could not be read just now. Your orders are still here behind this."
              closeHref={closeHref}
            />
          )}
        </RecordPane>
      ) : null}
    </Workbench>
  );
}
