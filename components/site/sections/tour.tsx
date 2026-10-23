"use client";

// The tour (the founder's videos of 22 Oct 2026, after mercury.com's): what a buyer does, listed on the left, the real
// app doing it on the right (on the home page the opening's own app, without a window; on the solutions pages in its
// browser window). It never holds the scroll. An item opens when it is clicked, or
// when the one before it has played to its end; a coded demo (an item with no recording) holds for twice
// `motion.featureMs`. The window keeps one shape, so nothing on the page moves when the item changes, and the
// recordings sit stacked in it and crossfade, so it is never empty. The home page's opening draws the same list and
// window inside its zoom (opening.tsx); the solutions pages draw `Tour`.
//
// Since the founder's recording of 22 Oct 13:17 ("the sections must be animated, like this one" of mercury.com) an item
// opens with motion: its line grows from nothing to its height while its words rise in, and the one closing folds the
// same way (`Disclosure`). A closed item's words are inert and hidden from assistive technology; the server draws the
// first item open, so the list reads complete with no script.

import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode, type RefObject } from "react";
import type { Frame } from "@/components/site/demos/stage";
import { stillPreferred, useInView } from "@/components/site/motion";
import { motion } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { AppVideo, BrowserFrame, PauseButton, SCREENS, pauseOnClick, type ScreenName } from "./browser";
import type { IconName } from "./icons";
import { TextLink, measure, ring } from "./ui";

export type TourItem = { key: string; icon: IconName; title: string; body: string; href: string; screen?: ScreenName; Demo?: ComponentType<Frame> };

export const TOUR: readonly TourItem[] = [
  { key: "find", icon: "search", title: "Supplier search", body: "Search every verified garment supplier in Bangladesh by product, certificate or district.", href: "/product/search", screen: "find" },
  { key: "check", icon: "receipt", title: "Records you can check", body: "Open a supplier beside your results: certificates, inspections, exports and buyers, each with its source.", href: "/product/records", screen: "check" },
  { key: "ask", icon: "send", title: "RFQs and quotes", body: "Shortlist the ones you like and send one RFQ to up to 50 of them. Quotes come back side by side.", href: "/product/rfqs", screen: "ask" },
  { key: "watch", icon: "bell", title: "Compliance alerts", body: "We keep checking certificates and forced-labour lists across your saved suppliers and tell you what changed.", href: "/product/compliance", screen: "watch" },
];

/**
 * An item's words under its title: a grid row that grows from 0 to its content's height (320 ms) while the words rise
 * in, and folds back the same way. Closed, it is inert and hidden from assistive technology; reduced motion cuts.
 */
export function Disclosure({ id, open, className, children }: { id: string; open: boolean; className?: string; children: ReactNode }) {
  return (
    <div id={id} inert={!open} aria-hidden={!open} className={cn("grid transition-[grid-template-rows] duration-slow ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
      <div className="min-h-0 overflow-hidden">
        <div className={cn("transition-[opacity,transform] duration-slow ease-out motion-reduce:transition-none", open ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0", className)}>{children}</div>
      </div>
    </div>
  );
}

/**
 * The heading and the items, mercury.com's since the founder's walkthrough of 23 Oct 2026: a two-line headline, then
 * the items under hairlines, the open one with a dot, its rule drawn in the ink and its line under its name; one link
 * under the list (`more`). The rule over the open item fills as its recording plays (`bar`).
 */
export function TourList({ id, heading, items, active, onPick, bar, more }: { id?: string; heading: ReactNode; items: readonly TourItem[]; active: number; onPick: (i: number) => void; bar?: RefObject<HTMLSpanElement | null>; more?: readonly [string, string] }) {
  return (
    <div className="flex flex-col">
      <h2 id={id} className="max-w-[440px] font-display text-xl text-ink md:text-site-lead">
        {heading}
      </h2>
      <ol className="mt-10 flex flex-col md:mt-16">
        {items.map((t, i) => {
          const on = i === active;
          return (
            <li key={t.key} className="relative border-t border-line">
              {on ? <span ref={bar} aria-hidden className="absolute -top-px left-0 h-px w-full origin-left scale-x-0 bg-ink" /> : null}
              <button
                type="button"
                aria-expanded={on}
                aria-controls={`tour-${t.key}`}
                onClick={() => onPick(i)}
                className={cn("relative flex min-h-11 w-full items-center text-left font-display text-site-item transition-colors duration-slow", ring, on ? "text-ink" : "text-ink-2 hover:text-ink")}
              >
                {on ? <span aria-hidden className="absolute -left-3.5 top-1/2 size-1 -translate-y-1/2 rounded-full bg-ink" /> : null}
                {t.title}
              </button>
              <Disclosure id={`tour-${t.key}`} open={on} className="pb-4">
                <p className="max-w-[432px] text-site-item text-ink-2">{t.body}</p>
              </Disclosure>
            </li>
          );
        })}
      </ol>
      {more ? (
        <TextLink href={more[1]} className="mt-4 w-fit font-display text-site-item text-ink">
          {more[0]}
        </TextLink>
      ) : null}
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
    <figure className="relative" onClick={pauseOnClick(() => setPaused((v) => !v))}>
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
