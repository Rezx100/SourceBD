// The film's middle (handoff-home-film §4, rebuilt after the founder's video of 7 Oct 2026): "One factory. One
// record.", the overlock large, threading the five sources in one by one and sewing the record in as a label;
// "Every claim, beside its source.", the record as the app draws it, each claim with the register's own record
// beside it; and "The list changes. We check again.", the app's watch on the same factory as the days pass. The
// product's pieces stand on a night stage whose ground moves (stage.tsx); nothing floats beside a scene, no thread
// ties one thing to another, and no card pops: the window holds still and what is in it changes. Server-rendered,
// every word in the page on every tier; the engine moves them on the full tier only (engine/chapters.ts).

import { ArrowRight, CheckCircle, MagnifyingGlass, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { CertChip, Chip, FactChip } from "@/components/kit";
import { SourceMark } from "@/components/patterns/source-mark";
import { CareLabel, Overlock } from "@/components/site/film/flats";
import { NAME, SOURCE_DATES } from "@/components/site/film/record";
import { AppWindow, RecordHead, Stage } from "@/components/site/film/stage";
import { Words } from "@/components/site/film/words";
import { Lede, wrap } from "@/components/site/parts";
import { cn } from "@/lib/utils";

const hold = "relative bg-surface text-ink";
// On the full tier a scene's content hangs from a fixed line near the top of the screen, never centred.
const stage = "py-24 max-md:py-14 film-full:sticky film-full:top-0 film-full:flex film-full:h-svh film-full:items-start film-full:py-0 film-full:pt-[max(48px,calc(50svh-400px))]";
const row = cn(wrap, "flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between");
const left = "flex min-w-0 flex-col gap-10 lg:max-w-[560px]";
/** A scene's frame, shared with the later scenes (closing.tsx): the tall section, its stage that holds, the row, the words' column. */
export const SCENE = { hold, stage, row, left } as const;

/** A scene's words as one line across the top: the headline at the left, the lede at the right, so the stage below has the width. */
export function Header({ headline, lede, children }: { headline: ReactNode; lede: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
      <Words headline={headline} className="lg:max-w-[600px]" />
      <div className="flex max-w-[440px] flex-col gap-4">
        <Lede className="max-w-[440px]">{lede}</Lede>
        {children}
      </div>
    </div>
  );
}

/** The three claims and the register each is checked against, as the page without the film prints them. */
export type Receipt = { claim: string; source: string; fields: [string, string][] };
export const RECEIPTS: Receipt[] = [
  { claim: "“A BGMEA member factory.”", source: "BGMEA member register", fields: [["reg. no.", "4002"], ["type", "general member"], ["name", NAME], ["read", "24 Jul 2026"]] },
  { claim: "“Organic cotton, GOTS certified.”", source: "GOTS certificate", fields: [["number", "GOTS-19020"], ["issued by", "GSCS International Ltd."], ["valid until", "15 Dec 2026"], ["read", "26 Jun 2026"]] },
  { claim: "“Safety inspected by RSC.”", source: "RSC factory record", fields: [["factory", "10861"], ["status", "covered by RSC"], ["initial items fixed", "100%"], ["read", "24 Jul 2026"]] },
];

export const OVERLOCK_CAPTION = "A five-thread overlock: the seam that holds knitwear together · illustration";
export const DIFFER = "RSC counted 2,060 workers in 2 buildings. BGMEA has 4,200 employees, as declared by the factory.";

/** The five sources with their numbers and dates, as bare type on hairlines (never a card): the page without the film's list. */
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

/** One factory, one record: the overlock, large, threads the five sources in and sews the record in as a label. */
export function SourcesScene() {
  return (
    <section id="ch-02" data-scene="sources" className={cn(hold, "film-full:h-[200svh]")}>
      <div className={stage}>
        <div className={cn(wrap, "flex flex-col gap-10 film-full:gap-6")}>
          <Header headline="One factory. One record." lede="Five registers file it under their own number, on their own date. We match them to one factory, and every fact keeps its source and the day we read it." />
          <figure className="flex flex-col gap-3">
            {/* The label hangs from the seam's end at the drawing's right edge (the seam sits 11.9% of the drawing's height above its foot). */}
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end film-full:relative film-full:block film-full:w-fit">
              <Overlock className="h-auto w-full max-w-[560px] self-start film-full:h-[min(60svh,580px)] film-full:w-auto film-full:max-w-none" />
              <CareLabel className="film-full:absolute film-full:bottom-[calc(11.9%-10px)] film-full:left-full" />
            </div>
            <figcaption className="font-mono text-xs text-ink-3">{OVERLOCK_CAPTION}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

/** A claim checked: the row as the record shows it, and the register's own record beside it, with what it found. */
type Proof = { label: string; value: string; mark?: string; read: string; claim?: string; source: string; fields: [string, string][]; found: ReactNode };
export const PROOF: Proof[] = [
  { label: "BGMEA membership", value: "General member · reg. no. 4002", mark: "BGMEA", read: "checked 24 Jul 2026", ...RECEIPTS[0]!, found: <Chip icon={CheckCircle}>The register agrees</Chip> },
  { label: "GOTS certificate", value: "GOTS-19020", mark: "GOTS", read: "checked 26 Jun 2026", ...RECEIPTS[1]!, found: <CertChip state="valid">Valid until 15 Dec 2026</CertChip> },
  { label: "Safety inspections", value: "Covered by RSC · factory 10861", mark: "RSC", read: "checked 24 Jul 2026", ...RECEIPTS[2]!, found: <Chip icon={ShieldCheck}>100% of initial items fixed</Chip> },
  { label: "Workers", value: "2,060 · 4,200", read: "RSC and BGMEA", source: "Two sources", fields: [["RSC", "2,060 workers in 2 buildings"], ["BGMEA", "4,200 employees, as declared by the factory"]], found: <FactChip state="disagree">2 sources differ</FactChip> },
];

/** Every claim, beside its source: the record's rows at the left of the window, the register's record of the row the scroll is on at the right. */
export function ProofScene() {
  return (
    <section id="ch-03" data-scene="proof" className={cn(hold, "film-full:h-[220svh]")}>
      <div className={stage}>
        <div className={cn(wrap, "flex flex-col gap-10 film-full:gap-8")}>
          <Header headline="Every claim, beside its source." lede="The factory's word on one side, the register's record on the other: its number, who issued it and the day we read it. When two sources disagree, you see both." />
          <Stage className="p-10 max-md:p-4">
            <AppWindow where={`Saved · ${NAME}`} label={`The supplier record of ${NAME}, as the app shows it`} aside={<span className="hidden text-sm text-ink-3 sm:inline">Overview</span>} className="mx-auto max-w-[920px]">
              <RecordHead className="border-b border-line" />
              <ol className="relative film-full:min-h-[300px] film-full:pr-[48%]">
                {PROOF.map((p, i) => (
                  <li key={p.label} data-proof data-on={i === 0 ? "" : undefined} className="group/proof border-b border-line last:border-b-0">
                    <div className="flex items-center gap-3 px-5 py-3.5 transition-colors duration-slow film-full:group-data-[on]/proof:bg-sunken">
                      {p.mark ? <SourceMark source={p.mark} lazy /> : <span aria-hidden className="size-6 shrink-0" />}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm text-ink-3">{p.label}</span>
                        <span className="truncate text-base font-medium text-ink">{p.value}</span>
                      </div>
                      <span className="shrink-0 text-xs text-ink-3 max-sm:hidden">{p.read}</span>
                      <ArrowRight size={14} aria-hidden className="hidden shrink-0 text-ink transition-opacity duration-slow film-full:block film-full:opacity-0 film-full:group-data-[on]/proof:opacity-100" />
                    </div>
                    {/* The register's own record: under its row when stacked, in the window's right pane on the full tier, the row the scroll is on. */}
                    <div className="flex flex-col gap-3 bg-subtle px-5 pb-5 pt-3 film-full:pointer-events-none film-full:absolute film-full:inset-y-0 film-full:right-0 film-full:w-[48%] film-full:border-l film-full:border-line film-full:pt-5 film-full:opacity-0 film-full:transition-opacity film-full:duration-slow film-full:group-data-[on]/proof:opacity-100">
                      {p.claim ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-ink-3">The claim</span>
                          <span className="text-lg text-ink">{p.claim}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2">
                        {p.mark ? <SourceMark source={p.mark} lazy /> : null}
                        <span className="text-sm font-medium text-ink">{p.source}</span>
                      </div>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                        {p.fields.map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="font-mono text-ink-3">{k}</dt>
                            <dd className="text-ink">{v}</dd>
                          </div>
                        ))}
                      </dl>
                      <div>{p.found}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </AppWindow>
          </Stage>
        </div>
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

/** A fact the watch holds, with what it says before its day and after it; `at` is the day it changes (none: it holds). */
type Watched = { label: string; detail: string; mark?: string; before: ReactNode; after?: ReactNode; at?: number; next?: string };
export const WATCHED: Watched[] = [
  { label: "GOTS certificate", detail: "GOTS-19020 · GSCS International Ltd.", mark: "GOTS", before: <CertChip state="valid">Valid until 15 Dec 2026</CertChip>, after: <CertChip state="expiring">30 days left · 15 Dec 2026</CertChip>, at: 43, next: "Next: ask for the renewal" },
  { label: "Safety inspections", detail: "RSC factory 10861", mark: "RSC", before: <Chip icon={ShieldCheck}>Covered by RSC</Chip> },
  { label: "BGMEA membership", detail: "reg. no. 4002", mark: "BGMEA", before: <Chip icon={CheckCircle}>General member</Chip> },
  { label: "UFLPA Entity List", detail: "US DHS", before: <Chip icon={MagnifyingGlass}>No link found · copy of 14 May</Chip>, after: <Chip icon={MagnifyingGlass}>No link found · copy of 1 Dec</Chip>, at: 59 },
];

/** The list changes, we check again: the app's watch on the same factory, the days passing on the window's bar. */
export function WatchScene() {
  return (
    <section id="ch-04" data-scene="watch" className={cn(hold, "film-full:h-[200svh]")}>
      <div className={stage}>
        <div className={cn(wrap, "flex flex-col gap-10 film-full:gap-8")}>
          <Header headline="The list changes. We check again." lede="Your saved suppliers are checked against our latest copy of the UFLPA Entity List, and every certificate date is watched. We say what we found, never “clear”.">
            <ol data-days className="flex flex-col gap-1 text-sm">
              {DAYS.map(([d, when], i) => (
                <li key={d} data-on={i === 0 ? "" : undefined} className="flex gap-3 text-ink-2 transition-colors duration-slow film-full:text-ink-3 film-full:data-[on]:text-ink">
                  <span className="w-14 shrink-0 font-mono">Day {d}</span>
                  <span>{when}</span>
                </li>
              ))}
            </ol>
          </Header>
          <Stage className="p-10 max-md:p-4">
            <AppWindow
              where="Compliance · watching 1 supplier"
              label={`The compliance watch on ${NAME}, as the app shows it`}
              className="mx-auto max-w-[920px]"
              aside={
                <span data-watch-date className="flex items-center gap-2 rounded-sm bg-sunken px-2 py-1 font-mono text-xs text-ink-2">
                  {DAYS.map(([d, when], i) => (
                    <span key={d} data-on={i === DAYS.length - 1 ? "" : undefined} className="sr-only data-[on]:not-sr-only">
                      {when.split(" · ")[0]}
                    </span>
                  ))}
                </span>
              }
            >
              <RecordHead className="border-b border-line" />
              <ul>
                {WATCHED.map((w) => (
                  <li key={w.label} data-watched data-at={w.at} className="group/w flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3.5 transition-colors duration-slow last:border-b-0 film-full:data-[due]:bg-sunken">
                    {w.mark ? <SourceMark source={w.mark} lazy /> : <span aria-hidden className="size-6 shrink-0" />}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-base font-medium text-ink">{w.label}</span>
                      <span className="truncate text-sm text-ink-3">{w.detail}</span>
                    </div>
                    {/* Before its day and after it: stacked, the page shows where it ends; on the full tier the engine sets the day (`data-due`). */}
                    {w.after ? (
                      <>
                        <span className="hidden film-full:inline-flex film-full:group-data-[due]/w:hidden">{w.before}</span>
                        <span className="inline-flex flex-col items-end gap-1 film-full:hidden film-full:group-data-[due]/w:inline-flex">
                          {w.after}
                          {w.next ? <span className="text-xs font-medium text-ink">{w.next}</span> : null}
                        </span>
                      </>
                    ) : (
                      w.before
                    )}
                  </li>
                ))}
              </ul>
            </AppWindow>
          </Stage>
          <p className="font-mono text-xs text-ink-3">{LIST_LINE}</p>
        </div>
      </div>
    </section>
  );
}
