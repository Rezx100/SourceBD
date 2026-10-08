// The director (handoff-home-film §5): the scroll is the film's only clock. A scene is a tall section whose stage
// sticks to the screen; one passive scroll listener and one animation frame measure each scene's progress, 0 to 1,
// and say it to the engine, which writes it on the small thing that reads it: never as a property on the scene
// itself, because one inherited by a tall subtree restyles all of it on every frame. No smooth-scroll takeover and
// no scroll library: the page scrolls natively, and only what the scroll drives is eased. A wheel moves the page in
// steps of about a hundred pixels; each scene's progress follows its target with a short exponential lag (`SCRUB`),
// so a step reads as one glide rather than a jump (founder's video, 7 Oct 2026: "the scrolling timing must be fixed").

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

/** The film's easing, one place: an exponential ease-out for anything that arrives, a smoothstep for a move between two holds. */
export const ease = {
  out: (t: number) => 1 - (1 - clamp(t)) ** 3,
  inOut: (t: number) => {
    const x = clamp(t);
    return x * x * (3 - 2 * x);
  },
} as const;

/**
 * How far a scene has been scrolled through its hold. 0 while its top is at or below the top of the screen, 1 once
 * its bottom has reached the bottom of the screen. A scene no taller than the screen has no hold: it is 0, then 1.
 */
export function sceneProgress(top: number, height: number, viewport: number): number {
  const travel = height - viewport;
  if (travel <= 0) return top <= 0 ? 1 : 0;
  return clamp(-top / travel);
}

/** The lag of the scrub, in milliseconds: the time a scene's progress takes to cover 63% of a step. */
export const SCRUB = 110;
/** Below this the progress is the target: the glide has landed and the frames stop. */
export const SETTLED = 0.0005;

/**
 * One frame of the scrub: from `shown` toward `target` after `dt` milliseconds, by the same fraction of the gap
 * whatever the frame rate. A jump bigger than a third of the scene (a link to a chapter, a restored page) lands at
 * once: a glide across a whole scene would replay it.
 */
export function scrub(shown: number, target: number, dt: number): number {
  const gap = target - shown;
  if (Math.abs(gap) < SETTLED || Math.abs(gap) > 0.34) return target;
  return shown + gap * (1 - Math.exp(-Math.max(0, dt) / SCRUB));
}

export type Director = {
  /** Says every scene's last progress again: for a layer that was still loading when the scroll spoke. */
  replay(): void;
  destroy(): void;
};

/**
 * Drives every `[data-scene]` under `root`. `onScene` hears a scene's name and progress when it changes, for the
 * parts CSS cannot move (the planet, the city, the drawings). Under reduced motion the film does not run (tier.ts),
 * so the scrub has no still case of its own.
 */
export function createDirector(root: HTMLElement, onScene?: (name: string, p: number) => void): Director {
  const scenes = [...root.querySelectorAll<HTMLElement>("[data-scene]")];
  const target = new Map<HTMLElement, number>();
  const shown = new Map<HTMLElement, number>();
  const said = new Map<HTMLElement, number>();
  let raf = 0;
  let last = 0;
  let measured = false;
  const say = (el: HTMLElement, p: number) => {
    const q = Math.round(p * 1000) / 1000;
    if (said.get(el) === q) return;
    said.set(el, q);
    onScene?.(el.dataset.scene ?? "", q);
  };
  const frame = (now: number) => {
    raf = 0;
    const dt = last ? now - last : 16;
    last = now;
    if (!measured) {
      measured = true;
      const vh = innerHeight;
      for (const el of scenes) {
        const box = el.getBoundingClientRect();
        target.set(el, sceneProgress(box.top, box.height, vh));
      }
    }
    let moving = false;
    for (const el of scenes) {
      const to = target.get(el) ?? 0;
      // The first frame lands: a page opened halfway down starts where it is.
      const p = shown.has(el) ? scrub(shown.get(el)!, to, dt) : to;
      shown.set(el, p);
      say(el, p);
      if (p !== to) moving = true;
    }
    if (moving) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  const queue = () => {
    measured = false;
    if (!raf) raf = requestAnimationFrame(frame);
  };
  // A new size moves every layout the engine measured: every scene is said again, even where its number held.
  const resized = () => {
    said.clear();
    queue();
  };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", resized);
  queue();
  return {
    replay() {
      for (const [el, p] of said) onScene?.(el.dataset.scene ?? "", p);
    },
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", queue);
      removeEventListener("resize", resized);
    },
  };
}
