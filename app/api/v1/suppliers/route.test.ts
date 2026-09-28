// /api/v1/suppliers and GET /api/v1/saved — the composer's lookups, at the route.
//
// What an outside caller observes: the status, which rows come back, that a
// sanctioned supplier comes back flagged, that an unpublished one does not come
// back at all, and that no contact column ever leaves.

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { CONTACT_KEY_RE, called, fake, resetFake } from "../route-test-fake";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fake client must be installed before the routes load.
const suppliers = require("./route") as typeof import("./route");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const saved = require("../saved/route") as typeof import("../saved/route");

const A = "1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a";
const B = "2b2b2b2b-2b2b-4b2b-8b2b-2b2b2b2b2b2b";
const C = "3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c";

const row = (id: string, slug: string, over: Record<string, unknown> = {}) => ({
  id,
  slug,
  company_name: slug.toUpperCase(),
  entity_type: "factory",
  city: "Savar",
  district: "Dhaka",
  source_tags: ["BGMEA", "EPB"],
  is_published: true,
  is_sanctioned: false,
  // Columns the route must never pass on, even if a read returned them.
  email_primary: "sales@factory.example",
  phones: ["+880 1700 000000"],
  ...over,
});

const get = (q: string) => suppliers.GET(new Request(`https://sourcebd.net/api/v1/suppliers${q}`));

beforeEach(() => {
  resetFake();
  fake.tables.suppliers = [
    row(A, "aboni-knitwear"),
    row(B, "zaheen-knitwear", { is_sanctioned: true }),
    row(C, "gone-ltd", { is_published: false }),
  ];
});

describe("GET /api/v1/suppliers", () => {
  it("refuses a caller who is not a buyer, and reads nothing", async () => {
    fake.userId = null;
    assert.equal((await get(`?ids=${A}`)).status, 401);
    fake.userId = "x";
    fake.role = "supplier";
    assert.equal((await get(`?ids=${A}`)).status, 401);
    assert.equal(fake.fromCalls.length, 0);
  });

  it("resolves ids and slugs together, once each, published only, sanction flagged", async () => {
    const res = await get(`?ids=${A},${C}&slugs=zaheen-knitwear,aboni-knitwear`);
    assert.equal(res.status, 200);
    const { rows } = (await res.json()) as { rows: { id: string; slug: string; is_sanctioned: boolean }[] };
    assert.deepEqual(rows.map((r) => r.id).sort(), [A, B].sort(), "the unpublished supplier came back, or one came back twice");
    assert.equal(rows.find((r) => r.id === B)?.is_sanctioned, true);
    assert.equal(rows.find((r) => r.id === A)?.is_sanctioned, false);
    for (const c of fake.fromCalls) {
      assert.equal(c.table, "suppliers");
      assert.doesNotMatch(c.columns, CONTACT_KEY_RE, "the route selected a contact column");
      assert.ok(c.filters.some((f) => f.op === "eq" && f.args[0] === "is_published" && f.args[1] === true), "read without the published filter");
    }
  });

  it("never passes a contact column on, even when a read returns one", async () => {
    const body = await (await get(`?ids=${A},${B}`)).text();
    assert.doesNotMatch(body, CONTACT_KEY_RE);
    assert.doesNotMatch(body, /sales@factory|\+880/);
  });

  it("refuses a malformed id or slug, and more than 50", async () => {
    assert.equal((await get("?ids=not-a-uuid")).status, 400);
    assert.equal((await get("?slugs=Bad Slug")).status, 400);
    const many = Array.from({ length: 51 }, (_, i) => `s-${i}`).join(",");
    assert.equal((await get(`?slugs=${many}`)).status, 400);
    const res = await get("?ids=x");
    assert.match(((await res.json()) as { error: string }).error, /\.$/);
    assert.equal(fake.fromCalls.length, 0);
  });

  it("an empty ask is an empty answer, and a failed read says so", async () => {
    assert.deepEqual(await (await get("")).json(), { rows: [] });
    fake.tableError = { message: "timeout" };
    const res = await get(`?ids=${A}`);
    assert.equal(res.status, 502);
    assert.doesNotMatch(await res.text(), /timeout/, "the database's own words reached the buyer");
  });
});

describe("GET /api/v1/saved", () => {
  it("refuses a caller who is not a buyer", async () => {
    fake.userId = null;
    assert.equal((await saved.GET()).status, 401);
    assert.equal(called("buyer_saved_list").length, 0);
  });

  it("lists the caller's saved suppliers from buyer_saved_list, named fields only", async () => {
    fake.answers.buyer_saved_list = { data: [row(A, "aboni-knitwear", { saved_at: "2026-09-26T10:00:00Z", total_count: 1 })], error: null };
    const res = await saved.GET();
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.doesNotMatch(body, CONTACT_KEY_RE);
    const { rows } = JSON.parse(body) as { rows: Record<string, unknown>[] };
    assert.deepEqual(Object.keys(rows[0]!).sort(), ["city", "company_name", "district", "entity_type", "id", "slug", "source_tags"]);
    assert.deepEqual(called("buyer_saved_list")[0]?.args, { p_sort: "recent", p_limit: 100, p_offset: 0 });
  });

  it("a failed read is a 502, never an empty list", async () => {
    fake.answers.buyer_saved_list = { data: null, error: { message: "boom" } };
    const res = await saved.GET();
    assert.equal(res.status, 502);
  });
});
