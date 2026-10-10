// The home film (handoff-home-film §3 to §6, rebuilt after the founder's video of 7 Oct 2026): the dark set and its
// contrast, the Pane's legibility over what may pass behind it, what Tailwind really emits for the theme and the
// film's classes, the search, the home page with the film off and on, the tier and the flag, the engine's
// arithmetic (the scroll and its scrub, the opening's handover, the planet, the map), and the shape of the data files.

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { NIGHT_INHERITS, contrastRatio, dark, darkPairs, filmColors, filmPairs, light, paneBehind, paneGlass, paneGround, resolve, toRgb } from "@/lib/design/tokens";
import { SCRUB, SETTLED, ease, sceneProgress, scrub } from "./engine/director";
import { BOX, CHATTOGRAM, DISTRICTS, FOV, MARKS, ORIGIN, RISE, STRIDE, blocks, cameraAt, glowGrid, groundLines, handoverFrame as cityHandover, projectWith, toLocal, towerHeight, unpack, viewProj, type BdData } from "./engine/city";
import { HOME, blendFrame, defaultFrame, facing, frameFor, isLand, landPoints, lightSize, project, toVec } from "./engine/planet";
import { CITY_STEPS, OPENING, cityAt, openingAt, type CellFile } from "./engine/start";
import { V4Film } from "@/app/dev/ds/v4-film";
import { Home } from "@/components/site/home";
import DataSourcesPage from "@/app/(marketing)/legal/data-sources/page";
import { parseFacts, readDay, withCommas } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { TIER_SCRIPT, filmOn, pickTier, type Device } from "./engine/tier";
import { CHATTOGRAM_LINE, LIGHTS, LIGHTS_FILE, MAP_CREDIT } from "./opening";
import { Pane, SearchField } from "./pane";

const repoRoot = process.cwd();
const draw = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const keysOf = (set: Record<string, Record<string, string>>) => Object.entries(set).flatMap(([g, keys]) => Object.keys(keys).map((k) => `${g}.${k}`)).sort();

describe("the dark set", () => {
  it("has a value for every name in the light set, and nothing else", () => {
    assert.deepEqual(keysOf(dark), keysOf(light));
    for (const [group, keys] of Object.entries(dark)) for (const [key, hex] of Object.entries(keys)) assert.doesNotThrow(() => toRgb(hex), `${group}.${key}`);
  });

  it("is dark: the ground is darker than the ink, and darker than the light set's ground", () => {
    assert.ok(contrastRatio(resolve(dark, "ink"), resolve(dark, "surface")) > 15);
    assert.ok(contrastRatio(resolve(dark, "surface"), resolve(light, "surface")) > 15);
  });

  for (const pair of darkPairs) {
    it(`dark: ${pair.fg} on ${pair.bg} is at least ${pair.min}:1 (${pair.use})`, () => {
      const ratio = contrastRatio(resolve(dark, pair.fg), resolve(dark, pair.bg));
      assert.ok(ratio >= pair.min, `${ratio.toFixed(2)}:1. Fix the value in darkColors.`);
    });
  }

  for (const pair of filmPairs) {
    it(`light: ${pair.fg} on ${pair.bg} is at least ${pair.min}:1 (${pair.use})`, () => {
      assert.ok(contrastRatio(resolve(light, pair.fg), resolve(light, pair.bg)) >= pair.min);
    });
  }

  it("green text is its own role: the fill's value in light, a lighter green in dark", () => {
    assert.equal(filmColors["brand-ink"], resolve(light, "brand"));
    assert.notEqual(resolve(dark, "brand.ink"), resolve(light, "brand.ink"));
  });
});

describe("the Pane's glass", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const [which, behind] of Object.entries(paneBehind[theme])) {
      for (const fg of ["ink", "ink.2", "ink.3", "brand.ink", "caution"]) {
        it(`${theme}: ${fg} holds 4.5:1 on glass over the ${which} thing behind it`, () => {
          const ratio = contrastRatio(resolve(theme === "light" ? light : dark, fg), paneGround(theme, behind));
          assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1 on ${paneGround(theme, behind)}. Raise paneGlass.${theme}.tint.`);
        });
      }
    }
  }

  it("is still glass: the tint lets at least a quarter of the backdrop through", () => {
    assert.ok(paneGlass.light.tint <= 0.75 && paneGlass.dark.tint <= 0.75);
  });
});

describe("what Tailwind emits", () => {
  /* eslint-disable @typescript-eslint/no-require-imports -- tailwind's loader and postcss are CommonJS tools */
  const postcss = require("postcss") as typeof import("postcss").default;
  const tailwind = require("tailwindcss") as (config: object) => import("postcss").AcceptedPlugin;
  const loadConfig = require("tailwindcss/loadConfig") as (file: string) => Record<string, unknown>;
  /* eslint-enable @typescript-eslint/no-require-imports */
  const classes = ["has-[input:focus-visible]:outline-focus", "text-brand-ink", "text-brand-on", "bg-map-water", "text-film-hero", "text-film-figure-phone", "rounded-pane", "max-sm:rounded-pane-phone", "pane", "pane-glass", "ov-seam", "film-full:z-raised", "film:hidden", "film-full:hidden"];
  const compiled = postcss([tailwind({ ...loadConfig(path.join(repoRoot, "tailwind.config.ts")), content: [{ raw: classes.join(" "), extension: "html" }] })])
    .process(readFileSync(path.join(repoRoot, "app/ds.css"), "utf8"), { from: undefined })
    .then((r) => r.css.replace(/\s+/g, " "));
  const block = (css: string, opener: string) => {
    const i = css.indexOf(opener);
    assert.ok(i >= 0, `no ${opener}`);
    return css.slice(i, css.indexOf("}", i));
  };

  it("light on :root, as before, with the pane's light material", async () => {
    const root = block(await compiled, ":root {");
    assert.match(root, /--ds-surface: 255 255 255;/);
    assert.match(root, /--ds-brand-ink: 27 94 32;/);
    assert.match(root, /--pane-tint: 0\.68;/);
    assert.doesNotMatch(root, /color-scheme/);
  });

  it("dark only where the system asks for it AND the page opted in, by a selector that outranks `html`", async () => {
    const css = await compiled;
    const at = css.indexOf("@media (prefers-color-scheme: dark)");
    assert.ok(at >= 0, "no dark media block");
    const night = block(css.slice(at), ":root:has([data-theme-auto]) {");
    assert.match(night, /--ds-surface: 16 18 20;/);
    assert.match(night, /--ds-ink: 242 244 246;/);
    assert.match(night, /--ds-brand-ink: 123 211 137;/);
    assert.match(night, /--ds-brand: 111 207 127;/, "the dark theme sets its own button green, which its night scenes then inherit");
    assert.match(night, /--ds-brand-on: 16 18 20;/);
    assert.match(night, /--pane-tint: 0\.7;/);
    assert.match(night, /color-scheme: dark/);
    assert.match(css, /html \{ color-scheme: light;/, "every page without the attribute stays light");
  });

  it("a night scene carries the same dark variables in either theme, but the page's own button green", async () => {
    const night = block(await compiled, '[data-ground="night"] {');
    assert.match(night, /--ds-surface: 16 18 20;/);
    assert.match(night, /--ds-map-light: 255 241 214;/);
    assert.match(night, /--ds-brand-ink: 123 211 137;/, "green text is still the dark set's");
    for (const name of NIGHT_INHERITS) assert.doesNotMatch(night, new RegExp(`${name}:`), `${name} is the theme's, so the hero's button is the nav's`);
    assert.deepEqual([...NIGHT_INHERITS].sort(), ["--ds-brand", "--ds-brand-active", "--ds-brand-hover", "--ds-brand-on"]);
  });

  it("the film's sizes, radius and colours are classes", async () => {
    const css = await compiled;
    assert.match(block(css, ".text-film-hero {"), /font-size: 104px; line-height: 1\.02/);
    assert.match(block(css, ".text-film-figure-phone {"), /font-size: 96px; line-height: 0\.9/);
    assert.match(block(css, ".rounded-pane {"), /border-radius: 20px/);
    assert.match(css, /@media not all and \(min-width: 640px\) \{ \.max-sm\\:rounded-pane-phone \{ border-radius: 16px/);
    assert.match(block(css, ".text-brand-ink {"), /--ds-brand-ink/);
    assert.match(block(css, ".bg-map-water {"), /--ds-map-water/);
  });

  it("glass blurs its backdrop (with the -webkit- twin) and is solid where it cannot, and on the lite and still tiers", async () => {
    const css = await compiled;
    const glass = block(css, ".pane-glass {");
    assert.match(glass, /-webkit-backdrop-filter: var\(--pane-filter\)/);
    assert.match(glass, /; backdrop-filter: var\(--pane-filter\)/);
    assert.match(glass, /background-color: rgb\(var\(--ds-surface\) \/ var\(--pane-tint\)\)/);
    assert.match(css, /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\) \{ \.pane-glass \{[^}]*background-color: rgb\(var\(--ds-surface\)\)/);
    assert.match(css, /:is\(\[data-film-tier="lite"\], \[data-film-tier="still"\]\) \.pane-glass \{[^}]*backdrop-filter: none/);
  });

  it("under reduced motion nothing waits either: a delayed entrance would sit hidden, then pop", async () => {
    const css = await compiled;
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    assert.match(reduced, /animation-delay: 0s !important/);
  });

  it("the search pane's focus ring is a real rule", async () => {
    const css = await compiled;
    assert.ok(css.includes(":has(input:focus-visible) { outline-color: rgb(var(--ds-focus)"), "no has-[input:focus-visible]:outline-focus rule");
  });

  it("what has gone in the handover lets the pointer through but stays in the page, and comes back for keyboard focus; nothing on the page is restyled by a scroll-written property", async () => {
    const css = await compiled;
    assert.match(css, /\[data-film-tier="full"\] :is\(\[data-act="planet"\]\[data-past\], \[data-hero\]\[data-gone\] > \*\) \{ pointer-events: none/);
    assert.doesNotMatch(css, /\[data-gone\][^{]*\{[^}]*visibility: hidden|\[data-past\][^{]*\{[^}]*visibility: hidden/, "the headline, the search and the two ways in stay the page's for a screen reader");
    assert.match(css, /\[data-hero\]\[data-gone\]:has\(:focus-visible\) \{ opacity: 1 !important; transform: none !important/);
    assert.match(css, /\[data-act="planet"\]\[data-past\]:has\(:focus-visible\) \{ opacity: 1 !important; pointer-events: auto/);
    // The only scroll-written properties CSS reads sit on the small things that read them: a drawing's parts, a window, the cursor.
    assert.doesNotMatch(css, /var\(--hand|var\(--words|var\(--film-p/);
    assert.match(block(css, ".film-full\\:z-raised {"), /z-index: 10/);
    assert.match(css, /:is\(\[data-film-tier="full"\], \[data-film-tier="lite"\]\) \.film\\:hidden \{ display: none/);
  });

  it("the seam is drawn by --p on itself, and is whole when nothing is written", async () => {
    assert.match(block(await compiled, ".ov-seam {"), /stroke-dasharray: 1; stroke-dashoffset: calc\(1 - var\(--p, 1\)\)/);
  });

  it("the primary button's label is the brand's own label colour, so it follows the button's fill", async () => {
    assert.match(block(await compiled, ".text-brand-on {"), /--ds-brand-on/);
  });
});

describe("the Pane family", () => {
  it("a pane is solid unless asked for glass", () => {
    assert.match(draw(Pane({ children: "x" })), /^<div class="pane rounded-pane p-6[^"]*">x<\/div>$/);
    assert.match(draw(Pane({ material: "glass", children: "x" })), /class="pane pane-glass /);
  });

  it("the search pane runs on public Discover, as the hero's form does, with the kit's primary button", () => {
    const field = draw(createElement(SearchField, { id: "q", material: "glass" }));
    assert.match(field, /^<form[^>]*action="\/discover"/);
    assert.match(field, /<form[^>]*role="search"/);
    assert.match(field, /<form[^>]*method="get"/);
    assert.match(field, /<label for="q" class="sr-only">/);
    assert.match(field, /<input[^>]*name="q"/);
    assert.match(field, /<button type="submit" class="[^"]*bg-brand text-brand-on hover:bg-brand-hover[^"]*"/, "the nav's own button, not a copy of it");
  });

  it("the search pane wears the field's keyboard focus, since the field itself has no outline", () => {
    const field = draw(createElement(SearchField, { id: "q" }));
    assert.match(field, /<input[^>]*class="[^"]*outline-none/);
    assert.match(field, /<form[^>]*class="[^"]*has-\[input:focus-visible\]:outline-2[^"]*has-\[input:focus-visible\]:outline-focus/);
  });

  it("a caller's radius replaces the pane's, rather than sitting beside it", () => {
    assert.equal(cn("rounded-pane max-sm:rounded-pane-phone", "rounded-lg"), "max-sm:rounded-pane-phone rounded-lg");
    assert.doesNotMatch(/^<form class="([^"]*)"/.exec(draw(createElement(SearchField, { id: "q" })))?.[1] ?? "rounded-lg", /rounded-lg/);
  });
});

describe("/dev/ds", () => {
  const html = draw(createElement(V4Film));

  it("shows the film's section: every dark value beside its light one, and each board in both grounds", () => {
    for (const [name, hex] of Object.entries(filmColors)) assert.ok(html.includes(`>${name}</span>`) && html.includes(hex), name);
    assert.ok(html.includes(resolve(dark, "surface")) && html.includes(resolve(dark, "brand.ink")));
    assert.equal((html.match(/data-ground="night" class="flex flex-col gap-3 rounded-lg/g) ?? []).length, 4, "four boards, each drawn once more in a night scope");
    assert.match(html, /<svg data-overlock="true"/);
    assert.match(html, /role="search"/);
    assert.doesNotMatch(html, /roll-print|aria-label="Supplier record|class="thread/, "the roll, the record card and the thread are gone");
    assert.match(html, /text-film-figure /);
  });
});

describe("the home page, film off and film on", () => {
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  const facts = parseFacts(
    { suppliers_indexed: 10268, last_refreshed_at: "2026-10-02T05:48:07Z" },
    { sources_listed: 25, sources_with_records: 14, certificates_on_file: 4275, certificates_expired: 518, rsc_records: 2331, latest_read: "2026-10-02T05:48:07Z", sources: [] },
  );
  const page = (film?: boolean) => draw(createElement(AppRouterContext.Provider, { value: router as never }, createElement(Home, { facts, film })));
  const off = page();
  const on = page(true);
  const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/&#x27;|&rsquo;/g, "'").replace(/\s+/g, " ");

  it("with the film off the page carries nothing of the film", () => {
    assert.equal(off, page(false));
    assert.doesNotMatch(off, /data-film|data-scene|data-theme-auto|data-ground|data-beat|data-roll|<script|<canvas|pane-glass/);
    assert.match(off, /<main class="font-sans text-ink">/);
  });

  it("with the film on, the page opts in to the system's theme and sets its tier before anything is drawn", () => {
    assert.match(on, /<main class="font-sans text-ink" data-film="" data-theme-auto=""><script>document\.documentElement\.dataset\.filmTier=/);
  });

  it("the opening says less: the one headline, one line and the search on public Discover; the two ways in are in the nav and the close", () => {
    assert.equal((on.match(/<h1/g) ?? []).length, 1);
    assert.match(on, /<h1[^>]*>Know who you.re buying from\.<\/h1>/);
    const hero = on.slice(on.indexOf("<div data-hero"), on.indexOf("<canvas data-city"));
    assert.equal((hero.match(/id="hero-q"/g) ?? []).length, 1);
    assert.match(hero, /<form[^>]*action="\/discover"/);
    assert.match(text(hero), /10,268 Bangladesh garment suppliers, each checked against the registers that list them\./);
    assert.doesNotMatch(text(hero), /Try .knit dresses|updated \d/, "no hint line and no mono label: the first screen was too heavy");
    assert.doesNotMatch(hero, /href="\/signup"|href="\/contact"/);
    const close = on.slice(on.indexOf('data-scene="close"'));
    assert.match(close, /href="\/signup"[^>]*>Start free/);
    assert.match(close, /href="\/contact"[^>]*>Book a demo/);
  });

  it("the opening is one scene, night in either theme, with the planet's act over the city; the planet carries no labels, leads or thread, and no map is left", () => {
    assert.match(on, /<section id="ch-1" data-scene="opening" class="[^"]*"><div data-ground="night" class="/);
    assert.match(on, /<div data-scene="planet" data-act="planet" class="[^"]*film-full:absolute[^"]*film-full:z-raised/);
    assert.ok(on.indexOf('data-act="planet"') < on.indexOf("<canvas data-city"), "the planet's act comes first: the page's headline is still the first thing read");
    assert.match(on, /<canvas data-planet="true" aria-hidden="true"/);
    assert.match(on, /<canvas data-city="true" aria-hidden="true" class="[^"]*hidden[^"]*film-full:block/);
    assert.match(on, /<div data-city-labels="true" aria-hidden="true"/);
    assert.equal((on.match(/data-place="true"/g) ?? []).length, DISTRICTS.length);
    assert.match(on, /data-city-factory="true"[^>]*>[\s\S]*?Mondol Fabrics Ltd\.[\s\S]*?the area, not the building/, "the block is an area, not a building, and says so");
    assert.doesNotMatch(on, /data-planet-callouts|data-planet-leads|data-planet-thread|data-map-thread|data-map=|bkoi/);
    assert.deepEqual([...on.matchAll(/data-scene="([a-z]+)"/g)].map((m) => m[1]), ["opening", "planet", "sources", "proof", "watch", "order", "promises", "close"]);
  });

  it("the lite tier's planet can stick: nothing between its stage and the page clips overflow", () => {
    const wrapper = /<section id="ch-1"[^>]*><div data-ground="night" class="([^"]*)">/.exec(on)?.[1] ?? "";
    assert.doesNotMatch(wrapper, /(^|\s)overflow-(hidden|auto|scroll)(\s|$)/, wrapper);
    assert.match(wrapper, /film-full:overflow-hidden/);
    assert.doesNotMatch(/<div data-scene="planet"[^>]*><div class="([^"]*)"/.exec(on)?.[1] ?? "", /film-full:static|film-full:h-full/, "no class that undoes the hold on the full tier: the planet's act is laid over the stage there");
  });

  it("the tiers that do not draw live get pictures, lazily and in the system's theme, and the full tier hides them", () => {
    const planet = on.slice(on.indexOf("<picture"), on.indexOf("</picture>"));
    assert.match(planet, /^<picture class="absolute inset-0 block film:hidden"><source media="\(max-width: 767px\)" srcSet="\/site\/film\/planet-upright\.avif"\/><img src="\/site\/film\/planet\.avif" alt="" loading="lazy" decoding="async"/, "lazy, so the tiers that hide it never fetch it");
    // The city is night in either theme, as the live one is: one picture each, no theme pair.
    const stills = [...on.matchAll(/<img src="(\/site\/film\/city-[a-z]+\.avif)" alt="" width="1200" height="750" loading="lazy" decoding="async" class="[^"]*film-full:hidden/g)];
    assert.deepEqual(stills.map((m) => m[1]), ["/site/film/city-belt.avif", "/site/film/city-site.avif"]);
    const files = readdirSync(path.join(repoRoot, "public/site/film"));
    for (const src of ["/site/film/planet.avif", "/site/film/planet-upright.avif", ...stills.map((m) => m[1]!)]) assert.ok(files.includes(path.basename(src)), `${src} is not in public/site/film`);
    assert.ok(!files.some((f) => f.startsWith("map-")), "the map's pictures went with the map");
    for (const name of files.filter((x) => x.endsWith(".avif"))) assert.ok(statSync(path.join(repoRoot, "public/site/film", name)).size < 160_000, `${name} is heavier than the budget allows`);
  });

  it("the city's ground data is credited on the stage, on the stacked page and on /legal/data-sources", () => {
    assert.equal((on.match(new RegExp(MAP_CREDIT.replace(/\./g, "\\."), "g")) ?? []).length, 2, "on the opening's stage and under its stacked picture");
    const legal = text(draw(createElement(AppRouterContext.Provider, { value: router as never }, createElement(DataSourcesPage))));
    assert.match(legal, /8\. The map on the home page/);
    assert.match(legal, /Bangladesh Bureau of Statistics and OCHA ROAP/);
    assert.match(legal, /geoBoundaries/);
    assert.match(legal, /CC BY 3\.0 IGO/);
    assert.match(legal, /Natural Earth/);
    assert.match(legal, /No address, name or identifier is published for it/);
    assert.match(legal, /the blocks of the city are our own count of published suppliers per square kilometre/);
    assert.match(legal, /Last updated 11 Oct 2026/);
  });

  it("the first screen keeps to one pane of glass, and the planet can be reached through the words", () => {
    const first = on.slice(on.indexOf('data-act="planet"'), on.indexOf("<canvas data-city"));
    assert.equal((first.match(/pane-glass/g) ?? []).length, 1);
    assert.match(first, /class="[^"]*pointer-events-none relative flex flex-col items-start[^"]*\[&amp;&gt;\*\]:pointer-events-auto/);
  });

  it("the lights are said in words: the file's two counts and the day it was read, and nothing the file does not say", () => {
    const file = JSON.parse(readFileSync(path.join(repoRoot, "public/site/film/cells.json"), "utf8")) as CellFile;
    assert.ok(text(on).includes(LIGHTS));
    assert.deepEqual({ ...LIGHTS_FILE }, { date: file.date, mapped: file.mapped, suppliers: file.suppliers }, "LIGHTS_FILE in opening.tsx repeats the file: paste what build-cells.mjs printed");
    assert.equal(LIGHTS, `One block per km² with suppliers, taller where there are more · ${withCommas(file.mapped)} of ${withCommas(file.suppliers)} have a mapped register address · ${readDay(file.date)}`, "the source is named in the fact itself: the registers' addresses");
  });

  it("the four district counts are all in the page, dated, with no total, and none counts up", () => {
    const t = text(on);
    for (const n of ["4,421", "1,819", "1,628", "1,080"]) assert.ok(t.includes(n), n);
    assert.ok(t.includes(CHATTOGRAM_LINE) && CHATTOGRAM_LINE === "Chattogram, down the coast, has 1,080 more.", "the fourth is said in words: it lies out of the city's frame");
    assert.match(t, /Most sit in four districts\./);
    assert.match(t, /as counted on 3 Oct 2026/);
    assert.equal((on.match(/id="ch-1"/g) ?? []).length, 1);
    const steps = on.slice(on.indexOf("<ol data-steps"), on.indexOf("</ol>", on.indexOf("<ol data-steps")));
    assert.equal((steps.match(/<li data-on=""/g) ?? []).length, 1, "one district is on at a time, the first to begin with");
    assert.match(steps, /film-full:sr-only/, "a district that is not on stays in the page for a screen reader");
    assert.doesNotMatch(steps, /film-full:hidden(?!\s*film-full:inline)|film-full:invisible/);
    assert.doesNotMatch(/<div data-act="record" class="([^"]*)"/.exec(on)?.[1] ?? "invisible", /invisible|hidden/);
    assert.doesNotMatch(t, /\b4[0-9] districts\b|districts in all|districts mapped/);
    assert.doesNotMatch(on, /count-?up|data-count|aria-valuenow/);
  });

  it("the story's factory is real and dated, and no card, thread, rail or numbered label is left anywhere in the film", () => {
    const t = text(on);
    assert.match(t, /Follow one factory down the page\./);
    assert.match(t, /A real record, as it stands on 3 Oct 2026\./);
    for (const dated of ["reg. no. 4002 · 24 Jul 2026", "exporter 2798 · 14 Aug 2026", "1004-B/2006 · 2 Aug 2026", "GOTS-19020 · 26 Jun 2026", "factory 10861 · 24 Jul 2026"]) assert.ok(t.includes(dated), `${dated}: each source's own number and day stay in the words`);
    assert.doesNotMatch(on, /aria-label="Supplier record|class="thread|data-tie|data-roll|rec-arrive|aria-label="Chapters"|data-chapter=/);
    assert.doesNotMatch(on, /rounded-lg border border-line/, "no bordered card");
    assert.doesNotMatch(t, /\b0[1-9] · /, "no numbered label above a headline");
    assert.doesNotMatch(t, /Export records are coming/, "the export records carry no figure until v2, so they get no scene");
  });

  it("the scenes run in the story's order, each id once, and the film is about fifteen screens, not forty-six", () => {
    const ids = [...on.matchAll(/<section id="(ch-[0-9]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids, ["ch-1", "ch-02", "ch-03", "ch-04", "ch-05", "ch-06", "ch-07", "ch-08"]);
    const heights = [...on.matchAll(/film-full:h-\[(\d+)svh\]/g)].map((m) => Number(m[1]));
    const screens = heights.reduce((a, b) => a + b, 0) / 100;
    assert.ok(screens <= 16, `${screens} screens of held scenes`);
  });

  it("with the film on, the close carries the last words and the search on the planet; the FAQ after it is the page's own", () => {
    const close = on.slice(on.indexOf('<section id="ch-08"'), on.indexOf('id="faq"'));
    assert.match(close, /data-scene="close" data-ground="night"/);
    assert.match(close, /<div data-planet-close="true" aria-hidden="true"/);
    assert.match(text(close), /Now you know who you.re buying from\. Do the same for any of 10,268 suppliers\. Search is free\./);
    assert.match(close, /id="close-q"/);
    assert.equal((on.match(/Now you know who you/g) ?? []).length, 1, "said once: the shared closing section is the page without the film's");
    assert.equal(on.slice(on.indexOf('id="faq"')), off.slice(off.indexOf('id="faq"')));
  });
});

describe("the tier and the flag", () => {
  const desk: Device = { width: 1440, finePointer: true, webgl2: true, reducedMotion: false, saveData: false };

  it("a desktop with a fine pointer and WebGL2 gets the full film; a phone or a tablet the lite one", () => {
    assert.equal(pickTier(desk), "full");
    assert.equal(pickTier({ ...desk, width: 1024 }), "full");
    assert.equal(pickTier({ ...desk, width: 1023 }), "lite");
    assert.equal(pickTier({ ...desk, finePointer: false }), "lite", "a touch laptop or a large tablet");
    assert.equal(pickTier({ ...desk, width: 390, finePointer: false }), "lite");
  });

  it("reduced motion, data saver or no WebGL2 gets today's still page, whatever the screen", () => {
    for (const off of [{ reducedMotion: true }, { saveData: true }, { webgl2: false }]) {
      assert.equal(pickTier({ ...desk, ...off }), "still", JSON.stringify(off));
      assert.equal(pickTier({ ...desk, width: 390, finePointer: false, ...off }), "still");
    }
  });

  it("the film is the page: on unless the build says NEXT_PUBLIC_HOME_FILM=0 or the address says film=0; film=1 wins over the build", () => {
    assert.equal(filmOn(undefined, undefined), true);
    assert.equal(filmOn("", ""), true);
    assert.equal(filmOn(undefined, "1"), true);
    assert.equal(filmOn(undefined, "0"), false, "the build's switch");
    assert.equal(filmOn("0", undefined), false, "one visit to the stacked page");
    assert.equal(filmOn("0", "1"), false);
    assert.equal(filmOn("1", "0"), true, "a look at the film on a build that turned it off");
    assert.equal(filmOn(["1", "1"], "0"), false, "a repeated parameter is not the flag");
    assert.equal(filmOn("true", undefined), true, "anything but 0 leaves the build's answer");
  });

  it("the tier is set on the root before the first paint, by the same rule, run here as the page runs it", () => {
    const run = (width: number, media: Record<string, boolean>, webgl2: boolean) => {
      const dataset: Record<string, string> = {};
      const document = { documentElement: { dataset } };
      const matchMedia = (q: string) => ({ matches: media[q] ?? false });
      new Function("document", "innerWidth", "matchMedia", "navigator", "WebGL2RenderingContext", TIER_SCRIPT)(document, width, matchMedia, {}, webgl2 ? class {} : undefined);
      return dataset.filmTier;
    };
    assert.equal(run(1440, { "(pointer: fine)": true }, true), "full");
    assert.equal(run(390, {}, true), "lite");
    assert.equal(run(1440, { "(pointer: fine)": true, "(prefers-reduced-motion: reduce)": true }, true), "still");
    assert.equal(run(1440, { "(pointer: fine)": true }, false), "still");
    assert.doesNotMatch(TIER_SCRIPT, /getContext/, "no drawing context is made before the first paint");
  });
});

describe("the scroll's arithmetic", () => {
  it("a scene is 0 until its top reaches the top of the screen, 1 once its bottom reaches the bottom, and even between", () => {
    // 3,000 tall on a 1,000 screen: 2,000 of travel.
    assert.equal(sceneProgress(500, 3000, 1000), 0);
    assert.equal(sceneProgress(0, 3000, 1000), 0);
    assert.equal(sceneProgress(-500, 3000, 1000), 0.25);
    assert.equal(sceneProgress(-1000, 3000, 1000), 0.5);
    assert.equal(sceneProgress(-2000, 3000, 1000), 1);
    assert.equal(sceneProgress(-2600, 3000, 1000), 1);
  });

  it("a scene no taller than the screen has no hold: nothing divides by zero", () => {
    assert.equal(sceneProgress(10, 800, 1000), 0);
    assert.equal(sceneProgress(-10, 800, 1000), 1);
    assert.equal(sceneProgress(0, 1000, 1000), 1);
  });

  it("the scrub glides each step by the same share of the gap whatever the frame rate, and lands", () => {
    assert.equal(scrub(0.5, 0.5, 16), 0.5);
    const one = scrub(0, 0.1, SCRUB);
    assert.ok(Math.abs(one - 0.1 * (1 - Math.exp(-1))) < 1e-9, "after one lag, 63% of the step");
    // Two frames of 8 ms cover what one frame of 16 ms does.
    assert.ok(Math.abs(scrub(scrub(0, 0.1, 8), 0.1, 8) - scrub(0, 0.1, 16)) < 1e-9);
    assert.equal(scrub(0.2, 0.2 + SETTLED / 2, 16), 0.2 + SETTLED / 2, "a gap under the threshold lands at once");
    assert.equal(scrub(0, 0.9, 16), 0.9, "a jump across most of a scene (a link, a restored page) lands at once rather than replaying it");
    let p = 0;
    for (let i = 0; i < 120 && p !== 0.2; i++) p = scrub(p, 0.2, 16);
    assert.equal(p, 0.2, "a glide lands within two seconds");
    for (let i = 0, q = 0; i < 30; i++) {
      const next = scrub(q, 0.3, 16);
      assert.ok(next >= q && next <= 0.3, "never past the target, never back");
      q = next;
    }
  });

  it("the film's eases start and end where they should", () => {
    for (const f of [ease.out, ease.inOut]) {
      assert.equal(f(0), 0);
      assert.equal(f(1), 1);
      assert.equal(f(-1), 0);
      assert.equal(f(2), 1);
    }
    assert.ok(ease.out(0.25) > 0.25, "an arrival is fast first");
  });
});

describe("the opening's one scroll", () => {
  it("is four stretches in order: the dive, the words, the handover, the city; each 0 before and 1 after", () => {
    assert.deepEqual(openingAt(0), { dive: 0, words: 0, hand: 0, city: 0 });
    assert.deepEqual(openingAt(1), { dive: 1, words: 1, hand: 1, city: 1 });
    assert.ok(OPENING.dive[1] <= OPENING.hand[0], "the dive is done, and the planet still, before it starts to give way: one country through the crossfade");
    assert.ok(OPENING.words[1] <= OPENING.hand[1], "the words are gone before the planet is");
    assert.equal(OPENING.city[0], OPENING.hand[1], "the city's own scroll starts the moment the planet has given way");
    let last = openingAt(0);
    for (let p = 0.01; p <= 1; p += 0.01) {
      const at = openingAt(p);
      for (const k of ["dive", "words", "hand", "city"] as const) assert.ok(at[k] >= last[k] && at[k] <= 1, `${k} at ${p.toFixed(2)}`);
      last = at;
    }
    assert.equal(openingAt(OPENING.hand[1]).city, 0);
    assert.equal(openingAt(OPENING.dive[1]).dive, 1);
  });

  it("the dive ends where the city begins: the planet's home where the city's first camera draws it, a kilometre the same width on both", () => {
    const [w, h] = [1440, 900];
    const end = cityHandover(w, h);
    const rot = facing(HOME.lng, HOME.lat);
    const home = project(rot, end, HOME.lng, HOME.lat);
    const first = cameraAt(0);
    const m = viewProj(first, w, h);
    const [hx, hz] = toLocal(HOME.lng, HOME.lat);
    const there = projectWith(m, w, h, [hx, 0, hz]);
    assert.ok(Math.abs(home.x - there.x) < 1e-6 && Math.abs(home.y - there.y) < 1e-6, "the planet's home and the city's are one point");
    // Ten kilometres east of home, on both: the planet's degree and the city's kilometre agree within a pixel.
    const east = project(rot, end, HOME.lng + 10 / (111.32 * Math.cos((HOME.lat * Math.PI) / 180)), HOME.lat);
    const cityEast = projectWith(m, w, h, [hx + 10, 0, hz]);
    assert.ok(Math.abs(east.x - cityEast.x) < 1.5, `${east.x} vs ${cityEast.x}`);
    assert.ok(end.r > defaultFrame(0, w, h).r * 40, "the dive is a real dive: to one kilometre a block");
    assert.ok(first.eye[1] > 80 && Math.hypot(first.eye[0] - first.target[0], first.eye[2] - first.target[2]) < 1, "the city's first camera looks straight down, as the planet does");
  });

  it("a frame blends by ratio of radius, as a camera zooms", () => {
    const a = { cx: 0, cy: 0, r: 100 }, b = { cx: 100, cy: 50, r: 1600 };
    assert.deepEqual(blendFrame(a, b, 0), a);
    assert.deepEqual(blendFrame(a, b, 1), b);
    const mid = blendFrame(a, b, 0.5);
    assert.ok(Math.abs(mid.r - 400) < 1e-9 && Math.abs(mid.cx - 50) < 1e-9, "halfway is the geometric middle of the radii");
    assert.ok(Math.abs(frameFor(1683, 23.7, 0, 0).r * Math.cos((23.7 * Math.PI) / 180) * (Math.PI / 180) - 1683) < 1e-9);
  });
});

describe("the planet's arithmetic", () => {
  const apply = (m: number[], v: number[]) => [0, 3, 6].map((r) => m[r]! * v[0]! + m[r + 1]! * v[1]! + m[r + 2]! * v[2]!);
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

  it("facing a place brings it to the middle of the near side", () => {
    const [x, y, z] = apply(facing(HOME.lng, HOME.lat), toVec(HOME.lng, HOME.lat));
    assert.ok(near(x!, 0) && near(y!, 0) && near(z!, 1));
    const frame = { cx: 700, cy: 400, r: 300 };
    const at = project(facing(HOME.lng, HOME.lat), frame, HOME.lng, HOME.lat);
    assert.ok(Math.abs(at.x - 700) < 1e-6 && Math.abs(at.y - 400) < 1e-6 && at.front);
    assert.equal(project(facing(HOME.lng, HOME.lat), frame, HOME.lng - 180, -HOME.lat).front, false);
  });

  it("north is up and east is right of the place faced", () => {
    const frame = { cx: 0, cy: 0, r: 100 };
    const rot = facing(HOME.lng, HOME.lat);
    assert.ok(project(rot, frame, HOME.lng, HOME.lat + 5).y < 0);
    assert.ok(project(rot, frame, HOME.lng + 5, HOME.lat).x > 0);
  });

  it("land dots come only from the mask's land", () => {
    // The eastern hemisphere is land, the western is sea.
    const mask = { width: 4, height: 2, channels: 1, data: [0, 0, 255, 255, 0, 0, 255, 255] };
    assert.equal(isLand(mask, 90, 10), true);
    assert.equal(isLand(mask, -90, 10), false);
    assert.equal(isLand(mask, 180, -90), true, "the far edge is inside the bitmap");
    const pts = landPoints(mask, 2000);
    assert.ok(Math.abs(pts.length / 3 - 1000) < 30, `${pts.length / 3} of 2000`);
    for (let i = 0; i < pts.length; i += 3) {
      assert.ok(pts[i]! >= -1e-6, "x is east");
      assert.ok(near(Math.hypot(pts[i]!, pts[i + 1]!, pts[i + 2]!), 1) || Math.abs(Math.hypot(pts[i]!, pts[i + 1]!, pts[i + 2]!) - 1) < 1e-6);
    }
  });

  it("a light's size follows the count and stops growing", () => {
    assert.ok(lightSize(1) < lightSize(9) && lightSize(9) < lightSize(40));
    assert.equal(lightSize(100000), 10);
  });

  it("the scroll brings the camera in: the planet only grows, and stays on screen at rest", () => {
    const at = [0, 0.25, 0.5, 0.75, 1].map((p) => defaultFrame(p, 1440, 900));
    assert.ok(at.every((f, i) => i === 0 || f.r > at[i - 1]!.r));
    assert.ok(at[0]!.cx > 720 && at[0]!.cx < 1440 && at[0]!.cy > 0 && at[0]!.cy < 900);
  });

  it("on an upright screen Bangladesh, which the planet faces, is still on screen at rest and after the dive", () => {
    for (const p of [0, 1]) {
      const f = defaultFrame(p, 390, 844);
      assert.ok(f.cx > 0 && f.cx < 390 && f.cy > 0 && f.cy < 844, `p=${p}`);
    }
    assert.ok(defaultFrame(0, 390, 844).r < 390, "the whole width is not land");
  });
});

describe("the city's arithmetic", () => {
  const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e;

  it("its kilometres: the origin at the belt's middle, east is +x, north is -z, a degree of latitude about 111 km", () => {
    assert.deepEqual(toLocal(ORIGIN.lng, ORIGIN.lat), [0, -0]);
    assert.ok(toLocal(ORIGIN.lng + 0.1, ORIGIN.lat)[0] > 10);
    assert.ok(toLocal(ORIGIN.lng, ORIGIN.lat + 1)[1] < -110 && toLocal(ORIGIN.lng, ORIGIN.lat + 1)[1] > -111);
  });

  it("a block's height grows with the count, slower and slower, and never towers out of the city", () => {
    for (const [a, b] of [[1, 2], [2, 10], [10, 100], [100, 231]] as const) assert.ok(towerHeight(a) < towerHeight(b));
    assert.ok(towerHeight(231) < 1 && towerHeight(1) > 0.05, `${towerHeight(1)} to ${towerHeight(231)} km`);
    assert.ok(towerHeight(200) / towerHeight(10) < 2.5, "the log keeps one dense kilometre from dwarfing the rest: twenty times the suppliers, not twenty times the height");
  });

  it("the towers come from the cells and nothing else: two to sixteen to a cell, inside its kilometre, the tallest first, the same city every time", () => {
    const cells: [number, number, number][] = [[90.4, 23.85, 1], [90.41, 23.86, 64], [90.3218, 23.9819, 9], [91.8, 22.35, 40]];
    const a = blocks(cells, [90.3218, 23.9819]);
    assert.deepEqual([...a.towers], [...blocks(cells, [90.3218, 23.9819]).towers], "seeded by the cell, not by chance");
    assert.equal(a.towers.length, a.count * STRIDE);
    const perCell = [4, 16, 8]; // round(2 + 2 * sqrt(count)), from two to sixteen
    assert.equal(a.count, perCell.reduce((x, y) => x + y, 0), "Chattogram's cell lies outside the box and raises nothing");
    let k = 0;
    cells.slice(0, 3).forEach(([lng, lat, n], c) => {
      const [cx, cz] = toLocal(lng, lat);
      for (let i = 0; i < perCell[c]!; i++, k++) {
        const t = a.towers.subarray(k * STRIDE, (k + 1) * STRIDE);
        assert.ok(Math.abs(t[0]! - cx) < 0.5 && Math.abs(t[1]! - cz) < 0.5, "inside its kilometre");
        assert.ok(t[4]! <= towerHeight(n) + 1e-6 && t[4]! > 0);
        if (i === 0) assert.ok(near(t[4]!, towerHeight(n), 1e-6), "the first tower is the tallest");
        assert.equal(t[6], c === 2 ? 1 : 0, "the story's block is the cell nearest its geocode, and only that one");
      }
    });
    assert.equal(a.glows.length / 5, 3, "one soft light per block");
  });

  it("the story's own place is never typed into the engine: with none given, no block is the story's", () => {
    const b = blocks([[90.3218, 23.9819, 9]]);
    assert.equal(b.chosen, null);
    for (let k = 0; k < b.count; k++) assert.equal(b.towers[k * STRIDE + 6], 0);
    assert.equal(blocks([[90.3218, 23.9819, 9]], [90.6, 23.6]).chosen, null, "a geocode with no cell within a kilometre and a half picks none");
  });

  it("the camera is each mark at its own place, flies without a jump, and lands on the story's block", () => {
    const chosen: [number, number] = [90.3218, 23.9819];
    for (const m of MARKS) {
      const c = cameraAt(m.at, chosen);
      const [tx, tz] = m.target === "chosen" ? toLocal(...chosen) : toLocal(m.target[0], m.target[1]);
      assert.ok(near(c.target[0], tx, 1e-6) && near(c.target[2], tz, 1e-6) && near(c.dist, m.dist, 1e-6), `at ${m.at}`);
    }
    assert.deepEqual(cameraAt(-1), cameraAt(0));
    assert.deepEqual(cameraAt(2), cameraAt(1));
    for (let p = 0; p < 1; p += 0.005) {
      const [a, b] = [cameraAt(p), cameraAt(p + 0.005)];
      assert.ok(Math.hypot(a.eye[0] - b.eye[0], a.eye[1] - b.eye[1], a.eye[2] - b.eye[2]) < a.dist * 0.2, `a jump near ${p.toFixed(3)}`);
      assert.ok(b.dist <= a.dist + 1e-9, "the camera only comes down");
    }
    assert.ok(MARKS.every((m, i) => i === 0 || m.at > MARKS[i - 1]!.at));
    assert.ok(RISE[0] > 0 && RISE[1] < MARKS[2]!.at, "the towers have risen before the camera is among them");
  });

  it("the subject sits right of the middle, clear of the words, and straight down stays straight down", () => {
    const [w, h] = [1440, 900];
    for (const p of [0, 0.5, 1]) {
      const c = cameraAt(p);
      const at = projectWith(viewProj(c, w, h), w, h, c.target);
      assert.ok(near(at.x, ((1 + c.shift) / 2) * w, 1e-3) && near(at.y, h / 2, 1e-3) && at.front, `p=${p}: ${at.x}, ${at.y}`);
      assert.ok(c.shift >= 0.3, "the words keep the left");
    }
    assert.ok(FOV > 20 && FOV < 50);
  });

  it("the figures step whole, one district at a time in the order the camera meets them, then the story's factory", () => {
    assert.deepEqual(cityAt(0), { figure: 0, factory: false });
    assert.equal(cityAt(CITY_STEPS.figures[0]).figure, 1);
    assert.equal(cityAt(CITY_STEPS.figures[1]).figure, 2);
    assert.deepEqual(cityAt(1), { figure: 2, factory: true });
    assert.ok(CITY_STEPS.figures[0] > MARKS[1]!.at && CITY_STEPS.figures[1] > MARKS[2]!.at && CITY_STEPS.factory > MARKS[3]!.at, "a figure changes once the camera has reached its district");
  });

  it("the three districts are the counts of 3 Oct 2026 in the camera's order, with Chattogram said in words, and no total", () => {
    assert.deepEqual(DISTRICTS.map((d) => [d.label, d.count]), [["Narayanganj", 1628], ["Dhaka district", 4421], ["Gazipur", 1819]]);
    assert.deepEqual([CHATTOGRAM.label, CHATTOGRAM.count], ["Chattogram", 1080]);
  });

  it("the glow on the ground is a small grid of the cells, brightest where most suppliers are, dark far from any", () => {
    const g = glowGrid([[90.4, 23.85, 100], [90.45, 23.9, 1]], 64);
    assert.equal(g.data.length, 64 * 64);
    assert.equal(Math.max(...g.data), 255);
    assert.equal(g.data[0], 0);
    assert.ok(g.box[2] > 0 && g.box[3] > 0);
  });
});

describe("the lights file", () => {
  const file = JSON.parse(readFileSync(path.join(repoRoot, "public/site/film/cells.json"), "utf8")) as CellFile & Record<string, unknown>;

  it("is a date, what it counts, two counts, the one place, and rows of a place and a count: no address, no name, no id", () => {
    assert.deepEqual(Object.keys(file).sort(), ["cells", "chosen", "date", "mapped", "suppliers", "what"]);
    assert.match(file.date, /^\d{4}-\d{2}-\d{2}$/);
    // The day is the one the machine that ran the script counts; parsed here as UTC midnight, it may sit up to a day ahead of a clock elsewhere.
    assert.ok(Date.parse(file.date) >= Date.parse("2026-10-06") && Date.parse(file.date) <= Date.now() + 86_400_000, "read on or after 6 Oct 2026, not in the future");
    assert.equal(file.what, "suppliers per km²");
    assert.ok(file.cells.length >= 500, "real cells, not the four district counts");
    assert.ok(file.mapped <= file.suppliers && file.mapped > file.suppliers * 0.8, "most suppliers have a mapped address");
    assert.equal(file.cells.reduce((sum, [, , n]) => sum + n, 0), file.mapped, "every mapped supplier is in exactly one cell");
    for (const row of file.cells) {
      assert.equal(row.length, 3);
      const [lng, lat, count] = row;
      assert.ok(lng > 87.9 && lng < 92.8 && lat > 20.4 && lat < 26.8, `a light outside Bangladesh: ${row.join()}`);
      assert.ok(Number.isInteger(count) && count > 0);
      assert.ok(/^\d+(\.\d{1,3})?$/.test(String(lng)) && /^\d+(\.\d{1,3})?$/.test(String(lat)), `a cell is a kilometre, not an address: ${row.join()}`);
    }
    assert.ok(file.cells.some(([, , n]) => n >= 40), "a dense cell exists: the heat and the light size are tuned to one");
  });

  it("is small enough for the first screen's budget", () => {
    assert.ok(statSync(path.join(repoRoot, "public/site/film/cells.json")).size < 40_000);
  });
});

describe("no library planet", () => {
  it("cobe is gone from the dependencies and the lockfile, now that the planet is our own", () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    assert.ok(!("cobe" in pkg.dependencies) && !("cobe" in pkg.devDependencies));
    assert.doesNotMatch(readFileSync(path.join(repoRoot, "pnpm-lock.yaml"), "utf8"), /\bcobe@/);
  });
});

describe("the map data file", () => {
  const bd = JSON.parse(readFileSync(path.join(repoRoot, "public/site/film/bd.json"), "utf8")) as BdData;

  it("holds the 64 districts, the story's four among them, the rivers and the neighbours, and nothing about a supplier", () => {
    assert.equal(bd.districts.length, 64);
    for (const d of [...DISTRICTS, CHATTOGRAM]) assert.ok(bd.districts.some((x) => x.name === d.key), d.key);
    assert.ok(bd.rivers.length >= 10 && bd.around.length >= 3);
    assert.deepEqual(Object.keys(bd).sort(), ["around", "box", "credit", "districts", "rivers", "unit"]);
    assert.match(bd.credit, /Bangladesh Bureau of Statistics and OCHA ROAP, CC BY 3\.0 IGO/, "the district set's licence asks for its credit wherever the data goes");
    assert.match(bd.credit, /Natural Earth/);
    for (const d of bd.districts) assert.deepEqual(Object.keys(d).sort(), ["name", "rings"]);
  });

  it("every district sits inside Bangladesh's bounds, and the story's places sit inside their own district's", () => {
    const bounds = (name: string) => {
      const pts = bd.districts.find((d) => d.name === name)!.rings.flatMap((r) => unpack(r, bd.unit));
      return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))] as const;
    };
    for (const d of bd.districts) {
      const [w, s, e, n] = bounds(d.name);
      assert.ok(w > 87.9 && e < 92.8 && s > 20.4 && n < 26.8, d.name);
    }
    for (const d of DISTRICTS) {
      const [w, s, e, n] = bounds(d.key);
      assert.ok(d.at[0] > w && d.at[0] < e && d.at[1] > s && d.at[1] < n, `${d.label}'s towers stand outside ${d.key}`);
    }
    const file = JSON.parse(readFileSync(path.join(repoRoot, "public/site/film/cells.json"), "utf8")) as CellFile;
    const [w, s, e, n] = bounds("Gazipur");
    assert.ok(file.chosen && file.chosen[0] > w && file.chosen[0] < e && file.chosen[1] > s && file.chosen[1] < n, "the story's one place is in Gazipur, where its record says it is");
  });

  it("the city's ground keeps only the district lines and rivers near the belt, as segments", () => {
    const lines = groundLines(bd);
    assert.ok(lines.districts.length > 0 && lines.rivers.length > 0);
    assert.equal(lines.districts.length % 4, 0);
    assert.equal(lines.rivers.length % 4, 0);
    const [west] = toLocal(BOX.west - 1, BOX.north);
    const [east] = toLocal(BOX.east + 1, BOX.south);
    for (let i = 0; i < lines.districts.length; i += 2) assert.ok(lines.districts[i]! > west && lines.districts[i]! < east, "a segment far from the belt");
    assert.deepEqual(unpack([90400, 23700, 100, -50, -200, 0], 1000), [[90.4, 23.7], [90.5, 23.65], [90.3, 23.65]]);
  });

  it("the land mask is a small PNG", () => {
    const png = readFileSync(path.join(repoRoot, "public/site/film/land.png"));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), 720);
    assert.equal(png.readUInt32BE(20), 360);
    assert.ok(png.length < 12_000);
  });
});
