"use client";

// What suppliers and buyers said, in the place of mercury.com's customer stories. The founder spoke with a few of each
// before launch (24 Oct 2026); their names are withheld until then, so each slide names the role, the kind of company
// and the place, and the line under the slides says so. The photographs (Higgsfield, PROVENANCE.md) show each
// speaker's setting and never the speaker's face, so no picture stands in for a person. Nothing moves on its own (founder, 24 Oct
// 2026): a slide changes only when it is dragged or a rule under it is clicked, and it moves inside the card's frame,
// which stays where it is (his recording of 24 Oct 2026: the card itself must not travel across the page).

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

/**
 * The shade under the words: a clear, neutral black (his recording of 24 Oct 2026: no tint, no blur, a clear screen as
 * Apple's are), an oval centred on them, holding under the text and easing out through many stops so no step shows, the
 * rest of the room left bright. Black at these strengths holds the words at least as dark as the night-tinted shade did
 * when it was measured on all three rooms at 390, 820 and 1440: the name and role (normal text) at 7:1 or better, the
 * quote (large text from 1024 px) at 4.5:1 or better, WCAG AAA.
 */
const SHADE =
  "bg-[linear-gradient(to_top,rgb(var(--mk-shade)/0.86)_0%,rgb(var(--mk-shade)/0.82)_35%,rgb(var(--mk-shade)/0.7)_52%,rgb(var(--mk-shade)/0.45)_64%,rgb(var(--mk-shade)/0.2)_77%,transparent_90%)] sm:bg-[radial-gradient(ellipse_42%_48%_at_0%_100%,rgb(var(--mk-shade)/0.55)_0%,rgb(var(--mk-shade)/0.38)_45%,rgb(var(--mk-shade)/0.16)_75%,transparent_100%),radial-gradient(ellipse_44%_62%_at_24%_72%,rgb(var(--mk-shade)/0.84)_0%,rgb(var(--mk-shade)/0.82)_50%,rgb(var(--mk-shade)/0.68)_62%,rgb(var(--mk-shade)/0.45)_74%,rgb(var(--mk-shade)/0.24)_85%,rgb(var(--mk-shade)/0.08)_94%,transparent_100%)]";

/** How far a drag must travel, in pixels, before it changes the slide. */
const SWIPE = 60;

export function Voices() {
  const [on, setOn] = useState(0);
  const [dx, setDx] = useState<number | null>(null);
  const from = useRef(0);
  const go = (i: number) => setOn(Math.max(0, Math.min(VOICES.length - 1, i)));
  return (
    <section data-mk-tone="night" aria-labelledby="home-voices" className="pb-14 pt-12 md:pb-20 md:pt-[72px]">
      <h2 id="home-voices" className="sr-only">
        What suppliers and buyers told us
      </h2>
      <div
        className={cn(column, "relative aspect-[4/5] touch-pan-y select-none overflow-hidden rounded-frame bg-sunken sm:aspect-[3/2] lg:aspect-[2/1]", dx === null ? "cursor-grab" : "cursor-grabbing")}
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
      >
        {/* The slides side by side inside the frame; only they move. */}
        <div
          className="flex size-full transition-transform duration-reveal ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(calc(${-on * 100}% + ${dx ?? 0}px))`, transition: dx === null ? undefined : "none" }}
        >
          {VOICES.map((v, i) => {
            const showing = i === on;
            return (
              <figure key={v.photo} inert={!showing} aria-hidden={!showing} className="m-0 size-full shrink-0">
                <div className="relative size-full">
                  {/* The photograph fills the card, as mercury.com's does; under the words a clear shade eases out from their corner. */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized in public/site/home (PROVENANCE.md), no optimizer pass */}
                  <img src={`/site/home/voice-${v.photo}.webp`} alt="" width={2000} height={1116} loading="lazy" decoding="async" draggable={false} className="absolute inset-0 size-full object-cover" />
                  <div aria-hidden className={cn("pointer-events-none absolute inset-0", SHADE)} />
                  <span className="pointer-events-none absolute left-5 top-5 flex h-8 items-center rounded-sm bg-[rgb(var(--mk-shade)/0.7)] px-2 text-site-item text-ink md:left-8 md:top-8">{v.tag}</span>
                  <div className="pointer-events-none absolute inset-x-5 bottom-5 flex max-w-[440px] flex-col gap-6 sm:max-w-[min(440px,44%)] md:inset-x-8 md:bottom-8 md:gap-10">
                    <blockquote className="font-display text-site-card text-ink lg:text-site-lead">“{v.quote}”</blockquote>
                    <figcaption className="flex flex-col text-site-item md:text-site-card">
                      <span className="font-display text-ink">{v.who}</span>
                      <span className="font-book text-ink/85">{v.where}</span>
                    </figcaption>
                  </div>
                </div>
              </figure>
            );
          })}
        </div>
      </div>
      <div className="mt-6 flex justify-center gap-1 md:mt-8">
        {VOICES.map((v, i) => (
          <button key={v.photo} type="button" aria-label={`Show the ${v.who.toLowerCase()}’s words`} aria-pressed={i === on} onClick={() => go(i)} className={cn("flex h-8 w-20 items-center", ring)}>
            <span className={cn("h-0.5 w-full rounded-full transition-colors duration-fast motion-reduce:transition-none", i === on ? "bg-ink" : "bg-ink/20")} />
          </button>
        ))}
      </div>
    </section>
  );
}
