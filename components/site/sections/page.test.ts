// The Mercury home page as a visitor gets it: the board's copy section by section, in the board's order (the phone
// draws the same tree, so the order is one), every link a route of the site, no "undefined", no score, and the
// figures only when they were read.

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

describe("the Mercury home page", () => {
  it("opens with the board's headline, the live published count and the two ways in", () => {
    const out = page();
    assert.match(out, /<h1[^>]*>Bangladesh sourcing,<br\/>on the record\.<\/h1>/);
    assert.match(text(out), /Search 10,278 verified garment suppliers\. Every fact on a record names the public register it came from and the day we read it\./);
    assert.match(out, /<form [^>]*action="\/signup" method="get"/);
    // No field of the sign-up form has a name, so not even a script-less submit puts the email in the URL (audit P1).
    const signup = /<form [^>]*action="\/signup"[^>]*>([\s\S]*?)<\/form>/.exec(out)![1]!;
    assert.match(signup, /type="email"/);
    assert.doesNotMatch(signup, /<(input|select|textarea)[^>]*name=/);
    assert.match(out, /href="\/suppliers\/aboni-knitwear"[^>]*>See a real record/);
    assert.match(text(out), /Search is free\. No card needed\. Suppliers claim their record at no cost\./);
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

  it("draws the sections in the board's order", () => {
    const t = text(page());
    // M3 (14 Oct 2026): the dark tour follows the hero (its end frame hands over to the tour's first), the marks strip
    // opens the paper proof after it, and the vignette grid stands where "Start in a minute" stood.
    const order = [
      "Bangladesh sourcing,",
      "Everything you do to vet a factory.",
      "Read from the registers that matter",
      "Vetting used to be a chase.",
      "Shortlist. Ask once. Compare.",
      "Quotes beside the facts.",
      "The list changes. We check again.",
      "Search, and never lose your place.",
      "Every message beside its RFQ.",
      "Four moments from a day's sourcing.",
      "Everything else a sourcing desk needs.",
      "Receipts, not opinions.",
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

  it("the hero scrubs by CSS alone: the copy, the dimming cloth and the results screen in one pinned scene, with no scrub classes the stylesheet does not define", () => {
    const out = page();
    const css = readFileSync(join(process.cwd(), "app/ds.css"), "utf8");
    assert.match(out, /<section data-tone="photo" aria-labelledby="home-title" class="mk-hero/);
    for (const c of ["mk-hero", "mk-hero-pin", "mk-hero-copy", "mk-hero-stage-wrap", "mk-hero-stage", "mk-hero-cloth", "mk-hero-dim"]) {
      assert.match(out, new RegExp(`class="[^"]*\\b${c}\\b`), `${c} in the page`);
      assert.match(css, new RegExp(`\\.${c}\\s*[,{]`), `${c} in app/ds.css`);
    }
    assert.match(css, /@supports \(animation-timeline: view\(\)\)/);
    assert.match(css, /prefers-reduced-motion: no-preference/, "the scrub is off under reduced motion");
    assert.match(css, /animation-range: contain 0% contain 30%/, "the copy fades over the first 30%");
  });

  it("the tour follows the hero on the dark ground: four items, Find open, each with its demo on real records", () => {
    const out = page();
    const t = text(out);
    assert.match(out, /<section data-tone="dark" aria-labelledby="home-tour"/);
    assert.equal((out.match(/aria-expanded="true"/g) ?? []).length, 1, "one item open");
    assert.equal((out.match(/aria-expanded="false"/g) ?? []).length, 3);
    // The closed items' lines are hidden by class as well as by attribute: a display class would otherwise win (first recording, 14 Oct).
    const panels = [...out.matchAll(/<div id="tour-item-[a-z]+"( hidden="")? class="([^"]*)"/g)];
    assert.equal(panels.length, 4);
    for (const [, hiddenAttr, cls = ""] of panels) assert.equal(cls.split(" ").includes("hidden"), hiddenAttr !== undefined, cls);
    for (const w of ["Find", "Check", "Ask", "Watch"]) assert.match(t, new RegExp(`\\b${w}\\b`));
    assert.match(out, /href="\/product\/search"[^>]*>See how/);
    assert.ok((t.match(/Real records as read \d{1,2} [A-Z][a-z]{2} \d{4}/g) ?? []).length >= 5, "the pinned demo and the four stacked ones are dated");
    assert.ok((out.match(/aria-label="Pause demo"/g) ?? []).length >= 9, "every demo and vignette has its pause button");
  });

  it("the ground crossfades section by section: the main landmark carries the hero's tone and no second skip anchor", () => {
    const out = page();
    // React hoists the marks' image preloads ahead of the tree, so the landmark is the first element, not the first tag.
    assert.match(out, /^(?:<link [^>]*>)*<main data-tone="photo" class="[^"]*bg-\[rgb\(var\(--mk-ground-paper\)\)\]/);
    assert.doesNotMatch(out, /id="main-content"/, "the shell carries the skip link's anchor");
    const tones = [...out.matchAll(/data-tone="(photo|dark|paper)"/g)].map((m) => m[1]).slice(1);
    assert.deepEqual(tones, ["photo", "dark", "paper", "dark", "paper", "photo", "paper", "dark"]);
  });

  it("the vignette grid draws its four moments where Start in a minute stood", () => {
    const t = text(page());
    assert.match(t, /Four moments from a day's sourcing\./);
    for (const w of ["Every certificate carries its date", "Every source, in trust order", "Quotes land beside each other", "A listing is never hidden by layout"]) assert.match(t, new RegExp(w));
    assert.doesNotMatch(t, /Start in a minute/);
  });

  it("frames only the marks the logos lock allows, with the code under each", () => {
    const out = page();
    for (const c of ["EPB", "RSC", "BGMEA", "BKMEA", "BTMA", "BGAPMEA", "GOTS", "OEKO-TEX", "WRAP"]) assert.match(out, new RegExp(`>${c}</span>`), c);
    assert.doesNotMatch(out, /bepza|dife/i);
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

  it("every screen says what it shows, and every backdrop is decoration", () => {
    const out = page();
    for (const img of out.match(/<img [^>]*>/g) ?? []) {
      if (/\/site\/home\/screen-/.test(img)) assert.match(img, /alt="[^"]{12,}"/, img);
      else if (/\/site\/home\//.test(img)) assert.match(img, /alt=""/, img);
    }
    assert.match(out, /alt="SourceBD search results[^"]*"[^>]*fetchPriority="high"|fetchPriority="high"[^>]*alt="SourceBD search results/);
  });

  it("one material system: the backdrops are cotton and weave only, and the night is drawn, never photographed (critique 22 Oct, S3)", () => {
    const stills = new Set([...page().matchAll(/\/site\/home\/([a-z-]+)-1600\.(?:avif|webp)/g)].map((m) => m[1]));
    for (const s of stills) assert.ok(s === "hero-cotton" || s === "weave", s);
    assert.ok(stills.has("weave"));
  });

  it("the first paint waits for no slow read: the chips' counts and the three records stream in (critique 22 Oct, S9)", () => {
    const route = readFileSync(join(process.cwd(), "app/(home)/page.tsx"), "utf8");
    assert.match(route, /<Suspense fallback=\{<Chips chips=\{chipsOf\(\)\} pending \/>\}>/);
    const body = route.slice(route.indexOf("export default async function HomePage"));
    assert.ok(body.length < route.length, "the page function");
    assert.doesNotMatch(body, /loadChips|await loadHomeRecords|await Promise\.all/);
  });

  it("the streamed parts land in their own places: the chips in the hero, the record and the three cards in the proof", () => {
    const mark = (id: string) => createElement("p", { "data-slot": id }, id);
    const t = text(draw(createElement(HomeMercury, { facts: LIVE, slots: { chips: mark("chips-slot"), inside: mark("inside-slot"), records: mark("records-slot") } })));
    const order = ["on the record.", "chips-slot", "Everything you do to vet a factory.", "Vetting used to be a chase.", "inside-slot", "records-slot", "Four moments from a day's sourcing."];
    let at = -1;
    for (const s of order) {
      const i = t.indexOf(s, at + 1);
      assert.ok(i > at, `"${s}" comes after the one before it`);
      at = i;
    }
    assert.doesNotMatch(t, /Inside one record\./, "a slot takes the section's place");
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
const CALLOUT = { icon: "rosette" as const, title: "GOTS-27605 · expired 4 Apr 2026", sub: "GSCS International Ltd. · GOTS database · read 26 Jun 2026", tone: "caution" as const };
const live = (over: Partial<Parameters<typeof HomeMercury>[0]> = {}) => draw(createElement(HomeMercury, { facts: LIVE, cards: [CARD], callouts: [CALLOUT], chips: [{ key: "a", title: "GOTS-certified knitwear", href: "/app/discover?hs=6109", count: 205 }, { key: "b", title: "Buying houses in Dhaka", href: "/app/discover?entity=buying_house", count: null }], ...over }));

describe("the live sections", () => {
  it("the figures are the site's facts, the two true-by-definition ones always, and a figure not read is left out", () => {
    const t = text(live());
    for (const f of ["10,278 Bangladesh garment suppliers published", "14 of 21 public sources holding records", "4,289 certificates on file", "50 suppliers reached by one RFQ", "0 scores, grades or stars on any supplier"]) assert.match(t, new RegExp(f), f);
    assert.match(t, /the latest register read was 9 Oct 2026/);
    const bare = text(live({ facts: NO_FACTS }));
    assert.doesNotMatch(bare, /garment suppliers published|public sources holding records|certificates on file|latest register read/);
    assert.match(bare, /50 suppliers reached by one RFQ/);
    assert.match(bare, /0 scores, grades or stars on any supplier/);
  });

  it("a chip shows its count only when the count was read, and links to its search", () => {
    const out = live();
    assert.match(out, /href="\/app\/discover\?hs=6109"[^>]*>.*?GOTS-certified knitwear<\/span><span[^>]*>205<\/span>/);
    assert.match(out, /Buying houses in Dhaka<\/span><\/a>/);
    assert.doesNotMatch(text(live({ chips: [] })), /GOTS-certified knitwear/);
  });

  it("the real records and the callouts carry their sources and dates; with none read, neither is drawn", () => {
    const t = text(live());
    assert.match(t, /Real records, not reviews\./);
    assert.match(t, /WRAP 7865 · valid to 25 Aug 2027 WRAP register · read 8 Oct 2026/);
    assert.match(t, /GOTS-27605 · expired 4 Apr 2026 GSCS International Ltd\. · GOTS database · read 26 Jun 2026/);
    assert.match(live(), /href="\/suppliers\/aboni-knitwear"[^>]*>Aboni Knitwear Ltd</);
    const none = text(live({ cards: [], callouts: [] }));
    // The Watch demo lists the same lapsed certificate from the snapshot; the callout's own wording is what must go.
    assert.doesNotMatch(none, /Real records, not reviews|GOTS-27605 · expired|What the record shows/);
    assert.match(none, /Inside one record\./, "the dated screen still stands");
  });

  it("Buy with confidence: four tabs, every panel in the page, the sanctioned company a placeholder", () => {
    const out = live();
    assert.equal((out.match(/role="tab"/g) ?? []).length, 4);
    assert.equal((out.match(/role="tabpanel"/g) ?? []).length, 4);
    assert.equal((out.match(/aria-selected="true"/g) ?? []).length, 1);
    assert.match(text(out), /A sanctioned supplier is marked on every surface\./);
    assert.match(out, /alt="A placeholder supplier, Example Apparel Ltd, marked sanctioned/);
    assert.match(text(out), /“No link found” is not a clearance/);
  });

  it("a callout the record no longer holds leaves its slot empty: the others keep their own rows", () => {
    const out = live({ callouts: [null, { ...CALLOUT, title: "GOTS-31587 · valid to 12 May 2027", tone: undefined }, null] });
    // Slot 2 of the board: the card at (880, 290) of the 1280×830 stage.
    assert.match(out, /left:68\.75%;top:34\.93975903614458%"><span[^>]*>GOTS-31587/);
    assert.doesNotMatch(out, /top:22\.89156626506024%/, "slot 1 is empty");
  });

  it("the real records say how many were read", () => {
    assert.match(text(live()), /We have no testimonials and will not invent them\. One record as production holds it/);
    assert.match(text(live({ cards: [CARD, { ...CARD, slug: "x" }] })), /Two records as production holds them/);
  });

  it("motion never hides anything on the server: no element waits, the figures are final, and the loop is not in the first paint", () => {
    const out = live();
    // No figure counts up under "Not rounded" (critique 22 Oct, S7).
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
    assert.equal("CountUp" in require("@/components/site/sections/reveal"), false);
    assert.doesNotMatch(out, /data-reveal=/, "only the browser holds a section back, and only one below the fold");
    assert.doesNotMatch(out, /<video/, "the loop is added after load, never under reduced motion or Save-Data");
    assert.match(text(out), /10,278 Bangladesh garment suppliers published/);
    for (const m of out.match(/group-data-\[reveal=wait\]\/reveal:\S+/g) ?? []) assert.match(m, /opacity-0|translate-y-\d/, m);
  });
});

