"use client";

// The product as a buyer sees it (the founder's videos, 22 Oct 2026): the real app, recorded from the admin account
// at 1440 × 900 (`scripts/home-assets.mjs`, public/site/home/PROVENANCE.md), and the parts of it the sections show,
// composed in code from real captures (`Clip`). A video plays only while it is on screen, from its first frame as a
// poster; reduced motion and Save-Data keep the poster. There is no visible pause button (founder's video 3): a click
// or a tap on a playing picture pauses it, and its pause button appears when the keyboard reaches it (WCAG 2.2.2).

import { Pause, Play } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import { stillPreferred, useInView } from "@/components/site/motion";
import { cn } from "@/lib/utils";
import { ring } from "./ui";

/** The tour's recordings, by name: what the address bar says and the one sentence a screen reader gets instead. */
export const SCREENS = {
  find: { url: "sourcebd.net/app", says: "The search: “knit GOTS” is typed, 606 suppliers are found, and Aboni Knitwear is pointed at with its place, workers, certificates and exports." },
  check: { url: "sourcebd.net/app/discover?q=knit+GOTS", says: "Aboni Knitwear's record opens beside the results, at its exports, its checks and its two RSC buildings." },
  watch: { url: "sourcebd.net/app/compliance", says: "The Compliance hub: ten certificates across the saved list, expired first, each with Ask for the renewal." },
  ask: { url: "sourcebd.net/app/saved", says: "Three saved suppliers ticked, then Send one RFQ opens the request beside the list." },
} as const;

export type ScreenName = keyof typeof SCREENS;

/** The file a screen plays from (`/site/home/<file>.webm|mp4`, its first frame `<file>.webp`). */
export const screenFile = (name: ScreenName): string => `app-${name}`;

/**
 * The ledger of app moments (founder's video 3: "do not repeat any dashboard image"): every video the home page plays,
 * by file, and the one moment of the app it shows. `sections/page.test.ts` fails when two sections show one moment.
 */
export const LEDGER: Record<string, string> = {
  "app-find": "search: knit GOTS typed, the results",
  "app-check": "a record opened beside the results",
  "app-ask": "saved list: three ticked, the request opens",
  "app-watch": "compliance hub: certificates that need attention",
  "clip-filters": "search: the Certificates menu, ticks narrowing the list",
  "clip-buyers": "record: Buyers",
  "clip-shipments": "record: markets and latest shipments",
  "clip-certificates": "record: Certificates",
  "clip-record": "record: header and export figures",
  "clip-real-mondol": "public page: Mondol Fabrics",
  "clip-real-aboni": "public page: Aboni Knitwear",
  "clip-real-liberty": "public page: Liberty Knitwear",
  "clip-keyfacts": "record: Key facts",
  "clip-memberships": "record: Memberships",
  "clip-safety": "record: Safety (RSC)",
  "clip-sources": "record: Sources",
  "still-sanctions": "record: sanctions lists",
  "still-uflpa": "compliance hub: UFLPA checks",
  "still-locked": "public page: contact details locked",
};

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
 * A browser window: the bar, then 1440 × 848 of page. Light inside whatever the ground around it; a glass edge (a lit
 * top line and a faint close shadow), never a dark drop (founder's recording of 22 Oct 13:17) and no hairline round it
 * (his video 3). `children` fill the page area.
 */
export function BrowserFrame({ url, children, className }: { url: string; children: ReactNode; className?: string }) {
  return (
    <div data-ground="day" className={cn("relative isolate overflow-hidden rounded-frame bg-surface shadow-glass", className)}>
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
 * A video of the site (`/site/home/<file>.webm|mp4`, its first frame `<file>.webp` as the poster), filling its parent.
 * `active` says it is the one showing (a list stacks several and crossfades, so the place is never empty); `onEnded`
 * lets the list move on, and it loops without it. `delay` holds its start (ms) the first time it comes into view, so a
 * grid of them does not move all at once. `playing` is the visitor's pause; `bar` the open item's progress line.
 * `restart` rewinds it to its first frame (the home's opening covers the recordings with that frame while its scene
 * moves, so the frame under the cover is the one that plays next).
 */
export function Video({ file, active = true, playing = true, eager = false, delay = 0, restart = false, onEnded, bar, className }: { file: string; active?: boolean; playing?: boolean; eager?: boolean; delay?: number; restart?: boolean; onEnded?: () => void; bar?: RefObject<HTMLElement | null>; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const seen = useInView(box, 0.3);
  const [still, setStill] = useState(true);
  const [held, setHeld] = useState(delay > 0);
  useEffect(() => setStill(stillPreferred()), []);
  useEffect(() => {
    if (!held || !seen) return;
    const t = window.setTimeout(() => setHeld(false), delay);
    return () => window.clearTimeout(t);
  }, [held, seen, delay]);
  // An item of a list starts from its beginning each time it opens.
  useEffect(() => {
    if (active && video.current) video.current.currentTime = 0;
  }, [active]);
  useEffect(() => {
    if (restart && video.current) video.current.currentTime = 0;
  }, [restart]);
  usePlayback(video, active && seen && playing && !still && !held, active ? bar : undefined);
  const src = `/site/home/${file}`;
  return (
    <div ref={box} className={cn("absolute inset-0 transition-opacity duration-slow ease-out motion-reduce:transition-none", active ? "opacity-100" : "opacity-0", className)}>
      <video ref={video} aria-hidden tabIndex={-1} muted playsInline loop={!onEnded} preload={eager ? "auto" : "none"} poster={`${src}.webp`} onEnded={onEnded} className="size-full object-cover object-top">
        <source src={`${src}.webm`} type="video/webm" />
        <source src={`${src}.mp4`} type="video/mp4" />
      </video>
    </div>
  );
}

/** One of the tour's recordings of the real app (`screenFile`). */
export function AppVideo({ name, ...rest }: { name: ScreenName } & Omit<Parameters<typeof Video>[0], "file">) {
  return <Video file={screenFile(name)} {...rest} />;
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

/**
 * The pause control of anything that plays (WCAG 2.2.2). Not drawn until the keyboard reaches it (founder's video 3:
 * no pause or play button on the marketing site); a pointer pauses by clicking the picture itself (`pauseOnClick`).
 */
export function PauseButton({ paused, onToggle, label = "Pause video" }: { paused: boolean; onToggle: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={paused}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn("absolute bottom-3 left-3 z-raised flex size-9 items-center justify-center rounded-full bg-ink/70 text-surface opacity-0 backdrop-blur-sm focus-visible:opacity-100 md:bottom-4 md:left-4", ring)}
    >
      {paused ? <Play size={14} weight="fill" aria-hidden /> : <Pause size={14} weight="fill" aria-hidden />}
    </button>
  );
}

/** A click handler for a playing picture: a click pauses it or plays it again, unless it landed on a link. */
export const pauseOnClick = (toggle: () => void) => (e: MouseEvent) => {
  if (!(e.target as HTMLElement).closest("a")) toggle();
};

/**
 * A part of the real app composed in code from a real capture and played (`clip-<name>`, PROVENANCE.md): it fills its
 * parent, which is its card or its panel, edge to edge (founder's video 3: "full card, not like this size"). `says` is
 * the sentence a screen reader gets in its place.
 */
export function Clip({ name, says, active = true, delay, onEnded, bar, className }: { name: string; says: string; active?: boolean; delay?: number; onEnded?: () => void; bar?: RefObject<HTMLElement | null>; className?: string }) {
  const [paused, setPaused] = useState(false);
  const toggle = () => setPaused((p) => !p);
  return (
    <figure className={cn("absolute inset-0 m-0 transition-opacity duration-slow ease-out motion-reduce:transition-none", active ? "opacity-100" : "pointer-events-none opacity-0", className)} onClick={pauseOnClick(toggle)}>
      <figcaption className="sr-only">{says}</figcaption>
      <Video file={`clip-${name}`} active={active} playing={!paused} delay={delay} onEnded={onEnded} bar={bar} />
      {active ? <PauseButton paused={paused} onToggle={toggle} /> : null}
    </figure>
  );
}

/**
 * A part of the real app held still (`still-<name>.webp`, PROVENANCE.md): one panel cut from a real capture on the night
 * ground with a glass edge, the page round it hidden (founder's recording of 22 Oct 13:17: Buy with confidence needs no
 * animation). It fills its parent; `says` is the sentence a screen reader gets in its place.
 */
export function AppStill({ name, says, className }: { name: string; says: string; className?: string }) {
  return (
    <figure className={cn("absolute inset-0 m-0", className)}>
      <figcaption className="sr-only">{says}</figcaption>
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized in public/site/home (PROVENANCE.md), no optimizer pass */}
      <img src={`/site/home/still-${name}.webp`} alt="" width={1200} height={900} loading="lazy" decoding="async" className="size-full object-cover" />
    </figure>
  );
}
