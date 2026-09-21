import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runSavedSearchesDelete, runSavedSearchesGet, runSavedSearchesPost } from "./saved-searches";

/**
 * A stub that actually applies the filters it is given.
 *
 * The previous version defined `eq: () => api`, discarding both arguments and
 * returning every seeded row regardless. Under it, deleting `.eq("owner_id",
 * ownerId)` from both the GET and the DELETE path in `saved-searches.ts` left
 * all seven tests green — so nothing here guarded owner isolation at all, which
 * is the single most important property of this endpoint. Recording the filters
 * and applying them makes that property falsifiable: `matchedRows` and
 * `deleteFilters` below are what the assertions read.
 */
function clientOver(over: {
  userId?: string | null;
  rows?: Record<string, unknown>[];
  insertError?: string | null;
  inserted?: unknown[];
  /** Filters seen on the delete chain, in call order. */
  deleteFilters?: [string, unknown][];
} = {}) {
  const rows = over.rows ?? [];
  const inserted = over.inserted;
  return {
    rpc: async () => ({ data: [{ total_count: 12 }], error: null }),
    from() {
      const filters: [string, unknown][] = [];
      let deleting = false;
      const matched = () =>
        rows.filter((r) => filters.every(([col, val]) => r[col] === val));
      const api = {
        select: () => api,
        insert: async (row: unknown) => {
          inserted?.push(row);
          return { data: { id: "n" }, error: over.insertError ? { message: over.insertError } : null };
        },
        update: () => api,
        delete: () => {
          deleting = true;
          return api;
        },
        eq: (col: string, val: unknown) => {
          filters.push([col, val]);
          if (deleting) over.deleteFilters?.push([col, val]);
          return api;
        },
        order: async () => ({ data: matched(), error: null }),
        then: (resolve: (v: { data: unknown; error: null }) => void) =>
          resolve({ data: matched(), error: null }),
      };
      return api;
    },
    auth: {
      getUser: async () => ({ data: { user: over.userId === null ? null : { id: over.userId ?? "user-1" } } }),
    },
  };
}

const OWNER = "user-1";
const STRANGER = "user-2";
const ROW_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function savedRow(ownerId: string, id = ROW_ID): Record<string, unknown> {
  return {
    id,
    owner_id: ownerId,
    name: "Knit",
    query_state: { search: "q=knit&hs=6105" },
    created_at: "2026-09-21T00:00:00Z",
    last_count: 12,
    last_counted_at: new Date().toISOString(),
  };
}

describe("saved-searches API boundary", () => {
  it("GET 401 when the caller is not a buyer", async () => {
    const res = await runSavedSearchesGet({ role: null, supabase: clientOver() });
    assert.equal(res.status, 401);
  });

  it("POST 401 when the caller is not a buyer", async () => {
    const res = await runSavedSearchesPost({
      role: "supplier",
      supabase: clientOver(),
      raw: { name: "Knit", search: "q=knit" },
    });
    assert.equal(res.status, 401);
  });

  it("POST 400 on a missing name", async () => {
    const res = await runSavedSearchesPost({
      role: "buyer",
      supabase: clientOver(),
      raw: { search: "q=knit" },
    });
    assert.equal(res.status, 400);
  });

  it("POST 200 stores the query string", async () => {
    const inserted: unknown[] = [];
    const res = await runSavedSearchesPost({
      role: "buyer",
      supabase: clientOver({ inserted }),
      raw: { name: "Knitted shirts", search: "q=knit&hs=6105" },
    });
    assert.equal(res.status, 200);
    const row = inserted[0] as { owner_id: string; name: string; query_state: { search: string } };
    assert.equal(row.owner_id, "user-1");
    assert.equal(row.name, "Knitted shirts");
    assert.match(row.query_state.search, /q=knit/);
    assert.match(row.query_state.search, /hs=6105/);
  });

  it("GET 200 returns the stored href", async () => {
    const res = await runSavedSearchesGet({
      role: "buyer",
      supabase: clientOver({ rows: [savedRow(OWNER)] }),
    });
    assert.equal(res.status, 200);
    const body = res.body as { searches: { name: string; href: string; last_count: number }[] };
    assert.equal(body.searches[0]?.name, "Knit");
    assert.equal(body.searches[0]?.href, "/app/discover?q=knit&hs=6105");
    assert.equal(body.searches[0]?.last_count, 12);
  });

  it("GET never returns another buyer's saved search", async () => {
    // Goes red if `.eq("owner_id", ownerId)` is dropped from the GET path:
    // the stranger's row is the only row seeded, so without the filter it
    // comes back and the caller reads someone else's saved query.
    const res = await runSavedSearchesGet({
      role: "buyer",
      supabase: clientOver({ userId: OWNER, rows: [savedRow(STRANGER, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")] }),
    });
    assert.equal(res.status, 200);
    const body = res.body as { searches: unknown[] };
    assert.deepEqual(body.searches, [], "a row owned by another user must not be returned");
  });

  it("DELETE is scoped to the caller, not just to the row id", async () => {
    // Goes red if `.eq("owner_id", ownerId)` is dropped from the DELETE path.
    // Asserting the status alone cannot catch that — an unscoped delete also
    // returns 200, while having removed a stranger's row.
    const deleteFilters: [string, unknown][] = [];
    const res = await runSavedSearchesDelete({
      role: "buyer",
      supabase: clientOver({ userId: OWNER, rows: [savedRow(OWNER)], deleteFilters }),
      id: ROW_ID,
    });
    assert.equal(res.status, 200);
    assert.ok(
      deleteFilters.some(([col, val]) => col === "owner_id" && val === OWNER),
      `delete must filter on owner_id; saw ${JSON.stringify(deleteFilters)}`,
    );
    assert.ok(
      deleteFilters.some(([col, val]) => col === "id" && val === ROW_ID),
      `delete must filter on id; saw ${JSON.stringify(deleteFilters)}`,
    );
  });

  it("DELETE 400 on a non-uuid id", async () => {
    const res = await runSavedSearchesDelete({
      role: "admin",
      supabase: clientOver(),
      id: "not-a-uuid",
    });
    assert.equal(res.status, 400);
  });

  it("DELETE 200 on a uuid for the signed-in owner", async () => {
    const res = await runSavedSearchesDelete({
      role: "admin",
      supabase: clientOver(),
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    assert.equal(res.status, 200);
  });
});
