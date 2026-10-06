// POST /api/v1/saved-searches/last (gap row 14, migration 0113), at the route: who may keep a last
// search, what is stored (the shape a saved search keeps, without its page), and what is refused.

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { called, fake, resetFake } from "../../route-test-fake";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fake client must be installed before the route loads.
const { POST } = require("./route") as typeof import("./route");

const post = (body: unknown) =>
  POST(new Request("https://sourcebd.net/api/v1/saved-searches/last", { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(resetFake);

describe("POST /api/v1/saved-searches/last", () => {
  it("keeps the search as a saved search keeps it: normalised, with no page", async () => {
    const res = await post({ search: "?q=knit&page=4" });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.deepEqual(called("buyer_last_search_set").map((c) => c.args), [{ p_state: { search: "q=knit" } }]);
  });

  it("is 401 with no session or for a supplier, and keeps nothing", async () => {
    fake.userId = null;
    fake.role = null;
    assert.equal((await post({ search: "q=knit" })).status, 401);
    resetFake();
    fake.role = "supplier";
    assert.equal((await post({ search: "q=knit" })).status, 401);
    assert.equal(called("buyer_last_search_set").length, 0);
  });

  it("refuses a body that is not a search with words or a filter, before the database is asked", async () => {
    assert.equal((await post("{")).status, 400);
    assert.equal((await post([])).status, 400);
    assert.equal((await post({})).status, 400);
    assert.equal((await post({ search: 7 })).status, 400);
    assert.equal((await post({ search: "" })).status, 400, "a search with nothing in it");
    assert.equal((await post({ search: "sort=name&page=2" })).status, 400, "a sort and a page are not filters");
    assert.equal(called("buyer_last_search_set").length, 0);
  });

  it("stores what the search parser keeps, so an oversize words field cannot reach the 8 KB bound", async () => {
    assert.equal((await post({ search: `q=${"x".repeat(7000)}` })).status, 200);
    const stored = (called("buyer_last_search_set")[0]!.args as { p_state: { search: string } }).p_state.search;
    assert.ok(stored.length < 1000, `stored ${stored.length} characters`);
  });

  it("turns the database's refusals into statuses and gives away no detail", async () => {
    fake.answers.buyer_last_search_set = { data: null, error: { message: "boom: secret detail", code: "XX000" } };
    const failed = await post({ search: "q=knit" });
    assert.equal(failed.status, 500);
    assert.doesNotMatch(JSON.stringify(await failed.json()), /secret/);
    fake.answers.buyer_last_search_set = { data: null, error: { message: "not authenticated", code: "42501" } };
    assert.equal((await post({ search: "q=knit" })).status, 401);
    fake.answers.buyer_last_search_set = { data: null, error: { message: "too big", code: "22023" } };
    assert.equal((await post({ search: "q=knit" })).status, 400);
  });
});
