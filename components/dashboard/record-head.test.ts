// The founder's video of 29 Sep 2026, PR 5 (hand-off
// `context/feature-specs/handoff-dashboard-video-29sep.md`): the record.
//
//  1. Each source once in the head: the facts line is plain, the marks row
//     holds every source. No fact is dropped.
//  2. Fewer words: the empty-case reasons move to hover, the action bar's
//     sentence about marks goes, the product photos carry "illustration"
//     each instead of a caption under them.
//  3. The Products figures are rows, not four boxes.
//  4. No stripes: the locked card is the plain locked ground.
//  5. Source pending is SourceBD's own mark, not a dashed square.
//  6. Product photos are a list: a 40px photo, the code, the name.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildSheet } from "@/lib/dashboard/build-models";
import { aboniInput } from "@/lib/dashboard/fixtures";
import { light } from "@/lib/design/tokens";
import { PhotoList } from "./photo-tiles";
import { PendingMark, Stats } from "./sheet";
import { SupplierSheet } from "./supplier-sheet";

const source = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
const model = buildSheet(aboniInput());
const html = renderToStaticMarkup(createElement(SupplierSheet, { model }));
const head = html.slice(html.indexOf("<h1"), html.indexOf('aria-label="Record sections"'));

describe("1. each source once in the head", () => {
  it("the facts line carries no marks, and every source is one square in the marks row", () => {
    assert.ok(model.meta.some((f) => f.mark), "guard: this record has facts with a source of their own");
    for (const f of model.meta) assert.ok(head.includes(f.text.replace(/&/g, "&amp;")), `a fact left the head: ${f.text}`);
    // Every square names itself "Source: <name>, <tier>…".
    const named = [...head.matchAll(/aria-label="Source: ([^,"]+),/g)].map((m) => m[1]);
    assert.ok(named.length >= model.marks.length, "guard: the row draws the record's marks");
    assert.equal(new Set(named).size, named.length, `a source is drawn twice in the head: ${named.join(", ")}`);
    assert.match(source("components/dashboard/supplier-sheet.tsx"), /<MetaLine facts=\{model\.meta\} inRow=\{new Set\(model\.marks\.map\(\(m\) => m\.code\)\)\} \/>/);
  });

  it("a fact whose source is not in the row keeps its mark, so the head still says where it came from", () => {
    const fact = model.meta.find((f) => f.mark)!;
    const lone = { ...model, marks: model.marks.filter((m) => m.code !== fact.mark!.code) };
    const out = renderToStaticMarkup(createElement(SupplierSheet, { model: lone }));
    const h = out.slice(out.indexOf("<h1"), out.indexOf('aria-label="Record sections"'));
    assert.ok(h.includes(`aria-label="Source: ${fact.mark!.name},`), `${fact.text} lost its only mark`);
  });
});

describe("2–3. fewer words, figures as rows", () => {
  it("an empty figure is a dash with its reason on hover, on a tap and to a screen reader", () => {
    const out = renderToStaticMarkup(createElement(Stats, { items: [{ key: "Buyer lists", value: "—", sub: "not on 4 brand lists read" }, { key: "HS lines", value: "12", sub: "EPB" }] }));
    assert.match(out, /<dl\b/);
    // PR D of the names hand-off: the dash is a toggle, so a phone can read it.
    assert.match(out, /<summary aria-label="Why Buyer lists is empty" title="not on 4 brand lists read"[^>]*><span[^>]*>—<\/span><\/summary><span role="note"[^>]*>not on 4 brand lists read<\/span>/);
    assert.match(out, />12<\/span><span[^>]*>EPB<\/span>/, "a figure keeps its short note");
    assert.doesNotMatch(out, /rounded-md bg-canvas/, "the four boxes are back");
  });

  it("the action bar says nothing about the marks, and no caption sits under the photos", () => {
    assert.doesNotMatch(html, /Source marks link to|Every source mark links/);
    assert.doesNotMatch(html, /Illustrative photo, keyed to the HS code|supplier-attested upload replaces it/);
    assert.doesNotMatch(html, /items on file · source pending/);
  });
});

describe("4. no stripes", () => {
  it("the locked card is the plain locked ground; the pattern and its token are gone", () => {
    assert.match(html, /data-locked="true" class="[^"]*\bbg-locked\b/);
    assert.doesNotMatch(source("app/ds.css"), /locked-pattern|locked-stripe/);
    assert.equal((light.locked as Record<string, string>).stripe, undefined);
  });
});

describe("5. source pending is SourceBD's own mark", () => {
  it("a document with a clock, named, the full words on hover", () => {
    const out = renderToStaticMarkup(createElement(PendingMark));
    assert.match(out, /^<span title="Source pending: [^"]+" class="[^"]*"><svg[^>]*role="img"[^>]*aria-label="Source pending"/);
    assert.doesNotMatch(out, /border-dashed/);
  });
});

describe("6. product photos as a list", () => {
  it("each line: a 40px photo tagged as an illustration, the code, the name, a link to the line", () => {
    const tiles = [
      { hs: "6105", short: "Men's knit shirts", src: "/products/hs/6105.webp", thumb: "/products/hs/6105-128.webp" },
      { hs: "6117", short: "Other knit accessories", src: null, thumb: null },
    ];
    const out = renderToStaticMarkup(createElement(PhotoList, { tiles, lineHref: (hs: string) => `/app/suppliers/x/lines/${hs}` }));
    assert.equal((out.match(/<li\b/g) ?? []).length, 2);
    assert.match(out, /href="\/app\/suppliers\/x\/lines\/6105"[^>]*>[\s\S]*?size-10[\s\S]*?src="\/products\/hs\/6105-128\.webp"[\s\S]*?>6105<[\s\S]*?>illustration<[\s\S]*?>Men&#x27;s knit shirts</);
    const noPhoto = out.slice(out.indexOf("lines/6117"));
    assert.doesNotMatch(noPhoto.slice(0, noPhoto.indexOf("</li>")), /illustration/, "no photo, no illustration tag");
    assert.match(html, /data-photo-list="true"/, "the record draws the list");
  });
});
