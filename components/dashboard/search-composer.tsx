// SearchComposer, query state (REZ-A, handoff §3.1): the active filters as
// chips, "Add filter", the Filters | Ask stop switch, the go disc. The Ask
// stop is V2 — it renders only when `askEnabled` (AI on and a key present),
// otherwise the switch is not shown at all, not disabled.
//
// On a phone (the phone hand-off's D3; Booking.com, Viator, Grab): no card,
// the rows on the canvas. "Filters · N" opens the full filter pane, and the
// menus and the set filters run on in one row that scrolls sideways, faded
// at its edge. The go disc goes (it reloaded the same search) and so does
// "Add filter" (Filters is it).

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Chip } from "./chips";
import { V2Tag } from "./controls";
import { Icon } from "./icons";
import { Code } from "./type";

export type FilterChipModel = {
  /**
   * Stable identity for this chip, distinct from its text. Dhaka, Gazipur,
   * Narayanganj and Chittagong are each both a city and a district, so
   * `?city=Dhaka&district=Dhaka` renders two chips reading "Dhaka" — keyed on
   * the label that is a duplicate React key, and reconciliation can hand one
   * chip the other's remove link.
   */
  key?: string;
  label: string;
  code?: string | null;
  removeHref?: string;
};

export function SearchComposer({
  chips,
  mode = "filters",
  askEnabled = false,
  className,
  queryInput,
  submits = false,
  askHref,
  filtersModeHref,
  filtersHref,
  menus,
  setCount = 0,
}: {
  chips: readonly FilterChipModel[];
  /** The filter menus, drawn before the chips of filters no menu holds (founder's video, 29 Sep 2026). */
  menus?: ReactNode;
  mode?: "filters" | "ask";
  askEnabled?: boolean;
  className?: string;
  /** When set, the composer carries its own text field. The results page does not: the topbar's field is the one search box. */
  queryInput?: string;
  /** The composer sits in a GET form: the go disc submits it and Add filter opens the filter form below. */
  submits?: boolean;
  askHref?: string;
  /** The Filters stop of the Filters | Ask switch. */
  filtersModeHref?: string;
  /** Where "Add filter" goes: the filter pane beside the results. */
  filtersHref?: string;
  /** How many filters are set: the phone's "Filters · N". */
  setCount?: number;
}) {
  const live = queryInput !== undefined || submits;
  return (
    <div
      className={cn(
        // No z-index of its own: the filter menus are `z-overlay` (`Menu`),
        // over the results panel after this (a stacking context of its own),
        // and the page's `<main>` keeps them under the topbar's suggestions.
        "relative flex items-center gap-3 rounded-md bg-surface py-2 pl-3.5 pr-2.5 shadow-edge",
        "max-sm:gap-2 max-sm:rounded-none max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none",
        className,
      )}
    >
      <span className="inline-flex text-ink-muted max-sm:hidden">
        <Icon name="funnel" />
      </span>
      {filtersHref ? (
        <Link
          href={filtersHref}
          prefetch={false}
          scroll={false}
          className="inline-flex h-chip-touch shrink-0 items-center gap-1.5 rounded-sm bg-surface px-3 text-sm font-medium text-ink-strong shadow-edge [touch-action:manipulation] active:bg-surface-sunken sm:hidden"
        >
          <Icon name="sliders" />
          Filters
          {setCount > 0 ? <span className="tabular-nums text-ink-muted">· {setCount}</span> : null}
        </Link>
      ) : null}
      {/* On a phone one row that scrolls sideways (no scrollbar, a fade at the
          right edge); from sm the row wraps as before. `relative`: the row's
          absolutely placed children stay inside its scroll. */}
      <div className="relative flex min-w-0 flex-1 flex-wrap items-center gap-2 max-sm:-my-1 max-sm:snap-x max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:py-1 max-sm:pr-6 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden">
        {queryInput !== undefined ? (
          <input
            type="search"
            name="q"
            defaultValue={queryInput}
            placeholder="Search suppliers, HS codes, certificates"
            aria-label="Search suppliers, HS codes, certificates"
            // See app-shell.tsx: `outline-none` beats the global focus ring.
            className="min-w-[12rem] flex-1 bg-transparent text-sm text-ink-strong placeholder:text-ink-subtle"
          />
        ) : null}
        {menus}
        {chips.map((c) => (
          <Chip key={c.key ?? c.label} tone="on" className="h-7 shrink-0 snap-start whitespace-nowrap max-sm:h-chip-touch">
            {c.label}
            {c.code ? <Code className="text-xs">{c.code}</Code> : null}
            {/* `opacity` applies to the focus outline too, so dimming the
                focusable element itself pushed the ring to 2.45:1 against the
                chip — under WCAG 1.4.11's 3:1. Dim the icon, not the control. */}
            {c.removeHref ? (
              <a href={c.removeHref} aria-label={`Remove ${c.label}`} className="hit">
                <Icon name="x" small className="opacity-70" />
              </a>
            ) : (
              <button type="button" disabled aria-label={`Remove ${c.label}`} className="disabled:cursor-not-allowed">
                <Icon name="x" small className="opacity-70" />
              </button>
            )}
          </Chip>
        ))}
        {filtersHref ? (
          <Link
            href={filtersHref}
            prefetch={false}
            scroll={false}
            className="hidden h-7 items-center gap-1 rounded-sm px-1.5 text-sm font-medium text-ink-muted transition-colors duration-fast hover:bg-surface-sunken hover:text-ink-strong sm:inline-flex"
          >
            <Icon name="plus" small /> Add filter
          </Link>
        ) : live ? (
          <a href="#filters" className="hidden h-7 items-center gap-1 px-1.5 text-sm font-medium text-ink-muted sm:inline-flex">
            <Icon name="plus" small /> Add filter
          </a>
        ) : (
          <button type="button" className="hidden h-7 items-center gap-1 px-1.5 text-sm font-medium text-ink-muted sm:inline-flex">
            <Icon name="plus" small /> Add filter
          </button>
        )}
      </div>
      {askEnabled ? (
        // Same live-control outline as `Seg` and the composer's Template
        // group: `border-line` is 1.44:1 against the surface behind it,
        // short of WCAG 1.4.11's 3:1, and this wrapper's own
        // `overflow-hidden` (for its rounded corners) clips the global
        // `:focus-visible` ring painted outside the border box, so a
        // keyboard user tabbing to Filters/Ask saw no border and no focus
        // indicator at all. Both fixed here the same way the round's other
        // two segmented toggles were (accessibility, cycle 20, BLOCKING —
        // same defect class as F3/F4, missed on this switch because it is
        // gated behind `askEnabled` and not yet reachable on any shipped
        // screen).
        <span role="group" aria-label="Search mode" className="inline-flex h-control overflow-hidden rounded-sm border border-line-strong">
          {filtersModeHref ? (
            <a
              href={filtersModeHref}
              aria-current={mode === "filters" ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 text-sm font-medium text-ink-muted",
                "focus-visible:outline-offset-[-2px]",
                mode === "filters" && "bg-surface-sunken text-ink-strong",
              )}
            >
              <Icon name="funnel" /> Filters
            </a>
          ) : (
            <button
              type="button"
              aria-pressed={mode === "filters"}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 text-sm font-medium text-ink-muted",
                "focus-visible:outline-offset-[-2px]",
                mode === "filters" && "bg-surface-sunken text-ink-strong",
              )}
            >
              <Icon name="funnel" /> Filters
            </button>
          )}
          {askHref ? (
            <a
              href={askHref}
              aria-current={mode === "ask" ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 text-sm font-medium text-smart",
                "focus-visible:outline-offset-[-2px]",
                mode === "ask" && "bg-surface-sunken",
              )}
            >
              <Icon name="sparkle" /> Ask <V2Tag />
            </a>
          ) : (
            <button
              type="button"
              aria-pressed={mode === "ask"}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 text-sm font-medium text-smart",
                "focus-visible:outline-offset-[-2px]",
                mode === "ask" && "bg-surface-sunken",
              )}
            >
              <Icon name="sparkle" /> Ask <V2Tag />
            </button>
          )}
        </span>
      ) : null}
      <button
        type={live ? "submit" : "button"}
        aria-label="Search"
        className="hidden size-8 shrink-0 place-items-center rounded-full bg-brand text-brand-on hover:bg-brand-hover sm:grid"
      >
        <Icon name="arrow-r" />
      </button>
      {/* The phone row's fade: more menus and filters lie past the edge. A
          gradient over the row, not a mask on it: a mask would hide the
          trays, which open from inside the row as sheets. */}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-canvas to-transparent sm:hidden" />
    </div>
  );
}
