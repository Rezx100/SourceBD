"use client";

// The search page's narrowing (M4; three stacked steps since the 22 Oct critique, which said a carousel hides two
// thirds of its content): the snapshot's one search, "knit GOTS", then its first page narrowed twice with a chip, by
// district and by size, the way a buyer narrows a search. Every row is the snapshot's, so no narrowed step claims a
// count of its own: it says how many of this page remain; the two narrowing chips are this page's words for the
// filters, not chips the product wrote. A client file because the steps hold components.

import type { ReactNode } from "react";
import { ROWS, SearchStill } from "@/components/site/demos/search";
import { formatCount } from "@/lib/dashboard/facts";
import { CAPTION, SNAPSHOT } from "@/lib/marketing/demo-snapshot";

const { chips, total } = SNAPSHOT.search;
const PLACE = "Gazipur";
const MIN_WORKERS = 1000;

type Row = (typeof ROWS)[number];

/** One step: its title, its words, and the still that shows it. */
export type Slide = { key: string; title: string; body: string; Slide: () => ReactNode };

const still = (more: string[], rows: readonly Row[], right: string, note: string) =>
  function SearchSlide() {
    return (
      <div className="flex flex-col gap-3">
        <SearchStill chips={[...chips, ...more]} rows={rows} right={right} description={`${note}: ${rows.length} ${rows.length === 1 ? "supplier" : "suppliers"}, with their place, workers and the certificates they hold today.`} />
        <p className="text-sm text-ink-subtle">
          {note} · {CAPTION}
        </p>
      </div>
    );
  };

const inPlace = ROWS.filter((r) => r.place === PLACE);
const large = ROWS.filter((r) => (r.workers ?? 0) >= MIN_WORKERS);
const ofPage = (rows: readonly Row[]) => `${rows.length} of this page`;

export const SEARCH_SLIDES: readonly Slide[] = [
  {
    key: "words",
    title: "By product and certificate",
    body: `“${chips.join(" ")}”: the suppliers whose products or certificates answer the words. The first page of ${formatCount(total) ?? "them"}.`,
    Slide: still([], ROWS, `${formatCount(total) ?? ROWS.length} suppliers`, "The first page of the search"),
  },
  {
    key: "place",
    title: "Then by district",
    body: `A district chip keeps the rows in one place. Here, ${PLACE}; the count and the pages follow the chip.`,
    Slide: still([PLACE], inPlace, ofPage(inPlace), `Narrowed to ${PLACE} from the first page`),
  },
  {
    key: "size",
    title: "Then by size",
    body: `Workers from ${formatCount(MIN_WORKERS)}: the figure each supplier filed with its register, never an estimate of ours.`,
    Slide: still([`${formatCount(MIN_WORKERS)}+ workers`], large, ofPage(large), `Narrowed to ${formatCount(MIN_WORKERS)} workers or more from the first page`),
  },
];

/** Every company the slides name. */
export const SLIDE_NAMES = ROWS.map((r) => r.name);

/** The three steps, one under the other: the words on the left, the still on the right from 1024. */
export function SearchSteps() {
  return (
    <ol aria-label="One search narrowed step by step" className="flex flex-col gap-14 md:gap-20">
      {SEARCH_SLIDES.map((s) => (
        <li key={s.key} className="grid items-center gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-14">
          <div className="flex flex-col gap-2">
            <h3 className="text-site-title font-medium text-ink-strong">{s.title}</h3>
            <p className="max-w-[440px] text-site-body text-ink-muted">{s.body}</p>
          </div>
          <s.Slide />
        </li>
      ))}
    </ol>
  );
}
