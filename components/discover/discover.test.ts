// The public Discover page on the v4 kit (B9h): over a fake read it draws one h1 and a GET search box, the filters
// keep their query-string names, results link to the public profile, an empty search and a failed read are different
// pages, the pages keep the query, nothing a visitor must not see is drawn, and none of the old kit's classes is left.
// The page runs over fakes of the two cached reads (installed into the module cache before the page loads), so the
// arguments of the RPC are asserted as well: the data read is the one it was.

import assert from "node:assert/strict";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { DiscoverRow } from "@/components/discover/result-card";
import type { DiscoverArgs, DiscoverResult } from "@/lib/discover-suppliers";

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
let calls: DiscoverArgs[] = [];
let answer: DiscoverResult = { rows: [], error: null };
{
  const stub = (rel: string, exports: Record<string, unknown>) => {
    const id = require.resolve(path.join(OUT, rel));
    require.cache[id] = { id, filename: id, loaded: true, exports, children: [], paths: [] } as unknown as NodeJS.Module;
  };
  stub("lib/discover-suppliers.js", {
    fetchPublicDiscoverSuppliers: async (args: DiscoverArgs) => {
      calls.push(args);
      return answer;
    },
  });
  stub("lib/discover-facets.js", {
    fetchDiscoverFacets: async () => ({ cities: ["Dhaka", "Gazipur"], districts: ["Gazipur"], products: ["knitwear"], factory_types: ["Knit"] }),
  });
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stubs must be installed before the page module loads.
const Page = require(path.join(OUT, "app/(marketing)/discover/page.js")).default as (p: { searchParams: Promise<Record<string, string | string[] | undefined>> }) => Promise<ReactElement>;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const Loading = require(path.join(OUT, "app/(marketing)/discover/loading.js")).default as () => ReactElement;

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const visit = async (sp: Record<string, string | string[]> = {}) => draw(await Page({ searchParams: Promise.resolve(sp) }));

// What the page's old kit drew with, and what must never be hand-typed again.
const OLD_KIT = /text-ink-(?:primary|secondary|tertiary)|bg-bg-l\d|brand-forest|sem-(?:red|green|amber)|neutral-\d|font-display|proto-card|btn-proto|r9r4|surface-l\d|hairline|rounded-input|rounded-pill|#[0-9a-fA-F]{6}\b/;

const row = (n: number, over: Partial<DiscoverRow> = {}): DiscoverRow => ({
  id: `0f1e2d3c-0000-4000-8000-00000000000${n}`,
  slug: `tex-town-${n}`,
  company_name: `TEX TOWN ${n} LTD.`,
  entity_type: "factory",
  city: "Dhaka",
  district: "Dhaka",
  source_tags: ["BGMEA", "RSC", "BRAND_HM", "WRAP"],
  t13_source_count: 7,
  employees_total: 1200,
  established_date: "2004-01-01",
  principal_products: ["Knit tops", "Dresses"],
  factory_types: ["Knit"],
  rsc_progress_pct: null,
  parent_group_name: null,
  total_count: 2,
  ...over,
});
// The RPC never carries a contact value; if one ever arrived on a row, the page must still not draw it.
const LEAK = { email_primary: "leak@texttown.example", phones: ["+8801700000000"], contact_name: "Mr Leak", contact_role: "Director" };
const sent = (): DiscoverArgs => calls[0] as DiscoverArgs;
const found = (rows: DiscoverRow[]) => {
  answer = { rows, error: null };
};

beforeEach(() => {
  calls = [];
  answer = { rows: [], error: null };
});

describe("the public Discover page: the start", () => {
  it("is a label, one h1, a line and a GET search box that submits q to /discover, and reads nothing without a query", async () => {
    const out = await visit();
    assert.equal((out.match(/<h1\b/g) ?? []).length, 1);
    assert.match(out, /<h1[^>]*>Find a verified factory<\/h1>/);
    assert.match(text(out), /Discover Find a verified factory Search by certification, product, or district\./);
    assert.match(out, /<form[^>]*method="get"[^>]*action="\/discover"[^>]*role="search"|<form[^>]*role="search"[^>]*>/);
    assert.match(out, /<form[^>]*action="\/discover"/);
    assert.match(out, /<input[^>]*type="search"[^>]*name="q"/);
    assert.doesNotMatch(out, /id="discover-results"/);
    assert.equal(calls.length, 0, "no query, no read");
    assert.doesNotMatch(out, OLD_KIT);
  });

  it("keeps the search words in the box", async () => {
    found([row(1)]);
    const out = await visit({ q: "knit dresses" });
    assert.match(out, /<input[^>]*name="q"[^>]*value="knit dresses"/);
  });
});

describe("the public Discover page: results", () => {
  it("reads the RPC with the page's own arguments and draws a row per supplier that opens the public profile", async () => {
    found([row(1, LEAK as Partial<DiscoverRow>), row(2, { employees_total: null, city: null, district: null, source_tags: [], t13_source_count: 1 })]);
    const out = await visit({ q: "knit", cert: ["gots", "wrap"], city: "Dhaka", min_sources: "3", sort: "receipts" });
    assert.equal(calls.length, 1);
    assert.equal(sent().p_q, "knit");
    assert.deepEqual(sent().p_cert_kinds, ["gots", "wrap"]);
    assert.equal(sent().p_city, "Dhaka");
    assert.equal(sent().p_min_sources, 3);
    assert.equal(sent().p_sort, "receipts");
    assert.equal(sent().p_limit, 24);
    assert.equal(sent().p_offset, 0);
    assert.match(text(out), /2 results/);
    assert.match(out, /<a[^>]*href="\/suppliers\/tex-town-1"[^>]*>Tex Town 1 Ltd\.<\/a>/i);
    assert.match(out, /href="\/suppliers\/tex-town-2"/);
    // The table's own words, and the facts a row holds: type, place, workers, the number of sources.
    for (const head of ["Supplier", "Type", "Location", "Workers", "Sources", "Listed in"]) assert.match(out, new RegExp(`<th[^>]*>.*${head}`), head);
    assert.match(text(out), /Factory/);
    assert.match(text(out), /1,200/);
    assert.match(text(out), /Knit tops, Dresses/);
    // A figure that was not published says so; it is never a dash or a blank.
    assert.match(text(out), /Not published/);
    assert.match(text(out), /None found/);
    // The phone's rows carry the same two links.
    assert.equal((out.match(/href="\/suppliers\/tex-town-1"/g) ?? []).length, 2);
    assert.doesNotMatch(out, OLD_KIT);
  });

  it("draws no contact value, no score, no grade and no rating, and offers sign-up", async () => {
    found([row(1, LEAK as Partial<DiscoverRow>)]);
    const out = await visit({ q: "knit" });
    assert.doesNotMatch(out, /leak@texttown|8801700000000|Mr Leak|Director/);
    assert.doesNotMatch(text(out), /\b(score|grade|rating|rated|stars?)\b/i);
    assert.match(out, /<a[^>]*href="\/signup"[^>]*>Start free<\/a>/);
    assert.doesNotMatch(out, /Send RFQ|>Save</);
  });

  it("sorts and filters by the same query-string names", async () => {
    found([row(1)]);
    const out = await visit({ q: "knit", cert: "gots", entity: "factory", registry: "BGMEA", brand: "BRAND_HM", ftype: "Knit", district: "Gazipur", category: "knitwear", min_sources: "2" });
    assert.deepEqual(sent().p_entity_types, ["factory"]);
    assert.deepEqual(sent().p_registries, ["BGMEA"]);
    assert.deepEqual(sent().p_brand_codes, ["BRAND_HM"]);
    assert.deepEqual(sent().p_factory_types, ["Knit"]);
    assert.equal(sent().p_district, "Gazipur");
    // The filter form posts to /discover with the search words and the filters on, and each box has the name the page reads.
    assert.match(out, /<form[^>]*aria-label="Filter suppliers"[^>]*>/);
    assert.match(out, /<input type="hidden" name="q" value="knit"\/>/);
    const boxes = (out.match(/<input\b[^>]*>/g) ?? []).filter((t) => t.includes('name="cert"') && t.includes('value="gots"'));
    assert.equal(boxes.length, 2, "the form is drawn for a wide screen and for a phone");
    assert.ok(boxes.every((t) => t.includes('type="checkbox"') && /\bchecked=""/.test(t)), boxes.join(" "));
    for (const name of ["cert", "entity", "registry", "brand", "ftype", "city", "district", "category", "min_sources"]) assert.match(out, new RegExp(`name="${name}"`), name);
    assert.match(out, /<select[^>]*name="min_sources"/);
    assert.match(out, /<datalist id="discover-cities"><option value="Dhaka"/);
    // The sort is a row of links that keep the query and drop the page.
    assert.match(out, /href="\/discover\?q=knit&[^"]*cert=gots[^"]*&sort=receipts"/);
    assert.match(out, /href="\/discover\?q=knit&[^"]*cert=gots[^"]*&sort=name"/);
    assert.doesNotMatch(out, OLD_KIT);
  });
});

describe("the public Discover page: pages", () => {
  it("keeps the query on Previous and Next, and the first page has no page in its address", async () => {
    found([row(1, { total_count: 60 })]);
    const second = await visit({ q: "knit", cert: "gots", page: "2" });
    assert.equal(sent().p_offset, 24);
    assert.match(text(second), /Showing 25–25 of 60 suppliers Page 2 of 3/);
    assert.match(second, /<a[^>]*href="\/discover\?q=knit&cert=gots"[^>]*>(?:<svg[^>]*><\/svg>)?Previous/);
    assert.match(second, /<a[^>]*href="\/discover\?q=knit&cert=gots&page=3"[^>]*>Next/);
    const first = await visit({ q: "knit", cert: "gots" });
    assert.match(first, /<span aria-disabled="true"[^>]*>(?:<svg[^>]*><\/svg>)?Previous/);
    assert.match(first, /href="\/discover\?q=knit&cert=gots&page=2"/);
    assert.doesNotMatch(first + second, OLD_KIT);
  });

  it("draws no pages for one page of results", async () => {
    found([row(1)]);
    assert.doesNotMatch(await visit({ q: "knit" }), /supplier pages|suppliers pages/);
  });

  it("says a page past the end is past the end, with the way back, and not that nothing matches", async () => {
    answer = { rows: [], error: null };
    const out = await visit({ q: "knit", page: "9" });
    assert.match(text(out), /That page is past the end of these results\. Page 9 has no suppliers\./);
    assert.match(out, /<a[^>]*href="\/discover\?q=knit"[^>]*>Back to the first page/);
    assert.doesNotMatch(text(out), /No suppliers match/);
  });
});

describe("the public Discover page: the states a search can end in", () => {
  it("an empty search says so and offers to clear the search", async () => {
    const out = await visit({ q: "zzzz" });
    assert.match(text(out), /0 results/);
    assert.match(text(out), /No suppliers match “zzzz”\./);
    assert.match(out, /<a[^>]*href="\/discover"[^>]*>Clear search/);
    assert.doesNotMatch(out, /role="alert"/);
    assert.doesNotMatch(out, OLD_KIT);
  });

  it("empty with filters on says which, and clearing them keeps the search words", async () => {
    const out = await visit({ q: "knit", cert: "gots" });
    assert.match(text(out), /No suppliers match these filters\./);
    assert.match(out, /<a[^>]*href="\/discover\?q=knit"[^>]*>Clear filters/);
  });

  it("a failed read is an error with Try again, not an empty list, and never prints the cause", async () => {
    answer = { rows: [], error: "connection to server at db.internal:5432 refused" };
    const out = await visit({ q: "knit", page: "2" });
    assert.match(out, /role="alert"/);
    assert.match(text(out), /We couldn't load suppliers\./);
    assert.match(out, /<a[^>]*href="\/discover\?q=knit&page=2"[^>]*>Try again/);
    assert.doesNotMatch(text(out), /No suppliers match|0 results|results/);
    assert.doesNotMatch(out, /db\.internal|refused/);
    assert.doesNotMatch(out, /<table/);
    assert.doesNotMatch(out, OLD_KIT);
  });
});

describe("the public Discover page: loading", () => {
  it("draws the page's start and rows from the kit's skeletons", () => {
    const out = draw(createElement(Loading));
    assert.match(out, /role="status"[^>]*aria-label="Loading"/);
    assert.match(out, /animate-pulse/);
    assert.doesNotMatch(out, OLD_KIT);
  });
});
