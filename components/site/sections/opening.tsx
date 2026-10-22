"use client";

// The home page's opening (the founder's videos of 22 Oct 2026, after mercury.com's hero): a buyer's sourcing studio in
// London, the laptop on its table, the headline in the light from its windows, the navigation floating over it. From
// 1024 up, where nothing asks for reduced motion, the opening is a scene pinned for three screens of scroll (his
// recording of 22 Oct 13:17 set the order; his review of 14:18 the finish): at rest the app's first frame sits in the
// laptop's screen as a plain picture at the display's own pixel size, crisp; the camera pushes in until the laptop is
// the hero, the display as wide as the app will stand, while the studio round it softens into a blur that grades into
// the sharp laptop with no edge (a wide feather, as a lens would); then the laptop and the studio fade into the night
// ground and the app alone remains, exactly where it was and always below the navigation's bar; it shrinks a little
// as it slides right, its far edge falling into the night, and only once it has settled beside the tour's list does
// it play. While the scene moves the app is a picture laid out at its size on screen, never a video scaled on the
// GPU, so nothing shimmers; the laptop's part of the photograph is laid over at 2.56× so its bezel stays sharp too.
// No shadow is drawn under the app at any point. After the scene the tour never holds the scroll: an item opens when
// it is clicked or when the one before it has played to its end. Below 1024, and with reduced motion, the studio
// (with the app's first frame in the laptop) and the tour stack.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { stillPreferred } from "@/components/site/motion";
import { spacing } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { AppVideo, PauseButton, SCREENS, pauseOnClick, screenFile } from "./browser";
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
const TRACK = 3.2;
/** The camera never pushes in past this, whatever the window's shape (the laptop layer is sharp to about 4×). */
const MAX_ZOOM = 4.8;
/** How far the studio round the laptop blurs by the end of the push, in px. */
const BLUR = 18;
/** The navigation's bar, which the app never goes under (his review of 22 Oct 14:18), and the room kept round the app. */
const NAV = parseInt(spacing.nav, 10);
const MARGIN = 24;
/** The app's size beside the list, as a share of its full size: it shrinks a little as it moves aside (the same review). */
const SETTLE = 0.85;

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

/** The studio photograph as a 16:9 box covering its parent. `room` is the photograph itself, which the scene blurs; the sharp laptop is laid over it by the scene (`Laptop`), outside this box. */
function Studio({ scene, room, children }: { scene?: React.Ref<HTMLDivElement>; room?: React.Ref<HTMLDivElement>; children?: ReactNode }) {
  return (
    <div ref={scene} className="absolute left-1/2 top-1/2 aspect-video w-full min-w-[calc(100vh*16/9)] -translate-x-1/2 -translate-y-1/2 will-change-transform max-lg:min-w-0">
      <div ref={room} className="absolute inset-0">
        <Still name="hero" eager sizes="(min-width: 1024px) 100vw, 100vw" />
      </div>
      {children}
    </div>
  );
}

/**
 * The laptop's part of the photograph at 2.56×, laid over the blurring room while the camera pushes in. Its edge is
 * no edge: an ellipse that is whole over the laptop and fades out to the box's sides, so the sharp laptop grades into
 * the soft room the way a lens's focus does (his review of 22 Oct 14:18: no visible seam). The scene places it.
 */
function Laptop({ box }: { box: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={box} aria-hidden className="invisible absolute left-0 top-0 [mask-image:radial-gradient(ellipse_62%_60%_at_50%_50%,black_46%,transparent_100%)]">
      <Still name="laptop" sizes="200vw" />
    </div>
  );
}

/** The app's first frame in the laptop's screen, clipped to the display's own shape: the scene's resting state, drawn plain at the display's pixel size, and the studio in flow. */
function Poster({ box, file }: { box?: React.Ref<HTMLImageElement>; file: string }) {
  const [l, t] = [DISPLAY[3][0], DISPLAY[0][1]];
  const [w, h] = [DISPLAY[2][0] - l, DISPLAY[2][1] - t];
  const clip = DISPLAY.map(([x, y]) => `${(((x - l) / w) * 100).toFixed(2)}% ${(((y - t) / h) * 100).toFixed(2)}%`).join(", ");
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the recording's first frame, pre-sized
    <img ref={box} src={`/site/home/${file}.webp`} alt="" className="absolute object-fill" style={{ left: `${l * 100}%`, top: `${t * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`, clipPath: `polygon(${clip})` }} />
  );
}

/**
 * The tour's recordings stacked in the app's place, crossfading; a click pauses them, the keyboard finds the button.
 * Until the app has settled beside the list (`cover`), the open item's first frame lies over the recordings as a
 * picture: a picture scales crisp through the scene where a video would not, and nothing plays before its place.
 */
function Dash({ items, active, cover, onEnded, bar }: { items: readonly TourItem[]; active: number; cover: boolean; onEnded: () => void; bar: React.RefObject<HTMLSpanElement | null> }) {
  const [paused, setPaused] = useState(false);
  const toggle = () => setPaused((v) => !v);
  const open = items[active]!;
  return (
    <figure data-ground="day" className="relative m-0 size-full overflow-hidden bg-surface" onClick={pauseOnClick(toggle)}>
      <figcaption className="sr-only">{open.screen ? SCREENS[open.screen].says : open.body}</figcaption>
      {items.map((t, i) => (t.screen ? <AppVideo key={t.key} name={t.screen} active={i === active} playing={!paused && !cover} restart={cover} eager={i === 0} onEnded={onEnded} bar={bar} /> : null))}
      {open.screen ? (
        // eslint-disable-next-line @next/next/no-img-element -- the recording's first frame, pre-sized
        <img src={`/site/home/${screenFile(open.screen)}.webp`} alt="" aria-hidden className={cn("absolute inset-0 size-full object-cover object-top transition-opacity duration-fast motion-reduce:transition-none", cover ? "opacity-100" : "pointer-events-none opacity-0")} />
      ) : null}
      <PauseButton paused={paused} onToggle={toggle} />
    </figure>
  );
}

export function Opening({ suppliers, items = TOUR }: { suppliers: number | null; items?: readonly TourItem[] }) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const studio = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const room = useRef<HTMLDivElement>(null);
  const laptop = useRef<HTMLDivElement>(null);
  const poster = useRef<HTMLImageElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const night = useRef<HTMLDivElement>(null);
  const words = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const dash = useRef<HTMLDivElement>(null);
  const edge = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [pinned, setPinned] = useState(false);
  // The app has reached its place beside the list: only then does it play.
  const [settled, setSettled] = useState(false);
  const { active, setActive, next } = useTour(items.length, items, section);
  const first = items[0]?.screen ? screenFile(items[0].screen) : "app-find";

  useEffect(() => {
    const wide = matchMedia("(min-width: 1024px)");
    const decide = () => setPinned(wide.matches && !stillPreferred());
    decide();
    wide.addEventListener("change", decide);
    return () => wide.removeEventListener("change", decide);
  }, []);

  // The scene: every frame of the scroll, the photograph's zoom, the laptop's box and the app's four corners, written
  // as transforms. The laptop and the app are laid out at their size on screen each frame, so each is drawn at 1:1
  // and nothing is resampled on the way; only the room is scaled, and it is going out of focus.
  useLayoutEffect(() => {
    const sec = section.current;
    const st = stage.current;
    const sc = scene.current;
    const d = dash.current;
    if (!pinned || !sec || !st || !sc || !d) {
      for (const el of [sc, room.current, laptop.current, poster.current, studio.current, copy.current, night.current, words.current, edge.current]) if (el) el.style.cssText = "";
      setSettled(false);
      return;
    }
    let raf = 0;
    let W = 0, H = 0, top = 0, home: Pt = [0, 0], was = false;
    // The app's own size: the room below the bar less a margin, 16:10 kept (92 % of the width at most).
    const fit = () => {
      const vw = st.clientWidth, vh = st.clientHeight;
      const avail = vh - NAV - 2 * MARGIN;
      H = Math.round(Math.min(avail, (vw * 0.92) / ASPECT));
      W = Math.round(H * ASPECT);
      top = NAV + MARGIN + (avail - H) / 2;
      const s = st.getBoundingClientRect();
      const r = slot.current!.getBoundingClientRect();
      home = [r.left - s.left, top + ((1 - SETTLE) * H) / 2];
    };
    const apply = () => {
      raf = 0;
      const p = clamp(-sec.getBoundingClientRect().top / Math.max(1, sec.offsetHeight - innerHeight));
      const vw = st.clientWidth, vh = st.clientHeight;
      // The photograph as it covers the stage, before the camera moves.
      const sw = Math.max(vw, (vh * 16) / 9), sh = (sw * 9) / 16;
      const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
      const O: Pt = [((DISPLAY[0][0] + DISPLAY[2][0]) / 2) * sw, ((DISPLAY[0][1] + DISPLAY[2][1]) / 2) * sh];
      // The push ends with the display as wide as the app stands on its own, centred where the app will stand (below
      // the bar), so the app never has to move to leave it.
      const zoom = Math.min(MAX_ZOOM, W / ((DISPLAY[1][0] - DISPLAY[0][0]) * sw));
      const t = span(p, 0.04, 0.46);
      const z = Math.exp(Math.log(zoom) * t);
      const T: Pt = [(vw / 2 - sx - O[0]) * t, (top + H / 2 - sy - O[1]) * t];
      // A point of the photograph, through the camera, on the stage.
      const cam = (x: number, y: number): Pt => [sx + O[0] + z * (x * sw - O[0]) + T[0], sy + O[1] + z * (y * sh - O[1]) + T[1]];
      sc.style.transformOrigin = `${O[0]}px ${O[1]}px`;
      sc.style.transform = `translate(-50%, -50%) translate(${T[0]}px, ${T[1]}px) scale(${z})`;
      // The studio round the laptop softens as the camera comes in; the laptop, laid over it, stays sharp.
      if (room.current) room.current.style.filter = t > 0.01 ? `blur(${(BLUR * t) / z}px)` : "";
      const gone = span(p, 0.54, 0.68);
      const slide = span(p, 0.74, 0.9);
      const rest = t === 0;
      if (laptop.current) {
        const [lx, ly] = cam(LAPTOP.x, LAPTOP.y);
        const l = laptop.current.style;
        l.left = `${lx}px`;
        l.top = `${ly}px`;
        l.width = `${z * LAPTOP.w * sw}px`;
        l.height = `${z * LAPTOP.h * sh}px`;
        l.visibility = rest || gone >= 1 ? "hidden" : "visible";
      }
      // At rest the app is a plain picture in the display (`Poster`); once the camera moves, the app itself takes
      // the display's corners, drawn at the size it has on screen.
      if (poster.current) poster.current.style.visibility = rest ? "" : "hidden";
      const pinnedQ = DISPLAY.map(([x, y]): Pt => cam(x, y));
      const fill = rect((vw - W) / 2, top, W, H);
      const settledQ = rect(home[0], home[1], SETTLE * W, SETTLE * H);
      // The laptop holds as the hero for a moment; then the laptop and the studio fall away while the app keeps its
      // place, only its slight perspective easing out; only then does it shrink a little and slide aside.
      const q = slide > 0 ? mix(fill, settledQ, slide) : mix(pinnedQ, fill, gone);
      const L = Math.round(Math.hypot(q[1]![0] - q[0]![0], q[1]![1] - q[0]![1]));
      const M = Math.round(L / ASPECT);
      d.style.width = `${L}px`;
      d.style.height = `${M}px`;
      d.style.transform = quadTransform(L, M, q);
      d.style.borderRadius = `${14 * gone}px`;
      d.style.visibility = rest ? "hidden" : "visible";
      if (studio.current) {
        studio.current.style.opacity = String(1 - gone);
        studio.current.style.visibility = gone >= 1 ? "hidden" : "";
      }
      if (night.current) night.current.style.opacity = String(gone);
      const c = span(p, 0, 0.14);
      if (copy.current) {
        copy.current.style.opacity = String(1 - c);
        copy.current.style.transform = `translateY(${-40 * c}px)`;
        copy.current.style.visibility = c >= 1 ? "hidden" : "";
      }
      if (edge.current) edge.current.style.opacity = String(slide);
      // The list comes in once the app has cleared its column, never under it.
      const wds = span(p, 0.88, 0.98);
      if (words.current) {
        words.current.style.opacity = String(wds);
        words.current.style.transform = `translateY(${(1 - wds) * 20}px)`;
        // Until the list is there to see, clicks go to the headline's form under it.
        words.current.style.pointerEvents = wds > 0.5 ? "auto" : "none";
      }
      const now = slide >= 1;
      if (now !== was) {
        was = now;
        setSettled(now);
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

  const dashboard = <Dash items={items} active={active} cover={pinned && !settled} onEnded={next} bar={bar} />;

  return (
    // From 1024 up the opening starts under the navigation, which floats over the studio until the page scrolls.
    <section ref={section} data-tone="dark" aria-labelledby="home-title" className="relative lg:-mt-nav" style={pinned ? { height: `${TRACK * 100}vh` } : undefined}>
      <div ref={stage} className={cn(pinned && "sticky top-0 h-screen overflow-hidden")}>
        {/* The studio. In the scene it fills the stage under everything; in flow it is the page's first block. */}
        <div data-ground="day" className={cn("bg-[rgb(var(--mk-ground-paper))] text-ink", pinned ? "absolute inset-0" : "relative flex flex-col lg:block lg:h-screen lg:min-h-[640px] lg:overflow-hidden")}>
          <div ref={studio} className={cn(pinned ? "absolute inset-0 overflow-hidden" : "relative order-2 aspect-video overflow-hidden lg:absolute lg:inset-0 lg:aspect-auto")}>
            {/* The room keeps one raster and is only scaled (it is going out of focus); the laptop and the app are laid out at their size on screen. */}
            <Studio scene={scene} room={room}>
              <Poster box={pinned ? poster : undefined} file={first} />
            </Studio>
            {pinned ? <Laptop box={laptop} /> : null}
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
          <div ref={dash} className="invisible absolute left-0 top-0 origin-top-left overflow-hidden">
            {dashboard}
          </div>
        ) : null}
        {/* The app's far edge falls into the night once it has moved aside. */}
        {pinned ? <div ref={edge} aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[16vw] bg-gradient-to-r from-transparent to-[rgb(var(--mk-ground-night))] opacity-0" /> : null}
        {/* The tour. In the scene it is the stage's last frame, centred on the room below the bar; in flow it is the section after the studio. */}
        <div className={cn(pinned ? "pointer-events-none absolute inset-0 flex items-center pt-nav" : "py-16 md:py-section")}>
          <div className={cn(measure, "grid items-center gap-10 lg:grid-cols-12 lg:gap-12 xl:gap-16")}>
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
              />
            </div>
            <div ref={slot} className="min-w-0 lg:col-span-8">
              {/* In flow the app shows at a size a phone can read: its left part, edge to edge in the column. */}
              {pinned ? null : (
                <div className="relative aspect-[4/3] overflow-hidden rounded-frame shadow-glass">
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
