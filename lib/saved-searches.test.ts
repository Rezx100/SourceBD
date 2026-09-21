import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runSavedSearchesDelete, runSavedSearchesGet, runSavedSearchesPost } from "./saved-searches";

function clientOver(over: {
  userId?: string | null;
  rows?: Record<string, unknown>[];
  insertError?: string | null;
  inserted?: unknown[];
} = {}) {
  const rows = over.rows ?? [];
  const inserted = over.inserted;
  return {
    rpc: async () => ({ data: [{ total_count: 12 }], error: null }),
    from() {
      const api = {
        select: () => api,
        insert: async (row: unknown) => {
          inserted?.push(row);
          return { data: { id: "n" }, error: over.insertError ? { message: over.insertError } : null };
        },
        update: () => api,
        delete: () => api,
        eq: () => api,
        order: async () => ({ data: rows, error: null }),
        then: (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: rows, error: null }),
      };
      return api;
    },
    auth: {
      getUser: async () => ({ data: { user: over.userId === null ? null : { id: over.userId ?? "user-1" } } }),
    },
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
      supabase: clientOver({
        rows: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            name: "Knit",
            query_state: { search: "q=knit&hs=6105" },
            created_at: "2026-09-21T00:00:00Z",
            last_count: 12,
            last_counted_at: new Date().toISOString(),
          },
        ],
      }),
    });
    assert.equal(res.status, 200);
    const body = res.body as { searches: { name: string; href: string; last_count: number }[] };
    assert.equal(body.searches[0]?.name, "Knit");
    assert.equal(body.searches[0]?.href, "/app/discover?q=knit&hs=6105");
    assert.equal(body.searches[0]?.last_count, 12);
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
