"use client";

// Spec R1 — FilterRailResponsive.
//
// Mobile composition for Discover (buyer + public). NEW file; does NOT
// edit `components/discover/filter-rail.tsx`. R3/R4 will swap this in.
//
// Behaviour at `<md`:
//   - Renders a single "Filters (N)" button + an applied-filter chip
//     row above results.
//   - Tap → opens <Sheet side="bottom"> containing the existing
//     FilterRail form.
//
// Behaviour at `≥md`:
//   - Renders nothing. The desktop horizontal FilterRail (the existing
//     component in `components/discover/filter-rail.tsx`) keeps its
//     place above the result grid.
//
// The applied-filter chips are <Chip onRemoveHref={...}/> so removal
// works via URL rebuild — no client state, no JS state sync.

import * as React from "react";
import { Funnel } from "@phosphor-icons/react/dist/ssr";

import { Chip } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type AppliedFilter = {
  /** Stable id of the filter entry (e.g. "city:Dhaka"). */
  key: string;
  /** Human label shown in the chip. */
  label: string;
  /** URL the chip's × button should navigate to, with this filter removed. */
  removeHref: string;
};

type FilterRailResponsiveProps = {
  /** Applied filters surfaced as <Chip> row above results. */
  applied: AppliedFilter[];
  /** URL the "Reset all" link should point to (typically the base path). */
  resetHref: string;
  /** Body content rendered inside the bottom-sheet — typically the same
   *  form fields the desktop FilterRail renders. The consumer passes a
   *  fragment to avoid duplicating field defs. */
  sheetBody: React.ReactNode;
  /** Visible label on the sheet trigger (default "Filters"). */
  triggerLabel?: string;
  className?: string;
};

export function FilterRailResponsive({
  applied,
  resetHref,
  sheetBody,
  triggerLabel = "Filters",
  className,
}: FilterRailResponsiveProps) {
  const [open, setOpen] = React.useState(false);
  const activeCount = applied.length;

  return (
    <div
      className={cn(
        // Mobile-only render — desktop FilterRail handles ≥md.
        "md:hidden",
        // Container query host so a future MasterDetail-list-pane render
        // can adapt to its slot, not just the viewport.
        "r1-cq-host",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="inline-flex h-[44px] min-h-[44px] items-center gap-2 rounded-pill border border-hairline-strong bg-surface-l1 px-4 text-[13px] font-semibold text-ink-primary shadow-l1 hover:bg-brand-forest-tint"
        >
          <Funnel size={16} weight="bold" aria-hidden />
          <span>{triggerLabel}</span>
          {activeCount > 0 ? (
            <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-brand-forest px-1.5 font-mono text-[10px] font-semibold text-ink-on-accent">
              {activeCount}
            </span>
          ) : null}
        </button>

        {activeCount > 0 ? (
          <a
            href={resetHref}
            className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-tertiary underline-offset-2 hover:text-ink-primary hover:underline"
          >
            Reset
          </a>
        ) : null}
      </div>

      {activeCount > 0 ? (
        <ul
          role="list"
          aria-label="Applied filters"
          className="m-0 mt-3 flex list-none flex-wrap gap-1.5 p-0"
        >
          {applied.map((f) => (
            <li key={f.key}>
              <Chip tone="brand" label={f.label} onRemoveHref={f.removeHref} />
            </li>
          ))}
        </ul>
      ) : null}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        side="bottom"
        label={triggerLabel}
      >
        {sheetBody}
      </Sheet>
    </div>
  );
}
