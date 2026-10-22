"use client";

// The home page's opening (the founder's videos of 22 Oct 2026, after mercury.com's): a buyer's sourcing studio in
// London, the laptop on its table, the headline in the light from its windows. From 1024 up, where nothing asks for
// reduced motion, the opening is a scene pinned for nearly two screens of scroll: the copy lifts away, the camera
// pushes into the laptop until its screen, the real app in a browser window, fills the view, then that window settles
// to the right of the tour on the night ground. The window that rides the zoom is the tour's own, so nothing swaps.
// After the scene the tour is an ordinary section: it never holds the scroll; an item opens when it is clicked or when
// the one before it has played to its end. Below 1024, and with reduced motion, the studio and the tour stack in flow.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { stillPreferred } from "@/components/site/motion";
import { cn } from "@/lib/utils";
import { BrowserFrame, SCREENS } from "./browser";
import { HeroCopy } from "./hero";
import { TOUR, TourList, TourWindow, useTour, type TourItem } from "./tour";
import { Still, measure } from "./ui";

/** Where the laptop's screen is in the studio photograph (public/site/home/hero-*), as shares of its width and height. */
const SCREEN = { x: 0.4026, y: 0.494, w: 0.1932, h: 0.2116 } as const;
/** The window's shape: 1440 × 900, its bar included. */
const ASPECT = 1.6;
/** The pinned scene is this many screens tall; the zoom, the settle and the hold share the scroll inside it. */
const TRACK = 2.8;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** How far `p` is through the span from `a` to `b`, eased in and out. */
const span = (p: number, a: number, b: number) => {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};
type Box = { x: number; y: number; w: number; h: number };
const lerp = (a: Box, b: Box, t: number): Box => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t });

/** The studio photograph as a 16:9 box covering its parent, with the laptop's screen showing the app. */
function Studio({ scene, poster }: { scene?: React.Ref<HTMLDivElement>; poster: boolean }) {
  return (
    <div ref={scene} className="absolute left-1/2 top-1/2 aspect-video w-full min-w-[calc(100vh*16/9)] -translate-x-1/2 -translate-y-1/2 max-lg:min-w-0">
      <Still name="hero" eager sizes="(min-width: 1024px) 100vw, 100vw" />
      {poster ? (
        <div className="absolute overflow-hidden" style={{ left: `${SCREEN.x * 100}%`, top: `${SCREEN.y * 100}%`, width: `${SCREEN.w * 100}%`, height: `${SCREEN.h * 100}%` }}>
          <BrowserFrame url={SCREENS.find.url} className="rounded-none shadow-none ring-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- the recording's first frame, pre-sized */}
            <img src="/site/home/app-find.webp" alt="" className="size-full object-cover object-top" />
          </BrowserFrame>
        </div>
      ) : null}
    </div>
  );
}

export function Opening({ suppliers, chips, items = TOUR }: { suppliers: number | null; chips?: ReactNode; items?: readonly TourItem[] }) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const night = useRef<HTMLDivElement>(null);
  const words = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [pinned, setPinned] = useState(false);
  const [settled, setSettled] = useState(true);
  const { active, setActive, next } = useTour(items.length, items, section);
  const natural = useRef<Box>({ x: 0, y: 0, w: 1, h: 1 });

  useEffect(() => {
    const wide = matchMedia("(min-width: 1024px)");
    const decide = () => setPinned(wide.matches && !stillPreferred());
    decide();
    wide.addEventListener("change", decide);
    return () => wide.removeEventListener("change", decide);
  }, []);

  // The scene: every frame of the scroll, the photograph's zoom and the window's place, written as transforms.
  useLayoutEffect(() => {
    const sec = section.current;
    const st = stage.current;
    const fr = frame.current;
    if (!pinned || !sec || !st || !fr) {
      for (const el of [scene.current, copy.current, night.current, words.current, fr]) if (el) el.style.cssText = "";
      setSettled(true);
      return;
    }
    let raf = 0;
    let wasSettled: boolean | null = null;
    const measure = () => {
      fr.style.transform = "none";
      const s = st.getBoundingClientRect();
      const f = fr.getBoundingClientRect();
      natural.current = { x: f.left - s.left, y: f.top - s.top, w: f.width, h: f.height };
    };
    const apply = () => {
      raf = 0;
      const p = clamp(-sec.getBoundingClientRect().top / Math.max(1, sec.offsetHeight - innerHeight));
      const vw = st.clientWidth;
      const vh = st.clientHeight;
      const sw = Math.max(vw, (vh * 16) / 9);
      const sh = (sw * 9) / 16;
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;
      // The laptop's screen at rest, its centre, and the zoom that makes it cover the view.
      const L = { x: sx + SCREEN.x * sw, y: sy + SCREEN.y * sh, w: SCREEN.w * sw, h: SCREEN.h * sh };
      const O = { x: L.x + L.w / 2, y: L.y + L.h / 2 };
      const zEnd = Math.max(vw / L.w, (vh * ASPECT) / L.w) * 1.02;
      const t = span(p, 0.04, 0.5);
      const z = Math.exp(Math.log(zEnd) * t);
      const T = { x: (vw / 2 - O.x) * t, y: (vh / 2 - O.y) * t };
      const at = (zoom: number, shift: { x: number; y: number }): Box => {
        const w = L.w * zoom;
        const h = w / ASPECT;
        return { x: O.x + shift.x - w / 2, y: O.y + shift.y - h / 2, w, h };
      };
      const h = span(p, 0.56, 0.86);
      const R = h > 0 ? lerp(at(zEnd, { x: vw / 2 - O.x, y: vh / 2 - O.y }), natural.current, h) : at(z, T);
      const F = natural.current;
      if (scene.current) {
        scene.current.style.transformOrigin = `${O.x - sx}px ${O.y - sy}px`;
        scene.current.style.transform = `translate(-50%, -50%) translate(${T.x}px, ${T.y}px) scale(${z})`;
        scene.current.style.visibility = p > 0.62 ? "hidden" : "";
      }
      const c = span(p, 0, 0.14);
      if (copy.current) {
        copy.current.style.opacity = String(1 - c);
        copy.current.style.transform = `translateY(${-40 * c}px)`;
      }
      if (night.current) night.current.style.opacity = String(span(p, 0.42, 0.56));
      const wds = span(p, 0.74, 0.94);
      if (words.current) {
        words.current.style.opacity = String(wds);
        words.current.style.transform = `translateY(${(1 - wds) * 20}px)`;
      }
      fr.style.transformOrigin = "0 0";
      fr.style.transform = `translate(${R.x - F.x}px, ${R.y - F.y}px) scale(${R.w / F.w})`;
      const now = p >= 0.9;
      if (now !== wasSettled) {
        wasSettled = now;
        setSettled(now);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onResize = () => {
      measure();
      apply();
    };
    measure();
    apply();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
    };
  }, [pinned]);


  return (
    <section ref={section} data-tone="dark" aria-labelledby="home-title" className="relative" style={pinned ? { height: `${TRACK * 100}vh` } : undefined}>
      <div ref={stage} className={cn(pinned && "sticky top-0 h-screen overflow-hidden")}>
        {/* The studio. In the scene it fills the stage under everything; in flow it is the page's first block. */}
        <div data-ground="day" className={cn("bg-[rgb(var(--mk-ground-paper))] text-ink", pinned ? "absolute inset-0" : "relative flex flex-col lg:block lg:h-screen lg:min-h-[640px] lg:overflow-hidden")}>
          <div className={cn(pinned ? "absolute inset-0" : "relative order-2 aspect-video overflow-hidden lg:absolute lg:inset-0 lg:aspect-auto")}>
            <Studio scene={scene} poster={!pinned} />
          </div>
          {/* The light from the windows: the paper ground falling away down the photograph, under the copy. */}
          <div ref={copy} className="relative order-1 lg:absolute lg:inset-x-0 lg:top-0">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hidden h-[62vh] bg-gradient-to-b from-[rgb(var(--mk-ground-paper))] via-[rgb(var(--mk-ground-paper)/0.82)] via-45% to-transparent lg:block" />
            <HeroCopy suppliers={suppliers} />
          </div>
        </div>
        {pinned ? <div ref={night} aria-hidden className="absolute inset-0 bg-[rgb(var(--mk-ground-night))] opacity-0" /> : null}
        {/* The tour. In the scene it is the stage's last frame; in flow it is the section after the studio. */}
        <div className={cn(pinned ? "absolute inset-0 flex items-center" : "py-16 md:py-section")}>
          <div className={cn(measure, "grid items-center gap-10 lg:grid-cols-12 lg:gap-12 xl:gap-16")}>
            {/* min-w-0: the chips' sideways strip must not widen the column past the phone's edge. */}
            <div ref={words} className="min-w-0 lg:col-span-4">
              <TourList
                heading={
                  <>
                    Everything you do to vet a factory. <span className="text-ink-2">In one place.</span>
                  </>
                }
                items={items}
                active={active}
                onPick={setActive}
                bar={bar}
                extra={(t) => (t.key === "find" && chips ? <div className="pt-1">{chips}</div> : null)}
              />
            </div>
            <div className="min-w-0 lg:col-span-8">
              <div ref={frame} className="will-change-transform">
                <TourWindow items={items} active={active} playing={settled} onEnded={next} bar={bar} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}