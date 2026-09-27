// The product base at the boundary: the HTML a buyer's browser receives for
// the product list (rows, money, the empty state, a failed read that never
// pretends to be empty), the start choice on /app/products/new, the supplier
// picker, and the routes themselves run over a fake Supabase client — the
// list's read, the edit page's 404 and its failed read.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { formatCount, formatDay, formatMoney } from "@/lib/dashboard/facts";
import type { TierRank } from "@/lib/design/tokens";
import {
  PRODUCTS_EMPTY_BODY,
  PRODUCTS_ERROR_COPY,
  ProductList,
  StartChoice,
  parseProductTab,
  type ProductRow,
} from "./products";
import { PICKER_TABS, SupplierPicker, targetFromSuggestion } from "./supplier-picker";

const html = (el: ReactElement) => renderToStaticMarkup(el);
/** The opening tag of the button whose text ends with `label`. */
const buttonTag = (out: string, label: string) => {
  const i = out.indexOf(`${label}</button>`);
  assert.ok(i >= 0, `no ${label} button`);
  const start = out.lastIndexOf("<button", i);
  return out.slice(start, out.indexOf(">", start) + 1);
};

const ID = "11111111-1111-4111-8111-111111111111";
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

describe("the product list", () => {
  it("draws each product with its price in money, its MOQ as a count, its status and its links", () => {
    const out = html(createElement(ProductList, { rows: [row(), row({ id: "p-2", name: "Crew socks", status: "draft", price_usd: "1.2", moq: null })], tab: "all" }));
    assert.ok(out.includes(formatMoney(8.5, "USD")!), "the price is not formatMoney's");
    assert.ok(out.includes(formatMoney(1.2, "USD")!), "a numeric column read as text is still money");
    assert.ok(out.includes(formatCount(1200)!));
    assert.ok(out.includes(formatDay("2026-09-20T10:00:00Z")!));
    assert.match(out, /SS27-DN-014/);
    assert.match(out, />Active</);
    assert.match(out, />Draft</);
    assert.ok(out.includes(`href="/app/products/${ID}"`), "the row does not open the product");
    assert.ok(out.includes(`href="/app/rfqs/new?product=${ID}"`), "no Send RFQ for the product");
    assert.match(out, /2 products · only you can see them/);
    assert.match(out, /href="\/app\/products\/new"/);
    assert.ok(!/score|rating|grade/i.test(out), "a product row carries no score");
  });

  it("the status chips filter the rows and count every status", () => {
    const rows = [row(), row({ id: "p-2", name: "Crew socks", status: "archived" })];
    const out = html(createElement(ProductList, { rows, tab: parseProductTab("archived") }));
    assert.match(out, /Crew socks/);
    assert.doesNotMatch(out, /stretch jeans/);
    assert.match(out.match(/<a[^>]*status=archived[^>]*>/)?.[0] ?? "", /aria-current="page"/, "the Archived chip is not marked current");
    assert.equal(parseProductTab("nonsense"), "all");
    const none = html(createElement(ProductList, { rows: [row()], tab: "draft" }));
    assert.match(none, /No draft products/);
  });

  it("shows the thumbnail when there is an image, the initials when there is not", () => {
    const withImage = html(createElement(ProductList, { rows: [row({ first_image: "https://x.test/a.jpg" })], tab: "all" }));
    assert.match(withImage, /<img src="https:\/\/x\.test\/a\.jpg"/);
    const without = html(createElement(ProductList, { rows: [row()], tab: "all" }));
    assert.match(without, />MS</);
  });

  it("an empty base is the page's own empty state, with the one Add product", () => {
    const out = html(createElement(ProductList, { rows: [], tab: "all" }));
    assert.ok(out.includes(PRODUCTS_EMPTY_BODY));
    assert.match(out, /\/illustrations\/orders\.svg/);
    assert.equal(out.match(/href="\/app\/products\/new"/g)?.length, 1, "two primaries on the empty page");
    assert.doesNotMatch(out, /<table/);
    assert.match(out, /0 products · only you can see them/);
  });

  it("a failed read says so and is never the empty state or a count of 0", () => {
    const out = html(createElement(ProductList, { rows: null, tab: "all" }));
    assert.ok(out.includes(PRODUCTS_ERROR_COPY));
    assert.match(out, /role="alert"/);
    assert.ok(!out.includes(PRODUCTS_EMPTY_BODY));
    assert.doesNotMatch(out, /0 products/);
    assert.match(out, /could not be read/);
  });

  it("says a product was saved, with a link to it", () => {
    const out = html(createElement(ProductList, { rows: [row()], tab: "all", savedId: ID }));
    assert.match(out, /Product saved/);
    assert.ok(out.includes(`href="/app/products/${ID}"`));
  });
});

describe("the start choice", () => {
  it("without AI_ENABLED: manual only, chosen, and the V2 line in place of a card", () => {
    const out = html(createElement(StartChoice, { ai: false }));
    assert.match(out, /Start manually/);
    assert.match(out.match(/<input[^>]*value="manual"[^>]*>/)?.[0] ?? "", /checked=""/, "manual is not the default");
    assert.doesNotMatch(out, /Start with AI/);
    assert.match(out, /Drafting a product from a description arrives with V2\./);
    assert.match(out, /action="\/app\/products\/new"/);
  });

  it("with AI_ENABLED: the AI card too, manual still the default", () => {
    const out = html(createElement(StartChoice, { ai: true }));
    assert.match(out, /Start with AI/);
    assert.match(out, /value="ai"/);
    assert.doesNotMatch(out, /arrives with V2/);
  });
});

describe("the supplier picker", () => {
  const t = (slug: string, tier: TierRank = 2) => ({ ...targetFromSuggestion({ label: slug, sublabel: "Gazipur", slug }), id: `id-${slug}`, tier });

  it("draws three tabs, Saved first, and a Confirm that needs a pick", () => {
    const out = html(createElement(SupplierPicker, { onConfirm() {}, onClose() {} }));
    assert.equal(out.match(/role="tab"/g)?.length, 3);
    for (const tab of PICKER_TABS) assert.ok(out.includes(`>${tab.label}</button>`), `no ${tab.label} tab`);
    assert.match(out, /aria-selected="true"[^>]*>Saved suppliers</);
    assert.match(out, /0 selected/);
    assert.match(buttonTag(out, " Confirm"), /disabled=""/);
  });

  it("counts what is already chosen", () => {
    const out = html(createElement(SupplierPicker, { onConfirm() {}, onClose() {}, selected: [t("aboni-knitwear"), t("zaheen-knitwear")] }));
    assert.match(out, /2 selected/);
    assert.doesNotMatch(buttonTag(out, " Confirm"), /disabled=""/);
  });

  it("a typeahead company becomes a target with no id and no marks — the caller resolves the id", () => {
    const target = targetFromSuggestion({ label: "ABONI KNITWEAR LTD", sublabel: "Savar, Dhaka", slug: "aboni-knitwear" });
    assert.equal(target.id, "");
    assert.equal(target.slug, "aboni-knitwear");
    assert.equal(target.name, "Aboni Knitwear Ltd");
    assert.equal(target.initials, "AK");
    assert.deepEqual(target.marks, []);
    assert.equal(target.sanctioned, false);
  });
});

// ---------------------------------------------------------------------------
// The routes, over a fake `@/lib/supabase/server` installed before they load.
// ---------------------------------------------------------------------------

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
const resolved = (mod: string) => require.resolve(path.join(OUT, mod));
type Rpc = { data: unknown; error: { message: string } | null };
let answer: Rpc = { data: null, error: null };
let calls: { fn: string; args: unknown }[] = [];
{
  const id = resolved("lib/supabase/server.js");
  const client = { rpc: async (fn: string, args?: unknown) => (calls.push({ fn, args }), answer) };
  require.cache[id] = { id, filename: id, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the route module loads.
const route = (p: string) => require(resolved(p)).default as (props: unknown) => Promise<ReactElement>;

/** `notFound()` throws; this names what a route reached. */
async function outcome(run: () => Promise<ReactElement>): Promise<{ html: string } | { threw: string }> {
  try {
    return { html: renderToStaticMarkup(await run()) };
  } catch (err) {
    const digest = (err as { digest?: string })?.digest;
    if (typeof digest === "string") return { threw: digest };
    throw err;
  }
}

describe("/app/products and /app/products/[id], the routes", () => {
  const List = () => route("app/(app)/app/products/(list)/page.js");
  const Edit = () => route("app/(app)/app/products/[id]/page.js");

  it("the list reads buyer_product_list and draws its rows", async () => {
    answer = { data: [row()], error: null };
    calls = [];
    const r = await outcome(() => List()({ searchParams: Promise.resolve({ saved: ID }) }));
    assert.ok("html" in r);
    assert.deepEqual(calls.map((c) => c.fn), ["buyer_product_list"]);
    assert.ok(r.html.includes(formatMoney(8.5, "USD")!));
    assert.match(r.html, /Product saved/);
  });

  it("a failed list read is the error note, never the empty state", async () => {
    answer = { data: null, error: { message: "permission denied" } };
    const r = await outcome(() => List()({ searchParams: Promise.resolve({}) }));
    assert.ok("html" in r && r.html.includes(PRODUCTS_ERROR_COPY));
    assert.ok("html" in r && !r.html.includes(PRODUCTS_EMPTY_BODY));
  });

  it("the edit page prefills the form from buyer_product_get and offers Send RFQ", async () => {
    answer = { data: { id: ID, name: "Crew socks", price_usd: 1.2, status: "draft" }, error: null };
    calls = [];
    const r = await outcome(() => Edit()({ params: Promise.resolve({ id: ID }) }));
    assert.ok("html" in r, "the edit page did not render");
    assert.deepEqual(calls, [{ fn: "buyer_product_get", args: { p_id: ID } }]);
    assert.match(r.html, /id="product-name"[^>]*value="Crew socks"|value="Crew socks"[^>]*id="product-name"/);
    assert.match(r.html, /value="1\.2"/);
    assert.ok(r.html.includes(`href="/app/rfqs/new?product=${ID}"`));
    assert.match(r.html, /Save draft/);
  });

  it("an unknown id, or one that is not an id, is a 404", async () => {
    answer = { data: null, error: null };
    const unknown = await outcome(() => Edit()({ params: Promise.resolve({ id: ID }) }));
    assert.ok("threw" in unknown && /404/.test(unknown.threw), "an unknown product did not 404");
    const junk = await outcome(() => Edit()({ params: Promise.resolve({ id: "not-an-id" }) }));
    assert.ok("threw" in junk && /404/.test(junk.threw));
  });

  it("a failed read of the product says so and is not a 404", async () => {
    answer = { data: null, error: { message: "connection reset" } };
    const r = await outcome(() => Edit()({ params: Promise.resolve({ id: ID }) }));
    assert.ok("html" in r && /could not be read/.test(r.html));
  });

  it("no loading boundary sits above the edit page, so its 404 is a status code", () => {
    for (const dir of ["", "[id]"]) {
      const file = path.join(process.cwd(), "app", "(app)", "app", "products", dir, "loading.tsx");
      assert.ok(!existsSync(file), `products/${dir}/loading.tsx puts the edit page behind a Suspense boundary`);
    }
    assert.ok(existsSync(path.join(process.cwd(), "app", "(app)", "app", "products", "(list)", "loading.tsx")), "the list lost its loading state");
  });
});
