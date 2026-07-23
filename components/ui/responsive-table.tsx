// Spec R1 — ResponsiveTable<TRow>.
//
// Single answer for every list/table across the buyer / supplier / admin
// surfaces. Three modes via a `mode` prop, all CSS-driven where possible:
//
//   "stacked"  — desktop renders a <table>; phone renders each row as a
//                label/value card. Default. Best for queues + most lists.
//
//   "priority" — keep N columns always visible (set `priorityKeys`);
//                the rest collapse into an expandable <details> row
//                detail on phones. Best for supplier lists where
//                slug + entity_type + sanctioned must remain visible.
//
//   "swipe"    — horizontal scroll with sticky first column + edge
//                fade affordance. Used only by /admin/suppliers/import
//                preview where the genuine columnar comparison matters.
//
// Server component; pure render. No client state, no JS layout.
//
// Mode flip uses Tailwind responsive utilities + a tiny CSS layer in
// globals.css under the R1 container-query banner so the layout is
// container-aware: a ResponsiveTable rendered inside a narrow MasterDetail
// list pane stacks even on a wide viewport.

import * as React from "react";
import { cn } from "@/lib/utils";

export type Column<TRow> = {
  /** Unique key for this column. Used as React key + sort identifier. */
  key: string;
  /** Visible header label. */
  label: string;
  /** Returns the cell content for a row. Pure function — must not throw. */
  render: (row: TRow) => React.ReactNode;
  /** Optional cell class (applied to <td>). */
  cellClassName?: string;
  /** Right-align the cell. Default false. */
  numeric?: boolean;
};

type Common<TRow> = {
  columns: Column<TRow>[];
  rows: TRow[];
  /** Per-row React key. */
  rowKey: (row: TRow) => string;
  /** Optional caption for the table (rendered above + sr-only). */
  caption?: string;
  /** Empty-state body when `rows.length === 0`. */
  emptyState?: React.ReactNode;
  /** Optional click target wrapping the entire row (e.g. a Link). The
   *  component injects it as the wrapper of the stacked-card body so
   *  rows remain tappable on phones. */
  rowHref?: (row: TRow) => string | null;
  className?: string;
};

type StackedProps<TRow> = Common<TRow> & {
  mode?: "stacked";
};

type PriorityProps<TRow> = Common<TRow> & {
  mode: "priority";
  /** Column keys that stay visible on phone. Other columns collapse
   *  into an expandable <details> row detail. */
  priorityKeys: string[];
};

type SwipeProps<TRow> = Common<TRow> & {
  mode: "swipe";
};

type ResponsiveTableProps<TRow> =
  | StackedProps<TRow>
  | PriorityProps<TRow>
  | SwipeProps<TRow>;

export function ResponsiveTable<TRow>(props: ResponsiveTableProps<TRow>) {
  const mode = props.mode ?? "stacked";
  const { columns, rows, rowKey, caption, emptyState, rowHref, className } =
    props;

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "rounded-card border border-hairline bg-surface-l1 p-6 text-center text-sm text-ink-tertiary",
          className,
        )}
      >
        {emptyState ?? "No results."}
      </div>
    );
  }

  if (mode === "swipe") {
    return (
      <div
        className={cn(
          "r1-rt-swipe relative overflow-hidden rounded-card border border-hairline bg-surface-l1",
          className,
        )}
      >
        {caption ? <span className="sr-only">{caption}</span> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-hairline bg-bg-l0 text-[12px] uppercase tracking-[0.05em] text-ink-tertiary">
                {columns.map((c, i) => (
                  <th
                    key={c.key}
                    className={cn(
                      "px-3 py-2 font-mono font-semibold",
                      c.numeric && "text-right",
                      // Sticky first column for swipe mode.
                      i === 0 &&
                        "sticky left-0 z-10 bg-bg-l0 shadow-[2px_0_0_var(--hairline)]",
                    )}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={rowKey(r)}
                  className="border-b border-hairline last:border-b-0"
                >
                  {columns.map((c, i) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-3 py-2",
                        c.numeric && "text-right",
                        i === 0 &&
                          "sticky left-0 z-10 bg-surface-l1 font-medium text-ink-primary shadow-[2px_0_0_var(--hairline)]",
                        c.cellClassName,
                      )}
                    >
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Right-edge fade to advertise horizontal scrollability. */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-surface-l1 to-transparent"
        />
      </div>
    );
  }

  // Mode === "stacked" or "priority" — both render a desktop <table>;
  // they differ only in how the phone card lays out the secondary cells.
  // Narrow `props` directly so TS can discriminate on the union tag.
  const priorityKeys: string[] | null =
    props.mode === "priority" ? props.priorityKeys : null;

  return (
    <div className={cn("r1-cq-host", className)}>
      {caption ? <span className="sr-only">{caption}</span> : null}

      {/* Desktop table. md+ */}
      <div className="hidden overflow-x-auto rounded-card border border-hairline bg-surface-l1 md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-hairline bg-bg-l0 text-[12px] uppercase tracking-[0.05em] text-ink-tertiary">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-3 py-2 font-mono font-semibold",
                    c.numeric && "text-right",
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const href = rowHref?.(r) ?? null;
              return (
                <tr
                  key={rowKey(r)}
                  className="border-b border-hairline last:border-b-0 hover:bg-bg-l0"
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-3 py-2 align-top",
                        c.numeric && "text-right",
                        c.cellClassName,
                      )}
                    >
                      {href ? (
                        <a
                          href={href}
                          className="block text-inherit"
                        >
                          {c.render(r)}
                        </a>
                      ) : (
                        c.render(r)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards. <md. */}
      <ul
        role="list"
        className="m-0 flex list-none flex-col gap-2 p-0 md:hidden"
      >
        {rows.map((r) => {
          const href = rowHref?.(r) ?? null;
          const inner = (
            <div className="rounded-card border border-hairline bg-surface-l1 p-3">
              <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 text-[14px]">
                {columns.map((c) => {
                  const isPriority =
                    priorityKeys == null || priorityKeys.includes(c.key);
                  if (!isPriority) return null;
                  return (
                    <React.Fragment key={c.key}>
                      <dt className="font-mono text-[12px] uppercase tracking-[0.05em] text-ink-tertiary">
                        {c.label}
                      </dt>
                      <dd className="m-0 min-w-0 break-words text-ink-primary">
                        {c.render(r)}
                      </dd>
                    </React.Fragment>
                  );
                })}
              </dl>
              {priorityKeys ? (
                <details className="mt-2">
                  <summary className="inline-flex h-[36px] cursor-pointer items-center gap-1 rounded-pill border border-hairline px-3 font-mono text-[12px] text-ink-secondary hover:bg-brand-forest-tint">
                    More fields
                  </summary>
                  <dl className="mt-2 grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 border-t border-hairline pt-2 text-[14px]">
                    {columns.map((c) => {
                      if (priorityKeys.includes(c.key)) return null;
                      return (
                        <React.Fragment key={c.key}>
                          <dt className="font-mono text-[12px] uppercase tracking-[0.05em] text-ink-tertiary">
                            {c.label}
                          </dt>
                          <dd className="m-0 min-w-0 break-words text-ink-primary">
                            {c.render(r)}
                          </dd>
                        </React.Fragment>
                      );
                    })}
                  </dl>
                </details>
              ) : null}
            </div>
          );
          return (
            <li key={rowKey(r)}>
              {href ? (
                <a href={href} className="block text-inherit no-underline">
                  {inner}
                </a>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
