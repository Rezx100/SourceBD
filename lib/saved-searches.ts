/**
 * saved_searches API boundary (REZ-B). Auth and ownership are enforced here;
 * RLS also keys owner_id to auth.uid(). Live counts refresh when last_counted_at
 * is older than 10 minutes.
 */

import { formatCount } from "@/lib/dashboard/facts";
import { SAVED_SEARCH_ERROR } from "@/lib/saved-search-errors";
import { COUNT_ONLY_SORT, fetchDiscoverV32 } from "@/lib/discover-v32-rpc";
import { parseDiscoverState, serializeDiscoverState, type DiscoverState } from "@/lib/discover-v32-state";

export type SavedSearchClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> };
};

export type SavedSearchJson = {
  id: string;
  name: string;
  query_state: unknown;
  created_at: string;
  last_count: number | null;
  /**
   * When `last_count` was measured, ISO-8601, or null when it never has been.
   * The list refreshes at most `MAX_REFRESH_PER_CALL` stale counts per call,
   * so most of what it returns is a remembered number and not a live one. The
   * page printed every count bare, which said "3,481 suppliers" about a search
   * last counted days ago as confidently as about one counted a second ago.
   */
  last_counted_at: string | null;
  href: string;
};

export type SavedResult = {
  status: number;
  body: unknown;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COUNT_FRESH_MS = 10 * 60 * 1000;
/** Most saved searches a list call will return. */
/** Also the per-owner row cap 0104 enforces (`saved_searches_owner_cap`),
 * so no saved search can exist that the list cannot show or delete. */
export const LIST_LIMIT = 200;
/** Under 0104's 8 KB `query_state` check with room for the JSON wrapper. */
const MAX_SAVED_SEARCH_CHARS = 4000;
/**
 * Most stale counts one list call will refresh. Each refresh is a full
 * `discover_suppliers` scan, and the list ran one per stale row, sequentially,
 * with no ceiling on either: a buyer with a few thousand saved searches turned
 * a single GET into thousands of scans, every ten minutes. The rest keep the
 * count they have, carrying `last_counted_at` so the page can say so.
 *
 * The budget goes to the STALEST rows first. Spending it in the list's own
 * `created_at desc` order meant the same ten newest searches were refreshed on
 * every call and the eleventh was never refreshed again, so its count aged
 * without limit while the response looked no different.
 */
const MAX_REFRESH_PER_CALL = 10;

function asState(raw: unknown): DiscoverState {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    if (typeof rec.search === "string") {
      return parseDiscoverState(new URLSearchParams(rec.search.replace(/^\?/, "")));
    }
  }
  if (typeof raw === "string") {
    return parseDiscoverState(new URLSearchParams(raw.replace(/^\?/, "")));
  }
  return parseDiscoverState(new URLSearchParams());
}

function hrefOf(state: DiscoverState): string {
  const qs = serializeDiscoverState(state).toString();
  return qs ? `/app/discover?${qs}` : "/app/discover";
}

export async function runSavedSearchesGet(input: {
  role: string | null;
  supabase: SavedSearchClient;
  now?: Date;
}): Promise<SavedResult> {
  if (input.role !== "buyer" && input.role !== "admin") {
    return { status: 401, body: { error: "unauthorised" } };
  }
  const { data: user } = await input.supabase.auth.getUser();
  const ownerId = user.user?.id;
  if (!ownerId) return { status: 401, body: { error: "unauthorised" } };

  const listed = await input.supabase
    .from("saved_searches")
    .select("id, name, query_state, created_at, last_count, last_counted_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT + 1);
  if (listed.error) {
    return { status: 500, body: { error: "list failed", detail: listed.error.message } };
  }

  const now = input.now ?? new Date();
  // One more than the cap is fetched so "there are more" is observed rather
  // than inferred: `rows.length >= LIST_LIMIT` called it capped at exactly
  // LIST_LIMIT, where nothing is hidden, and told the buyer otherwise.
  const fetched = (listed.data ?? []) as Record<string, unknown>[];
  const capped = fetched.length > LIST_LIMIT;
  const rows = capped ? fetched.slice(0, LIST_LIMIT) : fetched;

  const countedAtMs = (row: Record<string, unknown>): number =>
    typeof row.last_counted_at === "string" ? Date.parse(row.last_counted_at) : NaN;
  const isStale = (row: Record<string, unknown>): boolean => {
    const at = countedAtMs(row);
    return !Number.isFinite(at) || now.getTime() - at > COUNT_FRESH_MS;
  };

  // Never counted sorts first (NaN treated as time zero), then oldest count.
  const toRefresh = new Set(
    rows
      .filter(isStale)
      .slice()
      .sort((a, b) => {
        const x = countedAtMs(a);
        const y = countedAtMs(b);
        return (Number.isFinite(x) ? x : 0) - (Number.isFinite(y) ? y : 0);
      })
      .slice(0, MAX_REFRESH_PER_CALL),
  );

  const out: SavedSearchJson[] = [];
  for (const row of rows) {
    const state = asState(row.query_state);
    let count = typeof row.last_count === "number" ? row.last_count : null;
    let countedAt = typeof row.last_counted_at === "string" ? row.last_counted_at : null;
    if (toRefresh.has(row)) {
      const live = await fetchDiscoverV32(input.supabase, { ...state, sort: COUNT_ONLY_SORT, page: 1, per: 25 }, { limit: 1, offset: 0 });
      if (live.total !== null) {
        count = live.total;
        countedAt = now.toISOString();
        await input.supabase
          .from("saved_searches")
          .update({ last_count: count, last_counted_at: countedAt })
          .eq("id", String(row.id));
      }
    }
    out.push({
      id: String(row.id),
      name: String(row.name ?? ""),
      query_state: row.query_state,
      created_at: String(row.created_at ?? ""),
      last_count: count,
      last_counted_at: count === null ? null : countedAt,
      href: hrefOf(state),
    });
  }
  // `LIST_LIMIT` is a cap with no pagination behind it, so a buyer with more
  // than that many saved searches simply could not reach the rest — and the
  // page printed `${searches.length} saved` as though that were all of them.
  return { status: 200, body: { searches: out, capped } };
}

export async function runSavedSearchesPost(input: {
  role: string | null;
  supabase: SavedSearchClient;
  raw: unknown;
}): Promise<SavedResult> {
  if (input.role !== "buyer" && input.role !== "admin") {
    return { status: 401, body: { error: "unauthorised" } };
  }
  const { data: user } = await input.supabase.auth.getUser();
  const ownerId = user.user?.id;
  if (!ownerId) return { status: 401, body: { error: "unauthorised" } };

  if (!input.raw || typeof input.raw !== "object" || Array.isArray(input.raw)) {
    return { status: 400, body: { error: "body must be an object" } };
  }
  const rec = input.raw as Record<string, unknown>;
  const name = typeof rec.name === "string" ? rec.name.trim() : "";
  if (!name || name.length > 120) {
    return { status: 400, body: { error: SAVED_SEARCH_ERROR.invalidName } };
  }
  let state: DiscoverState | null = null;
  if (typeof rec.search === "string") {
    state = parseDiscoverState(new URLSearchParams(rec.search.replace(/^\?/, "")));
  } else if (rec.query_state !== undefined) {
    state = asState(rec.query_state);
  }
  if (!state) return { status: 400, body: { error: "invalid query_state" } };

  const search = serializeDiscoverState(state).toString();
  // 0104 bounds these at the database (state ≤ 8 KB, LIST_LIMIT rows per
  // owner); say so as a reason, not a bare 500 carrying Postgres's text.
  if (search.length > MAX_SAVED_SEARCH_CHARS) {
    return { status: 400, body: { error: SAVED_SEARCH_ERROR.tooLong } };
  }
  const inserted = await input.supabase.from("saved_searches").insert({
    owner_id: ownerId,
    name,
    query_state: { search },
  });
  if (inserted.error) {
    const code = (inserted.error as { code?: string }).code;
    if (code === "54000") return { status: 409, body: { error: SAVED_SEARCH_ERROR.limitReached } };
    if (code === "23514") return { status: 400, body: { error: SAVED_SEARCH_ERROR.tooLong } };
    return { status: 500, body: { error: "save failed" } };
  }
  return { status: 200, body: { ok: true } };
}

export async function runSavedSearchesDelete(input: {
  role: string | null;
  supabase: SavedSearchClient;
  id: string | null;
}): Promise<SavedResult> {
  if (input.role !== "buyer" && input.role !== "admin") {
    return { status: 401, body: { error: "unauthorised" } };
  }
  if (!input.id || !UUID_RE.test(input.id)) {
    return { status: 400, body: { error: "invalid id" } };
  }
  const { data: user } = await input.supabase.auth.getUser();
  const ownerId = user.user?.id;
  if (!ownerId) return { status: 401, body: { error: "unauthorised" } };

  const deleted = await input.supabase.from("saved_searches").delete().eq("id", input.id).eq("owner_id", ownerId);
  if (deleted.error) {
    return { status: 500, body: { error: "delete failed", detail: deleted.error.message } };
  }
  return { status: 200, body: { ok: true } };
}

export function savedSearchRedirectHref(queryState: unknown): string {
  return hrefOf(asState(queryState));
}

/**
 * How a saved search's count should read on the page. The number alone is a
 * claim that it is current, and at most `MAX_REFRESH_PER_CALL` of them are.
 */
export function savedCountLabel(
  count: number | null,
  countedAtIso: string | null,
  now: Date,
): string {
  if (count === null) return "not counted yet";
  const n = `${formatCount(count)} suppliers`;
  const at = countedAtIso ? Date.parse(countedAtIso) : NaN;
  if (!Number.isFinite(at)) return `${n}, when last counted`;
  const minutes = Math.max(0, Math.round((now.getTime() - at) / 60000));
  if (minutes < 1) return `${n}, just now`;
  if (minutes < 60) return `${n}, as of ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${n}, as of ${hours} h ago`;
  return `${n}, as of ${Math.round(hours / 24)} d ago`;
}
