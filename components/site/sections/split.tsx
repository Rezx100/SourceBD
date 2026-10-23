"use client";

// The home page's two split sections, mercury.com's "Get started fast" and "Stop losing money to fees" (the founder's
// walkthrough of 23 Oct 2026, measured at 1440): the headline at the top of the text column, the list at its foot, and
// a tall picture beside them that changes with the open item (496 × 620 with the text first, 480 × 600 with the
// picture first). The list is the tour's (`TourList`'s look): hairlines, the open item with a dot, its rule filling,
// its line and its link. It never holds the scroll: an item opens when it is clicked, or after `motion.featureMs`
// while the section is in view. The pictures are drawn, not the product (`visuals.tsx`), as mercury.com's are, and
// move only while their item is open and on screen. A click on the picture, or its pause button (drawn when the
// keyboard reaches it, as everywhere on the site), stops both the list and the picture (WCAG 2.2.2).

import { useEffect, useRef, useState, type ReactNode } from "react";
import { stillPreferred, useInView } from "@/components/site/motion";
import { motion, type HomeGround } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { PauseButton, pauseOnClick } from "./browser";
import { Disclosure } from "./tour";
import { TextLink, column, ring } from "./ui";
import { Visual, type VisualName } from "./visuals";

export type SplitItem = { title: string; body: string; link?: readonly [string, string]; visual: VisualName };

export function Split({ id, tone, heading, items, flip = false }: { id: string; tone: HomeGround; heading: ReactNode; items: readonly SplitItem[]; flip?: boolean }) {
  const box = useRef<HTMLElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [on, setOn] = useState(0);
  const [paused, setPaused] = useState(false);
  const toggle = () => setPaused((v) => !v);
  const seen = useInView(box, 0.4);
  // The open item's rule fills over its time; then the next opens. Paused, the rule stays where it stood.
  useEffect(() => {
    const b = bar.current;
    if (paused) return;
    if (!seen || stillPreferred()) {
      if (b) b.style.transform = "scaleX(1)";
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / motion.featureMs);
      if (bar.current) bar.current.style.transform = `scaleX(${k})`;
      if (k >= 1) setOn((n) => (n + 1) % items.length);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, on, paused, items.length]);

  return (
    <section ref={box} data-mk-tone={tone} aria-labelledby={id} className="pb-16 pt-14 md:pb-0 md:pt-28">
      <div className={cn(column, "grid gap-10 md:grid-cols-2", flip ? "md:gap-16" : "md:gap-8")}>
        <div className={cn("flex flex-col justify-between gap-10", flip && "md:order-2")}>
          <h2 id={id} className="max-w-[480px] font-display text-xl text-ink [text-wrap:balance] md:text-site-lead">
            {heading}
          </h2>
          <ol className="flex flex-col">
            {items.map((t, i) => {
              const open = i === on;
              return (
                <li key={t.title} className="relative border-t border-line">
                  {open ? <span ref={bar} aria-hidden className="absolute -top-px left-0 h-px w-full origin-left scale-x-0 bg-ink" /> : null}
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`${id}-${i}`}
                    onClick={() => setOn(i)}
                    className={cn("relative flex min-h-11 w-full items-center text-left font-display text-site-item transition-colors duration-slow", ring, open ? "text-ink" : "text-ink-2 hover:text-ink")}
                  >
                    {open ? <span aria-hidden className="absolute -left-3.5 top-1/2 size-1 -translate-y-1/2 rounded-full bg-ink" /> : null}
                    {t.title}
                  </button>
                  <Disclosure id={`${id}-${i}`} open={open} className="flex flex-col items-start gap-2 pb-4">
                    <p className="max-w-[464px] text-site-item text-ink-2">{t.body}</p>
                    {t.link ? (
                      <TextLink href={t.link[1]} className="min-h-8 font-normal text-site-item text-ink">
                        {t.link[0]}
                      </TextLink>
                    ) : null}
                  </Disclosure>
                </li>
              );
            })}
          </ol>
        </div>
        <div className={cn("relative aspect-[496/620] overflow-hidden rounded-frame bg-sunken", flip && "md:order-1 md:aspect-[480/600]")} onClick={pauseOnClick(toggle)}>
          {items.map((t, i) => (
            <Visual key={t.title} name={t.visual} active={i === on} playing={i === on && seen && !paused} />
          ))}
          <PauseButton paused={paused} onToggle={toggle} label="Pause animation" />
        </div>
      </div>
    </section>
  );
}

/** Get started fast, and never stop moving: the first split, its picture beside the list. */
export const START: readonly SplitItem[] = [
  { title: "Start free in a minute", body: "Sign up with your work email. No card and no contract while we are in beta.", visual: "beam" },
  { title: "Search every verified supplier", body: "By product, certificate, district or size. Every row shows the certificates it holds today.", link: ["Explore supplier search", "/product/search"], visual: "search" },
  { title: "Send one RFQ to up to 50", body: "Write it once, review every supplier before it goes, and read the quotes side by side.", link: ["Explore RFQs", "/product/rfqs"], visual: "fan" },
];

/** Stop paying for leads: the second split, its picture first. The three promises (`never.tsx`'s), as items. */
export const PROMISES: readonly SplitItem[] = [
  { title: "No fact without its source", body: "Every row names the register, the number it was filed under and the day we read it.", link: ["How we check", "/methodology"], visual: "globe" },
  { title: "No scores, grades or stars", body: "We show what the registers say and when we read them. You decide what it means.", visual: "seal" },
  { title: "No paid placement", body: "No supplier pays to be listed or to rank higher. A supplier is in your results because it matches your search.", link: ["See what is free", "/pricing"], visual: "stack" },
];
