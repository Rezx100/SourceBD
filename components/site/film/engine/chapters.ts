// Scenes 04 and 05 (handoff-home-film §3.7, §3.9, §4): what the scroll moves in the overlock and the receipt roll,
// and the threads that tie each to its row of the record. The maths is pure (`sourcesAt`, `receiptsAt`) and runs
// under `node --test`; `startChapters` applies it to the DOM on the full tier only. On the lite and still tiers
// nothing here runs: every part rests, the roll is whole and every row is there, which is the stacked page.

import { clamp, span } from "./director";
import type { Tier } from "./tier";

/**
 * Scene 04, "02 · Who are they?": the overlock runs (the handwheel turns, the needle takes one stitch per step,
 * the seam draws along the cloth), then the seam leaves the drawing and ties on to the record, whose Sources row
 * stitches on as the thread sets out for it.
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
  const ties = ends.map((end) => clamp((p - (a + (b - a) * end)) / RECEIPTS.tie));
  return {
    print: span(RECEIPTS.print, p),
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

export type Chapters = { onScene(name: string, p: number): void; stop(): void };

export function startChapters(root: HTMLElement, tier: Tier): Chapters {
  if (tier !== "full") return { onScene() {}, stop() {} };
  const scene = (name: string) => root.querySelector<HTMLElement>(`[data-scene="${name}"]`);
  const sources = scene("sources");
  const receipts = scene("receipts");
  const all = <T extends Element>(el: HTMLElement | null, selector: string) => [...(el?.querySelectorAll<T>(selector) ?? [])];
  // A beat is a thing that arrives at its moment: a row of the record stitches on, anything else rises.
  const beat = (el: Element | undefined, on: boolean) => {
    if (!el) return;
    el.toggleAttribute("data-on", on);
    el.classList.toggle(el.hasAttribute("data-row") ? "rec-arrive" : "animate-rise", on);
  };
  // A tie: the thread from a point on the stage to a row's green dot, drawn by `--p` on its group.
  const tie = (g: SVGGElement | undefined, from: Point | null, to: Element | undefined, p: number) => {
    const layer = g?.ownerSVGElement;
    if (!g || !layer || !from || !to) return;
    const box = layer.getBoundingClientRect();
    layer.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    const row = to.getBoundingClientRect();
    const d = curve({ x: from.x - box.left, y: from.y - box.top }, { x: row.left - box.left - 11, y: row.top - box.top + 21 });
    for (const path of g.querySelectorAll("path")) path.setAttribute("d", d);
    g.style.setProperty("--p", p.toFixed(3));
  };

  let lastSources = 0;
  let lastReceipts = 0;

  const showSources = (p: number) => {
    if (!sources) return;
    lastSources = p;
    const at = sourcesAt(p);
    sources.style.setProperty("--wheel", at.wheel.toFixed(1));
    sources.style.setProperty("--needle", at.needle.toFixed(3));
    sources.querySelector<SVGGElement>("[data-seam]")?.style.setProperty("--p", at.run.toFixed(3));
    const m = sources.querySelector<SVGSVGElement>("svg[data-overlock]")?.getScreenCTM();
    const end = m ? new DOMPoint(SEAM_END.x, SEAM_END.y).matrixTransform(m) : null;
    const [row] = all<HTMLElement>(sources, "[data-row][data-beat]");
    beat(row, at.row);
    tie(all<SVGGElement>(sources, "[data-tie]")[0], end, row, at.tie);
  };

  const showReceipts = (p: number) => {
    if (!receipts) return;
    lastReceipts = p;
    const paper = receipts.querySelector<HTMLElement>("[data-paper]");
    const items = all<HTMLElement>(paper, "[data-receipt]");
    if (!paper || !items.length) return;
    const at = receiptsAt(p, items.map((el) => (el.offsetTop + el.offsetHeight) / paper.offsetHeight));
    receipts.querySelector<HTMLElement>("[data-roll]")?.style.setProperty("--print", at.print.toFixed(3));
    const ties = all<SVGGElement>(receipts, "[data-tie]");
    const rows = all<HTMLElement>(receipts, "[data-row][data-beat]");
    const edge = paper.getBoundingClientRect().right + 2;
    items.forEach((item, i) => {
      item.toggleAttribute("data-dim", at.dim[i] ?? false);
      // The row first, so the thread has its place to tie to.
      beat(rows[i], at.rows[i] ?? false);
      const line = item.querySelector("[data-tie-from]")?.getBoundingClientRect();
      tie(ties[i], line ? { x: edge, y: line.top + line.height / 2 } : null, rows[i], at.ties[i] ?? 0);
    });
    beat(all<HTMLElement>(receipts, "[data-beat]:not([data-row])")[0], at.note);
  };

  const resize = () => {
    showSources(lastSources);
    showReceipts(lastReceipts);
  };
  addEventListener("resize", resize);
  return {
    onScene(name, p) {
      if (name === "sources") showSources(p);
      if (name === "receipts") showReceipts(p);
    },
    stop() {
      removeEventListener("resize", resize);
    },
  };
}
