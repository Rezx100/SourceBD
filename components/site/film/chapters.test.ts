// The home film, slices 3 and 4 (handoff-home-film §3.6, §3.7, §3.9, §4): scenes 04 to 08. The overlock flat with
// the five sources as hang tags, the receipt roll with today's three claims beside their sources, the map's close on
// the factory's area with its ring, the blank carton, the calendar with its alert, the record gaining its rows at
// their beats, the scroll's arithmetic for every scene, and what Tailwind emits for the parts the engine moves. The
// home page with the film on and off is held in film.test.ts.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ALERT, CARTON_CAPTION, DAYS, DIFFER, EXPORT_LINES, ExportsScene, LIST_LINE, OVERLOCK_CAPTION, RECEIPTS, ReceiptsScene, SITE_NOTE, SiteScene, SourcesScene, TimeLine, TimeScene } from "./chapters";
import { Atmosphere, COMPLIANCE_SCREEN, CloseScene, FiguresScene, LADDER_NOTE, LadderScene, OrderScene, PROMISES, PromisesScene, SCREENS, STAGE_CAPTION, TIERS, WHOLE_RECORD, liveFigures } from "./closing";
import { BAND, CARTON_END, CLOSE, EXPORTS, FIGURES, LADDER, ORDER, PROMISES as STEPS, RECEIPTS as ROLL, SEAM_END, SITE, SOURCES as SEAM, TIME, closeAt, curve, evenly, exportsAt, holds, orderAt, receiptsAt, siteAt, sourcesAt, timeAt } from "./engine/chapters";
import { RING_KM, STOPS, grid, ring, siteStops } from "./engine/map";
import { CARTON_TAG, Carton, Overlock, TAGS } from "./flats";
import { MAP_CREDIT } from "./opening";
import { GOTS, GOTS_DUE, RFQ, SITE as SITE_ROW, SOURCES, SOURCE_DATES } from "./record";
import { NO_FACTS, parseFacts } from "@/lib/site-facts";

const repoRoot = process.cwd();
type Position = [number, number];
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


describe("scene 06, the address on the map", () => {
  const scene = draw(createElement(SiteScene));
  const t = text(scene);

  it("is chapter 04's scene: today's words, a stage for the one live map, a picture of the same close for the other tiers, and the credit on both", () => {
    assert.match(scene, /^<section id="ch-04" data-scene="site" data-chapter="ch-04"/);
    assert.match(t, /04 · Where are they\? One address, on the map\. The address comes from the registers\./);
    assert.match(scene, /<div data-map-site="true" aria-hidden="true" class="absolute inset-0 hidden film-full:block"><\/div>/);
    assert.match(scene, /srcSet="\/site\/film\/map-site-dark\.avif"\/><img src="\/site\/film\/map-site-light\.avif"/);
    assert.equal((scene.match(new RegExp(MAP_CREDIT.replace(/\./g, "\\."), "g")) ?? []).length, 2);
    assert.match(/<section[^>]*><div class="([^"]*)"/.exec(scene)?.[1] ?? "", /film-full:isolate film-full:overflow-hidden/, "the map is clipped to the stage, on the full tier only");
  });

  it("the ring is named for what it is, the record gains Site at its beat on glass, and one thread ties them", () => {
    assert.ok(t.includes(SITE_NOTE.title) && t.includes(SITE_NOTE.body) && SITE_NOTE.body.includes("the area, not the building"));
    assert.deepEqual([...scene.matchAll(/data-row="([^"]+)" data-beat=""/g)].map((m) => m[1]), ["Site"]);
    assert.equal((scene.match(/<dt /g) ?? []).length, 5, "Sources, the three of chapter 03, and Site");
    assert.equal((scene.match(/pane-glass/g) ?? []).length, 2, "the record and the note, over the live map; never a third");
    assert.equal((scene.match(/data-tie="true"/g) ?? []).length, 1);
    assert.doesNotMatch(scene, /rounded-lg border border-line/);
    assert.ok(SITE_ROW.marks?.includes("BGMEA") && SITE_ROW.marks.includes("BKMEA"), "the row carries the marks of the two registers the note names");
  });
});

describe("scene 07, the export carton", () => {
  const scene = draw(createElement(ExportsScene));
  const flat = draw(createElement(Carton));
  const t = text(scene);

  it("is chapter 05's scene: one blank carton with its tag, today's words on what the records will show, and no figure", () => {
    assert.match(scene, /^<section id="ch-05" data-scene="exports" data-chapter="ch-05"/);
    assert.match(t, /05 · Who do they ship to\? Export records are coming\./);
    assert.equal((scene.match(/<svg data-carton="true" aria-hidden="true"/g) ?? []).length, 1);
    assert.ok(flat.includes(`>${CARTON_TAG}</text>`) && CARTON_TAG === "Coming in v2");
    assert.ok(t.includes(CARTON_CAPTION) && CARTON_CAPTION.endsWith("· illustration"));
    for (const line of EXPORT_LINES) assert.ok(t.includes(line), line);
    assert.doesNotMatch(t, /FOB US|PCS|\bSpain\b|\bCanada\b|\d{1,3},\d{3} pieces/);
    assert.doesNotMatch(flat.replace(/<text[\s\S]*?<\/text>/g, ""), /[A-Z]{3,}/, "no shipping mark: the lines are there, the words are not");
  });

  it("the record gains Export records at its beat, the thread leaves the carton's side, and the drawing types no colour", () => {
    assert.deepEqual([...scene.matchAll(/data-row="([^"]+)" data-beat=""/g)].map((m) => m[1]), ["Export records"]);
    assert.equal((scene.match(/<dt /g) ?? []).length, 6);
    assert.equal((scene.match(/data-tie="true"/g) ?? []).length, 1);
    assert.ok(flat.includes(`M290 40 ${CARTON_END.x} 12V212L290 240Z`), "the side reaches the thread's edge");
    assert.doesNotMatch(flat, /#[0-9a-fA-F]{3,8}\b|rgb\(|white|black/);
    assert.doesNotMatch(scene, /rounded-lg border border-line|pane-glass/);
  });
});

describe("scene 08, time moves", () => {
  const scene = draw(createElement(TimeScene));
  const line = draw(createElement(TimeLine));
  const t = text(scene);

  it("is chapter 06's scene: today's words, the three days in words, the alert, the list check with what was found, never 'clear'", () => {
    assert.match(scene, /^<section id="ch-06" data-scene="time" data-chapter="ch-06"/);
    assert.match(t, /06 · Will it still be true next month\? The list changes\. We check again\./);
    assert.equal(DAYS.length, 3);
    assert.deepEqual(DAYS.map(([d]) => d), [...TIME.marks]);
    for (const [, when] of DAYS) assert.ok(t.includes(when), when);
    for (const v of Object.values(ALERT)) assert.ok(t.includes(v), v);
    assert.ok(t.includes(LIST_LINE) && LIST_LINE.includes("no link found") && LIST_LINE.includes("our copy from 14 May 2026"));
    assert.doesNotMatch(t, /UFLPA[^.]{0,80}\bclear(ed)?\b/i);
    assert.doesNotMatch(scene, /count-?up|data-count|aria-valuenow/);
  });

  it("the days are one at a time on the full tier, the first on; the alert and the line on the list are beats; the UFLPA row arrives last", () => {
    const days = scene.slice(scene.indexOf("<ol data-days"), scene.indexOf("</ol>", scene.indexOf("<ol data-days")));
    assert.equal((days.match(/<li data-on=""/g) ?? []).length, 1);
    assert.match(days, /^<ol data-days="true"[^>]*><li data-on=""/);
    assert.match(days, /film-full:sr-only/);
    assert.equal((scene.match(/<div data-beat="" class="w-full max-w-\[360px\]"><div class="pane /g) ?? []).length, 1, "the alert is a beat on a solid pane");
    assert.match(scene, /<p data-beat="" class="font-mono text-xs text-ink-3">Checked against the UFLPA Entity List/);
    assert.deepEqual([...scene.matchAll(/data-row="([^"]+)" data-beat=""/g)].map((m) => m[1]), ["UFLPA Entity List"]);
    assert.equal((scene.match(/<dt /g) ?? []).length, 7);
  });

  it("the GOTS row is the one to watch: amber, and on the full tier only once its day comes", () => {
    assert.match(scene, /<div data-row="GOTS certificate" data-watch="" class="group\/row /);
    assert.match(scene, /data-watch=""[^]*?<dd class="text-base font-semibold text-caution transition-colors duration-slow film-full:text-ink film-full:group-data-\[due\]\/row:text-caution">GOTS-19020 · expires 15 Dec 2026<\/dd>/);
    assert.equal((scene.match(/data-watch=""/g) ?? []).length, 1);
    assert.equal(GOTS_DUE.label, GOTS.label);
  });

  it("the time line is words and lines only: the dates, the run drawn by the scroll, a mark for each day that shows once the line reaches it", () => {
    assert.match(line, /^<svg data-timeline="true" aria-hidden="true" viewBox="0 0 680 84"/);
    for (const d of ["3 Oct", "1 Nov", "1 Dec", "15 Dec", "Day 0 · shortlisted", "Day 43 · alert", "Day 59 · checked again"]) assert.ok(line.includes(`>${d}</text>`) || line.includes(`${d}</text>`), d);
    assert.match(line, /<path d="M8 44H672" pathLength="1" class="time-run fill-none stroke-ink"/);
    const marks = [...line.matchAll(/class="time-mark [^"]*" style="--at:([\d.]+)"/g)].map((m) => Number(m[1]));
    assert.deepEqual(marks, [43 / 73, 59 / 73, 43 / 73, 59 / 73].map((v) => Number(v.toFixed(3))), "the alert's dot, the check's dot and their two labels, each at its own day");
    assert.doesNotMatch(line, /#[0-9a-fA-F]{3,8}\b|rgb\(|white|black/);
  });
});

describe("the later chapters' arithmetic", () => {
  it("06: the camera travels, then the ring opens, then the thread ties and the row arrives as it sets out, then the note", () => {
    assert.deepEqual(siteAt(0), { camera: 0, ring: 0, tie: 0, row: false, note: false });
    assert.deepEqual(siteAt(1), { camera: 1, ring: 1, tie: 1, row: true, note: true });
    assert.ok(SITE.camera[1] <= SITE.ring[1] && SITE.ring[0] < SITE.tie[0] && SITE.tie[1] <= SITE.note);
    assert.equal(siteAt(SITE.tie[0]).row, false);
    assert.equal(siteAt(SITE.tie[0] + 0.001).row, true);
    assert.ok(siteAt(SITE.tie[0]).camera === 1, "the camera has landed before the thread sets out");
  });

  it("07: the carton slides in whole before its thread sets out; the row arrives with the thread", () => {
    assert.deepEqual(exportsAt(0), { slide: 0, tie: 0, row: false });
    assert.deepEqual(exportsAt(1), { slide: 1, tie: 1, row: true });
    assert.ok(EXPORTS.slide[1] < EXPORTS.tie[0]);
    assert.equal(exportsAt(EXPORTS.tie[0]).slide, 1);
    assert.equal(exportsAt(EXPORTS.tie[0] + 0.001).row, true);
  });

  it("08: the scroll is the calendar, 3 Oct to 15 Dec; day 43 is the alert (30 days left), day 59 the new list copy; the days rest at each end", () => {
    assert.equal(TIME.days, 73, "3 Oct to 15 Dec 2026");
    assert.equal(TIME.marks[1], 43, "15 Nov: 30 days before 15 Dec");
    assert.equal(TIME.marks[2], 59, "1 Dec");
    assert.deepEqual(timeAt(0), { t: 0, day: 0, marks: timeAt(0).marks, alert: false, list: false });
    assert.deepEqual({ ...timeAt(1), marks: undefined }, { t: 1, day: 73, marks: undefined, alert: true, list: true });
    const { marks } = timeAt(0.5);
    assert.ok(marks[0] === TIME.run[0] && marks[1]! < marks[2]! && marks[2]! < TIME.run[1]);
    assert.equal(timeAt(marks[1]!).alert, false);
    assert.equal(timeAt(marks[1]! + 0.001).alert, true, "past its mark, by the same rule the beats use");
    assert.equal(timeAt(marks[2]! + 0.01).list, true);
    for (let p = 0; p < 1; p += 0.01) assert.ok(timeAt(p + 0.01).day >= timeAt(p).day, "the days never run backwards as the scroll runs forward");
  });

  it("the ring is a kilometre wide, round the place it is given; the site camera starts where the opening's ends and lands on the place, pitched like a table", () => {
    const r = ring([90.32, 23.98]);
    const pts = (r.geometry.coordinates as number[][][])[0]!;
    assert.equal(pts.length, 65);
    assert.deepEqual(pts[0], pts[64], "closed");
    const widthKm = (Math.max(...pts.map((p) => p[0]!)) - Math.min(...pts.map((p) => p[0]!))) * 111.32 * Math.cos((23.98 * Math.PI) / 180);
    assert.ok(Math.abs(widthKm - RING_KM) < 0.01, `${widthKm} km wide`);
    const stops = siteStops([90.32, 23.98]);
    assert.deepEqual({ ...stops[0], p: undefined }, { ...STOPS.at(-1), p: undefined });
    assert.deepEqual(stops.at(-1)!.center, [90.32, 23.98]);
    assert.ok(stops.at(-1)!.zoom > stops[0]!.zoom && stops.at(-1)!.pitch > stops[0]!.pitch);
    assert.ok(stops.at(-1)!.zoom >= 13.5, "a kilometre is at least 170 px wide at this zoom, so the ring reads");
    const lines = grid([90.32, 23.98], 2);
    assert.equal(lines.length, 12, "two cells each way: six lines across, six down");
    const first = lines[0]!.geometry.coordinates as Position[];
    assert.ok(Math.abs((first[1]![1] - first[0]![1]) * 110.57 - 5) < 1e-6, "five kilometres long");
  });
});

describe("scene 09, the real product staged", () => {
  const scene = draw(createElement(OrderScene));
  const t = text(scene);
  const atmosphere = draw(createElement(Atmosphere));

  it("is chapter 07's scene: today's words, both roles' tabs in the page, the three steps in order with the first on, and the screens with their alt text", () => {
    assert.match(scene, /^<section id="ch-7" data-scene="order" data-chapter="ch-7"/);
    assert.match(t, /07 · Can they make my order\? Shortlist\. Ask\. Compare\. Save the suppliers you like\./);
    assert.match(scene, /role="tablist"/);
    assert.equal((scene.match(/role="tabpanel"/g) ?? []).length, 2);
    const steps = scene.slice(scene.indexOf("<ol data-order-steps"), scene.indexOf("</ol>", scene.indexOf("<ol data-order-steps")));
    assert.equal((steps.match(/<li /g) ?? []).length, 3);
    assert.match(steps, /^<ol data-order-steps="true"[^>]*><li data-on=""/);
    assert.deepEqual(SCREENS.map((x) => x.step), ["Shortlist from your saved suppliers", "Send one RFQ", "Compare the quotes"]);
    for (const x of SCREENS) assert.ok(scene.includes(`src="${x.src}" alt="${x.alt.replace(/'/g, "&#x27;")}"`), x.src);
    assert.match(scene, /alt="The Saved page with three suppliers picked/);
    assert.ok(scene.includes(`src="${COMPLIANCE_SCREEN.src}" alt="The Compliance page: certificates that need a look`));
    assert.match(t, /Same loop, for compliance\./);
    assert.doesNotMatch(scene, /rounded-lg border border-line|pane-glass/, "no bordered card, and the windows are solid: the ground behind them is drawn, not live");
  });

  it("the screens sit on a stage, one window each, the step's own on; the cursor is on the composer only, aimed at Send RFQ; the caption says the app is light in both themes", () => {
    const first = scene.indexOf('role="tabpanel"');
    const sourcing = scene.slice(first, scene.indexOf('role="tabpanel"', first + 1));
    assert.equal((sourcing.match(/data-screen="true"/g) ?? []).length, 3);
    assert.equal((sourcing.match(/<div data-screen="true" data-on=""/g) ?? []).length, 1);
    assert.match(sourcing, /<div data-screen="true" data-on="" class="stage-screen"><div class="pane [^"]*stage-window[^"]*" data-window="true"><img src="\/site\/saved-selected\.png"/);
    assert.equal((sourcing.match(/data-cursor="true"/g) ?? []).length, 3, "the spotlight, the press and the cursor, once");
    assert.ok(sourcing.indexOf("data-cursor") > sourcing.indexOf("rfq-one.png") && sourcing.indexOf("data-cursor") < sourcing.indexOf("rfq-quotes.png"));
    assert.match(sourcing, /class="stage-cursor [^"]*" style="left:92\.6%;top:95\.5%"/);
    assert.ok(t.includes(STAGE_CAPTION) && /light in both themes/.test(STAGE_CAPTION));
    assert.equal((scene.match(/<figure class="flex flex-col gap-3"[^>]*><div class="relative isolate overflow-hidden rounded-pane bg-sunken/g) ?? []).length, 2, "one stage per role");
    assert.equal((scene.match(/data-order-screens=""/g) ?? []).length, 1, "the engine swaps the sourcing stage's screens only; the compliance stage's one screen is never touched");
    assert.match(sourcing, /<figure class="flex flex-col gap-3" data-order-screens="">/);
  });

  it("the atmosphere is our own drawing: no picture, no text, no colour typed, nothing that could pass for a real factory", () => {
    assert.match(atmosphere, /^<svg aria-hidden="true"/);
    assert.doesNotMatch(atmosphere, /<text|<image|href="http|#[0-9a-fA-F]{3,8}\b|rgb\(|white|black/);
    assert.equal((scene.match(/<div aria-hidden="true" class="absolute inset-0 -z-10/g) ?? []).length, 2, "behind each stage");
    assert.match(atmosphere, /stroke-brand-ink/, "one green thread in soft focus");
  });
});

describe("scenes 10 and 11, the promises, the ladder and the figures", () => {
  const facts = parseFacts({ suppliers_indexed: 10268, last_refreshed_at: "2026-10-02T05:48:07Z" }, { sources_listed: 25, sources_with_records: 14, certificates_on_file: 4275, certificates_expired: 518, rsc_records: 2331, latest_read: "2026-10-02T05:48:07Z", sources: [] });
  const promises = draw(createElement(PromisesScene));
  const ladder = draw(createElement(LadderScene, { facts }));
  const figures = draw(createElement(FiguresScene, { facts }));

  it("10 is chapter 08's scene: the three promises, words only, each a line that turns at its step with its reason beside it as a beat", () => {
    assert.match(promises, /^<section id="ch-8" data-scene="promises" data-chapter="ch-8"/);
    assert.match(text(promises), /08 · Why should I trust you\? Three things we never do\. We show what the registers say\./);
    assert.deepEqual(PROMISES.map(([, x]) => x), ["No scores.", "No paid placement.", "No fact without a source and a date."]);
    assert.equal((promises.match(/data-promise="true"/g) ?? []).length, 3);
    assert.equal((promises.match(/<p data-beat="" /g) ?? []).length, 3);
    assert.doesNotMatch(promises, /data-promise="true" data-on/, "none is on before the scroll reaches it");
    assert.match(promises, /group-data-\[on\]\/promise:text-ink/);
    assert.doesNotMatch(promises, /rounded-lg border border-line|pane|<img|<svg/);
  });

  it("the ladder is today's five tiers in rank order, each a beat, with the note and the methodology link", () => {
    assert.match(ladder, /^<section data-scene="ladder" data-chapter="ch-8"/);
    assert.deepEqual([...ladder.matchAll(/<li data-beat=""[^>]*><span class="font-mono text-xs text-ink-3">([^<]+)</g)].map((m) => m[1]), ["Tier 1", "Tier 2", "Tier 3", "Tier 4", "Tier 5"]);
    assert.deepEqual(TIERS.map(([x]) => x), ["Tier 1", "Tier 2", "Tier 3", "Tier 4", "Tier 5"]);
    assert.ok(text(ladder).includes(LADDER_NOTE));
    assert.match(text(ladder), /25 sources listed · 14 hold supplier records/);
    assert.match(ladder, /href="\/methodology"/);
  });

  it("11 is the live figures rising whole, each a beat with what it counts; none counts up; with nothing read there is no scene", () => {
    assert.match(figures, /^<section data-scene="figures" data-chapter="ch-8"/);
    assert.match(text(figures), /The numbers, as they stand\. Counted straight from our records, not rounded\./);
    assert.deepEqual(liveFigures(facts), [["10,268", "Bangladesh garment suppliers"], ["4,275", "certificates on file, 518 already expired"], ["25", "sources listed, 14 hold supplier records"], ["2,331", "RSC factory records"]]);
    assert.equal((figures.match(/<li data-beat=""/g) ?? []).length, 4);
    assert.match(figures, /class="film-figure-fit [^"]*">10,268</);
    assert.match(text(figures), /Updated 2 Oct 2026 · latest register read 2 Oct 2026/);
    assert.doesNotMatch(figures, /count-?up|data-count|aria-valuenow/);
    assert.equal(draw(createElement(FiguresScene, { facts: NO_FACTS })), "");
    assert.deepEqual(liveFigures({ ...NO_FACTS, rscRecords: 7 }), [["7", "RSC factory records"]]);
  });
});

describe("scene 12, the whole record and the way in", () => {
  const scene = draw(createElement(CloseScene));
  const t = text(scene);

  it("is chapter 09's scene, night in either theme, with a stage for the planet to come back to, today's words and the search on public Discover", () => {
    assert.match(scene, /^<section id="ch-9" data-scene="close" data-chapter="ch-9" data-ground="night"/);
    assert.match(scene, /<div data-planet-close="true" aria-hidden="true" class="absolute inset-0 hidden film-full:block"><\/div>/);
    assert.match(t, /09 · The whole record Every row, with its source\. Who they are, what is true/);
    assert.match(scene, /<form[^>]*action="\/discover"/);
    assert.match(scene, /<form[^>]*role="search"/);
    assert.match(scene, /<input[^>]*id="close-q"/);
    assert.match(scene, /<input[^>]*name="q"/);
    assert.match(t, /Try .knit dresses Gazipur. or .GOTS./);
  });

  it("the record is whole: every row a beat in the chapters' order, the RFQ last and waiting; the thread ties on and ends in a bartack, never a circle; two panes of glass over the planet", () => {
    assert.deepEqual(WHOLE_RECORD.map((r) => r.label), ["Sources", "BGMEA membership", "GOTS certificate", "Safety inspections", "Site", "Export records", "UFLPA Entity List", "RFQ"]);
    assert.deepEqual([...scene.matchAll(/data-row="([^"]+)" data-beat=""/g)].map((m) => m[1]), [...WHOLE_RECORD.map((r) => r.label)]);
    assert.equal((scene.match(/<dt /g) ?? []).length, 8);
    assert.ok(t.includes(RFQ.value) && RFQ.value === "Waiting for a quote" && t.includes("Saved · watching"));
    assert.equal((scene.match(/data-tie="true"/g) ?? []).length, 1);
    assert.match(scene, /class="thread thread-join"/);
    assert.match(scene, /class="thread thread-end"/);
    assert.doesNotMatch(scene, /<circle|rounded-lg border border-line/);
    assert.equal((scene.match(/pane-glass/g) ?? []).length, 2);
  });
});

describe("the late chapters' arithmetic", () => {
  it("09: the first step is on from the start, the next two at their marks; the cursor arrives and presses within the second step, before the third", () => {
    assert.deepEqual(orderAt(0), { step: 0, cursor: 0 });
    assert.equal(orderAt(ORDER.steps[1]).step, 0);
    assert.equal(orderAt(ORDER.steps[1] + 0.001).step, 1);
    assert.equal(orderAt(ORDER.steps[2] + 0.001).step, 2);
    assert.deepEqual(orderAt(1), { step: 2, cursor: 1 });
    assert.ok(ORDER.cursor[0] > ORDER.steps[1] && ORDER.cursor[1] < ORDER.steps[2]);
    assert.equal(orderAt(ORDER.cursor[1]).cursor, 1, "pressed before the quotes slide in");
    for (let p = 0; p < 1; p += 0.01) assert.ok(orderAt(p + 0.01).step >= orderAt(p).step && orderAt(p + 0.01).cursor >= orderAt(p).cursor);
  });

  it("the moments of a stretch are spread evenly, the first at its start and the last at its end; one moment sits at the start", () => {
    assert.deepEqual([0, 1, 2, 3].map((i) => evenly([0.1, 0.7], 4, i)).map((v) => Number(v.toFixed(3))), [0.1, 0.3, 0.5, 0.7]);
    assert.equal(evenly([0.2, 0.8], 1, 0), 0.2);
    assert.ok(STEPS.steps[0] < STEPS.steps[1] && STEPS.steps[1] < STEPS.steps[2] && STEPS.steps[2] < 1);
    assert.ok(LADDER.rows[0] > 0 && LADDER.rows[1] < 1 && FIGURES.rows[0] > 0 && FIGURES.rows[1] < 1);
  });

  it("12: the eight rows stitch on in order over the first half, then the thread ties, after the last row and before the end", () => {
    const at = closeAt(0, 8);
    assert.equal(at.rows.length, 8);
    assert.ok(at.rows.every((m, i) => i === 0 || m > at.rows[i - 1]!));
    assert.ok(Math.abs(at.rows[0]! - CLOSE.rows[0]) < 1e-12 && Math.abs(at.rows[7]! - CLOSE.rows[1]) < 1e-12);
    assert.ok(CLOSE.rows[1] < CLOSE.tie[0] && CLOSE.tie[1] < 1);
    assert.equal(closeAt(CLOSE.tie[0], 8).tie, 0);
    assert.equal(closeAt(1, 8).tie, 1);
    assert.equal(closeAt(0.5, 0).rows.length, 0, "a record with no rows asks for none");
  });
});

describe("what Tailwind emits for the scenes", () => {
  /* eslint-disable @typescript-eslint/no-require-imports -- tailwind's loader and postcss are CommonJS tools */
  const postcss = require("postcss") as typeof import("postcss").default;
  const tailwind = require("tailwindcss") as (config: object) => import("postcss").AcceptedPlugin;
  const loadConfig = require("tailwindcss/loadConfig") as (file: string) => Record<string, unknown>;
  /* eslint-enable @typescript-eslint/no-require-imports */
  const classes = ["pane", "ov-wheel", "ov-needle", "ov-lever", "roll-slot", "roll-sheet", "roll-print", "roll-tear", "receipt", "animate-rise", "rec-arrive", "fill-brand", "stroke-brand-ink", "fill-ink-3", "film-full:h-[400svh]", "time-run", "time-mark", "fill-caution-icon", "text-caution", "film-full:text-ink", "film-full:group-data-[due]/row:text-caution", "group/row", "stage-screen", "stage-window", "stage-cursor", "stage-press", "stage-spot", "film-figure-fit", "film-full:group-data-[on]/promise:text-ink", "group/promise", "film-full:aspect-[1440/900]"];
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

  it("the carton slides by --slide on the full tier only; the calendar's line is drawn by --t and a mark shows once the line reaches its own --at; a watched row's value is amber, and on the full tier waits for data-due", async () => {
    const css = await compiled;
    assert.match(block(css, '[data-film-tier="full"] svg[data-carton] {'), /opacity: var\(--slide, 1\); transform: translateX\(calc\(\(var\(--slide, 1\) - 1\) \* 160px\)\)/);
    assert.doesNotMatch(css, /(^|[^\]]) svg\[data-carton\] \{/, "off the full tier the carton stands whatever was written");
    assert.match(block(css, ".time-run {"), /stroke-dasharray: 1; stroke-dashoffset: calc\(1 - var\(--t, 1\)\)/);
    assert.match(block(css, ".time-mark {"), /opacity: clamp\(0, calc\(\(var\(--t, 1\) - var\(--at, 0\)\) \* 60\), 1\)/);
    assert.match(block(css, ".fill-caution-icon {"), /--ds-caution-icon/);
    assert.match(block(css, ".text-caution {"), /--ds-caution/);
    assert.match(css, /\[data-film-tier="full"\] \.group\\\/row\[data-due\] \.film-full\\:group-data-\\\[due\\\]\\\/row\\:text-caution \{ --tw-text-opacity: 1; color: rgb\(var\(--ds-caution\)/);
  });
  it("the stage's windows, the cursor and the figures move by variables the engine writes, on the full tier where the screens swap; with nothing written the cursor rests pressed and the screens stand in a column", async () => {
    const css = await compiled;
    assert.match(block(css, ".stage-window {"), /rotateY\(calc\(\(var\(--p, 0\.5\) - 0\.5\) \* -6deg\)\)/);
    assert.match(block(css, '[data-film-tier="full"] .stage-screen {'), /position: absolute; inset: 0; opacity: 0; transform: translateX\(32px\)/);
    assert.match(block(css, '[data-film-tier="full"] .stage-screen[data-on] {'), /opacity: 1; transform: none/);
    assert.doesNotMatch(block(css, ".stage-window {"), /position: absolute/, "off the full tier the windows stand in a column");
    assert.match(block(css, ".stage-cursor {"), /translate\(calc\(\(1 - var\(--cursor, 1\)\) \* 180px\)/);
    assert.match(block(css, ".stage-press {"), /opacity: clamp\(0, calc\(\(var\(--cursor, 1\) - 0\.9\) \* 10\), 1\)/);
    assert.match(block(css, ".stage-spot {"), /radial-gradient\(circle at var\(--sx\) var\(--sy\)/);
    assert.match(block(css, '[data-film-tier="full"] .film-figure-fit {'), /font-size: min\(200px, 20svh\)/);
    assert.match(css, /\[data-film-tier="full"\] \.group\\\/promise\[data-on\] \.film-full\\:group-data-\\\[on\\\]\\\/promise\\:text-ink \{/);
    assert.match(css, /\[data-film-tier="full"\] \.film-full\\:aspect-\\\[1440\\\/900\\\] \{ aspect-ratio: 1440\s*\/\s*900/);
  });
});
