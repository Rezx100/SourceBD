"use client";

// The marketing site's motion foundation (handoff-mercury-motion-sitewide.md §4, M0). Four pieces, no package:
// `useInView` (one IntersectionObserver), `useScene` (a list of timed steps that plays while it is half in view and
// stops off screen, in a hidden tab, or on the pause button), `DemoStage` (the frame a scripted product demo plays
// in: a visible pause button, a drawn cursor, and a sentence for screen readers) and `PageMain` (the page's `<main>`,
// whose dark sections stand on the night ground).
//
// The server renders every scene's LAST step, so the page reads complete with no script and paints fast. A demo on
// screen when it mounts holds that step, then loops; one out of sight is set to its first step before it is seen,
// so no visitor sees a finished demo empty itself (critique 22 Oct, S5).
// Reduced motion and Save-Data keep the last step and offer play instead; app/ds.css stills every CSS transition
// under reduced motion.

import { Pause, Play } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { motion } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

/** Reduced motion asked for, or Save-Data on: nothing plays by itself. */
export function stillPreferred(): boolean {
  if (typeof window === "undefined") return true;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  return saveData || matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Whether `ref` is at least `threshold` in view, or fills that share of the viewport (an element taller than the
 * screen can never be half visible). False on the server and until the observer reports.
 */
export function useInView(ref: RefObject<Element | null>, threshold = 0.5): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => setInView(!!e && e.isIntersecting && (e.intersectionRatio >= threshold || e.intersectionRect.height >= innerHeight * threshold)),
      { threshold: [0, 0.1, 0.25, threshold, 0.75, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return inView;
}

/** One moment of a scene: from `at` ms after the start, the demo draws `state`. Steps are in time order, the first at 0. */
export type Step<S> = { at: number; state: S };

/** The index of the step showing `ms` into a scene: the last one whose time has come. */
export function stepAt<S>(steps: readonly Step<S>[], ms: number): number {
  let i = 0;
  while (i + 1 < steps.length && steps[i + 1]!.at <= ms) i++;
  return i;
}

/** How long the last step holds before a looping scene starts again. */
export const HOLD_MS = 2400;

/** Whether a box is in the window: any part of it between the top and the bottom edge. */
export const onScreen = (box: { top: number; bottom: number }, height: number): boolean => box.top < height && box.bottom > 0;

/**
 * Plays `steps` while `ref` is half in view, the tab is visible and the visitor has not paused it; loops after the
 * last step holds for `HOLD_MS`. The server draws the last step. A scene on screen when it mounts starts its clock
 * there, so the finished demo holds before it loops; one out of sight moves to its first step before the browser
 * paints and plays from there when it comes into view. Under reduced motion it stays on the last step, paused, until
 * the visitor presses play.
 */
export function useScene<S>(steps: readonly Step<S>[], ref: RefObject<Element | null>): { state: S; index: number; paused: boolean; looping: boolean; toggle: () => void } {
  const last = steps.length - 1;
  const [index, setIndex] = useState(last);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const inView = useInView(ref, 0.5);
  const latest = useRef(steps);
  latest.current = steps;
  // Where the clock stood when it last stopped; null until the scene first runs (it then starts from its first step).
  const elapsed = useRef<number | null>(null);

  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect();
    if (stillPreferred()) setPaused(true);
    else if (box && onScreen(box, innerHeight)) elapsed.current = latest.current[latest.current.length - 1]!.at;
    else setIndex(0);
  }, [ref]);

  useEffect(() => {
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    const onStill = (e: MediaQueryListEvent) => e.matches && setPaused(true);
    const onVis = () => setHidden(document.hidden);
    onVis(); // a page opened in a background tab starts hidden
    still.addEventListener("change", onStill);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      still.removeEventListener("change", onStill);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // True for a moment after the scene starts again, while the last step fades away over the first.
  const [looping, setLooping] = useState(false);
  const running = inView && !hidden && !paused;
  useEffect(() => {
    if (!running) return;
    let t0 = performance.now() - (elapsed.current ?? 0);
    let timer = 0;
    let fade = 0;
    const tick = () => {
      const s = latest.current;
      const total = s[s.length - 1]!.at + HOLD_MS;
      let ms = performance.now() - t0;
      if (ms >= total) {
        t0 += total * Math.floor(ms / total);
        ms = performance.now() - t0;
        // A scene of one step has nothing to fade between.
        if (s.length > 1) {
          setLooping(true);
          window.clearTimeout(fade);
          fade = window.setTimeout(() => setLooping(false), motion.swapOutMs);
        }
      }
      elapsed.current = ms;
      const i = stepAt(s, ms);
      setIndex(i);
      timer = window.setTimeout(tick, Math.max(16, (s[i + 1]?.at ?? total) - ms));
    };
    tick();
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(fade);
      setLooping(false);
      elapsed.current = performance.now() - t0;
    };
  }, [running]);

  return { state: steps[Math.min(index, last)]!.state, index, paused, looping, toggle: () => setPaused((p) => !p) };
}

/** What a demo step may say about the drawn cursor: the `data-cursor` name it rests on, and whether it clicks. */
export type CursorState = { cursor?: string; click?: boolean };

import { ring } from "./sections/ui";

/**
 * The frame a product demo plays in. `children` draws one step's state; elements the cursor visits carry
 * `data-cursor="<name>"`. The demo itself is `aria-hidden`: `description` says in one sentence what it shows, and the
 * real copy sits beside it. The window keeps the product's light ground on any page tone; `frame` puts it in its
 * browser window and hands it the pause control, which is always there (WCAG 2.2.2), pressed while the demo is
 * stopped. No caption: the founder's video of 22 Oct asked for no small text under the product. When the scene starts
 * again, its last step fades away over the first.
 */
export function DemoStage<S extends CursorState>({ steps, description, className, frame, windowClass, children }: {
  steps: readonly Step<S>[];
  description: string;
  className?: string;
  frame?: (win: ReactNode, pause: { paused: boolean; toggle: () => void }) => ReactNode;
  windowClass?: string;
  children: (state: S) => ReactNode;
}) {
  const stage = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const { state, paused, looping, toggle } = useScene(steps, stage);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  // The cursor moves to the centre of its target, measured once per step (never in a scroll handler).
  useLayoutEffect(() => {
    const b = box.current;
    const target = state.cursor ? b?.querySelector<HTMLElement>(`[data-cursor="${CSS.escape(state.cursor)}"]`) : null;
    if (!b || !target) return setAt(null);
    const r = b.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    setAt({ x: t.left - r.left + t.width / 2, y: t.top - r.top + t.height / 2 });
  }, [state]);

  const win = (
    <div ref={box} data-ground="day" className={cn("relative isolate overflow-hidden rounded-frame", windowClass)}>
      <div aria-hidden className="pointer-events-none select-none">
        {children(state)}
      </div>
      {looping ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 select-none animate-swap-out">
          {children(steps[steps.length - 1]!.state)}
        </div>
      ) : null}
      {at ? (
        <span aria-hidden className="pointer-events-none absolute left-0 top-0 z-raised ease-in-out motion-reduce:transition-none" style={{ transform: `translate(${at.x}px, ${at.y}px)`, transitionProperty: "transform", transitionDuration: `${motion.cursorMs}ms` }}>
          {state.click ? <span key={String(state.cursor)} className="absolute -left-3 -top-3 size-6 animate-click rounded-full border-2 border-ink/40" /> : null}
          <svg width="20" height="20" viewBox="0 0 20 20" className="drop-shadow-sm">
            <path d="M3 2l13 7.5-5.6 1.4L8 16.5z" className="fill-ink stroke-surface" strokeWidth="1.25" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
    </div>
  );

  return (
    <figure ref={stage} className={cn("relative", className)}>
      <figcaption className="sr-only">{description}</figcaption>
      {frame ? (
        frame(win, { paused, toggle })
      ) : (
        <div className="relative">
          {win}
          <button
            type="button"
            aria-label="Pause demo"
            aria-pressed={paused}
            onClick={toggle}
            className={cn("absolute bottom-3 left-3 flex size-9 items-center justify-center rounded-full bg-ink/70 text-surface hover:bg-ink/85", ring)}
          >
            {paused ? <Play size={14} weight="fill" aria-hidden /> : <Pause size={14} weight="fill" aria-hidden />}
          </button>
        </div>
      )}
    </figure>
  );
}

/**
 * A marketing page's `<main>`, on the paper ground. A section that says `data-tone="dark"` stands on the night ground
 * in the night colour set (tailwind.config.ts), always: the ground no longer crossfades as the page scrolls, because
 * the founder's video of 22 Oct 2026 caught that fade glitching between paper and dark. Where a page wants the change
 * soft it draws a `Seam` (sections/ui.tsx) between the two.
 */
export function PageMain({ id = "main-content", className, children }: { /** The skip link's anchor; null where the shell around the page already carries it. */ id?: string | null; className?: string; children?: ReactNode }) {
  return (
    <main id={id ?? undefined} className={cn("bg-[rgb(var(--mk-ground-paper))] text-ink", className)}>
      {children}
    </main>
  );
}