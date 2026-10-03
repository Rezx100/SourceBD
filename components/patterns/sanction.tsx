// Sanction banner (`03 Patterns · 5`, a sample state: no published supplier is sanctioned,
// so the boards and the gallery use placeholders). A solid band above everything else on the
// record, outside the scrolling area, with no close button and no collapsed form. Send RFQ is
// refused in words wherever the supplier appears; in a bulk RFQ the supplier is dropped and
// the page says so. Server-safe.

import { WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const REFUSAL = "You can't send this supplier an RFQ.";

/** The band. `detail` (the refusal and where the listing comes from) is for a wide pane; a phone shows the title. */
export function SanctionBanner({ title, detail, className }: { title: ReactNode; detail?: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("flex items-start gap-2.5 bg-sanction px-4 py-3 text-surface sm:gap-3 sm:px-5 sm:py-3.5", className)}>
      <WarningOctagon size={20} weight="fill" className="shrink-0" aria-hidden />
      <div className="flex flex-col gap-0.5">
        <p className="text-md font-semibold sm:text-base">{title}</p>
        {detail ? <p className="text-sm max-sm:hidden">{detail}</p> : null}
      </div>
    </div>
  );
}

/** Where Send RFQ would be: the refusal in words, in the supplier's action bar. */
export function Refusal({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 text-base font-medium text-sanction", className)}>
      <WarningOctagon size={16} weight="fill" className="shrink-0" aria-hidden />
      {REFUSAL}
    </span>
  );
}

/** In the list, after "Show them": the list's name in words, not just a tint. Put on the name cell's row. */
export const sanctionRowClass = "bg-sanction-tint [&>td:first-child]:[box-shadow:inset_2px_0_0_theme(colors.sanction)]";

export function SanctionTag({ list }: { list: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-sanction">
      <WarningOctagon size={14} weight="fill" className="shrink-0" aria-hidden />
      On the {list}
    </span>
  );
}

/** In a bulk RFQ: "1 supplier removed from this RFQ: on the UFLPA Entity List." */
export function SanctionDropped({ count, list }: { count: number; list: string }) {
  return (
    <p role="status" className="flex items-start gap-2 rounded-md border border-sanction bg-sanction-tint p-3 text-sm text-sanction">
      <WarningOctagon size={16} weight="fill" className="shrink-0" aria-hidden />
      <span>
        {count} {count === 1 ? "supplier" : "suppliers"} removed from this RFQ: on the {list}.
      </span>
    </p>
  );
}
