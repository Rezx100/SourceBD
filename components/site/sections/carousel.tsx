"use client";

// Three slides, "01 / 03" (M4, handoff-mercury-m4-onward.md §4.1): the slides sit in a row and the row moves by
// transform over the swap-in time; previous and next buttons, a dot per slide, and the arrow keys move between them;
// no movement under reduced motion. The server draws slide 1. A slide that is not shown is hidden from assistive
// tech and from the tab order (`inert`), so the carousel reads as one slide at a time.

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useId, useState, type ComponentType, type KeyboardEvent } from "react";
import { motion } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { ring } from "./ui";

export type Slide = { key: string; title: string; body: string; Slide: ComponentType<{ className?: string }> };

/** "01", "02": a slide's number or the count, two digits. */
const pad = (n: number) => String(n).padStart(2, "0");
const arrow = cn("flex size-11 items-center justify-center rounded-full border border-line text-ink-strong hover:bg-sunken", ring);

export function Carousel3({ slides, label, className }: { slides: readonly Slide[]; /** What the slides are, for a screen reader. */ label: string; className?: string }) {
  const id = useId();
  const n = slides.length;
  const [at, setAt] = useState(0);
  const go = (i: number) => setAt(((i % n) + n) % n);
  const keys = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    go(e.key === "ArrowRight" ? at + 1 : at - 1);
  };
  return (
    <section aria-roledescription="carousel" aria-label={label} onKeyDown={keys} className={cn("flex flex-col gap-6", className)}>
      <div className="overflow-hidden">
        <ul className="flex ease-reveal motion-reduce:transition-none" style={{ transform: `translateX(-${at * 100}%)`, transitionProperty: "transform", transitionDuration: `${motion.swapInMs}ms` }}>
          {slides.map((s, i) => (
            <li key={s.key} id={`${id}-slide-${i}`} role="group" aria-roledescription="slide" aria-label={`${pad(i + 1)} / ${pad(n)} · ${s.title}`} aria-hidden={i !== at} inert={i !== at} className="w-full shrink-0">
              <div className="flex flex-col gap-5">
                <s.Slide />
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-site-title font-medium text-ink-strong">{s.title}</h3>
                  <p className="max-w-[680px] text-site-body text-ink-muted">{s.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-site-body font-medium tabular-nums text-ink-strong" aria-live="polite">
          {pad(at + 1)} / {pad(n)}
        </p>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Slides" className="mr-2 flex">
            {slides.map((s, i) => (
              <button key={s.key} type="button" role="tab" aria-selected={i === at} aria-controls={`${id}-slide-${i}`} aria-label={`Slide ${pad(i + 1)}: ${s.title}`} onClick={() => go(i)} className={cn("flex size-11 items-center justify-center", ring)}>
                <span aria-hidden className={cn("size-2 rounded-full", i === at ? "bg-ink-strong" : "bg-line-strong")} />
              </button>
            ))}
          </div>
          <button type="button" aria-label="Previous slide" onClick={() => go(at - 1)} className={arrow}>
            <CaretLeft size={18} aria-hidden />
          </button>
          <button type="button" aria-label="Next slide" onClick={() => go(at + 1)} className={arrow}>
            <CaretRight size={18} aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}
