"use client";

// The product as a buyer sees it (the founder's videos, 22 Oct 2026): the real app, recorded from the admin account
// at 1440 × 900 on a 2× screen (`scripts/home-assets.mjs`, public/site/home/PROVENANCE.md), inside a desktop browser's
// window. The window has one shape everywhere, 16:10 with its bar inside, so nothing on a page moves when what plays in
// it changes; the bar is one SVG drawn to the window's width, so it reads the same at 300 px and at 1200. A recording
// plays only while it is on screen, from its first frame as a poster; reduced motion and Save-Data keep the poster.

import { Pause, Play } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { stillPreferred, useInView } from "@/components/site/motion";
import { cn } from "@/lib/utils";
import { ring } from "./ui";

/** The recordings, by name: what the address bar says and the one sentence a screen reader gets instead of the video. */
export const SCREENS = {
  find: { url: "sourcebd.net/app", says: "The search: “knit GOTS” is typed, 606 suppliers are found, and Aboni Knitwear is pointed at with its place, workers, certificates and exports." },
  check: { url: "sourcebd.net/app/discover?q=knit+GOTS", says: "Aboni Knitwear's record opens beside the results, at its exports, its checks and its two RSC buildings." },
  record: { url: "sourcebd.net/app/suppliers/aboni-knitwear", says: "Aboni Knitwear's full record, read from the top: exports, key facts, memberships, the brands it ships to, and its markets." },
  watch: { url: "sourcebd.net/app/compliance", says: "The Compliance hub: ten certificates across the saved list, expired first, each with Ask for the renewal." },
  saved: { url: "sourcebd.net/app/saved", says: "The saved list of eighteen suppliers; three are ticked and Send one RFQ appears." },
  ask: { url: "sourcebd.net/app/saved", says: "Three saved suppliers ticked, then Send one RFQ opens the request beside the list." },
} as const;

export type ScreenName = keyof typeof SCREENS;

const src = (name: ScreenName, ext: "webm" | "mp4" | "webp") => `/site/home/app-${name}.${ext}`;

/** The window's bar: three lights, the address in its field, a hairline under it. 1440 × 52 in the bar's own units. */
function Bar({ url }: { url: string }) {
  return (
    <svg viewBox="0 0 1440 52" aria-hidden className="block w-full font-sans">
      <rect width="1440" height="52" className="fill-sunken" />
      <rect y="51" width="1440" height="1" className="fill-line" />
      {[28, 50, 72].map((cx) => (
        <circle key={cx} cx={cx} cy="26" r="6.5" className="fill-line-strong/40" />
      ))}
      <rect x="420" y="12" width="600" height="28" rx="8" className="fill-surface" />
      <path d="M696 25.5v-2.6a4 4 0 0 1 8 0v2.6M694.5 25.5h11v7.5h-11z" className="fill-none stroke-ink-subtle" strokeWidth="1.5" strokeLinejoin="round" />
      <text x="712" y="31" fontSize="14" className="fill-ink-muted">
        {url}
      </text>
    </svg>
  );
}

/**
 * A browser window: the bar, then 1440 × 848 of page (the recordings are 1440 × 900; their last 52 px, empty canvas,
 * fall under the window's edge). Light inside whatever the ground around it. `children` fill the page area.
 */
export function BrowserFrame({ url, children, className }: { url: string; children: ReactNode; className?: string }) {
  return (
    <div data-ground="day" className={cn("relative isolate overflow-hidden rounded-frame bg-surface shadow-window ring-1 ring-ink/10", className)}>
      <Bar url={url} />
      <div className="relative aspect-[1440/848] overflow-hidden bg-canvas">{children}</div>
    </div>
  );
}

/** Plays `video` while `on`; reports how far through it is to `bar` (a transform, no re-render). */
function usePlayback(video: RefObject<HTMLVideoElement | null>, on: boolean, bar?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (!on) {
      v.pause();
      return;
    }
    void v.play().catch(() => undefined);
    if (!bar) return;
    let raf = 0;
    const tick = () => {
      if (bar.current && v.duration) bar.current.style.transform = `scaleX(${v.currentTime / v.duration})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [video, on, bar]);
}

/**
 * One recording filling its window's page. `active` says it is the one showing (a tour stacks several and crossfades
 * between them, so the window is never empty); `onEnded` lets the tour move on, and the video loops without it.
 * `playing` is the visitor's pause; `bar` is the open item's progress line.
 */
export function AppVideo({ name, active = true, playing = true, eager = false, onEnded, bar }: { name: ScreenName; active?: boolean; playing?: boolean; eager?: boolean; onEnded?: () => void; bar?: RefObject<HTMLElement | null> }) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const seen = useInView(box, 0.3);
  const [still, setStill] = useState(true);
  useEffect(() => setStill(stillPreferred()), []);
  // A tour's item starts from its beginning each time it opens.
  useEffect(() => {
    if (active && video.current) video.current.currentTime = 0;
  }, [active]);
  usePlayback(video, active && seen && playing && !still, active ? bar : undefined);
  return (
    <div ref={box} className={cn("absolute inset-0 transition-opacity duration-slow ease-out motion-reduce:transition-none", active ? "opacity-100" : "opacity-0")}>
      <video
        ref={video}
        aria-hidden
        tabIndex={-1}
        muted
        playsInline
        loop={!onEnded}
        preload={eager ? "auto" : "none"}
        poster={src(name, "webp")}
        onEnded={onEnded}
        className="size-full object-cover object-top"
      >
        <source src={src(name, "webm")} type="video/webm" />
        <source src={src(name, "mp4")} type="video/mp4" />
      </video>
    </div>
  );
}

/**
 * A page drawn at `width` and scaled to the window, so a coded demo sits in the browser at the app's own proportions.
 * Hidden until it is measured, so it never paints at the wrong size.
 */
export function FitPage({ children, width = 1040 }: { children: ReactNode; width?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setK(el.clientWidth / width);
    fit();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [width]);
  return (
    <div ref={box} className="absolute inset-0">
      <div className={cn("absolute left-0 top-0 origin-top-left", !k && "invisible")} style={{ width, height: (width * 848) / 1440, transform: `scale(${k})` }}>
        {children}
      </div>
    </div>
  );
}

/** The window's own pause button (WCAG 2.2.2), on the page's lower left corner, out of the recording's way. */
export function PauseButton({ paused, onToggle, label = "Pause video" }: { paused: boolean; onToggle: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={paused}
      onClick={onToggle}
      className={cn("absolute bottom-3 left-3 z-raised flex size-9 items-center justify-center rounded-full bg-ink/70 text-surface backdrop-blur-sm hover:bg-ink/85 md:bottom-4 md:left-4", ring)}
    >
      {paused ? <Play size={14} weight="fill" aria-hidden /> : <Pause size={14} weight="fill" aria-hidden />}
    </button>
  );
}

/**
 * Parts of the app cut from the recordings (`scripts/home-assets.mjs` CROPS, public/site/home/crop-<name>.webp at 2×):
 * one value point alone, as a card. The sizes here are the cuts' own, in the page's 1440 × 900 units.
 */
const CUTS = { exports: [872, 226], memberships: [872, 228], buyers: [872, 318], shipments: [872, 420], attention: [810, 510], uflpa: [352, 216] } as const;

export type CutName = keyof typeof CUTS;

export function Cut({ name, className }: { name: CutName; className?: string }) {
  const [w, h] = CUTS[name];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-cut at 2× in public/site/home (PROVENANCE.md), no optimizer pass
    <img src={`/site/home/crop-${name}.webp`} alt="" width={w} height={h} loading="lazy" decoding="async" className={cn("block h-auto w-full rounded-frame bg-surface shadow-window ring-1 ring-ink/10", className)} />
  );
}

/** A part of a recording, playing: the box `[x, y, w, h]` of the 1440 × 900 page, with its own pause button. */
export function LiveCut({ name, box: [x, y, w, h], className }: { name: ScreenName; box: readonly [number, number, number, number]; className?: string }) {
  const [paused, setPaused] = useState(false);
  return (
    <div data-ground="day" className={cn("relative overflow-hidden rounded-frame bg-surface shadow-window ring-1 ring-ink/10", className)} style={{ aspectRatio: `${w} / ${h}` }}>
      <div className="absolute aspect-[1440/900]" style={{ width: `${(1440 / w) * 100}%`, left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%` }}>
        <AppVideo name={name} playing={!paused} />
      </div>
      <PauseButton paused={paused} onToggle={() => setPaused((p) => !p)} />
    </div>
  );
}

/** A recording in its window, with its pause button and its sentence for a screen reader. */
export function Screen({ name, className, eager = false }: { name: ScreenName; className?: string; eager?: boolean }) {
  const [paused, setPaused] = useState(false);
  return (
    <figure className={className}>
      <figcaption className="sr-only">{SCREENS[name].says}</figcaption>
      <BrowserFrame url={SCREENS[name].url}>
        <AppVideo name={name} eager={eager} playing={!paused} />
        <PauseButton paused={paused} onToggle={() => setPaused((p) => !p)} />
      </BrowserFrame>
    </figure>
  );
}
