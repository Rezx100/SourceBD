// PATCH /api/v1/saved-searches — rename a saved search (gap row 17) and turn "Email me new matches" on
// or off (gap row 14), and POST with that switch, at the route: who may, which row it touches, what it
// will not accept, and that only the one thing asked for is written.

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { BUYER_ID, fake, resetFake } from "../route-test-fake";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fake client must be installed before the route loads.
const { PATCH, POST } = require("./route") as typeof import("./route");

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

describe("PATCH /api/v1/saved-searches {alert_weekly}: Email me new matches", () => {
  it("answers 401 with no session or a supplier, 400 for a bad id, a non-boolean or a body, and writes nothing", async () => {
    seed();
    fake.userId = null;
    assert.equal((await patch({ id: MINE, alert_weekly: true })).status, 401);
    resetFake();
    seed();
    fake.role = "supplier";
    assert.equal((await patch({ id: MINE, alert_weekly: true })).status, 401);
    resetFake();
    seed();
    assert.equal((await patch({ id: "nope", alert_weekly: true })).status, 400);
    assert.equal((await patch({ alert_weekly: true })).status, 400);
    for (const bad of ["true", 1, null, "yes"]) assert.equal((await patch({ id: MINE, alert_weekly: bad })).status, 400, String(bad));
    assert.equal((await patch({ id: MINE, name: "Renamed", alert_weekly: true })).status, 400, "one change per call");
    assert.equal(written().length, 0);
  });

  it("turns the buyer's own search on and off, writing only the switch (a rename is not touched)", async () => {
    seed();
    const on = await patch({ id: MINE, alert_weekly: true });
    assert.equal(on.status, 200);
    assert.deepEqual(await on.json(), { ok: true, alert_weekly: true });
    const [call] = written();
    assert.deepEqual(call!.update, { alert_weekly: true });
    assert.deepEqual(call!.filters, [{ op: "eq", args: ["id", MINE] }, { op: "eq", args: ["owner_id", BUYER_ID] }]);
    assert.equal(fake.tables.saved_searches![0]!.alert_weekly, true);
    assert.equal(fake.tables.saved_searches![0]!.name, "Knit");
    assert.equal((await patch({ id: MINE, alert_weekly: false })).status, 200);
    assert.equal(fake.tables.saved_searches![0]!.alert_weekly, false);
  });

  it("another buyer's search is a 404 and stays as it was", async () => {
    seed();
    assert.equal((await patch({ id: THEIRS, alert_weekly: true })).status, 404);
    assert.equal(fake.tables.saved_searches![1]!.alert_weekly, undefined);
  });

  it("a database without the column says so (400), any other failure is a 500", async () => {
    seed();
    fake.tableError = { message: 'column "alert_weekly" does not exist', code: "42703" };
    const missing = await patch({ id: MINE, alert_weekly: true });
    assert.equal(missing.status, 400);
    assert.deepEqual(await missing.json(), { error: "email alerts not available" });
    fake.tableError = { message: "Could not find the 'alert_weekly' column of 'saved_searches' in the schema cache", code: "PGRST204" };
    assert.equal((await patch({ id: MINE, alert_weekly: true })).status, 400, "PostgREST's own code for a column it does not know");
    fake.tableError = { message: "down" };
    const down = await patch({ id: MINE, alert_weekly: true });
    assert.equal(down.status, 500);
    assert.deepEqual(await down.json(), { error: "alert not saved" });
  });
});

describe("POST /api/v1/saved-searches with alert_weekly", () => {
  const post = (body: unknown) => POST(new Request("https://sourcebd.net/api/v1/saved-searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));

  it("sends the switch only when it is on, so a plain save never names the column", async () => {
    const plain = await post({ name: "Knit", search: "q=knit" });
    assert.equal(plain.status, 200);
    assert.equal("alert_weekly" in fake.inserted[0]!.values, false);
    const on = await post({ name: "Knit weekly", search: "q=knit", alert_weekly: true });
    assert.equal(on.status, 200);
    assert.equal(fake.inserted[1]!.values.alert_weekly, true);
    assert.equal(fake.inserted[1]!.values.owner_id, BUYER_ID);
    const off = await post({ name: "Knit off", search: "q=knit", alert_weekly: false });
    assert.equal(off.status, 200);
    assert.equal("alert_weekly" in fake.inserted[2]!.values, false);
    const junk = await post({ name: "Knit junk", search: "q=knit", alert_weekly: "true" });
    assert.equal("alert_weekly" in fake.inserted[3]!.values, false, "only a real true turns it on");
    assert.equal(junk.status, 200);
  });

  it("a database without the column refuses the switch with its own reason; a plain save is not affected", async () => {
    fake.insertError = { message: 'column "alert_weekly" of relation "saved_searches" does not exist', code: "42703" };
    const refused = await post({ name: "Knit weekly", search: "q=knit", alert_weekly: true });
    assert.equal(refused.status, 400);
    assert.deepEqual(await refused.json(), { error: "email alerts not available" });
    fake.insertError = { message: "boom" };
    fake.insertError = { message: "Could not find the 'alert_weekly' column", code: "PGRST204" };
    assert.equal((await post({ name: "Knit weekly", search: "q=knit", alert_weekly: true })).status, 400);
    fake.insertError = { message: "boom" };
    assert.equal((await post({ name: "Knit", search: "q=knit" })).status, 500);
  });
});
