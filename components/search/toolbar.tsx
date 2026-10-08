// The filter bar over the results (Paper `10 · Results table` and `Results, empty`): the
// search's title with its count, the filters that are on (a menu each, filled, with its value
// on the button), "Add filter", the standing filter ("Hiding sanctioned suppliers · Show
// them"), and on the right Save search, Sort, the Filters toggle and More. Every option is a
// link to the search with that value toggled, so the bar works before any script.
// Server component; the menus are the kit's.

import { BookmarkSimple, CaretDown, CaretUpDown, Check, MagnifyingGlass, Plus, SlidersHorizontal, X } from "@phosphor-icons/react/dist/ssr";
import Form from "next/form";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { FilterChip, Menu, MenuItem, StandingFilter, buttonClass, linkClass } from "@/components/kit";
import { SearchCombobox } from "./typeahead";
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

/**
 * The filters' row: one line at every width. When they outgrow it they scroll sideways and
 * fade at the right edge; the padding keeps the last one clear of the fade and the focus rings unclipped.
 * Under 720 the bar is the one beside a pane: the filters are behind the Filters button.
 * Nothing is cut off with an ellipsis: a title too long for the row wraps inside itself.
 */
const rail =
  "-my-1 -ml-1 flex min-w-0 flex-1 [@container_(max-width:719px)]:hidden items-center gap-2 overflow-x-auto py-1 pl-1 pr-6 [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [&>*]:whitespace-nowrap";

const triggerClass = (set: boolean) =>
  cn(buttonClass({ kind: "secondary", className: "gap-1 pl-3 pr-2" }), set && "border-brand-ink bg-brand-tint hover:border-brand-ink hover:bg-brand-tint");

/** One filter menu: the button names it (and the value, once set), the list toggles values. */
export function FilterMenuButton({ menu, hrefFor, counts, icon }: { menu: FilterMenu; hrefFor: (s: DiscoverState) => string; counts?: Counts; icon?: ReactNode }) {
  const summary = menuSummary(menu);
  const name = MENU_LABEL[menu.key] ?? menu.label;
  return (
    <Menu
      trigger={
        <button type="button" aria-label={summary ? `${name}: ${summary}` : name} className={triggerClass(summary !== null)}>
          {icon}
          <span>{summary ? `${name}: ${summary}` : name}</span>
          <CaretDown size={16} className="shrink-0 text-ink-2" aria-hidden />
        </button>
      }
    >
      {menu.options.map((o) => (
        <MenuItem key={o.key} href={hrefFor(o.toggled)} hint={typeof counts?.[o.key] === "number" ? formatCount(counts[o.key]) : undefined}>
          <span className="flex items-center gap-2">
            <span className="flex size-4 shrink-0 items-center justify-center">{o.on ? <Check size={16} className="text-brand-ink" aria-label="On" /> : null}</span>
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

export function SortMenu({ state, hrefFor, className, compact = false }: { state: DiscoverState; hrefFor: (s: DiscoverState) => string; className?: string; /** On a bar under 900 wide the button says "Sort" alone. */ compact?: boolean }) {
  return (
    <Menu
      align="end"
      trigger={
        <button type="button" aria-label={`Sort: ${SORT_WORDS[state.sort]}`} className={cn(buttonClass({ kind: "secondary", className: "gap-1 pl-3 pr-2" }), className)}>
          <span className={compact ? "[@container_(max-width:899px)]:hidden" : undefined}>Sort: {SORT_WORDS[state.sort]}</span>
          {compact ? <span aria-hidden className="hidden [@container_(max-width:899px)]:inline">Sort</span> : null}
          <CaretDown size={16} className="shrink-0 text-ink-2" aria-hidden />
        </button>
      }
    >
      {SORTS.map((s) => (
        <MenuItem key={s.value} href={hrefFor({ ...state, sort: s.value, page: 1 })}>
          <span className="flex items-center gap-2">
            <span className="flex size-4 shrink-0 items-center justify-center">{s.value === state.sort ? <Check size={16} className="text-brand-ink" aria-label="Sorted by" /> : null}</span>
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
  savePanel,
  more,
  bare = false,
}: {
  state: DiscoverState;
  title: string;
  hrefFor: (s: DiscoverState) => string;
  filtersHref: string;
  filtersOpen: boolean;
  saveHref: string;
  /** The Save-this-search popover (a sheet on a phone), when `?save=1` opened it: it hangs under this bar. */
  savePanel?: ReactNode;
  more: ReactNode;
  /** Nothing to save, sort or download (no match, a failed search): the filters alone, as Paper draws the empty state. */
  bare?: boolean;
}) {
  // A filter that is on makes the bar longer than Paper draws it, so Save search gives up its words sooner.
  const words = filterCount(state) > (state.q ? 1 : 0) ? "[@container_(max-width:1439px)]:sr-only" : "[@container_(max-width:1151px)]:sr-only";
  const on = filterCount(state);
  return (
    <div className="relative border-b border-line max-md:hidden">
      {/* The row measures itself here, not on the bar: a container is a stacking context, and the Save popover must stay above the table's sticky head. */}
      <div className="flex items-center gap-x-4 px-6 py-3 [container-type:inline-size]">
      <h1 className="min-w-0 text-base font-semibold text-ink">{title}</h1>
      <div className={rail}>
        {barMenus(state).map((m) => (
          <FilterMenuButton key={m.key} menu={m} hrefFor={hrefFor} />
        ))}
        <OtherChips state={state} hrefFor={hrefFor} />
        <Link href={filtersHref} prefetch={false} scroll={false} title="Add filter" className={buttonClass({ kind: "secondary", className: "px-2" })}>
          <Plus size={16} className="shrink-0 text-ink-2" aria-hidden />
          <span className={cn("pr-1", words)}>Add filter</span>
        </Link>
      </div>
      {/* The standing filter sits at the bar's end, as it does on the landing, not between the filters and the actions. */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <SanctionedStanding state={state} hrefFor={hrefFor} />
      {bare ? null : (
      <>
        <Link href={saveHref} prefetch={false} scroll={false} title="Save search" className={buttonClass({ kind: "secondary", className: "px-2" })}>
          <BookmarkSimple size={16} className="shrink-0 text-ink-2" aria-hidden />
          <span className={cn("pr-1", words)}>Save search</span>
        </Link>
        <SortMenu state={state} hrefFor={hrefFor} compact />
        <Link
          href={filtersHref}
          prefetch={false}
          scroll={false}
          aria-label={on > 0 ? `Filters, ${on} on` : "Filters"}
          aria-pressed={filtersOpen}
          title="Filters"
          className={cn(buttonClass({ kind: "secondary", size: "icon-32" }), "[@container_(max-width:719px)]:w-auto [@container_(max-width:719px)]:gap-2 [@container_(max-width:719px)]:px-3", (filtersOpen || on > 0) && "border-ink-3 bg-subtle")}
        >
          <SlidersHorizontal size={20} className="shrink-0 text-ink-2" aria-hidden />
          <span aria-hidden className="hidden [@container_(max-width:719px)]:inline">{on > 0 ? `Filters · ${on} on` : "Filters"}</span>
        </Link>
        {more}
      </>
      )}
      </div>
      </div>
      {savePanel}
    </div>
  );
}

/**
 * The narrow bar over the list when a pane is open (576): the title, then Save search and Add filter as
 * icons with their names on hover and for a screen reader (the critique of 7 Oct 2026: beside a pane the
 * bar dropped both, in the state a power user lives in), and Sort.
 */
export function PaneListToolbar({ state, title, hrefFor, filtersHref, saveHref, savePanel }: { state: DiscoverState; title: string; hrefFor: (s: DiscoverState) => string; filtersHref: string; saveHref?: string; savePanel?: ReactNode }) {
  const on = filterCount(state);
  return (
    <div className="relative flex min-h-14 items-center justify-between gap-x-3 border-b border-line px-4 py-2 max-md:hidden">
      <h1 className="min-w-0 text-base font-semibold text-ink">{title}</h1>
      <div className="flex shrink-0 items-center gap-2">
        {saveHref ? (
          <Link href={saveHref} prefetch={false} scroll={false} aria-label="Save search" title="Save search" className={buttonClass({ kind: "secondary", size: "icon-32" })}>
            <BookmarkSimple size={16} className="shrink-0 text-ink-2" aria-hidden />
          </Link>
        ) : null}
        <Link
          href={filtersHref}
          prefetch={false}
          scroll={false}
          aria-label={on > 0 ? `Add filter · ${on} on` : "Add filter"}
          title="Add filter"
          className={cn(buttonClass({ kind: "secondary", size: "icon-32" }), on > 0 && "w-auto gap-1 border-ink-3 bg-subtle px-2")}
        >
          <Plus size={16} className="shrink-0 text-ink-2" aria-hidden />
          {on > 0 ? <span aria-hidden className="font-mono text-xs tabular-nums text-ink-2">{on}</span> : null}
        </Link>
        <SortMenu state={state} hrefFor={hrefFor} />
      </div>
      {savePanel}
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
  const half = "flex h-touch grow items-center justify-center gap-2 whitespace-nowrap rounded-md border border-line-strong bg-surface px-3 max-[389px]:px-2 text-md font-medium text-ink outline-none hover:bg-subtle active:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
  return (
    <div className="flex flex-col gap-3 border-b border-line px-4 py-3 md:hidden">
      <Form action={DISCOVER_PATH} role="search" aria-label="Search" prefetch={false} className="relative">
        {discoverHiddenParams(state, ["q"]).map(([k, v]) => (
          <input key={`${k}-${v}`} type="hidden" name={k} value={v} />
        ))}
        <div className="flex h-input-touch items-center gap-3 rounded-md border border-line-strong bg-surface pl-3.5 pr-0.5 focus-within:border-brand-ink focus-within:[box-shadow:inset_0_0_0_1px_theme(colors.brand-ink)]">
          <MagnifyingGlass size={20} className="shrink-0 text-ink-3" aria-hidden />
          <Suspense fallback={<input type="search" name="q" defaultValue={state.q} autoComplete="off" placeholder="Supplier, product or certificate" aria-label="Search" className="min-w-0 flex-1 bg-transparent text-md text-ink outline-none placeholder:text-ink-3" />}>
            <SearchCombobox variant="phone" defaultValue={state.q} placeholder="Supplier, product or certificate" />
          </Suspense>
          {state.q ? (
            <Link href={hrefFor({ ...state, q: "", page: 1 })} aria-label="Clear the search" className="flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus">
              <X size={20} aria-hidden />
            </Link>
          ) : null}
        </div>
      </Form>
      <h1 className="text-md font-semibold text-ink">{count}</h1>
      <div className="flex gap-2">
        <Link href={filtersHref} prefetch={false} scroll={false} className={half}>
          <SlidersHorizontal size={20} className="shrink-0 text-ink-2 max-[429px]:hidden" aria-hidden />
          {on > 0 ? `Filters · ${on} on` : "Filters"}
        </Link>
        <Menu
          align="end"
          trigger={
            <button type="button" aria-label={`Sort: ${SORT_WORDS[state.sort]}`} className={half}>
              <CaretUpDown size={20} className="shrink-0 text-ink-2 max-[429px]:hidden" aria-hidden />
              <span className="max-[359px]:hidden">Sort: {SORT_WORDS[state.sort]}</span>
              <span aria-hidden className="hidden max-[359px]:inline">Sort</span>
            </button>
          }
        >
          {SORTS.map((s) => (
            <MenuItem key={s.value} href={hrefFor({ ...state, sort: s.value, page: 1 })}>
              <span className="flex items-center gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center">{s.value === state.sort ? <Check size={16} className="text-brand-ink" aria-label="Sorted by" /> : null}</span>
                {s.label}
              </span>
            </MenuItem>
          ))}
        </Menu>
      </div>
      {state.sanctioned ? null : (
        <StandingFilter
          className="h-11 max-w-full self-start rounded-md px-3 text-base"
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
