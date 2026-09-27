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

/**
 * The frame of every page that simply scrolls: the content width, the page
 * gutter, the rhythm between the header and its sections. The shell's
 * `<main>` is the scroll region and this sits inside it; a workbench page
 * (the search, the inbox) fills `<main>` with panes of its own instead.
 */
export function Page({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto flex w-full max-w-[calc(75rem+3rem)] flex-col gap-4 p-4 sm:p-6", className)}>{children}</div>;
}

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
        // Title and action share the first row at every width; the caption
        // sits inline after the title from `sm` and on its own line below it
        // on a phone, where it wraps. Three stacked rows with the action
        // alone at the right was the 390px result before.
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="order-1 text-title font-semibold text-ink-strong">{title}</h2>
          {action ? <span className="order-2 ml-auto text-sm font-medium sm:order-3">{action}</span> : null}
          {caption ? <Caption className="order-3 basis-full sm:order-2 sm:basis-auto">{caption}</Caption> : null}
        </div>
      ) : null}
      {bare ? children : <div className="rounded-md border border-line-subtle bg-surface">{children}</div>}
    </section>
  );
}

/**
 * The spot illustrations under `public/illustrations/`: one object from the
 * buyer's own desk per feature, drawn as ink line art with a single brand-green
 * fill. Each is a vector generated on Higgsfield (Recraft V4.1, vector) from
 * the prompt recorded in `public/illustrations/PROVENANCE.md`, cleaned to the
 * token palette. They carry no text, so they need no translation and no alt.
 */
export const EMPTY_ART = ["messages", "rfq", "orders", "saved", "certificate", "activity"] as const;
export type EmptyArt = (typeof EMPTY_ART)[number];

/**
 * The empty state: says what will be here and how it gets here. Teaches, never
 * apologises (spec §5: empty is the normal case).
 *
 * With `art`, it is the page's own composition rather than a note in a box:
 * the illustration, the title and the sentence centred, the action under
 * them — the state almost every buyer meets first at launch, on Messages,
 * RFQs, Orders and Saved (spec §3: "it must sell the feature, not
 * apologise for it"). Without `art` it stays the compact left-aligned note a
 * section uses inside a page.
 */
export function EmptyState({
  icon = "box",
  art,
  compact = false,
  title,
  children,
  action,
  className,
}: {
  icon?: IconName;
  /** A page-level empty state's illustration. */
  art?: EmptyArt;
  /**
   * With `art`, the smaller setting for a section inside a page (the home's
   * Alerts and Activity): the illustration at 88px and the page-level title
   * size stepped down, so three empty sections on one page do not each claim
   * a viewport.
   */
  compact?: boolean;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  if (art) {
    return (
      <div className={cn("flex flex-col items-center gap-4 px-6 text-center", compact ? "py-8" : "py-14", className)}>
        {/* A plain `<img>`: the file is a small SVG the browser caches once,
            and `next/image` has nothing to optimise in a vector. `alt=""`
            because the title beside it is the meaning. */}
        <img
          src={`/illustrations/${art}.svg`}
          alt=""
          width={compact ? 88 : 128}
          height={compact ? 88 : 128}
          draggable={false}
          // One authored entrance per page: the page-level state rises; a
          // compact section inside a page that is already fading in does not
          // add a second, third and fourth entrance on the same paint.
          className={cn("select-none", compact ? "size-[88px]" : "size-32 animate-rise motion-reduce:animate-none")}
        />
        <div className="flex max-w-prose flex-col gap-1">
          <p className={cn("m-0 font-semibold text-ink-strong", compact ? "text-base" : "text-lg tracking-[-0.005em]")}>{title}</p>
          {children ? <p className="m-0 text-sm text-ink-muted">{children}</p> : null}
        </div>
        {action ? <div className="flex flex-wrap justify-center gap-2 pt-1">{action}</div> : null}
      </div>
    );
  }
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
