// HS codes as Paper draws them (`10 · HS codes by chapter`, `11 · HS codes by chapter`): from 768 a
// grid of chapters with the open one's headings in a table under it; on a phone every chapter is a row
// that opens in place. A search lists matching headings across chapters. Server components: a chapter,
// the sort and "more" are the address, so Back works and nothing needs a script.

import { CaretDown, CaretRight, CaretUp, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Empty, ErrorPanel, Segmented, Skeleton, Table, TableFrame, Td, Th, Tr, buttonClass, rowLinkClass } from "@/components/kit";
import { cn } from "@/lib/utils";
import {
  CATALOGUE_ERROR_BODY,
  CATALOGUE_ERROR_TITLE,
  HEADINGS_TITLE,
  SEARCH_PLACEHOLDER,
  groupTitle,
  headingsHref,
  headingsWord,
  moreLine,
  searchHref,
  sortHeadings,
  suppliersWord,
  type Chapter,
  type Heading,
  type SortKey,
} from "./words";

const FOCUS = "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** The title, what the counts mean, and the search. Named, because the top bar has a `search` landmark too. */
export function HeadingsHead({ caption, q }: { caption: string; q: string }) {
  return (
    <header className="flex shrink-0 flex-col gap-3 px-6 pt-7 max-md:px-4 max-md:pt-4">
      <div className="flex items-end justify-between gap-6 max-md:flex-col max-md:items-stretch max-md:gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-ink max-md:sr-only">{HEADINGS_TITLE}</h1>
          <p className="text-base text-ink-3">{caption}</p>
        </div>
        <form aria-label="Search HS headings" action="/app/headings" method="get" role="search" className="relative w-[20rem] shrink-0 max-md:w-full">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-[9px] top-1/2 -translate-y-1/2 text-ink-3 max-md:left-3 max-md:size-5" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={SEARCH_PLACEHOLDER}
            aria-label={SEARCH_PLACEHOLDER}
            className="h-control w-full rounded-sm border border-line-strong bg-surface pl-[34px] pr-2.5 text-base text-ink outline-none placeholder:text-ink-3 hover:border-ink-3 focus:border-brand-ink focus:[box-shadow:inset_0_0_0_1px_theme(colors.brand-ink)] max-md:h-input-touch max-md:pl-10 max-md:text-md"
          />
        </form>
      </div>
    </header>
  );
}

function ChapterCard({ c, current, href }: { c: Chapter; current: boolean; href: string }) {
  return (
    <Link href={href} prefetch={false} aria-current={current ? "true" : undefined} className={cn("flex flex-col gap-1 rounded-md border p-3", FOCUS, current ? "border-brand-ink bg-brand-tint" : "border-line hover:bg-subtle")}>
      <span className="font-mono text-sm text-ink-3">{c.code}</span>
      <span className="text-base font-semibold text-ink">{c.name}</span>
      <span className="text-sm text-ink-3">{headingsWord(c.headings.length)}</span>
    </Link>
  );
}

/** The chapter grid from 768: Paper's listed chapters, then "N more chapters" (or all of them once asked for). */
export function ChapterGrid({ primary, more, showMore, open, sort }: { primary: Chapter[]; more: Chapter[]; showMore: boolean; open: string | null; sort: SortKey }) {
  const cards = showMore ? [...primary, ...more] : primary;
  return (
    <section aria-label="Chapters" className="px-6 pt-6 max-md:hidden">
      <h2 className="pb-3 text-sm font-medium text-ink-3">{groupTitle(primary.length)}</h2>
      <div className="grid grid-cols-4 gap-3 max-xl:grid-cols-3">
        {cards.map((c) => (
          <ChapterCard key={c.code} c={c} current={c.code === open} href={headingsHref({ chapter: c.code, sort, more: showMore })} />
        ))}
        {more.length > 0 && !showMore ? (
          <Link href={headingsHref({ chapter: open, sort, more: true })} prefetch={false} className={cn("flex flex-col justify-center gap-1 rounded-md border border-dashed border-line-strong p-3 hover:bg-subtle", FOCUS)}>
            <span className="flex items-center gap-1 text-base font-semibold text-ink">
              {moreLine(more.length)}
              <CaretRight size={16} aria-hidden />
            </span>
            <span className="text-sm text-ink-3">trims, packaging, other</span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function SortTabs({ chapter, sort, more }: { chapter: string; sort: SortKey; more: boolean }) {
  return (
    <Segmented
      name="sort"
      label="Sort headings"
      value={sort}
      options={[
        { value: "code", label: "By code", href: headingsHref({ chapter, sort: "code", more }) },
        { value: "suppliers", label: "Most suppliers", href: headingsHref({ chapter, sort: "suppliers", more }) },
      ]}
    />
  );
}

function HeadingRows({ rows }: { rows: readonly Heading[] }) {
  return (
    <TableFrame>
      <Table aria-label="HS headings">
        <thead>
          <tr>
            <Th className="w-[96px]">HS code</Th>
            <Th>Heading</Th>
            <Th align="right" className="w-[180px]">
              Suppliers who export it
            </Th>
            <th scope="col" className="h-row-head w-[120px] border-b border-line bg-subtle p-0">
              <span className="sr-only">Search</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <Tr key={h.hs}>
              <Td className="font-mono">{h.hs}</Td>
              <Td>{h.label ?? <span className="text-ink-3">No heading text</span>}</Td>
              <Td align="right" className="tabular-nums">
                {suppliersWord(h.exporters)}
              </Td>
              <Td>
                <Link href={searchHref(h.hs)} prefetch={false} aria-label={`Search suppliers that export ${h.hs}`} className={rowLinkClass}>
                  Search them
                </Link>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableFrame>
  );
}

/** The open chapter's headings from 768: its name, the two sorts, and the table. */
export function OpenChapter({ chapter, sort, more }: { chapter: Chapter; sort: SortKey; more: boolean }) {
  return (
    <section aria-label={`${chapter.name} headings`} className="flex flex-col gap-3 px-6 pb-8 pt-6 max-md:hidden">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-md font-semibold text-ink">
          <span className="font-mono">{chapter.code}</span> {chapter.name} <span className="font-normal text-ink-3">· {headingsWord(chapter.headings.length)}</span>
        </h2>
        <SortTabs chapter={chapter.code} sort={sort} more={more} />
      </div>
      <HeadingRows rows={sortHeadings(chapter.headings, sort)} />
    </section>
  );
}

/** The phone's list: each chapter a row that opens in place, with its headings under it. */
export function PhoneChapters({ chapters, open, sort }: { chapters: Chapter[]; open: string | null; sort: SortKey }) {
  return (
    <ul aria-label="Chapters" className="mt-3 border-t border-line md:hidden">
      {chapters.map((c) => {
        const on = c.code === open;
        return (
          <li key={c.code} className="border-b border-line">
            <Link href={on ? headingsHref({ sort }) : headingsHref({ chapter: c.code, sort })} prefetch={false} aria-expanded={on} className={cn("flex min-h-14 items-center gap-3 py-2 pl-4 pr-2", FOCUS)}>
              <span className="w-8 shrink-0 font-mono text-sm text-ink-3">{c.code}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-md font-medium text-ink">{c.name}</span>
                <span className="text-sm text-ink-3">{headingsWord(c.headings.length)}</span>
              </span>
              <span className="flex size-11 shrink-0 items-center justify-center">{on ? <CaretUp size={20} className="text-ink-3" aria-hidden /> : <CaretDown size={20} className="text-ink-3" aria-hidden />}</span>
            </Link>
            {on ? <PhoneHeadings rows={sortHeadings(c.headings, sort)} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

function PhoneHeadings({ rows }: { rows: readonly Heading[] }) {
  return (
    <ul className="bg-subtle">
      {rows.map((h) => (
        <li key={h.hs} className="border-t border-line">
          <Link href={searchHref(h.hs)} prefetch={false} className={cn("flex min-h-14 items-center gap-3 py-2 pl-4 pr-2", FOCUS)}>
            <span className="w-10 shrink-0 font-mono text-md text-ink">{h.hs}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-md text-ink">{h.label ?? "No heading text"}</span>
              <span className="text-sm text-ink-3">{suppliersWord(h.exporters)}</span>
            </span>
            <span className="flex size-11 shrink-0 items-center justify-center">
              <CaretRight size={20} className="text-ink-3" aria-hidden />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** A search: the matching headings from every chapter, in one table (a list on a phone). */
export function SearchResults({ rows, sort }: { rows: readonly Heading[]; sort: SortKey }) {
  const sorted = sortHeadings(rows, sort);
  return (
    <>
      <section aria-label="Matching headings" className="px-6 pb-8 pt-6 max-md:hidden">
        <HeadingRows rows={sorted} />
      </section>
      <div className="mt-3 border-t border-line md:hidden">
        <PhoneHeadings rows={sorted} />
      </div>
    </>
  );
}

export function NoMatch({ q }: { q: string }) {
  return (
    <div className="px-6 py-8 max-md:px-4">
      <Empty icon={MagnifyingGlass} title="No heading matches that search" action={<Link href="/app/headings" prefetch={false} className={buttonClass({ kind: "secondary", className: "max-md:h-input-touch" })}>Show every chapter</Link>}>
        Nothing matches “{q}”. Search by code (6109) or by name (T-shirts).
      </Empty>
    </div>
  );
}

export function NoCatalogue() {
  return (
    <div className="px-6 py-8 max-md:px-4">
      <Empty icon={MagnifyingGlass} title="No HS codes to show yet">
        The catalogue has no headings. Try again later.
      </Empty>
    </div>
  );
}

/** `hs_catalogue` failed. */
export function CatalogueError({ retryHref }: { retryHref: string }) {
  return (
    <div className="p-6 max-md:p-4">
      <ErrorPanel
        title={CATALOGUE_ERROR_TITLE}
        retry={
          <Link href={retryHref} prefetch={false} className={buttonClass({ kind: "primary", className: "max-md:h-input-touch" })}>
            Try again
          </Link>
        }
      >
        {CATALOGUE_ERROR_BODY}
      </ErrorPanel>
    </div>
  );
}

export function HeadingsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading HS codes" className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-1.5 px-6 pb-4 pt-7 max-md:px-4 max-md:pt-4">
        <h1 className="text-xl font-semibold tracking-tight text-ink max-md:sr-only">{HEADINGS_TITLE}</h1>
        <Skeleton className="h-3 w-[320px] max-w-full" />
      </div>
      <div aria-hidden className="grid grid-cols-4 gap-3 px-6 pt-2 max-xl:grid-cols-3 max-md:hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md border border-line p-3">
            <Skeleton className="h-3 w-6" />
            <Skeleton className="h-3.5 w-28" />
            <Skeleton tone="subtle" className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div aria-hidden className="md:hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex min-h-14 flex-col justify-center gap-1.5 border-b border-line px-4 py-2">
            <Skeleton className="h-3 w-[160px]" />
            <Skeleton tone="subtle" className="h-2.5 w-[80px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
