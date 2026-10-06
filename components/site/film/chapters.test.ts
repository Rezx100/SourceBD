// The home film, slice 3 (handoff-home-film §3.7, §3.9, §4): scenes 04 and 05. The overlock flat with the five
// sources as hang tags, the receipt roll with today's three claims beside their sources, the record gaining its
// rows at their beats, the scroll's arithmetic for both scenes, and what Tailwind emits for the parts the engine
// moves. The home page with the film on and off is held in film.test.ts.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DIFFER, OVERLOCK_CAPTION, RECEIPTS, ReceiptsScene, SourcesScene } from "./chapters";
import { BAND, RECEIPTS as ROLL, SEAM_END, SOURCES as SEAM, curve, holds, receiptsAt, sourcesAt } from "./engine/chapters";
import { Overlock, TAGS } from "./flats";
import { SOURCES, SOURCE_DATES } from "./record";

const repoRoot = process.cwd();
// React 19 puts a preload link for each source mark before the markup; the markup is what is under test.
const draw = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/<link rel="preload"[^>]*>/g, "");
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/&#x27;|&rsquo;/g, "'").replace(/\s+/g, " ");

describe("scene 04, the overlock", () => {
  const scene = draw(createElement(SourcesScene));
  const flat = draw(createElement(Overlock));

  it("is chapter 02's scene: its words, the flat labelled an illustration, and a record whose one row arrives at its beat", () => {
    assert.match(scene, /^<section id="ch-02" data-scene="sources" data-chapter="ch-02"/);
    assert.match(text(scene), /02 · Who are they\? One factory\. One record\. Five registers file it under their own number/);
    assert.match(scene, /<svg data-overlock="true" aria-hidden="true"/);
    assert.ok(text(scene).includes(OVERLOCK_CAPTION) && OVERLOCK_CAPTION.endsWith("· illustration"));
    assert.equal((scene.match(/<dt /g) ?? []).length, 1, "the record has gained Sources and nothing else");
    assert.match(scene, /<div data-row="Sources" data-beat="" class="/);
    assert.equal((scene.match(/data-tie="true"/g) ?? []).length, 1, "one thread, from the seam to the row");
    assert.doesNotMatch(scene, /rounded-lg border border-line|pane-glass/, "no bordered card, and nothing live to put glass over");
    assert.match(scene, /<svg data-overlock="true"[^>]*class="[^"]*self-start/, "a flex column would stretch the drawing's box and float it to the middle");
  });

  it("each source's own number and the day we read it stay in the words, under the record, as the page without the film lists them", () => {
    assert.equal(SOURCE_DATES.length, 5);
    for (const [source, filed] of SOURCE_DATES) assert.match(text(scene), new RegExp(`${source} ${filed.replace(/[.]/g, "\\.")}`));
    assert.match(scene, /<\/figure><ul class="flex flex-col divide-y divide-line border-y border-line">/, "bare type on hairlines, never a card");
  });

  it("the five hang tags are the five sources, each with the number the record's Sources row carries", () => {
    assert.equal(TAGS.length, 5);
    for (const [source, number] of TAGS) {
      assert.ok(flat.includes(`>${source}</text>`), source);
      assert.ok(flat.includes(`>${number}</text>`), number);
      assert.ok(SOURCES.marks?.includes(source) && SOURCES.mono?.includes(number), `${source} ${number} is not in the record`);
    }
  });

  it("the seam is a thread drawn by the scroll, along the cloth to where it leaves the drawing; the drawing types no colour", () => {
    assert.match(flat, /<g data-seam="true"><g><mask /);
    assert.ok(flat.includes(`d="M113 ${SEAM_END.y}H${SEAM_END.x}"`));
    assert.ok(flat.includes(`M18 356H${SEAM_END.x}V367H18Z`), "the cloth reaches the seam's end");
    // The thread's mask is white by nature (its "show"); everything the drawing itself paints is a token class.
    assert.doesNotMatch(flat.replace(/<mask [\s\S]*?<\/mask>/g, ""), /#[0-9a-fA-F]{3,8}\b|rgb\(|white|black/);
    for (const part of ["ov-wheel", "ov-needle", "ov-lever"]) assert.equal((flat.match(new RegExp(`class="${part} `, "g")) ?? []).length, 1, part);
  });

  it("the tags' type is never under the system's floor at the size the full tier gives the drawing", () => {
    const sizes = [...flat.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
    assert.equal(sizes.length, 10, "two lines per tag");
    // 490 units tall, drawn at 52svh of a 900 px stage (468 px): 13 units are 12.4 px.
    for (const size of sizes) assert.ok(size * (468 / 490) >= 12, `${size} units render under 12 px`);
  });
});

describe("scene 05, the receipt roll", () => {
  const scene = draw(createElement(ReceiptsScene));
  const t = text(scene);

  it("is chapter 03's scene: today's three claims, each beside its source, number and day; the note where two sources differ", () => {
    assert.match(scene, /^<section id="ch-03" data-scene="receipts" data-chapter="ch-03"/);
    assert.match(t, /03 · Is that true\? Every claim, beside its source\./);
    assert.equal(RECEIPTS.length, 3);
    for (const r of RECEIPTS) {
      assert.ok(t.includes(r.claim), r.claim);
      assert.ok(t.includes(r.source), r.source);
      for (const [k, v] of r.fields) assert.ok(t.includes(`${k} ${v}`), `${k} ${v}`);
    }
    assert.ok(t.includes("2 sources differ") && t.includes(DIFFER));
    assert.equal((scene.match(/data-receipt="true"/g) ?? []).length, 3);
    assert.equal((scene.match(/data-tie-from="true"/g) ?? []).length, 3, "each receipt names the line its thread leaves from");
  });

  it("the record gains the three rows in the receipts' order, each at its beat, and three threads tie them on", () => {
    assert.deepEqual([...scene.matchAll(/data-row="([^"]+)" data-beat=""/g)].map((m) => m[1]), ["BGMEA membership", "GOTS certificate", "Safety inspections"]);
    assert.equal((scene.match(/<dt /g) ?? []).length - (scene.match(/<article/g) ?? []).length * 4, 4, "Sources and the three new rows; the receipts' own terms aside");
    assert.equal((scene.match(/data-tie="true"/g) ?? []).length, 3);
    assert.match(scene, /<\/figure><div data-beat=""><div class="pane /, "the note is a beat on a solid pane, under the record");
  });

  it("is paper, not glass, and no bordered card: a slot, a sheet, the clipped ink and a torn edge", () => {
    assert.doesNotMatch(scene, /rounded-lg border border-line|pane-glass/);
    for (const part of ["roll-slot", "roll-sheet", "roll-print", "roll-tear", "receipt"]) assert.ok(scene.includes(`class="${part}"`), part);
    assert.match(scene, /<div data-roll="true" class="[^"]*"><div aria-hidden="true" class="roll-slot"><\/div><div class="relative mx-2\.5"><div aria-hidden="true" class="roll-sheet"><\/div><div data-paper="true" class="roll-print">/);
    assert.match(scene, /<svg aria-hidden="true" viewBox="0 0 400 10" preserveAspectRatio="none" class="roll-tear"><path d="M0 0L10 9L20 0[^"]*Z" class="fill-surface"><\/path><path d="M0 0L10 9[^"]*" class="fill-none stroke-line"/);
  });
});

describe("the chapters' arithmetic", () => {
  it("04: the machine runs, then the seam ties on and the row arrives as the thread sets out; twelve stitches and four turns", () => {
    assert.deepEqual(sourcesAt(0), { run: 0, wheel: 0, needle: 0, tie: 0, row: false });
    const end = sourcesAt(1);
    assert.equal(end.run, 1);
    assert.equal(end.wheel, 1440);
    assert.equal(end.tie, 1);
    assert.equal(end.row, true);
    assert.ok(SEAM.tie[0] >= SEAM.run[0], "the thread leaves while the seam is sewn");
    assert.equal(sourcesAt(SEAM.tie[0]).row, false);
    assert.equal(sourcesAt(SEAM.tie[0] + 0.001).row, true, "the row is there the moment the thread sets out for it");
    let peaks = 0;
    let rising = true;
    let last = 0;
    for (let p = 0; p <= 1 + 1e-9; p += 0.0005) {
      const at = sourcesAt(p);
      assert.ok(at.needle >= 0 && at.needle <= 1 && at.run >= sourcesAt(p - 0.0005).run, `at ${p}`);
      if (rising && at.needle < last - 1e-12) {
        peaks++;
        rising = false;
      } else if (!rising && at.needle > last + 1e-12) rising = true;
      last = at.needle;
    }
    assert.equal(peaks, SEAM.stitches);
  });

  it("05: the roll prints over most of the scroll; a row arrives only once its receipt's end has printed, in order; earlier receipts dim, the last never; the note is last", () => {
    const ends = [0.3, 0.6, 1];
    const { arrives, ...start } = receiptsAt(0, ends);
    assert.deepEqual(start, { print: 0, ties: [0, 0, 0], rows: [false, false, false], dim: [false, false, false], note: false });
    assert.deepEqual(arrives.map((a) => a.toFixed(3)), ["0.308", "0.536", "0.840"], "each receipt's moment is where the print reaches its end");
    assert.deepEqual(receiptsAt(1, ends), { print: 1, arrives, ties: [1, 1, 1], rows: [true, true, true], dim: [true, true, false], note: true });
    const firstAt = (pick: (a: ReturnType<typeof receiptsAt>) => boolean) => {
      for (let p = 0; p <= 1; p += 0.001) if (pick(receiptsAt(p, ends))) return p;
      return 2;
    };
    const rows = ends.map((_, i) => firstAt((a) => a.rows[i]!));
    assert.ok(rows[0]! > ROLL.print[0] && rows[0]! < rows[1]! && rows[1]! < rows[2]! && rows[2]! < firstAt((a) => a.note), rows.join());
    ends.forEach((end, i) => assert.ok(receiptsAt(rows[i]!, ends).print >= end - 1e-9, `row ${i} arrived at ${rows[i]} before its receipt had printed to ${end}`));
    ends.forEach((_, i) => assert.ok(receiptsAt(rows[i]!, ends).ties[i]! > 0, "a row is there as its thread sets out"));
    assert.ok(firstAt((a) => a.dim[0]!) > rows[0]! && firstAt((a) => a.dim[0]!) < rows[1]!, "the first receipt dims after its row and before the second's");
    for (let p = 0; p < 1; p += 0.01) assert.ok(receiptsAt(p + 0.01, ends).print >= receiptsAt(p, ends).print);
  });

  it("a beat comes at its moment and holds a little past it on the way back, so a scroll resting on the line does not flap it", () => {
    assert.equal(holds(false, 0.6, 0.6), false);
    assert.equal(holds(false, 0.601, 0.6), true);
    assert.equal(holds(true, 0.6 - BAND / 2, 0.6), true, "still on just below its moment");
    assert.equal(holds(true, 0.6 - BAND - 0.001, 0.6), false, "off again a band below");
    assert.equal(holds(false, 0.6 - BAND / 2, 0.6), false, "never on before its moment");
    assert.ok(BAND > 0 && BAND < ROLL.tie, "the band is shorter than a tie's draw");
  });

  it("a tie leaves to the right and arrives from the left, with at least a hand's width of curve", () => {
    assert.equal(curve({ x: 0, y: 0 }, { x: 200, y: 50 }), "M0 0C100 0 100 50 200 50");
    assert.equal(curve({ x: 0, y: 0 }, { x: 20, y: 0 }), "M0 0C48 0 -28 0 20 0");
    assert.equal(curve({ x: 1.26, y: 2.24 }, { x: 101.26, y: 2.24 }), "M1.3 2.2C51.3 2.2 51.3 2.2 101.3 2.2");
  });
});

describe("what Tailwind emits for the scenes", () => {
  /* eslint-disable @typescript-eslint/no-require-imports -- tailwind's loader and postcss are CommonJS tools */
  const postcss = require("postcss") as typeof import("postcss").default;
  const tailwind = require("tailwindcss") as (config: object) => import("postcss").AcceptedPlugin;
  const loadConfig = require("tailwindcss/loadConfig") as (file: string) => Record<string, unknown>;
  /* eslint-enable @typescript-eslint/no-require-imports */
  const classes = ["pane", "ov-wheel", "ov-needle", "ov-lever", "roll-slot", "roll-sheet", "roll-print", "roll-tear", "receipt", "animate-rise", "rec-arrive", "fill-brand", "stroke-brand-ink", "fill-ink-3", "film-full:h-[400svh]"];
  const compiled = postcss([tailwind({ ...loadConfig(path.join(repoRoot, "tailwind.config.ts")), content: [{ raw: classes.join(" "), extension: "html" }] })])
    .process(readFileSync(path.join(repoRoot, "app/ds.css"), "utf8"), { from: undefined })
    .then((r) => r.css.replace(/\s+/g, " "));
  const block = (css: string, opener: string) => {
    const i = css.indexOf(opener);
    assert.ok(i >= 0, `no ${opener}`);
    return css.slice(i, css.indexOf("}", i));
  };

  it("the overlock's parts, the roll and the beats move by variables the engine writes; with none written everything rests and shows", async () => {
    const css = await compiled;
    assert.match(block(css, ".ov-needle {"), /transform: translateY\(calc\(var\(--needle, 0\) \* 10px\)\)/);
    assert.match(block(css, ".ov-wheel {"), /stroke-dashoffset: calc\(var\(--wheel, 0\) \* -0\.25px\)/);
    assert.match(block(css, ".ov-lever {"), /transform-box: fill-box;[^}]*rotate\(calc\(var\(--needle, 0\) \* -16deg\)\)/);
    assert.match(block(css, '[data-film-tier="full"] .roll-sheet {'), /inset: 0 0 calc\(\(1 - var\(--print, 1\)\) \* 100%\) 0/);
    assert.match(block(css, '[data-film-tier="full"] .roll-print {'), /clip-path: inset\(0 0 calc\(\(1 - var\(--print, 1\)\) \* 100%\) 0\)/);
    assert.match(block(css, '[data-film-tier="full"] .roll-tear {'), /top: calc\(var\(--print, 1\) \* 100%\)/);
    assert.doesNotMatch(block(css, ".roll-print {"), /clip-path/, "off the full tier the roll is whole whatever was written");
    assert.match(css, /\.receipt\[data-dim\] \{ opacity: 0\.5/);
    assert.match(block(css, '[data-film-tier="full"] [data-beat]:not([data-on]) {'), /position: absolute; width: 1px; height: 1px;[^}]*clip: rect\(0, 0, 0, 0\)/, "a beat takes no place until its moment but stays in the page for a screen reader");
    assert.doesNotMatch(block(css, '[data-film-tier="full"] [data-beat]:not([data-on]) {'), /display: none|visibility: hidden/);
    assert.match(block(css, '[data-film-tier="full"] .pane > dl:not(:has(> :not([data-beat]), > [data-on])) {'), /margin-top: -1rem/, "a record whose rows are all still to come keeps no gap where they will be");
    assert.match(block(css, ".animate-rise {"), /ds-rise/);
    assert.match(block(css, ".fill-brand {"), /--ds-brand/);
    assert.match(block(css, ".stroke-brand-ink {"), /--ds-brand-ink/);
    assert.match(css, /\[data-film-tier="full"\] \.film-full\\:h-\\\[400svh\\\] \{ height: 400svh/);
  });
});
