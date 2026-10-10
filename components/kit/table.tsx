// Table (`02 Components · 4`): head 36 and sticky, rows 40 (they grow to 56 when a name
// wraps; nothing is cut), numbers right-aligned in tabular figures with their column
// head, hover brand-wash, selected brand-tint with a 2px brand bar. A real `<table>`.
// The page builds the toolbar from `Button`, `Segmented` and the chips; the bulk bar
// replaces the filter bar while rows are selected.

import { ArrowDown, ArrowUp, CaretLeft, CaretRight, CaretUpDown } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { buttonClass } from "./button-class";
import { Checkbox } from "./fields";
import { ringInset } from "./classes";
import { Skeleton } from "./feedback";

/** The rounded, clipped frame around a table and its foot. Scroll inside `TableScroll`, not here. */
export function TableFrame({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col overflow-clip rounded-md border border-line", className)} {...rest} />;
}

/** Scrolls the body while the head sticks. Give it a height (`max-h-…`). */
export function TableScroll({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("overflow-auto", className)} {...rest} />;
}

export function Table({ className, ...rest }: ComponentProps<"table">) {
  return <table className={cn("w-full border-separate border-spacing-0 text-left text-base", className)} {...rest} />;
}

type Align = "left" | "right";

const HEAD =
  "sticky top-0 z-raised h-row-head border-b border-line bg-subtle p-0 text-xs [box-shadow:0_2px_2px_-2px_theme(colors.ink/0.2)]";

export type SortState = "none" | "asc" | "desc";

/**
 * A column head: 12/500 ink-3. `sort` makes it a link (`href` is the page sorted this
 * way): at rest a word, on hover sunken with the two-way caret, sorted ink 600 with an
 * arrow. Every number column says what it counts.
 */
export function Th({
  align = "left",
  sort,
  href,
  children,
  className,
  inner: innerClass,
  ...rest
}: Omit<ComponentProps<"th">, "align" | "children"> & {
  align?: Align;
  sort?: SortState;
  href?: string;
  children?: ReactNode;
  /** Changes the head's inner box: `px-2 py-1 h-auto min-h-row-head` lets a long word wrap to two lines (Paper's dense quotes table). */
  inner?: string;
}) {
  const inner = cn("flex h-row-head items-center gap-1 px-3", align === "right" && "justify-end", innerClass);
  const ariaSort = sort === "asc" ? "ascending" : sort === "desc" ? "descending" : sort === "none" ? "none" : undefined;
  return (
    <th scope="col" aria-sort={ariaSort} className={cn(HEAD, className)} {...rest}>
      {sort && href ? (
        <Link
          href={href}
          className={cn(
            inner,
            "group/sort font-medium text-ink-3 outline-none hover:bg-sunken hover:text-ink",
            sort !== "none" && "font-semibold text-ink",
            ringInset,
          )}
        >
          {children}
          {sort === "desc" ? (
            <ArrowDown size={14} aria-hidden />
          ) : sort === "asc" ? (
            <ArrowUp size={14} aria-hidden />
          ) : (
            <CaretUpDown size={14} className="hidden text-ink-2 group-hover/sort:block group-focus-visible/sort:block" aria-hidden />
          )}
        </Link>
      ) : (
        <div className={cn(inner, "font-medium text-ink-3")}>{children}</div>
      )}
    </th>
  );
}

/** A body row. `selected` is brand-tint with a 2px brand bar on the first cell; hover is brand-wash. */
export function Tr({ selected, className, ...rest }: ComponentProps<"tr"> & { selected?: boolean }) {
  return (
    <tr
      aria-selected={selected || undefined}
      className={cn(
        "group/row h-row [&>td]:border-b [&>td]:border-line",
        selected ? "bg-brand-tint [&>td:first-child]:[box-shadow:inset_2px_0_0_theme(colors.brand-ink)]" : "hover:bg-brand-wash",
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ align = "left", className, ...rest }: Omit<ComponentProps<"td">, "align"> & { align?: Align }) {
  return <td className={cn("px-3 py-2 align-middle text-ink-2", align === "right" && "text-right", className)} {...rest} />;
}

/** The name in a row: 14/500 ink, underlined while the row is hovered or focused. */
export const rowLinkClass =
  "rounded-sm font-medium text-ink decoration-1 [text-underline-position:from-font] outline-none group-hover/row:underline hover:underline focus-visible:underline " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** The tick column: 40 wide, the box centred. Name the row: `label="Select Aboni Knitwear Ltd."`. */
export function SelectCell({ label, mixed, header, ...rest }: Omit<ComponentProps<"input">, "type" | "size"> & { label: string; mixed?: boolean; header?: boolean }) {
  const box = <Checkbox aria-label={label} mixed={mixed} {...rest} />;
  return header ? (
    <th scope="col" className={cn(HEAD, "w-10")}>
      <div className="flex h-row-head items-center justify-center">{box}</div>
    </th>
  ) : (
    <td className="w-10 border-b border-line p-0 text-center align-middle">
      <div className="flex justify-center">{box}</div>
    </td>
  );
}

/**
 * Nothing on file, in a cell: an en dash in ink-subtle, never a blank, with the words ("Not
 * published", "No certificates on file") in the title and for a screen reader. Absence must not
 * out-shout presence in a grid (the critique of 7 Oct 2026, item 5); the words themselves live in
 * `components/patterns/words.ts` (`ABSENT`).
 */
export function Unpublished({ children = "Not published" }: { children?: string }) {
  return (
    <span className="text-sm text-ink-3" title={children}>
      <span aria-hidden="true">–</span>
      <span className="sr-only">{children}</span>
    </span>
  );
}

const NARROW_WORDS = "[@container_(max-width:719px)]:sr-only";

/** "Showing 1–25 of 4,645 suppliers · Page 1 of 186 · Previous · Next". `perPage` is the page's own select. */
export function Pagination({
  noun,
  from,
  to,
  total,
  page,
  pages,
  prevHref,
  nextHref,
  perPage,
}: {
  noun: string;
  from: number;
  to: number;
  total: number;
  page: number;
  pages: number;
  prevHref?: string;
  nextHref?: string;
  perPage?: ReactNode;
}) {
  const n = (v: number) => v.toLocaleString("en-GB");
  const step = (href: string | undefined, label: string, lead: boolean) => {
    const body = lead ? (
      <>
        <CaretLeft size={16} className="shrink-0" aria-hidden />
        <span className={NARROW_WORDS}>{label}</span>
      </>
    ) : (
      <>
        <span className={NARROW_WORDS}>{label}</span>
        <CaretRight size={16} className="shrink-0" aria-hidden />
      </>
    );
    const cls = buttonClass({ kind: "secondary", className: cn("gap-1", lead ? "pl-2 pr-3" : "pl-3 pr-2", "[@container_(max-width:719px)]:px-2") });
    return href ? (
      <Link href={href} className={cls}>
        {body}
      </Link>
    ) : (
      <span aria-disabled="true" className={cls}>
        {body}
      </span>
    );
  };
  return (
    // The footer measures itself, not the window: beside a record pane it can be 360px on a wide
    // screen. Narrower than 720 the words go (to screen readers only) and the steps become arrows;
    // narrower than 480 the page count goes; narrower than 360 the page size. Nothing wraps.
    <nav aria-label={`${noun} pages`} className="shrink-0 bg-surface [container-type:inline-size]">
      <div className="flex h-12 items-center justify-between gap-3 whitespace-nowrap px-3">
        <p className="text-sm text-ink-2">
          <span className={NARROW_WORDS}>Showing </span>
          {n(from)}–{n(to)} of {n(total)}
          <span className={NARROW_WORDS}> {noun}</span>
        </p>
        <div className="flex items-center gap-4 [@container_(max-width:719px)]:gap-2">
          {perPage ? <span className="[@container_(max-width:359px)]:hidden">{perPage}</span> : null}
          <p className="text-sm text-ink-2 [@container_(max-width:479px)]:sr-only">
            Page {n(page)} of {n(pages)}
          </p>
          <div className="flex gap-2">
            {step(prevHref, "Previous", true)}
            {step(nextHref, "Next", false)}
          </div>
        </div>
      </div>
    </nav>
  );
}

/**
 * The bar that replaces the filter bar while rows are selected. Ink, so the change of
 * mode cannot be missed. `summary` is "2 suppliers selected", `selectAll` the underlined
 * "Select all 4,645", `clear` the × (named "Clear selection"); `children` the actions.
 */
export function BulkBar({ summary, selectAll, clear, children, className }: { summary: ReactNode; selectAll?: ReactNode; clear: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div role="region" aria-label="Selected rows" className={cn("flex h-12 shrink-0 items-center justify-between rounded-md bg-ink pl-3 pr-2 text-base text-surface", className)}>
      <div className="flex items-center gap-4">
        <p className="font-semibold">{summary}</p>
        {selectAll}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {clear}
      </div>
    </div>
  );
}

const BULK = "inline-flex h-control items-center whitespace-nowrap rounded-sm px-3 text-base font-medium outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface";
/** A bulk action on the ink bar: `outline` for Save and Download CSV, `solid` (white) for the one that sends. */
export const bulkActionClass = (solid = false) =>
  cn(BULK, solid ? "bg-surface text-ink hover:bg-sunken" : "border border-ink-3 text-surface hover:bg-ink-2");
/** The × at the end of the bulk bar. */
export const bulkCloseClass = "flex size-8 shrink-0 items-center justify-center rounded-sm text-surface outline-none hover:bg-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface";

/** Skeleton rows that match the layout that loads: one bar per column, in the widths given (px). */
export function SkeletonRows({ rows = 4, widths = [180, 80] }: { rows?: number; widths?: number[] }) {
  const w = [180, 140, 200, 160];
  return (
    <div aria-hidden>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex h-row items-center gap-6 border-b border-line px-3 last:border-b-0">
          {widths.map((base, c) => (
            <Skeleton key={c} className="h-3 shrink-0" style={{ width: c === 0 ? w[r % w.length] : base }} />
          ))}
        </div>
      ))}
    </div>
  );
}
