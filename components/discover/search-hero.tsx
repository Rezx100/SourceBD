// Discover search hero.
//
// Card-free, centered hero on both /app/discover (buyer) and /discover
// (marketing). Renders the title + one-line description (server-rendered
// static copy) and delegates the actual input to `DiscoverSearchBox`, a
// client island that provides Google-style live typeahead.
//
// When `centered` is set (the no-query initial state) the hero grows via
// `flex-1` so the search field sits in the vertical centre of the page.

import { DiscoverSearchBox } from "@/components/discover/search-box";
import { cn } from "@/lib/utils";

type Props = {
  basePath: string;
  /** Profile route base for company jumps, e.g. "/suppliers" or "/app/suppliers". */
  profileBase: string;
  q: string;
  sort: string;
  className?: string;
  headline?: string;
  subcopy?: string;
  /** Vertically center the hero in the viewport (initial no-query state). */
  centered?: boolean;
};

export function DiscoverSearchHero({
  basePath,
  profileBase,
  q,
  sort,
  className,
  headline = "Find a verified factory",
  subcopy = "Search by certification, product, or district.",
  centered = false,
}: Props) {
  return (
    <section
      className={cn(
        "flex w-full flex-col items-center text-center",
        centered && "flex-1 justify-center",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink-primary sm:text-[1.75rem]">
            {headline}
          </h1>
          <p className="text-sm text-ink-secondary">{subcopy}</p>
        </div>

        <DiscoverSearchBox
          basePath={basePath}
          profileBase={profileBase}
          q={q}
          sort={sort}
        />
      </div>
    </section>
  );
}
