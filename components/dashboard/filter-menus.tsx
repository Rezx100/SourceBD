// The filter menus (founder's pick "A", 29 Sep 2026): Product, Certificate,
// Place, Company type and More, one row of them under the landing's field
// and over the results, in place of four rows of pills and a bar of green
// chips. Each opens a short list; a menu with a value set shows the value on
// its own button, filled. On the landing each option also says how many
// published suppliers it finds.
//
// Server-rendered: every option is a link to the search with that value
// toggled, so the menus work before any script and a click is the same
// client navigation as any other filter.

import { Suspense } from "react";
import { formatCount } from "@/lib/dashboard/facts";
import { filterMenus, menuSummary, type FilterMenu } from "@/lib/dashboard/search-templates";
import { discoverHref, serializeDiscoverState, type DiscoverState } from "@/lib/discover-v32-state";
import { cn } from "@/lib/utils";
import { Menu, MenuItem } from "./controls";
import { Code } from "./type";

type Counts = Record<string, number | null>;

function OptionCount({ n }: { n: number | null | undefined }) {
  return typeof n === "number" ? <span className="ml-3 font-mono text-xs text-ink-subtle">{formatCount(n)}</span> : null;
}

async function StreamedCount({ counts, k }: { counts: Promise<Counts>; k: string }) {
  return <OptionCount n={(await counts)[k]} />;
}

/** Company type and More as one More menu, for the narrow column beside a pane. */
export function foldMenus(menus: FilterMenu[], folded: boolean): FilterMenu[] {
  if (!folded) return menus;
  const rest = menus.filter((m) => m.key === "type" || m.key === "more");
  return [...menus.filter((m) => !rest.includes(m)), { key: "more", label: "More", options: rest.flatMap((m) => m.options) }];
}

export function FilterMenus({
  state,
  counts,
  hrefFor = discoverHref,
  folded = false,
  className,
  children,
}: {
  state: DiscoverState;
  /**
   * Beside an open pane the results column is narrow and five menus wrapped
   * onto two or three rows: Product, Certificate and Place stay, and Company
   * type folds into More (founder's leftovers, 29 Sep 2026).
   */
  folded?: boolean;
  /**
   * Suppliers each option finds, by option key; absent on the results, where
   * the whole-corpus count would mislead. A promise streams each count into
   * its own row, so a menu open while they arrive is not redrawn shut.
   */
  counts?: Counts | Promise<Counts>;
  /** The URL of a search: the results page keeps the buyer's density on it. */
  hrefFor?: (s: DiscoverState) => string;
  className?: string;
  /** Anything that rides at the row's end (All filters). */
  children?: React.ReactNode;
}) {
  // Keyed by the search: a click is a client navigation, and the menu it came
  // from must come back closed (`Menu`).
  const key = serializeDiscoverState(state).toString();
  return (
    <div role="group" aria-label="Filter by" className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {foldMenus(filterMenus(state), folded).map((m) => {
        const summary = menuSummary(m);
        return (
          <Menu
            key={`${m.key}:${key}`}
            label={summary ? `${m.label}: ${summary}` : m.label}
            summary={
              <span className="whitespace-nowrap">
                {m.label}
                {summary ? <span className="font-normal">: {summary}</span> : null}
              </span>
            }
            align="left"
            size="sm"
            set={summary !== null}
            panelClassName="min-w-[17rem]"
          >
            {m.options.map((o) => (
              <MenuItem key={o.key} href={hrefFor(o.toggled)} active={o.on} clientNav>
                <span className="min-w-0 flex-1">
                  {o.label}
                  {o.code ? <Code className="ml-1.5 text-xs text-ink-subtle">{o.code}</Code> : null}
                </span>
                {counts instanceof Promise ? (
                  <Suspense fallback={null}>
                    <StreamedCount counts={counts} k={o.key} />
                  </Suspense>
                ) : (
                  <OptionCount n={counts?.[o.key]} />
                )}
              </MenuItem>
            ))}
          </Menu>
        );
      })}
      {children}
    </div>
  );
}
