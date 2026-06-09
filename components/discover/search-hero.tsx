// R9 round 4 — DiscoverSearchHero.
//
// Always-visible primary search bar that sits above the FilterRail on
// both /app/discover (buyer) and /discover (marketing). Server component
// — plain HTML GET form. The user feedback was that the search input
// being buried inside a Filters card / sheet was the wrong default;
// search is the primary action on the page and must be one tap away.
//
// Submitting only sets `q` + preserves the current `sort` (so a typed
// query doesn't silently drop the active sort). It deliberately does
// NOT preserve filters — typing a new company name typically means the
// buyer is restarting their search; if they want to keep filters they
// can use the FilterRail's own Apply button inside the sheet.

import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";

type Props = {
  basePath: string;
  q: string;
  sort: string;
  className?: string;
};

export function DiscoverSearchHero({ basePath, q, sort, className }: Props) {
  return (
    <form
      method="get"
      action={basePath}
      role="search"
      aria-label="Search suppliers"
      className={cn(
        "r9r4-search-hero rounded-card border border-hairline bg-surface-l1 p-3 shadow-[0_1px_2px_rgba(15,15,20,0.03)] sm:p-4",
        className,
      )}
    >
      {sort && sort !== "default" ? (
        <input type="hidden" name="sort" value={sort} />
      ) : null}

      <div className="flex items-stretch gap-2">
        <label htmlFor="discover-hero-q" className="sr-only">
          Search suppliers
        </label>

        <div className="relative flex-1">
          <MagnifyingGlass
            aria-hidden
            size={18}
            weight="bold"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary"
          />
          <input
            id="discover-hero-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by company name — e.g. Naafco, Standard Group, SM Sourcing"
            inputMode="search"
            autoComplete="off"
            className="r9r4-hero-input w-full rounded-input border border-hairline bg-bg-l0 py-3 pl-10 pr-3 text-[15px] text-ink-primary outline-none transition-colors placeholder:text-ink-tertiary focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/15 sm:text-base"
          />
        </div>

        <button
          type="submit"
          className="btn-proto primary inline-flex shrink-0 items-center justify-center px-4 text-sm sm:px-6"
        >
          Search
        </button>
      </div>
    </form>
  );
}
