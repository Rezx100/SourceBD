/**
 * REZ-114 — Smart Match response builder (injectable deps for boundary tests).
 */

import { enrichDiscoverWorkers } from "./enrich-discover-workers";

export type MatchRpcClient = {
  // supabase rpc returns a thenable builder — same surface as enrichDiscoverWorkers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export type MatchResultDoc = {
  criteria_count?: number;
  total?: number;
  results?: Array<{ id: string; employees_total: number | null } & Record<string, unknown>>;
  [key: string]: unknown;
};

const ALLOWED_ENTITY_TYPES = new Set(["factory", "buying_house"]);
const ALLOWED_REGISTRIES = new Set(["BGMEA", "BKMEA", "BTMA", "BGAPMEA", "EPB", "RSC"]);
const ALLOWED_CERTS = new Set(["wrap", "oeko_tex", "gots", "sa8000"]);

type Json = Record<string, unknown>;

function asStringArray(
  v: unknown,
  allowed: Set<string>,
  normalise: (s: string) => string,
): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string") continue;
    const n = normalise(x.trim());
    if (n && allowed.has(n)) out.add(n);
  }
  return out.size > 0 ? Array.from(out) : null;
}

function asTrimmedString(v: unknown, max = 120): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function asBoundedInt(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < min || i > max) return null;
  return i;
}

export function buildSmartMatchPayload(raw: Json): Json {
  const payload: Json = {};
  const product = asTrimmedString(raw.product, 80);
  if (product) payload.product = product;

  const entityTypes = asStringArray(raw.entity_types, ALLOWED_ENTITY_TYPES, (s) =>
    s.toLowerCase(),
  );
  if (entityTypes) payload.entity_types = entityTypes;

  const registries = asStringArray(raw.registries, ALLOWED_REGISTRIES, (s) =>
    s.toUpperCase(),
  );
  if (registries) payload.registries = registries;

  const certs = asStringArray(raw.certs, ALLOWED_CERTS, (s) => s.toLowerCase());
  if (certs) payload.certs = certs;

  const rscMin = asBoundedInt(raw.rsc_min, 0, 100);
  if (rscMin !== null) payload.rsc_min = rscMin;

  const minMachines = asBoundedInt(raw.min_machines, 0, 100000);
  if (minMachines !== null) payload.min_machines = minMachines;

  const city = asTrimmedString(raw.city, 80);
  if (city) payload.city = city;

  const district = asTrimmedString(raw.district, 80);
  if (district) payload.district = district;

  const limit = asBoundedInt(raw.limit, 1, 100);
  payload.limit = limit ?? 24;

  const offset = asBoundedInt(raw.offset, 0, 100000);
  payload.offset = offset ?? 0;

  return payload;
}

/** Observable match API outcome — status + JSON body. */
export async function runSmartMatch(opts: {
  role: string | null;
  supabase: MatchRpcClient;
  raw: unknown;
}): Promise<{ status: number; body: unknown }> {
  if (opts.role !== "buyer" && opts.role !== "admin") {
    return { status: 401, body: { error: "unauthorised" } };
  }
  if (!opts.raw || typeof opts.raw !== "object" || Array.isArray(opts.raw)) {
    return { status: 400, body: { error: "body must be an object" } };
  }
  const payload = buildSmartMatchPayload(opts.raw as Json);
  const { data, error } = await opts.supabase.rpc("buyer_smart_match", {
    p_input: payload,
  });
  if (error) {
    return {
      status: 500,
      body: { error: "match failed", detail: error.message },
    };
  }
  const doc = (data ?? {
    criteria_count: 0,
    total: 0,
    results: [],
  }) as MatchResultDoc;
  if (Array.isArray(doc.results) && doc.results.length > 0) {
    doc.results = await enrichDiscoverWorkers(opts.supabase, doc.results);
  }
  return { status: 200, body: doc };
}
