"use client";

// What suppliers and buyers said, in the place of mercury.com's customer stories. The founder spoke with a few of each
// before launch (24 Oct 2026); their names are withheld until then, so each slide names the role, the kind of company
// and the place, and the line under the slides says so. The photographs (Higgsfield, PROVENANCE.md) show each
// speaker's setting and never a face, so no picture stands in for a person. Nothing moves on its own (founder, 24 Oct
// 2026): a slide changes only when it is dragged or a rule under it is clicked.

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { column, ring } from "./ui";

export const VOICES = [
  {
    photo: "buyer-uk",
    tag: "Buyer",
    quote: "Vetting a factory in Bangladesh used to take weeks of emails. Now its certificates and safety record are on one page, each with the date it was read.",
    who: "Sourcing manager",
    where: "Womenswear brand · London",
  },
  {
    photo: "supplier",
    tag: "Supplier",
    quote: "Our certificates were always there, but no buyer abroad could see them. Bangladesh needed this. Now our record speaks for us before the first email.",
    who: "Managing director",
    where: "Knitwear factory · Gazipur",
  },
  {
    photo: "buyer-eu",
    tag: "Buyer",
    quote: "Nothing is hidden behind a sales call. If a certificate has lapsed, the page says so. That honesty is what sourcing from Bangladesh was missing.",
    who: "Technical sourcing lead",
    where: "Knitwear importer · Germany",
  },
] as const;

/** How far a drag must travel, in pixels, before it changes the slide. */
const SWIPE = 60;

export function Voices() {
  const [on, setOn] = useState(0);
  const [dx, setDx] = useState<number | null>(null);
  const from = useRef(0);
  const go = (i: number) => setOn(Math.max(0, Math.min(VOICES.length - 1, i)));
  return (
    <section data-mk-tone="night" aria-labelledby="home-voices" className="overflow-hidden pb-14 pt-12 md:pb-20 md:pt-[72px]">
      <h2 id="home-voices" className="sr-only">
        What suppliers and buyers told us
      </h2>
      <div
        onPointerDown={(e) => {
          from.current = e.clientX;
          setDx(0);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => dx !== null && setDx(e.clientX - from.current)}
        onPointerUp={() => {
          if (dx !== null && Math.abs(dx) > SWIPE) go(on + (dx < 0 ? 1 : -1));
          setDx(null);
        }}
        onPointerCancel={() => setDx(null)}
        className={cn("flex touch-pan-y select-none transition-transform duration-reveal ease-out motion-reduce:transition-none", dx === null ? "cursor-grab" : "cursor-grabbing")}
        style={{ transform: `translateX(calc(${-on * 100}% + ${dx ?? 0}px))`, transition: dx === null ? undefined : "none" }}
      >
        {VOICES.map((v, i) => {
          const showing = i === on;
          return (
            <figure key={v.photo} inert={!showing} aria-hidden={!showing} className="w-full shrink-0">
              <div className={cn(column, "relative aspect-[4/5] overflow-hidden rounded-frame bg-sunken sm:aspect-[2/1]")}>
                {/* The photograph fills the card, as mercury.com's does (founder, 24 Oct 2026: no dark shadow down the left);
                    a wash rising from the bottom keeps the words readable over a bright room. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized in public/site/home (PROVENANCE.md), no optimizer pass */}
                <img src={`/site/home/voice-${v.photo}.webp`} alt="" width={2000} height={1116} loading="lazy" decoding="async" draggable={false} className="absolute inset-0 size-full object-cover" />
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgb(0_0_0/0.82),rgb(0_0_0/0.55)_35%,rgb(0_0_0/0.15)_70%,rgb(0_0_0/0.05))]" />
                <span className="pointer-events-none absolute left-5 top-5 flex h-8 items-center rounded-sm bg-[rgb(var(--mk-ground-night))] px-2 text-site-item text-ink md:left-8 md:top-8">{v.tag}</span>
                <div className="pointer-events-none absolute inset-x-5 bottom-5 flex max-w-[440px] flex-col gap-6 md:inset-x-8 md:bottom-8 md:gap-8">
                  <blockquote className="font-display text-site-card text-ink md:text-xl">“{v.quote}”</blockquote>
                  <figcaption className="flex flex-col">
                    <span className="font-display text-site-card text-ink md:text-xl">{v.who}</span>
                    <span className="font-book text-site-card text-ink-2 md:text-xl">{v.where}</span>
                  </figcaption>
                </div>
              </div>
            </figure>
          );
        })}
      </div>
      <div className="mt-6 flex justify-center gap-1 md:mt-8">
        {VOICES.map((v, i) => (
          <button key={v.photo} type="button" aria-label={`Show the ${v.who.toLowerCase()}’s words`} aria-pressed={i === on} onClick={() => go(i)} className={cn("flex h-8 w-20 items-center", ring)}>
            <span className={cn("h-0.5 w-full rounded-full transition-colors duration-fast motion-reduce:transition-none", i === on ? "bg-ink" : "bg-ink/20")} />
          </button>
        ))}
      </div>
      <p className={cn(column, "mt-3 text-center text-sm text-ink-3")}>Said to us before launch. Names are withheld until then; the photographs show the setting, not the speaker.</p>
    </section>
  );
}
