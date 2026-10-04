// The filter bar over the results (Paper `10 · Results table` and `Results, empty`): the
// search's title with its count, the filters that are on (a menu each, filled, with its value
// on the button), "Add filter", the standing filter ("Hiding sanctioned suppliers · Show
// them"), and on the right Save search, Sort, the Filters toggle and More. Every option is a
// link to the search with that value toggled, so the bar works before any script.
// Server component; the menus are the kit's.

import { BookmarkSimple, CaretDown, CaretUpDown, Check, MagnifyingGlass, Plus, SlidersHorizontal, X } from "@phosphor-icons/react/dist/ssr";
import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { FilterChip, Menu, MenuItem, StandingFilter, buttonClass, linkClass } from "@/components/kit";
import { formatCount } from "@/lib/dashboard/facts";
import { filterMenus, inFilterMenu, menuSummary, type FilterMenu } from "@/lib/dashboard/search-templates";
import { DISCOVER_PATH, SORTS, discoverChips, discoverHiddenParams, filterCount, type DiscoverState } from "@/lib/discover-v32-state";
import { cn } from "@/lib/utils";

/** The menus' names as Paper prints them. */
const MENU_LABEL: Record<string, string> = { product: "Products exported", certificate: "Certificates", place: "Location", type: "Company type", more: "More filters" };

/** "Sort: most sources": the short form on the button; the menu lists the full names. */
const SORT_WORDS: Record<string, string> = {
  sources: "most sources",
  name: "name",
  workers: "workers",
  established: "established",
  cert_expiry: "certificate expiry",
  hs_lines: "most HS headings",
};

type Counts = Record<string, number | null>;

const triggerClass = (set: boolean) =>
  cn(buttonClass({ kind: "secondary", className: "gap-1 pl-3 pr-2" }), set && "border-brand bg-brand-tint hover:border-brand hover:bg-brand-tint");

/** One filter menu: the button names it (and the value, once set), the list toggles values. */
export function FilterMenuButton({ menu, hrefFor, counts }: { menu: FilterMenu; hrefFor: (s: DiscoverState) => string; counts?: Counts }) {
  const summary = menuSummary(menu);
  const name = MENU_LABEL[menu.key] ?? menu.label;
  return (
    <Menu
      trigger={
        <button type="button" aria-label={summary ? `${name}: ${summary}` : name} className={triggerClass(summary !== null)}>
          <span>{summary ? `${name}: ${summary}` : name}</span>
          <CaretDown size={16} className="shrink-0 text-ink-2" aria-hidden />
        </button>
      }
    >
      {menu.options.map((o) => (
        <MenuItem key={o.key} href={hrefFor(o.toggled)} hint={typeof counts?.[o.key] === "number" ? formatCount(counts[o.key]) : undefined}>
          <span className="flex items-center gap-2">
            <span className="flex size-4 shrink-0 items-center justify-center">{o.on ? <Check size={16} className="text-brand" aria-label="On" /> : null}</span>
            {o.label}
            {o.code ? <span className="font-mono text-sm text-ink-3">{o.code}</span> : null}
          </span>
        </MenuItem>
      ))}
    </Menu>
  );
}

/** The menus on the results bar: Certificates and Location always; the rest only once they hold a value. */
export function barMenus(state: DiscoverState): FilterMenu[] {
  return filterMenus(state).filter((m) => m.key === "certificate" || m.key === "place" || menuSummary(m) !== null);
}

/** Every filter that is not in a menu, as a chip with its ×: a minimum, a range. The query is the topbar field and the title, not a chip. */
export function OtherChips({ state, hrefFor }: { state: DiscoverState; hrefFor: (s: DiscoverState) => string }) {
  const chips = discoverChips(state).filter((c) => c.key !== "sanctioned" && c.key !== "q" && !inFilterMenu(c.key, state));
  return (
    <>
      {chips.map((c) => (
        <FilterChip key={c.key} removeHref={hrefFor(c.without)} removeLabel={`Remove ${c.label}`}>
          {c.label}
        </FilterChip>
      ))}
    </>
  );
}

/** The one filter the buyer did not choose: sanctioned suppliers are held back, in words, with the way to lift it. */
export function SanctionedStanding({ state, hrefFor }: { state: DiscoverState; hrefFor: (s: DiscoverState) => string }) {
  if (state.sanctioned) return null;
  return (
    <StandingFilter
      action={
        <Link href={hrefFor({ ...state, sanctioned: true, page: 1 })} scroll={false} className={cn(linkClass, "text-sm")}>
          Show them
        </Link>
      }
    >
      Hiding sanctioned suppliers
    </StandingFilter>
  );
}

export function SortMenu({ state, hrefFor, className }: { state: DiscoverState; hrefFor: (s: DiscoverState) => string; className?: string }) {
  return (
    <Menu
      align="end"
      trigger={
        <button type="button" className={cn(buttonClass({ kind: "secondary", className: "gap-1 pl-3 pr-2" }), className)}>
          <span>Sort: {SORT_WORDS[state.sort]}</span>
          <CaretDown size={16} className="shrink-0 text-ink-2" aria-hidden />
        </button>
      }
    >
      {SORTS.map((s) => (
        <MenuItem key={s.value} href={hrefFor({ ...state, sort: s.value, page: 1 })}>
          <span className="flex items-center gap-2">
            <span className="flex size-4 shrink-0 items-center justify-center">{s.value === state.sort ? <Check size={16} className="text-brand" aria-label="Sorted by" /> : null}</span>
            {s.label}
          </span>
        </MenuItem>
      ))}
    </Menu>
  );
}

/** What the search is, in words: the query and how many suppliers it finds. */
export function resultsTitle(q: string, total: number | null): string {
  const n = total === null ? null : `${formatCount(total)} ${total === 1 ? "supplier" : "suppliers"}`;
  return [q, n].filter(Boolean).join(" · ") || "Suppliers";
}

/**
 * The full-width bar (no pane open). `more` is the client ⋯ menu, `save` the Save search
 * link, `filtersHref` the Filters toggle.
 */
export function ResultsToolbar({
  state,
  title,
  hrefFor,
  filtersHref,
  filtersOpen,
  saveHref,
  more,
  bare = false,
}: {
  state: DiscoverState;
  title: string;
  hrefFor: (s: DiscoverState) => string;
  filtersHref: string;
  filtersOpen: boolean;
  saveHref: string;
  more: ReactNode;
  /** Nothing to save, sort or download (no match, a failed search): the filters alone, as Paper draws the empty state. */
  bare?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-6 py-3 max-md:hidden">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h1 className="pr-2 text-base font-semibold text-ink">{title}</h1>
        {barMenus(state).map((m) => (
          <FilterMenuButton key={m.key} menu={m} hrefFor={hrefFor} />
        ))}
        <OtherChips state={state} hrefFor={hrefFor} />
        <Link href={filtersHref} prefetch={false} scroll={false} className={buttonClass({ kind: "secondary", className: "pl-2.5 pr-3" })}>
          <Plus size={16} className="shrink-0 text-ink-2" aria-hidden />
          Add filter
        </Link>
        <SanctionedStanding state={state} hrefFor={hrefFor} />
      </div>
      {bare ? null : (
      <div className="flex items-center gap-2">
        <Link href={saveHref} prefetch={false} scroll={false} className={buttonClass({ kind: "secondary", className: "pl-2.5 pr-3" })}>
          <BookmarkSimple size={16} className="shrink-0 text-ink-2" aria-hidden />
          Save search
        </Link>
        <SortMenu state={state} hrefFor={hrefFor} />
        <Link
          href={filtersHref}
          prefetch={false}
          scroll={false}
          aria-label={filterCount(state) > 0 ? `Filters, ${filterCount(state)} on` : "Filters"}
          aria-pressed={filtersOpen}
          title="Filters"
          className={cn(buttonClass({ kind: "secondary", size: "icon-32" }), (filtersOpen || filterCount(state) > 0) && "border-ink-3 bg-subtle")}
        >
          <SlidersHorizontal size={20} className="shrink-0 text-ink-2" aria-hidden />
        </Link>
        {more}
      </div>
      )}
    </div>
  );
}

/** The narrow bar over the list when a pane is open (576): the title and the two buttons that fit. */
export function PaneListToolbar({ state, title, hrefFor, filtersHref }: { state: DiscoverState; title: string; hrefFor: (s: DiscoverState) => string; filtersHref: string }) {
  const on = filterCount(state);
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-2 max-md:hidden">
      <h1 className="text-base font-semibold text-ink">{title}</h1>
      <div className="flex items-center gap-2">
        <Link href={filtersHref} prefetch={false} scroll={false} className={buttonClass({ kind: "secondary" })}>
          {on > 0 ? `Filters · ${on} on` : "Filters"}
        </Link>
        <SortMenu state={state} hrefFor={hrefFor} />
      </div>
    </div>
  );
}

/**
 * The phone's bar (Paper `11 · Results`): the query in a 48-tall field with its ×, the count,
 * Filters and Sort as two 44-tall halves, and the standing filter. The field is a form to the
 * results that carries the other filters; the filter pane and the sort list open from here.
 */
export function PhoneToolbar({ state, count, hrefFor, filtersHref }: { state: DiscoverState; count: string; hrefFor: (s: DiscoverState) => string; filtersHref: string }) {
  const on = filterCount(state);
  const half = "flex h-touch grow items-center justify-center gap-2 whitespace-nowrap rounded-md border border-line-strong bg-surface px-3 text-md font-medium text-ink outline-none hover:bg-subtle active:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
  return (
    <div className="flex flex-col gap-3 border-b border-line px-4 py-3 md:hidden">
      <Form action={DISCOVER_PATH} role="search" aria-label="Search" prefetch={false}>
        {discoverHiddenParams(state, ["q"]).map(([k, v]) => (
          <input key={`${k}-${v}`} type="hidden" name={k} value={v} />
        ))}
        <label className="flex h-input-touch items-center gap-3 rounded-md border border-line-strong bg-surface pl-3.5 pr-0.5 focus-within:border-brand focus-within:[box-shadow:inset_0_0_0_1px_theme(colors.brand)]">
          <MagnifyingGlass size={20} className="shrink-0 text-ink-3" aria-hidden />
          <input type="search" name="q" defaultValue={state.q} autoComplete="off" placeholder="Supplier, product or certificate" aria-label="Search" className="min-w-0 flex-1 bg-transparent text-md text-ink outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden" />
          {state.q ? (
            <Link href={hrefFor({ ...state, q: "", page: 1 })} aria-label="Clear the search" className="flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand">
              <X size={20} aria-hidden />
            </Link>
          ) : null}
        </label>
      </Form>
      <h1 className="text-md font-semibold text-ink">{count}</h1>
      <div className="flex flex-wrap gap-2">
        <Link href={filtersHref} prefetch={false} scroll={false} className={half}>
          <SlidersHorizontal size={20} className="shrink-0 text-ink-2" aria-hidden />
          {on > 0 ? `Filters · ${on} on` : "Filters"}
        </Link>
        <Menu
          align="end"
          trigger={
            <button type="button" className={half}>
              <CaretUpDown size={20} className="shrink-0 text-ink-2" aria-hidden />
              Sort: {SORT_WORDS[state.sort]}
            </button>
          }
        >
          {SORTS.map((s) => (
            <MenuItem key={s.value} href={hrefFor({ ...state, sort: s.value, page: 1 })}>
              <span className="flex items-center gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center">{s.value === state.sort ? <Check size={16} className="text-brand" aria-label="Sorted by" /> : null}</span>
                {s.label}
              </span>
            </MenuItem>
          ))}
        </Menu>
      </div>
      {state.sanctioned ? null : (
        <StandingFilter
          className="h-11 self-start rounded-md px-3 text-base"
          action={
            <Link href={hrefFor({ ...state, sanctioned: true, page: 1 })} className={cn(linkClass, "text-base")}>
              Show them
            </Link>
          }
        >
          Hiding sanctioned suppliers
        </StandingFilter>
      )}
    </div>
  );
}
