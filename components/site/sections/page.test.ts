// The home page as a visitor gets it (mercury.com's page section for section since the founder's walkthrough of 23 Oct
// 2026): its copy section by section, in order (the phone draws the same tree, so the order is one), the real app in
// its pictures, every link a route of the site, no "undefined", no score, no invented testimonial, no small print under
// the product, and the figures only when they were read.

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
const { homeDescription } = require("@/components/site/sections/hero") as typeof import("@/components/site/sections/hero");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
const { Announcement } = require("@/components/site/sections/announcement") as typeof import("@/components/site/sections/announcement");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
const { FOOTER, PANELS, SUPPLIER_ROW } = require("@/components/site/map") as typeof import("@/components/site/map");

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const LIVE = parseFacts({ suppliers_indexed: 10278, last_refreshed_at: "2026-10-09T00:00:00Z" }, { sources_listed: 21, sources_with_records: 14, certificates_on_file: 4289, latest_read: "2026-10-09" });
const page = (facts: SiteFacts = LIVE) => draw(createElement(HomeMercury, { facts }));

const live = page;

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

/** Each string after the one before it in `t`. */
function inOrder(t: string, order: readonly string[]) {
  let at = -1;
  for (const s of order) {
    const i = t.indexOf(s, at + 1);
    assert.ok(i > at, `"${s}" comes after the one before it`);
    at = i;
  }
}

describe("the home page", () => {
  it("opens with one line of headline, the live published count, the email in a glass pill with Start free inside it and Book a demo beside it, and no small print under the form", () => {
    const out = page();
    assert.match(out, /<h1[^>]*>Bangladesh sourcing, on the record\.<\/h1>/);
    assert.match(text(out), /Search 10,278 verified garment suppliers\. Every fact on a record names the public register it came from and the day we read it\./);
    assert.match(out, /<form [^>]*action="\/signup" method="get"/);
    // No field of the sign-up form has a name, so not even a script-less submit puts the email in the URL (audit P1).
    const signup = /<form [^>]*action="\/signup"[^>]*>([\s\S]*?)<\/form>/.exec(out)![1]!;
    assert.match(signup, /type="email"/);
    assert.doesNotMatch(signup, /<(input|select|textarea)[^>]*name=/);
    // Mercury's composition (his walkthrough of 23 Oct 2026): Start free inside the pill, Book a demo a pill beside it.
    assert.match(signup, /<button type="submit"[^>]*>Start free<\/button>/);
    assert.doesNotMatch(signup, /<a /);
    assert.match(out.slice(out.indexOf("</form>")), /^<\/form><a [^>]*href="\/contact"[^>]*>Book a demo<\/a>/);
    assert.match(/<form [^>]*action="\/signup"[^>]*>/.exec(out)![0], /rounded-full/);
    assert.doesNotMatch(out, />See a real record</);
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

  it("draws mercury.com's sections in its order (his walkthrough of 23 Oct 2026), and nothing Mercury has not", () => {
    const t = text(live());
    inOrder(t, [
      "Bangladesh sourcing, on the record.",
      "Everything you do to vet a factory.",
      "Factories on SourceBD already make for brands like these",
      "What suppliers and buyers told us",
      "Vetting a factory used to take weeks. Now it’s a head start.",
      "Every fact on a SourceBD record names the register it came from",
      "Get started in minutes. And never chase a factory again.",
      "Stop paying for leads. Start sourcing from the record.",
      "Run sourcing like a seasoned pro",
      "You’re building supply chains to last. So are we.",
      "Standard checks stop short. SourceBD goes further.",
      "From our compliance guides",
      "Sourcing, rebuilt from the register up.",
    ]);
    for (const gone of ["Inside one record", "Everything else a sourcing desk needs", "Questions buyers ask", "Three things we never do", "Receipts, not opinions"]) assert.ok(!t.includes(gone), gone);
  });

  it("the opening is the buyer's studio and the tour on the night ground: four items, the search open, the real app in one window", () => {
    const out = page();
    const t = text(out);
    assert.match(out, /<section data-mk-tone="night" aria-labelledby="home-title"/);
    assert.match(out, /hero-1600\.webp"[^>]*fetchPriority="high"|fetchPriority="high"[^>]*hero-1600/, "the studio loads first");
    assert.equal((out.match(/aria-controls="tour-[a-z]+"/g) ?? []).length, 4);
    const tour = out.slice(out.indexOf("Everything you do to vet a factory."), out.indexOf('aria-labelledby="home-brands"'));
    assert.equal((tour.match(/aria-expanded="true"/g) ?? []).length, 1, "one item open");
    // An item's words open with motion (a grid row growing from nothing, founder's recording of 22 Oct 13:17): the
    // closed ones are folded to nothing, inert and hidden from assistive technology; the open one is none of those.
    const panels = [...out.matchAll(/<div id="tour-[a-z]+"([^>]*)>/g)].map((m) => m[1]!);
    assert.equal(panels.length, 4);
    const closed = panels.filter((a) => / inert=""/.test(a));
    assert.equal(closed.length, 3, "three closed");
    for (const a of closed) assert.ok(/aria-hidden="true"/.test(a) && /grid-rows-\[0fr\]/.test(a), a);
    const [openPanel] = panels.filter((a) => !/ inert=""/.test(a));
    assert.ok(openPanel && /grid-rows-\[1fr\]/.test(openPanel) && !/aria-hidden="true"/.test(openPanel), openPanel);
    // No pills under the search (his recording of 22 Oct 13:17): no common search is linked from the opening.
    assert.doesNotMatch(tour, /aria-label="Common searches"|\/app\/discover\?/);
    for (const w of ["Supplier search", "Records you can check", "RFQs and quotes", "Compliance alerts"]) assert.ok(t.includes(w), w);
    // Mercury's list ends in one link under it, not one per item.
    assert.match(tour, /href="\/discover"[^>]*>Try the search</);
    assert.doesNotMatch(tour, />See how</);
    // The laptop's picture is the search composed from the recording's frames (his review of 22 Oct 14:18); beside the
    // list the app is dark and each item plays a dark product flow, in the list's order (his review of 24 Oct).
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
    const { screenFile } = require("@/components/site/sections/browser") as typeof import("@/components/site/sections/browser");
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- the same.
    const { FLOWS } = require("@/components/site/sections/opening") as typeof import("@/components/site/sections/opening");
    assert.equal(screenFile("find"), "clip-find");
    // The light picture is the dark flow's first frame taken in the light theme (his review of 24 Oct: the old light
    // search did not match the dark page it turns into), so the 22 Oct composition left the opening.
    assert.match(out, /src="\/site\/home\/clip-light-search\.webp"/, "the light picture in the laptop");
    assert.doesNotMatch(out, /clip-find\./, "the old light search is gone from the opening");
    assert.deepEqual(Object.values(FLOWS).map((f) => f.file), ["clip-dark-search", "clip-dark-record", "clip-dark-rfq", "clip-dark-sort"]);
    for (const n of ["find", "check", "ask", "watch"] as const) assert.match(tour, new RegExp(`poster="/site/home/${FLOWS[n]!.file}\\.webp"`), n);
    assert.doesNotMatch(tour, /poster="\/site\/home\/app-(?:check|ask|watch)\.webp"/, "the light recordings left the opening");
    assert.doesNotMatch(out, /app-find\./, "the raw search recording is gone from the page");
    assert.doesNotMatch(out, /<video[^>]*autoplay/i, "nothing plays until it is on screen");
  });

  it("every picture of the product is the real app playing or held still, with no pause button drawn, no dark shadow and nothing captioned under it (founder's videos of 22 Oct)", () => {
    const out = live();
    const videos = out.match(/<video [^>]*>/g) ?? [];
    assert.ok(videos.length >= 12, `${videos.length} videos`);
    for (const v of videos) assert.match(v, /poster="\/site\/home\/(?:app|clip)-[a-z-]+\.webp"/, v);
    // The checks hold three parts of the app still (his recording of 22 Oct 13:17), each from a capture.
    const stills = out.match(/<img [^>]*src="\/site\/home\/still-[a-z-]+\.webp"[^>]*>/g) ?? [];
    assert.equal(stills.length, 3, `${stills.length} stills`);
    // Each playing picture keeps its pause control for the keyboard (WCAG 2.2.2), drawn only when focused.
    const pauses = out.match(/<button type="button" aria-label="Pause video"[^>]*>/g) ?? [];
    assert.ok(pauses.length >= 9, `${pauses.length} pause controls`);
    for (const b of pauses) assert.match(b, /\bopacity-0\b[^"]*\bfocus-visible:opacity-100\b/, b);
    assert.doesNotMatch(out, /ring-ink\/10/, "no hairline round a picture of the app");
    assert.doesNotMatch(out, /shadow-window/, "no dark drop shadow under a picture of the app (his recording of 22 Oct 13:17)");
    assert.doesNotMatch(out, /\/site\/home\/crop-/, "no still cut of a recording is left");
    assert.doesNotMatch(text(out), /Real records as read|Example company, not a real supplier/);
  });

  it("shows each moment of the app once: no two sections play the same one (the ledger, founder's video 3)", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
    const { LEDGER } = require("@/components/site/sections/browser") as typeof import("@/components/site/sections/browser");
    const out = live();
    const starts = [...out.matchAll(/<section [^>]*aria-labelledby="([^"]+)"/g)].map((m) => ({ at: m.index, id: m[1]! }));
    const where = new Map<string, Set<string>>();
    for (const m of out.matchAll(/(?:poster|src)="\/site\/home\/((?:app|clip|still)-[a-z-]+)\.webp"/g)) {
      const file = m[1]!;
      const moment = LEDGER[file];
      assert.ok(moment, `${file} is not in the ledger`);
      const section = starts.filter((s) => s.at < m.index).pop()?.id ?? "(none)";
      if (!where.has(moment)) where.set(moment, new Set());
      where.get(moment)!.add(section);
    }
    assert.ok(where.size >= 16, `${where.size} moments`);
    for (const [moment, sections] of where) assert.equal(sections.size, 1, `"${moment}" is shown in ${[...sections].join(" and ")}`);
    assert.equal(new Set(Object.values(LEDGER)).size, Object.keys(LEDGER).length, "two files of the ledger show one moment");
  });

  it("every section names one of mercury.com's three grounds, in its order, and the main paints none of its own", () => {
    const out = live();
    // React hoists the marks' image preloads ahead of the tree, so the landmark is the first element, not the first tag.
    const main = /^(?:<link [^>]*>)*<main class="([^"]*)"/.exec(out);
    assert.ok(main, "the main landmark first");
    assert.doesNotMatch(main[1]!, /\bbg-/, "the page's ground shows through it");
    assert.doesNotMatch(out, /id="main-content"/, "the shell carries the skip link's anchor");
    assert.doesNotMatch(out, /data-tone="/, "the home's sections use the three grounds, not the fixed dark tone");
    const tones = [...out.matchAll(/<section data-mk-tone="(night|warm|day)"/g)].map((m) => m[1]);
    assert.deepEqual(tones, ["night", "night", "night", "warm", "day", "day", "day", "day", "night", "night", "night", "night"]);
  });

  it("the page takes the tone of the section at the window's middle, the first section's before any has passed it", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
    const { toneAt } = require("@/components/site/home-main") as typeof import("@/components/site/home-main");
    const s = [{ top: -1200, tone: "night" as const }, { top: 300, tone: "warm" as const }, { top: 900, tone: "day" as const }];
    assert.equal(toneAt(s, 450), "warm");
    assert.equal(toneAt(s, 200), "night");
    assert.equal(toneAt([{ top: 100, tone: "night" as const }, { top: 2000, tone: "warm" as const }], 450), "night");
    assert.equal(toneAt([{ top: 600, tone: "day" as const }], 450), "day", "before any top passes the line, the first section's");
    assert.equal(toneAt([], 450), null);
  });

  it("the brands are names in our type, never logos, and only brands on the record (context/logos.lock.md)", () => {
    const strip = /<section data-mk-tone="night" aria-labelledby="home-brands"[\s\S]*?<\/section>/.exec(page())![0];
    assert.doesNotMatch(strip, /<img|<svg/);
    for (const b of ["H&M", "Inditex", "Next", "Walmart", "M&S", "Tesco", "ASOS"]) assert.ok(strip.includes(`>${b}<`), b);
    assert.doesNotMatch(strip, /Primark|Target|Zara/, "a brand with no published list and no customs record is not named");
    assert.equal((strip.match(/aria-hidden="true"/g) ?? []).length, 1, "the drift's second copy is hidden from screen readers");
  });

  it("where mercury.com quotes its founder the page states its own promise and says whose it is", () => {
    const out = live();
    const t = text(out);
    assert.ok(t.includes("“Every fact on a SourceBD record names the register it came from and the day we read it. No scores. No paid placement.” Our methodology Read how we check every fact"));
    assert.match(out, /href="\/methodology"[^>]*>Read how we check every fact</);
  });

  it("offers no product editing, and the claim button starts a supplier account (audit P1)", () => {
    const out = page();
    assert.doesNotMatch(text(out), /add products|an admin checks/i);
    for (const m of out.matchAll(/<a [^>]*href="([^"]+)"[^>]*>(?:<[^>]+>)*\s*Claim your record/g)) assert.equal(m[1], "/signup?role=supplier");
    assert.ok(/href="\/signup\?role=supplier"[^>]*>(?:<[^>]+>)*\s*Claim your record/.test(out), "a claim button");
  });

  it("no screenshot and no stand-in: the only photographs are the buyer's studio (its laptop is laid over it only by the scene) and the speakers' settings, decoration", () => {
    const out = page();
    for (const img of out.match(/<img [^>]*>/g) ?? []) if (/\/site\/home\//.test(img)) assert.match(img, /alt=""/, img);
    assert.doesNotMatch(out, /\/site\/home\/screen-|\/site\/[a-z-]+\.png|hero-cotton|weave-|hero-loop/);
    const stills = new Set([...out.matchAll(/\/site\/home\/([a-z]+)-(?:1600|2560)\.(?:avif|webp)/g)].map((m) => m[1]));
    assert.deepEqual([...stills].sort(), ["hero"]);
  });

  it("the split sections' pictures are drawn, not the product: no figure and no name, hidden from assistive technology", () => {
    const out = page();
    for (const id of ["home-start", "home-promises"]) {
      const sec = new RegExp(`<section [^>]*aria-labelledby="${id}"[\\s\\S]*?</section>`).exec(out)![0];
      assert.equal((sec.match(/aria-expanded="true"/g) ?? []).length, 1, `${id}: one item open`);
      const art = [...sec.matchAll(/<div aria-hidden="true" class="absolute inset-0 transition-opacity[^"]*">([\s\S]*?)<\/svg>/g)].map((m) => m[1]!);
      assert.equal(art.length, 3, `${id}: a picture per item`);
      // The search picture types two words of a search; nothing else is written in a picture.
      for (const a of art) assert.doesNotMatch(a.replace(/<text[^>]*>knit GOTS<\/text>/, ""), /<text/, id);
    }
  });

  it("the first paint waits only for the site's facts: no record and no chip count is read (critique 22 Oct, S9; founder's recording of 22 Oct 13:17)", () => {
    const route = readFileSync(join(process.cwd(), "app/(home)/page.tsx"), "utf8");
    assert.doesNotMatch(route, /Chips|chipsOf|loadChips|loadHomeRecords|Promise\.all/);
    assert.equal((route.match(/\bawait\b/g) ?? []).length, 2, "the metadata's facts and the page's");
  });

  it("what suppliers and buyers said sits after the brands, before the first grid", () => {
    inOrder(text(live()), ["on the record.", "Everything you do to vet a factory.", "brands like these", "What suppliers and buyers told us", "Now it’s a head start."]);
  });

  it("every link on the page and in its footer is a route of the site", () => {
    const hrefs = [...live().matchAll(/href="([^"]+)"/g)].map((m) => m[1]!).filter((h) => h.startsWith("/") && !h.startsWith("/site/") && !h.startsWith("/icons/"));
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
    // The desktop panels (mercury.com's mega menu, 24 Oct 2026) add links of their own: each opens, and a panel never
    // drops an item its menu lists on the phone.
    for (const [menu, p] of Object.entries(PANELS)) {
      const links = [...p.lead.links, ...p.columns.flatMap((c) => [c, ...c.links]), SUPPLIER_ROW];
      for (const l of links) assert.ok(routeExists(l.href), `${menu}: ${l.title} → ${l.href}`);
      for (const i of MENU_ITEMS[menu as keyof typeof MENU_ITEMS]) assert.ok(links.some((l) => l.href === i.href), `${menu} panel lacks ${i.title}`);
    }
    // A click opens a menu, never hover (founder, 24 Oct 2026).
    assert.doesNotMatch(readFileSync(join(process.cwd(), "components/site/nav.tsx"), "utf8"), /onPointerEnter|onMouseEnter|onMouseLeave|onPointerLeave/);
  });

  it("never scores: no grade, rating or star is claimed, and the only score word is the promise not to", () => {
    const t = text(live());
    assert.doesNotMatch(t, /\bSBI\b|★|\b\d(\.\d)?\s?\/\s?(5|10)\b/);
    for (const m of t.matchAll(/scor/gi)) {
      const around = t.slice(Math.max(0, m.index - 40), m.index + 40);
      // A no, never or not just before it, or the figure 0 ("0 Scores, grades or stars").
      assert.ok(/\b(no|never|not)\b|\b0 $/i.test(t.slice(Math.max(0, m.index - 40), m.index)) || /^[^.]*\?/.test(t.slice(m.index)), around);
    }
  });

  it("keeps green for the wordmark, the primary buttons and the icons' one detail: no green link", () => {
    for (const a of live().match(/<a [^>]*>/g) ?? []) if (/text-brand(?![-\w])/.test(a)) assert.match(a, /href="\/"/, a);
  });

  it("the announcement links to the Compliance hub, in one line on a phone with the sentence kept for a screen reader (critique 22 Oct, S10)", () => {
    const bar = draw(createElement(Announcement));
    assert.match(bar, /<span class="max-md:sr-only">UFLPA and sanctions checks now run on every saved supplier<\/span>/);
    assert.match(text(bar), /UFLPA and sanctions checks now run on every saved supplier See the Compliance hub/);
    assert.match(bar, /href="\/compliance"/);
    assert.match(bar, /aria-label="Dismiss announcement"/);
    // White over the night of the opening, as mercury.com's bar is.
    assert.match(bar, /data-ground="day"/);
  });
});

describe("the live sections", () => {
  it("the figures are the site's facts, the true-by-definition one always, and a figure not read is left out", () => {
    const t = text(live());
    for (const f of ["10,278 Garment suppliers published", "4,289 Certificates on file", "14 Of 21 public sources hold records", "0 Scores, grades or stars"]) assert.ok(t.includes(f), f);
    const bare = text(live(NO_FACTS));
    assert.doesNotMatch(bare, /Garment suppliers published|public sources hold records|Certificates on file/);
    assert.ok(bare.includes("0 Scores, grades or stars"));
  });

  it("a figure counts up from nothing to the figure the server drew; anything but a plain number is drawn as it is", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
    const { counted } = require("@/components/site/sections/close") as typeof import("@/components/site/sections/close");
    assert.equal(counted("10,278", 1), "10,278");
    assert.equal(counted("10,278", 0), "0");
    assert.equal(counted("14", 0.5), String(Math.round(14 * (1 - Math.pow(0.5, 3)))));
    assert.equal(counted("1 of 3", 0.2), "1 of 3");
  });

  it("the common searches stay off the home page (founder's recording of 22 Oct 13:17: no pills)", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
    const { chipsOf } = require("@/components/site/sections/chips") as typeof import("@/components/site/sections/chips");
    assert.equal(chipsOf().length, 5, "Discover still offers five");
    assert.doesNotMatch(live(), /aria-label="Common searches"|\/app\/discover\?/);
  });

  it("where mercury.com tells customer stories, a supplier and two buyers speak over their settings, unnamed and saying so; nothing plays or moves on its own (founder, 24 Oct 2026)", () => {
    const sec = /<section data-mk-tone="night" aria-labelledby="home-voices"[\s\S]*?<\/section>/.exec(live())![0];
    const t = text(sec);
    for (const s of ["Buyer “Vetting a factory in Bangladesh", "Sourcing manager Womenswear brand · London", "Supplier “Our certificates were always there", "Managing director Knitwear factory · Gazipur", "Technical sourcing lead Knitwear importer · Germany"]) assert.ok(t.includes(s), s);
    assert.ok(t.includes("Said to us before launch. Names are withheld until then; the photographs show the setting, not the speaker."));
    for (const p of ["buyer-uk", "supplier", "buyer-eu"]) assert.match(sec, new RegExp(`<img src="/site/home/voice-${p}\\.webp" alt=""`), p);
    assert.doesNotMatch(sec, /<video|<a /, "no recording plays and no speaker is linked");
    // One slide showing, the other two inert until dragged or picked; a rule per slide, none of them filling as a timer.
    assert.equal((sec.match(/<figure inert="" aria-hidden="true"/g) ?? []).length, 2);
    assert.equal((sec.match(/aria-label="Show the [^"]+" aria-pressed="(?:true|false)"/g) ?? []).length, 3);
    assert.doesNotMatch(sec, /scale-x-0|origin-left/);
    // Mercury's order of weight: the quote large, then the name and the role in grey, one size down. Every glyph measured
    // WCAG AAA on all three rooms at 390, 820 and 1440 (24 Oct 2026: worst 6.80:1 for the large quote, 7.96:1 for normal
    // text) only while the oval of shade holds 0.82 under the words and they stay inside 44% of the card; thinning either
    // lets a bright room through. The blur steps up to 6 px at most, never one hard-masked layer (founder: a seam showed).
    assert.match(sec, /<blockquote class="[^"]*text-ink lg:text-site-lead"/);
    assert.match(sec, /radial-gradient\(ellipse_44%_62%_at_24%_72%,rgb\(var\(--mk-ground-night\)\/0\.84\)_0%,rgb\(var\(--mk-ground-night\)\/0\.82\)_50%/);
    assert.match(sec, /sm:max-w-\[min\(440px,44%\)\]/);
    assert.deepEqual([...sec.matchAll(/backdrop-blur-\[(\d)px\]/g)].map((m) => m[1]), ["2", "4", "6", "2", "4", "6", "2", "4", "6"]);
    assert.doesNotMatch(sec, /backdrop-blur-(?:sm|md|lg|xl)\b/);
  });

  it("the checks: three cards, each one panel of the real app held still (no stand-in photograph, no video), no tabs that shift the page", () => {
    const out = live();
    assert.equal((out.match(/role="tab"/g) ?? []).length, 0);
    const cards = /<section data-mk-tone="night" aria-labelledby="home-confidence"[\s\S]*?<\/section>/.exec(out)![0];
    for (const s of ["Every supplier, against sanctions lists", "Forced-labour lists, checked for you", "Contacts locked until they are given"]) assert.ok(text(cards).includes(s), s);
    for (const s of ["sanctions", "uflpa", "locked"]) assert.match(cards, new RegExp(`src="/site/home/still-${s}\\.webp"`), s);
    assert.doesNotMatch(cards, /<video|(?:seal|loupe|lock)-1200/);
  });

  it("the guides are the compliance guides themselves, each by its law's short name in our type", () => {
    const sec = /<section data-mk-tone="night" aria-labelledby="home-guides"[\s\S]*?<\/section>/.exec(live())![0];
    for (const h of ["/compliance/uflpa", "/compliance/uk-msa", "/compliance/eu-csddd"]) assert.match(sec, new RegExp(`href="${h}"`), h);
    assert.doesNotMatch(sec, /<img/, "no publication's logo");
  });

  it("motion never hides anything on the server: no element waits, the figures are final, and no recording plays in the first paint", () => {
    const out = live();
    assert.doesNotMatch(out, /data-reveal=/, "only the browser holds a section back, and only one below the fold");
    assert.ok(text(out).includes("10,278 Garment suppliers published"));
    for (const v of out.match(/<video [^>]*>/g) ?? []) assert.match(v, /poster="\/site\/home\/(?:app|clip)-[a-z-]+\.webp"/, v);
    // The drawn pictures are still on the server: no SVG animation in the first paint (reduced motion is read in the browser).
    assert.doesNotMatch(out, /<animate/);
  });
});

describe("what the home's rebuild shares with the rest of the site", () => {
  it("the hero's email field shows keyboard focus on its glass pill", () => {
    const form = /<form [^>]*action="\/signup"[^>]*>/.exec(page())![0];
    assert.match(form, /focus-within:border-accent/);
    assert.match(form, /focus-within:ring-1/);
  });

  it("the split sections can be stopped: a click on the picture or its pause button, drawn when the keyboard reaches it (WCAG 2.2.2)", () => {
    const out = page();
    for (const id of ["home-start", "home-promises"]) {
      const sec = new RegExp(`<section [^>]*aria-labelledby="${id}"[\\s\\S]*?</section>`).exec(out)![0];
      const b = /<button type="button" aria-label="Pause animation"[^>]*>/.exec(sec);
      assert.ok(b, id);
      assert.match(b[0], /\bopacity-0\b[^"]*\bfocus-visible:opacity-100\b/, id);
    }
  });

  it("the solutions pages' tours keep their short names and each item's way to its product page", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
    const { SourcingTour, ComplianceTour } = require("@/components/site/product/solutions-tours") as typeof import("@/components/site/product/solutions-tours");
    const sourcing = draw(createElement(SourcingTour));
    for (const w of ["Find", "Check", "Ask"]) assert.match(sourcing, new RegExp(`aria-controls="tour-[a-z]+"[^>]*>(?:<[^>]+>)*${w}<`), w);
    assert.doesNotMatch(text(sourcing), /Supplier search|Records you can check/);
    assert.match(sourcing, /href="\/product\/search"[^>]*>See how</);
    assert.match(text(draw(createElement(ComplianceTour))), /Check .*Watch .*Screen/);
  });

  it("the footer lines up with its page: the home's column on the home, the site's measure everywhere else", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
    const { Footer } = require("@/components/site/sections/footer") as typeof import("@/components/site/sections/footer");
    const inner = (narrow: boolean) => /<footer [^>]*><div class="([^"]*)"/.exec(draw(createElement(Footer, { facts: LIVE, year: 2026, narrow })))![1]!;
    assert.match(inner(true), /\bmax-w-column\b/);
    assert.match(inner(false), /\bmax-w-site\b/);
  });
});
