// The product and solutions pages, in the home page's design since 25 Oct 2026: Paper's headlines and copy, the live
// figure only when it was read, home's grounds and sections, every picture of the product a recording of the real app
// (`clips.ts`), and every page the menus link to exists.

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
const { PAGES, siteMetadata } = require("@/components/site/pages") as typeof import("@/components/site/pages");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
const { RECORDS_KEY, RecordsPage } = require("@/components/site/product/records") as typeof import("@/components/site/product/records");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
const { SEARCH_KEY, SearchPage } = require("@/components/site/product/search") as typeof import("@/components/site/product/search");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
const { RFQS_KEY, RfqsPage } = require("@/components/site/product/rfqs") as typeof import("@/components/site/product/rfqs");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
const { COMPLIANCE_KEY, CompliancePage } = require("@/components/site/product/compliance") as typeof import("@/components/site/product/compliance");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
const { COMPLIANCE_TEAMS_KEY, SOURCING_KEY, SolutionsCompliancePage, SolutionsSourcingPage } = require("@/components/site/product/solutions") as typeof import("@/components/site/product/solutions");

const FACTS = parseFacts({ suppliers_indexed: 10268, last_refreshed_at: "2026-10-02T05:48:07Z" }, null);
/** The facts with the six sanctions lists read, as `sanctions_lists_read()` gives them (UFLPA in part, no full read). */
const LIST_CODES = ["UFLPA", "OFAC", "UK_OFSI", "EU_SANC", "US_WRO", "ILAB"];
const LIST_FACTS = parseFacts(
  { suppliers_indexed: 10268 },
  { sources: LIST_CODES.map((code) => ({ code, tier: "tier5_regulatory", records: 0, suppliers: 0, latest: null })) },
  [
    { list: "uflpa", entries_listed: 253, last_read: null },
    { list: "ofac_sdn", entries_listed: 9990, last_read: "2026-10-08T22:58:01Z" },
    { list: "uk_ofsi", entries_listed: 1286, last_read: "2026-10-06T09:33:33Z" },
    { list: "eu_sanctions", entries_listed: 1776, last_read: "2026-10-06T10:49:41Z" },
    { list: "us_wro", entries_listed: 75, last_read: null },
    { list: "ilab_tvpra", entries_listed: 457, last_read: "2026-10-16T00:08:23Z" },
  ],
);
/** A page as its route draws it. */
const page = (key: string, facts = FACTS) => {
  const built: Record<string, () => ReactElement> = {
    [RECORDS_KEY]: () => createElement(RecordsPage),
    [SEARCH_KEY]: () => createElement(SearchPage, { facts }),
    [RFQS_KEY]: () => createElement(RfqsPage),
    [COMPLIANCE_KEY]: () => createElement(CompliancePage, { facts }),
    [SOURCING_KEY]: () => createElement(SolutionsSourcingPage),
    [COMPLIANCE_TEAMS_KEY]: () => createElement(SolutionsCompliancePage),
  };
  const build = built[key];
  if (!build) throw new Error(`${key} is not built`);
  return draw(build());
};

describe("the product and solutions pages", () => {
  it("every page the menus link to is built, and nothing else is", () => {
    const hrefs = [...PRODUCT, ...SOLUTIONS].map((i) => i.href.slice(1)).sort();
    assert.deepEqual(Object.keys(PAGES).sort(), hrefs);
  });

  it("each opens with Paper's headline and one way in: the search on the search page alone, Start free and Book a demo on every other (critique 22 Oct, S8)", () => {
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
      const hero = out.slice(0, out.indexOf("</section>"));
      if (key === "product/search") {
        assert.match(hero, /<form[^>]*action="\/discover"/, key);
        assert.doesNotMatch(hero, /href="\/signup"/, `${key}: the search is the hero's one action`);
      } else {
        assert.doesNotMatch(out, /<form[^>]*action="\/discover"/, key);
        assert.match(hero, /href="\/signup"[^>]*>Start free/, key);
        assert.match(hero, /href="\/contact"[^>]*>Book a demo/, key);
      }
      // Home's close: the page's own line, then Start free and Book a demo.
      assert.match(out, new RegExp(`<h2 id="site-close"[^>]*>${PAGES[key]!.close.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</h2>`), key);
    }
  });

  it("stands on home's grounds: a night head, then the warm grid of four, in home's column, none of the old frame", () => {
    for (const key of Object.keys(PAGES)) {
      const out = page(key);
      const tones = [...out.matchAll(/<section data-mk-tone="(night|warm|day)"/g)].map((m) => m[1]);
      assert.equal(tones[0], "night", key);
      assert.equal(tones[1], "warm", key);
      assert.equal(tones.at(-1), "night", `${key}: home's close`);
      assert.doesNotMatch(out, /data-tone="/, `${key}: no fixed dark band`);
      assert.match(out, /text-site-display-sm text-ink \[text-wrap:balance\] md:text-site-display/, `${key}: the head in the hero's type`);
      assert.equal((out.match(/<li class="flex flex-col"><div class="relative aspect-\[496\/331\]/g) ?? []).length, 4, `${key}: home's grid of four`);
    }
  });

  it("every picture of the product is a recording of the real app, the head's and four cards', none twice on a page (founder, 25 Oct 2026)", () => {
    for (const key of Object.keys(PAGES)) {
      const out = page(key);
      const posters = [...out.matchAll(/poster="([^"]+)"/g)].map((m) => m[1]!);
      assert.equal(posters.length, 5, key);
      assert.equal(new Set(posters).size, 5, `${key}: no clip twice`);
      for (const p of posters) assert.match(p, /^\/site\/(search|records|rfqs|compliance)\/clip-[a-z]+\.webp$/, `${key}: ${p}`);
      assert.doesNotMatch(out, /aria-label="Pause demo"|Example quotes|Example RFQ/, `${key}: no drawn demo`);
    }
    assert.ok(!existsSync(join(process.cwd(), "components/site/demos")), "the drawn demos are gone");
  });

  it("no loading.tsx sits above the pages whose unknown slug must answer a real 404", () => {
    for (const dir of ["app/(marketing)", "app/(marketing)/product", "app/(marketing)/solutions", "app/(marketing)/product/[slug]", "app/(marketing)/solutions/[slug]"]) {
      assert.ok(!existsSync(join(process.cwd(), dir, "loading.tsx")), `${dir}/loading.tsx would stream the 404 behind a 200`);
    }
  });

  it("the statement draft ships, so no page calls it in design (audit P1, 14 Oct 2026)", () => {
    assert.ok(existsSync(join(process.cwd(), "app/(app)/app/compliance/msa/page.tsx")), "the statement's route");
    for (const key of ["product/compliance", "solutions/compliance"]) assert.match(text(page(key)), /modern slavery statement/i, key);
    for (const key of Object.keys(PAGES)) assert.doesNotMatch(text(page(key)), /in design/i, key);
  });

  it("UFLPA copy says what was found, and that 'no link found' is not a clearance", () => {
    for (const key of ["product/compliance", "solutions/compliance"]) assert.match(text(page(key)), /No link found. is not a clearance\./);
    assert.doesNotMatch(text(page("product/compliance")), /UFLPA[^.]{0,80}\bcleared\b/i);
  });

  it("the compliance page lists six lists with who keeps them, and their entries and last full read from the live facts, never a date of its own (critique 22 Oct, S12)", () => {
    const out = page("product/compliance", LIST_FACTS);
    const t = text(out);
    const table = text(out.slice(out.indexOf("<table"), out.indexOf("</table>")));
    for (const w of ["UFLPA Entity List", "US Treasury, OFAC 9,990 8 Oct 2026", "UK Treasury, OFSI 1,286 6 Oct 2026", "EU sanctions map", "US Department of Labor, ILAB 457 16 Oct 2026"]) assert.ok(table.includes(w), w);
    assert.match(table, /UFLPA Entity List US Department of Homeland Security 253 Read in part, no full read yet/);
    assert.match(t, /Each list's entries and the day of its last full read, as the product holds them now\./);
    assert.equal((out.match(/<tbody[\s\S]*?<\/tbody>/)![0].match(/<tr>/g) ?? []).length, 6);
    assert.doesNotMatch(t, /as of 3 Oct|3 Oct 2026|Expires in 5 days/);
    const bare = text(page("product/compliance", NO_FACTS));
    assert.match(bare, /The lists we screen against, and who keeps them\./);
    assert.doesNotMatch(bare, /Last read|9,990|Read in part/);
    const listsFailed = text(page("product/compliance", parseFacts({ suppliers_indexed: 10268 }, { sources: LIST_CODES.map((code) => ({ code, tier: "tier5_regulatory", records: 0, suppliers: 0, latest: null })) })));
    assert.doesNotMatch(listsFailed, /Not read yet|Last read/);
    assert.match(listsFailed, /The lists we screen against, and who keeps them\./);
  });

  it("certificates are never 'active': four states, each with a date", () => {
    const t = text(page("product/records"));
    for (const s of ["Expired", "Expires in N days", "Valid until", "Listed as valid"]) assert.ok(t.includes(s), s);
    assert.doesNotMatch(t, /\bactive certificate/i);
  });

  it("the RFQ page shows the empty screens it has, and claims no quote or reply it cannot show", () => {
    const t = text(page("product/rfqs"));
    assert.match(t, /how far it is above or under your target/);
    assert.match(t, /A supplier on the UFLPA Entity List can’t receive an RFQ\./);
    assert.doesNotMatch(t, /US\$\d|\bFOB \$|example quote/i);
  });

  it("no score, rating, or paid placement claim appears as a feature anywhere", () => {
    for (const key of Object.keys(PAGES)) assert.doesNotMatch(text(page(key)), /\b(score of|rated|stars?|top-rated|sponsored|featured supplier)\b/i, key);
  });

  it("without the live figures the pages still stand and print no count", () => {
    const out = page("product/search", NO_FACTS);
    assert.match(out, /<h1[^>]*>Search Bangladesh garment suppliers\.<\/h1>/);
    assert.doesNotMatch(text(out), /10,268/);
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
