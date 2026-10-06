// Scenes 04 and 05 (handoff-home-film §4): "02 · Who are they?", where the overlock joins five sources into one
// seam that becomes the record's Sources row, and "03 · Is that true?", where the receipt roll prints three claims
// beside their sources while the record gains three rows. Server-rendered, every word in the page, on every tier.
// On the full tier each scene holds while the scroll runs the machine or prints the roll (engine/chapters.ts); on
// the lite and still tiers both are stacked and whole, the old chapters restyled on Panes.

import { Overlock } from "@/components/site/film/flats";
import { NotePane, RecordPane } from "@/components/site/film/pane";
import { BGMEA, GOTS, LINE, NAME, SAFETY, SOURCES, SOURCE_DATES } from "@/components/site/film/record";
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
