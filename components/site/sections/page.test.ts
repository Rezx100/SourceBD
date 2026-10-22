// The home page as a visitor gets it (rebuilt from the founder's videos of 22 Oct 2026): its copy section by section, in
// order (the phone draws the same tree, so the order is one), the real app in browser windows, every link a route of
// the site, no "undefined", no score, no small print under the product, and the figures only when they were read.

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NO_FACTS, parseFacts, type SiteFacts } from "@/lib/site-facts";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const { HomeMercury } = require("@/components/site/home") as typeof import("@/components/site/home");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
const { MENU_ITEMS } = require("@/components/site/nav") as typeof import("@/components/site/nav");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
const { TIERS } = require("@/components/site/sources") as typeof import("@/components/site/sources");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
const { homeDescription } = require("@/components/site/sections/hero") as typeof import("@/components/site/sections/hero");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
const { Announcement } = require("@/components/site/sections/announcement") as typeof import("@/components/site/sections/announcement");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
const { FOOTER } = require("@/components/site/map") as typeof import("@/components/site/map");

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const LIVE = parseFacts({ suppliers_indexed: 10278, last_refreshed_at: "2026-10-09T00:00:00Z" }, { sources_listed: 21, sources_with_records: 14, certificates_on_file: 4289, latest_read: "2026-10-09" });
const page = (facts: SiteFacts = LIVE) => draw(createElement(HomeMercury, { facts }));

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


describe("the home page", () => {
  it("opens with one line of headline, the live published count and the two ways in, and no small print under the form", () => {
    const out = page();
    assert.match(out, /<h1[^>]*>Bangladesh sourcing, on the record\.<\/h1>/);
    assert.match(text(out), /Search 10,278 verified garment suppliers\. Every fact on a record names the public register it came from and the day we read it\./);
    assert.match(out, /<form [^>]*action="\/signup" method="get"/);
    // No field of the sign-up form has a name, so not even a script-less submit puts the email in the URL (audit P1).
    const signup = /<form [^>]*action="\/signup"[^>]*>([\s\S]*?)<\/form>/.exec(out)![1]!;
    assert.match(signup, /type="email"/);
    assert.doesNotMatch(signup, /<(input|select|textarea)[^>]*name=/);
    assert.match(out, /href="\/suppliers\/aboni-knitwear"[^>]*>See a real record/);
    assert.doesNotMatch(text(out), /Search is free\. No card needed\./);
  });

  it("the meta description carries the live count, never a rounded one (audit P2, 14 Oct 2026)", () => {
    assert.match(homeDescription(10278), /Search 10,278 factories and buying houses/);
    assert.doesNotMatch(homeDescription(null), /\d/);
    assert.doesNotMatch(readFileSync(join(process.cwd(), "app/(home)/page.tsx"), "utf8"), /\d+,\d{3}\+/);
  });

  it("without a read count the lede says the same thing with no number", () => {
    const t = text(page(NO_FACTS));
    assert.match(t, /Search verified Bangladesh garment suppliers\./);
    assert.doesNotMatch(t, /undefined|null|NaN/);
  });

  it("draws the sections in order: none removed, each redesigned", () => {
    const t = text(page());
    const order = [
      "Bangladesh sourcing, on the record.",
      "Everything you do to vet a factory.",
      "Factories on SourceBD already make for brands like these.",
      "Every fact comes from a register you already trust.",
      "Vetting used to be a chase.",
      "Inside one record.",
      "Four moments from a day's sourcing.",
      "Everything else a sourcing desk needs.",
      "Buy with confidence.",
      "Receipts, not opinions.",
      "Counted straight from our records.",
      "Your record is already here.",
      "Three things we never do.",
      "Questions buyers ask.",
      "Sourcing, rebuilt from the register up.",
    ];
    let at = -1;
    for (const s of order) {
      const i = t.indexOf(s, at + 1);
      assert.ok(i > at, `"${s}" comes after the one before it`);
      at = i;
    }
  });

  it("the opening is the buyer's studio and the tour on the night ground: four items, Find open, the real app in one window", () => {
    const out = page();
    const t = text(out);
    assert.match(out, /<section data-tone="dark" aria-labelledby="home-title"/);
    assert.match(out, /hero-1600\.webp"[^>]*fetchPriority="high"|fetchPriority="high"[^>]*hero-1600/, "the studio loads first");
    assert.equal((out.match(/aria-controls="tour-[a-z]+"/g) ?? []).length, 4);
    const tour = out.slice(out.indexOf("Everything you do to vet a factory."), out.indexOf('aria-labelledby="home-brands"'));
    assert.equal((tour.match(/aria-expanded="true"/g) ?? []).length, 1, "one item open");
    // The closed items' lines are hidden by class as well as by attribute: a display class would otherwise win.
    const panels = [...out.matchAll(/<div id="tour-[a-z]+"( hidden="")? class="([^"]*)"/g)];
    assert.equal(panels.length, 4);
    for (const [, hiddenAttr, cls = ""] of panels) assert.equal(cls.split(" ").includes("hidden"), hiddenAttr !== undefined, cls);
    for (const w of ["Find", "Check", "Ask", "Watch"]) assert.match(t, new RegExp(`\\b${w}\\b`));
    assert.match(out, /href="\/product\/search"[^>]*>See how/);
    // The tour's window holds the four recordings, each starting from its first frame.
    for (const n of ["find", "check", "ask", "watch"]) assert.match(tour, new RegExp(`poster="/site/home/app-${n}\\.webp"`), n);
    assert.doesNotMatch(out, /<video[^>]*autoplay/i, "nothing plays until it is on screen");
  });

  it("every picture of the product is a browser window or a part of the real app, each recording with its pause button, and nothing is captioned under it", () => {
    const out = page();
    assert.ok((out.match(/<svg viewBox="0 0 1440 52"/g) ?? []).length >= 3, "browser bars");
    const videos = (out.match(/<video /g) ?? []).length;
    assert.ok(videos >= 7);
    assert.ok((out.match(/aria-label="Pause video"/g) ?? []).length >= 4);
    assert.doesNotMatch(text(out), /Real records as read|Example company, not a real supplier/);
    for (const c of ["buyers", "attention", "exports", "memberships", "uflpa", "shipments"]) assert.match(out, new RegExp(`/site/home/crop-${c}\\.webp`), c);
  });

  it("the grounds are fixed: the main landmark fades nothing and only the night sections say so, with no second skip anchor", () => {
    const out = page();
    // React hoists the marks' image preloads ahead of the tree, so the landmark is the first element, not the first tag.
    assert.match(out, /^(?:<link [^>]*>)*<main class="[^"]*bg-\[rgb\(var\(--mk-ground-paper\)\)\]/);
    assert.doesNotMatch(out, /id="main-content"/, "the shell carries the skip link's anchor");
    assert.doesNotMatch(out, /transition-\[background-color\]|duration-tone/);
    const tones = [...out.matchAll(/data-tone="(photo|dark|paper)"/g)].map((m) => m[1]);
    assert.deepEqual(tones, ["dark", "dark", "dark"], "the opening, the brands and buying with confidence");
  });

  it("the brands are names in our type, never logos, and only brands on the record (context/logos.lock.md)", () => {
    const strip = /<section data-tone="dark" aria-labelledby="home-brands"[\s\S]*?<\/section>/.exec(page())![0];
    assert.doesNotMatch(strip, /<img|<svg/);
    for (const b of ["H&M", "Inditex", "Next", "Walmart", "M&S", "Tesco", "ASOS"]) assert.ok(strip.includes(`>${b}<`), b);
    assert.doesNotMatch(strip, /Primark|Target|Zara/, "a brand with no published list and no customs record is not named");
    assert.equal((strip.match(/aria-hidden="true"/g) ?? []).length, 1, "the drift's second copy is hidden from screen readers");
  });

  it("frames only the marks the logos lock allows, at full strength with the code under each, loaded with the page", () => {
    const strip = /<section aria-labelledby="home-marks"[\s\S]*?<\/section>/.exec(page())![0];
    for (const c of ["EPB", "RSC", "BGMEA", "BKMEA", "BTMA", "BGAPMEA", "GOTS", "OEKO-TEX", "WRAP"]) assert.match(strip, new RegExp(`>${c}</span>`), c);
    assert.equal((strip.match(/<img /g) ?? []).length, 9);
    assert.doesNotMatch(strip, /loading="lazy"|opacity-0|bepza|dife/i);
  });

  it("the ladder is the methodology page's tiers, source for source (audit P2, 14 Oct 2026)", () => {
    const t = text(page());
    for (const tier of TIERS) {
      assert.match(t, new RegExp(`Tier ${tier.n} ${tier.label}`), tier.label);
      for (const s of tier.ladder.split(", ")) assert.ok(t.includes(s), `${tier.label}: ${s}`);
    }
  });

  it("says how a claim is really approved, offers no product editing, and the claim button starts a supplier account (audit P1)", () => {
    const out = page();
    const t = text(out);
    assert.match(t, /If its domain matches the company's, opening our link approves the claim; if not, a person reviews it\./);
    assert.doesNotMatch(t, /add products|an admin checks/i);
    for (const m of out.matchAll(/<a [^>]*href="([^"]+)"[^>]*>(?:<[^>]+>)*\s*Claim your record/g)) assert.equal(m[1], "/signup?role=supplier");
    assert.ok(/href="\/signup\?role=supplier"[^>]*>(?:<[^>]+>)*\s*Claim your record/.test(out), "a claim button");
  });

  it("no screenshot and no stand-in: every photograph is decoration from the buyer's world", () => {
    const out = page();
    for (const img of out.match(/<img [^>]*>/g) ?? []) if (/\/site\/home\//.test(img)) assert.match(img, /alt=""/, img);
    assert.doesNotMatch(out, /\/site\/home\/screen-|\/site\/[a-z-]+\.png|hero-cotton|weave-|hero-loop/);
    const stills = new Set([...out.matchAll(/\/site\/home\/([a-z]+)-(?:1200|1600)\.(?:avif|webp)/g)].map((m) => m[1]));
    for (const s of stills) assert.ok(["hero", "swatches", "rail", "port", "dusk", "mill", "loupe", "lock", "seal"].includes(s!), s);
    for (const s of ["hero", "swatches", "port", "dusk", "mill"]) assert.ok(stills.has(s), s);
  });

  it("everything else a sourcing desk needs: eight things, each with its icon", () => {
    const grid = /<section aria-labelledby="home-grid"[\s\S]*?<\/section>/.exec(page())![0];
    assert.equal((grid.match(/<li /g) ?? []).length, 8);
    assert.equal((grid.match(/<svg /g) ?? []).length, 8);
    assert.match(grid, /lg:grid-cols-4/);
  });

  it("the first paint waits for no slow read: the chips' counts and the three records stream in (critique 22 Oct, S9)", () => {
    const route = readFileSync(join(process.cwd(), "app/(home)/page.tsx"), "utf8");
    assert.match(route, /<Suspense fallback=\{<Chips chips=\{chipsOf\(\)\} pending className="md:justify-start" \/>\}>/);
    const body = route.slice(route.indexOf("export default async function HomePage"));
    assert.ok(body.length < route.length, "the page function");
    assert.doesNotMatch(body, /loadChips|await loadHomeRecords|await Promise\.all/);
  });

  it("the streamed parts land in their own places: the chips in the tour's Find, the three cards after the record", () => {
    const mark = (id: string) => createElement("p", { "data-slot": id }, id);
    const t = text(draw(createElement(HomeMercury, { facts: LIVE, slots: { chips: mark("chips-slot"), records: mark("records-slot") } })));
    const order = ["on the record.", "Everything you do to vet a factory.", "chips-slot", "Vetting used to be a chase.", "Inside one record.", "records-slot", "Four moments from a day's sourcing."];
    let at = -1;
    for (const s of order) {
      const i = t.indexOf(s, at + 1);
      assert.ok(i > at, `"${s}" comes after the one before it`);
      at = i;
    }
  });

  it("every link on the page and in its footer is a route of the site", () => {
    const hrefs = [...page().matchAll(/href="([^"]+)"/g)].map((m) => m[1]!).filter((h) => h.startsWith("/") && !h.startsWith("/site/") && !h.startsWith("/icons/"));
    assert.ok(hrefs.length > 10);
    for (const h of new Set(hrefs)) assert.ok(routeExists(h), h);
    for (const col of FOOTER) for (const l of col.links) assert.ok(routeExists(l.href), `${l.label} → ${l.href}`);
  });

  it("the nav's menus link pages a visitor can open, never an app screen behind sign-in (audit P1, 14 Oct 2026)", () => {
    // The desktop panel and the phone sheet both draw MENU_ITEMS, so one list answers for both.
    assert.deepEqual(MENU_ITEMS.product.map((i) => i.href), ["/product/search", "/product/records", "/product/rfqs", "/product/compliance"]);
    for (const i of Object.values(MENU_ITEMS).flat()) {
      assert.ok(routeExists(i.href), `${i.title} → ${i.href}`);
      assert.doesNotMatch(i.href, /^\/(app|supplier|admin)(\/|$)/, i.title);
    }
    assert.ok(!routeExists("/no-such-page") && !routeExists("/app/no-such-page"), "the check can fail");
  });

  it("never scores: no grade, rating or star is claimed, and the only score word is the promise not to", () => {
    const t = text(page());
    assert.doesNotMatch(t, /\bSBI\b|★|\b\d(\.\d)?\s?\/\s?(5|10)\b/);
    // Each "score" is the promise: a no, never or not stands just before it ("Three things we never do. Score a supplier").
    // A buyer's question ("Do you score or rank suppliers?") is asked, not claimed.
    for (const m of t.matchAll(/scor/gi)) {
      const around = t.slice(Math.max(0, m.index - 40), m.index + 40);
      // A no, never or not just before it, or the figure 0 ("0 scores, grades or stars").
      assert.ok(/\b(no|never|not)\b|\b0 $/i.test(t.slice(Math.max(0, m.index - 40), m.index)) || /^[^.]*\?/.test(t.slice(m.index)), around);
    }
  });

  it("keeps green for the wordmark, the primary buttons and the icons' one detail: no green link", () => {
    for (const a of page().match(/<a [^>]*>/g) ?? []) if (/text-brand(?![-\w])/.test(a)) assert.match(a, /href="\/"/, a);
  });

  it("the announcement links to the Compliance hub, in one line on a phone with the sentence kept for a screen reader (critique 22 Oct, S10)", () => {
    const bar = draw(createElement(Announcement));
    assert.match(bar, /<span class="max-md:sr-only">UFLPA and sanctions checks now run on every saved supplier<\/span>/);
    assert.match(text(bar), /UFLPA and sanctions checks now run on every saved supplier See the Compliance hub/);
    assert.match(bar, /href="\/compliance"/);
    assert.match(bar, /aria-label="Dismiss announcement"/);
  });
});

const CARD = { slug: "aboni-knitwear", name: "Aboni Knitwear Ltd", meta: "Factory · Dhaka · 3,314 workers filed · 8 sources", marks: ["EPB", "WRAP"], facts: [{ icon: "rosette" as const, title: "WRAP 7865 · valid to 25 Aug 2027", sub: "WRAP register · read 8 Oct 2026" }] };
const live = (over: Partial<Parameters<typeof HomeMercury>[0]> = {}) => draw(createElement(HomeMercury, { facts: LIVE, cards: [CARD], chips: [{ key: "a", title: "GOTS-certified knitwear", href: "/app/discover?hs=6109", count: 205 }, { key: "b", title: "Buying houses in Dhaka", href: "/app/discover?entity=buying_house", count: null }], ...over }));

describe("the live sections", () => {
  it("the figures are the site's facts, the two true-by-definition ones always, and a figure not read is left out", () => {
    const t = text(live());
    for (const f of ["10,278 Bangladesh garment suppliers published", "14 of 21 public sources holding records", "4,289 certificates on file", "50 suppliers reached by one RFQ", "0 scores, grades or stars on any supplier"]) assert.match(t, new RegExp(f), f);
    assert.doesNotMatch(t, /the latest register read was/, "the footer dates the reads, not a small line under the figures");
    const bare = text(live({ facts: NO_FACTS }));
    assert.doesNotMatch(bare, /garment suppliers published|public sources holding records|certificates on file/);
    assert.match(bare, /50 suppliers reached by one RFQ/);
    assert.match(bare, /0 scores, grades or stars on any supplier/);
  });

  it("the tour's Find offers five common searches, not nine (critique 22 Oct, S8)", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
    const { chipsOf } = require("@/components/site/sections/chips") as typeof import("@/components/site/sections/chips");
    assert.equal(chipsOf().length, 5);
    assert.ok(chipsOf().every((c) => c.count === null), "with no counts read, none is drawn");
  });

  it("a chip shows its count only when the count was read, and links to its search", () => {
    const out = live();
    assert.match(out, /href="\/app\/discover\?hs=6109"[^>]*>.*?GOTS-certified knitwear<\/span><span[^>]*>205<\/span>/);
    assert.match(out, /Buying houses in Dhaka<\/span><\/a>/);
    assert.doesNotMatch(text(live({ chips: [] })), /GOTS-certified knitwear/);
  });

  it("the real records say a fact large and leave its small source line to the record; with none read, the section is not drawn", () => {
    const out = live();
    const t = text(out);
    assert.match(t, /Real records, not reviews\./);
    assert.match(t, /WRAP 7865 · valid to 25 Aug 2027/);
    assert.doesNotMatch(t, /WRAP register · read 8 Oct 2026/);
    assert.match(out, /href="\/suppliers\/aboni-knitwear"[^>]*>(?:<[^>]+>)*Aboni Knitwear Ltd</);
    const none = text(live({ cards: [] }));
    assert.doesNotMatch(none, /Real records, not reviews/);
    assert.match(none, /Inside one record\./, "the recorded record still stands");
  });

  it("Buy with confidence: three cards and the data line, no tabs that shift the page", () => {
    const out = live();
    assert.equal((out.match(/role="tab"/g) ?? []).length, 0);
    for (const s of ["A sanctioned supplier is marked everywhere.", "Forced-labour lists, checked for you.", "Contacts stay locked until they are given."]) assert.match(text(out), new RegExp(s));
    for (const s of ["seal", "loupe", "lock"]) assert.match(out, new RegExp(`/site/home/${s}-1200\\.webp`), s);
    assert.match(out, /href="\/security"/);
  });

  it("motion never hides anything on the server: no element waits, the figures are final, and no recording plays in the first paint", () => {
    const out = live();
    assert.doesNotMatch(out, /data-reveal=/, "only the browser holds a section back, and only one below the fold");
    assert.match(text(out), /10,278 Bangladesh garment suppliers published/);
    for (const m of out.match(/group-data-\[reveal=wait\]\/reveal:\S+/g) ?? []) assert.match(m, /opacity-0|translate-y-\d/, m);
    for (const v of out.match(/<video [^>]*>/g) ?? []) assert.match(v, /poster="\/site\/home\/app-[a-z]+\.webp"/, v);
  });
});