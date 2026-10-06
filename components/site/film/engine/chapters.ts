// Scenes 04 to 12 (handoff-home-film §3.6 to §3.9, §4): what the scroll moves in the overlock, the receipt roll,
// the map's close on the factory's area, the carton, the calendar, the staged screens, the three promises, the
// source ladder, the live figures and the whole record, and the threads that tie each to its row of the record.
// The maths is pure (`sourcesAt`, `receiptsAt`, `siteAt`, `exportsAt`, `timeAt`, `orderAt`, `closeAt`, `curve`) and
// runs under `node --test`; `startChapters` applies it to the DOM on the full tier only, and puts everything it
// wrote back when the film stops. The map and the planet belong to engine/start.ts, which lends scene 06 a hook
// that moves the camera and says where the one light is, and tells scene 12 where the planet's light is on every
// frame. On the lite and still tiers nothing here runs: every part rests, the roll is whole and every row is
// there, which is the stacked page.

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

/**
 * Scene 06, "04 · Where are they?": the map tilts down from the close on Gazipur on to the factory's own area; the
 * ring opens around it (the registers give an area, not a building); the thread ties the ring to the record's Site
 * row, and the note on what the ring means comes last.
 */
export const SITE = { camera: [0.04, 0.5], ring: [0.4, 0.56], tie: [0.56, 0.7], note: 0.78 } as const;

export function siteAt(p: number) {
  const tie = span(SITE.tie, p);
  return { camera: span(SITE.camera, p), ring: span(SITE.ring, p), tie, row: tie > 0, note: p >= SITE.note };
}

/** Scene 07, "05 · Who do they ship to?": the blank carton slides in, then its thread ties it to the record's Export records row. */
export const EXPORTS = { slide: [0.08, 0.4], tie: [0.44, 0.58] } as const;

export function exportsAt(p: number) {
  const tie = span(EXPORTS.tie, p);
  return { slide: span(EXPORTS.slide, p), tie, row: tie > 0 };
}

/** Where the thread leaves the carton drawing, in its own units (`flats.tsx` draws the side to this edge). */
export const CARTON_END = { x: 324, y: 112 } as const;

/**
 * Scene 08, "06 · Will it still be true next month?": the scroll is the calendar, from the day the record was saved
 * (3 Oct 2026) to the day the certificate runs out (15 Dec, day 73). On day 43 it has 30 days left: the alert comes
 * and its row turns amber. On day 59 a new copy of the list is checked: the UFLPA row arrives. The days run over most
 * of the scroll with a rest at each end, and the figure shown is the last day reached, whole.
 */
export const TIME = { run: [0.06, 0.9], days: 73, marks: [0, 43, 59] } as const;

export function timeAt(p: number) {
  const t = span(TIME.run, p);
  const day = Math.round(t * TIME.days);
  /** The point of the scroll at which a day comes. */
  const at = (d: number) => TIME.run[0] + (TIME.run[1] - TIME.run[0]) * (d / TIME.days);
  const marks = TIME.marks.map(at);
  // The same rule the DOM uses for its beats (`holds`, from off): a mark is passed once the scroll is past it.
  return { t, day, marks, alert: holds(false, p, marks[1]!), list: holds(false, p, marks[2]!) };
}

/**
 * Scene 09, "07 · Can they make my order?": three steps, each a real screen, one on at a time; on the second (the
 * RFQ composer) the drawn cursor arrives and presses Send RFQ before the third slides in.
 */
export const ORDER = { steps: [0, 0.34, 0.68], cursor: [0.4, 0.58] } as const;

/** `was`: the step shown before, so a step holds a band past its mark on the way back like every beat. */
export function orderAt(p: number, was = 0) {
  let step = 0;
  ORDER.steps.forEach((at, i) => {
    if (i && holds(was >= i, p, at)) step = i;
  });
  return { step, cursor: span(ORDER.cursor, p) };
}

/** Scene 10, "08 · Why should I trust you?": the three promises turn from grey to ink one per step, each with its line beside it. */
export const PROMISES = { steps: [0.14, 0.44, 0.74] } as const;
/** The source ladder, between 10 and 11: its five rungs arrive in rank order over this stretch. */
export const LADDER = { rows: [0.1, 0.7] } as const;
/** Scene 11: the live figures rise whole, one after another, over this stretch. */
export const FIGURES = { rows: [0.12, 0.72] } as const;
/** Scene 12, "09 · The whole record": every row of the record stitches on in order, then the thread comes down from the planet and ends at the RFQ row. */
export const CLOSE = { rows: [0.06, 0.58], tie: [0.62, 0.84] } as const;

/** The `i`th of `n` moments spread evenly over a stretch: the first at its start, the last at its end. */
export const evenly = ([a, b]: readonly [number, number], n: number, i: number): number => a + (b - a) * (n > 1 ? i / (n - 1) : 0);

export function closeAt(p: number, rows: number) {
  return { rows: Array.from({ length: rows }, (_, i) => evenly(CLOSE.rows, rows, i)), tie: span(CLOSE.tie, p) };
}

export type Point = { x: number; y: number };
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

export type Chapters = {
  onScene(name: string, p: number): void;
  /** Scene 12: where the planet's light is now, in the close's own pixels (the planet drifts, so its keeper says so on every frame it draws). */
  closeFrom(at: Point): void;
  stop(): void;
};
/** What the map's keeper lends scene 06: at `p` it moves the camera and opens the ring, and says where the one light is in the map's own pixels (none until the map is up). */
export type ChapterHooks = { site?: (p: number) => Point | null };

export function startChapters(root: HTMLElement, tier: Tier, hooks: ChapterHooks = {}): Chapters {
  if (tier !== "full") return { onScene() {}, closeFrom() {}, stop() {} };
  const scene = (name: string) => root.querySelector<HTMLElement>(`[data-scene="${name}"]`);
  // Everything is found once: the handlers run on every frame the scroll moves a scene. A number is written on
  // the part that reads it, never on a scene or a drawing, because an inherited property restyles the subtree.
  const sources = scene("sources");
  const flat = sources?.querySelector<SVGSVGElement>("svg[data-overlock]") ?? null;
  const needleParts = all<SVGElement>(flat, ".ov-needle, .ov-lever");
  const wheel = flat?.querySelector<SVGElement>(".ov-wheel") ?? null;
  const seam = sources?.querySelector<SVGGElement>("[data-seam]") ?? null;
  const seamTie = all<SVGGElement>(sources, "[data-tie]")[0];
  const sourcesRow = all<HTMLElement>(sources, "[data-row][data-beat]")[0];
  const receipts = scene("receipts");
  const paper = receipts?.querySelector<HTMLElement>("[data-paper]") ?? null;
  const roll = receipts?.querySelector<HTMLElement>("[data-roll]") ?? null;
  const rollPaper = receipts?.querySelector<HTMLElement>("[data-roll-paper]") ?? null;
  const rollParts = all<HTMLElement>(receipts, ".roll-sheet, .roll-print, .roll-tear");
  const items = all<HTMLElement>(paper, "[data-receipt]");
  const lines = items.map((item) => item.querySelector("[data-tie-from]"));
  const ties = all<SVGGElement>(receipts, "[data-tie]");
  const rows = all<HTMLElement>(receipts, "[data-row][data-beat]");
  const note = all<HTMLElement>(receipts, "[data-beat]:not([data-row])")[0];
  const site = scene("site");
  const siteTie = all<SVGGElement>(site, "[data-tie]")[0];
  const siteRow = all<HTMLElement>(site, "[data-row][data-beat]")[0];
  const siteNote = all<HTMLElement>(site, "[data-beat]:not([data-row])")[0];
  const siteLabel = site?.querySelector<HTMLElement>("[data-site-label]") ?? null;
  const exportsScene = scene("exports");
  const carton = exportsScene?.querySelector<SVGSVGElement>("svg[data-carton]") ?? null;
  const cartonTie = all<SVGGElement>(exportsScene, "[data-tie]")[0];
  const exportsRow = all<HTMLElement>(exportsScene, "[data-row][data-beat]")[0];
  const time = scene("time");
  const line = time?.querySelector<SVGSVGElement>("svg[data-timeline]") ?? null;
  const days = all<HTMLElement>(time, "[data-days] > li");
  const watch = all<HTMLElement>(time, "[data-row][data-watch]")[0];
  const listRow = all<HTMLElement>(time, "[data-row][data-beat]")[0];
  /** The alert, then the line on the list check. */
  const timeBeats = all<HTMLElement>(time, "[data-beat]:not([data-row])");
  const order = scene("order");
  const orderSteps = all<HTMLElement>(order, "[data-order-steps] > li");
  /** The three screens the steps swap: the sourcing stage's. The compliance stage's one screen is never touched. */
  const screens = all<HTMLElement>(order, "[data-order-screens] [data-screen]");
  const windows = all<HTMLElement>(order, "[data-window]");
  const cursorParts = all<HTMLElement>(order, "[data-cursor]");
  const promises = all<HTMLElement>(scene("promises"), "[data-promise]");
  const rungs = all<HTMLElement>(scene("ladder"), "[data-beat]");
  const figures = all<HTMLElement>(scene("figures"), "[data-beat]");
  const close = scene("close");
  const closeRows = all<HTMLElement>(close, "[data-row][data-beat]");
  const closeTie = all<SVGGElement>(close, "[data-tie]")[0];
  const bartack = closeTie?.querySelector<SVGPathElement>(".thread-end") ?? null;

  // The threads' geometry moves only with the layout: a new size, the fonts arriving, a row arriving. It is
  // measured then, not on every frame, so a steady scroll forces no layout at all.
  let staleSources = true;
  let staleReceipts = true;
  let staleExports = true;
  let staleSite = true;
  let staleClose = true;
  let stalePlaces = true;
  const invalidate = () => {
    staleSources = staleReceipts = staleExports = staleSite = staleClose = stalePlaces = true;
  };
  addEventListener("resize", invalidate);
  void document.fonts?.ready.then(invalidate);

  // A beat is a thing that arrives at its moment: a row of the record stitches on, anything else rises. Once on it
  // holds a little past its moment on the way back (BAND), so a scroll resting on the line does not flap it.
  const beat = (el: Element | undefined, p: number, at: number) => {
    if (!el) return;
    const was = el.hasAttribute("data-on");
    const on = holds(was, p, at);
    if (on === was) return;
    el.toggleAttribute("data-on", on);
    el.classList.toggle(el.hasAttribute("data-row") ? "rec-arrive" : "animate-rise", on);
    stalePlaces = true;
  };
  // Every point is kept in the layer's own pixels, measured in one frame together with the layer's box: the stage
  // moves with the page until it is pinned, so a point measured against the screen in one frame is worthless in the next.
  /** The layer a tie group draws on, sized to its own box; the box is returned for the frame's points. */
  const layerOf = (g: SVGGElement | undefined) => {
    const layer = g?.ownerSVGElement;
    if (!layer) return null;
    const box = layer.getBoundingClientRect();
    fit(layer, box.width, box.height);
    return box;
  };
  const within = (box: DOMRect, x: number, y: number): Point => ({ x: x - box.left, y: y - box.top });
  /** A row's green dot once the row is on (`.rec-arrive::after` in app/ds.css: 6px, 14px left of the row's padding edge and 18px down, so 11 and 22 from its border box); while it waits it has no place of its own. */
  const dotOf = (box: DOMRect, row: HTMLElement | undefined): Point | null => {
    if (!row?.hasAttribute("data-on")) return null;
    const r = row.getBoundingClientRect();
    return within(box, r.left - 11, r.top + 22);
  };
  // A tie: the thread from a point on the stage to a row's dot, drawn by `--p` on its group. How far it is drawn is
  // written first: a scroll that jumps back past the row's moment finds the row gone and the draw at 0 in the same
  // frame, rather than a thread left whole to where the row was. A path that has not moved is not written again:
  // an attribute written again still costs a layout.
  const tie = (g: SVGGElement | undefined, from: Point | null, to: Point | null, p: number) => {
    if (!g) return;
    g.style.setProperty("--p", p.toFixed(3));
    if (!from || !to) return;
    const d = curve(from, to);
    for (const path of g.querySelectorAll("path")) if (path.getAttribute("d") !== d) path.setAttribute("d", d);
  };

  let seamGeo: { end: Point | null; dot: Point | null } | null = null;
  const showSources = (p: number) => {
    if (!sources) return;
    const at = sourcesAt(p);
    if (staleSources) {
      staleSources = false;
      const box = layerOf(seamTie);
      const m = flat?.getScreenCTM();
      const end = m ? new DOMPoint(SEAM_END.x, SEAM_END.y).matrixTransform(m) : null;
      seamGeo = box ? { end: end ? within(box, end.x, end.y) : null, dot: null } : null;
      stalePlaces = true;
    }
    for (const part of needleParts) part.style.setProperty("--needle", at.needle.toFixed(3));
    wheel?.style.setProperty("--wheel", at.wheel.toFixed(1));
    seam?.style.setProperty("--p", at.run.toFixed(3));
    beat(sourcesRow, p, SOURCES.tie[0]);
    if (!seamGeo) return;
    if (stalePlaces) {
      const box = layerOf(seamTie);
      seamGeo.dot = box ? dotOf(box, sourcesRow) : null;
    }
    tie(seamTie, seamGeo.end, seamGeo.dot, at.tie);
  };

  // On a stage too short for the whole roll (under about 850 px), the roll is a window and the paper scrolls up by
  // `over` as it prints (app/ds.css reads --roll-over on the paper's wrapper); the receipts' lines move with it, so
  // each thread's start is shifted by the print of the frame, never measured again.
  let rollGeo: { ends: number[]; froms: (Point | null)[]; dots: (Point | null)[]; over: number; top: number } | null = null;
  const showReceipts = (p: number) => {
    if (!receipts || !paper || !items.length) return;
    if (staleReceipts) {
      staleReceipts = false;
      // Measured with the paper at rest at the top of its window.
      rollPaper?.style.setProperty("--roll-over", "0px");
      const box = layerOf(ties[0]);
      const height = paper.offsetHeight;
      const edge = paper.getBoundingClientRect().right + 2;
      const over = roll && rollPaper ? Math.max(0, rollPaper.offsetTop + rollPaper.offsetHeight - roll.clientHeight) : 0;
      rollPaper?.style.setProperty("--roll-over", `${Math.round(over)}px`);
      const top = box && roll ? roll.getBoundingClientRect().top - box.top : 0;
      rollGeo = box
        ? {
            ends: items.map((item) => (item.offsetTop + item.offsetHeight) / height),
            froms: lines.map((line) => {
              const r = line?.getBoundingClientRect();
              return r ? within(box, edge, r.top + r.height / 2) : null;
            }),
            dots: [],
            over,
            top,
          }
        : null;
      stalePlaces = true;
    }
    if (!rollGeo) return;
    const at = receiptsAt(p, rollGeo.ends);
    for (const part of rollParts) part.style.setProperty("--print", at.print.toFixed(3));
    items.forEach((item, i) => item.toggleAttribute("data-dim", at.dim[i] ?? false));
    rows.forEach((row, i) => beat(row, p, at.arrives[i] ?? 1));
    beat(note, p, RECEIPTS.note);
    // The rows that have arrived have their place now; it is measured once per arrival, not per frame.
    if (stalePlaces) {
      const box = layerOf(ties[0]);
      rollGeo.dots = box ? rows.map((row) => dotOf(box, row)) : [];
    }
    // A receipt whose line has scrolled out of the window's top takes its thread with it; the row keeps its dot.
    const shift = at.print * rollGeo.over;
    ties.forEach((g, i) => {
      const from = rollGeo!.froms[i];
      const y = from ? from.y - shift : 0;
      tie(g, from ? { x: from.x, y } : null, rollGeo!.dots[i] ?? null, from && y < rollGeo!.top + 8 ? 0 : (at.ties[i] ?? 0));
    });
  };

  // The light moves with the camera on every frame, but the map says where it is without a layout; only the
  // row's dot is measured, when it arrives or the layout moves (its own flag: an earlier scene in the same frame
  // may have cleared the shared one).
  let siteDot: Point | null = null;
  const showSite = (p: number) => {
    if (!site) return;
    const at = siteAt(p);
    const from = hooks.site?.(p) ?? null;
    beat(siteRow, p, SITE.tie[0]);
    beat(siteNote, p, SITE.note);
    // The place's label sits up and left of the light and shows as the ring opens.
    if (siteLabel && from) {
      siteLabel.style.transform = `translate(${px(from.x - 150)}px, ${px(from.y - 120)}px)`;
      siteLabel.style.opacity = at.ring.toFixed(2);
    }
    if (stalePlaces || staleSite) {
      staleSite = false;
      const box = layerOf(siteTie);
      siteDot = box ? dotOf(box, siteRow) : null;
    }
    tie(siteTie, from, siteDot, at.tie);
  };

  // The carton's edge is measured once it has slid in (the thread sets out only then); a measure mid-slide would be stale at once.
  let cartonGeo: { end: Point | null; dot: Point | null } | null = null;
  const showExports = (p: number) => {
    if (!exportsScene) return;
    const at = exportsAt(p);
    carton?.style.setProperty("--slide", at.slide.toFixed(3));
    beat(exportsRow, p, EXPORTS.tie[0]);
    if (staleExports && at.slide >= 1) {
      staleExports = false;
      const box = layerOf(cartonTie);
      const m = carton?.getScreenCTM();
      const end = m ? new DOMPoint(CARTON_END.x, CARTON_END.y).matrixTransform(m) : null;
      cartonGeo = box ? { end: end ? within(box, end.x, end.y) : null, dot: null } : null;
      stalePlaces = true;
    }
    if (!cartonGeo) return;
    if (stalePlaces) {
      const box = layerOf(cartonTie);
      cartonGeo.dot = box ? dotOf(box, exportsRow) : null;
    }
    tie(cartonTie, cartonGeo.end, cartonGeo.dot, at.tie);
  };

  const showTime = (p: number) => {
    if (!time) return;
    const at = timeAt(p);
    line?.style.setProperty("--t", at.t.toFixed(3));
    // Each day's beat holds on the way back like every other, so the figure, the amber row and the alert agree.
    const due = holds(watch?.hasAttribute("data-due") ?? false, p, at.marks[1]!);
    watch?.toggleAttribute("data-due", due);
    beat(timeBeats[0], p, at.marks[1]!);
    beat(listRow, p, at.marks[2]!);
    beat(timeBeats[1], p, at.marks[2]!);
    const step = listRow?.hasAttribute("data-on") ? 2 : due ? 1 : 0;
    days.forEach((li, i) => li.toggleAttribute("data-on", i === step));
  };

  // The step holds on the way back like every beat, so the screens do not flap at a step's line; the tilt and the
  // cursor are written on the parts that read them (each window; the cursor, its press and the spotlight).
  let orderStep = 0;
  const showOrder = (p: number) => {
    if (!order) return;
    const at = orderAt(p, orderStep);
    orderStep = at.step;
    orderSteps.forEach((li, i) => li.toggleAttribute("data-on", i === at.step));
    screens.forEach((el, i) => el.toggleAttribute("data-on", i === at.step));
    for (const w of windows) w.style.setProperty("--p", p.toFixed(3));
    for (const c of cursorParts) c.style.setProperty("--cursor", at.cursor.toFixed(3));
  };

  // A promise is ink once reached and stays so; its line beside it is a beat that rises at the same moment.
  const showPromises = (p: number) => {
    promises.forEach((li, i) => {
      const at = PROMISES.steps[i] ?? 1;
      li.toggleAttribute("data-on", holds(li.hasAttribute("data-on"), p, at));
      beat(li.querySelector("[data-beat]") ?? undefined, p, at);
    });
  };
  const showLadder = (p: number) => rungs.forEach((li, i) => beat(li, p, evenly(LADDER.rows, rungs.length, i)));
  const showFigures = (p: number) => figures.forEach((el, i) => beat(el, p, evenly(FIGURES.rows, figures.length, i)));

  // The thread of the close sets out from the planet's light, which drifts: its keeper says where it is on every
  // frame it draws (`closeFrom`); only the RFQ row's dot is measured, when it arrives or the layout moves.
  let closeFrom: Point | null = null;
  let closeDot: Point | null = null;
  let closeTieP = 0;
  const drawClose = () => {
    tie(closeTie, closeFrom, closeDot, closeTieP);
    if (!bartack || !closeDot) return;
    const t = `translate(${px(closeDot.x - 6)} ${px(closeDot.y)})`;
    if (bartack.getAttribute("transform") !== t) bartack.setAttribute("transform", t);
  };
  const showClose = (p: number) => {
    if (!close) return;
    const at = closeAt(p, closeRows.length);
    closeTieP = at.tie;
    closeRows.forEach((row, i) => beat(row, p, at.rows[i] ?? 1));
    if (stalePlaces || staleClose) {
      staleClose = false;
      const box = layerOf(closeTie);
      closeDot = box ? dotOf(box, closeRows.at(-1)) : null;
    }
    drawClose();
  };

  const onScene = (name: string, p: number) => {
    if (name === "sources") showSources(p);
    if (name === "receipts") showReceipts(p);
    if (name === "site") showSite(p);
    if (name === "exports") showExports(p);
    if (name === "time") showTime(p);
    if (name === "order") showOrder(p);
    if (name === "promises") showPromises(p);
    if (name === "ladder") showLadder(p);
    if (name === "figures") showFigures(p);
    if (name === "close") showClose(p);
    // A scene's places are measured in the same frame a beat moved them; the flag outlives the frame otherwise.
    if (name !== "opening" && name !== "planet") stalePlaces = false;
  };

  /** Everything written is put back, so a page the film has left is the stacked page: every part at rest, the roll whole, every row there. */
  const reset = () => {
    removeEventListener("resize", invalidate);
    for (const el of [...needleParts, wheel, seam, seamTie, ...rollParts, rollPaper, ...ties, siteTie, carton, cartonTie, line, ...windows, ...cursorParts, closeTie]) for (const name of ["--wheel", "--needle", "--p", "--print", "--slide", "--t", "--cursor", "--roll-over"]) el?.style.removeProperty(name);
    for (const item of items) item.removeAttribute("data-dim");
    if (siteLabel) Object.assign(siteLabel.style, { transform: "", opacity: "" });
    for (const el of [sourcesRow, ...rows, note, siteRow, siteNote, exportsRow, listRow, ...timeBeats, ...promises, ...promises.map((li) => li.querySelector("[data-beat]")), ...rungs, ...figures, ...closeRows]) {
      el?.removeAttribute("data-on");
      el?.classList.remove("rec-arrive", "animate-rise");
    }
    watch?.removeAttribute("data-due");
    days.forEach((li, i) => li.toggleAttribute("data-on", i === 0));
    orderSteps.forEach((li, i) => li.toggleAttribute("data-on", i === 0));
    screens.forEach((el, i) => el.toggleAttribute("data-on", i === 0));
    bartack?.removeAttribute("transform");
  };

  return {
    onScene,
    closeFrom(at) {
      closeFrom = at;
      drawClose();
    },
    stop: reset,
  };
}
