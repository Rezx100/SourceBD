"use client";

// The search page's carousel (M4): the snapshot's one search, "knit GOTS", then its first page narrowed twice with a
// chip, by district and by size, the way a buyer narrows a search. Every row is the snapshot's, so no narrowed slide
// claims a count of its own: it says how many of this page remain. A client file because the slides hold components.

import { ROWS, SearchStill } from "@/components/site/demos/search";
import type { Slide } from "@/components/site/sections/carousel";
import { formatCount } from "@/lib/dashboard/facts";
import { CAPTION, SNAPSHOT } from "@/lib/marketing/demo-snapshot";

const { chips, total } = SNAPSHOT.search;
const PLACE = "Gazipur";
const MIN_WORKERS = 1000;

type Row = (typeof ROWS)[number];

const still = (more: string[], rows: readonly Row[], right: string, note: string) =>
  function SearchSlide() {
    return (
      <div className="flex flex-col gap-3">
        <SearchStill chips={[...chips, ...more]} rows={rows} right={right} />
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
