"use client";

// The product as a buyer sees it (the founder's videos, 22 Oct 2026): the real app, recorded from the admin account
// at 1440 × 900 (`scripts/home-assets.mjs`, public/site/home/PROVENANCE.md), and the parts of it the sections show,
// composed in code from real captures (`Clip`). A video plays only while it is on screen, from its first frame as a
// poster; reduced motion and Save-Data keep the poster. There is no visible pause button (founder's video 3): a click
// or a tap on a playing picture pauses it, and its pause button appears when the keyboard reaches it (WCAG 2.2.2).

import { Pause, Play } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import { stillPreferred, useInView } from "@/components/site/motion";
import { cn } from "@/lib/utils";
import { ring } from "./ui";

/** The tour's recordings, by name: what the address bar says and the one sentence a screen reader gets instead. */
export const SCREENS = {
  find: { url: "sourcebd.net/app", says: "The search: “knit GOTS” is typed, 606 suppliers are found and listed one by one, and Aboni Knitwear is pointed at with its place, workers, certificates and exports." },
  check: { url: "sourcebd.net/app/discover?q=knit+GOTS", says: "Aboni Knitwear's record opens beside the results, at its exports, its checks and its two RSC buildings." },
  watch: { url: "sourcebd.net/app/compliance", says: "The Compliance hub: ten certificates across the saved list, expired first, each with Ask for the renewal." },
  ask: { url: "sourcebd.net/app/saved", says: "Three saved suppliers ticked, then Send one RFQ opens the request beside the list." },
} as const;

export type ScreenName = keyof typeof SCREENS;

/**
 * A screen whose picture is composed in code from real captures rather than the raw recording: the search is the
 * opening's dashboard (the founder's review of 22 Oct 14:18: it must come alive, as mercury.com's does), a HyperFrames
 * composition of frames of the same recording (PROVENANCE.md).
 */
const COMPOSED: Partial<Record<ScreenName, string>> = { find: "clip-find" };

/** The file a screen plays from (`/site/home/<file>.webm|mp4`, its first frame `<file>.webp`). */
export const screenFile = (name: ScreenName): string => COMPOSED[name] ?? `app-${name}`;

/**
 * The ledger of app moments (founder's video 3: "do not repeat any dashboard image"): every video the home page plays,
 * by file, and the one moment of the app it shows. `sections/page.test.ts` fails when two sections show one moment.
 */
export const LEDGER: Record<string, string> = {
  "clip-find": "search: knit GOTS typed, the results",
  "clip-light-search": "the search page in the light theme, held still in the laptop",
  "clip-dark-search": "dark: knit GOTS from the recent searches, the results, Benchmark Apparels' record",
  "clip-dark-record": "dark: Aboni Knitwear's export figures, its shipments, the saved list",
  "clip-dark-rfq": "dark: three saved suppliers ticked, one RFQ written for all three",
  "clip-dark-sort": "dark: woven shirt WRAP results coming into focus, sorted by supplier",
  "app-check": "a record opened beside the results",
  "app-ask": "saved list: three ticked, the request opens",
  "app-watch": "compliance hub: certificates that need attention",
  "clip-filters": "search: the Certificates menu, ticks narrowing the list",
  "clip-buyers": "record: Buyers",
  "clip-shipments": "record: markets and latest shipments",
  "clip-certificates": "record: Certificates",
  "clip-record": "record: header and export figures",
  "clip-keyfacts": "record: Key facts",
  "clip-memberships": "record: Memberships",
  "clip-safety": "record: Safety (RSC)",
  "clip-sources": "record: Sources",
  "still-sanctions": "compliance hub, dark, phone width: the four checks, sanctions among them",
  "still-uflpa": "UFLPA checks, dark, phone width: results and suppliers",
  "still-locked": "record, dark, phone width: contact details locked",
};

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
  // A bare name is home's (`/site/home/<file>`); an inner page's pictures are its own folder's, by full path.
  const src = file.startsWith("/") ? file : `/site/home/${file}`;
  return (
    <div ref={box} className={cn("absolute inset-0 transition-opacity duration-slow ease-out motion-reduce:transition-none", active ? "opacity-100" : "opacity-0", className)}>
      <video ref={video} aria-hidden tabIndex={-1} muted playsInline loop={!onEnded} preload={eager ? "auto" : "none"} poster={`${src}.webp`} onEnded={onEnded} className="size-full object-cover object-top">
        <source src={`${src}.webm`} type="video/webm" />
        <source src={`${src}.mp4`} type="video/mp4" />
      </video>
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
 * the sentence a screen reader gets in its place. `name` is home's clip (`clip-<name>`) or an inner page's by its full
 * path (`/site/<page>/clip-<name>`).
 */
export function Clip({ name, says, active = true, delay, onEnded, bar, className }: { name: string; says: string; active?: boolean; delay?: number; onEnded?: () => void; bar?: RefObject<HTMLElement | null>; className?: string }) {
  const [paused, setPaused] = useState(false);
  const toggle = () => setPaused((p) => !p);
  return (
    <figure className={cn("absolute inset-0 m-0 transition-opacity duration-slow ease-out motion-reduce:transition-none", active ? "opacity-100" : "pointer-events-none opacity-0", className)} onClick={pauseOnClick(toggle)}>
      <figcaption className="sr-only">{says}</figcaption>
      <Video file={name.startsWith("/") ? name : `clip-${name}`} active={active} playing={!paused} delay={delay} onEnded={onEnded} bar={bar} />
      {active ? <PauseButton paused={paused} onToggle={toggle} /> : null}
    </figure>
  );
}

/**
 * A part of the real app held still (`still-<name>.webp`, PROVENANCE.md): the app in its dark theme at its own pixels,
 * one window from the card's top left running off its far edges, sharp where it reads and falling into a blur and the
 * card's ground (founder's recording of 24 Oct 2026: dark, and at least 70% of the card). It fills its parent, a 4:5
 * card; `says` is the sentence a screen reader gets in its place.
 */
export function AppStill({ name, says, className }: { name: string; says: string; className?: string }) {
  return (
    <figure className={cn("absolute inset-0 m-0", className)}>
      <figcaption className="sr-only">{says}</figcaption>
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized in public/site/home (PROVENANCE.md), no optimizer pass */}
      <img src={`/site/home/still-${name}.webp`} alt="" width={640} height={800} loading="lazy" decoding="async" className="size-full object-cover object-left-top" />
    </figure>
  );
}
