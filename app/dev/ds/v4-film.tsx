// /dev/ds: the home film's additions to SourceBD v4 (handoff-home-film §3): the dark set, the film's type sizes,
// the Pane in its two materials, the search, the overlock and the staged screen. Each board is drawn twice, in the
// light set and inside a night scope, which carries the same variables the dark theme does. Server component.

import type { ReactNode } from "react";
import { OVERLOCK_CAPTION } from "@/components/site/film/chapters";
import { Overlock } from "@/components/site/film/flats";
import { Pane, Screen, ScreenStage, SearchField } from "@/components/site/film/pane";
import { cssVarName, darkColors, filmColors, fontSize, splitColorName, v4Colors } from "@/lib/design/tokens";

const FILM_SIZES: [string, string][] = [
  ["film-hero", "text-film-hero"],
  ["film-figure", "text-film-figure"],
  ["film-scene", "text-film-scene"],
  ["film-hero-phone", "text-film-hero-phone"],
  ["film-figure-phone", "text-film-figure-phone"],
  ["film-scene-phone", "text-film-scene-phone"],
];

const chip = (name: string) => {
  const [group, key] = splitColorName(name);
  return `rgb(var(${cssVarName(group, key)}) / 1)`;
};

/** Something live for glass to sit on: water, land and a scatter of supplier light, from the map's own tokens. */
export function LiveGround({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`relative isolate overflow-hidden bg-map-water ${className ?? ""}`}
      style={{
        backgroundImage:
          "radial-gradient(circle at 22% 30%, rgb(var(--ds-map-light) / 0.85) 0 5px, transparent 7px), radial-gradient(circle at 28% 42%, rgb(var(--ds-map-light) / 0.7) 0 9px, transparent 12px), radial-gradient(circle at 64% 58%, rgb(var(--ds-map-light) / 0.8) 0 4px, transparent 6px), radial-gradient(circle at 70% 26%, rgb(var(--ds-map-light) / 0.6) 0 7px, transparent 10px), radial-gradient(ellipse 60% 70% at 35% 45%, rgb(var(--ds-map-land)) 0 70%, transparent 71%), radial-gradient(ellipse 40% 50% at 82% 70%, rgb(var(--ds-map-land)) 0 70%, transparent 71%)",
      }}
    >
      {children}
    </div>
  );
}

function Board({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <p className="max-w-prose text-base text-ink-3">{note}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {(["light", "night"] as const).map((ground) => (
          <div key={ground} data-ground={ground === "night" ? "night" : undefined} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 text-ink">
            <p className="font-mono text-xs text-ink-3">{ground}</p>
            {children}
          </div>
        ))}
      </div>
    </div>
  );
}

export function V4Film() {
  const names = [...Object.keys(v4Colors), ...Object.keys(filmColors)] as (keyof typeof darkColors)[];
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-ink">The dark set</h3>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3 xl:grid-cols-5">
          {names.map((name) => (
            <li key={name} className="flex items-center gap-2">
              <span className="size-6 shrink-0 rounded-sm border border-line" style={{ backgroundColor: chip(name) }} />
              {/* The dark set's own value, not a night scope's: a night scene keeps the page's button green (NIGHT_INHERITS). */}
              <span className="size-6 shrink-0 rounded-sm border border-line" style={{ backgroundColor: darkColors[name] }} />
              <span className="flex min-w-0 flex-col">
                <span className="font-mono text-xs text-ink">{name}</span>
                <span className="font-mono text-xs text-ink-3">{name in filmColors ? filmColors[name as keyof typeof filmColors] : v4Colors[name as keyof typeof v4Colors]} · {darkColors[name]}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-ink">Film type</h3>
        <ul className="flex flex-col gap-4 overflow-hidden">
          {FILM_SIZES.map(([key, cls]) => (
            <li key={key} className="flex flex-col gap-1">
              <span className="font-mono text-xs text-ink-3">text-{key} · {fontSize[key]?.[0]} / {fontSize[key]?.[1].lineHeight}</span>
              <span className={`${cls} whitespace-nowrap font-semibold tracking-tighter text-ink`}>{key.includes("figure") ? "4,421" : "Know who"}</span>
            </li>
          ))}
        </ul>
      </div>

      <Board title="Pane" note="One surface, two materials. Glass where something live sits behind it; solid where the ground is plain or the text is dense. Never glass on glass, at most three glass panes on screen.">
        <LiveGround className="grid gap-4 rounded-lg p-6 sm:grid-cols-2">
          <Pane material="glass" className="flex flex-col gap-1">
            <p className="font-mono text-xs text-ink-3">glass</p>
            <p className="text-md font-semibold text-ink">Tint, blur, lit edge, long shadow</p>
            <p className="text-base text-ink-2">Body text holds 4.5:1 over the brightest and the darkest thing behind it.</p>
          </Pane>
          <Pane className="flex flex-col gap-1">
            <p className="font-mono text-xs text-ink-3">solid</p>
            <p className="text-md font-semibold text-ink">Surface, hairline, the same shadow</p>
            <p className="text-base text-ink-2">Also what glass becomes on the lite and still tiers.</p>
          </Pane>
        </LiveGround>
      </Board>

      <Board title="SearchField" note="The hero's and the close's search: it runs on public Discover, and its button is the kit's primary button, the nav's own.">
        <LiveGround className="flex flex-col items-start gap-4 rounded-lg p-5">
          <SearchField id="film-q" material="glass" />
        </LiveGround>
      </Board>

      <Board title="Overlock" note="The flat of scene 04: a 1.5px ink line, fills from the surface roles, green only for thread, the five source tags hung on their threads. The scroll turns the handwheel, drops the needle and draws the seam; at rest every part is still.">
        <figure className="flex flex-col gap-3">
          <Overlock className="h-auto w-full max-w-[460px]" />
          <figcaption className="font-mono text-xs text-ink-3">{OVERLOCK_CAPTION}</figcaption>
        </figure>
      </Board>

      <Board title="ScreenStage" note="A real screen on the night stage with its moving field: a window with no chrome that shows the part the step is about, larger, and a drawn cursor that presses. The app has no dark theme, so the screen stays light in both.">
        <ScreenStage caption="Real v4 screen · Saved suppliers, 3 picked for one RFQ · the app is light in both themes">
          <Screen on cursor={{ x: 89.7, y: 24.8 }} focus={{ x: 62, y: 38 }} zoom={{ x: 85, y: 39 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a gallery sample of the staged screen */}
            <img src="/site/saved-selected.png" alt="" className="block h-auto w-full" />
          </Screen>
        </ScreenStage>
      </Board>
    </div>
  );
}
