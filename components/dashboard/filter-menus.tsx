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

import { formatCount } from "@/lib/dashboard/facts";
import { filterMenus, menuSummary } from "@/lib/dashboard/search-templates";
import { discoverHref, serializeDiscoverState, type DiscoverState } from "@/lib/discover-v32-state";
import { cn } from "@/lib/utils";
import { Menu, MenuItem } from "./controls";
import { Code } from "./type";

export function FilterMenus({
  state,
  counts,
  className,
  children,
}: {
  state: DiscoverState;
  /** Suppliers each option finds, by option key; absent on the results, where the whole-corpus count would mislead. */
  counts?: Record<string, number | null>;
  className?: string;
  /** Anything that rides at the row's end (All filters). */
  children?: React.ReactNode;
}) {
  // Keyed by the search: a click is a client navigation, and the menu it came
  // from must come back closed (`Menu`).
  const key = serializeDiscoverState(state).toString();
  return (
    <div role="group" aria-label="Filter by" className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {filterMenus(state).map((m) => {
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
            {m.options.map((o) => {
              const n = counts?.[o.key];
              return (
                <MenuItem key={o.key} href={discoverHref(o.toggled)} active={o.on} clientNav>
                  <span className="min-w-0 flex-1">
                    {o.label}
                    {o.code ? <Code className="ml-1.5 text-xs text-ink-subtle">{o.code}</Code> : null}
                  </span>
                  {typeof n === "number" ? <span className="ml-3 font-mono text-xs text-ink-subtle">{formatCount(n)}</span> : null}
                </MenuItem>
              );
            })}
          </Menu>
        );
      })}
      {children}
    </div>
  );
}
