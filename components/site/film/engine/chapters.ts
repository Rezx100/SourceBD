// Scenes 04 and 05 (handoff-home-film §3.7, §3.9, §4): what the scroll moves in the overlock and the receipt roll,
// and the threads that tie each to its row of the record. The maths is pure (`sourcesAt`, `receiptsAt`, `curve`)
// and runs under `node --test`; `startChapters` applies it to the DOM on the full tier only, and puts everything it
// wrote back when the film stops. On the lite and still tiers nothing here runs: every part rests, the roll is
// whole and every row is there, which is the stacked page.

import { all, clamp, fit, span } from "./director";
import type { Tier } from "./tier";

/**
 * Scene 04, "02 · Who are they?": the overlock runs (the handwheel turns, the needle takes one stitch per step,
 * the seam draws along the cloth), then the seam leaves the drawing and ties on to the record, whose Sources row
 * stitches on as the thread sets out.
 */
export const SOURCES = { run: [0.1, 0.64], tie: [0.6, 0.74], stitches: 12 } as const;

export function sourcesAt(p: number) {
  const run = span(SOURCES.run, p);
  const tie = span(SOURCES.tie, p);
  return {
    run,
    /** The handwheel's turn, in degrees: four turns over the run. */
    wheel: run * 1440,
    /** The needle bar, 0 up to 1 down: one stitch per step of the run. */
    needle: (1 - Math.cos(run * Math.PI * 2 * SOURCES.stitches)) / 2,
    tie,
    /** A row arrives the moment its thread sets out: it is the thread's destination, so it must be there to tie to. */
    row: tie > 0,
  };
}

/** Where the seam leaves the overlock drawing, in its own units (`flats.tsx` draws the cloth to this point). */
export const SEAM_END = { x: 460, y: 361.5 } as const;

/**
 * Scene 05, "03 · Is that true?": the roll prints from its slot over most of the scroll; as each receipt's end
 * comes out, a thread ties it to its row and the row arrives; the earlier receipts dim as the next prints; the
 * note on the two sources that differ comes last.
 */
export const RECEIPTS = { print: [0.08, 0.84], tie: 0.05, note: 0.9 } as const;

/** `ends`: where each receipt ends as a share of the paper's length, ascending, the last one 1. */
export function receiptsAt(p: number, ends: readonly number[]) {
  const [a, b] = RECEIPTS.print;
  /** The point of the scroll at which each receipt has printed to its end: its thread sets out and its row arrives. */
  const arrives = ends.map((end) => a + (b - a) * end);
  const ties = arrives.map((at) => clamp((p - at) / RECEIPTS.tie));
  return {
    print: span(RECEIPTS.print, p),
    arrives,
    ties,
    rows: ties.map((t) => t > 0),
    dim: ties.map((t, i) => i < ties.length - 1 && t >= 1),
    note: p >= RECEIPTS.note,
  };
}

type Point = { x: number; y: number };
const px = (v: number) => Math.round(v * 10) / 10;

/** A thread from `a` to `b` in a layer's own pixels: out to the right, then in to the row. */
export const curve = (a: Point, b: Point): string => {
  const dx = Math.max(48, Math.abs(b.x - a.x) / 2);
  return `M${px(a.x)} ${px(a.y)}C${px(a.x + dx)} ${px(a.y)} ${px(b.x - dx)} ${px(b.y)} ${px(b.x)} ${px(b.y)}`;
};

/** How far back past its moment a beat holds on, so a scroll resting on the line does not flap it on and off. */
export const BAND = 0.01;
/** Whether a beat is on at `p`, given whether it was: it comes at its moment `at` and holds until BAND before it. */
export const holds = (was: boolean, p: number, at: number): boolean => (was ? p > at - BAND : p > at);

export type Chapters = { onScene(name: string, p: number): void; stop(): void };

export function startChapters(root: HTMLElement, tier: Tier): Chapters {
  if (tier !== "full") return { onScene() {}, stop() {} };
  const scene = (name: string) => root.querySelector<HTMLElement>(`[data-scene="${name}"]`);
  // Everything is found once: the handlers run on every frame the scroll moves a scene.
  const sources = scene("sources");
  const flat = sources?.querySelector<SVGSVGElement>("svg[data-overlock]") ?? null;
  const seam = sources?.querySelector<SVGGElement>("[data-seam]") ?? null;
  const seamTie = all<SVGGElement>(sources, "[data-tie]")[0];
  const sourcesRow = all<HTMLElement>(sources, "[data-row][data-beat]")[0];
  const receipts = scene("receipts");
  const roll = receipts?.querySelector<HTMLElement>("[data-roll]") ?? null;
  const paper = receipts?.querySelector<HTMLElement>("[data-paper]") ?? null;
  const items = all<HTMLElement>(paper, "[data-receipt]");
  const lines = items.map((item) => item.querySelector("[data-tie-from]"));
  const ties = all<SVGGElement>(receipts, "[data-tie]");
  const rows = all<HTMLElement>(receipts, "[data-row][data-beat]");
  const note = all<HTMLElement>(receipts, "[data-beat]:not([data-row])")[0];

  // A beat is a thing that arrives at its moment: a row of the record stitches on, anything else rises. Once on it
  // holds a little past its moment on the way back (BAND), so a scroll resting on the line does not flap it.
  const beat = (el: Element | undefined, p: number, at: number) => {
    if (!el) return;
    const was = el.hasAttribute("data-on");
    const on = holds(was, p, at);
    if (on === was) return;
    el.toggleAttribute("data-on", on);
    el.classList.toggle(el.hasAttribute("data-row") ? "rec-arrive" : "animate-rise", on);
  };
  /** The layer a tie group draws on, sized to its own box; the box is returned for the points. */
  const layerOf = (g: SVGGElement | undefined) => {
    const layer = g?.ownerSVGElement;
    if (!layer) return null;
    const box = layer.getBoundingClientRect();
    fit(layer, box.width, box.height);
    return box;
  };
  // A tie: the thread from a point on the stage to a row's green dot (`.rec-arrive::after` in app/ds.css: 6px, 14px
  // left of the row's padding edge and 18px down, so 11 and 22 from the row's border box), drawn by `--p` on its
  // group. A path that has not moved is not written again: an attribute written again still costs a layout.
  const tie = (g: SVGGElement | undefined, box: DOMRect, from: Point | null, row: DOMRect | null, p: number) => {
    if (!g || !from || !row) return;
    const d = curve({ x: from.x - box.left, y: from.y - box.top }, { x: row.left - box.left - 11, y: row.top - box.top + 22 });
    for (const path of g.querySelectorAll("path")) if (path.getAttribute("d") !== d) path.setAttribute("d", d);
    g.style.setProperty("--p", p.toFixed(3));
  };
  /** A row's box once it is on; while it waits it has no place of its own. */
  const placeOf = (row: HTMLElement | undefined) => (row?.hasAttribute("data-on") ? row.getBoundingClientRect() : null);

  const showSources = (p: number) => {
    if (!sources) return;
    const at = sourcesAt(p);
    // The writes, on the drawing and its parts (never on the scene: an inherited property restyles the whole of
    // it); then one round of reads; then the thread.
    flat?.style.setProperty("--wheel", at.wheel.toFixed(1));
    flat?.style.setProperty("--needle", at.needle.toFixed(3));
    seam?.style.setProperty("--p", at.run.toFixed(3));
    beat(sourcesRow, p, SOURCES.tie[0]);
    const m = flat?.getScreenCTM();
    const end = m ? new DOMPoint(SEAM_END.x, SEAM_END.y).matrixTransform(m) : null;
    const box = layerOf(seamTie);
    if (box) tie(seamTie, box, end, placeOf(sourcesRow), at.tie);
  };

  const showReceipts = (p: number) => {
    if (!receipts || !paper || !items.length) return;
    // One round of reads: where each receipt ends on the paper (it moves only with the layout).
    const height = paper.offsetHeight;
    const at = receiptsAt(p, items.map((item) => (item.offsetTop + item.offsetHeight) / height));
    // The writes: the roll's print, the receipts' dimming, the beats.
    roll?.style.setProperty("--print", at.print.toFixed(3));
    items.forEach((item, i) => item.toggleAttribute("data-dim", at.dim[i] ?? false));
    rows.forEach((row, i) => beat(row, p, at.arrives[i] ?? 1));
    beat(note, p, RECEIPTS.note);
    // Reads again, now that the rows that arrived have their place; then the threads.
    const box = layerOf(ties[0]);
    if (!box) return;
    const edge = paper.getBoundingClientRect().right + 2;
    const froms = lines.map((line) => {
      const r = line?.getBoundingClientRect();
      return r ? { x: edge, y: r.top + r.height / 2 } : null;
    });
    const places = rows.map(placeOf);
    ties.forEach((g, i) => tie(g, box, froms[i] ?? null, places[i] ?? null, at.ties[i] ?? 0));
  };

  /** Everything written is put back, so a page the film has left is the stacked page: every part at rest, the roll whole, every row there. */
  const reset = () => {
    for (const el of [flat, seam, seamTie, roll, ...ties]) for (const name of ["--wheel", "--needle", "--p", "--print"]) el?.style.removeProperty(name);
    for (const item of items) item.removeAttribute("data-dim");
    for (const el of [sourcesRow, ...rows, note]) {
      el?.removeAttribute("data-on");
      el?.classList.remove("rec-arrive", "animate-rise");
    }
  };

  return {
    onScene(name, p) {
      if (name === "sources") showSources(p);
      if (name === "receipts") showReceipts(p);
    },
    stop: reset,
  };
}
