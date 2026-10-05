// What the Saved pages read, so a failed read is told apart from an empty list. The same reads as
// before: `buyer_saved_list` with the two worker figures `enrichDiscoverWorkers` adds, the two
// compliance reads (every expired certificate, every one still valid for up to a year) for the "first
// certificate to check" column, and the buyer's own saved searches, with the last search they ran
// (`buyer_last_search`, migration 0113, read softly: a database without it is no card). The
// saved-search count is a plain count under the buyer's session, filtered to the owner as the
// other saved-search paths do.

import { enrichDiscoverWorkers } from "@/lib/enrich-discover-workers";
import { LIST_LIMIT, runSavedSearchesGet, type SavedSearchJson } from "@/lib/saved-searches";
import { PAGE_SIZE, groupCerts, type CertRead, type CertsBySupplier, type SavedRow, type SavedSort } from "./words";

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

/**
 * The widest window `compliance_expiring_certs` allows (it clamps to 365). Past 90 days a certificate is
 * "valid" (`certState`), so this is how the column can print one; a certificate valid for longer than a year
 * is not returned, and that supplier reads "Nothing to check", which stays true.
 */
export const CERT_WINDOW_DAYS = 365;

const certRows = (d: unknown): CertRead[] | null => (d && typeof d === "object" && Array.isArray((d as { rows?: unknown }).rows) ? ((d as { rows: CertRead[] }).rows) : null);

/** How many saved searches the buyer has; null when it could not be counted. */
export async function countSavedSearches(supabase: Client): Promise<number | null> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return null;
    const res = await supabase.from("saved_searches").select("id", { count: "exact", head: true }).eq("owner_id", uid);
    return res.error || typeof res.count !== "number" ? null : res.count;
  } catch {
    return null;
  }
}

/**
 * Which of the buyer's saved searches email new matches (0113's `alert_weekly`), by id. Its own soft read, not
 * a column of the list's select: a missing column would empty every saved-search list on a database without
 * 0113. Null when it could not be read, and then no switch is drawn (it would claim a state nobody read).
 */
export async function readAlerts(supabase: Client): Promise<Record<string, boolean> | null> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return null;
    const res = await supabase.from("saved_searches").select("id, alert_weekly").eq("owner_id", uid).limit(LIST_LIMIT);
    if (res.error || !Array.isArray(res.data)) return null;
    // Only a switch the database actually answered (a true or a false) is kept; anything else draws none.
    const read = (res.data as { id: unknown; alert_weekly: unknown }[]).filter((r) => typeof r.alert_weekly === "boolean");
    return Object.fromEntries(read.map((r) => [String(r.id), r.alert_weekly as boolean]));
  } catch {
    return null;
  }
}

/** True when the database has the switch (0113); the Save form draws "Tell me about new matches" only then. */
export async function alertsAvailable(supabase: Client): Promise<boolean> {
  try {
    const res = await supabase.from("saved_searches").select("alert_weekly").limit(1);
    return !res.error;
  } catch {
    return false;
  }
}

export type SavedData = {
  /** Null when `buyer_saved_list` failed: no count and no empty state may stand in for it. */
  rows: SavedRow[] | null;
  total: number | null;
  certs: CertsBySupplier | null;
  searches: number | null;
};

export async function loadSaved(supabase: Client, sort: SavedSort, page: number): Promise<SavedData> {
  const [list, expired, expiring, searches] = await Promise.all([
    supabase.rpc("buyer_saved_list", { p_sort: sort, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    soft(() => supabase.rpc("compliance_expired_certs"), certRows, null),
    soft(() => supabase.rpc("compliance_expiring_certs", { p_window_days: CERT_WINDOW_DAYS }), certRows, null),
    countSavedSearches(supabase),
  ]);
  if (list.error || !Array.isArray(list.data)) return { rows: null, total: null, certs: null, searches };
  const rows = (await enrichDiscoverWorkers(supabase, list.data as SavedRow[])) as SavedRow[];
  // `buyer_saved_list` repeats the full count on every row; past the end there are no rows to carry it.
  const total = rows.length > 0 ? Number(rows[0]!.total_count ?? rows.length) : page > 1 ? null : 0;
  return { rows, total, certs: groupCerts(expired, expiring), searches };
}

export type SearchesData = {
  /** Null when the list could not be read. */
  searches: SavedSearchJson[] | null;
  capped: boolean;
  /** How many suppliers are saved, for the tab; null when unread. */
  suppliers: number | null;
  /** `buyer_last_search()` as it answered (0113); null when it did not, which is no card (`lastSearchCard`). */
  last: unknown;
  /** `readAlerts`: null when unread (no switches then). */
  alerts: Record<string, boolean> | null;
};

export async function loadSearches(supabase: Client, role: string | null | undefined, now: Date): Promise<SearchesData> {
  const [listed, suppliers, last, alerts] = await Promise.all([
    runSavedSearchesGet({ role, supabase, now } as Parameters<typeof runSavedSearchesGet>[0]),
    soft<number | null>(() => supabase.rpc("buyer_saved_list", { p_sort: "recent", p_limit: 1, p_offset: 0 }), (d) => (Array.isArray(d) ? (d.length > 0 ? Number((d[0] as { total_count?: number }).total_count ?? d.length) : 0) : null), null),
    soft<unknown>(() => supabase.rpc("buyer_last_search"), (d) => d, null),
    readAlerts(supabase),
  ]);
  const body = listed.status === 200 && listed.body && typeof listed.body === "object" ? (listed.body as { searches?: SavedSearchJson[]; capped?: boolean }) : null;
  return { searches: body && Array.isArray(body.searches) ? body.searches : null, capped: Boolean(body?.capped), suppliers, last, alerts };
}
