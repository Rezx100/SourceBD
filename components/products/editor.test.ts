// The product editor (B7a-2) at the boundary: the words (what changed, the buttons at the foot, which
// sections open), the saves with an injected `fetch`, and the two routes over a fake Supabase client:
// New product (nothing read, only the name required) and a saved one (prefilled, a real 404 for an
// unknown id, a failed read that is an error and not a 404, Send RFQ for an active product only).

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { emptyProduct, fromProduct, type ProductValues } from "@/components/product-form-model";
import { OPTIONAL_LINES, SECTIONS, changedLabels, editLine, footButtons, hasContent, openSections, refusal } from "./edit";
import { releaseFile, saveProduct, uploadMedia, type Fetch } from "./transport";

const ID = "11111111-1111-4111-8111-111111111111";
const saved = (over: Record<string, unknown> = {}): ProductValues =>
  fromProduct({ id: ID, name: "Men's slim jeans", product_number: "NW-702", price_usd: 8.9, moq: 1200, category: "Denim", status: "active", tech_pack_url: "https://x.test/files/NW-702%20tech%20pack.pdf", ...over });

describe("what changed", () => {
  it("names the fields that differ, as they would be sent: a trailing space or an empty row is nothing", () => {
    const a = saved();
    assert.deepEqual(changedLabels(a, a), []);
    assert.deepEqual(changedLabels(a, { ...a, name: "Men's slim jeans " }), []);
    assert.deepEqual(changedLabels(a, { ...a, size_chart: [...a.size_chart, { code: "", description: "", tol_minus: "", tol_plus: "", base: "" }] }), []);
    assert.deepEqual(changedLabels(a, { ...a, moq: "1500" }), ["MOQ"]);
    assert.deepEqual(changedLabels(a, { ...a, price_usd: "9", tags: ["SS27"], tech_pack_url: "" }), ["Target price", "Tags", "Tech pack"]);
    assert.deepEqual(changedLabels(a, { ...a, options: [{ name: "Waist", values: ["30"] }] }), ["Options"]);
    assert.deepEqual(changedLabels(a, { ...a, media: [{ url: "https://x.test/a.jpg", kind: "image" }] }), ["Images"]);
    assert.deepEqual(changedLabels(a, { ...a, bom: [{ part: "Zip", material: "", qty: "", color: "", notes: "" }] }), ["Materials"]);
  });
});

describe("the buttons at the foot", () => {
  const labels = (status: "draft" | "active" | "archived", isNew: boolean, dirty: boolean) => footButtons(status, isNew, dirty).map((b) => `${b.label}:${b.saves}`);
  it("a new product saves as a draft or goes live", () => {
    assert.deepEqual(labels("draft", true, false), ["Save draft:draft", "Make active:active"]);
  });
  it("a draft can always be made active; changes add Discard and Save changes", () => {
    assert.deepEqual(labels("draft", false, false), ["Make active:active"]);
    assert.deepEqual(labels("draft", false, true), ["Discard:null", "Save changes:draft", "Make active:active"]);
  });
  it("an active or archived product keeps its status when saved, and has no bar until something changes", () => {
    assert.deepEqual(labels("active", false, false), []);
    assert.deepEqual(labels("active", false, true), ["Discard:null", "Save changes:active"]);
    assert.deepEqual(labels("archived", false, true), ["Discard:null", "Save changes:archived"]);
    assert.ok(!labels("active", false, true).some((l) => l.endsWith(":draft")), "saving an active product must not demote it to a draft");
  });
});

describe("the sections", () => {
  it("are Paper's, without HS code: a product holds none", () => {
    assert.deepEqual(SECTIONS.map((s) => s.label), ["Basics", "Options", "Size chart", "Materials", "Images", "Tech pack"]);
    assert.ok(!SECTIONS.some((s) => /HS/.test(s.label)));
  });
  it("a new product opens only what it holds; a saved one opens everything", () => {
    assert.deepEqual(Object.values(openSections(emptyProduct())), [false, false, false, false, false]);
    assert.equal(hasContent(emptyProduct(), "size-chart"), false, "the blank row the form starts with is not content");
    assert.deepEqual(openSections({ ...emptyProduct(), tech_pack_url: "https://x.test/a.pdf" })["tech-pack"], true);
    assert.deepEqual(Object.values(openSections(saved())), [true, true, true, true, true]);
    assert.equal(OPTIONAL_LINES.options, "Options, such as colour and size");
  });
  it("the line under a saved name has the style, when it was updated and who sees it", () => {
    assert.equal(editLine({ product_number: "NW-702", category: "Denim" }, "2026-09-26T10:00:00Z"), "Style NW-702 · updated 26 Sep 2026 · only you see this product");
    assert.equal(editLine({ product_number: "", category: "" }, null), "only you see this product");
  });
});

describe("what a refusal says", () => {
  it("never a status code; the route's own sentence when it gave one", () => {
    assert.match(refusal(0, null, "save"), /no connection/);
    assert.match(refusal(403, null, "upload"), /upload files/);
    assert.match(refusal(404, null, "save"), /no longer exists/);
    assert.match(refusal(413, null, "upload"), /10 MB/);
    assert.match(refusal(429, null, "save"), /Too many requests/);
    assert.equal(refusal(400, "Give the product a name.", "save"), "Give the product a name.");
    assert.match(refusal(500, null, "save"), /Nothing was lost/);
    assert.ok(!/\b(400|500)\b/.test(refusal(500, null, "save")));
  });
});

describe("the saves", () => {
  type Call = { url: string; init?: { method: string; headers?: Record<string, string>; body?: string | FormData; keepalive?: boolean } };
  const answering = (ok: boolean, status: number, json: unknown, calls: Call[] = []): Fetch => async (url, init) => (calls.push({ url, init }), { ok, status, json: async () => json });

  it("a save posts upsert and gets the id back", async () => {
    const calls: Call[] = [];
    const r = await saveProduct({ name: "A" }, { fetch: answering(true, 200, { id: ID }, calls) });
    assert.deepEqual([r.ok, r.id], [true, ID]);
    assert.deepEqual(JSON.parse(calls[0]!.init!.body as string), { action: "upsert", product: { name: "A" } });
  });

  it("a save that answers without an id is a failure, not a success", async () => {
    const r = await saveProduct({}, { fetch: answering(true, 200, {}) });
    assert.equal(r.ok, false);
    assert.match(r.message ?? "", /Could not save/);
  });

  it("a refused save says the route's sentence; a dead network says so", async () => {
    const said = await saveProduct({}, { fetch: answering(false, 400, { error: "Give the product a name." }) });
    assert.equal(said.message, "Give the product a name.");
    const down = await saveProduct({}, {
      fetch: async () => {
        throw new Error("offline");
      },
    });
    assert.match(down.message ?? "", /no connection/);
  });

  it("an upload sends the file and its kind, and gets the url back", async () => {
    const calls: Call[] = [];
    const r = await uploadMedia(new Blob(["x"], { type: "image/png" }), "image", { fetch: answering(true, 200, { url: "https://x.test/a.png" }, calls) });
    assert.equal(r.url, "https://x.test/a.png");
    const body = calls[0]!.init!.body as FormData;
    assert.equal(body.get("kind"), "image");
    assert.ok(body.get("file"));
    const big = await uploadMedia(new Blob(["x"]), "tech_pack", { fetch: answering(false, 413, null) });
    assert.match(big.message ?? "", /10 MB/);
  });

  it("a released file leaves storage with keepalive, so a navigation does not cancel it", async () => {
    const calls: Call[] = [];
    await releaseFile("https://x.test/a.png", { fetch: answering(true, 200, {}, calls) });
    assert.equal(calls[0]!.init?.method, "DELETE");
    assert.equal(calls[0]!.init?.keepalive, true);
    assert.deepEqual(JSON.parse(calls[0]!.init!.body as string), { url: "https://x.test/a.png" });
  });
});

// ---------------------------------------------------------------------------
// The routes, over a fake `@/lib/supabase/server` installed before they load.
// ---------------------------------------------------------------------------

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
type Rpc = { data: unknown; error: { message: string } | null };
let answer: Rpc = { data: null, error: null };
let calls: { fn: string; args: unknown }[] = [];
{
  const id = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  const client = { rpc: async (fn: string, args?: unknown) => (calls.push({ fn, args }), answer) };
  require.cache[id] = { id, filename: id, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the route module loads.
const route = (p: string) => require(path.join(OUT, p)).default as (props?: unknown) => ReactElement | Promise<ReactElement>;
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

/** `notFound()` throws; this names what a route reached. */
async function outcome(run: () => ReactElement | Promise<ReactElement>): Promise<{ html: string } | { threw: string }> {
  try {
    const el = await run();
    return { html: plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el))) };
  } catch (err) {
    const digest = (err as { digest?: string })?.digest;
    if (typeof digest === "string") return { threw: digest };
    throw err;
  }
}
const New = () => route("app/(app)/app/products/new/page.js");
const Edit = () => route("app/(app)/app/products/[id]/page.js");
const edit = (id = ID) => outcome(() => Edit()({ params: Promise.resolve({ id }) }));

describe("/app/products/new", () => {
  it("reads nothing, and draws the editor empty: only the name is required, the rest is Add", async () => {
    calls = [];
    const r = await outcome(() => New()());
    assert.ok("html" in r);
    assert.deepEqual(calls, [], "nothing is read for a new product");
    const t = text(r.html);
    assert.equal(r.html.match(/<h1\b/g)?.length, 1);
    assert.match(r.html, /<h1[^>]*>New product<\/h1>/);
    assert.match(t, /Only the name is required\./);
    assert.match(r.html, /<input[^>]*name="name"/);
    assert.match(t, /Add a name to save/);
    assert.match(r.html, /<button[^>]*>Save draft<\/button>/);
    assert.match(r.html, /<button[^>]*>Make active<\/button>/);
    assert.equal(r.html.match(/aria-label="Add (options|size chart|materials|images|tech pack)"/g)?.length, 5, "the five other sections are Add");
    assert.ok(!r.html.includes("/app/rfqs/new"), "a product that does not exist cannot be sent");
    assert.doesNotMatch(t, /HS code|Start manually|How do you want to start/);
    assert.match(r.html, /href="\/app\/products"[^>]*>[\s\S]*?Products/);
  });

  it("ignores ?start= (the old start choice is gone)", async () => {
    const r = await outcome(() => New()({ searchParams: Promise.resolve({ start: "manual" }) }));
    assert.ok("html" in r && /<h1[^>]*>New product<\/h1>/.test(r.html));
  });
});

describe("/app/products/[id]", () => {
  it("prefills the editor from buyer_product_get and opens every section", async () => {
    answer = { data: { id: ID, name: "Crew socks", price_usd: 1.2, status: "draft", updated_at: "2026-09-26T10:00:00Z" }, error: null };
    calls = [];
    const r = await edit();
    assert.ok("html" in r, "the edit page did not render");
    assert.deepEqual(calls, [{ fn: "buyer_product_get", args: { p_id: ID } }]);
    assert.match(r.html, /<input[^>]*name="name"[^>]*value="Crew socks"|<input[^>]*value="Crew socks"[^>]*name="name"/);
    assert.match(r.html, /value="1\.2"/);
    assert.match(r.html, /<h1[^>]*>Crew socks<\/h1>/);
    assert.match(text(r.html), /updated 26 Sep 2026 · only you see this product/);
    assert.equal(r.html.match(/aria-label="Add (options|size chart|materials|images|tech pack)"/g), null, "a saved product opens every section");
    assert.ok(!r.html.includes("/app/rfqs/new"), "a draft offers no Send RFQ");
  });

  it("a draft can be made active at once; an active product has Send RFQ and no bar; an archived one neither", async () => {
    answer = { data: { id: ID, name: "Crew socks", status: "draft" }, error: null };
    const draft = await edit();
    assert.ok("html" in draft && /<button[^>]*>Make active<\/button>/.test(draft.html));
    assert.ok("html" in draft && !/>Save draft</.test(draft.html), "a saved product has no 'Save draft'");
    answer = { data: { id: ID, name: "Crew socks", status: "active" }, error: null };
    const live = await edit();
    assert.ok("html" in live && live.html.includes(`href="/app/rfqs/new?product=${ID}"`));
    assert.ok("html" in live && !/>Make active<|>Save changes</.test(live.html), "nothing to save yet");
    answer = { data: { id: ID, name: "Crew socks", status: "archived" }, error: null };
    const shelved = await edit();
    assert.ok("html" in shelved && !shelved.html.includes("/app/rfqs/new") && !/>Make active</.test(shelved.html));
  });

  it("an unknown id, or one that is not an id, is a 404", async () => {
    answer = { data: null, error: null };
    const unknown = await edit();
    assert.ok("threw" in unknown && /404/.test(unknown.threw), "an unknown product did not 404");
    answer = { data: null, error: { message: "Product not found" } };
    const named = await edit();
    assert.ok("threw" in named && /404/.test(named.threw));
    const junk = await edit("not-an-id");
    assert.ok("threw" in junk && /404/.test(junk.threw));
  });

  it("a failed read of the product says so, with a way forward, and is not a 404", async () => {
    answer = { data: null, error: { message: "connection reset" } };
    const r = await edit();
    assert.ok("html" in r);
    assert.match(r.html, /role="alert"/);
    assert.match(text(r.html), /We couldn't load this product\./);
    assert.ok(r.html.includes(`href="/app/products/${ID}"`), "Try again goes to the product");
    assert.doesNotMatch(r.html, /<form/);
  });

  it("no loading boundary sits above the edit page, so its 404 is a status code", () => {
    for (const dir of ["", "[id]"]) assert.ok(!existsSync(path.join(process.cwd(), "app", "(app)", "app", "products", dir, "loading.tsx")), `products/${dir}/loading.tsx puts the edit page behind a Suspense boundary`);
    assert.ok(existsSync(path.join(process.cwd(), "app", "(app)", "app", "products", "(list)", "loading.tsx")), "the list lost its loading state");
  });
});
