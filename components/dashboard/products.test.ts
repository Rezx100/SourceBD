// The product base at the boundary: the start choice on /app/products/new, the supplier picker, and
// the edit route run over a fake Supabase client — its 404 and its failed read. The list is tested
// in `components/products/products.test.ts`.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import type { TierRank } from "@/lib/design/tokens";
import { StartChoice } from "./products";
import { AffiliationNote } from "./sheet";
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

describe("the start choice", () => {
  it("without AI_ENABLED: manual only, chosen, and the V2 line in place of a card", () => {
    const out = html(createElement(StartChoice, { ai: false }));
    assert.match(out, /Start manually/);
    assert.match(out.match(/<input[^>]*value="manual"[^>]*>/)?.[0] ?? "", /checked=""/, "manual is not the default");
    assert.doesNotMatch(out, /Start with AI/);
    assert.match(out, /Drafting a product from a description is not available yet\./);
    assert.match(out, /action="\/app\/products\/new"/);
  });

  it("with AI_ENABLED: the AI card too, manual still the default", () => {
    const out = html(createElement(StartChoice, { ai: true }));
    assert.match(out, /Start with AI/);
    assert.match(out, /value="ai"/);
    assert.doesNotMatch(out, /is not available yet/);
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

describe("/app/products/[id], the route", () => {
  const Edit = () => route("app/(app)/app/products/[id]/page.js");

  it("the edit page prefills the form from buyer_product_get and offers no Send RFQ on a draft (PR-02)", async () => {
    answer = { data: { id: ID, name: "Crew socks", price_usd: 1.2, status: "draft" }, error: null };
    calls = [];
    const r = await outcome(() => Edit()({ params: Promise.resolve({ id: ID }) }));
    assert.ok("html" in r, "the edit page did not render");
    assert.deepEqual(calls, [{ fn: "buyer_product_get", args: { p_id: ID } }]);
    assert.match(r.html, /id="product-name"[^>]*value="Crew socks"|value="Crew socks"[^>]*id="product-name"/);
    assert.match(r.html, /value="1\.2"/);
    assert.ok(!r.html.includes("/app/rfqs/new"), "a draft product offers Send RFQ");
    assert.match(r.html, /Save draft/);
  });

  it("an active product offers Send RFQ, an archived one does not (PR-02)", async () => {
    answer = { data: { id: ID, name: "Crew socks", price_usd: 1.2, status: "active" }, error: null };
    const live = await outcome(() => Edit()({ params: Promise.resolve({ id: ID }) }));
    assert.ok("html" in live && live.html.includes(`href="/app/rfqs/new?product=${ID}"`));
    answer = { data: { id: ID, name: "Crew socks", price_usd: 1.2, status: "archived" }, error: null };
    const shelved = await outcome(() => Edit()({ params: Promise.resolve({ id: ID }) }));
    assert.ok("html" in shelved && !shelved.html.includes("/app/rfqs/new"));
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

describe("buyer copy that must not over-claim (T-04, T-09)", () => {
  it("the affiliation note does not promise every fact is traced while some say 'Source pending'", () => {
    assert.doesNotMatch(html(createElement(AffiliationNote)), /traces to/);
  });
});
