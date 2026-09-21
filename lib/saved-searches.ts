/**
 * saved_searches API boundary (REZ-B). Auth and ownership are enforced here;
 * RLS also keys owner_id to auth.uid(). Live counts refresh when last_counted_at
 * is older than 10 minutes.
 */

import { fetchDiscoverV32 } from "@/lib/discover-v32-rpc";
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
  href: string;
};

export type SavedResult = {
  status: number;
  body: unknown;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COUNT_FRESH_MS = 10 * 60 * 1000;

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
    .order("created_at", { ascending: false });
  if (listed.error) {
    return { status: 500, body: { error: "list failed", detail: listed.error.message } };
  }

  const now = input.now ?? new Date();
  const rows = (listed.data ?? []) as Record<string, unknown>[];
  const out: SavedSearchJson[] = [];
  for (const row of rows) {
    const state = asState(row.query_state);
    let count = typeof row.last_count === "number" ? row.last_count : null;
    const countedAt = typeof row.last_counted_at === "string" ? Date.parse(row.last_counted_at) : NaN;
    const stale = !Number.isFinite(countedAt) || now.getTime() - countedAt > COUNT_FRESH_MS;
    if (stale) {
      const live = await fetchDiscoverV32(input.supabase, { ...state, page: 1, per: 25 }, { limit: 1, offset: 0 });
      if (live.total !== null) {
        count = live.total;
        await input.supabase
          .from("saved_searches")
          .update({ last_count: count, last_counted_at: now.toISOString() })
          .eq("id", String(row.id));
      }
    }
    out.push({
      id: String(row.id),
      name: String(row.name ?? ""),
      query_state: row.query_state,
      created_at: String(row.created_at ?? ""),
      last_count: count,
      href: hrefOf(state),
    });
  }
  return { status: 200, body: { searches: out } };
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
    return { status: 400, body: { error: "invalid name" } };
  }
  let state: DiscoverState | null = null;
  if (typeof rec.search === "string") {
    state = parseDiscoverState(new URLSearchParams(rec.search.replace(/^\?/, "")));
  } else if (rec.query_state !== undefined) {
    state = asState(rec.query_state);
  }
  if (!state) return { status: 400, body: { error: "invalid query_state" } };

  const inserted = await input.supabase.from("saved_searches").insert({
    owner_id: ownerId,
    name,
    query_state: { search: serializeDiscoverState(state).toString() },
  });
  if (inserted.error) {
    return { status: 500, body: { error: "save failed", detail: inserted.error.message } };
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
