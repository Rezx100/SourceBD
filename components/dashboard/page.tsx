// Page furniture of the dashboard kit, for every buyer page that is not the
// search or a record: the page header, a titled section, the empty state, the
// error note and a plain data table. Server components; Tailwind token classes
// only (lib/design/tokens.ts).
//
// One grammar for all of them, so Saved, RFQs, Messages, Orders, Compliance
// and Settings read as one product with the search: an 20px title with a
// caption under it and the actions on the right; content in `Panel`s with a
// hairline; tables with 44px rows and 11px mono headers.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";
import { Caption } from "./type";

/** The page's one `h1`, its caption, and the actions on the right. */
export function PageHeader({
  title,
  caption,
  actions,
  children,
}: {
  title: ReactNode;
  caption?: ReactNode;
  actions?: ReactNode;
  /** A row under the title: status tabs, a filter strip. */
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink-strong [overflow-wrap:anywhere]">{title}</h1>
          {caption ? <Caption className="text-sm text-ink-muted">{caption}</Caption> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

/** A titled block inside a page. `bare` drops the card, for a table that brings its own. */
export function PageSection({
  title,
  caption,
  action,
  bare = false,
  className,
  id,
  children,
}: {
  title?: ReactNode;
  caption?: ReactNode;
  action?: ReactNode;
  bare?: boolean;
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("flex flex-col gap-3", className)}>
      {title ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-title font-semibold text-ink-strong">{title}</h2>
          {caption ? <Caption>{caption}</Caption> : null}
          {action ? <span className="ml-auto text-sm font-medium">{action}</span> : null}
        </div>
      ) : null}
      {bare ? children : <div className="rounded-md border border-line-subtle bg-surface">{children}</div>}
    </section>
  );
}

/**
 * The empty state: says what will be here and how it gets here. Teaches, never
 * apologises (spec §5: empty is the normal case).
 */
export function EmptyState({
  icon = "box",
  title,
  children,
  action,
  className,
}: {
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3 px-6 py-10", className)}>
      <span aria-hidden className="grid size-9 place-items-center rounded-md bg-surface-sunken text-ink-muted">
        <Icon name={icon} />
      </span>
      <div className="flex max-w-prose flex-col gap-1">
        <p className="m-0 text-base font-semibold text-ink-strong">{title}</p>
        {children ? <p className="m-0 text-sm text-ink-muted">{children}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

/** A read that failed: what did not load, and that nothing was lost. */
export function ErrorNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("flex items-start gap-2 rounded-md bg-danger-tint px-4 py-3 text-sm text-danger-ink", className)}>
      <Icon name="warn" />
      <span>{children}</span>
    </div>
  );
}

/** A table in a scroll region, so a phone scrolls it sideways instead of crushing it. */
export function DataTable({ label, minWidth = "40rem", children }: { label: string; minWidth?: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={label}>
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function HeadCell({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <th
      scope="col"
      className={cn(
        "h-9 border-b border-line-subtle px-4 text-left align-middle font-mono text-eyebrow font-medium uppercase text-ink-subtle",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Cell({ className, children }: { className?: string; children?: ReactNode }) {
  return <td className={cn("h-11 border-b border-line-subtle px-4 align-middle text-ink", className)}>{children}</td>;
}

/** A label/value list, for a detail page's facts. */
export function DetailList({ rows }: { rows: readonly { label: string; value: ReactNode }[] }) {
  return (
    <dl className="m-0 flex flex-col">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex flex-col gap-0.5 border-t border-line-subtle px-4 py-2.5 first:border-t-0 sm:flex-row sm:gap-3"
        >
          <dt className="w-full shrink-0 text-sm font-medium text-ink-muted sm:w-[160px]">{r.label}</dt>
          <dd className="m-0 min-w-0 flex-1 text-base text-ink [overflow-wrap:anywhere]">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
