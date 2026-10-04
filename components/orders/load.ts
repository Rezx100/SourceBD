// What the order pages read, so the list, the pane and the full page agree on how a failed read
// is told apart from a missing order or an empty list. The same RPCs as before (`order_list`,
// `order_get`, `thread_list`); the RFQ counts only feed the phone's Quotes switch. No new RPC,
// policy or migration.

import type { OrderDoc, OrderRow } from "./words";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

async function soft<T>(run: () => PromiseLike<{ data: unknown; error: unknown }>, pick: (d: unknown) => T, fallback: T): Promise<T> {
  try {
    const r = await run();
    return r.error ? fallback : pick(r.data);
  } catch {
    return fallback;
  }
}

export type OrderListData = {
  /** Null when `order_list` failed: no count and no empty state may stand in for it. */
  rows: OrderRow[] | null;
  /** RFQs and drafts, for the phone's "RFQs · 6" switch; null when unread. */
  rfqCount: number | null;
};

const num = (v: unknown) => (v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export function normaliseOrder(r: Record<string, unknown>): OrderRow {
  return { ...(r as unknown as OrderRow), quantity: Number(r.quantity), unit_price: num(r.unit_price), total_value: num(r.total_value), currency: typeof r.currency === "string" && r.currency ? r.currency : "USD", milestone_count: Number(r.milestone_count) || 0 };
}

export async function loadOrderList(supabase: Client): Promise<OrderListData> {
  const [list, rfqs, drafts] = await Promise.all([
    supabase.rpc("order_list", { p_status: null }),
    soft<number | null>(() => supabase.rpc("rfq_list", { p_status: null }), (d) => (Array.isArray(d) ? d.length : null), null),
    soft<number>(() => supabase.rpc("rfq_draft_list"), (d) => (Array.isArray(d) ? d.length : 0), 0),
  ]);
  const rows = list.error || !Array.isArray(list.data) ? null : (list.data as Record<string, unknown>[]).map(normaliseOrder);
  return { rows, rfqCount: rfqs === null ? null : rfqs + drafts };
}

export type OrderRead = { kind: "ok"; order: OrderDoc; threadId: string | null; viewerId: string | null } | { kind: "missing" } | { kind: "error" };

/** One order, and the conversation with its supplier about its RFQ: the reads the page and the pane share. */
export async function readOrder(supabase: Client, id: string): Promise<OrderRead> {
  const [got, threads, viewerId] = await Promise.all([
    supabase.rpc("order_get", { p_id: id }),
    soft<{ id: string; supplier_id: string; rfq_id: string | null }[]>(() => supabase.rpc("thread_list"), (d) => (Array.isArray(d) ? d : []), []),
    soft<string | null>(() => supabase.auth.getUser(), (d) => ((d as { user?: { id?: string } } | null)?.user?.id ?? null), null),
  ]);
  if (got.error) return { kind: "error" };
  if (got.data == null) return { kind: "missing" };
  const raw = got.data as Record<string, unknown>;
  const order = { ...(raw as unknown as OrderDoc), quantity: Number(raw.quantity), unit_price: num(raw.unit_price), total_value: num(raw.total_value), milestones: Array.isArray(raw.milestones) ? (raw.milestones as OrderDoc["milestones"]) : [] };
  const thread = threads.find((t) => t.supplier_id === order.supplier?.id && t.rfq_id === order.rfq_id);
  return { kind: "ok", order, threadId: thread?.id ?? null, viewerId };
}
