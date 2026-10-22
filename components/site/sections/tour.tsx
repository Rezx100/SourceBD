"use client";

// The tour (the founder's videos of 22 Oct 2026, after mercury.com's): what a buyer does, listed on the left, the real
// app doing it on the right in its browser window. It never holds the scroll. An item opens when it is clicked, or
// when the one before it has played to its end; a coded demo (an item with no recording) holds for twice
// `motion.featureMs`. The window keeps one shape, so nothing on the page moves when the item changes, and the
// recordings sit stacked in it and crossfade, so it is never empty. The home page's opening draws the same list and
// window inside its zoom (opening.tsx); the solutions pages draw `Tour`.

import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode, type RefObject } from "react";
import type { Frame } from "@/components/site/demos/stage";
import { stillPreferred, useInView } from "@/components/site/motion";
import { motion } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { AppVideo, BrowserFrame, PauseButton, SCREENS, type ScreenName } from "./browser";
import { HomeIcon, type IconName } from "./icons";
import { TextLink, measure, ring } from "./ui";

export type TourItem = { key: string; icon: IconName; title: string; body: string; href: string; screen?: ScreenName; Demo?: ComponentType<Frame> };

export const TOUR: readonly TourItem[] = [
  { key: "find", icon: "search", title: "Find", body: "Search every verified garment supplier in Bangladesh by product, certificate or district.", href: "/product/search", screen: "find" },
  { key: "check", icon: "receipt", title: "Check", body: "Open a supplier beside your results: certificates, inspections, exports and buyers, each with its source.", href: "/product/records", screen: "check" },
  { key: "ask", icon: "send", title: "Ask", body: "Shortlist the ones you like and send one RFQ to up to 50 of them. Quotes come back side by side.", href: "/product/rfqs", screen: "ask" },
  { key: "watch", icon: "bell", title: "Watch", body: "We keep checking certificates and forced-labour lists across your saved suppliers and tell you what changed.", href: "/product/compliance", screen: "watch" },
];

/** The heading and the items; the open one shows its line, its link and a 2 px line of how far it has played. */
export function TourList({ id, heading, items, active, onPick, bar, extra }: { id?: string; heading: ReactNode; items: readonly TourItem[]; active: number; onPick: (i: number) => void; bar: RefObject<HTMLSpanElement | null>; extra?: (item: TourItem) => ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      <h2 id={id} className="text-xl text-ink [text-wrap:balance] md:text-site-h3">
        {heading}
      </h2>
      <ol className="flex flex-col border-t border-line">
        {items.map((t, i) => {
          const on = i === active;
          return (
            <li key={t.key} className="relative border-b border-line">
              <button
                type="button"
                aria-expanded={on}
                aria-controls={`tour-${t.key}`}
                onClick={() => onPick(i)}
                className={cn("flex min-h-14 w-full items-center gap-3 text-left text-site-title font-medium transition-colors", ring, on ? "text-ink" : "text-ink-2 hover:text-ink")}
              >
                <HomeIcon name={t.icon} size={20} className={on ? "text-ink" : "text-ink-2"} />
                {t.title}
              </button>
              <div id={`tour-${t.key}`} hidden={!on} className={cn("flex-col gap-3 pb-5 pl-8", on ? "flex" : "hidden")}>
                <p className="text-site-body text-ink-2">{t.body}</p>
                {extra?.(t)}
                <TextLink href={t.href} className="min-h-8 text-ink">
                  See how
                </TextLink>
              </div>
              {on ? <span ref={bar} aria-hidden className="absolute -bottom-px left-0 h-0.5 w-full origin-left scale-x-0 bg-ink" /> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * The open item in its window: the recordings stacked and crossfading, or the open item's coded demo. `playing` is
 * false while the home's opening is still zooming, so nothing advances before the tour is in place.
 */
export function TourWindow({ items, active, playing, onEnded, bar }: { items: readonly TourItem[]; active: number; playing: boolean; onEnded: () => void; bar: RefObject<HTMLSpanElement | null> }) {
  const [paused, setPaused] = useState(false);
  const open = items[active]!;
  if (!open.screen && open.Demo) return <open.Demo stage="night" />;
  return (
    <figure className="relative">
      <figcaption className="sr-only">{open.screen ? SCREENS[open.screen].says : open.body}</figcaption>
      <BrowserFrame url={SCREENS[open.screen ?? "find"].url}>
        {items.map((t, i) => (t.screen ? <AppVideo key={t.key} name={t.screen} active={i === active} playing={playing && !paused} eager={i === 0} onEnded={onEnded} bar={bar} /> : null))}
        <PauseButton paused={paused} onToggle={() => setPaused((v) => !v)} />
      </BrowserFrame>
    </figure>
  );
}

/** The tour's open item and its moving on: by the recording's end, or by time for a coded demo while it is in view. */
export function useTour(count: number, items: readonly TourItem[], box: RefObject<Element | null>) {
  const [active, setActive] = useState(0);
  const next = useCallback(() => setActive((a) => (a + 1) % count), [count]);
  const seen = useInView(box, 0.4);
  const coded = !items[active]?.screen;
  useEffect(() => {
    if (!coded || !seen || stillPreferred()) return;
    const t = window.setTimeout(next, motion.featureMs * 2);
    return () => window.clearTimeout(t);
  }, [coded, seen, next, active]);
  return { active, setActive, next };
}

/** A tour as its own section on the night ground (the solutions pages). */
export function Tour({ id, heading, items = TOUR }: { id: string; heading: ReactNode; items?: readonly TourItem[] }) {
  const box = useRef<HTMLElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const { active, setActive, next } = useTour(items.length, items, box);
  return (
    <section ref={box} data-tone="dark" aria-labelledby={id} className="py-16 md:py-section">
      <div className={cn(measure, "grid items-center gap-10 lg:grid-cols-12 lg:gap-12 xl:gap-16")}>
        <div className="min-w-0 lg:col-span-4">
          <TourList id={id} heading={heading} items={items} active={active} onPick={setActive} bar={bar} />
        </div>
        <div className="min-w-0 lg:col-span-8">
          <TourWindow items={items} active={active} playing onEnded={next} bar={bar} />
        </div>
      </div>
    </section>
  );
}
