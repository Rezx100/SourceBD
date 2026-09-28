// /app/orders/[id] — one order as a full page (Spec B8), kept for deep links.
//
// Server component. Reads the order with `order_get` (and the conversation
// with `thread_list`) through `readOrder`, the same read the list's pane
// uses, and draws the same `OrderDetail` with `mode="page"`. An order the
// caller cannot read is a 404 — which is why no `loading.tsx` sits above this
// route: a Suspense boundary would commit a 200 before `notFound()` ran.

import { notFound } from "next/navigation";

import { OrderDetail, readOrder } from "@/components/dashboard/orders";
import { Page } from "@/components/dashboard/page";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function OrderDetailPageBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const opened = await readOrder(supabase, id);
  if (!opened) notFound();
  return <OrderDetail order={opened.order} threadId={opened.threadId} mode="page" />;
}

export default async function OrderDetailPage(props: Parameters<typeof OrderDetailPageBody>[0]) {
  return <Page>{await OrderDetailPageBody(props)}</Page>;
}
