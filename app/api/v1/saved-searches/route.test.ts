// PATCH /api/v1/saved-searches — rename a saved search (gap row 17), at the route: who may, which
// row it touches, what it will not accept, and that only the name changes.

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { BUYER_ID, fake, resetFake } from "../route-test-fake";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fake client must be installed before the route loads.
const { PATCH } = require("./route") as typeof import("./route");

const MINE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THEIRS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STRANGER = "0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c";

const patch = (body: unknown) =>
  PATCH(new Request("https://sourcebd.net/api/v1/saved-searches", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }));
const seed = () => {
  fake.tables.saved_searches = [
    { id: MINE, owner_id: BUYER_ID, name: "Knit", query_state: { search: "q=knit" }, last_count: 12 },
    { id: THEIRS, owner_id: STRANGER, name: "Denim", query_state: { search: "q=denim" }, last_count: 4 },
  ];
};
const written = () => fake.fromCalls.filter((c) => c.table === "saved_searches" && c.update);

beforeEach(resetFake);

describe("PATCH /api/v1/saved-searches", () => {
  it("answers 401 with no session or a supplier, 400 for a bad id, name or body, and writes nothing", async () => {
    seed();
    fake.userId = null;
    assert.equal((await patch({ id: MINE, name: "Knit tops" })).status, 401);
    resetFake();
    seed();
    fake.role = "supplier";
    assert.equal((await patch({ id: MINE, name: "Knit tops" })).status, 401);
    resetFake();
    seed();
    assert.equal((await patch({ id: "not-a-uuid", name: "Knit tops" })).status, 400);
    assert.equal((await patch({ name: "Knit tops" })).status, 400);
    const blank = await patch({ id: MINE, name: "   " });
    assert.equal(blank.status, 400);
    assert.deepEqual(await blank.json(), { error: "invalid name" });
    assert.equal((await patch({ id: MINE, name: "x".repeat(121) })).status, 400);
    assert.equal((await patch({ id: MINE, name: 7 })).status, 400);
    assert.equal((await patch("{")).status, 400);
    assert.equal((await patch([MINE])).status, 400);
    assert.equal(written().length, 0);
    assert.equal(fake.tables.saved_searches![0]!.name, "Knit");
  });

  it("renames the buyer's own search, trimmed, and leaves its filters and count alone", async () => {
    seed();
    const res = await patch({ id: MINE, name: "  Knit tops, Gazipur  " });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, name: "Knit tops, Gazipur" });
    const [call] = written();
    assert.deepEqual(call!.update, { name: "Knit tops, Gazipur" }, "only the name is written");
    assert.deepEqual(call!.filters, [{ op: "eq", args: ["id", MINE] }, { op: "eq", args: ["owner_id", BUYER_ID] }]);
    assert.deepEqual(fake.tables.saved_searches![0], { id: MINE, owner_id: BUYER_ID, name: "Knit tops, Gazipur", query_state: { search: "q=knit" }, last_count: 12 });
  });

  it("another buyer's search is a 404 and keeps its name; so is one that is gone", async () => {
    seed();
    const theirs = await patch({ id: THEIRS, name: "Mine now" });
    assert.equal(theirs.status, 404);
    assert.deepEqual(await theirs.json(), { error: "not found" });
    assert.equal(fake.tables.saved_searches![1]!.name, "Denim");
    assert.equal((await patch({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Gone" })).status, 404);
  });

  it("a failed write is a 500, never a rename that did not happen", async () => {
    seed();
    fake.tableError = { message: "down" };
    const res = await patch({ id: MINE, name: "Knit tops" });
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: "rename failed" });
  });
});
