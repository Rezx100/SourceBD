/**
 * REZ-114 — apply the same site worker selection used on profiles to list cards
 * (discover / saved / smart match). Overwrites employees_total with the selected
 * display value so DiscoverResultCard stays one code path.
 */

import { selectSiteWorkers } from "./profile-metrics";

export type RscWorkersEntry = {
  workers_count: number;
  fetched_at: string | null;
};

export type RscWorkersById = Record<string, RscWorkersEntry>;

type WithIdAndEmployees = {
  id: string;
  employees_total: number | null;
};

/** Minimal client surface — supabase rpc returns a thenable builder. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RpcClient = { rpc: (fn: string, args: { p_supplier_ids: string[] }) => any };

function parseBatch(raw: unknown): RscWorkersById {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: RscWorkersById = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const row = v as Record<string, unknown>;
    const wc = row.workers_count;
    if (typeof wc !== "number" || !Number.isFinite(wc)) continue;
    const fa = row.fetched_at;
    out[id] = {
      workers_count: wc,
      fetched_at: typeof fa === "string" ? fa : null,
    };
  }
  return out;
}

/** SECURITY DEFINER RPC — anon/authenticated may call. */
export async function fetchRscWorkersBatch(
  supabase: RpcClient,
  supplierIds: string[],
): Promise<RscWorkersById> {
  const ids = Array.from(new Set(supplierIds.filter(Boolean)));
  if (ids.length === 0) return {};
  const { data, error } = await supabase.rpc("rsc_workers_batch", {
    p_supplier_ids: ids,
  });
  if (error) {
    console.error("rsc_workers_batch failed", error.message);
    return {};
  }
  return parseBatch(data);
}

/** Pure: RSC when present, else registry, else null. Never invent. */
export function applyDiscoverWorkersSelection<T extends WithIdAndEmployees>(
  rows: T[],
  rscById: RscWorkersById,
): T[] {
  return rows.map((r) => {
    const rsc = rscById[r.id];
    const selected = selectSiteWorkers({
      label: r.id,
      employees_total: r.employees_total,
      rsc_workers_count: rsc?.workers_count ?? null,
      rsc_fetched_at: rsc?.fetched_at ?? null,
    });
    return { ...r, employees_total: selected.value };
  });
}

export async function enrichDiscoverWorkers<T extends WithIdAndEmployees>(
  supabase: RpcClient,
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return rows;
  const rscById = await fetchRscWorkersBatch(
    supabase,
    rows.map((r) => r.id),
  );
  return applyDiscoverWorkersSelection(rows, rscById);
}
