// /app/orders: the buyer's orders on the v4 frame (B5c, Paper `10 · Orders list`, `· empty`,
// `11 · Quotes tab · Orders`). A table of every order with its value, status and ship-by date;
// `?open=<id>` draws that order in the pane beside a narrow list (a drawer under 1280), read with
// the same `order_get` the full page uses. An id that cannot be read is a notice in the pane,
// never a 404 on the list. `?status=` picks the tab.
//
// A failed `order_list` is an error where the list was: "No orders yet" is a claim about the
// account that a failed read cannot make. In the `(list)` group so its loading state does not
// wrap `orders/[id]`, which answers 404 for an order the caller cannot read.

import Link from "next/link";
import { ListPane } from "@/components/frame";
import { ButtonLink } from "@/components/kit";
import { OrderDetail, OrderDetailError } from "@/components/orders/detail";
import { OrderPaneRows, OrderPhoneRows, OrdersEmpty, OrdersError, OrdersHeader, OrdersPaneHead, TabEmpty } from "@/components/orders/list";
import { loadOrderList, readOrder } from "@/components/orders/load";
import { OrdersTable } from "@/components/orders/table";
import { ORDER_TABS, buildOrderItems, inTab, listCaption, ordersHref, parseOrderTab } from "@/components/orders/words";
import { QuotesSwitch } from "@/components/rfqs/list";
import { PaneFrame } from "@/components/search/pane";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Orders · SourceBD" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || null;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const tab = parseOrderTab(one(sp.status));
  const openRaw = one(sp.open);
  const openId = openRaw && UUID_RE.test(openRaw) ? openRaw : openRaw ? "invalid" : null;
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  const [{ rows, rfqCount }, opened] = await Promise.all([loadOrderList(supabase), openId && openId !== "invalid" ? readOrder(supabase, openId) : Promise.resolve(null)]);

  const all = rows ?? [];
  const shownRows = all.filter((o) => inTab(o, tab));
  const items = buildOrderItems(shownRows, today);
  const closeHref = ordersHref(tab);
  const paneOpen = openId !== null;
  const caption = rows ? listCaption(rows) : "Counts could not be read";
  const listLabel = tab === "all" ? "Orders" : (ORDER_TABS.find((t) => t.key === tab)?.label ?? "Orders");
  const emptyTab = tab === "all" ? "progress" : tab;

  const list = (
    <div className="flex min-h-0 flex-1 flex-col">
      <QuotesSwitch current="orders" rfqs={rfqCount} orders={rows ? all.length : null} newHref="/app/orders/new" newLabel="New order" />
      {rows === null ? (
        <>
          <OrdersHeader caption={caption} rows={[]} tab={tab} />
          <OrdersError retryHref={closeHref} />
        </>
      ) : all.length === 0 ? (
        <OrdersEmpty />
      ) : paneOpen ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col max-md:hidden">
            <OrdersPaneHead title={listLabel} count={items.length} />
            <div className="min-h-0 flex-1 overflow-y-auto">{items.length === 0 ? <TabEmpty tab={emptyTab} /> : <OrderPaneRows items={items} tab={tab} currentId={openId === "invalid" ? null : openId} />}</div>
          </div>
          <div className="md:hidden">
            <OrderPhoneRows items={items} />
          </div>
        </>
      ) : (
        <>
          <OrdersHeader caption={caption} rows={all} tab={tab} />
          {items.length === 0 ? (
            <TabEmpty tab={emptyTab} />
          ) : (
            <>
              <div className="px-6 max-md:hidden">
                <OrdersTable items={items} tab={tab} />
              </div>
              <div className="md:hidden">
                <OrderPhoneRows items={items} />
              </div>
              <p className="flex h-10 shrink-0 items-center px-6 text-sm text-ink-3 max-md:px-4">
                {items.length} {items.length === 1 ? "order" : "orders"}
                {tab !== "all" ? ` · ${all.length} in all` : ""}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );

  const known = rows?.find((o) => o.id === openId) ?? null;
  const pane = !paneOpen ? null : opened?.kind === "ok" ? (
    <PaneFrame openKey={`order:${opened.order.id}`}>
      <OrderDetail order={opened.order} mode="pane" today={today} threadId={opened.threadId} viewerId={opened.viewerId} closeHref={closeHref} />
    </PaneFrame>
  ) : opened?.kind === "error" && known ? (
    <PaneFrame openKey={`order-error:${known.id}`}>
      <OrderDetailError title={known.product_title} mode="pane" closeHref={closeHref} retryHref={ordersHref(tab, known.id)} />
    </PaneFrame>
  ) : (
    <PaneFrame openKey={`order-notice:${openId}`}>
      <div data-record-pane="" tabIndex={-1} aria-label="Order" role="region" className="flex flex-col gap-3 p-6 outline-none">
        <h2 className="text-lg font-semibold text-ink">This order could not be opened</h2>
        <p className="text-base text-ink-2">It may not be one of yours, the link may be wrong, or it could not be read just now. Your orders are still here behind this.</p>
        <div className="flex gap-2 pt-1">
          {opened?.kind === "error" && openId && openId !== "invalid" ? (
            <ButtonLink href={ordersHref(tab, openId)} kind="primary" prefetch={false}>
              Try again
            </ButtonLink>
          ) : null}
          <Link href={closeHref} scroll={false} prefetch={false} className="inline-flex h-control items-center rounded-sm px-3 text-base font-medium text-ink-2 hover:bg-sunken hover:text-ink">
            Close
          </Link>
        </div>
      </div>
    </PaneFrame>
  );

  return <ListPane list={list} listLabel="Orders" pane={pane} paneTitle={opened?.kind === "ok" ? opened.order.product_title : "Order"} closeHref={closeHref} />;
}
