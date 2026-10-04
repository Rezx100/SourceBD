// HS codes (B7a-3) at the boundary: the words (chapters, the open one, sorts, the addresses) and the route
// over a fake Supabase client: the chapter grid and the open chapter's table, the phone's list, a search,
// a chapter that does not exist, an empty catalogue, and a failed read that is an error and never
// "No HS codes".

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CHAPTER_NAMES, PRIMARY, buildChapters, caption, chapterName, groupTitle, headingsHref, openChapter, parseSort, searchCaption, sortHeadings, splitChapters, suppliersWord, type Heading } from "./words";

const H = (hs: string, exporters: number, label: string | null = null): Heading => ({ hs, label, exporters });
const ROWS = [H("6105", 1634, "Men's shirts, knitted"), H("6101", 1520, "Men's coats and jackets, knitted"), H("6109", 1763, "T-shirts and vests"), H("6203", 1711), H("6302", 54), H("4202", 700), H("4901", 12)];

describe("the words", () => {
  it("groups headings into chapters by their first two digits, chapters and headings by code", () => {
    const ch = buildChapters(ROWS);
    assert.deepEqual(ch.map((c) => [c.code, c.headings.length]), [["42", 1], ["49", 1], ["61", 3], ["62", 1], ["63", 1]]);
    assert.deepEqual(ch.find((c) => c.code === "61")!.headings.map((h) => h.hs), ["6101", "6105", "6109"]);
  });

  it("names Paper's eleven chapters, and any other by its number", () => {
    assert.equal(PRIMARY.length, 11);
    assert.ok(PRIMARY.every((c) => CHAPTER_NAMES[c]));
    assert.equal(chapterName("61"), "Knitted clothing");
    assert.equal(chapterName("49"), "Chapter 49");
  });

  it("lists Paper's chapters first, in Paper's order, and folds the rest into 'more'", () => {
    const { primary, more } = splitChapters(buildChapters(ROWS));
    assert.deepEqual(primary.map((c) => c.code), ["61", "62", "63", "42"]);
    assert.deepEqual(more.map((c) => c.code), ["49"]);
    assert.equal(groupTitle(4), "Clothing and textiles · 4 chapters");
    assert.equal(groupTitle(1), "Clothing and textiles · 1 chapter");
  });

  it("opens the chapter asked for; else the first of Paper's list; else the first there is", () => {
    const ch = buildChapters(ROWS);
    assert.equal(openChapter(ch, "62"), "62");
    assert.equal(openChapter(ch, "99"), "61");
    assert.equal(openChapter(ch, undefined), "61");
    assert.equal(openChapter(ch, ["63", "x"]), "63");
    assert.equal(openChapter(buildChapters([H("4901", 1)]), "61"), "49");
    assert.equal(openChapter([], "61"), null);
  });

  it("sorts by code, or by who exports most with the code as the tie-break", () => {
    assert.deepEqual(sortHeadings(ROWS.slice(0, 3), "code").map((h) => h.hs), ["6101", "6105", "6109"]);
    assert.deepEqual(sortHeadings(ROWS.slice(0, 3), "suppliers").map((h) => h.hs), ["6109", "6105", "6101"]);
    assert.equal(parseSort("suppliers"), "suppliers");
    assert.equal(parseSort("nonsense"), "code");
  });

  it("says its counts in words, and what they leave out", () => {
    assert.equal(suppliersWord(1520), "1,520 suppliers");
    assert.equal(suppliersWord(1), "1 supplier");
    assert.match(caption({ headings: 210, chapters: 46 }), /^210 headings in 46 chapters · exporter counts leave out sanctioned suppliers, as the search does$/);
    assert.match(searchCaption(1), /^1 heading match · exporter counts leave out sanctioned suppliers/);
  });

  it("the address carries the chapter, the sort and 'more', and nothing that is the default", () => {
    assert.equal(headingsHref({}), "/app/headings");
    assert.equal(headingsHref({ chapter: "61", sort: "code" }), "/app/headings?chapter=61");
    assert.equal(headingsHref({ chapter: "61", sort: "suppliers", more: true }), "/app/headings?chapter=61&sort=suppliers&more=1");
  });
});

// ---------------------------------------------------------------------------
// The route, over a fake `@/lib/supabase/server` installed before it loads.
// ---------------------------------------------------------------------------

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
type Rpc = { data: unknown; error: { message: string } | null };
let answer: Rpc = { data: [], error: null };
let calls: string[] = [];
{
  const id = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  const client = { rpc: async (fn: string) => (calls.push(fn), answer) };
  require.cache[id] = { id, filename: id, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the route module loads.
const Page = () => require(path.join(OUT, "app/(app)/app/headings/page.js")).default as (props: unknown) => Promise<ReactElement>;
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const page = async (sp: Record<string, string> = {}) => plain(renderToStaticMarkup(await Page()({ searchParams: Promise.resolve(sp) })));
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const CATALOGUE: Rpc = {
  data: [
    { hs: "6109", heading: null, exporter_count: 1763 },
    { hs: "6105", heading: null, exporter_count: 1634 },
    { hs: "6203", heading: null, exporter_count: 1711 },
    { hs: "6302", heading: null, exporter_count: 54 },
    { hs: "9999", heading: null, exporter_count: 2 },
    { hs: "4202", heading: null, exporter_count: 700 },
  ],
  error: null,
};

describe("/app/headings", () => {
  it("reads hs_catalogue once and draws the chapters with the first listed one open", async () => {
    answer = CATALOGUE;
    calls = [];
    const out = await page();
    assert.deepEqual(calls, ["hs_catalogue"]);
    const t = text(out);
    assert.equal(out.match(/<h1\b/g)?.length, 1);
    assert.match(out, /<h1[^>]*>HS codes<\/h1>/);
    assert.match(t, /6 headings in 5 chapters · exporter counts leave out sanctioned suppliers, as the search does/);
    assert.match(t, /Clothing and textiles · 4 chapters/);
    for (const c of ["Knitted clothing", "Woven clothing", "Home textiles", "Bags and leather goods"]) assert.ok(t.includes(c), c);
    assert.match(t, /1 more chapter/, "chapter 99 is folded into 'more'");
    assert.match(out, /aria-current="true"[^>]*>[\s\S]*?Knitted clothing/, "chapter 61 is the open one");
    assert.match(t, /61 Knitted clothing · 2 headings/);
    assert.match(out, /role="region"|aria-label="HS headings"/);
  });

  it("never prints the code twice: a heading without a buyer label takes the catalogue's, else the code alone", async () => {
    answer = CATALOGUE;
    const t = text(await page({ chapter: "63" }));
    assert.match(t, /6302/);
    assert.doesNotMatch(t, /HS 6302|HS 9999|9999 HS/);
    assert.match(text(await page({ chapter: "61" })), /6109 T-shirts/);
  });

  it("each heading opens the search filtered to it, and the table says who exports it", async () => {
    answer = CATALOGUE;
    const out = await page({ chapter: "61" });
    assert.ok(out.includes('href="/app/discover?hs=6109"'));
    assert.match(text(out), /1,763 suppliers/);
    assert.match(out, /Search them/);
  });

  it("?sort=suppliers puts the most exported first", async () => {
    answer = CATALOGUE;
    const out = await page({ chapter: "61", sort: "suppliers" });
    assert.ok(out.indexOf("6109") < out.indexOf("6105"), "6109 (1,763) before 6105 (1,634)");
    assert.match(out, /<a[^>]*aria-current="page"[^>]*>Most suppliers</, "the second sort is the current one");
  });

  it("a chapter that does not exist opens the first one, not an error", async () => {
    answer = CATALOGUE;
    assert.match(text(await page({ chapter: "77" })), /61 Knitted clothing/);
  });

  it("?more=1 draws every other chapter as a card", async () => {
    answer = CATALOGUE;
    const t = text(await page({ more: "1" }));
    assert.match(t, /Chapter 99/);
    assert.doesNotMatch(t, /1 more chapter/);
  });

  it("a search lists the matching headings across chapters; no match says so", async () => {
    answer = CATALOGUE;
    const out = await page({ q: "t-shirts" });
    assert.match(text(out), /1 heading match/);
    assert.match(text(out), /6109/);
    assert.doesNotMatch(text(out), /6203/);
    assert.match(out, /placeholder="Search headings"/);
    assert.match(out, /action="\/app\/headings"/);
    const none = text(await page({ q: "zzz" }));
    assert.match(none, /No heading matches that search/);
    assert.match(none, /Show every chapter/);
  });

  it("an empty catalogue says there is nothing yet, and still names what its counts leave out", async () => {
    answer = { data: [], error: null };
    const out = await page();
    const t = text(out);
    assert.match(t, /No HS codes to show yet/);
    assert.match(t, /exporter counts leave out sanctioned suppliers/);
    assert.doesNotMatch(out, /role="alert"/);
  });

  it("a failed read is an error with Try again, never the empty state", async () => {
    answer = { data: null, error: { message: "boom" } };
    const out = await page({ chapter: "61", sort: "suppliers" });
    const t = text(out);
    assert.match(out, /role="alert"/);
    assert.match(t, /We couldn't load the HS codes\./);
    assert.match(t, /Exporter counts could not be read/);
    assert.ok(out.includes('href="/app/headings?sort=suppliers"'));
    assert.doesNotMatch(t, /No HS codes to show yet|No heading matches/);
  });

  it("the loading state is in the content region", () => {
    assert.ok(existsSync(path.join(process.cwd(), "app", "(app)", "app", "headings", "loading.tsx")));
    void createElement;
  });
});
