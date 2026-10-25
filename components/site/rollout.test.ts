// Every marketing page in the home page's design (the founder, 25 Oct 2026), as a visitor gets it: each route's page
// renders on home's grounds (`data-mk-tone` sections, no fixed dark band, none of the old frame), and every picture of
// the product it plays is a recording that is on disk in all three files, its own page's and never one of home's.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
async function draw(el: ReactElement): Promise<string> {
  const { prelude } = await prerenderToNodeStream(createElement(AppRouterContext.Provider, { value: router as never }, el));
  let out = "";
  for await (const chunk of prelude) out += String(chunk);
  return out.replace(/<!--[\s\S]*?-->/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}
type Route = (props: { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string>> }) => Promise<ReactElement> | ReactElement;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const route = (p: string) => (require(`@/app/${p}`) as { default: Route }).default;
const visit = async (p: string, params: Record<string, string> = {}, search: Record<string, string> = {}) => draw(await route(p)({ params: Promise.resolve(params), searchParams: Promise.resolve(search) }));
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
const { PAGE_CLIP_FILES } = require("@/components/site/clips") as typeof import("@/components/site/clips");

const ROUTES: [string, string, Record<string, string>?][] = [
  ["/product/search", "(marketing)/product/[slug]/page", { slug: "search" }],
  ["/product/records", "(marketing)/product/[slug]/page", { slug: "records" }],
  ["/product/rfqs", "(marketing)/product/[slug]/page", { slug: "rfqs" }],
  ["/product/compliance", "(marketing)/product/[slug]/page", { slug: "compliance" }],
  ["/solutions/sourcing", "(marketing)/solutions/[slug]/page", { slug: "sourcing" }],
  ["/solutions/compliance", "(marketing)/solutions/[slug]/page", { slug: "compliance" }],
  ["/pricing", "(marketing)/pricing/page"],
  ["/methodology", "(marketing)/methodology/page"],
  ["/security", "(marketing)/security/page"],
  ["/suppliers", "(marketing)/suppliers/page"],
  ["/about", "(marketing)/about/page"],
  ["/contact", "(marketing)/contact/page"],
  ["/compliance", "(marketing)/compliance/page"],
  ["/compliance/uflpa", "(marketing)/compliance/[slug]/page", { slug: "uflpa" }],
  ["/legal/terms", "(marketing)/legal/terms/page"],
];

describe("every marketing page in the home page's design", () => {
  for (const [href, file, params] of ROUTES) {
    it(`${href} renders on home's grounds, with none of the old frame`, async () => {
      const out = await visit(file, params);
      assert.equal((out.match(/<h1[ >]/g) ?? []).length, 1, href);
      assert.match(out, /<section data-mk-tone="(night|day)" aria-labelledby="page-title"/, `${href}: home's head first`);
      assert.doesNotMatch(out, /data-tone="(dark|paper)"|aria-label="Pause demo"|bg-\[rgb\(var\(--mk-ground-paper\)\)\]/, `${href}: no old frame`);
      assert.match(out, /font-display/, `${href}: home's type`);
      for (const poster of out.matchAll(/poster="([^"]+)\.webp"/g)) {
        const base = poster[1]!;
        assert.ok(!base.startsWith("/site/home/"), `${href} plays home's ${base}`);
        for (const ext of ["webp", "mp4", "webm"]) assert.ok(existsSync(join(process.cwd(), "public", `${base}.${ext}`)), `${href}: ${base}.${ext} is not in public/`);
      }
    });
  }

  it("the temporarily-slow page keeps its marker and its Retry, in home's head", async () => {
    const out = await visit("(public)/temporarily-slow/page", {}, { slug: "aboni-knitwear" });
    assert.match(out, /Service temporarily slow/);
    assert.match(out, /<form action="\/temporarily-slow\/retry" method="POST"/);
    assert.match(out, /data-mk-tone="day" aria-labelledby="page-title"/);
  });

  it("every inner page's clip is on disk and none is home's", () => {
    assert.ok(PAGE_CLIP_FILES.length >= 20);
    for (const f of PAGE_CLIP_FILES) {
      assert.match(f, /^\/site\/(search|records|rfqs|compliance)\/clip-[a-z]+$/, f);
      for (const ext of ["webp", "mp4", "webm"]) assert.ok(existsSync(join(process.cwd(), "public", `${f}.${ext}`)), `${f}.${ext}`);
    }
  });
});
