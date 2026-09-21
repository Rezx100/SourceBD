// SearchComposer, query state (REZ-A, handoff §3.1): the active filters as
// chips, "Add filter", the Filters | Ask stop switch, the go disc. The Ask
// stop is V2 — it renders only when `askEnabled` (AI on and a key present),
// otherwise the switch is not shown at all, not disabled.

import { cn } from "@/lib/utils";
import { Chip } from "./chips";
import { V2Tag } from "./controls";
import { Icon } from "./icons";
import { Code } from "./type";

export type FilterChipModel = { label: string; code?: string | null; removeHref?: string };

export function SearchComposer({
  chips,
  mode = "filters",
  askEnabled = false,
  className,
  queryInput,
  askHref,
  filtersHref,
}: {
  chips: readonly FilterChipModel[];
  mode?: "filters" | "ask";
  askEnabled?: boolean;
  className?: string;
  /** When set, the composer is a GET search field (REZ-B). */
  queryInput?: string;
  askHref?: string;
  filtersHref?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-line bg-surface py-2.5 pl-3.5 pr-3 shadow-sm",
        className,
      )}
    >
      <span className="inline-flex text-ink-muted">
        <Icon name="funnel" />
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {queryInput !== undefined ? (
          <input
            type="search"
            name="q"
            defaultValue={queryInput}
            placeholder="Search suppliers, HS codes, certificates"
            aria-label="Search suppliers, HS codes, certificates"
            className="min-w-[12rem] flex-1 bg-transparent text-sm text-ink-strong outline-none placeholder:text-ink-subtle"
          />
        ) : null}
        {chips.map((c) => (
          <Chip key={c.label} tone="on" className="h-7">
            {c.label}
            {c.code ? <Code className="text-xs">{c.code}</Code> : null}
            {c.removeHref ? (
              <a href={c.removeHref} aria-label={`Remove ${c.label}`} className="opacity-70">
                <Icon name="x" small />
              </a>
            ) : (
              <button type="button" disabled aria-label={`Remove ${c.label}`} className="opacity-70 disabled:cursor-not-allowed">
                <Icon name="x" small />
              </button>
            )}
          </Chip>
        ))}
        {queryInput !== undefined ? (
          <a href="#filters" className="inline-flex h-7 items-center gap-1 px-1.5 text-sm font-medium text-ink-muted">
            <Icon name="plus" small /> Add filter
          </a>
        ) : (
          <button type="button" className="inline-flex h-7 items-center gap-1 px-1.5 text-sm font-medium text-ink-muted">
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
          {filtersHref ? (
            <a
              href={filtersHref}
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
        type={queryInput !== undefined ? "submit" : "button"}
        aria-label="Search"
        className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-brand-on hover:bg-brand-hover"
      >
        <Icon name="arrow-r" />
      </button>
    </div>
  );
}
