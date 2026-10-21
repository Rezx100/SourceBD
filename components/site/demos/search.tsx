"use client";

// Find (handoff-mercury-motion-sitewide.md §4.3): "knit GOTS" is typed, the two filter chips appear, the rows the
// search found stream in, and the cursor rests on Aboni Knitwear. The rows are the snapshot's, drawn with the
// results table's own parts (the kit's table, `Products`, `HeldMarks`): the app's `ResultsTable` needs the
// selection and router context a marketing page does not have, so this is the same columns drawn still. As the
// table stands on development (rounds 2 and 3, 14–15 Oct 2026; critique 22 Oct): the town alone, one worker figure,
// the schemes held today by name with no state, the sources count, and Save and Open at the row's end, seen on the
// hovered row. The exports column is left out: the snapshot holds no customs record.

import { BookmarkSimple, MagnifyingGlass, SidebarSimple } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { FilterChip, SelectCell, Table, Td, Th, Tr, Unpublished, buttonClass } from "@/components/kit";
import { ABSENT, certSummary } from "@/components/patterns/words";
import { matchedProducts } from "@/components/search/model";
import { HeldMarks, Products } from "@/components/search/row-parts";
import type { CursorState, Step } from "@/components/site/motion";
import { certScheme, daysUntil, displayName, formatCount, splitQualifier } from "@/lib/dashboard/facts";
import { motion } from "@/lib/design/tokens";
import { SNAPSHOT, TODAY } from "@/lib/marketing/demo-snapshot";
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

/**
 * The snapshot's rows as the table draws them: the product writes the name, the products that answered the search
 * come first, and the schemes held today are named (an ended certificate is not among them, as `resultRow` builds
 * them; a supplier whose every certificate has ended says so).
 */
export const ROWS = search.rows.map((r) => {
  const held = certSummary(r.certs.filter((c) => (daysUntil(c.expiresOn, TODAY) ?? 0) >= 0).map((c) => ({ scheme: certScheme(c.kind), expiresOn: c.expiresOn, markCode: c.kind })), TODAY);
  return { ...r, name: displayName(r.name), products: matchedProducts(r.products, search.q), held: held ? [held.first, ...held.others] : [], anyOnFile: r.certs.length > 0 };
});
type Row = (typeof ROWS)[number];

/** Where a column steps out as the window narrows: the place and the workers under 560, the sources and the row's end under 720. */
const narrow = "[@container_(max-width:559px)]:hidden";
const mid = "[@container_(max-width:719px)]:hidden";

/**
 * The results table: the app's columns, the place and the workers hidden under 560 wide, the sources and the row's end
 * under 720. `hot` is the hovered row, whose Save and Open show. Rows from `lit` on stand under a fade until the search
 * reaches them, so the table is never headers with no rows (critique 22 Oct, S5).
 */
function Rows({ rows, hot, lit = rows.length }: { rows: readonly Row[]; hot?: string | null; lit?: number }) {
  return (
    <Table>
      <thead>
        <tr>
          <SelectCell header label="Select all on this page" disabled readOnly checked={false} />
          <Th>Supplier</Th>
          <Th className={cn("w-28", narrow)}>Location</Th>
          <Th align="right" className={cn("w-20", narrow)}>
            Workers
          </Th>
          <Th className="w-[150px]">Certificates</Th>
          <Th align="right" className={cn("w-[72px]", mid)}>
            Sources
          </Th>
          <th scope="col" className={cn("h-row-head w-[76px] border-b border-line bg-subtle p-0", mid)}>
            <span className="sr-only">Actions</span>
          </th>
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
                {r.products || r.type !== "Factory" ? (
                  <span className="flex items-baseline gap-x-[5px] pt-0.5">
                    {r.type !== "Factory" ? <span className="shrink-0 whitespace-nowrap text-sm text-ink-3">{r.products ? `${r.type} ·` : r.type}</span> : null}
                    {r.products ? <Products products={r.products} /> : null}
                  </span>
                ) : null}
              </Td>
              <Td className={cn("max-w-0 text-ink", narrow)}>{r.place ? <span className="block truncate">{r.place.split(",")[0]}</span> : <Unpublished />}</Td>
              <Td align="right" className={cn("whitespace-nowrap tabular-nums text-ink", narrow)}>
                {formatCount(r.workers) ?? <Unpublished />}
              </Td>
              <Td className="py-1.5">{r.held.length ? <HeldMarks held={r.held} words /> : <Unpublished>{r.anyOnFile ? ABSENT.certificatesLapsed : ABSENT.certificates}</Unpublished>}</Td>
              <Td align="right" className={cn("tabular-nums text-ink", mid)}>
                {r.sources}
              </Td>
              <td className={cn("w-[76px] border-b border-line p-0 align-middle", mid)}>
                <span className={cn("flex items-center justify-center gap-1 transition-opacity duration-fast", hot === r.slug ? "opacity-100" : "opacity-0")}>
                  <span className={buttonClass({ kind: "quiet", size: "icon-32" })}>
                    <BookmarkSimple size={20} className="shrink-0" aria-hidden />
                  </span>
                  <span className={buttonClass({ kind: "quiet", size: "icon-32" })}>
                    <SidebarSimple size={20} className="shrink-0 -scale-x-100" aria-hidden />
                  </span>
                </span>
              </td>
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
 * The results as a still: the chips in the bar and under it, `rows` of the snapshot, nothing moving, so no pause
 * button. `right` is the bar's count; `description` is the one sentence a screen reader gets instead of the table, as
 * a demo's stage gives; `hot` draws one row hovered.
 */
export function SearchStill({ chips, rows, right, description, className, hot }: { chips: readonly string[]; rows: readonly Row[]; right?: ReactNode; description: string; className?: string; hot?: string | null }) {
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
          <Rows rows={rows} hot={hot} />
        </Window>
      </div>
    </figure>
  );
}

/** The search's end frame as a still: every row, Aboni Knitwear hovered (the home's hero, which hands over to the tour's Find). */
export function SearchEnd({ className }: { className?: string }) {
  return (
    <SearchStill
      chips={search.chips}
      rows={ROWS}
      hot={HOVER.slug}
      right={`${formatCount(search.total) ?? ROWS.length} suppliers`}
      description={`A search for ${QUERY}: ${formatCount(search.total) ?? "the"} suppliers found, with their place, workers, the certificate schemes they hold today and how many sources hold them.`}
      className={className}
    />
  );
}

export function DemoSearch(frame: Frame) {
  return (
    <Demo {...frame} steps={STEPS} description={`A search for ${QUERY}: ${formatCount(search.total) ?? "the"} suppliers found, with their place, workers, the certificate schemes they hold today and how many sources hold them.`}>
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
