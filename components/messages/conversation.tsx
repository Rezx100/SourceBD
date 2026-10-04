// The top of a conversation (B6a, Paper `10 · Messages · thread`, `11 · thread`): the supplier's
// name and the RFQ it is about with the control for the record, and the strip of that RFQ's four
// facts. Server components.

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { listHref, threadHref, threadSub, type ListState, type RfqStrip, type ThreadRow } from "./words";

const textLink = "rounded-sm font-medium text-brand underline decoration-1 [text-underline-position:from-font] outline-none hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export function ThreadHead({ thread, state, recordOpen }: { thread: ThreadRow; state: ListState; recordOpen: boolean }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-5 max-md:sticky max-md:top-0 max-md:z-raised max-md:px-2">
      <Link
        href={listHref(state)}
        prefetch={false}
        aria-label="Back to messages"
        className="flex size-11 shrink-0 items-center justify-center rounded-sm text-ink outline-none hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand md:hidden"
      >
        <ArrowLeft size={24} aria-hidden />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate text-md font-semibold text-ink">{thread.supplier_name}</h1>
        <p className="truncate text-xs text-ink-3">{threadSub(thread)}</p>
      </div>
      <Link
        href={recordOpen ? threadHref(thread.id, state) : threadHref(thread.id, state, thread.supplier_slug)}
        prefetch={false}
        scroll={false}
        aria-current={recordOpen ? "true" : undefined}
        className={cn(textLink, "text-sm max-md:flex max-md:h-11 max-md:items-center max-md:px-3 max-md:text-md")}
      >
        {recordOpen ? (
          "Hide record"
        ) : (
          <>
            <span className="max-xl:hidden">Show record beside</span>
            <span className="max-md:hidden xl:hidden">Show record</span>
            <span className="md:hidden">Record</span>
          </>
        )}
      </Link>
    </header>
  );
}

/** RFQ sent, Quantity, Ship by, Quote, and View RFQ (`10 · Messages · thread`); a phone says it in one line inside the thread. */
export function RfqBar({ strip }: { strip: RfqStrip }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-surface px-6 py-2.5 max-sm:hidden">
      <dl className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {strip.cells.map((c, i) => (
          <div key={c.label} className={cn("flex flex-col", i > 0 && "border-l border-line pl-4")}>
            <dt className="text-xs text-ink-3">{c.label}</dt>
            <dd className="text-base font-medium text-ink">{c.value}</dd>
          </div>
        ))}
      </dl>
      <Link href={`/app/rfqs?open=${encodeURIComponent(strip.rfqId)}`} prefetch={false} className={cn(textLink, "text-base")}>
        View RFQ
      </Link>
    </div>
  );
}

/** The RFQ could not be read: the strip is left out, and the way to the RFQ stays. */
export function RfqLinkBar({ rfqId }: { rfqId: string }) {
  return (
    <div className="flex shrink-0 items-center justify-end border-b border-line bg-surface px-6 py-2 max-sm:hidden">
      <Link href={`/app/rfqs?open=${encodeURIComponent(rfqId)}`} prefetch={false} className={cn(textLink, "text-base")}>
        View RFQ
      </Link>
    </div>
  );
}
