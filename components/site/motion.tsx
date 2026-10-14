"use client";

// The marketing site's motion foundation (handoff-mercury-motion-sitewide.md §4, M0). Four pieces, no package:
// `useInView` (one IntersectionObserver), `useScene` (a list of timed steps that plays while it is half in view and
// stops off screen, in a hidden tab, or on the pause button), `DemoStage` (the frame a scripted product demo plays
// in: a visible pause button, a drawn cursor, and a sentence for screen readers) and `ToneShift` (the page's ground
// crossfading between paper and dark as sections reach the middle of the viewport).
//
// The server renders every scene's LAST step, so the page reads complete with no script and paints fast; the
// script then rewinds a scene to its first step when it starts. Reduced motion and Save-Data keep the last step and
// offer play instead; app/ds.css stills every CSS transition under reduced motion.

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

/**
 * Plays `steps` while `ref` is half in view, the tab is visible and the visitor has not paused it; loops after the
 * last step holds for `HOLD_MS`. Starts on the last step (the server's end state); under reduced motion it stays
 * there, paused, until the visitor presses play.
 */
export function useScene<S>(steps: readonly Step<S>[], ref: RefObject<Element | null>): { state: S; index: number; paused: boolean; toggle: () => void } {
  const last = steps.length - 1;
  const [index, setIndex] = useState(last);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const inView = useInView(ref, 0.5);
  const latest = useRef(steps);
  latest.current = steps;
  // Where the clock stood when it last stopped; null until the scene first runs (it is then on the server's last step).
  const elapsed = useRef<number | null>(null);

  useEffect(() => {
    if (stillPreferred()) setPaused(true);
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

  const running = inView && !hidden && !paused;
  useEffect(() => {
    if (!running) return;
    let t0 = performance.now() - (elapsed.current ?? 0);
    let timer = 0;
    const tick = () => {
      const s = latest.current;
      const total = s[s.length - 1]!.at + HOLD_MS;
      let ms = performance.now() - t0;
      if (ms >= total) {
        t0 += total * Math.floor(ms / total);
        ms = performance.now() - t0;
      }
      elapsed.current = ms;
      const i = stepAt(s, ms);
      setIndex(i);
      timer = window.setTimeout(tick, Math.max(16, (s[i + 1]?.at ?? total) - ms));
    };
    tick();
    return () => {
      window.clearTimeout(timer);
      elapsed.current = performance.now() - t0;
    };
  }, [running]);

  return { state: steps[Math.min(index, last)]!.state, index, paused, toggle: () => setPaused((p) => !p) };
}

/** What a demo step may say about the drawn cursor: the `data-cursor` name it rests on, and whether it clicks. */
export type CursorState = { cursor?: string; click?: boolean };

const ring = "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/**
 * The frame a product demo plays in. `children` draws one step's state; elements the cursor visits carry
 * `data-cursor="<name>"`. The demo itself is `aria-hidden`: `description` says in one sentence what it shows, and the
 * real copy sits beside it. The pause button is always there (WCAG 2.2.2), pressed while the demo is stopped.
 */
export function DemoStage<S extends CursorState>({ steps, description, className, children }: { steps: readonly Step<S>[]; description: string; className?: string; children: (state: S) => ReactNode }) {
  const stage = useRef<HTMLElement>(null);
  const { state, paused, toggle } = useScene(steps, stage);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  // The cursor moves to the centre of its target, measured once per step (never in a scroll handler).
  useLayoutEffect(() => {
    const box = stage.current;
    const target = state.cursor ? box?.querySelector<HTMLElement>(`[data-cursor="${CSS.escape(state.cursor)}"]`) : null;
    if (!box || !target) return setAt(null);
    const b = box.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    setAt({ x: t.left - b.left + t.width / 2, y: t.top - b.top + t.height / 2 });
  }, [state]);

  return (
    <figure ref={stage} className={cn("relative isolate overflow-hidden", className)}>
      <figcaption className="sr-only">{description}</figcaption>
      <div aria-hidden className="pointer-events-none select-none">
        {children(state)}
      </div>
      {at ? (
        <span aria-hidden className="pointer-events-none absolute left-0 top-0 z-raised ease-in-out motion-reduce:transition-none" style={{ transform: `translate(${at.x}px, ${at.y}px)`, transitionProperty: "transform", transitionDuration: `${motion.cursorMs}ms` }}>
          {state.click ? <span key={String(state.cursor)} className="absolute -left-3 -top-3 size-6 animate-click rounded-full border-2 border-ink/40" /> : null}
          <svg width="20" height="20" viewBox="0 0 20 20" className="drop-shadow-sm">
            <path d="M3 2l13 7.5-5.6 1.4L8 16.5z" className="fill-ink stroke-surface" strokeWidth="1.25" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
      <button
        type="button"
        aria-label="Pause demo"
        aria-pressed={paused}
        onClick={toggle}
        className={cn("absolute bottom-3 left-3 z-raised flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-menu hover:bg-sunken", ring)}
      >
        {paused ? <Play size={16} weight="fill" aria-hidden /> : <Pause size={16} weight="fill" aria-hidden />}
      </button>
    </figure>
  );
}

export type Tone = "paper" | "dark" | "photo";

/**
 * The page's `<main>`. Each section says its tone with `data-tone`; the one crossing the middle of the viewport sets
 * the ground. Dark swaps in the night colour set (`data-ground="night"`, tailwind.config.ts), so every token reads
 * dark; the ground fades over `duration-tone`, and so does every colour inside that sets no transition of its own
 * (the zero-specificity rule in tailwind.config.ts), so text never flips ahead of its ground. Sections under it keep
 * a transparent ground.
 */
export function ToneShift({ initial = "paper", className, children }: { initial?: Tone; className?: string; children?: ReactNode }) {
  const main = useRef<HTMLElement>(null);
  const [tone, setTone] = useState<Tone>(initial);
  useEffect(() => {
    const el = main.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setTone((e.target.getAttribute("data-tone") as Tone | null) ?? "paper");
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    el.querySelectorAll("[data-tone]").forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);
  return (
    <main ref={main} id="main-content" data-tone={tone} data-ground={tone === "dark" ? "night" : undefined} className={cn("bg-surface text-ink transition-colors duration-tone ease-reveal", className)}>
      {children}
    </main>
  );
}
