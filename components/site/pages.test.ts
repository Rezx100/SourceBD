// The product and solutions pages (B9c): Paper's headlines and copy, one real screen per claim with alt text, the
// live figure only when it was read, the sample-state marks, and every page the menus link to exists.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync } from "node:fs";
import { join } from "node:path";

import type { HomeRecord } from "@/lib/home-records";
import { CAPTION, snapshotNames } from "@/lib/marketing/demo-snapshot";
import { NO_FACTS, parseFacts } from "@/lib/site-facts";
import { SAMPLE_CAPTION } from "@/components/site/demos/vignettes";
import { PRODUCT, SOLUTIONS } from "@/components/site/map";

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const { PAGES, SitePage, siteMetadata } = require("@/components/site/pages") as typeof import("@/components/site/pages");
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
/** A page as its route draws it: every page in the home's frame (M4); `SitePage` stays for a page not rebuilt. */
const page = (key: string, facts = FACTS, cards: HomeRecord[] = []) => {
  const rebuilt: Record<string, () => ReactElement> = {
    [RECORDS_KEY]: () => createElement(RecordsPage, { cards }),
    [SEARCH_KEY]: () => createElement(SearchPage, { facts }),
    [RFQS_KEY]: () => createElement(RfqsPage),
    [COMPLIANCE_KEY]: () => createElement(CompliancePage, { facts }),
    [SOURCING_KEY]: () => createElement(SolutionsSourcingPage),
    [COMPLIANCE_TEAMS_KEY]: () => createElement(SolutionsCompliancePage),
  };
  return draw(rebuilt[key]?.() ?? createElement(SitePage, { pageKey: key, facts }));
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

  it("every screen exists on disk and has alt text and a caption that says what kind of screen it is", () => {
    for (const [key, p] of Object.entries(PAGES)) {
      const out = page(key);
      // The textile stills behind the screens are decoration (alt=""), and a source mark is the register's; every screen says what it shows.
      const shots = [...out.matchAll(/<img[^>]*>/g)]
        .map((m) => m[0])
        .map((i) => {
          const src = /src="([^"]+)"/.exec(i)![1]!;
          return { i, file: decodeURIComponent(/url=([^&]+)/.exec(src)?.[1] ?? src) };
        })
        .filter(({ file }) => file.startsWith("/site/") && !file.startsWith("/site/home/"));
      assert.ok(shots.length >= 1, key);
      for (const { i, file } of shots) {
        assert.match(i, /alt="[^"]{20,}"/, `${key} alt`);
        assert.ok(existsSync(join(process.cwd(), "public", file)), `${key}: ${file}`);
      }
      for (const b of [...p.blocks.filter((x) => x.shot).map((x) => x.shot!), ...(p.hero ? [p.hero] : [])]) assert.match(b.caption, /^(Real screen|Sample state) · /, key);
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
    for (const w of ["UFLPA Entity List", "US Treasury, OFAC", "9,990", "8 Oct 2026", "UK Treasury, OFSI", "EU sanctions map", "16 Oct 2026"]) assert.ok(t.includes(w), w);
    assert.match(t, /UFLPA Entity List US Department of Homeland Security 253 Read in part, no full read yet/);
    assert.match(t, /Each list's entries and the day of its last full read, as the product holds them now\./);
    assert.equal((out.match(/<tbody[\s\S]*?<\/tbody>/)![0].match(/<tr /g) ?? []).length, 6);
    assert.doesNotMatch(t, /as of 3 Oct|3 Oct 2026/);
    // Not read: the names and keepers only, and no figure or day.
    const bare = text(page("product/compliance", NO_FACTS));
    assert.match(bare, /The lists we screen against, and who keeps them\./);
    assert.doesNotMatch(bare, /Last full read|9,990|Read in part/);
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

const CARD: HomeRecord = { slug: "aboni-knitwear", name: "Aboni Knitwear Ltd", meta: "Factory · Dhaka · 3,314 workers", marks: ["EPB", "BGMEA"], facts: [{ icon: "rosette", title: "WRAP 7865 · valid to 25 Aug 2027", sub: "WRAP register · read 10 Oct 2026" }] };

describe("the records page in the home's frame (M4, handoff-mercury-m4-onward.md §4.2)", () => {
  it("opens on the record demo at its Certificates section, not a screenshot, with the dated caption under the stage", () => {
    const out = page(RECORDS_KEY);
    const hero = out.slice(0, out.indexOf("<h2"));
    assert.match(hero, /<h1[^>]*>Every fact, with its receipt\.<\/h1>/);
    assert.match(hero, /record opened beside the search results at its Certificates section/);
    assert.doesNotMatch(hero, /records-overview\.png/);
    assert.ok(text(hero).includes(CAPTION), "the caption under the cotton stage");
  });

  it("the ground runs paper, dark, paper, dark: the rows, the tabbed record, the real records, the cross-sell and the close", () => {
    const out = page(RECORDS_KEY, FACTS, [CARD]);
    assert.match(out, /^(?:<link [^>]*>)*<main data-tone="paper" class="[^"]*bg-\[rgb\(var\(--mk-ground-paper\)\)\]/);
    const tones = [...out.matchAll(/data-tone="(photo|dark|paper)"/g)].map((m) => m[1]).slice(1);
    assert.deepEqual(tones, ["paper", "dark", "paper", "dark"]);
    assert.match(text(out), /Real records, not reviews\. .*Aboni Knitwear Ltd/);
    // With no record read, the paper band between the two dark ones is not drawn, and nothing else moves.
    const bare = [...page(RECORDS_KEY).matchAll(/data-tone="(photo|dark|paper)"/g)].map((m) => m[1]).slice(1);
    assert.deepEqual(bare, ["paper", "dark", "dark"]);
  });

  it("every demo on the page has its pause button and its dated caption; the safety row keeps its 3 Oct screen", () => {
    const out = page(RECORDS_KEY);
    const pauses = (out.match(/aria-label="Pause demo"/g) ?? []).length;
    // The hero, the receipts, the certificate, the open tab, and the three loops of the cross-sell.
    assert.ok(pauses >= 7, `${pauses} pause buttons`);
    assert.ok((text(out).match(new RegExp(`${CAPTION}|${SAMPLE_CAPTION}`.replace(/[.*+?^${}()[\]\\]/g, "\\$&"), "g")) ?? []).length >= pauses, "a dated caption for every demo");
    assert.match(out, /records-safety\.png/);
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
  it("opens on the Find demo, not a screenshot, with the dated caption and the live count under the stage", () => {
    const out = page(SEARCH_KEY);
    const hero = out.slice(0, out.indexOf("<h2"));
    assert.match(hero, /<h1[^>]*>Search 10,268 garment suppliers\.<\/h1>/);
    assert.match(hero, /A search for knit GOTS/);
    assert.doesNotMatch(hero, /search-results\.png/);
    assert.match(text(hero), /Real records as read \d{1,2} [A-Z][a-z]{2} \d{4} 10,268 published suppliers · updated 2 Oct 2026/);
  });

  it("names six filters, each one the page's own words already claim, in a grid that reveals", () => {
    const out = page(SEARCH_KEY);
    const grid = /<section aria-labelledby="search-filters"[\s\S]*?<\/section>/.exec(out)![0];
    assert.equal((grid.match(/<li /g) ?? []).length, 6);
    assert.match(grid, /<ul class="group\/reveal/);
    for (const w of ["Product or HS code", "Certificate and its state", "District", "Workers", "Brand supplier lists", "BGMEA or BKMEA member"]) assert.ok(text(grid).includes(w), w);
    assert.match(text(grid), /how many suppliers you will get/);
  });

  it("the record row plays Check beside the results; the filters row keeps its 3 Oct screen", () => {
    const out = page(SEARCH_KEY);
    assert.match(out, /record opened beside the search results at its Certificates section/);
    assert.match(out, /search-filters\.png/);
    assert.doesNotMatch(out, /search-pane\.png/);
  });

  it("the carousel shows one search narrowed twice: three slides, the first drawn, every row the snapshot's", () => {
    const out = page(SEARCH_KEY);
    assert.match(out, /aria-roledescription="carousel" aria-label="One search narrowed step by step"/);
    assert.equal((out.match(/aria-roledescription="slide"/g) ?? []).length, 3);
    assert.match(out, /aria-label="01 \/ 03 · By product and certificate" aria-hidden="false"/);
    assert.equal((out.match(/aria-roledescription="slide"[^>]*aria-hidden="true"/g) ?? []).length, 2);
    assert.match(text(out), /01 \/ 03/);
    for (const w of ["The first page of the search", "Narrowed to Gazipur from the first page", "Narrowed to 1,000 workers or more from the first page", "Previous slide", "Next slide"]) assert.ok(text(out).includes(w) || out.includes(w), w);
    const allowed = new Set(snapshotNames());
    for (const n of SLIDE_NAMES) assert.ok(allowed.has(n), n);
    // A still moves nothing, so it offers no pause button: the page's pause buttons are the hero's, the record row's and the cross-sell's three.
    assert.equal((out.match(/aria-label="Pause demo"/g) ?? []).length, 5);
  });

  it("the ground runs paper, dark, paper, dark: the rows, the carousel and cross-sell, the FAQ, the close", () => {
    const out = page(SEARCH_KEY);
    assert.match(out, /^(?:<link [^>]*>)*<main data-tone="paper" class="[^"]*bg-\[rgb\(var\(--mk-ground-paper\)\)\]/);
    const tones = [...out.matchAll(/data-tone="(photo|dark|paper)"/g)].map((m) => m[1]).slice(1);
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
    for (const s of ["Filters that match how you buy.", "The record opens beside your list.", "Every row says what needs a look.", "Try it on your next product."]) assert.ok(t.includes(s), s);
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
  it("opens on the Ask demo, not a screenshot; the quotes row plays the quotes vignette; the thread and the 50-supplier form keep their screens", () => {
    const out = page(RFQS_KEY);
    const hero = out.slice(0, out.indexOf("<h2"));
    assert.match(hero, /<h1[^>]*>One RFQ, up to 50 suppliers\.<\/h1>/);
    assert.match(hero, /Three suppliers ticked from the results and one example RFQ/);
    assert.doesNotMatch(out, /rfq-one\.png|rfq-quotes\.png/);
    assert.match(out, /rfq-thread\.png/);
    assert.match(out, /rfq-fifty\.png/);
    const t = text(out);
    assert.match(t, /Example quotes/);
    assert.match(t, /the suppliers are real, the figures are examples/);
    assert.match(t, /Sample state · review all 50 suppliers before sending/);
  });

  it("the ground runs paper then dark, every demo has a pause button and a dated caption, and the cross-sell links to the three other products", () => {
    const out = page(RFQS_KEY);
    const tones = [...out.matchAll(/data-tone="(photo|dark|paper)"/g)].map((m) => m[1]).slice(1);
    assert.deepEqual(tones, ["paper", "dark"]);
    const pauses = (out.match(/aria-label="Pause demo"/g) ?? []).length;
    assert.equal(pauses, 5, "the hero, the quotes vignette and the cross-sell's three loops");
    assert.ok((text(out).match(new RegExp(`${CAPTION}|${SAMPLE_CAPTION}`.replace(/[.*+?^${}()[\]\\]/g, "\\$&"), "g")) ?? []).length >= pauses);
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
    for (const s of ["Filters that match how you buy.", "Six ways to narrow.", "01 / 03", "Try it on your next product."]) assert.ok(t.includes(s), s);
    assert.match(t, /10,268 published suppliers · updated 2 Oct 2026/);
  });
});

describe("the solutions pages in the home's frame (M4, handoff-mercury-m4-onward.md §4.2)", () => {
  it("sourcing: the Saved screen as the hero's still, a pinned tour of Find, Check and Ask, the three rows with their screens, the outcome, three products, the close", () => {
    const out = page(SOURCING_KEY);
    assert.match(out, /<h1[^>]*>From search to RFQ in one sitting\.<\/h1>/);
    assert.match(out, /saved-selected\.png/);
    assert.match(out, /<section data-tone="dark" aria-labelledby="sourcing-tour" class="[^"]*lg:h-\[calc\(var\(--tour-n\)\*90vh\)\]" style="--tour-n:3"/);
    assert.equal((out.match(/aria-expanded="true"/g) ?? []).length, 1);
    assert.equal((out.match(/aria-expanded="false"/g) ?? []).length, 2);
    for (const k of ["find", "check", "ask"]) assert.match(out, new RegExp(`id="tour-item-${k}"`), k);
    assert.doesNotMatch(out, /id="tour-item-watch"/);
    const t = text(out);
    assert.match(t, /Find, check, ask\. One sitting\./);
    for (const s of ["Find factories that make your product.", "Check them before you ask.", "Ask many at once.", "A shortlist your compliance team can check, source by source.", "Build your shortlist today.", "Sample state · figures are examples"]) assert.ok(t.includes(s), s);
    const tones = [...out.matchAll(/data-tone="(photo|dark|paper)"/g)].map((m) => m[1]).slice(1);
    assert.deepEqual(tones, ["paper", "dark", "paper", "dark"]);
    const cross = out.slice(out.indexOf('aria-labelledby="site-cross-sell"'), out.indexOf('aria-labelledby="site-close"'));
    for (const href of ["/product/search", "/product/records", "/product/rfqs"]) assert.match(cross, new RegExp(`href="${href}"`), href);
    assert.doesNotMatch(cross, /href="\/product\/compliance"/);
    assert.match(t, /Free during beta\. No card needed\./);
  });

  it("compliance teams: the hub as the hero's still, a pinned tour of Check, Watch and Screen (the sanction vignette), four rows, the outcome, three products, the close", () => {
    const out = page(COMPLIANCE_TEAMS_KEY);
    assert.match(out, /<h1[^>]*>Show where every fact came from\.<\/h1>/);
    assert.match(out, /compliance-hub\.png/);
    assert.match(out, /aria-labelledby="compliance-tour"[^>]*style="--tour-n:3"/);
    for (const k of ["check", "watch", "screen"]) assert.match(out, new RegExp(`id="tour-item-${k}"`), k);
    const t = text(out);
    assert.match(t, /Check, watch, screen\. Every fact dated\./);
    assert.match(t, /Example Apparel Ltd/);
    for (const s of ["Check certificates and their dates.", "Screen against the UFLPA Entity List.", "Watch for expiry.", "Draft the modern slavery statement.", "Evidence you can show an auditor: the source, the number, the date.", "Check your suppliers today."]) assert.ok(t.includes(s), s);
    assert.match(t, /No link found. is not a clearance\./);
    const cross = out.slice(out.indexOf('aria-labelledby="site-cross-sell"'), out.indexOf('aria-labelledby="site-close"'));
    for (const href of ["/product/records", "/product/compliance", "/product/search"]) assert.match(cross, new RegExp(`href="${href}"`), href);
    assert.doesNotMatch(t, /undefined|NaN|\[object/);
  });

  it("every tour demo has its pause button; the phone's stacked list names the same three", () => {
    for (const key of [SOURCING_KEY, COMPLIANCE_TEAMS_KEY]) {
      const out = page(key);
      // The pinned box draws one demo and the stacked list three, plus the cross-sell's three loops.
      assert.equal((out.match(/aria-label="Pause demo"/g) ?? []).length, 7, key);
      assert.equal((out.match(/<h3 class="flex items-center gap-3/g) ?? []).length, 3, key);
    }
  });
});

describe("the compliance page in the home's frame (M4, handoff-mercury-m4-onward.md §4.2)", () => {
  it("opens on the Watch demo, not a screenshot; the four moments follow; the needs-attention row plays the expiry vignette; UFLPA keeps its screen", () => {
    const out = page(COMPLIANCE_KEY);
    const hero = out.slice(0, out.indexOf("<h2"));
    assert.match(hero, /<h1[^>]*>Know before a certificate expires\.<\/h1>/);
    assert.match(hero, /saved suppliers checked against the UFLPA Entity List/);
    assert.doesNotMatch(out, /comp-expiry\.png|compliance-hub\.png/);
    assert.match(out, /comp-uflpa\.png/);
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
    const tones = [...out.matchAll(/data-tone="(photo|dark|paper)"/g)].map((m) => m[1]).slice(1);
    assert.deepEqual(tones, ["paper", "dark"]);
    const pauses = (out.match(/aria-label="Pause demo"/g) ?? []).length;
    assert.equal(pauses, 9, "the hero, the four moments, the expiry vignette and the cross-sell's three loops");
    assert.ok((text(out).match(new RegExp(`${CAPTION}|${SAMPLE_CAPTION}`.replace(/[.*+?^${}()[\]\\]/g, "\\$&"), "g")) ?? []).length >= pauses);
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
