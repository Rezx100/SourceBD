// SearchComposer, query state (REZ-A, handoff §3.1): the active filters as
// chips, "Add filter", the Filters | Ask stop switch, the go disc. The Ask
// stop is V2 — it renders only when `askEnabled` (AI on and a key present),
// otherwise the switch is not shown at all, not disabled.

import { cn } from "@/lib/utils";
import { Chip } from "./chips";
import { V2Tag } from "./controls";
import { Icon } from "./icons";
import { Code } from "./type";

export type FilterChipModel = { label: string; code?: string | null };

export function SearchComposer({
  chips,
  mode = "filters",
  askEnabled = false,
  className,
}: {
  chips: readonly FilterChipModel[];
  mode?: "filters" | "ask";
  askEnabled?: boolean;
  className?: string;
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
        {chips.map((c) => (
          <Chip key={c.label} tone="on" className="h-7">
            {c.label}
            {c.code ? <Code className="text-xs">{c.code}</Code> : null}
            <span className="opacity-70">
              <Icon name="x" small label={`Remove ${c.label}`} />
            </span>
          </Chip>
        ))}
        <button type="button" className="inline-flex h-7 items-center gap-1 px-1.5 text-sm font-medium text-ink-muted">
          <Icon name="plus" small /> Add filter
        </button>
      </div>
      {askEnabled ? (
        <span role="group" aria-label="Search mode" className="inline-flex h-control overflow-hidden rounded-sm border border-line">
          <button
            type="button"
            aria-pressed={mode === "filters"}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 text-sm font-medium text-ink-muted",
              mode === "filters" && "bg-surface-sunken text-ink-strong",
            )}
          >
            <Icon name="funnel" /> Filters
          </button>
          <button
            type="button"
            aria-pressed={mode === "ask"}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 text-sm font-medium text-smart",
              mode === "ask" && "bg-surface-sunken",
            )}
          >
            <Icon name="sparkle" /> Ask <V2Tag />
          </button>
        </span>
      ) : null}
      <button
        type="button"
        aria-label="Search"
        className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-brand-on hover:bg-brand-hover"
      >
        <Icon name="arrow-r" />
      </button>
    </div>
  );
}
