// The film's middle (handoff-home-film §4, rebuilt after the founder's video of 7 Oct 2026): "One factory. One
// record.", where the overlock joins five sources into one seam; "Every claim, beside its source."; and "The list
// changes. We check again." Server-rendered, every word in the page, on every tier. The record card, the threads,
// the receipt roll, the second map and the export carton are gone ("these cards need to be killed", "this green
// line must be killed", "the same map is repeated again"); the export records, which carry no figure until v2, are
// said once in the FAQ's place, not given a scene.

import { Overlock } from "@/components/site/film/flats";
import { NAME, SOURCE_DATES } from "@/components/site/film/record";
import { Words } from "@/components/site/film/words";
import { wrap } from "@/components/site/parts";
import { cn } from "@/lib/utils";

const hold = "relative bg-surface text-ink";
// On the full tier a scene's content hangs from a fixed line a little above the middle, never centred.
const stage = "py-24 max-md:py-14 film-full:sticky film-full:top-0 film-full:flex film-full:h-svh film-full:items-start film-full:py-0 film-full:pt-[max(56px,calc(50svh-360px))]";
const row = cn(wrap, "flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between");
const left = "flex min-w-0 flex-col gap-10 lg:max-w-[560px]";
/** A scene's frame, shared with the later scenes (closing.tsx): the tall section, its stage that holds, the row, the words' column. */
export const SCENE = { hold, stage, row, left } as const;

/** The three claims of the proof scene and the record each is checked against, as the page without the film prints them. */
export type Receipt = { claim: string; source: string; fields: [string, string][] };
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

/** One factory, one record: the overlock runs with the scroll and the five sources' numbers stand beside it. */
export function SourcesScene() {
  return (
    <section id="ch-02" data-scene="sources" className={cn(hold, "film-full:h-[220svh]")}>
      <div className={stage}>
        <div className={row}>
          <div className={left}>
            <Words headline="One factory. One record." lede="Five registers file it under their own number, on their own date. We match them to one factory, and every fact keeps its source and the day we read it." />
            <div className="w-full max-w-[400px]">
              <SourceDates />
            </div>
          </div>
          <figure className="flex flex-col gap-3">
            {/* `self-start`: a flex column would stretch the drawing's box to the column and float it to the middle. */}
            <Overlock className="h-auto w-full max-w-[520px] self-start film-full:h-[clamp(360px,62svh,600px)] film-full:w-auto film-full:max-w-none" />
            <figcaption className="font-mono text-xs text-ink-3">{OVERLOCK_CAPTION}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

/** Every claim, beside its source; where two sources differ, both are shown. */
export function ProofScene() {
  return (
    <section id="ch-03" className="relative bg-surface py-24 text-ink max-md:py-14">
      <div className={cn(wrap, "flex flex-col gap-12")}>
        <Words headline="Every claim, beside its source." lede="The factory's word on one side, the register's record on the other: its number, who issued it and the day we read it. When two sources disagree, you see both." />
        <ol className="grid gap-10 md:grid-cols-3">
          {RECEIPTS.map((r) => (
            <li key={r.source} className="flex flex-col gap-3">
              <p className="text-lg text-ink-3">{r.claim}</p>
              <p className="text-base font-semibold text-ink">{r.source}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 border-t border-line pt-3 font-mono text-sm">
                {r.fields.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-3">{k}</dt>
                    <dd className="text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
        <p className="flex flex-col gap-1 border-t border-line pt-4 md:flex-row md:items-baseline md:gap-4">
          <span className="text-sm font-semibold text-caution">2 sources differ</span>
          <span className="text-base text-ink-2">{DIFFER}</span>
        </p>
      </div>
    </section>
  );
}

/** The three days the watch stops on, in words: every one in the page on every tier. */
export const DAYS: readonly [day: number, when: string][] = [
  [0, "3 Oct 2026 · shortlisted"],
  [43, "15 Nov 2026 · alert: GOTS-19020 has 30 days left"],
  [59, "1 Dec 2026 · new list copy · checked again"],
];
export const LIST_LINE = `Checked against the UFLPA Entity List · no link found · ${NAME} is not on the list · US DHS, our copy from 14 May 2026`;

/** The watch: saved suppliers are checked again, and the alert comes before the certificate runs out. */
export function WatchScene() {
  return (
    <section id="ch-04" className="relative bg-surface py-24 text-ink max-md:py-14">
      <div className={cn(wrap, "flex flex-col gap-12")}>
        <Words headline="The list changes. We check again." lede="Your saved suppliers are checked against our latest copy of the UFLPA Entity List. We say what we found, never “clear”." />
        <ol className="grid gap-8 md:grid-cols-3">
          {DAYS.map(([d, when]) => (
            <li key={d} className="flex flex-col gap-1 border-t border-line pt-3">
              <span className="font-mono text-xs text-ink-3">Day</span>
              <span className="text-3xl font-medium tracking-[-0.02em] text-ink">{d}</span>
              <span className="text-base text-ink-2">{when}</span>
            </li>
          ))}
        </ol>
        <p className="font-mono text-xs text-ink-3">{LIST_LINE}</p>
      </div>
    </section>
  );
}
