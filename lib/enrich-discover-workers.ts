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
  /** How many sites the figure sums, and whether this record is one (0104). */
  sites?: number;
  includes_root?: boolean;
};

export type DisplayWorkersById = Record<string, DisplayWorkersEntry>;

/**
 * What the display figure covers, relative to the record it is shown under,
 * as `production_workers_display_batch` reports it (`sites`, `includes_root`,
 * added by 0104). Never inferred from the numbers: an RSC headcount that
 * differs from the register figure is one site's other source, not a group.
 *
 * - `own` — this record alone (from whichever source the batch preferred).
 * - `group` — this record plus at least one building.
 * - `excludes-record` — buildings only; this record is not in the sum.
 * - `unknown` — the batch did not say (a database without 0104's version).
 */
export type WorkersBasis = "own" | "group" | "excludes-record" | "unknown";

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
      ...(typeof row.sites === "number" && typeof row.includes_root === "boolean"
        ? { sites: row.sites, includes_root: row.includes_root }
        : {}),
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
  /** The supplier row's own figure, before `employees_total` was overwritten. */
  workers_own?: number | null;
};

export function applyDiscoverWorkersSelection<T extends WithIdAndEmployees>(
  rows: T[],
  displayById: DisplayWorkersById,
): Array<T & WorkersSelection> {
  return rows.map((r) => {
    const d = displayById[r.id];
    if (!d) return r;
    // Composition comes from the batch, which knows which sites it summed.
    // Comparing the figure with the record's own number was the third wrong
    // answer: the batch prefers RSC, so a standalone factory whose RSC
    // headcount differs from its register figure read as "this record and
    // its buildings" (639 live factories, 24 Sep 2026). Without the batch's
    // word the basis is "unknown", and nothing may claim buildings.
    //
    // `r.employees_total` is still the supplier row's own figure here — the
    // one `discover_suppliers` sorts and filters `workers` on — so it is kept
    // as `workers_own` before being overwritten with the display figure.
    const own = r.employees_total;
    const basis: WorkersBasis =
      d.sites === undefined || d.includes_root === undefined
        ? d.value === own
          ? "own"
          : "unknown"
        : !d.includes_root
          ? "excludes-record"
          : d.sites > 1
            ? "group"
            : "own";
    return { ...r, employees_total: d.value, workers_source: d.source, workers_basis: basis, workers_own: own };
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
