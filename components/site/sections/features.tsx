"use client";

// The two ways the marketing site shows features (the founder's second video, 22 Oct 2026, after mercury.com's), both
// on the product panel (`.mk-panel`, app/ds.css) with a part of the real app standing on it:
//
// `FeatureTour`: a short list on the left, the open item's picture on the right. It never holds the scroll: an item
// opens when it is clicked, or after `motion.featureMs` while the section is in view, its line filling as it waits.
// The panel keeps one shape and every picture sits in it stacked, crossfading, so nothing moves.
//
// `FeatureGrid`: a heading and four cards, two by two; the first card's picture plays, the other three stand still.

import { useRef, useState, type ReactNode } from "react";
import { stillPreferred, useInView } from "@/components/site/motion";
import { cn } from "@/lib/utils";
import { H2, TextLink, measure, ring } from "./ui";

export type Feature = { title: string; body: string; link?: readonly [string, string]; picture: ReactNode };

export function FeatureTour({ id, heading, items, flip = false }: { id: string; heading: ReactNode; items: readonly Feature[]; flip?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const seen = useInView(box, 0.4);
  const [on, setOn] = useState(0);
  const moving = seen && !stillPreferred();
  return (
    <section aria-labelledby={id} className="py-16 md:py-section">
      <div ref={box} className={cn(measure, "grid items-center gap-10 lg:grid-cols-12 lg:gap-16")}>
        <div className={cn("flex flex-col gap-8 lg:col-span-4", flip && "lg:order-2")}>
          <H2 id={id} className="md:text-site-h3">
            {heading}
          </H2>
          <ol className="flex flex-col border-t border-line">
            {items.map((f, i) => {
              const open = i === on;
              return (
                <li key={f.title} className="relative border-b border-line">
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`${id}-${i}`}
                    onClick={() => setOn(i)}
                    className={cn("flex min-h-14 w-full items-center text-left text-site-title font-medium transition-colors", ring, open ? "text-ink-strong" : "text-ink-subtle hover:text-ink-strong")}
                  >
                    {f.title}
                  </button>
                  <div id={`${id}-${i}`} hidden={!open} className={cn("flex-col gap-3 pb-5", open ? "flex" : "hidden")}>
                    <p className="text-site-body text-ink-muted">{f.body}</p>
                    {f.link ? (
                      <TextLink href={f.link[1]} className="min-h-8">
                        {f.link[0]}
                      </TextLink>
                    ) : null}
                  </div>
                  {/* The open item's wait, filling; at its end the next item opens. Keyed so it starts again each time. */}
                  {open && moving ? (
                    <span key={on} aria-hidden onAnimationEnd={() => setOn((n) => (n + 1) % items.length)} className="absolute -bottom-px left-0 h-0.5 w-full origin-left animate-progress bg-ink-strong" />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
        <div className={cn("min-w-0 lg:col-span-8", flip && "lg:order-1")}>
          <div className="mk-panel relative aspect-[4/3] overflow-hidden rounded-card md:aspect-[16/11] md:rounded-stage">
            {items.map((f, i) => (
              <div key={f.title} aria-hidden={i !== on} className={cn("absolute inset-0 flex items-center justify-center p-5 transition-opacity duration-slow ease-out motion-reduce:transition-none md:p-12", i === on ? "opacity-100" : "pointer-events-none opacity-0")}>
                <div className="w-full max-w-[680px]">{f.picture}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FeatureGrid({ id, heading, items }: { id: string; heading: ReactNode; items: readonly Feature[] }) {
  return (
    <section aria-labelledby={id} className="py-16 md:py-section">
      <div className={cn(measure, "flex flex-col gap-10 md:gap-14")}>
        <H2 id={id} className="max-w-[720px]">
          {heading}
        </H2>
        <ul className="grid gap-x-8 gap-y-12 md:grid-cols-2">
          {items.map((f) => (
            <li key={f.title} className="flex flex-col gap-5">
              <div className="mk-panel flex aspect-[4/3] items-center justify-center overflow-hidden rounded-card p-6 md:aspect-[16/11] md:p-10">
                <div className="w-full">{f.picture}</div>
              </div>
              <div className="flex flex-col gap-1.5 md:pr-12">
                <h3 className="text-site-title font-medium text-ink-strong">{f.title}</h3>
                <p className="text-site-body text-ink-muted">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
