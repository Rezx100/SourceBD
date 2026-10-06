// The legal pages (B9f): five pages in one frame, each notice's own words untouched, the day it was last updated,
// the active page marked, and no old-kit colour left in them.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const PAGES = ["privacy", "terms", "cookies", "data-sources", "trademarks"] as const;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const load = (slug: string) => (require(`@/app/(marketing)/legal/${slug}/page`) as { default: () => ReactElement }).default;
const html = (slug: string) => draw(createElement(load(slug)));

describe("the legal pages", () => {
  it("each one is in the frame, lists all five pages, and marks its own", () => {
    for (const slug of PAGES) {
      const m = html(slug);
      assert.match(m, /<nav aria-label="Legal"/, slug);
      for (const href of PAGES.map((p) => `/legal/${p}`)) assert.match(m, new RegExp(`href="${href}"`), `${slug} lists ${href}`);
      assert.equal((m.match(/aria-current="page"/g) ?? []).length, 1, slug);
      const mine = [...m.matchAll(/<a\b[^>]*>/g)].map((x) => x[0]).find((a) => a.includes('aria-current="page"'))!;
      assert.ok(mine.includes(`href="/legal/${slug}"`), `${slug}: ${mine}`);
      assert.equal((m.match(/<h1/g) ?? []).length, 1, slug);
    }
  });

  it("the four notices say when they were last updated, in words", () => {
    for (const slug of ["terms", "cookies", "data-sources"]) assert.match(text(html(slug)), /Last updated 3 Jun 2026/, slug);
    // Privacy section 5 was reworded on 6 Oct 2026 (sub-processors, one list with the Security page).
    assert.match(text(html("privacy")), /Last updated 6 Oct 2026/);
  });

  it("the privacy notice keeps its sentinels and its numbered sections", () => {
    const t = text(html("privacy"));
    assert.match(t, /registration number Pending registration/);
    assert.match(t, /Name: Pending appointment/);
    for (const n of ["1. Who we are", "5. Sharing", "10. Changes"]) assert.match(t, new RegExp(n));
  });

  it("the cookie table is still a table", () => {
    const m = html("cookies");
    assert.match(m, /<table/);
    assert.match(m, /<code>sb-\*-auth-token<\/code>/);
  });

  it("the trademark notice is the verbatim text the smoke harness slices out of the logo lock", () => {
    assert.match(text(html("trademarks")), /All third-party trademarks shown on supplier profiles belong to their respective owners and are used solely to identify the source of publicly available data\. SourceBD is not affiliated with, endorsed by, or sponsored by any of these organisations\./);
  });

  it("no legal page types a colour or uses the old kit", () => {
    for (const slug of PAGES) {
      const src = readFileSync(join(process.cwd(), "app", "(marketing)", "legal", slug, "page.tsx"), "utf8");
      assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b|BlurFade|proto-card|text-ink-primary|text-accent-/, slug);
    }
  });
});
