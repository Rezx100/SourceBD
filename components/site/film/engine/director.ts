// The director (handoff-home-film §5): the scroll is the film's only clock. A scene is a tall section whose stage
// sticks to the screen; one passive scroll listener and one animation frame measure each scene's progress, 0 to 1,
// and say it to the engine, which writes it on the small thing that reads it (a thread's group, the roll, a flat's
// parts): never as a property on the scene itself, because one inherited by a tall subtree restyles all of it on
// every frame. No smooth-scroll takeover, no scroll library. The rail's current chapter follows the scene that
// holds the middle of the screen, and its phone line gets the page's own progress as `--film-p`.

export const clamp = (v: number) => Math.max(0, Math.min(1, v));
/** A stretch of a scroll, 0 before `a`, 1 after `b`, even between. */
export const span = ([a, b]: readonly [number, number], p: number) => clamp((p - a) / (b - a));
/** The elements under `el` that match, as an array; none when there is no `el`. */
export const all = <T extends Element>(el: ParentNode | null | undefined, selector: string): T[] => [...(el?.querySelectorAll<T>(selector) ?? [])];
/** Sizes a layer's drawing space to its box in pixels, once per size: an unchanged attribute written again still costs a layout. */
export const fit = (svg: SVGSVGElement | null | undefined, w: number, h: number) => {
  const v = `0 0 ${w} ${h}`;
  if (svg && svg.getAttribute("viewBox") !== v) svg.setAttribute("viewBox", v);
};

/**
 * How far a scene has been scrolled through its hold. 0 while its top is at or below the top of the screen, 1 once
 * its bottom has reached the bottom of the screen. A scene no taller than the screen has no hold: it is 0, then 1.
 */
export function sceneProgress(top: number, height: number, viewport: number): number {
  const travel = height - viewport;
  if (travel <= 0) return top <= 0 ? 1 : 0;
  return clamp(-top / travel);
}

/**
 * The chapter of the last scene (in page order) whose top has passed the middle of the screen; before the first,
 * and once the last scene's bottom has passed the middle too (the close, the FAQ, the footer), none.
 */
export function currentChapter(scenes: readonly { chapter: string; top: number; bottom: number }[], viewport: number): string | null {
  const mid = viewport / 2;
  let found: string | null = null;
  for (const s of scenes) if (s.top <= mid) found = s.chapter;
  const last = scenes[scenes.length - 1];
  return last && last.bottom <= mid ? null : found;
}

/** Whether the last scene (in page order) whose top has passed the middle of the screen is a night one. */
export function nightAt(scenes: readonly { night: boolean; top: number }[], viewport: number): boolean {
  let found = false;
  for (const s of scenes) if (s.top <= viewport / 2) found = s.night;
  return found;
}

export type Director = {
  /** Says every scene's last progress again: for a layer that was still loading when the scroll spoke. */
  replay(): void;
  destroy(): void;
};

/**
 * Drives every `[data-scene]` under `root`. `onScene` hears a scene's name and progress when it changes, for the
 * parts CSS cannot move (the planet, the map). A scene names its chapter with `data-chapter` (the id the rail links to).
 */
export function createDirector(root: HTMLElement, onScene?: (name: string, p: number) => void): Director {
  const scenes = [...root.querySelectorAll<HTMLElement>("[data-scene]")];
  const rail = root.querySelector<HTMLElement>('nav[aria-label="Chapters"]');
  const line = rail?.querySelector<HTMLElement>(":scope > span") ?? null;
  const last = new Map<HTMLElement, number>();
  let chapter: string | null = null;
  let night = false;
  let pageP = -1;
  let raf = 0;
  // The phone's line is the one thing that reads the page's own progress; where it is not drawn (a wide screen)
  // the page's box is not measured for it. Asked once, and again on a resize, never per frame.
  let lineShown = false;
  const lookAtLine = () => {
    lineShown = !!line && getComputedStyle(line).display !== "none";
  };
  lookAtLine();
  const measure = () => {
    raf = 0;
    const vh = innerHeight;
    const boxes = scenes.map((el) => ({ el, box: el.getBoundingClientRect() }));
    for (const { el, box } of boxes) {
      const p = Math.round(sceneProgress(box.top, box.height, vh) * 1000) / 1000;
      if (last.get(el) === p) continue;
      last.set(el, p);
      onScene?.(el.dataset.scene ?? "", p);
    }
    const now = currentChapter(boxes.map(({ el, box }) => ({ chapter: el.dataset.chapter ?? "", top: box.top, bottom: box.bottom })), vh);
    if (now !== chapter) {
      chapter = now;
      for (const a of rail?.querySelectorAll<HTMLAnchorElement>("a") ?? []) {
        if (a.hash === `#${now}`) a.setAttribute("aria-current", "step");
        else a.removeAttribute("aria-current");
      }
      // With no chapter under the screen (the close, the FAQ, the footer) the ticks step aside; the phone's line stays.
      rail?.toggleAttribute("data-off", now === null);
    }
    // The rail lies over whichever scene holds the screen: over a night scene it takes the night's own ink, so it
    // reads in either theme (the planet's act is night only until it has given way to the map).
    const dark = nightAt(boxes.map(({ el, box }) => ({ night: el.dataset.ground === "night" && !el.hasAttribute("data-past"), top: box.top })), vh);
    if (rail && dark !== night) {
      night = dark;
      if (dark) rail.setAttribute("data-ground", "night");
      else rail.removeAttribute("data-ground");
    }
    if (line && lineShown) {
      const page = root.getBoundingClientRect();
      const p = Math.round(sceneProgress(page.top, page.height, vh) * 1000) / 1000;
      if (p !== pageP) line.style.setProperty("--film-p", String((pageP = p)));
    }
  };
  const queue = () => {
    if (!raf) raf = requestAnimationFrame(measure);
  };
  // A new size moves every layout the engine measured: every scene is said again, even where its number held.
  const resized = () => {
    last.clear();
    lookAtLine();
    queue();
  };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", resized);
  queue();
  return {
    replay() {
      for (const [el, p] of last) onScene?.(el.dataset.scene ?? "", p);
    },
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", queue);
      removeEventListener("resize", resized);
      rail?.removeAttribute("data-ground");
      rail?.removeAttribute("data-off");
    },
  };
}
