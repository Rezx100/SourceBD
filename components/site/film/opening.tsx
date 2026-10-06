// The film's opening (scenes 01 to 03, handoff-home-film §4): the planet, the four districts, and one dot that
// becomes a record. Server-rendered, every word in the page; it replaces the home page's hero and its "Where are
// they?" section only when the film is on.
//
// One markup, three tiers. With no tier on the root (no script) and on the `still` tier it is a stacked page with
// pictures of the planet and the map. On `lite` the planet turns live while the hero holds, and the map is a
// picture. On `full` the whole opening is one tall section whose stage sticks: the planet dives, gives way to the
// live map under it in one move (its opacity written by engine/start.ts), and the map's camera runs on. The
// `film:` and `film-full:` variants (tailwind.config.ts) are those two conditions.

import Link from "next/link";
import { ButtonLink } from "@/components/kit";
import { DISTRICTS } from "@/components/site/film/engine/map";
import { Callout, FieldPane, RecordPane } from "@/components/site/film/pane";
import { LINE, NAME } from "@/components/site/film/record";
import { Thread, ThreadLayer } from "@/components/site/film/thread";
import { SCENE_TYPE, Words } from "@/components/site/film/words";
import { Label, Lede, wrap } from "@/components/site/parts";
import { readDay, withCommas } from "@/lib/site-facts";
import { cn } from "@/lib/utils";

/**
 * What the planet's lights are, from `public/site/film/cells.json`: the day it was read and its two counts,
 * repeated here so the page can say them. `film.test.ts` holds these three to the file; `scripts/film/build-cells.mjs`
 * prints them with each run.
 */
export const LIGHTS_FILE = { date: "2026-10-06", mapped: 9541, suppliers: 10277 } as const;
export const LIGHTS = `One light per km² with suppliers · ${withCommas(LIGHTS_FILE.mapped)} of ${withCommas(LIGHTS_FILE.suppliers)} have a mapped register address · ${readDay(LIGHTS_FILE.date)}`;
/** The map's open data and its licences (scripts/film/build-geo.mjs); /legal/data-sources carries the full credit. */
export const MAP_CREDIT = "Districts: BBS and OCHA, CC BY 3.0 IGO · rivers and coast: Natural Earth";
const stage = "relative overflow-hidden";
const hero = "font-semibold tracking-[-0.03em] text-ink [text-wrap:balance] text-film-hero-phone md:text-display-1 xl:text-film-hero";
/** An act of the opening: in flow when stacked; laid over the stage, centred, and faded in and out on the full tier. */
const act = "relative flex flex-col gap-10 film-full:absolute film-full:inset-0 film-full:justify-center film-full:transition-opacity film-full:duration-slow";

/** A picture of our own map for the tiers that do not draw it live, in the theme the system asks for. Decoration: the words carry the counts. */
export function MapStill({ name }: { name: string }) {
  return (
    <picture className="block w-full max-w-[720px] overflow-hidden rounded-pane max-sm:rounded-pane-phone film-full:hidden">
      <source media="(prefers-color-scheme: dark)" srcSet={`/site/film/${name}-dark.avif`} />
      {/* eslint-disable-next-line @next/next/no-img-element -- a finished picture of our own map, encoded once */}
      <img src={`/site/film/${name}-light.avif`} alt="" width={1200} height={750} loading="lazy" decoding="async" className="h-auto w-full" />
    </picture>
  );
}

export function Opening({ count, updated }: { count: string | null; updated: string | null }) {
  return (
    <section id="ch-1" data-scene="opening" data-chapter="ch-1" className="relative bg-surface text-ink film-full:h-[640svh]">
      {/* Clipped only on the full tier: an overflow on this box would be the lite tier's planet's scroll container, and it would never stick. */}
      <div className="relative film-full:sticky film-full:top-0 film-full:h-svh film-full:isolate film-full:overflow-hidden">
        {/* 01 · the planet: night in both themes. On the full tier it lies over the map and gives way to it. */}
        <div data-scene="planet" data-chapter="ch-1" data-act="planet" data-ground="night" className="relative bg-surface text-ink film:h-[190svh] film-full:absolute film-full:inset-0 film-full:z-raised film-full:h-auto">
          {/* With the film on, the stage is the screen and no taller: a minimum would set the planet's canvas off the map's frame. */}
          <div className={cn(stage, "flex min-h-[600px] flex-col justify-center py-20 max-md:py-12 film:sticky film:top-0 film:h-svh film:min-h-0 film:py-0")}>
            {/* The still tier's planet: the same planet, drawn once. The full and lite tiers draw it live, and never fetch this (a lazy picture that is not displayed is not loaded). */}
            <picture className="absolute inset-0 block film:hidden">
              <source media="(max-width: 767px)" srcSet="/site/film/planet-upright.avif" />
              {/* eslint-disable-next-line @next/next/no-img-element -- a finished picture of our own planet, encoded once */}
              <img src="/site/film/planet.avif" alt="" loading="lazy" decoding="async" className="size-full object-cover object-right" />
            </picture>
            <canvas data-planet aria-hidden className="absolute inset-0 hidden size-full film:block" />
            {/* The runtime fits both layers to the stage and moves their paths with the planet. */}
            <svg data-planet-leads aria-hidden viewBox="0 0 1 1" className="pointer-events-none absolute inset-0 hidden size-full fill-none stroke-ink-3 [stroke-width:1] film-full:block">
              {DISTRICTS.map((d) => (
                <path key={d.key} />
              ))}
            </svg>
            <ThreadLayer viewBox="0 0 1 1" className="hidden film:block">
              <g data-planet-thread>
                <Thread d="M0 0" />
              </g>
            </ThreadLayer>
            {/* The column lets the pointer through to the planet between its lines, so the planet can be dragged. */}
            <div data-hero className={cn(wrap, "pointer-events-none relative flex flex-col items-start gap-6 [&>*]:pointer-events-auto")}>
              {count ? <Label>{count} suppliers{updated ? ` · updated ${updated}` : ""}</Label> : null}
              <h1 className={cn(hero, "max-w-[900px] leading-[1.02]")}>Know who you&rsquo;re buying from.</h1>
              <Lede className="max-w-[560px]">{count ? `${count} Bangladesh garment suppliers, each checked against the registers that list them.` : "Bangladesh garment suppliers, each checked against the registers that list them."}</Lede>
              <div className="flex w-full max-w-[560px] flex-col gap-2">
                <FieldPane id="hero-q" material="glass" />
                <p className="text-md text-ink-3">Try &ldquo;knit dresses Gazipur&rdquo; or &ldquo;GOTS&rdquo;</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <ButtonLink href="/signup" prefetch={false} kind="primary" size="lg" className="max-sm:h-input-touch">
                  Start free
                </ButtonLink>
                <Link href="/contact" prefetch={false} className="text-md font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] max-sm:flex max-sm:min-h-11 max-sm:items-center">
                  Book a demo
                </Link>
              </div>
            </div>
            {/* The planet's labels repeat the district counts the next scene states in words, so they are decoration here. */}
            <div data-planet-callouts aria-hidden className="pointer-events-none absolute inset-0 hidden film-full:block">
              {DISTRICTS.map((d, i) => (
                // Solid: with the search that would be five panes of glass, and the rule is three.
                <Callout key={d.key} material="solid" place={d.label} figure={withCommas(d.count)} on={i === 0} className="absolute left-0 top-0 opacity-0" />
              ))}
            </div>
            {/* Said on every tier: the still tier's picture shows the same lights. */}
            <p className={cn(wrap, "absolute inset-x-0 bottom-6 font-mono text-xs text-ink-3")}>{LIGHTS}</p>
          </div>
        </div>

        {/* 02 and 03 · the map: four districts, then one dot becomes a record. Live on the full tier, a picture on the others. */}
        <div data-map aria-hidden className="absolute inset-0 hidden film-full:block" />
        <ThreadLayer viewBox="0 0 1 1" className="hidden film-full:block">
          <g data-map-thread>
            <Thread d="M0 0" />
          </g>
        </ThreadLayer>

        <div data-act="districts" className={cn(wrap, act, "py-24 max-md:py-14 film-full:py-0")}>
          <MapStill name="map-country" />
          <Words label="Where are they?" headline="Most sit in four districts." lede="Suppliers by district, from their register addresses, as counted on 3 Oct 2026." />
          {/* Every count is in the page, and stays readable to a screen reader. On the full tier one shows at a time, whole: a figure never counts up. */}
          <ol data-steps className="grid max-w-[720px] grid-cols-2 gap-x-10 gap-y-6 md:grid-cols-4 film-full:block">
            {DISTRICTS.map((d, i) => (
              <li key={d.key} data-on={i === 0 ? "" : undefined} className="flex flex-col gap-1 border-t border-ink pt-3 film-full:sr-only film-full:data-[on]:not-sr-only film-full:data-[on]:flex film-full:data-[on]:flex-col-reverse film-full:data-[on]:border-0 film-full:data-[on]:pt-0">
                <span className="text-lg text-ink-2">
                  <span className="hidden film-full:inline">suppliers in </span>
                  {d.label}
                </span>
                <span className="font-mono text-2xl font-semibold text-ink film-full:font-sans film-full:text-film-figure film-full:leading-[0.9] film-full:tracking-[-0.04em]">{withCommas(d.count)}</span>
              </li>
            ))}
          </ol>
          <p className="font-mono text-xs text-ink-3 film-full:hidden">{MAP_CREDIT}</p>
        </div>

        <div data-act="record" className={cn(wrap, act, "pb-24 max-md:pb-14 film-full:pb-0 film-full:opacity-0")}>
          <MapStill name="map-gazipur" />
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-[520px] flex-col gap-4">
              <Label>Pick one</Label>
              <p className={cn(SCENE_TYPE, "leading-[1.06]")}>Follow one factory down the page.</p>
              <Lede>{NAME} makes knitwear in Kashimpur, Gazipur. Each row its record gains below comes from a named source.</Lede>
              <p className="font-mono text-xs text-ink-3">A real record, as it stands on 3 Oct 2026.</p>
            </div>
            <RecordPane material="glass" name={NAME} line={LINE} rows={[]} state={count ? `1 of ${count} suppliers` : undefined} className="lg:shrink-0" />
          </div>
        </div>

        <p data-map-credit className="absolute bottom-6 right-6 hidden font-mono text-xs text-ink-3 film-full:block">{MAP_CREDIT}</p>
      </div>
    </section>
  );
}
