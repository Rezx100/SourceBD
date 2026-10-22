"use client";

// The home page's opening (the founder's videos of 22 Oct 2026, after mercury.com's hero): a buyer's sourcing studio in
// London, the laptop on its table, the headline in the light from its windows. From 1024 up, where nothing asks for
// reduced motion, the opening is a scene pinned for nearly three screens of scroll. The real app sits in the laptop's
// screen, pinned to its four corners; the camera pushes into the laptop; the app lifts out of it until it fills the view
// less a margin, while the laptop leaves the frame and the studio gives way to the night ground; then the app slides
// right, its far edge falling into the night, and the tour's list comes in on the left. The app is drawn at that final
// size and only ever scaled down, so its text stays sharp, and the laptop's part of the photograph is laid over at 2.56×
// so its bezel does too (founder's video 3). The window that rides the zoom is the tour's own, so nothing swaps. After
// the scene the tour never holds the scroll: an item opens when it is clicked or when the one before it has played to
// its end. Below 1024, and with reduced motion, the studio (with the app's first frame in the laptop) and the tour stack.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { stillPreferred } from "@/components/site/motion";
import { cn } from "@/lib/utils";
import { AppVideo, PauseButton, SCREENS, pauseOnClick } from "./browser";
import { HeroCopy } from "./hero";
import { TOUR, TourList, useTour, type TourItem } from "./tour";
import { Still, measure } from "./ui";

/** The laptop display's corners in the studio photograph (public/site/home/hero-*: 3840 × 2160), as shares of its size: top left, top right, bottom right, bottom left. */
export const DISPLAY = [
  [0.40417, 0.49444],
  [0.59349, 0.49444],
  [0.59557, 0.70463],
  [0.4026, 0.70463],
] as const;
/** The upscaled laptop (`laptop-*`, x 1122–2722, y 846–1746 of the 3840 plate) covers this part of the photograph. */
const LAPTOP = { x: 0.29219, y: 0.39167, w: 0.41667, h: 0.41667 } as const;
/** The app's shape: 1440 × 900. */
const ASPECT = 1.6;
/** The pinned scene is this many screens tall. */
const TRACK = 2.8;
/** How far the camera pushes in: the view stays inside the laptop layer, which is sharp to about 3×. */
const ZOOM = 3;

type Pt = readonly [number, number];
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** How far `p` is through the span from `a` to `b`, eased in and out. */
const span = (p: number, a: number, b: number) => {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: readonly Pt[], b: readonly Pt[], t: number): Pt[] => a.map((p, i) => [p[0] + (b[i]![0] - p[0]) * t, p[1] + (b[i]![1] - p[1]) * t]);
const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/** The CSS transform that maps a `w` × `h` box (origin at its top left) onto the quad `q` (top left, top right, bottom right, bottom left). */
export function quadTransform(w: number, h: number, q: readonly Pt[]): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q as [Pt, Pt, Pt, Pt];
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1 || 1e-9;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const k = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3;
  const d = y1 - y0 + g * y1, e = y3 - y0 + k * y3;
  const n = (v: number) => +v.toFixed(8);
  return `matrix3d(${[a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1].map(n).join(",")})`;
}

/** The studio photograph as a 16:9 box covering its parent; `laptop` lays the sharp laptop over it (the zoom only). */
function Studio({ scene, laptop, children }: { scene?: React.Ref<HTMLDivElement>; laptop?: boolean; children?: ReactNode }) {
  return (
    <div ref={scene} className="absolute left-1/2 top-1/2 aspect-video w-full min-w-[calc(100vh*16/9)] -translate-x-1/2 -translate-y-1/2 max-lg:min-w-0">
      <Still name="hero" eager sizes="(min-width: 1024px) 100vw, 100vw" />
      {laptop ? (
        <div aria-hidden className="absolute [mask-composite:intersect] [mask-image:linear-gradient(90deg,transparent,black_4%,black_96%,transparent),linear-gradient(transparent,black_4%,black_96%,transparent)]" style={{ left: `${LAPTOP.x * 100}%`, top: `${LAPTOP.y * 100}%`, width: `${LAPTOP.w * 100}%`, height: `${LAPTOP.h * 100}%` }}>
          <Still name="laptop" sizes="200vw" />
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** The app's first frame in the laptop's screen, clipped to the display's own shape (the scene's resting state, and the studio in flow). */
function Poster() {
  const [l, t] = [DISPLAY[3][0], DISPLAY[0][1]];
  const [w, h] = [DISPLAY[2][0] - l, DISPLAY[2][1] - t];
  const clip = DISPLAY.map(([x, y]) => `${(((x - l) / w) * 100).toFixed(2)}% ${(((y - t) / h) * 100).toFixed(2)}%`).join(", ");
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the recording's first frame, pre-sized
    <img src="/site/home/app-find.webp" alt="" className="absolute object-fill" style={{ left: `${l * 100}%`, top: `${t * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`, clipPath: `polygon(${clip})` }} />
  );
}

/** The tour's recordings stacked in the app's place, crossfading; a click pauses them, the keyboard finds the button. */
function Dash({ items, active, playing, onEnded, bar }: { items: readonly TourItem[]; active: number; playing: boolean; onEnded: () => void; bar: React.RefObject<HTMLSpanElement | null> }) {
  const [paused, setPaused] = useState(false);
  const toggle = () => setPaused((v) => !v);
  const open = items[active]!;
  return (
    <figure data-ground="day" className="relative m-0 size-full overflow-hidden bg-surface" onClick={pauseOnClick(toggle)}>
      <figcaption className="sr-only">{open.screen ? SCREENS[open.screen].says : open.body}</figcaption>
      {items.map((t, i) => (t.screen ? <AppVideo key={t.key} name={t.screen} active={i === active} playing={playing && !paused} eager={i === 0} onEnded={onEnded} bar={bar} /> : null))}
      <PauseButton paused={paused} onToggle={toggle} />
    </figure>
  );
}

export function Opening({ suppliers, chips, items = TOUR }: { suppliers: number | null; chips?: ReactNode; items?: readonly TourItem[] }) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const studio = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const night = useRef<HTMLDivElement>(null);
  const words = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const dash = useRef<HTMLDivElement>(null);
  const edge = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [pinned, setPinned] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const { active, setActive, next } = useTour(items.length, items, section);

  useEffect(() => {
    const wide = matchMedia("(min-width: 1024px)");
    const decide = () => setPinned(wide.matches && !stillPreferred());
    decide();
    wide.addEventListener("change", decide);
    return () => wide.removeEventListener("change", decide);
  }, []);

  // The scene: every frame of the scroll, the photograph's zoom and the app's four corners, written as transforms.
  useLayoutEffect(() => {
    const sec = section.current;
    const st = stage.current;
    const sc = scene.current;
    const d = dash.current;
    if (!pinned || !sec || !st || !sc || !d) {
      for (const el of [sc, studio.current, copy.current, night.current, words.current, edge.current]) if (el) el.style.cssText = "";
      setSize(null);
      setPlaying(true);
      return;
    }
    let raf = 0;
    let was: boolean | null = null;
    let W = 0, H = 0, home: Pt = [0, 0];
    // The app's own size: the view less a margin, 16:10 kept (92 % of the width, 86 % of the height at most).
    const fit = () => {
      const vw = st.clientWidth, vh = st.clientHeight;
      H = Math.round(Math.min(vh * 0.86, (vw * 0.92) / ASPECT));
      W = Math.round(H * ASPECT);
      const s = st.getBoundingClientRect();
      const r = slot.current!.getBoundingClientRect();
      home = [r.left - s.left, (vh - H) / 2];
      setSize({ w: W, h: H });
    };
    const apply = () => {
      raf = 0;
      const p = clamp(-sec.getBoundingClientRect().top / Math.max(1, sec.offsetHeight - innerHeight));
      const vw = st.clientWidth, vh = st.clientHeight;
      // The photograph as it covers the stage, before the camera moves.
      const sw = Math.max(vw, (vh * 16) / 9), sh = (sw * 9) / 16;
      const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
      const O: Pt = [((DISPLAY[0][0] + DISPLAY[2][0]) / 2) * sw, ((DISPLAY[0][1] + DISPLAY[2][1]) / 2) * sh];
      const t = span(p, 0.04, 0.46);
      const z = Math.exp(Math.log(ZOOM) * t);
      const T: Pt = [(vw / 2 - sx - O[0]) * t, (vh / 2 - sy - O[1]) * t];
      sc.style.transformOrigin = `${O[0]}px ${O[1]}px`;
      sc.style.transform = `translate(-50%, -50%) translate(${T[0]}px, ${T[1]}px) scale(${z})`;
      // The display's corners on the stage, through the same camera.
      const pinnedQ = DISPLAY.map(([x, y]): Pt => [sx + O[0] + z * (x * sw - O[0]) + T[0], sy + O[1] + z * (y * sh - O[1]) + T[1]]);
      const fill = rect((vw - W) / 2, (vh - H) / 2, W, H);
      const settled = rect(home[0], home[1], W, H);
      const lift = span(p, 0.3, 0.46);
      const slide = span(p, 0.54, 0.8);
      const q = slide > 0 ? mix(fill, settled, slide) : mix(pinnedQ, fill, lift);
      d.style.transform = quadTransform(W, H, q);
      d.style.borderRadius = `${14 * lift}px`;
      d.style.boxShadow = lift > 0 ? `0 ${40 * lift}px ${90 * lift}px -${30 * lift}px rgb(var(--mk-ground-night) / ${0.9 * lift})` : "none";
      if (studio.current) {
        const gone = span(p, 0.34, 0.5);
        studio.current.style.opacity = String(1 - gone);
        studio.current.style.visibility = gone >= 1 ? "hidden" : "";
      }
      if (night.current) night.current.style.opacity = String(span(p, 0.3, 0.48));
      const c = span(p, 0, 0.14);
      if (copy.current) {
        copy.current.style.opacity = String(1 - c);
        copy.current.style.transform = `translateY(${-40 * c}px)`;
        copy.current.style.visibility = c >= 1 ? "hidden" : "";
      }
      if (edge.current) edge.current.style.opacity = String(slide);
      const wds = span(p, 0.66, 0.88);
      if (words.current) {
        words.current.style.opacity = String(wds);
        words.current.style.transform = `translateY(${(1 - wds) * 20}px)`;
        // Until the list is there to see, clicks go to the headline's form under it.
        words.current.style.pointerEvents = wds > 0.5 ? "auto" : "none";
      }
      // The app plays once it is out of the laptop and whole on the night ground.
      const now = p >= 0.46;
      if (now !== was) {
        was = now;
        setPlaying(now);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onResize = () => {
      fit();
      apply();
    };
    fit();
    apply();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
    };
  }, [pinned]);

  const dashboard = <Dash items={items} active={active} playing={playing} onEnded={next} bar={bar} />;

  return (
    <section ref={section} data-tone="dark" aria-labelledby="home-title" className="relative" style={pinned ? { height: `${TRACK * 100}vh` } : undefined}>
      <div ref={stage} className={cn(pinned && "sticky top-0 h-screen overflow-hidden")}>
        {/* The studio. In the scene it fills the stage under everything; in flow it is the page's first block. */}
        <div data-ground="day" className={cn("bg-[rgb(var(--mk-ground-paper))] text-ink", pinned ? "absolute inset-0" : "relative flex flex-col lg:block lg:h-screen lg:min-h-[640px] lg:overflow-hidden")}>
          <div ref={studio} className={cn(pinned ? "absolute inset-0 overflow-hidden" : "relative order-2 aspect-video overflow-hidden lg:absolute lg:inset-0 lg:aspect-auto")}>
            <Studio scene={scene} laptop={pinned}>
              {pinned ? null : <Poster />}
            </Studio>
          </div>
          {/* The light from the windows: the paper ground falling away down the photograph, under the copy. */}
          <div ref={copy} className="relative order-1 lg:absolute lg:inset-x-0 lg:top-0">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hidden h-[62vh] bg-gradient-to-b from-[rgb(var(--mk-ground-paper))] via-[rgb(var(--mk-ground-paper)/0.82)] via-45% to-transparent lg:block" />
            <HeroCopy suppliers={suppliers} />
          </div>
        </div>
        {pinned ? <div ref={night} aria-hidden className="absolute inset-0 bg-[rgb(var(--mk-ground-night))] opacity-0" /> : null}
        {/* The app: in the scene one element from the laptop's screen to its place beside the list. */}
        {pinned ? (
          <div ref={dash} className={cn("absolute left-0 top-0 origin-top-left overflow-hidden", !size && "invisible")} style={size ? { width: size.w, height: size.h } : undefined}>
            {dashboard}
          </div>
        ) : null}
        {/* The app's far edge falls into the night once it has moved aside. */}
        {pinned ? <div ref={edge} aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[16vw] bg-gradient-to-r from-transparent to-[rgb(var(--mk-ground-night))] opacity-0" /> : null}
        {/* The tour. In the scene it is the stage's last frame; in flow it is the section after the studio. */}
        <div className={cn(pinned ? "pointer-events-none absolute inset-0 flex items-center" : "py-16 md:py-section")}>
          <div className={cn(measure, "grid items-center gap-10 lg:grid-cols-12 lg:gap-12 xl:gap-16")}>
            {/* min-w-0: the chips' sideways strip must not widen the column past the phone's edge. */}
            <div ref={words} className="pointer-events-auto min-w-0 lg:col-span-4">
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
            <div ref={slot} className="min-w-0 lg:col-span-8">
              {/* In flow the app shows at a size a phone can read: its left part, edge to edge in the column. */}
              {pinned ? null : (
                <div className="relative aspect-[4/3] overflow-hidden rounded-frame shadow-window">
                  <div className="absolute inset-y-0 left-0 w-[140%]">{dashboard}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
