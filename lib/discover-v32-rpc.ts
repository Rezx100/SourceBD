// Caller for the v3.2 discover_suppliers return shape (REZ-B).
//
// HARD DEPENDENCY ON MIGRATION 0104. `discoverRpcArgs` always sends the
// parameters 0104 adds (p_hs_codes, p_cert_state, p_est_from, …), and
// PostgREST refuses a call naming a parameter the function lacks — so
// against a pre-0104 database every search fails, and the page says search
// is unavailable (not "heavy load": retrying cannot help). 0104 must be
// applied before, or with, the deploy that ships this file; never after.

import { enrichDiscoverWorkers, type WorkersBasis } from "@/lib/enrich-discover-workers";
import { resolveDiscoverSmartQuery } from "@/lib/discover-smart-query";
import {
  type DiscoverRpcArgs,
  type DiscoverState,
  discoverRpcArgs,
} from "@/lib/discover-v32-state";

export type DiscoverV32Row = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string | null;
  city: string | null;
  district: string | null;
  source_tags: string[] | null;
  t13_source_count: number | null;
  completeness_pct: number | null;
  employees_total: number | null;
  established_date: string | null;
  principal_products: string[] | null;
  factory_types: string[] | null;
  rsc_progress_pct: number | null;
  parent_group_name: string | null;
  primary_address: string | null;
  total_count: number | string | null;
  is_sanctioned: boolean | null;
  cert_summary: unknown;
  hs_codes: string[] | null;
  brand_codes: string[] | null;
  registries: string[] | null;
  /** Set by enrichDiscoverWorkers when employees_total is a group roll-up. */
  /**
   * Which register the headline worker figure came from, per
   * `production_workers_display_batch`. Absent when no display figure was
   * found and `employees_total` is the supplier row's own value.
   */
  workers_source?: "RSC" | "registry";
  /** What that figure covers — see `WorkersBasis`. Absent when no display figure was found. */
  workers_basis?: WorkersBasis;
  top_tier: number | null;
};

export type DiscoverExplainRow = { dropped: string; remaining: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => any };

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function asRow(raw: unknown): DiscoverV32Row | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.slug !== "string") return null;
  if (typeof r.company_name !== "string") return null;
  return {
    id: r.id,
    slug: r.slug,
    company_name: r.company_name,
    entity_type: typeof r.entity_type === "string" ? r.entity_type : null,
    city: typeof r.city === "string" ? r.city : null,
    district: typeof r.district === "string" ? r.district : null,
    source_tags: asStringArray(r.source_tags),
    t13_source_count: typeof r.t13_source_count === "number" ? r.t13_source_count : null,
    completeness_pct: typeof r.completeness_pct === "number" ? r.completeness_pct : null,
    employees_total: typeof r.employees_total === "number" ? r.employees_total : null,
    established_date: typeof r.established_date === "string" ? r.established_date : null,
    principal_products: asStringArray(r.principal_products),
    factory_types: asStringArray(r.factory_types),
    rsc_progress_pct: typeof r.rsc_progress_pct === "number" ? r.rsc_progress_pct : null,
    parent_group_name: typeof r.parent_group_name === "string" ? r.parent_group_name : null,
    primary_address: typeof r.primary_address === "string" ? r.primary_address : null,
    total_count:
      typeof r.total_count === "number" || typeof r.total_count === "string" ? r.total_count : null,
    is_sanctioned: typeof r.is_sanctioned === "boolean" ? r.is_sanctioned : false,
    cert_summary: r.cert_summary ?? [],
    hs_codes: asStringArray(r.hs_codes),
    brand_codes: asStringArray(r.brand_codes),
    registries: asStringArray(r.registries),
    top_tier: typeof r.top_tier === "number" ? r.top_tier : null,
  };
}

/**
 * A bigint count that PostgREST may send as a number or as a string.
 *
 * `Number()` is the wrong parser for this and the reason is not theoretical:
 * `Number("")` is 0, `Number("  ")` is 0, `Number("1e3")` is 1000 and
 * `Number("0x10")` is 16. A blank string arriving where a count was expected
 * therefore printed "0 suppliers" — an invented number, which is the single
 * class of defect this whole surface exists to prevent. A count is digits.
 */
export function parseCount(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
  if (typeof raw !== "string") return null;
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return Number.isSafeInteger(n) ? n : null;
}

export function parseTotalCount(rows: readonly DiscoverV32Row[]): number | null {
  const raw = rows[0]?.total_count;
  if (raw === null || raw === undefined) return rows.length > 0 ? null : 0;
  return parseCount(raw);
}

/**
 * The four contact columns `context/agent-brief.md` names. Exported because
 * the CSV backstop has to be the same list: `CSV_CONTACT_HEADERS` was hand-
 * typed and carried only two of the four, so a header named `contact_name`
 * would have passed a check whose comment claimed it covered every PII column.
 */
export const PII_KEYS = ["email_primary", "phones", "contact_name", "contact_role"] as const;

/** True when a raw RPC row carries a contact column the function must not return. */
export function discoverRowHasPii(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const r = raw as Record<string, unknown>;
  return PII_KEYS.some((k) => k in r && r[k] != null && r[k] !== "");
}

/** "busy" only for a statement timeout (SQLSTATE 57014), the one failure a
 * retry can cure. Everything else — a missing function (PGRST202, the
 * pre-0104 case), a permission error, the contact-field refusal — is
 * "unavailable", and the buyer is not told to try again. */
export type DiscoverFailure = "busy" | "unavailable";

export function discoverFailureKind(error: { code?: string | null } | null | undefined): DiscoverFailure {
  return error?.code === "57014" ? "busy" : "unavailable";
}

export function discoverFailureCopy(kind: DiscoverFailure): string {
  return kind === "busy"
    ? "Search is under heavy load. The count could not be read. Try again in a moment."
    : "Search is unavailable right now. This is a fault on our side, not a problem with your search.";
}

export async function fetchDiscoverV32(
  supabase: RpcClient,
  state: DiscoverState,
  over: { limit?: number; offset?: number } = {},
): Promise<{ rows: DiscoverV32Row[]; total: number | null; error: string | null; failure: DiscoverFailure | null }> {
  const smart = resolveDiscoverSmartQuery(state.q, "");
  const args: DiscoverRpcArgs = discoverRpcArgs(state, {
    ...over,
    rpcQ: smart.rpcQ || null,
  });
  const { data, error } = await supabase.rpc("discover_suppliers", args);
  if (error) {
    return { rows: [], total: null, error: error.message ?? "discover_suppliers failed", failure: discoverFailureKind(error) };
  }
  const rawRows = Array.isArray(data) ? data : [];
  if (rawRows.some(discoverRowHasPii)) {
    return { rows: [], total: null, error: "discover_suppliers returned contact fields", failure: "unavailable" };
  }
  const parsed = rawRows.map(asRow).filter((r): r is DiscoverV32Row => r !== null);
  const rows = await enrichDiscoverWorkers(supabase, parsed);
  const total = parseTotalCount(rows);
  return { rows, total, error: null, failure: null };
}

/** The cheap default ordering, for calls that want a count and not an order. */
export const COUNT_ONLY_SORT: DiscoverState["sort"] = "sources";

export async function fetchDiscoverExplain(
  supabase: RpcClient,
  state: DiscoverState,
): Promise<DiscoverExplainRow[]> {
  const smart = resolveDiscoverSmartQuery(state.q, "");
  // Count-only: the buyer's sort changes no count, and hs_lines/cert_expiry
  // cost a full-corpus pass per call — up to twelve nested calls here.
  const args = discoverRpcArgs({ ...state, sort: COUNT_ONLY_SORT }, { limit: 1, offset: 0, rpcQ: smart.rpcQ || null });
  const { data, error } = await supabase.rpc("discover_suppliers_explain", args);
  if (error || !Array.isArray(data)) return [];
  const out: DiscoverExplainRow[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.dropped !== "string") continue;
    const n = typeof r.remaining === "number" ? r.remaining : Number(r.remaining);
    if (!Number.isFinite(n)) continue;
    out.push({ dropped: r.dropped, remaining: n });
  }
  return out;
}

export type HsBatchLine = { slug: string; hs: string; heading: string | null };

export async function fetchHsBatch(
  supabase: RpcClient,
  slugs: string[],
): Promise<{ lines: HsBatchLine[]; error: boolean }> {
  const unique = [...new Set(slugs.filter(Boolean))].slice(0, 100);
  if (unique.length === 0) return { lines: [], error: false };
  const { data, error } = await supabase.rpc("supplier_epb_hscodes_batch", { p_slugs: unique });
  if (error) return { lines: [], error: true };
  if (!Array.isArray(data)) return { lines: [], error: false };
  const lines: HsBatchLine[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.slug !== "string" || typeof r.hs !== "string") continue;
    lines.push({
      slug: r.slug,
      hs: r.hs,
      heading: typeof r.heading === "string" ? r.heading : null,
    });
  }
  return { lines, error: false };
}

export type HsCatalogueRow = { hs: string; heading: string | null; exporter_count: number };

export async function fetchHsCatalogue(
  supabase: RpcClient,
): Promise<{ rows: HsCatalogueRow[]; error: boolean }> {
  const { data, error } = await supabase.rpc("hs_catalogue", {});
  if (error) return { rows: [], error: true };
  if (!Array.isArray(data)) return { rows: [], error: false };
  const rows: HsCatalogueRow[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.hs !== "string") continue;
    const n = typeof r.exporter_count === "number" ? r.exporter_count : Number(r.exporter_count);
    if (!Number.isFinite(n)) continue;
    rows.push({
      hs: r.hs,
      heading: typeof r.heading === "string" ? r.heading : null,
      exporter_count: n,
    });
  }
  return { rows, error: false };
}
