// The one Volza call the app makes: a supplier's latest shipments for the on-demand reveal (0141).
//
// Reproduces ops/volza_launch.py's latest-shipment search: Bangladesh exports, HS chapters 61/62, the window
// the name check used, newest first, duplicates removed, the exact Volza spelling that check passed. 25 records,
// always: Growth's 15 are the first 15 of the same saved set. Server only; the key never reaches a browser.
//
// What a call may have cost, by Volza's pricing ($0.10 a search, $0.05 a record, never twice for a record we
// already bought, so this is an upper bound): an answer with n records counts 0.10 + 0.05n; a 400, 402 or 429 is
// not billed; a timeout, a network error, a 5xx or an answer we cannot read counts the worst case, as the batch
// scripts do.

export const VOLZA_EXPORTS_URL = "https://backend.volza.com/api/v1/bangladesh-exports";
export const REVEAL_RECORDS = 25;
export const REVEAL_WORST_COST = 1.35; // $0.10 + 25 × $0.05; 0141's functions refuse more
const TIMEOUT_MS = 45_000; // well inside 0141's two-minute claim

/** How long the reveal route waits between "busy" answers (a test shortens it; a route file may not export it). */
export const revealTiming = { busyWaitMs: 2000 };

export type VolzaFetch =
  | { ok: true; records: Record<string, unknown>[]; cost: number; creditRemaining: number | null }
  | { ok: false; cost: number; reason: string };

const round2 = (x: number) => Math.round(x * 100) / 100;

export async function fetchLatestShipments(
  key: string,
  name: string,
  windowStart: string,
  windowEnd: string,
  doFetch: typeof fetch = fetch,
): Promise<VolzaFetch> {
  let res: Response;
  try {
    res = await doFetch(VOLZA_EXPORTS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        hsn_code: ["61", "62"],
        start_date: windowStart,
        end_date: windowEnd,
        max_count_per_page: REVEAL_RECORDS,
        sort_by: "date",
        sort_order: "DESC",
        supplier_name: [name],
        supplier_name_search_type: "exact",
        remove_duplicate_shipments: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, cost: REVEAL_WORST_COST, reason: `network: ${(e as Error).name}` };
  }
  if (res.status === 400 || res.status === 402 || res.status === 429) {
    return { ok: false, cost: 0, reason: `volza ${res.status}` };
  }
  if (res.status !== 200) return { ok: false, cost: REVEAL_WORST_COST, reason: `volza ${res.status}` };

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, cost: REVEAL_WORST_COST, reason: "unreadable answer" };
  }
  const records = (body as { api_records?: unknown } | null)?.api_records ?? [];
  if (!Array.isArray(records) || records.length > REVEAL_RECORDS || records.some((r) => !r || typeof r !== "object")) {
    return { ok: false, cost: REVEAL_WORST_COST, reason: "unexpected records" };
  }
  const credit = Number.parseFloat(res.headers.get("x-credit-remaining") ?? "");
  return {
    ok: true,
    records: records as Record<string, unknown>[],
    cost: round2(0.1 + 0.05 * records.length),
    creditRemaining: Number.isFinite(credit) ? credit : null,
  };
}
