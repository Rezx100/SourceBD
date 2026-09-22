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

/**
 * What the headline worker figure covers, relative to the record it is shown
 * under. Derived, not reported: see `applyDiscoverWorkersSelection`.
 *
 * - `own` — this record's own figure, and nothing else's.
 * - `group` — this record plus at least one building.
 * - `excludes-record` — buildings only; this record files no figure and is
 *   not in the sum. Printing this one bare tells a buyer a factory employs
 *   people it does not.
 */
export type WorkersBasis = "own" | "group" | "excludes-record";

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
/** What this function adds to each row it answers for. */
export type WorkersSelection = {
  workers_source?: "RSC" | "registry";
  workers_basis?: WorkersBasis;
};

export function applyDiscoverWorkersSelection<T extends WithIdAndEmployees>(
  rows: T[],
  displayById: DisplayWorkersById,
): Array<T & WorkersSelection> {
  return rows.map((r) => {
    const d = displayById[r.id];
    if (!d) return r;
    // Composition IS knowable here, and two earlier passes said it was not.
    //
    // `r.employees_total` at this point is still the supplier row's own
    // registry figure, straight off `discover_suppliers`. `d.value` is
    // `production_workers_display_batch`: the root summed with every
    // `facility_of` child, and — when any site in the family has an RSC row —
    // summed over the RSC sites ONLY, which can drop the root. So comparing
    // the two answers the question the display batch does not:
    //
    //   d.value === own          the figure is this record's own
    //   own === null             the figure contains no number for this
    //                            record at all, so it is somebody else's
    //   otherwise                the figure covers this record and more
    //
    // The first pass here set `workers_is_group: true` unconditionally, so
    // "across this record and its buildings" printed under every standalone
    // factory. The second dropped composition entirely and labelled the
    // roll-up "on the register", which named a register that holds no such
    // number — and, in the RSC case, a number belonging to a different site.
    // `lib/dashboard/build-models.ts` has always done this honestly on the
    // same data; this is that vocabulary, derived from what is in hand.
    const own = r.employees_total;
    const basis: WorkersBasis =
      own == null ? "excludes-record" : d.value === own ? "own" : "group";
    return { ...r, employees_total: d.value, workers_source: d.source, workers_basis: basis };
  });
}

export async function enrichDiscoverWorkers<T extends WithIdAndEmployees>(
  supabase: RpcClient,
  rows: T[],
): Promise<Array<T & WorkersSelection>> {
  if (rows.length === 0) return rows;
  const displayById = await fetchDisplayWorkersBatch(
    supabase,
    rows.map((r) => r.id),
  );
  return applyDiscoverWorkersSelection(rows, displayById);
}
