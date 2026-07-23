"use client";

// Spec R3 — Mobile filter trigger that opens R1's Sheet around the
// existing FilterRail server component. Server components can be
// passed as `children` to client components per Next.js 15 RSC.
//
// This component is used ONLY in the `<md` half of the discover page
// split — the desktop half renders the same FilterRail directly with
// no client wrapper. Tree-shaken out of any route that doesn't import
// it (per Spec R3 §4 hard constraint).

import * as React from "react";
import { Funnel } from "@phosphor-icons/react/dist/ssr";
import { Sheet } from "@/components/ui/sheet";

type Props = {
  activeFilterCount: number;
  resultCount: number;
  children: React.ReactNode;
};

export function MobileFilterSheet({
  activeFilterCount,
  resultCount,
  children,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const countSuffix = activeFilterCount > 0 ? ` (${activeFilterCount})` : "";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="r3-filter-trigger inline-flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 shadow-sm hover:border-brand-forest/50"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          <Funnel size={16} weight="bold" />
          <span>Filters{countSuffix}</span>
        </span>
        <span className="text-[12px] font-medium text-neutral-500">
          {resultCount.toLocaleString()} result{resultCount === 1 ? "" : "s"}
        </span>
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        side="bottom"
        label="Filters"
        swipeToClose
      >
        <div className="safe-pb">{children}</div>
      </Sheet>
    </>
  );
}
