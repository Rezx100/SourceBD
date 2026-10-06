// /dev/ds: the home film's additions to SourceBD v4 (handoff-home-film §3): the dark set, the film's type sizes,
// the Pane in its two materials with its family, the thread and the rail. Each board is drawn twice, in the light
// set and inside a night scope, which carries the same variables the dark theme does. The record is the home
// page's own (Mondol Fabrics Ltd., captured 3 Oct 2026), not an invented one. Server component.

import type { ReactNode } from "react";
import { DIFFER, OVERLOCK_CAPTION, RECEIPTS } from "@/components/site/film/chapters";
import { Overlock } from "@/components/site/film/flats";
import { AlertPane, Callout, FieldPane, NotePane, Pane, RecordPane, ScreenStage, type RecordRow } from "@/components/site/film/pane";
import { ReceiptRoll } from "@/components/site/film/receipts";
import { BGMEA, GOTS, LINE, NAME, SAFETY, SOURCES } from "@/components/site/film/record";
import { Rail, Thread, ThreadLayer } from "@/components/site/film/thread";
import { cssVarName, darkColors, filmColors, fontSize, splitColorName, v4Colors } from "@/lib/design/tokens";

export const FILM_ROWS: RecordRow[] = [SOURCES, BGMEA, GOTS, SAFETY];

export const FILM_CHAPTERS = [
  { id: "ch-1", n: "01", label: "Where are they?" },
  { id: "ch-02", n: "02", label: "Who are they?" },
  { id: "ch-03", n: "03", label: "Is that true?" },
  { id: "ch-04", n: "04", label: "Where are they?" },
  { id: "ch-05", n: "05", label: "Who do they ship to?" },
  { id: "ch-06", n: "06", label: "Will it still be true next month?" },
  { id: "ch-7", n: "07", label: "Can they make my order?" },
  { id: "ch-8", n: "08", label: "Why should I trust you?" },
  { id: "ch-9", n: "09", label: "The whole record" },
];

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
              <span data-ground="night" className="size-6 shrink-0 rounded-sm border border-line" style={{ backgroundColor: chip(name) }} />
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

      <Board title="RecordPane" note="The protagonist. A row arrives stitched: a green line sweeps its top edge, the mark stamps in, the words rise, and a green dot stays at its left. Sources shows the five marks, not a filled block.">
        <LiveGround className="flex justify-center rounded-lg p-6">
          <RecordPane material="glass" name={NAME} line={LINE} state="Saved · watching" rows={FILM_ROWS} arriving="Safety inspections" />
        </LiveGround>
      </Board>

      <Board title="NotePane, AlertPane, FieldPane, Callout" note="The map note and the two-sources note, the certificate alert, the search, and a label on the planet or the map.">
        <div className="grid gap-4 sm:grid-cols-2">
          <NotePane eyebrow="Factory · approximate location" title="Nayapara, Kashimpur, Gazipur">
            The pin marks the area, not the building. From BGMEA and BKMEA.
          </NotePane>
          <NotePane tone="caution" eyebrow="2 sources differ">
            {DIFFER}
          </NotePane>
          <AlertPane when="Day 43 · 15 Nov 2026" title="A certificate is running out" due="Expires in 30 days · 15 Dec 2026" subject="Mondol Fabrics Ltd. · GOTS-19020" from="Issued by GSCS International Ltd." action="Ask for the renewal" />
          <LiveGround className="flex flex-col items-start gap-4 rounded-lg p-5">
            <FieldPane id="film-q" material="glass" />
            <div className="flex flex-wrap gap-2">
              <Callout place="Dhaka district" figure="4,421" on />
              <Callout place="Gazipur" figure="1,819" />
            </div>
          </LiveGround>
        </div>
      </Board>

      <Board title="Thread and rail" note="One green path: solid when it leads, stitched when it joins, a bartack where it ends. The rail is nine ticks, each a link, with the dot on the current chapter.">
        <div className="flex gap-10">
          <Rail chapters={FILM_CHAPTERS} current="ch-04" className="h-64" />
          <div className="relative h-64 flex-1">
            <ThreadLayer viewBox="0 0 400 260">
              <Thread d="M20 50C120 0 210 100 380 34" />
              <Thread d="M20 130H380" join />
              <Thread d="M20 210H300" end={{ x: 306, y: 210 }} />
            </ThreadLayer>
            <p className="absolute left-5 top-[70px] font-mono text-xs text-ink-3">leads</p>
            <p className="absolute left-5 top-[142px] font-mono text-xs text-ink-3">joins</p>
            <p className="absolute left-5 top-[222px] font-mono text-xs text-ink-3">ends in a bartack</p>
          </div>
        </div>
      </Board>

      <Board title="Overlock" note="The flat of scene 04: a 1.5px ink line, fills from the surface roles, green only for thread, the five source tags hung on their threads. The scroll turns the handwheel, drops the needle and draws the seam; at rest every part is still.">
        <figure className="flex flex-col gap-3">
          <Overlock className="h-auto w-full max-w-[460px]" />
          <figcaption className="font-mono text-xs text-ink-3">{OVERLOCK_CAPTION}</figcaption>
        </figure>
      </Board>

      <Board title="Receipt roll" note="The roll of scene 05: paper, not glass. Mono type, a perforation per receipt, a torn edge, printing out of its slot as the scroll moves; whole at rest. Beside it, the note where two sources differ.">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <ReceiptRoll receipts={RECEIPTS} />
          <NotePane tone="caution" eyebrow="2 sources differ" className="max-w-[280px]">
            {DIFFER}
          </NotePane>
        </div>
      </Board>

      <Board title="ScreenStage" note="A real screen on a stage: a window with no chrome, a spotlight on the part being talked about, a drawn cursor. The app has no dark theme, so the screen stays light in both.">
        <ScreenStage
          caption="Real v4 screen · Saved suppliers, 3 picked for one RFQ · the app is shown in its light theme"
          spot={{ x: 78, y: 86 }}
          cursor={{ x: 80, y: 88 }}
          // eslint-disable-next-line @next/next/no-img-element -- a gallery sample of the staged screen
          screen={<img src="/site/saved-selected.png" alt="" className="block h-auto w-full" />}
        />
      </Board>
    </div>
  );
}
