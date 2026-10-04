// The Products list (B7a) at the boundary: the words, the archive and delete calls with an injected
// `fetch`, and the route run over a fake Supabase client — filled, empty, a tab with nothing in it,
// and a failed read that is an error and never "Keep your products here" or a count of 0.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { runDelete, runSetStatus, type Fetch } from "./transport";
import { filterRows, moqWords, rfqHref, parseTab, priceWords, productsCaption, statusChangeWords, styleLine, tabCount, tabHref, updatedWords, type ProductRow } from "./words";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const ID3 = "33333333-3333-4333-8333-333333333333";
const row = (over: Partial<ProductRow> = {}): ProductRow => ({
  id: ID,
  name: "Men's slim-fit stretch jeans",
  product_number: "SS27-DN-014",
  category: "Denim",
  status: "active",
  price_usd: 8.5,
  moq: 1200,
  first_image: null,
  updated_at: "2026-09-20T10:00:00Z",
  ...over,
});
const ROWS = [row(), row({ id: ID2, name: "Crew socks", status: "draft", price_usd: "1.2", moq: null, product_number: null, category: null }), row({ id: ID3, name: "Rib dress", status: "archived" })];

describe("the words", () => {
  it("a price is US dollars per piece and a MOQ a count of pieces; a missing figure is null, not 0", () => {
    assert.equal(priceWords(8.5), "US$8.50 per piece");
    assert.equal(priceWords("1.2"), "US$1.20 per piece");
    assert.equal(priceWords(0.004), "US$0.004 per piece");
    assert.equal(priceWords(null), null);
    assert.equal(priceWords(""), null);
    assert.equal(priceWords(0), null, "a stored 0 is no price");
    assert.equal(moqWords(0), null);
    assert.equal(moqWords(1200), "1,200 pieces");
    assert.equal(moqWords("1"), "1 piece");
    assert.equal(moqWords(null), null);
  });

  it("the line under a name has the style and the category, whichever there is", () => {
    assert.equal(styleLine({ product_number: "NW-701", category: "Knit clothing" }), "Style NW-701 · Knit clothing");
    assert.equal(styleLine({ product_number: null, category: "Denim" }), "Denim");
    assert.equal(styleLine({ product_number: "NW-1", category: null }), "Style NW-1");
    assert.equal(styleLine({ product_number: null, category: null }), null);
  });

  it("the tabs count every status, and none says 0 when the read failed", () => {
    assert.deepEqual(["all", "active", "draft", "archived"].map((t) => tabCount(ROWS, t as never)), [3, 1, 1, 1]);
    assert.equal(tabCount(null, "all"), null);
    assert.equal(filterRows(ROWS, "draft").length, 1);
    assert.equal(parseTab("nonsense"), "all");
    assert.equal(parseTab(["draft", "x"]), "draft");
    assert.equal(rfqHref(ID), `/app/rfqs/new?product=${ID}`);
    assert.equal(tabHref("all"), "/app/products");
    assert.equal(tabHref("draft"), "/app/products?status=draft");
  });

  it("the caption says only you see them, and says when it could not count", () => {
    assert.equal(productsCaption(ROWS), "3 products · only you see these");
    assert.equal(productsCaption([row()]), "1 product · only you see these");
    assert.equal(productsCaption(null), "Your product count could not be read");
    assert.equal(updatedWords("2026-09-20T10:00:00Z"), "20 Sep 2026");
    assert.equal(statusChangeWords("Crew socks", "archived"), "Archived Crew socks.");
    assert.equal(statusChangeWords("Crew socks", "draft"), "Restored Crew socks as a draft.");
  });
});

describe("archive, restore and delete", () => {
  const ok = (calls: { url: string; init?: { method: string; body?: string } }[]): Fetch => async (url, init) => (calls.push({ url, init }), { ok: true, status: 200, json: async () => ({ ok: true }) });

  it("archive posts set_status for that product and nothing else", async () => {
    const calls: { url: string; init?: { method: string; body?: string } }[] = [];
    const r = await runSetStatus(ID, "archived", { fetch: ok(calls) });
    assert.deepEqual(r, { ok: true, message: null });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "/api/v1/products");
    assert.equal(calls[0]!.init?.method, "POST");
    assert.deepEqual(JSON.parse(calls[0]!.init!.body!), { action: "set_status", id: ID, status: "archived" });
  });

  it("delete is a DELETE with the id in the address", async () => {
    const calls: { url: string; init?: { method: string } }[] = [];
    assert.deepEqual(await runDelete(ID, { fetch: ok(calls) }), { ok: true, message: null });
    assert.deepEqual(calls.map((c) => [c.url, c.init?.method]), [[`/api/v1/products?id=${ID}`, "DELETE"]]);
  });

  it("a refusal says the route's own sentence, or that nothing changed; no connection says so", async () => {
    const refused: Fetch = async () => ({ ok: false, status: 404, json: async () => ({ error: "That product does not exist." }) });
    assert.deepEqual(await runSetStatus(ID, "archived", { fetch: refused }), { ok: false, message: "That product does not exist." });
    const opaque: Fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: "buyer_product_delete failed", detail: "x" }) });
    assert.deepEqual(await runDelete(ID, { fetch: opaque }), { ok: false, message: "Could not delete it. Nothing was removed." });
    const down: Fetch = async () => {
      throw new Error("offline");
    };
    const r = await runSetStatus(ID, "draft", { fetch: down });
    assert.ok(!r.ok && /No connection\.$/.test(r.message ?? ""));
  });
});

// ---------------------------------------------------------------------------
// The route, over a fake `@/lib/supabase/server` installed before it loads.
// ---------------------------------------------------------------------------

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
type Rpc = { data: unknown; error: { message: string } | null };
let answer: Rpc = { data: null, error: null };
let calls: string[] = [];
{
  const id = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  const client = { rpc: async (fn: string) => (calls.push(fn), answer) };
  require.cache[id] = { id, filename: id, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the route module loads.
const List = () => require(path.join(OUT, "app/(app)/app/products/(list)/page.js")).default as (props: unknown) => Promise<ReactElement>;

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
async function page(sp: Record<string, string> = {}): Promise<string> {
  const el = await List()({ searchParams: Promise.resolve(sp) });
  return plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
}
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("/app/products", () => {
  it("reads buyer_product_list once and draws each product with its figures, status and link", async () => {
    answer = { data: ROWS, error: null };
    calls = [];
    const out = await page();
    assert.deepEqual(calls, ["buyer_product_list"]);
    const t = text(out);
    assert.match(t, /3 products · only you see these/);
    assert.match(t, /US\$8\.50 per piece/);
    assert.match(t, /US\$1\.20 per piece/);
    assert.match(t, /1,200 pieces/);
    assert.match(t, /No MOQ yet/);
    assert.match(t, /Style SS27-DN-014 · Denim/);
    assert.match(t, /20 Sep 2026/);
    assert.ok(out.includes(`href="/app/products/${ID}"`), "the name does not open the product");
    for (const label of ["Active", "Draft", "Archived"]) assert.ok(t.includes(label), `no ${label} status`);
    assert.ok(out.includes('href="/app/products/new"'), "no Add product");
    assert.ok(!/score|rating|grade/i.test(t), "a product row carries no score");
  });

  it("asks for no figure the list does not have: no HS code or RFQs column", async () => {
    answer = { data: ROWS, error: null };
    const t = text(await page());
    assert.doesNotMatch(t, /HS code/);
    assert.doesNotMatch(t, />\s*RFQs\s*</);
    assert.match(t, /Target price/);
  });

  it("the tabs count every status; ?status= keeps one status and marks its tab current", async () => {
    answer = { data: ROWS, error: null };
    const all = await page();
    const t = text(all);
    assert.match(t, /All\s*·?\s*3/);
    assert.match(t, /Active\s*·?\s*1/);
    const out = await page({ status: "archived" });
    assert.match(text(out), /Rib dress/);
    assert.doesNotMatch(text(out), /Crew socks/);
    assert.match(out.match(/<a[^>]*status=archived[^>]*>/)?.[0] ?? "", /aria-current="page"/, "the Archived tab is not current");
    assert.match(text(await page({ status: "nonsense" })), /Crew socks/, "an unknown status is not All");
  });

  it("a tab with nothing in it says so and is not the empty page", async () => {
    answer = { data: [row()], error: null };
    const t = text(await page({ status: "draft" }));
    assert.match(t, /No draft products/);
    assert.doesNotMatch(t, /Keep your products here/);
  });

  it("an empty base is the teaching state with the one Add product", async () => {
    answer = { data: [], error: null };
    const out = await page();
    const t = text(out);
    assert.match(t, /Keep your products here/);
    assert.match(t, /0 products · only you see these/);
    assert.equal(out.match(/href="\/app\/products\/new"/g)?.length, 1, "two primaries on the empty page");
    assert.doesNotMatch(out, /<table/);
    assert.doesNotMatch(t, /Product status/);
  });

  it("a failed read is an error with a way forward, never the empty state or a count of 0", async () => {
    for (const bad of [{ data: null, error: { message: "permission denied" } }, { data: { not: "a list" }, error: null }]) {
      answer = bad as Rpc;
      const out = await page({ status: "draft" });
      const t = text(out);
      assert.match(out, /role="alert"/);
      assert.match(t, /We couldn't load your products\./);
      assert.match(t, /Nothing you saved is lost/);
      assert.ok(out.includes('href="/app/products?status=draft"'), "Try again goes elsewhere");
      assert.doesNotMatch(t, /Keep your products here/);
      assert.doesNotMatch(t, /\b0 products/);
      assert.match(t, /could not be read/);
    }
  });

  it("says a product was saved, with a link to it; a made-up id is ignored", async () => {
    answer = { data: ROWS, error: null };
    const out = await page({ saved: ID });
    assert.match(text(out), /Product saved\./);
    assert.ok(out.includes(`href="/app/products/${ID}"`));
    assert.doesNotMatch(text(await page({ saved: "not-an-id" })), /Product saved\./);
  });

  it("the loading state sits in the (list) group, so the edit page's 404 stays a status code", () => {
    assert.ok(existsSync(path.join(process.cwd(), "app", "(app)", "app", "products", "(list)", "loading.tsx")));
    assert.ok(!existsSync(path.join(process.cwd(), "app", "(app)", "app", "products", "loading.tsx")));
  });
});
