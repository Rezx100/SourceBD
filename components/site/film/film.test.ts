// The home film, slice 1 (handoff-home-film §3): the dark set and its contrast, the Pane's legibility over what
// may pass behind it, what Tailwind really emits for the theme and the film's classes, the markup of the Pane
// family, the thread and the rail, the engine's arithmetic, and the shape of the map data.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { contrastRatio, dark, darkPairs, filmColors, filmPairs, light, paneBehind, paneGlass, paneGround, resolve, toRgb } from "@/lib/design/tokens";
import { currentChapter, sceneProgress } from "./engine/director";
import { DISTRICTS, STOPS, cameraAt, column, createMap, toGeo, unpack, type BdData } from "./engine/map";
import { HOME, defaultFrame, facing, isLand, landPoints, lightSize, project, toVec } from "./engine/planet";
import { V4Film } from "@/app/dev/ds/v4-film";
import { Home } from "@/components/site/home";
import { parseFacts } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import type { CellFile } from "./engine/start";
import { TIER_SCRIPT, filmOn, pickTier, type Device } from "./engine/tier";
import { LIGHTS } from "./opening";
import { FieldPane, Pane, RecordPane, type RecordRow } from "./pane";
import { Rail, Thread, ThreadLayer } from "./thread";

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
  const classes = ["has-[input:focus-visible]:outline-focus", "text-brand-ink", "bg-map-water", "text-film-hero", "text-film-figure-phone", "rounded-pane", "max-sm:rounded-pane-phone", "pane", "pane-glass", "pane-sheen", "rec-arrive", "thread", "thread-join", "thread-draw", "thread-end"];
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
    assert.match(night, /--pane-tint: 0\.7;/);
    assert.match(night, /color-scheme: dark/);
    assert.match(css, /html \{ color-scheme: light;/, "every page without the attribute stays light");
  });

  it("a night scene carries the same dark variables in either theme", async () => {
    const night = block(await compiled, '[data-ground="night"] {');
    assert.match(night, /--ds-surface: 16 18 20;/);
    assert.match(night, /--ds-map-light: 255 241 214;/);
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
    assert.match(block(css, ".rec-arrive .rec-words {"), /animation: ds-rec-rise 200ms [^;]* 460ms both/);
  });

  it("the search pane's focus ring is a real rule", async () => {
    const css = await compiled;
    assert.ok(css.includes(":has(input:focus-visible) { outline-color: rgb(var(--ds-focus)"), "no has-[input:focus-visible]:outline-focus rule");
  });

  it("the sheen passes once, never in a loop", async () => {
    const sheen = block(await compiled, ".pane-sheen::after {");
    assert.match(sheen, /animation: ds-pane-sheen 600ms [^;]* 1 both/);
    assert.doesNotMatch(sheen, /infinite/);
  });
});

describe("the Pane family", () => {
  const ROWS: RecordRow[] = [
    { label: "Sources", value: "5 sources", marks: ["EPB", "RSC", "BGMEA", "BKMEA", "GOTS"], mono: "EPB 2798 · RSC 10861" },
    { label: "BGMEA membership", value: "General member · reg. no. 4002", from: "From BGMEA · checked 24 Jul 2026", marks: ["BGMEA"] },
    { label: "RFQ", value: "Waiting for a quote", from: "Sent 3 Oct 2026", marks: ["XY"] },
  ];
  const record = draw(createElement(RecordPane, { name: "Mondol Fabrics Ltd.", line: "Factory · Gazipur", rows: ROWS, state: "Saved · watching", arriving: "RFQ", material: "glass" }));

  it("a pane is solid unless asked for glass", () => {
    assert.match(draw(Pane({ children: "x" })), /^<div class="pane rounded-pane p-6[^"]*">x<\/div>$/);
    assert.match(draw(Pane({ material: "glass", children: "x" })), /class="pane pane-glass /);
  });

  it("the record is a figure named for its supplier, with one term per row", () => {
    assert.match(record, /<figure[^>]*aria-label="Supplier record: Mondol Fabrics Ltd\."/);
    assert.equal((record.match(/<dt /g) ?? []).length, ROWS.length);
    assert.match(record, /Saved · watching/);
  });

  it("Sources shows the five marks in a row, and no row is a filled block", () => {
    const sources = record.slice(record.indexOf(">Sources<"), record.indexOf("</dd>", record.indexOf(">Sources<")));
    assert.equal((sources.match(/<img /g) ?? []).length, 5);
    assert.doesNotMatch(record, /bg-brand-wash|bg-brand-tint[^"]*py-3/);
  });

  it("only the arriving row is stitched on, and a source with no approved mark gets a two-letter stamp", () => {
    assert.equal((record.match(/rec-arrive/g) ?? []).length, 1);
    assert.match(record, /rec-arrive"><span aria-hidden="true" class="rec-mark[^"]*">XY<\/span>/);
  });

  it("the search pane runs on public Discover, as the hero's form does", () => {
    const field = draw(createElement(FieldPane, { id: "q", material: "glass" }));
    assert.match(field, /^<form[^>]*action="\/discover"/);
    assert.match(field, /<form[^>]*role="search"/);
    assert.match(field, /<form[^>]*method="get"/);
    assert.match(field, /<label for="q" class="sr-only">/);
    assert.match(field, /<input[^>]*name="q"/);
    assert.match(field, /<button type="submit"/);
  });

  it("the search pane wears the field's keyboard focus, since the field itself has no outline", () => {
    const field = draw(createElement(FieldPane, { id: "q" }));
    assert.match(field, /<input[^>]*class="[^"]*outline-none/);
    assert.match(field, /<form[^>]*class="[^"]*has-\[input:focus-visible\]:outline-2[^"]*has-\[input:focus-visible\]:outline-focus/);
  });

  it("a caller's radius replaces the pane's, rather than sitting beside it", () => {
    assert.equal(cn("rounded-pane max-sm:rounded-pane-phone", "rounded-lg"), "max-sm:rounded-pane-phone rounded-lg");
    assert.doesNotMatch(/^<form class="([^"]*)"/.exec(draw(createElement(FieldPane, { id: "q" })))?.[1] ?? "rounded-lg", /rounded-lg/);
  });
});

describe("the thread and the rail", () => {
  const svg = draw(ThreadLayer({ viewBox: "0 0 10 10", children: createElement(Thread, { d: "M0 0H9", join: true, end: { x: 9, y: 0 } }) }));

  it("the thread is decoration, stitched when it joins, and ends in a bartack, never a circle", () => {
    assert.match(svg, /^<svg aria-hidden="true"/);
    assert.match(svg, /class="thread thread-join"/);
    assert.match(svg, /class="thread thread-end"/);
    assert.doesNotMatch(svg, /<circle/);
  });

  it("it is drawn by a mask of the same path, so a still page shows it whole", () => {
    const id = /<mask id="([^"]+)"/.exec(svg)?.[1];
    assert.ok(id);
    assert.ok(svg.includes(`mask="url(#${id})"`));
    assert.match(svg, /<path d="M0 0H9" pathLength="1" class="thread-draw"/);
  });

  const chapters = Array.from({ length: 9 }, (_, i) => ({ id: `ch-${i + 1}`, n: `0${i + 1}`, label: `Question ${i + 1}` }));
  const rail = draw(createElement(Rail, { chapters, current: "ch-4" }));

  it("the rail is nine links, one of them current, and it counts nothing", () => {
    assert.match(rail, /^<nav aria-label="Chapters"/);
    assert.equal((rail.match(/<a href="#ch-\d"/g) ?? []).length, 9);
    assert.equal((rail.match(/aria-current="step"/g) ?? []).length, 1);
    assert.match(rail, /<a href="#ch-4" aria-current="step"/);
    assert.match(rail, /<span class="sr-only"> Question 4<\/span>/);
    assert.doesNotMatch(rail, /aria-valuenow|role="progressbar"/);
  });
});

describe("/dev/ds", () => {
  const html = draw(createElement(V4Film));

  it("shows the film's section: every dark value beside its light one, and each board in both grounds", () => {
    for (const [name, hex] of Object.entries(filmColors)) assert.ok(html.includes(`>${name}</span>`) && html.includes(hex), name);
    assert.ok(html.includes(resolve(dark, "surface")) && html.includes(resolve(dark, "brand.ink")));
    assert.equal((html.match(/data-ground="night" class="flex flex-col gap-3 rounded-lg/g) ?? []).length, 5, "five boards, each drawn once more in a night scope");
    assert.match(html, /aria-label="Supplier record: Mondol Fabrics Ltd\."/);
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
    assert.doesNotMatch(off, /data-film|data-scene|data-theme-auto|data-ground|<script|<canvas|pane-glass/);
    assert.match(off, /<main class="font-sans text-ink">/);
  });

  it("with the film on, the page opts in to the system's theme and sets its tier before anything is drawn", () => {
    assert.match(on, /<main class="font-sans text-ink" data-film="" data-theme-auto=""><script>document\.documentElement\.dataset\.filmTier=/);
  });

  it("the opening keeps the page's one headline, its search on public Discover and its two ways in", () => {
    assert.equal((on.match(/<h1/g) ?? []).length, 1);
    assert.match(on, /<h1[^>]*>Know who you.re buying from\.<\/h1>/);
    assert.equal((on.slice(0, on.indexOf('id="ch-02"')).match(/id="hero-q"/g) ?? []).length, 1);
    assert.match(on, /<form[^>]*role="search"[^>]*action="\/discover"/);
    assert.match(text(on), /10,268 Bangladesh garment suppliers, each checked against the registers that list them\./);
    assert.match(text(on), /Try .knit dresses Gazipur. or .GOTS./);
    assert.match(on, /href="\/signup"[^>]*>Start free/);
    assert.match(on, /href="\/contact"[^>]*>Book a demo/);
  });

  it("the planet is night in either theme, and what it draws is decoration: the words carry the facts", () => {
    assert.match(on, /<section data-scene="planet" data-chapter="ch-1" data-ground="night"/);
    assert.match(on, /<canvas data-planet="true" aria-hidden="true"/);
    assert.match(on, /<div data-planet-callouts="true" aria-hidden="true"/);
  });

  it("the first screen keeps to three panes of glass, and the planet can be reached through the words", () => {
    const first = on.slice(on.indexOf('data-scene="planet"'), on.indexOf('data-scene="map"'));
    assert.ok((first.match(/pane-glass/g) ?? []).length <= 3);
    assert.match(first, /class="[^"]*pointer-events-none relative flex flex-col items-start[^"]*\[&amp;&gt;\*\]:pointer-events-auto/);
  });

  it("the lights are said in words, with the date of the file they come from", () => {
    const file = JSON.parse(readFileSync(path.join(repoRoot, "public/site/film/cells.json"), "utf8")) as CellFile;
    assert.ok(text(on).includes(LIGHTS));
    assert.equal(file.date, "2026-10-03");
    assert.ok(LIGHTS.endsWith("3 Oct 2026") && LIGHTS.includes(file.what));
  });

  it("the four district counts are all in the page, dated, with no total, and none counts up", () => {
    const t = text(on);
    for (const n of ["4,421", "1,819", "1,628", "1,080"]) assert.ok(t.includes(n), n);
    assert.match(t, /Most sit in four districts\./);
    assert.match(t, /as counted on 3 Oct 2026/);
    assert.equal((on.match(/id="ch-1"/g) ?? []).length, 1);
    assert.equal((on.match(/<li data-on=""/g) ?? []).length, 1, "one district is on at a time, the first to begin with");
    const steps = on.slice(on.indexOf("<ol data-steps"), on.indexOf("</ol>", on.indexOf("<ol data-steps")));
    assert.match(steps, /film-full:sr-only/, "a district that is not on stays in the page for a screen reader");
    assert.doesNotMatch(steps, /film-full:hidden(?!\s*film-full:inline)|film-full:invisible/);
    assert.doesNotMatch(/<div data-act="record" class="([^"]*)"/.exec(on)?.[1] ?? "invisible", /invisible|hidden/);
    assert.doesNotMatch(t, /\b4[0-9] districts\b|districts in all|districts mapped/);
    assert.doesNotMatch(on, /count-?up|data-count|aria-valuenow/);
  });

  it("the record still starts as a name with no rows and only ever gains them", () => {
    const cards = [...on.matchAll(/<figure[^>]*aria-label="Supplier record: Mondol Fabrics Ltd\."[^>]*>([\s\S]*?)<\/figure>/g)].map((m) => m[1] ?? "");
    const counts = cards.map((c) => (c.match(/<dt /g) ?? []).length);
    assert.equal(counts[0], 0);
    assert.ok(counts.every((n, i) => i === 0 || n >= (counts[i - 1] ?? 0)), counts.join(","));
    assert.ok((counts.at(-1) ?? 0) >= 8);
    assert.match(text(on), /A real record, as it stands on 3 Oct 2026\./);
    assert.match(text(on), /1 of 10,268 suppliers/);
  });

  it("every later chapter is untouched", () => {
    const rest = (m: string) => m.slice(m.indexOf('id="ch-02"'));
    assert.equal(rest(on), rest(off));
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

  it("the film is off unless the address says film=1 or the build set the variable to 1", () => {
    assert.equal(filmOn(undefined, undefined), false);
    assert.equal(filmOn("", ""), false);
    assert.equal(filmOn("0", "0"), false);
    assert.equal(filmOn("true", "true"), false);
    assert.equal(filmOn(["1", "1"], undefined), false, "a repeated parameter is not the flag");
    assert.equal(filmOn("1", undefined), true);
    assert.equal(filmOn(undefined, "1"), true);
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

  it("the rail follows the last scene to pass the middle of the screen, and holds it across a gap", () => {
    const scenes = [{ chapter: "ch-1", top: -900, bottom: 100 }, { chapter: "ch-02", top: 700, bottom: 2700 }];
    assert.equal(currentChapter(scenes, 1000), "ch-1", "between two scenes the one just left stays current");
    assert.equal(currentChapter([{ chapter: "ch-1", top: -1400, bottom: -400 }, { chapter: "ch-02", top: 200, bottom: 2200 }], 1000), "ch-02");
    assert.equal(currentChapter([{ chapter: "ch-1", top: 600, bottom: 1600 }], 1000), null, "before the first scene nothing is current");
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

describe("the map's arithmetic", () => {
  it("a ring unpacks from steps to degrees", () => {
    assert.deepEqual(unpack([90400, 23700, 100, -50, -200, 0], 1000), [[90.4, 23.7], [90.5, 23.65], [90.3, 23.65]]);
    assert.deepEqual(unpack([], 1000), []);
  });

  it("the camera is each mark at its own place, holds before the first and after the last, and never jumps", () => {
    for (const s of STOPS) {
      const c = cameraAt(s.p);
      assert.ok(Math.abs(c.zoom - s.zoom) < 1e-9 && Math.abs(c.center[0] - s.center[0]) < 1e-9, `at ${s.p}`);
    }
    assert.deepEqual(cameraAt(-1), cameraAt(0));
    assert.deepEqual(cameraAt(2), cameraAt(1));
    for (let p = 0; p < 1; p += 0.01) assert.ok(Math.abs(cameraAt(p + 0.01).zoom - cameraAt(p).zoom) < 0.25, `a jump near ${p.toFixed(2)}`);
  });

  it("a column is a closed six-sided footprint whose height follows the count", () => {
    const tall = column([90.4, 23.8], 4421), short = column([90.4, 23.8], 1080);
    const ring = (tall.geometry.coordinates as number[][][])[0]!;
    assert.equal(ring.length, 7);
    assert.ok(Math.abs(ring[0]![0]! - ring[6]![0]!) < 1e-9 && Math.abs(ring[0]![1]! - ring[6]![1]!) < 1e-9);
    assert.ok((tall.properties.height as number) > (short.properties.height as number));
  });

  it("the story's own place is never typed into the engine: with none given, the one light has nothing to stand on", () => {
    const style: { sources?: Record<string, { data: { features?: unknown[] } }> } = {};
    class FakeMap {
      constructor(options: Record<string, unknown>) {
        Object.assign(style, options.style);
      }
      on() {}
      jumpTo() {}
      project() {
        return { x: 0, y: 0 };
      }
      setPaintProperty() {}
      resize() {}
      remove() {}
    }
    const g = globalThis as Record<string, unknown>;
    const had = { ResizeObserver: g.ResizeObserver, getComputedStyle: g.getComputedStyle };
    g.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    g.getComputedStyle = () => ({ getPropertyValue: () => "1 2 3" });
    try {
      const bd: BdData = { credit: "", unit: 1000, box: [], districts: [], around: [], rivers: [] };
      createMap({ Map: FakeMap }, {} as HTMLElement, { bd, cells: [] }).destroy();
      assert.deepEqual(style.sources?.chosen?.data.features, []);
      createMap({ Map: FakeMap }, {} as HTMLElement, { bd, cells: [], chosen: [90.3, 24] }).destroy();
      assert.equal(style.sources?.chosen?.data.features?.length, 1);
    } finally {
      Object.assign(g, had);
    }
  });

  it("the four districts are the counts of 3 Oct 2026, with no total", () => {
    assert.deepEqual(DISTRICTS.map((d) => [d.label, d.count]), [["Dhaka district", 4421], ["Gazipur", 1819], ["Narayanganj", 1628], ["Chattogram", 1080]]);
  });
});

describe("the lights file", () => {
  const file = JSON.parse(readFileSync(path.join(repoRoot, "public/site/film/cells.json"), "utf8")) as CellFile & Record<string, unknown>;

  it("is a date, what it counts, and rows of a place and a count: no address, no name, no id", () => {
    assert.deepEqual(Object.keys(file).filter((k) => k !== "chosen").sort(), ["cells", "date", "what"]);
    assert.match(file.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(file.cells.length > 0);
    for (const row of file.cells) {
      assert.equal(row.length, 3);
      const [lng, lat, count] = row;
      assert.ok(lng > 87.9 && lng < 92.8 && lat > 20.4 && lat < 26.8, `a light outside Bangladesh: ${row.join()}`);
      assert.ok(Number.isInteger(count) && count > 0);
    }
  });

  it("until the cells are read from production, its rows are exactly the four dated district counts", () => {
    assert.deepEqual(file.cells, DISTRICTS.map((d) => [d.at[0], d.at[1], d.count]));
  });
});

describe("the map data file", () => {
  const bd = JSON.parse(readFileSync(path.join(repoRoot, "public/site/film/bd.json"), "utf8")) as BdData;

  it("holds the 64 districts, the story's four among them, the rivers and the neighbours, and nothing about a supplier", () => {
    assert.equal(bd.districts.length, 64);
    for (const d of DISTRICTS) assert.ok(bd.districts.some((x) => x.name === d.key), d.key);
    assert.ok(bd.rivers.length >= 10 && bd.around.length >= 3);
    assert.deepEqual(Object.keys(bd).sort(), ["around", "box", "credit", "districts", "rivers", "unit"]);
    assert.match(bd.credit, /Bangladesh Bureau of Statistics and OCHA ROAP, CC BY 3\.0 IGO/, "the district set's licence asks for its credit wherever the data goes");
    assert.match(bd.credit, /Natural Earth/);
    for (const d of bd.districts) assert.deepEqual(Object.keys(d).sort(), ["name", "rings"]);
  });

  it("every district sits inside Bangladesh's bounds, and the story's places sit inside their own district's", () => {
    const geo = toGeo(bd, [[90.4, 23.8, 3]]);
    assert.equal(geo.cells.features.length, 1);
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
      assert.ok(d.at[0] > w && d.at[0] < e && d.at[1] > s && d.at[1] < n, `${d.label}'s column stands outside ${d.key}`);
    }
  });

  it("the land mask is a small PNG", () => {
    const png = readFileSync(path.join(repoRoot, "public/site/film/land.png"));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), 720);
    assert.equal(png.readUInt32BE(20), 360);
    assert.ok(png.length < 12_000);
  });
});
