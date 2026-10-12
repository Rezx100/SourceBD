// What fills `ListPane`'s pane: a column that scrolls in its own box, focus moved into it
// when it opens or changes (a record to one of its lines, a notice to its record), and focus
// handed back to the row that opened it when it closes. Escape is `ListPane`'s: from inside
// the pane only, never from the topbar's field.
//
// Also what the pane says while it waits (the silhouettes of a record, a line and the RFQ
// form, shown as the `Suspense` fallback so the pane paints the moment it is asked for) and
// when there is nothing to show (`PaneNotice`). Server-safe, no script.

import { X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Skeleton, buttonClass } from "@/components/kit";
import { PhoneRecordSkeleton } from "@/components/record/phone-record";
import { cn } from "@/lib/utils";
import { PaneFocus } from "./pane-focus";

export function PaneFrame({ openKey, children }: { /** What the pane shows; focus moves whenever it changes. */ openKey: string; children: ReactNode }) {
  return (
    <div data-pane-frame="" data-open-key={openKey} tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col outline-none">
      <PaneFocus openKey={openKey} />
      {/* Keyed by what it shows: opening another record beside the list is a client navigation into the same tree, and a form inside would keep the previous one's state. */}
      <Fragment key={openKey}>{children}</Fragment>
    </div>
  );
}

/**
 * The record while it is read (Paper page 37, the pane's loading board): the head, the nine tabs, the
 * export grid's four tiles, five rows, and the two actions at the foot.
 */
export function RecordSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="status" aria-label="Loading" className="flex min-h-0 flex-1 flex-col max-sm:hidden">
        <div className="flex items-start gap-2 px-6 pb-3.5 pt-4">
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-5 w-[264px]" />
            <Skeleton className="h-3 w-[220px]" />
          </div>
          <span className="flex-1" />
          <Skeleton className="h-8 w-[124px] rounded-md" />
          <Skeleton className="size-8 rounded-full" />
        </div>
        <div className="flex h-10 items-center gap-[18px] overflow-clip border-b border-line px-6">
          {["w-14", "w-12", "w-[76px]", "w-11", "w-9", "w-[52px]", "w-14", "w-[52px]", "w-12"].map((w, i) => (
            <Skeleton key={i} className={cn("h-3 shrink-0", w)} />
          ))}
        </div>
        <div className="flex flex-col gap-[26px] px-3 pt-5">
          <div className="flex flex-col gap-3.5">
            <Skeleton className="mx-3 h-4 w-24" />
            <div className="grid grid-cols-4 rounded-[10px] border border-line">
              {["w-[70px]", "w-[50px]", "w-14", "w-[76px]"].map((w, i) => (
                <div key={w} className={cn("flex min-h-24 flex-col gap-2.5 p-4", i > 0 && "border-l border-line")}>
                  <Skeleton className="h-2.5 w-[88px] max-w-full" />
                  <Skeleton className={cn("h-[22px]", w)} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3.5">
            <Skeleton className="mx-3 h-4 w-[132px]" />
            <div className="flex flex-col border-t border-line">
              {["w-[260px]", "w-[200px]", "w-[232px]", "w-[180px]", "w-[216px]"].map((w, i) => (
                <div key={w} className={cn("flex h-11 items-center gap-6 px-3", i > 0 && "border-t border-line")}>
                  <Skeleton className={cn("h-3 shrink", w)} />
                  <span className="flex-1" />
                  <Skeleton className="h-3 w-[120px] shrink-0" />
                  <Skeleton className="h-3 w-16 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-auto flex h-16 shrink-0 items-center justify-end gap-2 border-t border-line px-6">
          <Skeleton className="h-9 w-[84px] rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
      {/* A phone's own silhouette (Paper page 35, `d-loading`): the statuses, the tabs' place, four tiles. */}
      <PhoneRecordSkeleton className="sm:hidden" />
    </div>
  );
}

/** One export line while it is read: opening a line from a record must not show the whole record's silhouette on the way. */
export function LineSkeleton() {
  return (
    <div role="status" aria-label="Loading the product line" className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-5 w-72 max-w-full" />
      <Skeleton className="size-[200px]" />
      {[
        ["w-[200px]", "w-[140px]"],
        ["w-60", "w-40"],
        ["w-[180px]", "w-28"],
        ["w-[220px]", "w-36"],
      ].map(([a, b]) => (
        <div key={a} className="flex gap-6">
          <Skeleton className="h-3 w-24 shrink-0" />
          <div className="flex flex-col gap-2">
            <Skeleton className={`h-3 ${a}`} />
            <Skeleton tone="subtle" className={`h-3 ${b}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The RFQ form while its suppliers and the workspace's template are read: the title, the targets strip and the first fields. */
export function ComposerSkeleton() {
  return (
    <div role="status" aria-label="Loading the RFQ form" className="flex min-h-0 flex-1 flex-col gap-5 p-4 sm:p-6">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-14 w-full" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Why the pane holds nothing: a record that could not be read in time, a building that is filed
 * under its company, a link with no record. It says what happened, offers the one next step and
 * Close, and never apologises. `label` is what the pane was opening ("Supplier record", "Order").
 */
export function PaneNotice({
  title,
  body,
  action,
  closeHref,
  label = "Supplier record",
}: {
  title: string;
  body: string;
  action?: { label: string; href: string } | null;
  closeHref?: string | null;
  label?: string;
}) {
  return (
    <section aria-label={label} data-record-pane="" tabIndex={-1} className="flex min-h-0 flex-1 flex-col bg-surface outline-none">
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
        <h2 className="min-w-0 flex-1 text-xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">{title}</h2>
        {closeHref ? (
          // Under 1280 the pane is the kit's drawer, which draws its own close.
          <Link href={closeHref} scroll={false} aria-label="Close" className={buttonClass({ kind: "quiet", size: "icon-32", className: "max-xl:hidden" })}>
            <X size={20} aria-hidden />
          </Link>
        ) : null}
      </header>
      <div className="flex flex-col items-start gap-3 px-4 pb-8 sm:px-6">
        <p className="max-w-prose text-base text-ink-2">{body}</p>
        {action ? (
          <Link href={action.href} scroll={false} prefetch={false} className={buttonClass({ kind: "secondary" })}>
            {action.label}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
