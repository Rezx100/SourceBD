// The Mercury home page as a visitor gets it: the board's copy section by section, in the board's order (the phone
// draws the same tree, so the order is one), every link a route of the site, no "undefined", no score, and the
// figures only when they were read.

import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NO_FACTS, parseFacts, type SiteFacts } from "@/lib/site-facts";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const { HomeMercury } = require("@/components/site/home/index") as typeof import("@/components/site/home/index");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
const { PRODUCT_GROUPS } = require("@/components/site/map") as typeof import("@/components/site/map");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
const { Announcement } = require("@/components/site/home/announcement") as typeof import("@/components/site/home/announcement");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
const { FOOT } = require("@/components/site/home/footer") as typeof import("@/components/site/home/footer");

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const LIVE = parseFacts({ suppliers_indexed: 10278, last_refreshed_at: "2026-10-09T00:00:00Z" }, { sources_listed: 21, sources_with_records: 14, certificates_on_file: 4289, latest_read: "2026-10-09" });
const page = (facts: SiteFacts = LIVE) => draw(createElement(HomeMercury, { facts, year: 2026 }));

/** Whether the app serves a page at `href`: route groups `(x)` are see-through, `[slug]` takes any segment. */
function routeExists(href: string, dir = join(process.cwd(), "app"), segs = href.split(/[?#]/)[0]!.split("/").filter(Boolean)): boolean {
  if (!segs.length && existsSync(join(dir, "page.tsx"))) return true;
  return readdirSync(dir, { withFileTypes: true }).some((d) => {
    if (!d.isDirectory()) return false;
    if (/^\(.+\)$/.test(d.name)) return routeExists(href, join(dir, d.name), segs);
    if (!segs.length) return false;
    return (d.name === segs[0] || /^\[[^.].*\]$/.test(d.name)) && routeExists(href, join(dir, d.name), segs.slice(1));
  });
}

describe("the Mercury home page", () => {
  it("opens with the board's headline, the live published count and the two ways in", () => {
    const out = page();
    assert.match(out, /<h1[^>]*>Bangladesh sourcing,<br\/>on the record\.<\/h1>/);
    assert.match(text(out), /Search 10,278 verified garment suppliers\. Every fact on a record names the public register it came from and the day we read it\./);
    assert.match(out, /<form [^>]*action="\/signup" method="get"/);
    assert.match(out, /href="\/suppliers\/aboni-knitwear"[^>]*>See a real record/);
    assert.match(text(out), /Search is free\. No card needed\. Suppliers claim their record at no cost\./);
  });

  it("without a read count the lede says the same thing with no number", () => {
    const t = text(page(NO_FACTS));
    assert.match(t, /Search verified Bangladesh garment suppliers\./);
    assert.doesNotMatch(t, /undefined|null|NaN/);
  });

  it("draws the sections in the board's order", () => {
    const t = text(page());
    const order = [
      "Bangladesh sourcing,",
      "Read from the registers that matter",
      "Everything you do to vet a factory.",
      "Vetting used to be a chase.",
      "Shortlist. Ask once. Compare.",
      "Quotes beside the facts.",
      "The list changes. We check again.",
      "Search, and never lose your place.",
      "Every message beside its RFQ.",
      "Start in a minute.",
      "Everything else a sourcing desk needs.",
      "Receipts, not opinions.",
      "Your record is already here.",
      "Three things we never do.",
      "Questions buyers ask.",
      "Sourcing, rebuilt from the register up.",
      "Verified Bangladesh garment suppliers, every fact with its receipt.",
    ];
    let at = -1;
    for (const s of order) {
      const i = t.indexOf(s, at + 1);
      assert.ok(i > at, `"${s}" comes after the one before it`);
      at = i;
    }
  });

  it("frames only the marks the logos lock allows, with the code under each", () => {
    const out = page();
    for (const c of ["EPB", "RSC", "BGMEA", "BKMEA", "BTMA", "BGAPMEA", "GOTS", "OEKO-TEX", "WRAP"]) assert.match(out, new RegExp(`>${c}</span>`), c);
    assert.doesNotMatch(out, /bepza|dife/i);
  });

  it("every screen says what it shows, and every backdrop is decoration", () => {
    const out = page();
    for (const img of out.match(/<img [^>]*>/g) ?? []) {
      if (/\/site\/home\/screen-/.test(img)) assert.match(img, /alt="[^"]{12,}"/, img);
      else if (/\/site\/home\//.test(img)) assert.match(img, /alt=""/, img);
    }
    assert.match(out, /alt="SourceBD search results[^"]*"[^>]*fetchPriority="high"|fetchPriority="high"[^>]*alt="SourceBD search results/);
  });

  it("every link on the page and in its footer is a route of the site", () => {
    const hrefs = [...page().matchAll(/href="([^"]+)"/g)].map((m) => m[1]!).filter((h) => h.startsWith("/") && !h.startsWith("/site/") && !h.startsWith("/icons/"));
    assert.ok(hrefs.length > 20);
    for (const h of new Set(hrefs)) assert.ok(routeExists(h), h);
    for (const [, links] of FOOT) for (const [label, h] of links) assert.ok(routeExists(h), `${label} → ${h}`);
  });

  it("the nav's Product menu is the board's four groups, every item a route of the site", () => {
    assert.deepEqual(PRODUCT_GROUPS.map((g) => g.title), ["Find", "Check", "Ask", "Watch"]);
    for (const i of PRODUCT_GROUPS.flatMap((g) => g.items)) assert.ok(routeExists(i.href), `${i.title} → ${i.href}`);
    assert.ok(!routeExists("/no-such-page") && !routeExists("/app/no-such-page"), "the check can fail");
  });

  it("never scores: no grade, rating or star is claimed, and the only score word is the promise not to", () => {
    const t = text(page());
    assert.doesNotMatch(t, /\bSBI\b|★|\b\d(\.\d)?\s?\/\s?(5|10)\b/);
    // Each "score" is the promise: a no, never or not stands just before it ("Three things we never do. Score a supplier").
    // A buyer's question ("Do you score or rank suppliers?") is asked, not claimed.
    for (const m of t.matchAll(/scor/gi)) {
      const around = t.slice(Math.max(0, m.index - 40), m.index + 40);
      assert.ok(/\b(no|never|not)\b/i.test(t.slice(Math.max(0, m.index - 40), m.index)) || /^[^.]*\?/.test(t.slice(m.index)), around);
    }
  });

  it("keeps green for the wordmark, the primary buttons and the icons' one detail: no green link", () => {
    for (const a of page().match(/<a [^>]*>/g) ?? []) if (/text-brand\b/.test(a)) assert.match(a, /href="\/"/, a);
  });

  it("the announcement links to the Compliance hub, and stays off the film when the film is asked for", () => {
    const bar = (qs: string) => draw(createElement(SearchParamsContext.Provider, { value: new URLSearchParams(qs) as never }, createElement(Announcement)));
    assert.match(text(bar("")), /UFLPA and sanctions checks now run on every saved supplier See the Compliance hub/);
    assert.match(bar(""), /href="\/compliance"/);
    assert.match(bar(""), /aria-label="Dismiss announcement"/);
    assert.equal(bar("film=1"), "");
  });
});
