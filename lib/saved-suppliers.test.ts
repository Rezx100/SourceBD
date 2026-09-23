import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAX_BULK_SAVE, parseSaveTargets, runSavedSupplierPost } from "./saved-suppliers";

const OWNER = "00000000-0000-4000-8000-0000000000aa";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

/** Records every upsert call and the rows it carried. */
function client(upserts: unknown[][], error: unknown = null) {
  return {
    from(table: string) {
      assert.equal(table, "saved_suppliers");
      return {
        upsert: async (rows: unknown[]) => {
          upserts.push(rows);
          return { data: null, error };
        },
      };
    },
    auth: { getUser: async () => ({ data: { user: { id: OWNER } } }) },
  };
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `aaaaaaaa-1111-4111-8111-${String(i).padStart(12, "0")}`);

describe("POST /api/v1/saved", () => {
  it("saves a whole selection in ONE write, so select-all stays inside the 30/min write bucket", async () => {
    const upserts: unknown[][] = [];
    const res = await runSavedSupplierPost({ role: "buyer", supabase: client(upserts), raw: { supplier_ids: ids(100) } });
    assert.equal(res.status, 200);
    assert.equal(upserts.length, 1, "one database write per request, not one per supplier");
    assert.equal(upserts[0]?.length, 100);
    assert.equal(res.body.count, 100);
    for (const row of upserts[0] as { owner_id: string }[]) assert.equal(row.owner_id, OWNER);
  });

  it("still saves a single supplier_id, as the per-row button sends it", async () => {
    const upserts: unknown[][] = [];
    const res = await runSavedSupplierPost({ role: "buyer", supabase: client(upserts), raw: { supplier_id: A } });
    assert.equal(res.status, 200);
    assert.deepEqual(upserts, [[{ owner_id: OWNER, supplier_id: A }]]);
  });

  it("never takes the owner from the body", async () => {
    const upserts: unknown[][] = [];
    await runSavedSupplierPost({ role: "buyer", supabase: client(upserts), raw: { supplier_ids: [A], owner_id: B } });
    assert.equal((upserts[0]?.[0] as { owner_id: string } | undefined)?.owner_id, OWNER);
  });

  it("refuses more than one page's worth, an empty list, and any malformed id — writing nothing", async () => {
    for (const raw of [{ supplier_ids: ids(MAX_BULK_SAVE + 1) }, { supplier_ids: [] }, { supplier_ids: [A, "nope"] }, { supplier_ids: A }, null, []]) {
      const upserts: unknown[][] = [];
      const res = await runSavedSupplierPost({ role: "buyer", supabase: client(upserts), raw });
      assert.equal(res.status, 400, JSON.stringify(raw)?.slice(0, 60));
      assert.equal(upserts.length, 0);
    }
    const ok: unknown[][] = [];
    assert.equal((await runSavedSupplierPost({ role: "buyer", supabase: client(ok), raw: { supplier_ids: ids(MAX_BULK_SAVE) } })).status, 200);
  });

  it("401 for a caller who is not a buyer or admin, before touching the body or the database", async () => {
    for (const role of [null, "supplier"]) {
      const upserts: unknown[][] = [];
      const res = await runSavedSupplierPost({ role, supabase: client(upserts), raw: { supplier_ids: [A] } });
      assert.equal(res.status, 401);
      assert.equal(upserts.length, 0);
    }
  });

  it("a failed write is a 500 that does not echo the database's error text", async () => {
    const res = await runSavedSupplierPost({
      role: "buyer",
      supabase: client([], { message: 'insert violates foreign key constraint "saved_suppliers_supplier_id_fkey"' }),
      raw: { supplier_ids: [A] },
    });
    assert.equal(res.status, 500);
    assert.doesNotMatch(JSON.stringify(res.body), /constraint/);
  });

  it("dedupes and lower-cases ids", () => {
    const lettered = "abcdef11-1111-4111-8111-11111111abcd";
    assert.deepEqual(parseSaveTargets({ supplier_ids: [lettered, lettered.toUpperCase()] }), [lettered]);
  });
});
