// The product and solutions pages (B9c): Paper's headlines and copy, one real screen per claim with alt text, the
// live figure only when it was read, the sample-state and in-design marks, and every page the menus link to exists.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { NO_FACTS, parseFacts } from "@/lib/site-facts";
import { PRODUCT, SOLUTIONS } from "@/components/site/map";

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const { PAGES, SitePage, siteMetadata } = require("@/components/site/pages") as typeof import("@/components/site/pages");

const FACTS = parseFacts({ suppliers_indexed: 10268, last_refreshed_at: "2026-10-02T05:48:07Z" }, null);
const page = (key: string, facts = FACTS) => draw(createElement(SitePage, { pageKey: key, facts }));

describe("the product and solutions pages", () => {
  it("every page the menus link to is built, and nothing else is", () => {
    const hrefs = [...PRODUCT, ...SOLUTIONS].map((i) => i.href.slice(1)).sort();
    assert.deepEqual(Object.keys(PAGES).sort(), hrefs);
  });

  it("each opens with Paper's headline, the search that runs on public Discover and the two calls to action", () => {
    const heads: Record<string, string> = {
      "product/search": "Search 10,268 garment suppliers.",
      "product/records": "Every fact, with its receipt.",
      "product/rfqs": "One RFQ, up to 50 suppliers.",
      "product/compliance": "Know before a certificate expires.",
      "solutions/sourcing": "From search to RFQ in one sitting.",
      "solutions/compliance": "Show where every fact came from.",
    };
    for (const [key, h] of Object.entries(heads)) {
      const out = page(key);
      assert.equal((out.match(/<h1[ >]/g) ?? []).length, 1, key);
      assert.ok(text(out).includes(h), key);
      assert.match(out, /<form[^>]*action="\/discover"/, key);
      assert.match(out, /href="\/signup"[^>]*>Start free/, key);
      assert.match(out, /href="\/contact"[^>]*>Book a demo/, key);
      assert.match(text(out), /Free during beta\. No card needed\./, key);
    }
  });

  it("every screen exists on disk and has alt text and a caption that says what kind of screen it is", () => {
    for (const [key, p] of Object.entries(PAGES)) {
      const out = page(key);
      const imgs = [...out.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
      assert.ok(imgs.length >= 1, key);
      for (const i of imgs) {
        assert.match(i, /alt="[^"]{20,}"/, `${key} alt`);
        const src = /src="([^"]+)"/.exec(i)![1]!;
        const file = decodeURIComponent(/url=([^&]+)/.exec(src)?.[1] ?? src);
        assert.ok(existsSync(join(process.cwd(), "public", file)), `${key}: ${file}`);
      }
      for (const b of [...p.blocks.filter((x) => x.shot).map((x) => x.shot!), p.hero]) assert.match(b.caption, /^(Real screen|Sample state) · /, key);
    }
  });

  it("no loading.tsx sits above the pages whose unknown slug must answer a real 404", () => {
    for (const dir of ["app/(marketing)", "app/(marketing)/product", "app/(marketing)/solutions", "app/(marketing)/product/[slug]", "app/(marketing)/solutions/[slug]"]) {
      assert.ok(!existsSync(join(process.cwd(), dir, "loading.tsx")), `${dir}/loading.tsx would stream the 404 behind a 200`);
    }
  });

  it("quote screens say their figures are examples", () => {
    for (const key of ["product/rfqs", "solutions/sourcing"]) assert.match(text(page(key)), /Sample state · figures are examples|Sample state · review all 50/);
  });

  it("the statement draft is marked as not in the product yet, never presented as a feature that ships", () => {
    for (const key of ["product/compliance", "solutions/compliance"]) assert.match(text(page(key)), /In design · not in the product yet/);
    assert.equal((text(page("product/search")).match(/In design/g) ?? []).length, 0);
  });

  it("UFLPA copy says what was found, and that 'no link found' is not a clearance", () => {
    for (const key of ["product/compliance", "solutions/compliance"]) assert.match(text(page(key)), /No link found. is not a clearance\./);
    assert.doesNotMatch(text(page("product/compliance")), /UFLPA[^.]{0,80}\bcleared\b/i);
  });

  it("the compliance page lists six lists with who keeps them and the day each was read", () => {
    const t = text(page("product/compliance"));
    for (const w of ["UFLPA Entity List", "US Treasury, OFAC", "9,799", "UK Treasury, OFSI", "EU sanctions map", "30 Jul 2026"]) assert.ok(t.includes(w), w);
    assert.equal((page("product/compliance").match(/<tbody[\s\S]*<\/tbody>/)![0].match(/<tr /g) ?? []).length, 6);
  });

  it("certificates are never 'active': four states, each with a date", () => {
    const t = text(page("product/records"));
    for (const s of ["Expired", "Expires in N days", "Valid until", "No expiry date published"]) assert.ok(t.includes(s), s);
    assert.doesNotMatch(t, /\bactive certificate/i);
    assert.match(t, /2 sources differ/);
  });

  it("no score, rating, or paid placement claim appears as a feature anywhere", () => {
    for (const key of Object.keys(PAGES)) assert.doesNotMatch(text(page(key)), /\b(score of|rated|stars?|top-rated|sponsored|featured supplier)\b/i, key);
  });

  it("without the live figures the pages still stand and print no count", () => {
    const out = page("product/search", NO_FACTS);
    assert.match(out, /<h1[^>]*>Search Bangladesh garment suppliers\.<\/h1>/);
    assert.doesNotMatch(text(out), /10,268|published suppliers · updated/);
  });

  it("the live count and its day sit under the first screen", () => {
    assert.match(text(page("product/search")), /10,268 published suppliers · updated 2 Oct 2026/);
  });

  it("each has a title, a description and a canonical address; an unknown page has none", () => {
    for (const key of Object.keys(PAGES)) {
      const m = siteMetadata(key)!;
      assert.ok(String(m.title).endsWith("SourceBD"), key);
      assert.ok(String(m.description).length > 60, key);
      assert.match(String(m.alternates?.canonical), new RegExp(`/${key}$`));
    }
    assert.equal(siteMetadata("product/nope"), null);
  });
});
