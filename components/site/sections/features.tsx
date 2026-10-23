"use client";

// A grid of features (the founder's videos of 22 Oct 2026, after mercury.com's), now the Compliance page's four moments;
// the home page draws its own grids since his walkthrough of 23 Oct 2026 (`card-grid.tsx`). Each feature is a part of
// the real app composed in code from a real capture (`Clip`, sections/browser.tsx), filling its card edge to edge, on the
// sunken ground with no drop shadow. A heading and four cards, two by two, each card its clip's frame (4:3, as
// mercury's); the four start two seconds apart so only one moves strongly at a time.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Clip } from "./browser";
import { H2, measure } from "./ui";

/** A feature: its words, and its clip (`clip-<clip>`) with the sentence a screen reader gets in its place. */
export type Feature = { title: string; body: string; link?: readonly [string, string]; clip: string; says: string };

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
              <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-sunken md:rounded-stage">
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
