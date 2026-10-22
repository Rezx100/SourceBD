// The product and solutions pages (B9c): Paper's headlines and copy, one real screen per claim with alt text, the
// live figure only when it was read, the sample-state marks, and every page the menus link to exists.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { CAPTION, snapshotNames } from "@/lib/marketing/demo-snapshot";
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
const { SLIDE_NAMES } = require("@/components/site/product/search-slides") as typeof import("@/components/site/product/search-slides");
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
/** A page as its route draws it: every page in the home's frame (M4). */
const page = (key: string, facts = FACTS) => {
  const rebuilt: Record<string, () => ReactElement> = {
    [RECORDS_KEY]: () => createElement(RecordsPage),
    [SEARCH_KEY]: () => createElement(SearchPage, { facts }),
    [RFQS_KEY]: () => createElement(RfqsPage),
    [COMPLIANCE_KEY]: () => createElement(CompliancePage, { facts }),
    [SOURCING_KEY]: () => createElement(SolutionsSourcingPage),
    [COMPLIANCE_TEAMS_KEY]: () => createElement(SolutionsCompliancePage),
  };
  const build = rebuilt[key];
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
      assert.match(out, /href="\/signup"[^>]*>Start free/, key);
      assert.match(out, /href="\/contact"[^>]*>Book a demo/, key);
      assert.match(text(out), /Free during beta\. No card needed\./, key);
    }
  });

  it("no page shows a screenshot: every picture of the product is a demo with its pause button and its dated caption (critique 22 Oct, S2)", () => {
    for (const key of Object.keys(PAGES)) {
      const out = page(key);
      // The cloth stills are decoration (alt=""); a source mark is the register's. Nothing else is a picture.
      const pictures = [...out.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => decodeURIComponent(/url=([^&]+)/.exec(m[1]!)?.[1] ?? m[1]!));
      assert.deepEqual(pictures.filter((f) => f.startsWith("/site/") && !/^\/site\/home\/(?:swatches|rail|hero|port|dusk|mill|loupe|lock|seal|app|crop)-/.test(f)), [], key);
      assert.ok((out.match(/aria-label="Pause demo"/g) ?? []).length >= 4, `${key}: demos, not screens`);
      assert.doesNotMatch(text(out), /Real screen ·|Sample state ·/, key);
    }
    assert.ok(!existsSync(join(process.cwd(), "public/site/search-filters.png")), "the 3 Oct captures are gone");
  });

  it("no loading.tsx sits above the pages whose unknown slug must answer a real 404", () => {
    for (const dir of ["app/(marketing)", "app/(marketing)/product", "app/(marketing)/solutions", "app/(marketing)/product/[slug]", "app/(marketing)/solutions/[slug]"]) {
      assert.ok(!existsSync(join(process.cwd(), dir, "loading.tsx")), `${dir}/loading.tsx would stream the 404 behind a 200`);
    }
  });

  it("every quote and RFQ the demos draw says it is an example", () => {
    for (const key of ["product/rfqs", "solutions/sourcing"]) assert.match(text(page(key)), /Example quotes · the suppliers are real, every figure is an example/, key);
    assert.match(text(page("product/rfqs")), /Example RFQ/);
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
    // Inside the table: the page's own example lede also quotes a day.
    const table = text(out.slice(out.indexOf("<table"), out.indexOf("</table>")));
    for (const w of ["UFLPA Entity List", "US Treasury, OFAC 9,990 8 Oct 2026", "UK Treasury, OFSI 1,286 6 Oct 2026", "EU sanctions map", "US Department of Labor, ILAB 457 16 Oct 2026"]) assert.ok(table.includes(w), w);
    assert.match(table, /UFLPA Entity List US Department of Homeland Security 253 Read in part, no full read yet/);
    assert.match(t, /Each list's entries and the day of its last full read, as the product holds them now\./);
    assert.equal((out.match(/<tbody[\s\S]*?<\/tbody>/)![0].match(/<tr /g) ?? []).length, 6);
    assert.doesNotMatch(t, /as of 3 Oct|3 Oct 2026/);
    // Not read: the names and keepers only, and no figure or day.
    const bare = text(page("product/compliance", NO_FACTS));
    assert.match(bare, /The lists we screen against, and who keeps them\./);
    assert.doesNotMatch(bare, /Last read|9,990|Read in part/);
    // The lists' read failed while the other facts came back: the names alone, never six lists "not read".
    const listsFailed = text(page("product/compliance", parseFacts({ suppliers_indexed: 10268 }, { sources: LIST_CODES.map((code) => ({ code, tier: "tier5_regulatory", records: 0, suppliers: 0, latest: null })) })));
    assert.doesNotMatch(listsFailed, /Not read yet|Last read/);
    assert.match(listsFailed, /The lists we screen against, and who keeps them\./);
  });

  it("certificates are never 'active': four states, each with a date", () => {
    const t = text(page("product/records"));
    for (const s of ["Expired", "Expires in N days", "Valid until", "Listed as valid"]) assert.ok(t.includes(s), s);
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

describe("the records page in the home's frame (M4, handoff-mercury-m4-onward.md §4.2)", () => {
  it("opens on the record demo at its Certificates section, not a screenshot, with the dated caption under the stage", () => {
    const out = page(RECORDS_KEY);
    const hero = out.slice(0, out.indexOf("<h2"));
    assert.match(hero, /<h1[^>]*>Every fact, with its receipt\.<\/h1>/);
    assert.match(hero, /record opened beside the search results at its Certificates section/);
    assert.doesNotMatch(hero, /\/site\/[a-z-]+\.png/);
    assert.ok(!text(hero).includes(CAPTION), "no caption under the stage (founder's video, 22 Oct 2026)");
  });

  it("the ground runs paper then dark: the rows, then the tabbed record, the cross-sell and the close; the home's real records are not repeated (critique 22 Oct)", () => {
    const out = page(RECORDS_KEY);
    assert.match(out, /^(?:<link [^>]*>)*<main class="[^"]*bg-\[rgb\(var\(--mk-ground-paper\)\)\]/);
    const tones = [...out.matchAll(/data-tone="(photo|dark|paper)"/g)].map((m) => m[1]);
    assert.deepEqual(tones, ["paper", "dark"]);
    assert.doesNotMatch(text(out), /Real records, not reviews/);
  });

  it("every demo on the page has its pause button and its dated caption; the safety row plays the record at its Safety section", () => {
    const out = page(RECORDS_KEY);
    const pauses = (out.match(/aria-label="Pause demo"/g) ?? []).length;
    // The hero, the receipts, the certificate, the open tab, and the three loops of the cross-sell.
    assert.ok(pauses >= 7, `${pauses} pause buttons`);
    assert.ok(!text(out).includes(CAPTION), "no dated caption under the product (founder's video, 22 Oct 2026)");
    assert.match(out, /record opened beside the search results at its Safety section: \d RSC records?/);
    assert.match(text(out), /Building · RSC Issues fixed Training/);
    assert.match(text(out), /Inspection reports on the register: Fire, Structural, Electrical, Boiler, Action plan/);
    assert.match(text(out), /Contact details are locked/);
  });

  it("Inside one record is a tablist of three sections with Certificates open, swapping by the motion tokens", () => {
    const out = page(RECORDS_KEY);
    assert.match(out, /role="tablist" aria-label="Sections of the record"/);
    assert.equal((out.match(/role="tab"/g) ?? []).length, 3);
    assert.equal((out.match(/aria-selected="true"/g) ?? []).length, 1);
    assert.match(out, /aria-selected="true"[^>]*>Certificates/);
    assert.match(out, /role="tabpanel"[^>]*><div class="animate-swap-in/);
    for (const w of ["Certificates", "Sources", "Contact"]) assert.match(out, new RegExp(`role="tab"[^>]*>${w}<`), w);
  });

  it("the cross-sell links to the three other product pages, each with its loop, and never to this one", () => {
    const out = page(RECORDS_KEY);
    const cross = out.slice(out.indexOf('aria-labelledby="site-cross-sell"'), out.indexOf('aria-labelledby="site-close"'));
    for (const href of ["/product/search", "/product/rfqs", "/product/compliance"]) assert.match(cross, new RegExp(`href="${href}"`), href);
    assert.doesNotMatch(cross, /href="\/product\/records"/);
    assert.equal((cross.match(/aria-label="Pause demo"/g) ?? []).length, 3);
  });

  it("keeps the template's pins: the search, the two calls to action, the four states and the free-during-beta close", () => {
    const out = page(RECORDS_KEY);
    const t = text(out);
    assert.equal((out.match(/<h1[ >]/g) ?? []).length, 1);
    assert.doesNotMatch(out, /<form[^>]*action="\/discover"/);
    assert.match(out, /href="\/signup"[^>]*>Start free/);
    assert.match(out, /href="\/contact"[^>]*>Book a demo/);
    for (const s of ["Expired", "Expires in N days", "Valid until", "Listed as valid", "2 sources differ", "Check one supplier now."]) assert.ok(t.includes(s), s);
    assert.match(t, /Free during beta\. No card needed\./);
    assert.doesNotMatch(t, /undefined|NaN|\[object/);
  });
});

describe("the search page in the home's frame (M4, handoff-mercury-m4-onward.md §4.2)", () => {
  it("opens on the Find demo, not a screenshot, with the live count under the stage and no dated caption", () => {
    const out = page(SEARCH_KEY);
    const hero = out.slice(0, out.indexOf("<h2"));
    assert.match(hero, /<h1[^>]*>Search 10,268 garment suppliers\.<\/h1>/);
    assert.match(hero, /A search for knit GOTS/);
    assert.doesNotMatch(hero, /\/site\/[a-z-]+\.png/);
    assert.match(text(hero), /10,268 published suppliers · updated 2 Oct 2026/);
    assert.ok(!text(hero).includes(CAPTION));
  });

  it("names six filters, each one the page's own words already claim, in a hairline list with no icons (critique 22 Oct)", () => {
    const out = page(SEARCH_KEY);
    const grid = /<section aria-labelledby="search-filters"[\s\S]*?<\/section>/.exec(out)![0];
    assert.equal((grid.match(/<li /g) ?? []).length, 6);
    assert.match(grid, /<ul class="group\/reveal/);
    assert.doesNotMatch(grid, /<svg/, "no icon");
    for (const w of ["Product or HS code", "Certificate and its state", "District", "Workers", "Brand supplier lists", "BGMEA or BKMEA member"]) assert.ok(text(grid).includes(w), w);
    assert.match(text(grid), /how many suppliers you will get/);
  });

  it("the record row plays Check beside the results; the filters row draws the filter pane; the results row shows three of the table's rows (critique 22 Oct)", () => {
    const out = page(SEARCH_KEY);
    const t = text(out);
    assert.match(out, /record opened beside the search results at its Certificates section/);
    assert.match(out, /The filter pane open over a search for knit/);
    assert.match(t, /Certificates GOTS OEKO-TEX WRAP SA8000 Certificate status Any Valid Expiring Expired/);
    assert.match(out, /3 rows of the search results/);
    assert.doesNotMatch(out, /\/site\/[a-z-]+\.png/);
    // The table as it stands: no certificate state in the list, so the row's words say the dates are on the record.
    assert.match(t, /Every row says which to open\. What it makes, where it is, its workers, the certificate schemes it holds today and how many sources hold it\./);
    assert.doesNotMatch(t, /first certificate problem/);
  });

  it("one search narrowed twice, in three steps stacked one under the other: nothing hidden behind a carousel, every row the snapshot's (critique 22 Oct)", () => {
    const out = page(SEARCH_KEY);
    assert.doesNotMatch(out, /aria-roledescription="carousel"|Previous slide|Next slide/);
    const steps = /<ol aria-label="One search narrowed step by step"[\s\S]*?<\/ol>/.exec(out)![0];
    assert.equal((steps.match(/<li /g) ?? []).length, 3);
    for (const w of ["By product and certificate", "Then by district", "Then by size", "The first page of the search", "Narrowed to Gazipur from the first page", "Narrowed to 1,000 workers or more from the first page"]) assert.ok(text(steps).includes(w), w);
    const allowed = new Set(snapshotNames());
    for (const n of SLIDE_NAMES) assert.ok(allowed.has(n), n);
    // A still moves nothing, so it offers no pause button: the page's pause buttons are the hero's, the filter pane's, the record row's and the cross-sell's three.
    assert.equal((out.match(/aria-label="Pause demo"/g) ?? []).length, 6);
  });

  it("the ground runs paper, dark, paper, dark: the rows, the three steps and cross-sell, the FAQ, the close", () => {
    const out = page(SEARCH_KEY);
    assert.match(out, /^(?:<link [^>]*>)*<main class="[^"]*bg-\[rgb\(var\(--mk-ground-paper\)\)\]/);
    const tones = [...out.matchAll(/data-tone="(photo|dark|paper)"/g)].map((m) => m[1]);
    assert.deepEqual(tones, ["paper", "dark", "paper", "dark"]);
    const cross = out.slice(out.indexOf('aria-labelledby="site-cross-sell"'), out.indexOf('aria-labelledby="search-faq"'));
    for (const href of ["/product/records", "/product/rfqs", "/product/compliance"]) assert.match(cross, new RegExp(`href="${href}"`), href);
    assert.doesNotMatch(cross, /href="\/product\/search"/);
    assert.equal((out.match(/<details /g) ?? []).length, 4, "four answers about search");
    for (const q of ["Where do the facts come from?", "Can a supplier pay to appear higher?", "How fresh is each fact?", "Do you list buying houses too?"]) assert.ok(text(out).includes(q), q);
  });

  it("keeps the template's pins: the search, the results row's words and the free-during-beta close", () => {
    const out = page(SEARCH_KEY);
    const t = text(out);
    assert.equal((out.match(/<h1[ >]/g) ?? []).length, 1);
    assert.match(out, /<form[^>]*action="\/discover"/);
    assert.match(out, /href="\/signup"[^>]*>Start free/);
    assert.match(out, /href="\/contact"[^>]*>Book a demo/);
    for (const s of ["Filters that match how you buy.", "The record opens beside your list.", "Every row says which to open.", "Try it on your next product."]) assert.ok(t.includes(s), s);
    assert.match(t, /Free during beta\. No card needed\./);
    assert.doesNotMatch(t, /undefined|NaN|\[object/);
  });

  it("without the live figures the page still stands: the plain headline, no count, no updated day", () => {
    const out = page(SEARCH_KEY, NO_FACTS);
    assert.match(out, /<h1[^>]*>Search Bangladesh garment suppliers\.<\/h1>/);
    assert.doesNotMatch(text(out), /10,268|published suppliers · updated/);
  });

  it("the records page's pins still hold after the stage helper moved", () => {
    const t = text(page(RECORDS_KEY));
    for (const s of ["Every fact, with its receipt.", "2 sources differ", "Check one supplier now."]) assert.ok(t.includes(s), s);
  });
});

describe("the RFQs page in the home's frame (M4, handoff-mercury-m4-onward.md §4.2)", () => {
  it("opens on the Ask demo, not a screenshot; the rows play the quotes at full size, a reply under its RFQ, and one RFQ reviewed before it goes (critique 22 Oct)", () => {
    const out = page(RFQS_KEY);
    const hero = out.slice(0, out.indexOf("<h2"));
    assert.match(hero, /<h1[^>]*>One RFQ, up to 50 suppliers\.<\/h1>/);
    assert.match(hero, /Three suppliers ticked from the results and one example RFQ/);
    assert.doesNotMatch(out, /\/site\/[a-z-]+\.png/);
    const t = text(out);
    assert.match(t, /Example quotes · the suppliers are real, every figure is an example/);
    assert.match(t, /RFQ sent \d{1,2} [A-Z][a-z]{2} \d{4} Quantity 12,000 pieces Ship by 15 Jan 2027 Quote US\$6\.15 per piece/);
    assert.match(t, /Example messages/);
    assert.match(t, /you can add up to 50/);
    assert.match(t, /Sends to \d+ suppliers\./, "the review ends with the sanctioned example removed and the RFQ ready to send");
  });

  it("the ground runs paper then dark, every demo has a pause button and a dated caption, and the cross-sell links to the three other products", () => {
    const out = page(RFQS_KEY);
    const tones = [...out.matchAll(/data-tone="(photo|dark|paper)"/g)].map((m) => m[1]);
    assert.deepEqual(tones, ["paper", "dark"]);
    const pauses = (out.match(/aria-label="Pause demo"/g) ?? []).length;
    assert.equal(pauses, 7, "the hero, the quotes, the thread, the review and the cross-sell's three loops");
    assert.ok(!text(out).includes(CAPTION), "no dated caption under the product");
    const cross = out.slice(out.indexOf('aria-labelledby="site-cross-sell"'), out.indexOf('aria-labelledby="site-close"'));
    for (const href of ["/product/search", "/product/records", "/product/compliance"]) assert.match(cross, new RegExp(`href="${href}"`), href);
    assert.doesNotMatch(cross, /href="\/product\/rfqs"/);
  });

  it("keeps the template's pins: the search, the two calls to action, the three rows' words and the free-during-beta close", () => {
    const out = page(RFQS_KEY);
    const t = text(out);
    assert.equal((out.match(/<h1[ >]/g) ?? []).length, 1);
    assert.doesNotMatch(out, /<form[^>]*action="\/discover"/);
    assert.match(out, /href="\/signup"[^>]*>Start free/);
    assert.match(out, /href="\/contact"[^>]*>Book a demo/);
    for (const s of ["Quotes side by side.", "Replies in one thread per supplier.", "Write it once, send it to 50.", "Send your first RFQ today."]) assert.ok(t.includes(s), s);
    assert.match(t, /Free during beta\. No card needed\./);
    assert.doesNotMatch(t, /undefined|NaN|\[object/);
  });

  it("the search page's pins still hold beside it", () => {
    const t = text(page(SEARCH_KEY));
    for (const s of ["Filters that match how you buy.", "Six ways to narrow.", "Then by district", "Try it on your next product."]) assert.ok(t.includes(s), s);
    assert.match(t, /10,268 published suppliers · updated 2 Oct 2026/);
  });
});

describe("the solutions pages in the home's frame (M4, handoff-mercury-m4-onward.md §4.2)", () => {
  it("sourcing: the Ask playing in the hero, a pinned tour of Find, Check and Ask, the three rows with their demos, three products, the close with the outcome as its line", () => {
    const out = page(SOURCING_KEY);
    assert.match(out, /<h1[^>]*>From search to RFQ in one sitting\.<\/h1>/);
    assert.match(out.slice(0, out.indexOf("<h2")), /Three suppliers ticked from the results and one example RFQ/);
    assert.doesNotMatch(out, /\/site\/[a-z-]+\.png/);
    assert.match(out, /<section data-tone="dark" aria-labelledby="sourcing-tour" class="py-16 md:py-section">/, "a section, never a pinned run (founder's video, 22 Oct 2026)");
    assert.equal((out.match(/aria-expanded="true"/g) ?? []).length, 1);
    assert.equal((out.match(/aria-expanded="false"/g) ?? []).length, 2);
    for (const k of ["find", "check", "ask"]) assert.match(out, new RegExp(`id="tour-${k}"`), k);
    assert.doesNotMatch(out, /id="tour-watch"/);
    const t = text(out);
    assert.match(t, /Find, check, ask\. One sitting\./);
    for (const s of ["Find factories that make your product.", "Check them before you ask.", "Ask many at once.", "Build your shortlist today.", "every figure is an example"]) assert.ok(t.includes(s), s);
    // The outcome is the close's own line, not a section with a kicker (critique 22 Oct).
    assert.match(t, /Build your shortlist today\. A shortlist your compliance team can check, source by source\. Free during beta\./);
    assert.doesNotMatch(t, /The outcome/);
    assert.doesNotMatch(t, /first certificate problem/);
    const tones = [...out.matchAll(/data-tone="(photo|dark|paper)"/g)].map((m) => m[1]);
    assert.deepEqual(tones, ["paper", "dark", "paper", "dark"]);
    const cross = out.slice(out.indexOf('aria-labelledby="site-cross-sell"'), out.indexOf('aria-labelledby="site-close"'));
    for (const href of ["/product/search", "/product/records", "/product/rfqs"]) assert.match(cross, new RegExp(`href="${href}"`), href);
    assert.doesNotMatch(cross, /href="\/product\/compliance"/);
    assert.match(t, /Free during beta\. No card needed\./);
  });

  it("compliance teams: the Watch playing in the hero, a pinned tour of Check, Watch and Screen (the checks with the one maroon example), four rows with their demos, three products, the close with the outcome as its line", () => {
    const out = page(COMPLIANCE_TEAMS_KEY);
    assert.match(out, /<h1[^>]*>Show where every fact came from\.<\/h1>/);
    assert.match(out.slice(0, out.indexOf("<h2")), /saved suppliers checked against the UFLPA Entity List/);
    assert.doesNotMatch(out, /\/site\/[a-z-]+\.png/);
    assert.match(out, /<section data-tone="dark" aria-labelledby="compliance-tour" class="py-16 md:py-section">/);
    for (const k of ["check", "watch", "screen"]) assert.match(out, new RegExp(`id="tour-${k}"`), k);
    const t = text(out);
    assert.match(t, /Check, watch, screen\. Every fact dated\./);
    for (const s of ["Check certificates and their dates.", "Screen against the UFLPA Entity List.", "Watch for expiry.", "Draft the modern slavery statement.", "Evidence you can show an auditor: the source, the number, the date.", "Check your suppliers today."]) assert.ok(t.includes(s), s);
    assert.match(t, /No link found. is not a clearance\./);
    const cross = out.slice(out.indexOf('aria-labelledby="site-cross-sell"'), out.indexOf('aria-labelledby="site-close"'));
    for (const href of ["/product/records", "/product/compliance", "/product/search"]) assert.match(cross, new RegExp(`href="${href}"`), href);
    assert.doesNotMatch(t, /undefined|NaN|\[object/);
  });

  it("the tour shows its open item in one window with its pause button, never a second stacked copy", () => {
    for (const key of [SOURCING_KEY, COMPLIANCE_TEAMS_KEY]) {
      const out = page(key);
      // The hero, a demo per row and the cross-sell's three loops; the tour's window plays the recordings.
      const rows = key === SOURCING_KEY ? 3 : 4;
      assert.equal((out.match(/aria-label="Pause demo"/g) ?? []).length, 4 + rows, key);
      assert.equal((out.match(/aria-label="Pause video"/g) ?? []).length, 1, key);
      assert.doesNotMatch(out, /<h3 class="flex items-center gap-3/, key);
    }
  });
});

describe("the compliance page in the home's frame (M4, handoff-mercury-m4-onward.md §4.2)", () => {
  it("opens on the Watch demo, not a screenshot; the four moments follow; the needs-attention row plays the expiry vignette; UFLPA plays the checks; the statement draft is drawn", () => {
    const out = page(COMPLIANCE_KEY);
    const hero = out.slice(0, out.indexOf("<h2"));
    assert.match(hero, /<h1[^>]*>Know before a certificate expires\.<\/h1>/);
    assert.match(hero, /saved suppliers checked against the UFLPA Entity List/);
    assert.doesNotMatch(out, /\/site\/[a-z-]+\.png/);
    assert.match(out, /checked one by one against the UFLPA Entity List: no link found, which is not a clearance/);
    assert.match(text(out), /Before you download/);
    // The draft ends with both claims confirmed (the server's last step): the answers underlined, Download open.
    assert.match(text(out), /Section 5 Training Every buyer on the sourcing team completed/);
    assert.match(text(out), /Example answers/);
    assert.match(text(out), /Download statement/);
    const t = text(out);
    assert.match(t, /Four moments from a day's sourcing\./);
    assert.ok(t.indexOf("Four moments") < t.indexOf("Expired first, then expiring."), "the moments come before the rows");
    // The grid plays the same vignette first, so look inside the row itself (its media follows its words).
    const attention = out.slice(out.indexOf("Expired first, then expiring."), out.indexOf("UFLPA screening, with the list and its date."));
    assert.match(attention, /the chip counts the days down as they pass/);
    assert.match(attention, /aria-label="Pause demo"/);
  });

  it("the ground runs paper then dark; nine demos, each with a pause button and a dated caption; the cross-sell links to the three other products", () => {
    const out = page(COMPLIANCE_KEY);
    const tones = [...out.matchAll(/data-tone="(photo|dark|paper)"/g)].map((m) => m[1]);
    assert.deepEqual(tones, ["paper", "dark"]);
    const pauses = (out.match(/aria-label="Pause (?:demo|video)"/g) ?? []).length;
    assert.equal(pauses, 11, "the hero, the four moments' four clips, the expiry vignette, the UFLPA checks, the statement and the cross-sell's three loops");
    assert.ok(!text(out).includes(CAPTION), "no dated caption under the product");
    const cross = out.slice(out.indexOf('aria-labelledby="site-cross-sell"'), out.indexOf('aria-labelledby="site-close"'));
    for (const href of ["/product/search", "/product/records", "/product/rfqs"]) assert.match(cross, new RegExp(`href="${href}"`), href);
    assert.doesNotMatch(cross, /href="\/product\/compliance"/);
  });

  it("keeps the template's pins: the search, the two calls to action, the lists table, the statement and the free-during-beta close", () => {
    const out = page(COMPLIANCE_KEY);
    const t = text(out);
    assert.equal((out.match(/<h1[ >]/g) ?? []).length, 1);
    assert.doesNotMatch(out, /<form[^>]*action="\/discover"/);
    assert.match(out, /href="\/signup"[^>]*>Start free/);
    assert.match(out, /href="\/contact"[^>]*>Book a demo/);
    for (const s of ["Expired first, then expiring.", "UFLPA screening, with the list and its date.", "The lists we check, and when we read them.", "A statement you confirm, line by line.", "Watch your saved suppliers."]) assert.ok(t.includes(s), s);
    assert.equal((out.match(/<tbody[\s\S]*?<\/tbody>/)![0].match(/<tr /g) ?? []).length, 6);
    assert.match(t, /Free during beta\. No card needed\./);
    assert.doesNotMatch(t, /undefined|NaN|\[object/);
  });
});
