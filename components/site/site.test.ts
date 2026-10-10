// The site's frame (B9a): the consent cookie, the facts the footer prints, the navigation, the mega footer and the
// cookie banner. The pages inside the frame are the next PRs'.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CONSENT_COOKIE, consentCookie, parseConsent, readConsent, serializeConsent } from "@/lib/consent";
import { NO_FACTS, factsLine, parseFacts, readDay, withCommas } from "@/lib/site-facts";

const currentPath = "/";
{
  const navId = require.resolve("next/navigation");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const realNav = require("next/navigation");
  require.cache[navId] = { id: navId, filename: navId, loaded: true, children: [], paths: [], exports: { ...realNav, usePathname: () => currentPath, useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }) } } as unknown as NodeJS.Module;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- after the stub.
const site = () => ({ nav: require("@/components/site/nav") as typeof import("@/components/site/nav"), footer: require("@/components/site/footer") as typeof import("@/components/site/footer"), banner: require("@/components/site/cookie-banner") as typeof import("@/components/site/cookie-banner"), map: require("@/components/site/map") as typeof import("@/components/site/map") });
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("consent", () => {
  it("is one cookie: page counts are on only after a yes, and anything else is no choice yet", () => {
    assert.deepEqual(parseConsent("v1.analytics=1"), { v: 1, analytics: true });
    assert.deepEqual(parseConsent("v1.analytics=0"), { v: 1, analytics: false });
    for (const bad of ["", null, undefined, "v1.analytics=2", "analytics=1", "v2.analytics=1", "true"]) assert.equal(parseConsent(bad as string), null, String(bad));
    assert.equal(serializeConsent({ v: 1, analytics: true }), "v1.analytics=1");
  });

  it("reads it out of document.cookie among others, and sets it lax, site-wide, six months, secure on https", () => {
    assert.deepEqual(readConsent(`a=b; ${CONSENT_COOKIE}=v1.analytics=1; c=d`), { v: 1, analytics: true });
    assert.equal(readConsent("a=b; c=d"), null);
    const c = consentCookie({ v: 1, analytics: false }, true);
    assert.match(c, /^sbd_consent=v1\.analytics=0; Max-Age=\d+; Path=\/; SameSite=Lax; Secure$/);
    assert.doesNotMatch(consentCookie({ v: 1, analytics: false }, false), /Secure/);
    assert.ok(Number(/Max-Age=(\d+)/.exec(c)![1]) <= 60 * 60 * 24 * 183, "no longer than six months");
  });
});

describe("the live facts", () => {
  const STATS = { suppliers_indexed: 10268, last_refreshed_at: "2026-10-02T05:48:07.991292+00:00" };
  const FACTS = { suppliers_published: 10268, sources_listed: 25, sources_with_records: 14, certificates_on_file: 4275, certificates_expired: 518, rsc_records: 2331, latest_read: "2026-10-02T05:48:07+00:00", sources: [{ code: "RSC", tier: "tier1_gov", records: 2331, suppliers: 2256, latest: "2026-10-02" }, { code: "BEPZA", tier: "tier1_gov", records: 0, suppliers: 0, latest: null }] };

  it("both reads give every figure; the footer's line is Paper's", () => {
    const f = parseFacts(STATS, FACTS);
    assert.equal(f.sourcesListed, 25);
    assert.equal(f.sourcesWithRecords, 14);
    assert.equal(f.certificatesExpired, 518);
    assert.equal(f.sources?.length, 2);
    assert.equal(factsLine(f), "10,268 suppliers · 25 sources listed · 14 hold supplier records · updated 2 Oct 2026");
  });

  it("before 0117, only the stats read: fewer figures, never a stale or typed one", () => {
    const f = parseFacts(STATS, null);
    assert.equal(f.sourcesListed, null);
    assert.equal(f.sources, null);
    assert.equal(factsLine(f), "10,268 suppliers · updated 2 Oct 2026");
  });

  it("nothing read is no line at all, never '0 suppliers'", () => {
    assert.equal(factsLine(NO_FACTS), null);
    assert.equal(factsLine(parseFacts(null, null)), null);
    assert.equal(factsLine(parseFacts({ suppliers_indexed: "x" }, { sources_listed: -1 })), null);
  });

  it("a source list with a row that is not the shape is not a list", () => {
    assert.equal(parseFacts(STATS, { ...FACTS, sources: [{ code: "RSC" }] }).sources, null);
    assert.equal(parseFacts(STATS, { ...FACTS, sources: "x" }).sources, null);
  });

  it("days and counts are written the way the product writes them", () => {
    assert.equal(readDay("2026-10-03"), "3 Oct 2026");
    assert.equal(readDay(null), null);
    assert.equal(withCommas(10268), "10,268");
  });
});

describe("the navigation", () => {
  it("the wordmark, three menus, Pricing, Sign in, Book a demo and Start free: every one a real link or button", () => {
    const out = draw(createElement(site().nav.SiteNav));
    const t = text(out);
    for (const w of ["SourceBD", "Product", "Solutions", "Resources", "Pricing", "Sign in", "Book a demo", "Start free"]) assert.match(t, new RegExp(w));
    assert.match(out, /href="\/signup"[^>]*>Start free/);
    assert.match(out, /href="\/pricing"/);
    assert.match(out, /href="\/login"/);
    assert.equal((out.match(/aria-expanded="false"/g) ?? []).length, 3, "three menus, all closed until asked");
    assert.match(out, /aria-label="Menu"/);
  });

  it("the menus are the site map: four product pages with Paper's lines, two solutions, the resources", () => {
    const { PRODUCT, SOLUTIONS, RESOURCES } = site().map;
    assert.deepEqual(PRODUCT.map((p) => p.title), ["Supplier search", "Supplier records", "RFQs and messages", "Compliance"]);
    assert.equal(PRODUCT[2]!.body, "Send one RFQ to up to 50 suppliers.");
    assert.deepEqual(SOLUTIONS.map((s) => s.title), ["Sourcing teams", "Compliance teams"]);
    for (const i of [...PRODUCT, ...SOLUTIONS, ...RESOURCES]) assert.match(i.href, /^\/[a-z]/, i.title);
  });
});

describe("the mega footer", () => {
  it("six columns, the live line, the promise, and Cookie settings", () => {
    const f = parseFacts({ suppliers_indexed: 10268, last_refreshed_at: "2026-10-02T05:48:07Z" }, { sources_listed: 25, sources_with_records: 14 });
    const out = draw(createElement(site().footer.SiteFooter, { facts: f, year: 2026 }));
    const t = text(out);
    for (const h of ["Product", "Data & methodology", "Compliance guides", "Company", "Legal", "Status"]) assert.match(t, new RegExp(h));
    assert.match(t, /10,268 suppliers · 25 sources listed · 14 hold supplier records · updated 2 Oct 2026/);
    assert.match(t, /The 25 sources/);
    assert.match(t, /© 2026 SourceBD\. No scores\. No paid placement\. No fact without a source and a date\./);
    assert.match(t, /Cookie settings/);
    assert.match(out, /href="\/compliance\/uk-msa"/);
    assert.match(out, /href="\/legal\/cookies"/);
    assert.match(t, /Last register read 2 Oct 2026/);
  });

  it("without facts it still stands: the links and the promise, no figures line", () => {
    const t = text(draw(createElement(site().footer.SiteFooter, { facts: NO_FACTS, year: 2026 })));
    assert.doesNotMatch(t, /suppliers ·/);
    assert.match(t, /The sources/);
    assert.match(t, /No scores/);
  });

  it("every link is listed once per column, and none is empty", () => {
    for (const col of site().map.FOOTER) {
      const labels = col.links.map((l) => l.label);
      assert.equal(new Set(labels).size, labels.length, col.title);
      for (const l of col.links) assert.match(l.href, /^\/[a-z]/);
    }
  });
});

describe("the cookie banner", () => {
  const card = (view: "ask" | "choose", analytics = false) => {
    const noop = () => {};
    return draw(createElement(site().banner.CookieCard, { view, analytics, onAnalytics: noop, onReject: noop, onAccept: noop, onChoose: noop, onSave: noop, onBack: noop }));
  };

  it("Paper's words; Reject non-essential and Accept all are the same button", () => {
    const out = card("ask");
    assert.match(text(out), /We use cookies that keep you signed in\. With your OK, we would also count which pages people read\. Nothing is set until you choose\./);
    const buttons = [...out.matchAll(/<button [^>]*class="([^"]*)"[^>]*>([^<]*)</g)].map((m) => ({ cls: m[1], label: m[2] }));
    const reject = buttons.find((b) => b.label === "Reject non-essential")!;
    const accept = buttons.find((b) => b.label === "Accept all")!;
    assert.equal(reject.cls, accept.cls, "no choice is made to look like the one we want");
    assert.ok(buttons.some((b) => b.label === "Choose cookies"));
  });

  it("Choose cookies: the necessary one is always on and cannot be turned off; page counts is a switch that starts off", () => {
    const off = card("choose");
    assert.match(text(off), /Needed to run the site/);
    assert.match(text(off), /Always on/);
    assert.match(text(off), /Off until you turn it on/);
    assert.match(off, /role="switch"[^>]*aria-label="Page counts"|aria-label="Page counts"[^>]*role="switch"/);
    assert.doesNotMatch(off, /role="switch"[^>]*checked=""|checked=""[^>]*role="switch"/, "off until turned on");
    assert.match(card("choose", true), /checked=""/);
    assert.match(text(off), /Save choice/);
  });
});
