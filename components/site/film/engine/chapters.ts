// What the scroll moves in the scenes after the opening (handoff-home-film §3.7 to §3.9, rebuilt after the founder's
// video of 7 Oct 2026): the overlock threading the five sources in and sewing the record's label, the record's rows
// each with the register's record beside it, the watch as the days pass, the staged screens and the three promises.
// The maths is pure (`sourcesAt`, `proofAt`, `watchAt`, `orderAt`) and runs under `node --test`; `startChapters`
// applies it to the DOM on the full tier only, and puts everything it wrote back when the film stops. On the lite and
// still tiers nothing here runs: every thread is in, every row and every record shows, which is the stacked page.

import { all, span } from "./director";
import type { Tier } from "./tier";

/**
 * The overlock: the five threads go in one after another (each with its tag and its line on the label), then the
 * machine runs (the handwheel turns, the needle takes one stitch per step, the seam draws along the cloth).
 */
export const SOURCES = { thread: [0.03, 0.12], gap: 0.075, run: [0.44, 0.92], stitches: 12 } as const;
/** Where thread `i` is drawn, 0 to 1, at `p`. */
const threadAt = (i: number, p: number) => span([SOURCES.thread[0] + SOURCES.gap * i, SOURCES.thread[1] + SOURCES.gap * i], p);
/** The moment thread `i` is all the way in: its line on the label lights. */
export const threadIn = (i: number) => SOURCES.thread[1] + SOURCES.gap * i;

export function sourcesAt(p: number) {
  const run = span(SOURCES.run, p);
  return {
    threads: [0, 1, 2, 3, 4].map((i) => threadAt(i, p)),
    run,
    /** The handwheel's turn, in degrees: four turns over the run. */
    wheel: run * 1440,
    /** The needle bar, 0 up to 1 down: one stitch per step of the run. */
    needle: (1 - Math.cos(run * Math.PI * 2 * SOURCES.stitches)) / 2,
  };
}

/** Where the seam leaves the overlock drawing, in its own units (`flats.tsx` draws the cloth to this point). */
export const SEAM_END = { x: 460, y: 361.5 } as const;

/** How far back past its moment a beat holds on, so a scroll resting on the line does not flap it on and off. */
export const BAND = 0.01;
/** Whether a beat is on at `p`, given whether it was: it comes at its moment `at` and holds until BAND before it. */
export const holds = (was: boolean, p: number, at: number): boolean => (was ? p > at - BAND : p > at);
/** Which of a run of steps is on at `p` (the first from the start), each holding a band past its mark on the way back. */
export function stepAt(marks: readonly number[], p: number, was = 0): number {
  let step = 0;
  marks.forEach((at, i) => {
    if (i && holds(was >= i, p, at)) step = i;
  });
  return step;
}

/** Every claim, beside its source: the four rows of the record take the light in turn, each with the register's record beside it. */
export const PROOF = { steps: [0, 0.27, 0.52, 0.76] } as const;
export const proofAt = (p: number, was = 0) => ({ step: stepAt(PROOF.steps, p, was) });

/**
 * We check again: the scroll is the calendar, from the day the record was saved (day 0, 3 Oct 2026) to the new list
 * copy (day 59, 1 Dec 2026). The certificate's row turns at day 43; the list's at day 59.
 */
export const WATCH = { days: [0, 43, 59], steps: [0, 0.36, 0.7] } as const;
export function watchAt(p: number, was = 0) {
  const step = stepAt(WATCH.steps, p, was);
  return { step, day: WATCH.days[step]! };
}

/**
 * The staged screens: three steps, each a real screen, one on at a time; on the second (the RFQ composer) the drawn
 * cursor arrives and presses Send RFQ before the third slides in.
 */
export const ORDER = { steps: [0, 0.34, 0.68], cursor: [0.4, 0.58] } as const;

/** `was`: the step shown before, so a step holds a band past its mark on the way back like every beat. */
export function orderAt(p: number, was = 0) {
  return { step: stepAt(ORDER.steps, p, was), cursor: span(ORDER.cursor, p) };
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
  const threads = all<SVGGElement>(flat, ".ov-source");
  const lines = all<HTMLElement>(sources, "[data-label] [data-line]");
  const proofRows = all<HTMLElement>(scene("proof"), "[data-proof]");
  const watch = scene("watch");
  const watched = all<HTMLElement>(watch, "[data-watched]");
  const days = all<HTMLElement>(watch, "[data-days] > li");
  const dates = all<HTMLElement>(watch, "[data-watch-date] > span");
  const order = scene("order");
  const orderSteps = all<HTMLElement>(order, "[data-order-steps] > li");
  /** The three screens the steps swap: the sourcing stage's. The compliance stage's one screen is never touched. */
  const screens = all<HTMLElement>(order, "[data-order-screens] [data-screen]");
  const windows = all<HTMLElement>(order, "[data-window]");
  const cursorParts = all<HTMLElement>(order, "[data-cursor]");
  const promises = all<HTMLElement>(scene("promises"), "[data-promise]");
  /** The app beside the promises: one window per promise, the last one reached shows. */
  const promiseViews = all<HTMLElement>(scene("promises"), "[data-promise-view]");

  // A beat is a thing that arrives at its moment and rises; once on it holds a little past its moment on the way back.
  const beat = (el: Element | null | undefined, p: number, at: number) => {
    if (!el) return;
    const was = el.hasAttribute("data-on");
    const on = holds(was, p, at);
    if (on === was) return;
    el.toggleAttribute("data-on", on);
    el.classList.toggle("animate-rise", on);
  };
  /** One of a set on, the others off: written only where it changed. */
  const only = (els: HTMLElement[], step: number) =>
    els.forEach((el, i) => {
      if (el.hasAttribute("data-on") !== (i === step)) el.toggleAttribute("data-on", i === step);
    });

  const showSources = (p: number) => {
    const at = sourcesAt(p);
    threads.forEach((g, i) => g.style.setProperty("--t", (at.threads[i] ?? 1).toFixed(3)));
    lines.forEach((li, i) => li.toggleAttribute("data-on", holds(li.hasAttribute("data-on"), p, threadIn(i))));
    for (const part of needleParts) part.style.setProperty("--needle", at.needle.toFixed(3));
    wheel?.style.setProperty("--wheel", at.wheel.toFixed(1));
    seam?.style.setProperty("--p", at.run.toFixed(3));
  };

  let proofStep = 0;
  const showProof = (p: number) => {
    proofStep = proofAt(p, proofStep).step;
    only(proofRows, proofStep);
  };

  let watchStep = 0;
  const showWatch = (p: number) => {
    const at = watchAt(p, watchStep);
    watchStep = at.step;
    only(days, at.step);
    only(dates, at.step);
    for (const row of watched) {
      const due = Number(row.dataset.at ?? Infinity) <= at.day;
      if (row.hasAttribute("data-due") !== due) row.toggleAttribute("data-due", due);
    }
  };

  let orderStep = 0;
  const showOrder = (p: number) => {
    const at = orderAt(p, orderStep);
    orderStep = at.step;
    only(orderSteps, at.step);
    only(screens, at.step);
    for (const w of windows) w.style.setProperty("--p", p.toFixed(3));
    for (const c of cursorParts) c.style.setProperty("--cursor", at.cursor.toFixed(3));
  };

  // A promise is ink once reached and stays so; its line beside it is a beat that rises at the same moment, and the
  // app beside them shows the last one reached.
  const showPromises = (p: number) => {
    promises.forEach((li, i) => {
      const at = PROMISES.steps[i] ?? 1;
      li.toggleAttribute("data-on", holds(li.hasAttribute("data-on"), p, at));
      beat(li.querySelector("[data-beat]"), p, at);
    });
    only(promiseViews, Math.max(0, promises.filter((li) => li.hasAttribute("data-on")).length - 1));
  };

  return {
    onScene(name, p) {
      if (name === "sources") showSources(p);
      if (name === "proof") showProof(p);
      if (name === "watch") showWatch(p);
      if (name === "order") showOrder(p);
      if (name === "promises") showPromises(p);
    },
    /** Everything written is put back, so a page the film has left is the stacked page: every part at rest, every step there. */
    stop() {
      for (const el of [...needleParts, wheel, seam, ...threads, ...windows, ...cursorParts]) for (const name of ["--wheel", "--needle", "--p", "--t", "--cursor"]) el?.style.removeProperty(name);
      for (const el of [...promises, ...promises.map((li) => li.querySelector("[data-beat]"))]) {
        el?.removeAttribute("data-on");
        el?.classList.remove("animate-rise");
      }
      for (const el of lines) el.removeAttribute("data-on");
      for (const el of watched) el.removeAttribute("data-due");
      only(proofRows, 0);
      only(days, 0);
      only(dates, dates.length - 1);
      only(orderSteps, 0);
      only(screens, 0);
      only(promiseViews, 0);
    },
  };
}
