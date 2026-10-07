// The film's opening (handoff-home-film §4): the planet, then the city, and one factory that the rest of the page
// follows. Server-rendered, every word in the page; it replaces the home page's hero and its "Where are they?"
// section only when the film is on. After the founder's video of 7 Oct 2026 the first screen says less (the
// headline, one line and the search), the planet carries no labels, leads or thread, and the map is gone: the
// garment belt is a city drawn in code from our supplier cells (engine/city.ts). Night in either theme.
//
// One markup, three tiers. With no tier on the root (no script) and on the `still` tier it is a stacked page with
// pictures of the planet and the city. On `lite` the planet turns live while the hero holds, and the city is a
// picture. On `full` the whole opening is one tall section whose stage sticks: the planet dives, gives way to the
// live city under it in one move (its opacity written by engine/start.ts), and the city's camera flies on. The
// `film:` and `film-full:` variants (tailwind.config.ts) are those two conditions.

import { CHATTOGRAM, DISTRICTS } from "@/components/site/film/engine/city";
import { SearchField } from "@/components/site/film/pane";
import { NAME } from "@/components/site/film/record";
import { SCENE_TYPE, Words } from "@/components/site/film/words";
import { Lede, wrap } from "@/components/site/parts";
import { readDay, withCommas } from "@/lib/site-facts";
import { cn } from "@/lib/utils";

/**
 * What the planet's lights and the city's blocks are, from `public/site/film/cells.json`: the day it was read and
 * its two counts, repeated here so the page can say them. `film.test.ts` holds these three to the file;
 * `scripts/film/build-cells.mjs` prints them with each run.
 */
export const LIGHTS_FILE = { date: "2026-10-06", mapped: 9541, suppliers: 10277 } as const;
export const LIGHTS = `One block per km² with suppliers, taller where there are more · ${withCommas(LIGHTS_FILE.mapped)} of ${withCommas(LIGHTS_FILE.suppliers)} have a mapped register address · ${readDay(LIGHTS_FILE.date)}`;
/** The open data the city's ground draws (scripts/film/build-geo.mjs); /legal/data-sources carries the full credit. */
export const MAP_CREDIT = "Districts: BBS and OCHA, CC BY 3.0 IGO · rivers and coast: Natural Earth";
/** Chattogram lies down the coast, out of the city's frame: said in words. */
export const CHATTOGRAM_LINE = `${CHATTOGRAM.label}, down the coast, has ${withCommas(CHATTOGRAM.count)} more.`;
/** The one headline: medium weight, tight, at the film's hero size (600 read heavy at this size). */
const hero = "font-medium tracking-[-0.04em] text-ink [text-wrap:balance] text-film-hero-phone md:text-display-1 xl:text-film-hero";
/** An act of the opening: in flow when stacked; laid over the stage, centred, and faded in and out on the full tier. */
const act = "relative flex flex-col gap-10 film-full:pointer-events-none film-full:absolute film-full:inset-0 film-full:justify-center film-full:transition-opacity film-full:duration-slow";

/** A picture of the city for the tiers that do not draw it live (night in either theme, as the live one is). Decoration: the words carry the counts. */
export function CityStill({ name }: { name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a finished picture of our own city, encoded once
    <img src={`/site/film/${name}.avif`} alt="" width={1200} height={750} loading="lazy" decoding="async" className="block h-auto w-full max-w-[720px] rounded-pane max-sm:rounded-pane-phone film-full:hidden" />
  );
}

export function Opening({ count }: { count: string | null }) {
  return (
    <section id="ch-1" data-scene="opening" className="relative bg-surface text-ink film-full:h-[460svh]">
      {/* Clipped only on the full tier: an overflow on this box would be the lite tier's planet's scroll container, and it would never stick. */}
      <div data-ground="night" className="relative bg-surface text-ink film-full:sticky film-full:top-0 film-full:h-svh film-full:isolate film-full:overflow-hidden">
        {/* The planet. On the full tier it lies over the city and gives way to it. */}
        <div data-scene="planet" data-act="planet" className="relative bg-surface text-ink film:h-[160svh] film-full:absolute film-full:inset-0 film-full:z-raised film-full:h-auto">
          {/* With the film on, the stage is the screen and no taller. */}
          <div className="relative flex min-h-[600px] flex-col justify-center overflow-hidden py-20 max-md:py-12 film:sticky film:top-0 film:h-svh film:min-h-0 film:py-0">
            {/* The still tier's planet: the same planet, drawn once. The full and lite tiers draw it live, and never fetch this (a lazy picture that is not displayed is not loaded). */}
            <picture className="absolute inset-0 block film:hidden">
              <source media="(max-width: 767px)" srcSet="/site/film/planet-upright.avif" />
              {/* eslint-disable-next-line @next/next/no-img-element -- a finished picture of our own planet, encoded once */}
              <img src="/site/film/planet.avif" alt="" loading="lazy" decoding="async" className="size-full object-cover object-right" />
            </picture>
            <canvas data-planet aria-hidden className="absolute inset-0 hidden size-full film:block" />
            {/* The column lets the pointer through to the planet between its lines, so the planet can be dragged. */}
            <div data-hero className={cn(wrap, "pointer-events-none relative flex flex-col items-start gap-8 [&>*]:pointer-events-auto")}>
              <h1 className={cn(hero, "max-w-[900px] leading-[1.0]")}>Know who you&rsquo;re buying from.</h1>
              <Lede className="max-w-[520px]">{count ? `${count} Bangladesh garment suppliers, each checked against the registers that list them.` : "Bangladesh garment suppliers, each checked against the registers that list them."}</Lede>
              <SearchField id="hero-q" material="glass" />
            </div>
          </div>
        </div>

        {/* The city: live on the full tier, a picture on the others. */}
        <canvas data-city aria-hidden className="absolute inset-0 hidden size-full film-full:block" />
        {/* The places' names, standing on the ground where each is; the engine moves them with the camera. The words say the same, so they are decoration. */}
        <div data-city-labels aria-hidden className="pointer-events-none absolute inset-0 hidden film-full:block">
          {DISTRICTS.map((d) => (
            <span key={d.key} data-place className="absolute left-0 top-0 -translate-x-1/2 whitespace-nowrap text-md font-medium tracking-[-0.01em] text-ink opacity-0 [text-shadow:0_1px_12px_rgb(var(--ds-surface))]">
              {d.key}
            </span>
          ))}
          <span data-city-factory className="absolute left-0 top-0 flex flex-col gap-0.5 whitespace-nowrap pl-5 opacity-0 [text-shadow:0_1px_12px_rgb(var(--ds-surface))]">
            <span className="text-lg font-medium tracking-[-0.01em] text-ink">{NAME}</span>
            <span className="text-sm text-ink-2">Kashimpur, Gazipur · the area, not the building</span>
          </span>
        </div>

        <div data-act="districts" className={cn(wrap, act, "py-24 max-md:py-14 film-full:py-0")}>
          <CityStill name="city-belt" />
          <Words headline="Most sit in four districts." lede="Suppliers by district, from their register addresses, as counted on 3 Oct 2026." />
          {/* Every count is in the page, and stays readable to a screen reader. On the full tier one shows at a time, whole: a figure never counts up. */}
          <ol data-steps className="grid max-w-[720px] grid-cols-2 gap-x-10 gap-y-6 md:grid-cols-3 film-full:block">
            {DISTRICTS.map((d, i) => (
              <li key={d.key} data-on={i === 0 ? "" : undefined} className="flex flex-col gap-1 border-t border-line pt-3 film-full:sr-only film-full:data-[on]:not-sr-only film-full:data-[on]:flex film-full:data-[on]:flex-col-reverse film-full:data-[on]:border-0 film-full:data-[on]:pt-0">
                <span className="text-lg text-ink-2">
                  <span className="hidden film-full:inline">suppliers in </span>
                  {d.label}
                </span>
                <span className="text-2xl font-medium tracking-[-0.02em] text-ink film-full:text-film-figure film-full:leading-[0.9] film-full:tracking-[-0.045em]">{withCommas(d.count)}</span>
              </li>
            ))}
          </ol>
          <div className="flex max-w-[520px] flex-col gap-2">
            <p className="text-md text-ink-2">{CHATTOGRAM_LINE}</p>
            <p className="font-mono text-xs leading-5 text-ink-3">{LIGHTS}</p>
          </div>
          <p className="font-mono text-xs text-ink-3 film-full:hidden">{MAP_CREDIT}</p>
        </div>

        <div data-act="record" className={cn(wrap, act, "pb-24 max-md:pb-14 film-full:pb-0 film-full:opacity-0")}>
          <CityStill name="city-site" />
          <div className="flex max-w-[480px] flex-col gap-5">
            <p className={cn(SCENE_TYPE, "leading-[1.04]")}>Follow one factory down the page.</p>
            <Lede>{NAME} makes knitwear in Kashimpur, Gazipur. Every fact on its record below comes from a named source.</Lede>
            <p className="font-mono text-xs text-ink-3">A real record, as it stands on 3 Oct 2026.</p>
          </div>
        </div>

        <p className="absolute bottom-6 right-6 hidden font-mono text-xs text-ink-3 film-full:block">{MAP_CREDIT}</p>
      </div>
    </section>
  );
}
