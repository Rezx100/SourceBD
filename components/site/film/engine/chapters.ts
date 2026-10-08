// What the scroll moves in the scenes after the opening (handoff-home-film §3.7 to §3.9): the overlock, the staged
// screens and the three promises. The maths is pure (`sourcesAt`, `orderAt`) and runs under `node --test`;
// `startChapters` applies it to the DOM on the full tier only, and puts everything it wrote back when the film stops.
// On the lite and still tiers nothing here runs: every part rests and every step is there, which is the stacked page.
// The threads, the record's rows, the receipt roll, the second map and the carton went with the founder's video of
// 7 Oct 2026.

import { all, span } from "./director";
import type { Tier } from "./tier";

/** The overlock runs over most of the scene: the handwheel turns, the needle takes one stitch per step, the seam draws along the cloth. */
export const SOURCES = { run: [0.08, 0.86], stitches: 12 } as const;

export function sourcesAt(p: number) {
  const run = span(SOURCES.run, p);
  return {
    run,
    /** The handwheel's turn, in degrees: four turns over the run. */
    wheel: run * 1440,
    /** The needle bar, 0 up to 1 down: one stitch per step of the run. */
    needle: (1 - Math.cos(run * Math.PI * 2 * SOURCES.stitches)) / 2,
  };
}

/** Where the seam leaves the overlock drawing, in its own units (`flats.tsx` draws the cloth to this point). */
export const SEAM_END = { x: 460, y: 361.5 } as const;

/**
 * The staged screens: three steps, each a real screen, one on at a time; on the second (the RFQ composer) the drawn
 * cursor arrives and presses Send RFQ before the third slides in.
 */
export const ORDER = { steps: [0, 0.34, 0.68], cursor: [0.4, 0.58] } as const;

/** How far back past its moment a beat holds on, so a scroll resting on the line does not flap it on and off. */
export const BAND = 0.01;
/** Whether a beat is on at `p`, given whether it was: it comes at its moment `at` and holds until BAND before it. */
export const holds = (was: boolean, p: number, at: number): boolean => (was ? p > at - BAND : p > at);

/** `was`: the step shown before, so a step holds a band past its mark on the way back like every beat. */
export function orderAt(p: number, was = 0) {
  let step = 0;
  ORDER.steps.forEach((at, i) => {
    if (i && holds(was >= i, p, at)) step = i;
  });
  return { step, cursor: span(ORDER.cursor, p) };
}

/** The three promises turn from grey to ink one per step, each with its line beside it. */
export const PROMISES = { steps: [0.12, 0.42, 0.72] } as const;

export type Chapters = {
  onScene(name: string, p: number): void;
  stop(): void;
};

export function startChapters(root: HTMLElement, tier: Tier): Chapters {
  if (tier !== "full") return { onScene() {}, stop() {} };
  const scene = (name: string) => root.querySelector<HTMLElement>(`[data-scene="${name}"]`);
  // Everything is found once: the handlers run on every frame the scroll moves a scene. A number is written on
  // the part that reads it, never on a scene or a drawing, because an inherited property restyles the subtree.
  const sources = scene("sources");
  const flat = sources?.querySelector<SVGSVGElement>("svg[data-overlock]") ?? null;
  const needleParts = all<SVGElement>(flat, ".ov-needle, .ov-lever");
  const wheel = flat?.querySelector<SVGElement>(".ov-wheel") ?? null;
  const seam = flat?.querySelector<SVGElement>("[data-seam]") ?? null;
  const order = scene("order");
  const orderSteps = all<HTMLElement>(order, "[data-order-steps] > li");
  /** The three screens the steps swap: the sourcing stage's. The compliance stage's one screen is never touched. */
  const screens = all<HTMLElement>(order, "[data-order-screens] [data-screen]");
  const windows = all<HTMLElement>(order, "[data-window]");
  const cursorParts = all<HTMLElement>(order, "[data-cursor]");
  const promises = all<HTMLElement>(scene("promises"), "[data-promise]");

  // A beat is a thing that arrives at its moment and rises; once on it holds a little past its moment on the way back.
  const beat = (el: Element | null | undefined, p: number, at: number) => {
    if (!el) return;
    const was = el.hasAttribute("data-on");
    const on = holds(was, p, at);
    if (on === was) return;
    el.toggleAttribute("data-on", on);
    el.classList.toggle("animate-rise", on);
  };

  const showSources = (p: number) => {
    const at = sourcesAt(p);
    for (const part of needleParts) part.style.setProperty("--needle", at.needle.toFixed(3));
    wheel?.style.setProperty("--wheel", at.wheel.toFixed(1));
    seam?.style.setProperty("--p", at.run.toFixed(3));
  };

  let orderStep = 0;
  const showOrder = (p: number) => {
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
      beat(li.querySelector("[data-beat]"), p, at);
    });
  };

  return {
    onScene(name, p) {
      if (name === "sources") showSources(p);
      if (name === "order") showOrder(p);
      if (name === "promises") showPromises(p);
    },
    /** Everything written is put back, so a page the film has left is the stacked page: every part at rest, every step there. */
    stop() {
      for (const el of [...needleParts, wheel, seam, ...windows, ...cursorParts]) for (const name of ["--wheel", "--needle", "--p", "--cursor"]) el?.style.removeProperty(name);
      for (const el of [...promises, ...promises.map((li) => li.querySelector("[data-beat]"))]) {
        el?.removeAttribute("data-on");
        el?.classList.remove("animate-rise");
      }
      orderSteps.forEach((li, i) => li.toggleAttribute("data-on", i === 0));
      screens.forEach((el, i) => el.toggleAttribute("data-on", i === 0));
    },
  };
}
