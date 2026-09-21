/**
 * REZ-114 — apply the same headline worker selection used on profiles to list
 * cards (discover / saved / smart match). Overwrites employees_total with the
 * display value so DiscoverResultCard stays one code path.
 *
 * Uses production_workers_display_batch (mother + facility_of, RSC-preferred).
 */

export type DisplayWorkersEntry = {
  value: number;
  source: "RSC" | "registry";
  fetched_at: string | null;
};

export type DisplayWorkersById = Record<string, DisplayWorkersEntry>;

type WithIdAndEmployees = {
  id: string;
  employees_total: number | null;
};

/** Minimal client surface — supabase rpc returns a thenable builder. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RpcClient = { rpc: (fn: string, args: { p_supplier_ids: string[] }) => any };

export function parseDisplayBatch(raw: unknown): DisplayWorkersById {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: DisplayWorkersById = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const row = v as Record<string, unknown>;
    const value = row.value;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const source = row.source === "RSC" || row.source === "registry" ? row.source : null;
    if (!source) continue;
    const fa = row.fetched_at;
    out[id] = {
      value,
      source,
      fetched_at: typeof fa === "string" ? fa : null,
    };
  }
  return out;
}

/** SECURITY DEFINER RPC — anon/authenticated may call. */
export async function fetchDisplayWorkersBatch(
  supabase: RpcClient,
  supplierIds: string[],
): Promise<DisplayWorkersById> {
  const ids = Array.from(new Set(supplierIds.filter(Boolean)));
  if (ids.length === 0) return {};
  const { data, error } = await supabase.rpc("production_workers_display_batch", {
    p_supplier_ids: ids,
  });
  if (error) {
    console.error("production_workers_display_batch failed", error.message);
    return {};
  }
  return parseDisplayBatch(data);
}

/** Pure: prefer batch display value; else keep registry row as-is. */
export function applyDiscoverWorkersSelection<T extends WithIdAndEmployees>(
  rows: T[],
  displayById: DisplayWorkersById,
): T[] {
  return rows.map((r) => {
    const d = displayById[r.id];
    if (!d) return r;
    // Mark it. The figure below is a roll-up of this record and its buildings,
    // and a group sum must never be printed bare as one site's headcount —
    // the results card cannot tell the difference without being told.
    return { ...r, employees_total: d.value, workers_is_group: true };
  });
}

export async function enrichDiscoverWorkers<T extends WithIdAndEmployees>(
  supabase: RpcClient,
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return rows;
  const displayById = await fetchDisplayWorkersBatch(
    supabase,
    rows.map((r) => r.id),
  );
  return applyDiscoverWorkersSelection(rows, displayById);
}
