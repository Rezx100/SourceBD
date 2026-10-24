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
const site = () => ({ nav: require("@/components/site/nav") as typeof import("@/components/site/nav"), footer: require("@/components/site/sections/footer") as typeof import("@/components/site/sections/footer"), banner: require("@/components/site/cookie-banner") as typeof import("@/components/site/cookie-banner"), map: require("@/components/site/map") as typeof import("@/components/site/map") });
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
  it("the logo, three menus, Pricing, Sign in and Start free, mercury.com's bar: every one a real link or button", () => {
    const out = draw(createElement(site().nav.SiteNav));
    const t = text(out);
    // The brand kit's logo (25 Oct 2026), drawn inline and named for a screen reader, in place of the typed wordmark.
    assert.match(out, /<a[^>]*href="\/"[^>]*><svg[^>]*height="22"[^>]*role="img"[^>]*aria-label="SourceBD"[^>]*data-logo/);
    assert.match(out, /class="fill-logo-back[^"]*"[\s\S]*class="fill-logo-front[^"]*"[\s\S]*fill="currentColor"/, "back swatch, front swatch, then the word in the bar's ink");
    for (const w of ["Product", "Solutions", "Resources", "Pricing", "Sign in", "Start free"]) assert.match(t, new RegExp(w));
    // Two actions at the right since the founder's walkthrough of 23 Oct 2026, as mercury.com's; Book a demo stays in the phone's sheet and beside the hero's form.
    assert.doesNotMatch(t, /Book a demo/);
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
    const out = draw(createElement(site().footer.Footer, { facts: f, year: 2026 }));
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
    const t = text(draw(createElement(site().footer.Footer, { facts: NO_FACTS, year: 2026 })));
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

  it("on a phone it is a compact sheet along the bottom edge: no heading line, Choose cookies at the end of the sentence (critique 22 Oct, S10)", () => {
    const out = card("ask");
    assert.match(out, /<section [^>]*class="[^"]*max-sm:inset-x-0[^"]*max-sm:bottom-0[^"]*"/);
    assert.match(out, /<h2 [^>]*class="[^"]*max-sm:sr-only[^"]*">Cookies<\/h2>/);
    assert.match(out, /Nothing is set until you choose\.(?: |<!-- -->)*<button type="button" class="[^"]*sm:hidden[^"]*">Choose cookies<\/button><\/p>/);
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

describe("the skip link", () => {
  // It once named four classes the token theme does not have, so Tailwind dropped them and the link showed nothing
  // on focus (audit P1, 14 Oct 2026). Every class it uses must compile through the real config.
  it("uses only classes the token theme compiles", async () => {
    /* eslint-disable @typescript-eslint/no-require-imports -- tailwind's loader and postcss are CommonJS tools */
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const postcss = require("postcss") as typeof import("postcss").default;
    const tailwind = require("tailwindcss") as (config: object) => import("postcss").AcceptedPlugin;
    const loadConfig = require("tailwindcss/loadConfig") as (file: string) => Record<string, unknown>;
    /* eslint-enable @typescript-eslint/no-require-imports */
    const src = readFileSync(join(process.cwd(), "components/site/skip-link.tsx"), "utf8");
    const classes = /className="([^"]+)"/.exec(src)![1]!.split(/\s+/);
    assert.ok(classes.length > 10);
    const config = loadConfig(join(process.cwd(), "tailwind.config.ts"));
    const { css } = await postcss([tailwind({ ...config, content: [{ raw: classes.join(" "), extension: "html" }] })]).process("@tailwind utilities;", { from: undefined });
    for (const c of classes) assert.ok(css.includes("." + c.replace(/[:./[\]]/g, (m) => "\\" + m)), `no rule for ${c}`);
  });
});

describe("the logo (brand kit, 25 Oct 2026)", () => {
  /* eslint-disable @typescript-eslint/no-require-imports -- node built-ins and tailwind's CommonJS loader */
  const { existsSync, readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  /* eslint-enable @typescript-eslint/no-require-imports */

  it("its swatches are bottle green over grey-green on every light ground and paper over grey-green on the night", async () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const postcss = require("postcss") as typeof import("postcss").default;
    const tailwind = require("tailwindcss") as (config: object) => import("postcss").AcceptedPlugin;
    const loadConfig = require("tailwindcss/loadConfig") as (file: string) => Record<string, unknown>;
    /* eslint-enable @typescript-eslint/no-require-imports */
    const config = loadConfig(join(process.cwd(), "tailwind.config.ts"));
    const { css } = await postcss([tailwind({ ...config, content: [{ raw: "fill-logo-front fill-logo-back", extension: "html" }] })]).process("@tailwind base; @tailwind utilities;", { from: undefined });
    assert.match(css, /\.fill-logo-front\s*\{[^}]*var\(--ds-logo-front\)/);
    assert.match(css, /\.fill-logo-back\s*\{[^}]*var\(--ds-logo-back\)/);
    // The block a selector opens, so each ground is read on its own.
    const block = (selector: string) => {
      const at = css.indexOf(selector + " {");
      assert.ok(at >= 0, `no ${selector}`);
      return css.slice(at, css.indexOf("}", at));
    };
    const light = { front: "20 69 26", back: "93 140 96" };
    const night = { front: "247 247 246", back: "168 185 169" };
    for (const [selector, want] of [[":root", light], ['[data-ground="night"]', night], ['[data-tone="dark"]', night], ['[data-ground="day"]', light], ['[data-mk-page="night"]', night], ['[data-mk-page="warm"]', light], ['[data-mk-page="day"]', light]] as const) {
      const b = block(selector);
      assert.match(b, new RegExp(`--ds-logo-front: ${want.front};`), selector);
      assert.match(b, new RegExp(`--ds-logo-back: ${want.back};`), selector);
    }
  });

  it("the browser tab takes the kit's favicon, and every icon the layout names is served", () => {
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    assert.match(layout, /"\/icons\/brand\/sourcebd-favicon\.svg"/);
    assert.doesNotMatch(layout, /sourcebd-logo\.png/, "the old mark is retired");
    const named = [...layout.matchAll(/"(\/icons\/brand\/[^"]+)"/g)].map((m) => m[1]!);
    assert.ok(named.length >= 5, "the favicon, its PNGs and the tiles");
    for (const url of named) assert.ok(existsSync(join(process.cwd(), "public", url)), `${url} is not in public/`);
  });

  it("no screen still types the wordmark: the auth bar and the invite page draw the logo", () => {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const typed: string[] = [];
    for (const root of ["app", "components"]) {
      for (const f of readdirSync(join(process.cwd(), root), { recursive: true }).map(String).filter((f) => f.endsWith(".tsx"))) {
        const src = readFileSync(join(process.cwd(), root, f), "utf8");
        if (/>\s*SourceBD\s*</.test(src.replace(/<title>[^<]*<\/title>/g, ""))) typed.push(`${root}/${f}`);
      }
    }
    assert.deepEqual(typed, []);
    for (const f of ["components/auth/state.tsx", "app/invite/[token]/page.tsx"]) assert.match(readFileSync(join(process.cwd(), f), "utf8"), /<Logo height=\{20\}/, f);
    // The founder, 25 Oct 2026: a 35 px icon on the bar and the footer, the word 75% of it.
    assert.match(readFileSync(join(process.cwd(), "components/site/sections/ui.tsx"), "utf8"), /<Logo height=\{35\} \/>/);
    assert.match(readFileSync(join(process.cwd(), "components/patterns/logo.tsx"), "utf8"), /scale\(0\.9266\)">/);
  });

  it("the bar reads the dark blocks on every page, not only the home page's", () => {
    // Until 25 Oct 2026 the ground check returned early unless `over`, so on /product/search the bar stayed white glass over the night block.
    const nav = readFileSync(join(process.cwd(), "components/site/nav.tsx"), "utf8");
    assert.doesNotMatch(nav, /if \(!over\) return;/);
    assert.match(nav, /querySelectorAll\('main \[data-tone="dark"\]'\)/);
  });
});

describe("one site (M1, handoff-mercury-motion-sitewide.md §3)", () => {
  /* eslint-disable @typescript-eslint/no-require-imports -- node built-ins, loaded where they are used */
  const { readFileSync, readdirSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  /* eslint-enable @typescript-eslint/no-require-imports */
  const dir = join(process.cwd(), "components/site");
  const sources = readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => ({ f: f.replace(/\\/g, "/"), src: readFileSync(join(dir, f), "utf8") }));

  it("sets no size, line height or radius by hand: every page uses the token scale", () => {
    assert.ok(sources.length > 20);
    for (const { f, src } of sources) assert.doesNotMatch(src, /\b(?:text|leading|rounded)-\[/, f);
  });

  it("has one footer, one FAQ and one focus ring", () => {
    assert.deepEqual(sources.filter((s) => /<footer\b/.test(s.src)).map((s) => s.f), ["sections/footer.tsx"]);
    assert.deepEqual(sources.filter((s) => /<details\b/.test(s.src)).map((s) => s.f), ["sections/faq.tsx"]);
    const importers = readdirSync(join(process.cwd(), "components"), { recursive: true })
      .map(String)
      .filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"))
      .filter((f) => /sections\/footer"/.test(readFileSync(join(process.cwd(), "components", f), "utf8")));
    assert.deepEqual(importers.map((f) => f.replace(/\\/g, "/")), ["site/chrome.tsx"]);
    // The skip link is the app shell's too, so it keeps the shell's ring.
    for (const { f, src } of sources) if (f !== "skip-link.tsx") assert.doesNotMatch(src, /outline-focus\b/, f);
  });

  it("spends green on the main button, the logo and the icons' one detail only: every link is ink", () => {
    for (const { f, src } of sources) {
      if (f === "sections/icons.tsx") continue;
      const green = src.match(/\b(?:text|bg|border|decoration)-brand(?!-on\b)[\w-]*/g) ?? [];
      // The logo's green is its own pair of swatches (`--ds-logo-*`, components/patterns/logo.tsx), not a brand class.
      assert.deepEqual(green, [], f);
    }
  });
});
