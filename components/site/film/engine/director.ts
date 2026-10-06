// The director (handoff-home-film §5): the scroll is the film's only clock. A scene is a tall section whose stage
// sticks to the screen; one passive scroll listener and one animation frame write `--p`, 0 to 1, on each scene, and
// CSS does the rest. No smooth-scroll takeover, no scroll library. The rail's current chapter follows the scene
// that holds the middle of the screen, and `--film-p` on the root is the page's own progress (the phone's line).

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/**
 * How far a scene has been scrolled through its hold. 0 while its top is at or below the top of the screen, 1 once
 * its bottom has reached the bottom of the screen. A scene no taller than the screen has no hold: it is 0, then 1.
 */
export function sceneProgress(top: number, height: number, viewport: number): number {
  const travel = height - viewport;
  if (travel <= 0) return top <= 0 ? 1 : 0;
  return clamp(-top / travel);
}

/** Which of `n` equal steps a progress falls in. A step lands whole: the last one holds through p = 1. */
export function stepAt(p: number, n: number): number {
  return Math.min(n - 1, Math.max(0, Math.floor(p * n)));
}

/** The chapter of the last scene (in page order) whose top has passed the middle of the screen; before the first, none. */
export function currentChapter(scenes: readonly { chapter: string; top: number; bottom: number }[], viewport: number): string | null {
  const mid = viewport / 2;
  let found: string | null = null;
  for (const s of scenes) if (s.top <= mid) found = s.chapter;
  return found;
}

export type Director = { destroy(): void };

/**
 * Drives every `[data-scene]` under `root`. `onScene` hears a scene's name and progress when it changes, for the
 * parts CSS cannot move (the planet, the map). A scene names its chapter with `data-chapter` (the id the rail links to).
 */
export function createDirector(root: HTMLElement, onScene?: (name: string, p: number) => void): Director {
  const scenes = [...root.querySelectorAll<HTMLElement>("[data-scene]")];
  const last = new Map<HTMLElement, number>();
  let chapter: string | null = null;
  let raf = 0;
  const measure = () => {
    raf = 0;
    const vh = innerHeight;
    const boxes = scenes.map((el) => ({ el, box: el.getBoundingClientRect() }));
    for (const { el, box } of boxes) {
      const p = Math.round(sceneProgress(box.top, box.height, vh) * 1000) / 1000;
      if (last.get(el) === p) continue;
      last.set(el, p);
      el.style.setProperty("--p", String(p));
      onScene?.(el.dataset.scene ?? "", p);
    }
    const now = currentChapter(boxes.map(({ el, box }) => ({ chapter: el.dataset.chapter ?? "", top: box.top, bottom: box.bottom })), vh);
    if (now !== chapter) {
      chapter = now;
      for (const a of root.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Chapters"] a')) {
        if (a.hash === `#${now}`) a.setAttribute("aria-current", "step");
        else a.removeAttribute("aria-current");
      }
    }
    const page = root.getBoundingClientRect();
    root.style.setProperty("--film-p", String(Math.round(sceneProgress(page.top, page.height, vh) * 1000) / 1000));
  };
  const queue = () => {
    if (!raf) raf = requestAnimationFrame(measure);
  };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  queue();
  return {
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", queue);
      removeEventListener("resize", queue);
    },
  };
}
