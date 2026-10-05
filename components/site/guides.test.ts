// The compliance guides (B9f): the index lists the five laws with their review date, each article keeps its words,
// its section order, its sources and an "On this page" list that points at real sections, and nothing about it is
// a clearance, a score or legal advice.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { COMPLIANCE_PAGES, DISCLAIMER, SECTION_ORDER } from "@/lib/marketing/compliance-pages";

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const G = require("@/components/site/guides") as typeof import("@/components/site/guides");

describe("the compliance guides index", () => {
  const html = draw(createElement(G.GuidesIndex));
  it("lists the five laws, each linking to its guide, with the day it was last reviewed", () => {
    assert.equal(COMPLIANCE_PAGES.length, 5);
    for (const p of COMPLIANCE_PAGES) {
      assert.match(html, new RegExp(`href="/compliance/${p.slug}"`), p.slug);
      assert.match(text(html), new RegExp(p.shortName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), p.slug);
    }
    assert.equal((html.match(/Read the guide/g) ?? []).length, 5);
    assert.match(text(html), /5 guides · not legal advice · all last reviewed 1 Jun 2026/);
    assert.match(text(html), new RegExp(DISCLAIMER.slice(0, 40)));
  });
});

describe("a compliance guide", () => {
  for (const page of COMPLIANCE_PAGES) {
    it(`${page.slug}: its words, section order and sources are the data's`, () => {
      const html = draw(createElement(G.GuideArticle, { page }));
      const t = text(html);
      assert.equal((html.match(/<h1/g) ?? []).length, 1);
      assert.match(t, new RegExp(page.title.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      const at = SECTION_ORDER.map((h) => html.indexOf(`>${h}</h2>`)).filter((i) => i >= 0);
      assert.ok(at.length >= 4, "the sections are there");
      assert.deepEqual([...at].sort((a, b) => a - b), at, "in the fixed order");
      assert.match(t, new RegExp(page.sections[0]!.body[0]!.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      for (const r of page.references) assert.ok(html.includes(`href="${r.url.replace(/&/g, "&")}"`), r.url);
      assert.match(t, new RegExp(`${page.references.length} sources`));
      assert.match(html, /rel="noopener noreferrer external"/);
    });

    it(`${page.slug}: every "On this page" link points at a section that exists`, () => {
      const html = draw(createElement(G.GuideArticle, { page }));
      const nav = /<nav aria-label="On this page"[\s\S]*?<\/nav>/.exec(html)![0];
      const ids = [...nav.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]!);
      assert.ok(ids.length >= 5);
      for (const id of ids) assert.match(html, new RegExp(`<section[^>]*id="${id}"`), id);
    });
  }

  it("never says a supplier is cleared", () => {
    for (const page of COMPLIANCE_PAGES) assert.doesNotMatch(text(draw(createElement(G.GuideArticle, { page }))), /\bcleared by SourceBD\b|SourceBD clears|certified compliant/i);
  });

  it("no loading boundary sits above the guides, so an unknown guide is a real 404", () => {
    for (const dir of ["app/(marketing)", "app/(marketing)/compliance", "app/(marketing)/compliance/[slug]"]) assert.ok(!existsSync(join(process.cwd(), dir, "loading.tsx")), dir);
  });
});
