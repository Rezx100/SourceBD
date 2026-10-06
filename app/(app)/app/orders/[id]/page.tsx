// /app/orders/[id]: one order as a full page (B5c, Paper `10 · Order detail`, `11 · Order detail`),
// kept for deep links and for a phone. The same `OrderDetail` the list's pane draws, read with the
// same `readOrder`. An order the caller cannot read is a 404, so no `loading.tsx` sits above this
// route (a Suspense boundary would commit a 200 before `notFound()` ran); a read that FAILED is not
// a 404 and says so.

import { notFound } from "next/navigation";
import { OrderDetail, OrderDetailError } from "@/components/orders/detail";
import { readOrder } from "@/components/orders/load";
import { noteActivity } from "@/lib/ledger/note";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const read = await readOrder(supabase, id);
  if (read.kind === "missing") notFound();
  if (read.kind === "error") {
    // The list names the order, so the page can: a failed read of one is not a missing order.
    const { data, error } = await supabase.rpc("order_list", { p_status: null });
    // If the list cannot be read either, nothing says the order is missing: the title is unknown, the page is not a 404.
    if (error) return <OrderDetailError title="Order" mode="page" closeHref="/app/orders" retryHref={`/app/orders/${id}`} />;
    const known = Array.isArray(data) ? (data as { id: string; product_title: string }[]).find((o) => o.id === id) : undefined;
    if (!known) notFound();
    return <OrderDetailError title={known.product_title} mode="page" closeHref="/app/orders" retryHref={`/app/orders/${id}`} />;
  }
  // Who viewed which order, for the record (moderation plan 1d).
  void noteActivity(supabase, "order.viewed", { targetTable: "orders", targetId: id, orderId: id, content: { via: "page" } });
  return <OrderDetail order={read.order} mode="page" today={new Date()} threadId={read.threadId} viewerId={read.viewerId} closeHref="/app/orders" />;
}
