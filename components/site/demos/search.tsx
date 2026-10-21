"use client";

// Find (handoff-mercury-motion-sitewide.md §4.3): "knit GOTS" is typed, the two filter chips appear, the rows the
// search found stream in, and the cursor rests on Aboni Knitwear. The rows are the snapshot's, drawn with the
// results table's own parts (the kit's table, `Products`, `HeldMarks`): the app's `ResultsTable` needs the
// selection and router context a marketing page does not have, so this is the same columns drawn still.

import { MagnifyingGlass } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { FilterChip, SelectCell, Table, Td, Th, Tr, Unpublished } from "@/components/kit";
import { ABSENT, certSummary } from "@/components/patterns/words";
import { matchedProducts } from "@/components/search/model";
import { HeldMarks, Products } from "@/components/search/row-parts";
import type { CursorState, Step } from "@/components/site/motion";
import { displayName, formatCount, splitQualifier } from "@/lib/dashboard/facts";
import { motion } from "@/lib/design/tokens";
import { SNAPSHOT, TODAY, certInput } from "@/lib/marketing/demo-snapshot";
import { cn } from "@/lib/utils";
import { Bar, Demo, Window, endOf, streamed, typed, type Frame } from "./stage";

const { search } = SNAPSHOT;
const QUERY = search.chips.join(" ");
const HOVER = search.rows.find((r) => r.slug === "aboni-knitwear") ?? search.rows[0]!;

/** Every company the demo names. */
export const NAMES = search.rows.map((r) => displayName(r.name));

type S = CursorState & { typed: string; chips: boolean; rows: number; hover: boolean };

const still = (over: Partial<S>): S => ({ typed: QUERY, chips: true, rows: search.rows.length, hover: false, ...over });
const t0 = 600;
const typing = typed(QUERY, t0, (typed) => still({ typed, chips: false, rows: 0 }));
const t1 = endOf(typing) + 500;
const streaming = streamed(search.rows.length, t1 + 400, (rows) => still({ rows }));
const t2 = endOf(streaming) + 700;

export const STEPS: Step<S>[] = [
  { at: 0, state: still({ typed: "", chips: false, rows: 0 }) },
  ...typing,
  { at: t1, state: still({ rows: 0 }) },
  ...streaming,
  { at: t2, state: still({ cursor: `row-${HOVER.slug}` }) },
  { at: t2 + motion.cursorMs + 100, state: still({ cursor: `row-${HOVER.slug}`, hover: true }) },
];

/** The snapshot's rows as the table draws them: the product writes the name, the words that answered the search are lit, the certificates held today. */
export const ROWS = search.rows.map((r) => {
  const held = certSummary(r.certs.filter((c) => !c.expiresOn || c.expiresOn >= SNAPSHOT.readAt).map(certInput), TODAY);
  return { ...r, name: displayName(r.name), products: matchedProducts(r.products, search.q), held: held ? [held.first, ...held.others] : [] };
});
type Row = (typeof ROWS)[number];

/**
 * The results table: the same columns at every width, the place and the workers hidden under 640 wide; `hot` is the
 * hovered row's slug. Rows from `lit` on stand under a fade until the search reaches them, so the table is never
 * headers with no rows (critique 22 Oct, S5).
 */
function Rows({ rows, hot, lit = rows.length }: { rows: readonly Row[]; hot?: string | null; lit?: number }) {
  return (
    <Table>
      <thead>
        <tr>
          <SelectCell header label="Select all on this page" disabled readOnly checked={false} />
          <Th>Supplier</Th>
          <Th className="w-28 [@container_(max-width:639px)]:hidden">Location</Th>
          <Th align="right" className="w-20 [@container_(max-width:639px)]:hidden">
            Workers
          </Th>
          <Th className="w-28">Certificates</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const { base, qualifier } = splitQualifier(r.name);
          return (
            <Tr key={r.slug} data-cursor={`row-${r.slug}`} className={cn("h-16 transition-opacity duration-slow motion-reduce:transition-none", i >= lit && "opacity-40", hot === r.slug && "bg-sunken")}>
              <SelectCell label={`Select ${r.name}`} disabled readOnly checked={false} />
              <Td className="max-w-0">
                <span className="block truncate text-base font-semibold text-ink" title={r.name}>
                  {base}
                </span>
                {qualifier ? <span className="block truncate text-xs text-ink-3">{qualifier}</span> : null}
                {r.products ? <Products products={r.products} className="pt-0.5" /> : null}
              </Td>
              <Td className="text-ink [@container_(max-width:639px)]:hidden">{r.place ?? <Unpublished />}</Td>
              <Td align="right" className="tabular-nums text-ink [@container_(max-width:639px)]:hidden">
                {formatCount(r.workers) ?? <Unpublished />}
              </Td>
              <Td>{r.held.length ? <HeldMarks held={r.held} /> : <Unpublished>{ABSENT.certificates}</Unpublished>}</Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}

/** The chips under the bar, as the app draws them. */
function Chips({ chips }: { chips: readonly string[] }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-4">
      {chips.map((c) => (
        <FilterChip key={c} removeHref="#" removeLabel={`Remove ${c}`}>
          {c}
        </FilterChip>
      ))}
    </div>
  );
}

/**
 * The results as a still (M4, the search page's carousel): the chips in the bar and under it, `rows` of the
 * snapshot, nothing moving, so no pause button. `right` is the bar's count; `description` is the one sentence a
 * screen reader gets instead of the table, as a demo's stage gives.
 */
export function SearchStill({ chips, rows, right, description, className }: { chips: readonly string[]; rows: readonly Row[]; right?: ReactNode; description: string; className?: string }) {
  return (
    <figure data-ground="day" className={cn("rounded-frame shadow-lg", className)}>
      <figcaption className="sr-only">{description}</figcaption>
      <div aria-hidden className="select-none">
      <Window>
        <Bar
          title={
            <span className="flex items-center gap-2">
              <MagnifyingGlass size={16} className="shrink-0 text-ink-3" aria-hidden />
              <span className="truncate">{chips.join(" ")}</span>
            </span>
          }
        >
          {right ? <span className="shrink-0 text-sm text-ink-3">{right}</span> : null}
        </Bar>
        <Chips chips={chips} />
        <Rows rows={rows} />
      </Window>
      </div>
    </figure>
  );
}

export function DemoSearch(frame: Frame) {
  return (
    <Demo {...frame} steps={STEPS} description={`A search for ${QUERY}: ${formatCount(search.total) ?? "the"} suppliers found, with their place, workers and the certificates they hold today.`}>
      {(s) => (
        <Window>
          <Bar
            title={
              <span className="flex items-center gap-2">
                <MagnifyingGlass size={16} className="shrink-0 text-ink-3" aria-hidden />
                <span className={cn("truncate", !s.typed && "font-normal text-ink-3")}>{s.typed || "Supplier, product or certificate"}</span>
                {s.typed && !s.chips ? <span aria-hidden className="h-4 w-px animate-pulse bg-ink" /> : null}
              </span>
            }
          >
            {s.chips ? <span className="shrink-0 text-sm text-ink-3">{formatCount(search.total)} suppliers</span> : null}
          </Bar>
          <Chips chips={s.chips ? search.chips : []} />
          <Rows rows={ROWS} lit={s.rows} hot={s.hover ? HOVER.slug : null} />
        </Window>
      )}
    </Demo>
  );
}
