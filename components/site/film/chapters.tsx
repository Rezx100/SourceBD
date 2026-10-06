// Scenes 04 to 08 (handoff-home-film §4): "02 · Who are they?", where the overlock joins five sources into one seam
// that becomes the record's Sources row; "03 · Is that true?", where the receipt roll prints three claims beside
// their sources while the record gains three rows; "04 · Where are they?", where the live map tilts down on to the
// factory's area and the record gains Site; "05 · Who do they ship to?", one blank carton until export records are
// live; and "06 · Will it still be true next month?", where the scroll is the calendar and the alert comes before the
// certificate runs out. Server-rendered, every word in the page, on every tier. On the full tier each scene holds
// while the scroll moves it (engine/chapters.ts); on the lite and still tiers all are stacked and whole, the old
// chapters restyled on Panes, with a picture where the map was live.

import type { CSSProperties } from "react";
import { TIME } from "@/components/site/film/engine/chapters";
import { Carton, Overlock } from "@/components/site/film/flats";
import { MAP_CREDIT, MapStill } from "@/components/site/film/opening";
import { AlertPane, NotePane, RecordPane } from "@/components/site/film/pane";
import { BGMEA, EXPORTS, GOTS, GOTS_DUE, LINE, NAME, SAFETY, SITE, SOURCES, SOURCE_DATES, UFLPA } from "@/components/site/film/record";
import { ReceiptRoll, type Receipt } from "@/components/site/film/receipts";
import { Thread, ThreadLayer } from "@/components/site/film/thread";
import { Words } from "@/components/site/film/words";
import { wrap } from "@/components/site/parts";
import { cn } from "@/lib/utils";

const hold = "relative bg-surface text-ink";
const stage = "py-24 max-md:py-14 film-full:sticky film-full:top-0 film-full:flex film-full:h-svh film-full:items-center film-full:py-0";
// The record stands at the top beside the words and only ever grows downward as its rows arrive, so nothing that has arrived moves again.
const row = cn(wrap, "flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between");
const left = "flex min-w-0 flex-col gap-10 lg:max-w-[680px]";
/** A scene's frame, shared with the later scenes (closing.tsx): the tall section, its stage that holds, the row of words and record, the words' column. */
export const SCENE = { hold, stage, row, left } as const;

/** The three claims of chapter 03 and the receipt each is checked against, as the page without the film prints them. */
export const RECEIPTS: Receipt[] = [
  { claim: "“A BGMEA member factory.”", source: "BGMEA member register", fields: [["reg. no.", "4002"], ["type", "general member"], ["name", NAME], ["read", "24 Jul 2026"]] },
  { claim: "“Organic cotton, GOTS certified.”", source: "GOTS certificate", fields: [["number", "GOTS-19020"], ["issued by", "GSCS International Ltd."], ["valid until", "15 Dec 2026"], ["read", "26 Jun 2026"]] },
  { claim: "“Safety inspected by RSC.”", source: "RSC factory record", fields: [["factory", "10861"], ["status", "covered by RSC"], ["initial items fixed", "100%"], ["read", "24 Jul 2026"]] },
];

export const OVERLOCK_CAPTION = "A five-thread overlock: the seam that holds knitwear together · illustration";
export const DIFFER = "RSC counted 2,060 workers in 2 buildings. BGMEA has 4,200 employees, as declared by the factory.";

/** The five sources with their numbers and dates, as bare type on hairlines (never a card). The page without the film draws the same list. */
export function SourceDates() {
  return (
    <ul className="flex flex-col divide-y divide-line border-y border-line">
      {SOURCE_DATES.map(([s, n]) => (
        <li key={s} className="flex items-baseline justify-between gap-4 py-3">
          <span className="text-base font-semibold text-ink">{s}</span>
          <span className="font-mono text-xs text-ink-3">{n}</span>
        </li>
      ))}
    </ul>
  );
}

/** 04 · the overlock: five sources, one seam. The seam leaves the drawing and ties on to the record's first row. */
export function SourcesScene() {
  return (
    <section id="ch-02" data-scene="sources" data-chapter="ch-02" className={cn(hold, "film-full:h-[400svh]")}>
      <div className={stage}>
        <div className={row}>
          <div className={left}>
            <Words label="02 · Who are they?" headline="One factory. One record." lede="Five registers file it under their own number, on their own date. We match them to one factory, and every fact keeps the source it came from and the day we read it." />
            <figure className="flex flex-col gap-3 lg:ml-16">
              {/* `self-start`: a flex column would stretch the drawing's box to the column and float it to the middle. */}
              <Overlock className="h-auto w-full max-w-[460px] self-start film-full:h-[clamp(300px,52svh,480px)] film-full:w-auto film-full:max-w-none" />
              <figcaption className="font-mono text-xs text-ink-3">{OVERLOCK_CAPTION}</figcaption>
            </figure>
          </div>
          {/* Under the record, in words: each source's own number and the day we read it, as the page without the film lists them. */}
          <div className="flex w-full max-w-[400px] flex-col gap-6 lg:shrink-0">
            <RecordPane name={NAME} line={LINE} rows={[{ ...SOURCES, beat: true }]} />
            <SourceDates />
          </div>
        </div>
        {/* The runtime fits the layer to the stage and draws the thread from the seam's end to the row. */}
        <ThreadLayer viewBox="0 0 1 1" className="hidden film-full:block">
          <g data-tie>
            <Thread d="M0 0" join />
          </g>
        </ThreadLayer>
      </div>
    </section>
  );
}

/** 05 · the receipt roll: every claim beside its source; where two sources differ, both are shown. */
export function ReceiptsScene() {
  return (
    <section id="ch-03" data-scene="receipts" data-chapter="ch-03" className={cn(hold, "film-full:h-[460svh]")}>
      <div className={stage}>
        <div className={row}>
          <div className={left}>
            <Words label="03 · Is that true?" headline="Every claim, beside its source." lede="A factory says it is a BGMEA member, and the BGMEA register says so too, under number 4002. The certificate is on file: its number, who issued it and when it runs out. Safety comes from the RSC record. When two sources disagree, you see both." />
            <ReceiptRoll receipts={RECEIPTS} />
          </div>
          {/* The note sits under the record, by the row it is about, where no thread crosses it. */}
          <div className="flex w-full max-w-[400px] flex-col gap-6 lg:shrink-0">
            <RecordPane name={NAME} line={LINE} rows={[SOURCES, { ...BGMEA, beat: true }, { ...GOTS, beat: true }, { ...SAFETY, beat: true }]} />
            <div data-beat="">
              <NotePane tone="caution" eyebrow="2 sources differ">
                {DIFFER}
              </NotePane>
            </div>
          </div>
        </div>
        <ThreadLayer viewBox="0 0 1 1" className="hidden film-full:block">
          {RECEIPTS.map((r) => (
            <g key={r.source} data-tie>
              <Thread d="M0 0" join />
            </g>
          ))}
        </ThreadLayer>
      </div>
    </section>
  );
}

/** The note on the ring (§3.6): the registers give an area, not a building, so the ring is about a kilometre wide. */
export const SITE_NOTE = { eyebrow: "Factory · approximate location", title: "Nayapara, Kashimpur, Gazipur", body: "The ring marks the area, not the building. From BGMEA and BKMEA." } as const;

/** 06 · the address: the one live map, tilted down on to the factory's area, is the ground; the ring opens; the Site row is sewn on. */
export function SiteScene() {
  return (
    <section id="ch-04" data-scene="site" data-chapter="ch-04" className={cn(hold, "film-full:h-[420svh]")}>
      <div className={cn(stage, "film-full:isolate film-full:overflow-hidden")}>
        {/* The map's stage moves in here (engine/start.ts) when scene 05 has run its hold, and back when it has not. The other tiers get a picture of the same close. */}
        <div data-map-site aria-hidden className="absolute inset-0 hidden film-full:block" />
        {/* `relative`: the map is laid under the stage, so the words must stack above it. The words keep to 460px so the ring has the middle. */}
        <div className={cn(row, "relative")}>
          <div className={cn(left, "lg:max-w-[460px]")}>
            <Words label="04 · Where are they?" headline="One address, on the map." lede="The address comes from the registers. Where the pin is only close, we say so." />
            <MapStill name="map-site" />
            <p className="font-mono text-xs text-ink-3 film-full:hidden">{MAP_CREDIT}</p>
          </div>
          {/* Glass: the map is live under both. */}
          <div className="flex w-full max-w-[400px] flex-col gap-6 lg:shrink-0">
            <RecordPane material="glass" name={NAME} line={LINE} rows={[SOURCES, BGMEA, GOTS, SAFETY, { ...SITE, beat: true }]} />
            <div data-beat="">
              <NotePane material="glass" eyebrow={SITE_NOTE.eyebrow} title={SITE_NOTE.title}>
                {SITE_NOTE.body}
              </NotePane>
            </div>
          </div>
        </div>
        <ThreadLayer viewBox="0 0 1 1" className="hidden film-full:block">
          <g data-tie>
            <Thread d="M0 0" join />
          </g>
        </ThreadLayer>
        <p data-map-credit className="absolute bottom-6 right-6 hidden font-mono text-xs text-ink-3 film-full:block">{MAP_CREDIT}</p>
      </div>
    </section>
  );
}

export const CARTON_CAPTION = "An export carton, blank until the records are live · illustration";
/** What the carton will carry, in words, as the page without the film says it. */
export const EXPORT_LINES = ["Export records, per supplier", "Each record will show the date, the product and its HS code, pieces, FOB per piece, the buyer, the destination, and sea or air.", "From Bangladesh customs export records. Used to cross-check, never to replace a register."] as const;

/** 07 · the export carton: one, blank, "Coming in v2". No figure until export records are live. */
export function ExportsScene() {
  return (
    <section id="ch-05" data-scene="exports" data-chapter="ch-05" className={cn(hold, "film-full:h-[300svh]")}>
      <div className={stage}>
        <div className={row}>
          <div className={left}>
            <Words label="05 · Who do they ship to?" headline="Export records are coming." lede="Export records arrive in v2. Until then this chapter shows no figures." />
            <div className="flex flex-col gap-8 md:flex-row md:items-end">
              <figure className="flex flex-col gap-3">
                <Carton className="h-auto w-full max-w-[360px] self-start film-full:h-[clamp(180px,30svh,280px)] film-full:w-auto film-full:max-w-none" />
                <figcaption className="font-mono text-xs text-ink-3">{CARTON_CAPTION}</figcaption>
              </figure>
              {/* Bare type on a hairline, never a card. */}
              <div className="flex max-w-[300px] flex-col gap-2 border-t border-line pt-4">
                <p className="text-md font-semibold text-ink">{EXPORT_LINES[0]}</p>
                <p className="text-base text-ink-2">{EXPORT_LINES[1]}</p>
                <p className="text-sm text-ink-3">{EXPORT_LINES[2]}</p>
              </div>
            </div>
          </div>
          <div className="flex w-full max-w-[400px] flex-col gap-6 lg:shrink-0">
            <RecordPane name={NAME} line={LINE} rows={[SOURCES, BGMEA, GOTS, SAFETY, SITE, { ...EXPORTS, beat: true }]} />
          </div>
        </div>
        <ThreadLayer viewBox="0 0 1 1" className="hidden film-full:block">
          <g data-tie>
            <Thread d="M0 0" join />
          </g>
        </ThreadLayer>
      </div>
    </section>
  );
}

/** The three days the calendar stops on, in words: every one in the page on every tier. */
export const DAYS: readonly [day: number, when: string][] = [
  [0, "3 Oct 2026 · shortlisted"],
  [43, "15 Nov 2026 · alert: GOTS-19020 has 30 days left"],
  [59, "1 Dec 2026 · new list copy · checked again"],
];
export const ALERT = { when: "Day 43 · 15 Nov 2026", title: "A certificate is running out", due: "Expires in 30 days · 15 Dec 2026", subject: `${NAME} · GOTS-19020`, from: "Issued by GSCS International Ltd.", action: "Ask for the renewal" } as const;
export const LIST_LINE = `Checked against the UFLPA Entity List · no link found · ${NAME} is not on the list · US DHS, our copy from 14 May 2026`;

/** The calendar's dates, by day from 3 Oct 2026. */
const DATES: readonly [day: number, label: string][] = [[0, "3 Oct"], [29, "1 Nov"], [59, "1 Dec"], [73, "15 Dec"]];
const X0 = 8, X1 = 672;
const x = (day: number) => X0 + ((X1 - X0) * day) / TIME.days;
/** A mark's own share of the span: the line reaches it, then it shows (`.time-mark` in app/ds.css reads `--at`). */
const at = (day: number) => ({ "--at": (day / TIME.days).toFixed(3) }) as CSSProperties;

/** The time line (§3.9): words and lines only. On the full tier the scroll draws it (`--t`); with nothing written it is whole. Decoration: the days are listed in words beside it. */
export function TimeLine() {
  return (
    <svg data-timeline aria-hidden viewBox="0 0 680 84" className="block w-full max-w-[680px] overflow-visible">
      <path d={`M${X0} 44H${X1}`} className="fill-none stroke-line" strokeWidth={2} />
      {DATES.map(([d, label]) => (
        <g key={d}>
          <path d={`M${x(d)} 38V50`} className="fill-none stroke-line-strong" strokeWidth={1.2} />
          <text x={x(d)} y={24} textAnchor={d === 0 ? "start" : d === TIME.days ? "end" : "middle"} fontSize={12} className="fill-ink-3 font-mono">
            {label}
          </text>
        </g>
      ))}
      <path d={`M${X0} 44H${X1}`} pathLength={1} className="time-run fill-none stroke-ink" strokeWidth={3} strokeLinecap="round" />
      <circle cx={x(0)} cy={44} r={6} className="fill-brand-ink" />
      <circle cx={x(TIME.marks[1])} cy={44} r={6} className="time-mark fill-caution-icon" style={at(TIME.marks[1])} />
      <circle cx={x(TIME.marks[2])} cy={44} r={4} className="time-mark fill-ink" style={at(TIME.marks[2])} />
      <circle cx={x(TIME.days)} cy={44} r={5} className="fill-surface stroke-ink" strokeWidth={1.4} />
      <text x={x(0)} y={74} fontSize={12} className="fill-ink-3 font-mono">
        Day 0 · shortlisted
      </text>
      <text x={x(TIME.marks[1])} y={74} textAnchor="middle" fontSize={12} className="time-mark fill-caution font-mono" style={at(TIME.marks[1])}>
        Day 43 · alert
      </text>
      <text x={x(TIME.marks[2])} y={74} textAnchor="middle" fontSize={12} className="time-mark fill-ink-3 font-mono" style={at(TIME.marks[2])}>
        Day 59 · checked again
      </text>
    </svg>
  );
}

/** 08 · time moves: the day counter, the time line, the alert at day 43 (the GOTS row turns amber), the list checked again at day 59. */
export function TimeScene() {
  return (
    <section id="ch-06" data-scene="time" data-chapter="ch-06" className={cn(hold, "film-full:h-[460svh]")}>
      <div className={stage}>
        <div className={row}>
          <div className={left}>
            <Words label="06 · Will it still be true next month?" headline="The list changes. We check again." lede="Your saved suppliers are checked against our latest copy of the UFLPA Entity List. We say what we found, never “clear”." />
            <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-10">
              {/* Every day is in the page; on the full tier the last one reached shows, whole, as the scroll moves the calendar. */}
              <ol data-days className="flex flex-col gap-4 md:min-w-[280px] md:shrink-0 film-full:block">
                {DAYS.map(([d, when], i) => (
                  <li key={d} data-on={i === 0 ? "" : undefined} className="flex flex-col gap-1 border-t border-ink pt-3 film-full:sr-only film-full:data-[on]:not-sr-only film-full:data-[on]:flex film-full:data-[on]:border-0 film-full:data-[on]:pt-0">
                    <span className="font-mono text-xs text-ink-3">Day</span>
                    <span className="font-mono text-2xl font-semibold text-ink film-full:font-sans film-full:text-film-figure film-full:leading-[0.9] film-full:tracking-[-0.04em]">{d}</span>
                    <span className="text-base text-ink-2">{when}</span>
                  </li>
                ))}
              </ol>
              <div data-beat="" className="w-full max-w-[360px]">
                <AlertPane {...ALERT} />
              </div>
            </div>
            <TimeLine />
            <p data-beat="" className="font-mono text-xs text-ink-3">
              {LIST_LINE}
            </p>
          </div>
          <div className="flex w-full max-w-[400px] flex-col gap-6 lg:shrink-0">
            <RecordPane name={NAME} line={LINE} rows={[SOURCES, BGMEA, GOTS_DUE, SAFETY, SITE, EXPORTS, { ...UFLPA, beat: true }]} />
          </div>
        </div>
      </div>
    </section>
  );
}
