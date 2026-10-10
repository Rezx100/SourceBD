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
    assert.match(text(html("cookies")), /Last updated 3 Jun 2026/);
    // Privacy (section 5, and the Stripe billing line gone) and Terms (no Stripe) were reworded on 6 Oct 2026;
    // Data sources gained section 8, the open data behind the home page's map, the same day, and said on 7 Oct
    // 2026 what the city's blocks are when the map became a city, and on 11 Oct 2026 gained section 9.
    for (const slug of ["privacy", "terms"]) assert.match(text(html(slug)), /Last updated 6 Oct 2026/, slug);
    assert.match(text(html("data-sources")), /Last updated 11 Oct 2026/);
  });

  it("the data sources page names the customs records' provider, which the supplier profile does not (founder, 11 Oct 2026)", () => {
    const page = text(html("data-sources"));
    assert.match(page, /9\. Customs shipment records/);
    assert.match(page, /from Volza ?, a trade data provider, and are a Tier 6 cross-check source/);
    assert.match(page, /paid plans only, never on public pages or in any export/);
    assert.match(page, /deleted one year after we fetched it/);
  });

  it("no legal page names a payment company: none is chosen yet and the beta is free", () => {
    for (const slug of PAGES) assert.doesNotMatch(text(html(slug)), /Stripe|PayPal|Paddle|Braintree/i, slug);
  });

  it("the privacy notice keeps its sentinels and its numbered sections", () => {
    const t = text(html("privacy"));
    assert.match(t, /registration number Pending registration/);
    assert.match(t, /Name: Pending appointment/);
    for (const n of ["1. Who we are", "5. Sharing", "9. Moderation, safety and legal requests", "10. Supplier records", "11. Changes"]) assert.match(t, new RegExp(n));
  });

  it("the 6 Oct 2026 notice: the record, 7 years and legal holds, staff reading for safety, with the effective day (moderation plan 0a)", () => {
    const p = text(html("privacy"));
    assert.match(p, /Activity record \(from 5 November 2026\)/);
    assert.match(p, /IP address and the browser or device/);
    assert.match(p, /kept for 7 years after your account closes/);
    assert.match(p, /legal hold/);
    assert.match(p, /staff may open and read RFQs, quotes, messages and attached files/);
    assert.match(p, /take effect on 5 November 2026/);
    const t = text(html("terms"));
    assert.match(t, /the agreed record of what was sent, offered, accepted, changed and done/);
    assert.match(t, /7\. Moderation and enforcement/);
    for (const step of ["warning", "restriction", "suspension", "ban"]) assert.match(t, new RegExp(step));
    assert.match(t, /appeal any step once/);
    assert.match(t, /12\. Contact/);
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
