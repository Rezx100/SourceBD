// The home film's scenes after the opening, as rebuilt after the founder's video of 7 Oct 2026: the overlock with
// the five sources' numbers beside it, every claim beside its source, the watch, the real product staged, the three
// promises, the source ladder with the live figures, and the close. No record card, no thread, no receipt roll, no
// second map, no carton and no numbered label. The scroll's arithmetic for the scenes the engine moves, and what
// Tailwind emits for the parts it moves. The home page with the film on and off is held in film.test.ts.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DAYS, DIFFER, LIST_LINE, OVERLOCK_CAPTION, ProofScene, RECEIPTS, SourcesScene, WatchScene } from "./chapters";
import { Atmosphere, COMPLIANCE_SCREEN, CloseScene, LADDER_NOTE, OrderScene, PROMISES, PromisesScene, SCREENS, STAGE_CAPTION, TIERS, TrustScene, liveFigures } from "./closing";
import { BAND, ORDER, PROMISES as STEPS, SEAM_END, SOURCES as SEAM, holds, orderAt, sourcesAt } from "./engine/chapters";
import { Overlock, TAGS } from "./flats";
import { SOURCES, SOURCE_DATES } from "./record";
import { NO_FACTS, parseFacts } from "@/lib/site-facts";

const repoRoot = process.cwd();
// React 19 puts a preload link for each source mark before the markup; the markup is what is under test.
const draw = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/<link rel="preload"[^>]*>/g, "");
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/&#x27;|&rsquo;/g, "'").replace(/\s+/g, " ");
const NOTHING_KILLED = /aria-label="Supplier record|class="thread|data-tie|data-roll|rec-arrive|rounded-lg border border-line/;

describe("one factory, one record: the overlock", () => {
  const scene = draw(createElement(SourcesScene));
  const flat = draw(createElement(Overlock));

  it("its words, the flat labelled an illustration, each source's own number and day beside it; no card and no thread", () => {
    assert.match(scene, /^<section id="ch-02" data-scene="sources" class="/);
    assert.match(text(scene), /One factory\. One record\. Five registers file it under their own number/);
    assert.doesNotMatch(text(scene), /\b0\d · /, "no numbered label above the headline");
    assert.match(scene, /<svg data-overlock="true" aria-hidden="true"/);
    assert.ok(text(scene).includes(OVERLOCK_CAPTION) && OVERLOCK_CAPTION.endsWith("· illustration"));
    assert.equal(SOURCE_DATES.length, 5);
    for (const [source, filed] of SOURCE_DATES) assert.match(text(scene), new RegExp(`${source} ${filed.replace(/[.]/g, "\\.")}`));
    assert.match(scene, /<ul class="flex flex-col divide-y divide-line border-y border-line">/, "bare type on hairlines, never a card");
    assert.doesNotMatch(scene, NOTHING_KILLED);
    assert.match(scene, /<svg data-overlock="true"[^>]*class="[^"]*self-start/, "a flex column would stretch the drawing's box and float it to the middle");
  });

  it("the five hang tags are the five sources, each with the number the record files", () => {
    assert.equal(TAGS.length, 5);
    for (const [source, number] of TAGS) {
      assert.ok(flat.includes(`>${source}</text>`), source);
      assert.ok(flat.includes(`>${number}</text>`), number);
      assert.ok(SOURCES.marks?.includes(source) && SOURCES.mono?.includes(number), `${source} ${number} is not in the record`);
    }
  });

  it("the seam is drawn by the scroll along the cloth to where it leaves the drawing; the drawing types no colour", () => {
    assert.ok(flat.includes(`<path data-seam="true" d="M113 ${SEAM_END.y}H${SEAM_END.x}" pathLength="1" class="ov-seam `));
    assert.ok(flat.includes(`M18 356H${SEAM_END.x}V367H18Z`), "the cloth reaches the seam's end");
    assert.doesNotMatch(flat, /#[0-9a-fA-F]{3,8}\b|rgb\(|white|black|<mask/);
    for (const part of ["ov-wheel", "ov-needle", "ov-lever", "ov-seam"]) assert.equal((flat.match(new RegExp(`class="${part} `, "g")) ?? []).length, 1, part);
  });

  it("the machine runs over most of the scene: four turns of the wheel, twelve stitches, the seam drawn with the run", () => {
    assert.deepEqual(sourcesAt(0), { run: 0, wheel: 0, needle: 0 });
    const end = sourcesAt(1);
    assert.equal(end.run, 1);
    assert.equal(end.wheel, 1440);
    assert.ok(Math.abs(end.needle) < 1e-9, "the needle is up again at the end");
    assert.ok(SEAM.run[0] > 0 && SEAM.run[1] < 1, "a rest at each end");
    let downs = 0;
    for (let p = 0, last = 0; p <= 1.0001; p += 0.0005) {
      const n = sourcesAt(p).needle;
      if (n > 0.999 && last <= 0.999) downs++;
      last = n;
    }
    assert.equal(downs, SEAM.stitches);
  });
});

describe("every claim, beside its source", () => {
  const scene = draw(createElement(ProofScene));
  const t = text(scene);

  it("today's three claims, each beside its source, number and day, and the two sources that differ; no roll and no card", () => {
    assert.match(scene, /^<section id="ch-03" class="/);
    assert.match(t, /Every claim, beside its source\./);
    assert.equal(RECEIPTS.length, 3);
    for (const r of RECEIPTS) {
      assert.ok(t.includes(r.claim.replace(/&/g, "&amp;")) || t.includes(r.claim), r.claim);
      assert.ok(t.includes(r.source), r.source);
      for (const [k, v] of r.fields) assert.ok(t.includes(`${k} ${v}`), `${r.source}: ${k} ${v}`);
    }
    assert.match(t, /2 sources differ/);
    assert.ok(t.includes(DIFFER));
    assert.doesNotMatch(scene, NOTHING_KILLED);
  });
});

describe("the watch", () => {
  const scene = draw(createElement(WatchScene));
  const t = text(scene);

  it("today's words, the three days in words, and the list check with what was found, never 'clear'", () => {
    assert.match(scene, /^<section id="ch-04" class="/);
    assert.match(t, /The list changes\. We check again\./);
    assert.deepEqual(DAYS.map(([d]) => d), [0, 43, 59]);
    for (const [, when] of DAYS) assert.ok(t.includes(when), when);
    assert.ok(t.includes(LIST_LINE));
    assert.match(LIST_LINE, /no link found/);
    assert.doesNotMatch(t.replace(/never .clear./, ""), /\bclear\b/i);
    assert.doesNotMatch(scene, NOTHING_KILLED);
    assert.doesNotMatch(scene, /<circle/, "no dots on a line");
  });
});

describe("shortlist, ask, compare: the real product staged", () => {
  const scene = draw(createElement(OrderScene));
  const t = text(scene);
  const atmosphere = draw(createElement(Atmosphere));

  it("today's words, both roles' tabs in the page, the three steps in order with the first on, and the screens with their alt text", () => {
    assert.match(scene, /^<section id="ch-05" data-scene="order" class="/);
    assert.match(t, /Shortlist\. Ask\. Compare\. Save the suppliers you like\./);
    assert.doesNotMatch(t, /\b0\d · /);
    assert.match(scene, /role="tablist"/);
    assert.equal((scene.match(/role="tabpanel"/g) ?? []).length, 2);
    const steps = scene.slice(scene.indexOf("<ol data-order-steps"), scene.indexOf("</ol>", scene.indexOf("<ol data-order-steps")));
    assert.equal((steps.match(/<li /g) ?? []).length, 3);
    assert.match(steps, /^<ol data-order-steps="true"[^>]*><li data-on=""/);
    assert.deepEqual(SCREENS.map((x) => x.step), ["Shortlist from your saved suppliers", "Send one RFQ", "Compare the quotes"]);
    // Through next/image the src is rewritten and a srcset added, so each screen is held by its file's name and its alt text.
    const file = (src: string) => src.slice(src.lastIndexOf("/") + 1).replace(/\./g, "\\.");
    const alt = (s: string) => s.replace(/'/g, "&#x27;").replace(/[.:]/g, "\\$&");
    for (const x of SCREENS) {
      assert.match(scene, new RegExp(`<img [^>]*alt="${alt(x.alt)}"`), x.alt);
      assert.match(scene, new RegExp(`<img [^>]*${file(x.src)}`), x.src);
    }
    assert.match(scene, new RegExp(`<img [^>]*${file(COMPLIANCE_SCREEN.src)}`));
    assert.doesNotMatch(scene, /rounded-lg border border-line|pane-glass/);
  });

  it("the cursor is on the composer only, aimed at Send RFQ, with no spotlight; the caption says the app is light in both themes", () => {
    const first = scene.indexOf('role="tabpanel"');
    const sourcing = scene.slice(first, scene.indexOf('role="tabpanel"', first + 1));
    assert.equal((sourcing.match(/data-screen="true"/g) ?? []).length, 3);
    assert.equal((sourcing.match(/<div data-screen="true" data-on=""/g) ?? []).length, 1);
    assert.equal((sourcing.match(/data-cursor="true"/g) ?? []).length, 2, "the press and the cursor, once");
    assert.doesNotMatch(sourcing, /stage-spot/);
    assert.ok(sourcing.indexOf("data-cursor") > sourcing.indexOf("rfq-one.png") && sourcing.indexOf("data-cursor") < sourcing.indexOf("rfq-quotes.png"));
    assert.match(sourcing, /class="stage-cursor [^"]*" style="left:92\.6%;top:95\.5%"/);
    assert.ok(t.includes(STAGE_CAPTION) && /light in both themes/.test(STAGE_CAPTION));
    assert.equal((scene.match(/data-order-screens=""/g) ?? []).length, 1, "the engine swaps the sourcing stage's screens only");
  });

  it("the atmosphere is our own drawing: no picture, no text, no colour typed", () => {
    assert.match(atmosphere, /^<svg aria-hidden="true"/);
    assert.doesNotMatch(atmosphere, /<text|<image|href="http|#[0-9a-fA-F]{3,8}\b|rgb\(|white|black/);
  });

  it("the first step is on from the start, the next two at their marks; the cursor presses within the second step, before the third", () => {
    assert.deepEqual(orderAt(0), { step: 0, cursor: 0 });
    assert.equal(orderAt(ORDER.steps[1]).step, 0);
    assert.equal(orderAt(ORDER.steps[1] + 0.001).step, 1);
    assert.equal(orderAt(ORDER.steps[2] + 0.001).step, 2);
    assert.deepEqual(orderAt(1), { step: 2, cursor: 1 });
    assert.ok(ORDER.cursor[0] > ORDER.steps[1] && ORDER.cursor[1] < ORDER.steps[2]);
    for (let p = 0; p < 1; p += 0.01) assert.ok(orderAt(p + 0.01).step >= orderAt(p).step && orderAt(p + 0.01).cursor >= orderAt(p).cursor);
  });

  it("a beat comes at its moment and holds a little past it on the way back, so a scroll resting on the line does not flap it", () => {
    assert.equal(holds(false, 0.5, 0.5), false);
    assert.equal(holds(false, 0.501, 0.5), true);
    assert.equal(holds(true, 0.5 - BAND / 2, 0.5), true);
    assert.equal(holds(true, 0.5 - BAND * 2, 0.5), false);
  });
});

describe("three things we never do", () => {
  const scene = draw(createElement(PromisesScene));

  it("the three promises, words only, each turning at its step with its reason beside it; no numbers", () => {
    assert.match(scene, /^<section id="ch-06" data-scene="promises" class="/);
    assert.deepEqual(PROMISES.map(([, p]) => p), ["No scores.", "No paid placement.", "No fact without a source and a date."]);
    assert.equal((scene.match(/data-promise="true"/g) ?? []).length, 3);
    for (const [, , line] of PROMISES) assert.ok(text(scene).includes(line.replace(/'/g, "'")), line);
    assert.doesNotMatch(text(scene), /\b0[1-3]\b/);
    assert.ok(STEPS.steps[0] < STEPS.steps[1] && STEPS.steps[1] < STEPS.steps[2] && STEPS.steps[2] < 1);
  });
});

describe("every source has its rank", () => {
  const facts = parseFacts(
    { suppliers_indexed: 10268, last_refreshed_at: "2026-10-02T05:48:07Z" },
    { sources_listed: 25, sources_with_records: 14, certificates_on_file: 4275, certificates_expired: 518, rsc_records: 2331, latest_read: "2026-10-02T05:48:07Z", sources: [] },
  );
  const scene = draw(createElement(TrustScene, { facts }));
  const t = text(scene);

  it("the ladder is today's five tiers in rank order, with the note, the live figures and the methodology link", () => {
    assert.match(scene, /^<section id="ch-07" class="/);
    assert.deepEqual(TIERS.map(([tier]) => tier), ["Tier 1", "Tier 2", "Tier 3", "Tier 4", "Tier 5"]);
    let at = 0;
    for (const [, name] of TIERS) {
      const i = t.indexOf(name.replace(/&/g, "&amp;"), at);
      assert.ok(i > at || (at === 0 && i >= 0), name);
      at = i;
    }
    assert.ok(t.includes(LADDER_NOTE));
    for (const [figure, what] of liveFigures(facts)) assert.ok(t.includes(`${figure} ${what}`), figure);
    assert.match(scene, /href="\/methodology"/);
  });

  it("with nothing read no figure is printed", () => {
    const bare = text(draw(createElement(TrustScene, { facts: NO_FACTS })));
    assert.equal(liveFigures(NO_FACTS).length, 0);
    assert.doesNotMatch(bare, /\d,\d{3}/);
    assert.match(bare, /See all the sources/);
  });
});

describe("the close", () => {
  const scene = draw(createElement(CloseScene, { count: "10,268" }));

  it("night in either theme, a stage for the planet to come back to, the last words, the search on public Discover and the two ways in", () => {
    assert.match(scene, /^<section id="ch-08" data-scene="close" data-ground="night" class="/);
    assert.match(scene, /<div data-planet-close="true" aria-hidden="true"/);
    assert.match(text(scene), /Now you know who you.re buying from\. Do the same for any of 10,268 suppliers\. Search is free\./);
    assert.match(scene, /<form[^>]*action="\/discover"/);
    assert.match(scene, /href="\/signup"[^>]*>Start free/);
    assert.match(scene, /href="\/contact"[^>]*>Book a demo/);
    assert.doesNotMatch(scene, NOTHING_KILLED);
    assert.match(text(draw(createElement(CloseScene, { count: null }))), /Do the same for any supplier\./);
  });
});

describe("what Tailwind emits for the scenes", () => {
  /* eslint-disable @typescript-eslint/no-require-imports -- tailwind's loader and postcss are CommonJS tools */
  const postcss = require("postcss") as typeof import("postcss").default;
  const tailwind = require("tailwindcss") as (config: object) => import("postcss").AcceptedPlugin;
  const loadConfig = require("tailwindcss/loadConfig") as (file: string) => Record<string, unknown>;
  /* eslint-enable @typescript-eslint/no-require-imports */
  const classes = ["pane", "ov-wheel", "ov-needle", "ov-lever", "ov-seam", "animate-rise", "fill-brand", "stroke-brand-ink", "film-full:h-[220svh]", "stage-screen", "stage-window", "stage-cursor", "stage-press", "film-full:group-data-[on]/promise:text-ink", "group/promise", "film-full:aspect-[1440/900]"];
  const compiled = postcss([tailwind({ ...loadConfig(path.join(repoRoot, "tailwind.config.ts")), content: [{ raw: classes.join(" "), extension: "html" }] })])
    .process(readFileSync(path.join(repoRoot, "app/ds.css"), "utf8"), { from: undefined })
    .then((r) => r.css.replace(/\s+/g, " "));
  const block = (css: string, opener: string) => {
    const i = css.indexOf(opener);
    assert.ok(i >= 0, `no ${opener}`);
    return css.slice(i, css.indexOf("}", i));
  };

  it("the overlock's parts move by variables the engine writes; with none written everything rests and shows", async () => {
    const css = await compiled;
    assert.match(block(css, ".ov-needle {"), /transform: translateY\(calc\(var\(--needle, 0\) \* 10px\)\)/);
    assert.match(block(css, ".ov-wheel {"), /stroke-dashoffset: calc\(var\(--wheel, 0\) \* -0\.25px\)/);
    assert.match(block(css, ".ov-lever {"), /transform-box: fill-box;[^}]*rotate\(calc\(var\(--needle, 0\) \* -16deg\)\)/);
    assert.match(block(css, ".ov-seam {"), /stroke-dashoffset: calc\(1 - var\(--p, 1\)\)/);
    assert.match(block(css, '[data-film-tier="full"] [data-beat]:not([data-on]) {'), /position: absolute; width: 1px; height: 1px;[^}]*clip: rect\(0, 0, 0, 0\)/, "a beat takes no place until its moment but stays in the page for a screen reader");
    assert.match(block(css, ".animate-rise {"), /ds-rise/);
    assert.match(css, /\[data-film-tier="full"\] \.film-full\\:h-\\\[220svh\\\] \{ height: 220svh/);
    assert.doesNotMatch(css, /\.thread|\.rec-arrive|\.roll-|\.receipt|data-carton|\.time-mark|\.stage-spot|\.film-figure-fit|ds-rec-/, "every style of what was killed is gone");
  });

  it("the stage's windows and the cursor move by variables the engine writes; with nothing written the cursor rests pressed and the screens stand in a column", async () => {
    const css = await compiled;
    assert.match(block(css, ".stage-window {"), /rotateY\(calc\(\(var\(--p, 0\.5\) - 0\.5\) \* -6deg\)\)/);
    assert.match(block(css, '[data-film-tier="full"] .stage-screen {'), /position: absolute; inset: 0; opacity: 0; transform: translateX\(32px\)/);
    assert.match(block(css, '[data-film-tier="full"] .stage-screen[data-on] {'), /opacity: 1; transform: none/);
    assert.match(block(css, ".stage-cursor {"), /translate\(calc\(\(1 - var\(--cursor, 1\)\) \* 180px\)/);
    assert.match(block(css, ".stage-press {"), /opacity: clamp\(0, calc\(\(var\(--cursor, 1\) - 0\.9\) \* 10\), 1\)/);
    assert.match(css, /\[data-film-tier="full"\] \.group\\\/promise\[data-on\] \.film-full\\:group-data-\\\[on\\\]\\\/promise\\:text-ink \{/);
  });
});
