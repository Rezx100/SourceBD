"use client";

// The two ways the home page shows features (the founder's videos of 22 Oct 2026, after mercury.com's). Each feature is
// a part of the real app composed in code from a real capture (`Clip`, sections/browser.tsx), filling its panel or its
// card edge to edge, with no hairline round it.
//
// `FeatureTour`: a short list on the left, the open item's clip on the right. It never holds the scroll: an item opens
// when it is clicked, or when the one before it has played to its end, its line filling as it plays. The panel keeps
// one shape and the clips sit in it stacked, crossfading, so nothing moves.
//
// `FeatureGrid`: a heading and four cards, two by two, each card its clip's frame; the four start two seconds apart so
// only one moves strongly at a time.

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Clip } from "./browser";
import { H2, TextLink, measure, ring } from "./ui";

/** A feature: its words, and its clip (`clip-<clip>`) with the sentence a screen reader gets in its place. */
export type Feature = { title: string; body: string; link?: readonly [string, string]; clip: string; says: string };

export function FeatureTour({ id, heading, items }: { id: string; heading: ReactNode; items: readonly Feature[] }) {
  const [on, setOn] = useState(0);
  const bar = useRef<HTMLSpanElement>(null);
  return (
    <section aria-labelledby={id} className="py-16 md:py-section">
      <div className={cn(measure, "grid items-center gap-10 lg:grid-cols-12 lg:gap-16")}>
        <div className="flex flex-col gap-8 lg:col-span-4">
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
                  {/* How far the open item's clip has played; at its end the next item opens. */}
                  {open ? <span ref={bar} aria-hidden className="absolute -bottom-px left-0 h-0.5 w-full origin-left scale-x-0 bg-ink-strong" /> : null}
                </li>
              );
            })}
          </ol>
        </div>
        <div className="min-w-0 lg:col-span-8">
          <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-sunken shadow-window md:aspect-[16/11] md:rounded-stage">
            {items.map((f, i) => (
              <Clip key={f.title} name={f.clip} says={f.says} active={i === on} onEnded={() => setOn((n) => (n + 1) % items.length)} bar={i === on ? bar : undefined} />
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
          {items.map((f, i) => (
            <li key={f.title} className="flex flex-col gap-5">
              <div className="relative aspect-square overflow-hidden rounded-card bg-sunken shadow-window md:rounded-stage">
                <Clip name={f.clip} says={f.says} delay={i * 2000} />
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
