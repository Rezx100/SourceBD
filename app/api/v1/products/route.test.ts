// /api/v1/products — the buyer's product base (0106), at the route.
//
// Status codes, what reaches the RPC, and one invariant: no contact field
// name ever leaves in a response, even when the RPC answer carries one.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";

import { called, CONTACT_KEY_RE, fake, resetFake } from "../route-test-fake";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fake client must be installed before the route loads.
const { DELETE, GET, POST } = require("./route") as typeof import("./route");

const ID = "2c2c2c2c-2c2c-4c2c-8c2c-2c2c2c2c2c2c";
const URL_BASE = "https://sourcebd.net/api/v1/products";

const get = (query = "") => GET(new Request(`${URL_BASE}${query}`));
const del = (query = "") => DELETE(new Request(`${URL_BASE}${query}`, { method: "DELETE" }));
const post = (body: unknown) =>
  POST(
    new Request(URL_BASE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
const upsert = (product: Record<string, unknown>) => post({ action: "upsert", product });

async function refused(product: Record<string, unknown>, pattern: RegExp): Promise<void> {
  const res = await upsert(product);
  assert.equal(res.status, 400, JSON.stringify(product).slice(0, 200));
  const json = (await res.json()) as { error: string };
  assert.match(json.error, pattern);
  assert.match(json.error, /\.$/, `not a sentence: ${json.error}`);
  assert.equal(fake.rpcCalls.length, 0, "a refused product still reached the database");
}

/** An RPC answer that should never happen, carrying every contact key at several depths. */
const LEAKY = {
  id: ID,
  name: "Crew neck tee",
  email_primary: "sales@factory.example",
  phones: ["+880 1700 000000"],
  size_chart: [{ code: "M", contact_name: "Mr. Leak" }],
  variants: { options: [], rows: [{ size: "M", contact_role: "Director" }] },
};

beforeEach(resetFake);

describe("/api/v1/products without a session", () => {
  it("answers 401 to GET, POST and DELETE, and calls nothing", async () => {
    fake.userId = null;
    assert.equal((await get()).status, 401);
    assert.equal((await get(`?id=${ID}`)).status, 401);
    assert.equal((await upsert({ name: "Tee" })).status, 401);
    assert.equal((await post({ action: "set_status", id: ID, status: "active" })).status, 401);
    assert.equal((await del(`?id=${ID}`)).status, 401);
    assert.equal(fake.rpcCalls.length, 0);
  });
});

describe("GET /api/v1/products", () => {
  it("lists the caller's products", async () => {
    const products = [{ id: ID, name: "Tee", media_count: 2, first_image: "https://x.example/a.png" }];
    fake.answers.buyer_product_list = { data: products, error: null };
    const res = await get();
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { products });
  });

  it("never lets a contact field name out, in the list or one product", async () => {
    fake.answers.buyer_product_list = { data: [LEAKY], error: null };
    fake.answers.buyer_product_get = { data: LEAKY, error: null };
    for (const res of [await get(), await get(`?id=${ID}`)]) {
      assert.equal(res.status, 200);
      const text = await res.text();
      assert.doesNotMatch(text, CONTACT_KEY_RE);
      assert.match(text, /Crew neck tee/);
    }
  });

  it("tells a failed list apart from an empty one", async () => {
    fake.answers.buyer_product_list = { data: null, error: { message: "canceling statement due to statement timeout" } };
    const res = await get();
    assert.notEqual(res.status, 200);
    assert.equal(((await res.json()) as { products?: unknown }).products, undefined);
  });

  it("returns one product, 404 when it is not the caller's, 400 on a bad id", async () => {
    fake.answers.buyer_product_get = { data: { id: ID, name: "Tee" }, error: null };
    const ok = await get(`?id=${ID}`);
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { product: { id: ID, name: "Tee" } });
    assert.deepEqual(called("buyer_product_get")[0]?.args, { p_id: ID });

    fake.answers.buyer_product_get = { data: null, error: null };
    assert.equal((await get(`?id=${ID}`)).status, 404);

    fake.rpcCalls = [];
    assert.equal((await get("?id=not-a-uuid")).status, 400);
    assert.equal(fake.rpcCalls.length, 0);
  });
});

describe("POST upsert", () => {
  it("inserts a product and sends only the fields a product has", async () => {
    fake.answers.buyer_product_upsert = { data: ID, error: null };
    const product = {
      name: "Crew neck tee",
      product_number: "TEE-01",
      price_usd: "4.20",
      moq: 500,
      tags: ["cotton", "basics"],
      media: [{ url: "https://cdn.example/a.png", kind: "image" }],
      variants: { options: [{ name: "Size", values: ["S", "M"] }], rows: [{ Size: "S", sku: "TEE-S" }] },
      size_chart: [{ code: "A", description: "Chest", tol_minus: 1, tol_plus: 1, base: 52 }],
      bom: [{ part: "Body", material: "Jersey", qty: 1, color: "White", notes: null }],
      tech_pack_url: "https://cdn.example/tp.pdf",
      status: "active",
      owner_id: "someone-else",
      email_primary: "x@y.example",
    };
    const res = await upsert(product);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { id: ID });
    const sent = called("buyer_product_upsert")[0]?.args?.p_input as Record<string, unknown>;
    assert.equal(sent.name, "Crew neck tee");
    assert.equal(sent.owner_id, undefined, "owner_id reached the RPC");
    assert.equal(sent.email_primary, undefined, "an unknown key reached the RPC");
    assert.deepEqual(sent.variants, product.variants);
  });

  it("updates by id without resending the name", async () => {
    fake.answers.buyer_product_upsert = { data: ID, error: null };
    const res = await upsert({ id: ID, price_usd: 5 });
    assert.equal(res.status, 200);
    assert.deepEqual(called("buyer_product_upsert")[0]?.args, { p_input: { id: ID, price_usd: 5 } });
  });

  it("answers 404 when the id is not one of the caller's products", async () => {
    fake.answers.buyer_product_upsert = { data: null, error: { message: "product not found" } };
    assert.equal((await upsert({ id: ID, name: "Tee" })).status, 404);
  });

  it("answers 400, not 200, when the RPC refuses", async () => {
    fake.answers.buyer_product_upsert = { data: null, error: { message: "name is required" } };
    assert.equal((await upsert({ name: "Tee" })).status, 400);
  });

  it("refuses each bad shape with a sentence", async () => {
    const res = await post({ action: "upsert" });
    assert.equal(res.status, 400);
    assert.equal(fake.rpcCalls.length, 0);

    const row = (n: number) => Array.from({ length: n }, (_, i) => ({ code: String(i) }));
    await refused({}, /name/);
    await refused({ name: "   " }, /name/);
    await refused({ name: "n".repeat(201) }, /200 characters/);
    await refused({ id: "nope", name: "Tee" }, /product id/);
    await refused({ name: "Tee", product_number: "p".repeat(65) }, /64 characters/);
    await refused({ name: "Tee", customer_product_number: 12 }, /must be text/);
    await refused({ name: "Tee", description: "d".repeat(8001) }, /8000 characters/);
    await refused({ name: "Tee", main_material: "m".repeat(201) }, /200 characters/);
    await refused({ name: "Tee", category: "c".repeat(81) }, /80 characters/);
    await refused({ name: "Tee", price_usd: -1 }, /price/i);
    await refused({ name: "Tee", moq: "lots" }, /MOQ/);
    await refused({ name: "Tee", tags: "cotton" }, /tags/i);
    await refused({ name: "Tee", tags: ["t".repeat(41)] }, /40 characters/);
    await refused({ name: "Tee", tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }, /20 tags/);
    await refused({ name: "Tee", media: Array.from({ length: 21 }, () => ({ url: "https://a.example/x.png", kind: "image" })) }, /20 files/);
    await refused({ name: "Tee", media: [{ url: "ftp://a.example/x.png", kind: "image" }] }, /web address/);
    await refused({ name: "Tee", media: [{ url: "https://a.example/x.png", kind: "audio" }] }, /image, a video/);
    await refused({ name: "Tee", variants: [] }, /options and rows/);
    await refused({ name: "Tee", variants: { options: row(11) } }, /10 variant options/);
    await refused({ name: "Tee", variants: { options: [{ values: ["S"] }] } }, /needs a name/);
    await refused({ name: "Tee", variants: { options: [{ name: "Size", values: Array.from({ length: 101 }, (_, i) => `${i}`) }] } }, /100 values/);
    await refused({ name: "Tee", variants: { options: [], rows: row(501) } }, /500 rows/);
    await refused({ name: "Tee", size_chart: row(61) }, /60 rows/);
    await refused({ name: "Tee", size_chart: ["M"] }, /named values/);
    await refused({ name: "Tee", bom: row(101) }, /100 rows/);
    await refused({ name: "Tee", bom: [{ part: { nested: true } }] }, /text or a number/);
    await refused({ name: "Tee", tech_pack_url: "file:///c:/tp.pdf" }, /tech pack/);
    await refused({ name: "Tee", status: "published" }, /draft, active or archived/);
    // Every part within its own limit, the whole over 256 KB (100 rows × 6 × 499 characters).
    const long = "n".repeat(499);
    const heavy = row(100).map((r) => ({ ...r, a: long, b: long, c: long, d: long, e: long, f: long }));
    await refused({ name: "Tee", bom: heavy }, /256 KB/);
  });
});

describe("POST set_status", () => {
  it("sets the status of the caller's product", async () => {
    const res = await post({ action: "set_status", id: ID, status: "archived" });
    assert.equal(res.status, 200);
    assert.deepEqual(called("buyer_product_set_status")[0]?.args, { p_id: ID, p_status: "archived" });
  });

  it("refuses a bad id or status, and answers 404 for another buyer's product", async () => {
    assert.equal((await post({ action: "set_status", id: "x", status: "active" })).status, 400);
    assert.equal((await post({ action: "set_status", id: ID, status: "live" })).status, 400);
    assert.equal(fake.rpcCalls.length, 0);
    fake.answers.buyer_product_set_status = { data: null, error: { message: "product not found" } };
    assert.equal((await post({ action: "set_status", id: ID, status: "active" })).status, 404);
  });

  it("refuses an unknown action", async () => {
    assert.equal((await post({ action: "publish", id: ID })).status, 400);
    assert.equal(fake.rpcCalls.length, 0);
  });
});

describe("DELETE /api/v1/products", () => {
  it("deletes the caller's product", async () => {
    const res = await del(`?id=${ID}`);
    assert.equal(res.status, 200);
    assert.deepEqual(called("buyer_product_delete")[0]?.args, { p_id: ID });
  });

  it("refuses a missing or bad id, and answers 404 for another buyer's product", async () => {
    assert.equal((await del()).status, 400);
    assert.equal((await del("?id=1")).status, 400);
    assert.equal(fake.rpcCalls.length, 0);
    fake.answers.buyer_product_delete = { data: null, error: { message: "product not found" } };
    assert.equal((await del(`?id=${ID}`)).status, 404);
  });
});

describe("0106: the product and draft tables are written only through their functions", () => {
  // A direct PostgREST insert skips every check buyer_product_upsert and
  // rfq_draft_save make (URL schemes, the variant shape, ownership of the
  // product a draft names). Code only: a grant kept in a comment must not pass.
  it("authenticated is granted no INSERT, UPDATE or DELETE on buyer_products or rfq_drafts", () => {
    const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/0106_buyer_products_rfq_message_workspace.sql"), "utf8")
      .replace(/--[^\n]*/g, "")
      .toLowerCase();
    const grants = [...sql.matchAll(/grant\s+([^;]*?)\s+on\s+(?:table\s+)?public\.(buyer_products|rfq_drafts)\s+to\s+([^;]+);/g)];
    assert.ok(grants.length >= 2, "guard: the two table grants moved");
    for (const [stmt, verbs, , who] of grants) {
      if (!/authenticated/.test(who!)) continue;
      assert.doesNotMatch(verbs!, /insert|update|delete|all/, `a direct write is granted: ${stmt}`);
    }
  });
});
