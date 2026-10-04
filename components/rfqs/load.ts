// What the RFQ pages read, in one place so the list, the pane and the full page agree on how a
// failed read is told apart from an empty one. The same RPCs as before (`rfq_list`,
// `rfq_draft_list`, `rfq_get`, `order_list`), and one plain read of `rfq_quotes` and the
// names of the suppliers that sent the best quotes, both under the buyer's own session (their
// RLS already lets a buyer read the quotes on their own RFQs). No new RPC, policy or migration.

import { bestQuote, type DraftRow, type OrderLite, type QuoteLite, type RfqRow } from "./words";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

const asNumber = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** A read that may be missing (a function not yet migrated) or fail: the page shows less, never an error, for these. */
async function soft<T>(run: () => PromiseLike<{ data: unknown; error: unknown }>, pick: (data: unknown) => T, fallback: T): Promise<T> {
  try {
    const r = await run();
    return r.error ? fallback : pick(r.data);
  } catch {
    return fallback;
  }
}

export type RfqListData = {
  /** Null when `rfq_list` failed: no count and no empty state may stand in for it. */
  rows: RfqRow[] | null;
  drafts: DraftRow[];
  /** Null when the quotes could not be read. */
  quotes: QuoteLite[] | null;
  names: Map<string, string>;
  /** Null when the orders could not be read (the phone's Orders count says nothing then). */
  orders: OrderLite[] | null;
  ordersTotal: number | null;
};

export function normaliseRow(r: Record<string, unknown>): RfqRow {
  return {
    ...(r as unknown as RfqRow),
    quantity: Number(r.quantity),
    target_unit_price: asNumber(r.target_unit_price),
    target_supplier_count: Number(r.target_supplier_count) || 0,
    quote_count: Number(r.quote_count) || 0,
    currency: typeof r.currency === "string" && r.currency ? r.currency : "USD",
    accepted_quote_id: typeof r.accepted_quote_id === "string" ? r.accepted_quote_id : null,
  };
}

export async function loadRfqList(supabase: Client): Promise<RfqListData> {
  const [list, drafts, orders] = await Promise.all([
    supabase.rpc("rfq_list", { p_status: null }),
    soft<DraftRow[]>(() => supabase.rpc("rfq_draft_list"), (d) => (Array.isArray(d) ? (d as DraftRow[]) : []), []),
    soft<{ lite: OrderLite[]; total: number } | null>(
      () => supabase.rpc("order_list", { p_status: null }),
      (d) => {
        if (!Array.isArray(d)) return null;
        const all = d as { id: string; rfq_id: string | null; po_number: string | null; viewer_role?: string }[];
        return { lite: all.map((o) => ({ id: o.id, rfq_id: o.rfq_id ?? null, po_number: o.po_number ?? null })), total: all.length };
      },
      null,
    ),
  ]);
  const rows: RfqRow[] | null = list.error || !Array.isArray(list.data) ? null : (list.data as Record<string, unknown>[]).map(normaliseRow);

  let quotes: QuoteLite[] | null = [];
  const names = new Map<string, string>();
  if (rows) {
    const ids = rows.filter((r) => r.viewer_role !== "supplier" && r.quote_count > 0).map((r) => r.id);
    if (ids.length > 0) {
      quotes = await soft<QuoteLite[] | null>(
        () => supabase.from("rfq_quotes").select("rfq_id, supplier_id, unit_price, moq, status").in("rfq_id", ids),
        (d) =>
          Array.isArray(d)
            ? (d as Record<string, unknown>[]).map((q) => ({
                rfq_id: String(q.rfq_id),
                supplier_id: String(q.supplier_id),
                unit_price: Number(q.unit_price),
                moq: asNumber(q.moq),
                status: q.status as QuoteLite["status"],
              }))
            : null,
        null,
      );
      const best = new Set(rows.map((r) => bestQuote(r, quotes)?.supplier_id).filter((x): x is string => Boolean(x)));
      if (best.size > 0) {
        const found = await soft<{ id: string; company_name: string }[]>(
          () => supabase.from("suppliers").select("id, company_name").in("id", [...best]),
          (d) => (Array.isArray(d) ? (d as { id: string; company_name: string }[]) : []),
          [],
        );
        for (const s of found) names.set(s.id, s.company_name);
      }
    }
  }
  return { rows, drafts, quotes, names, orders: orders?.lite ?? null, ordersTotal: orders?.total ?? null };
}
