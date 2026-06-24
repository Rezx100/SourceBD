// Spec R1 — StickyActionBar.
//
// Bottom action bar for long forms + wizards. On phones it pins above the
// app bottom-tab chrome; on desktop it sits inline as a regular footer row.
// Primary action is always on the right at all widths. Children are
// `<Button>` elements; the consumer decides which is primary.
//
// Server component — pure layout.

import * as React from "react";
import { cn } from "@/lib/utils";

type StickyActionBarProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Optional left-side helper text (e.g. validation summary). */
  helper?: React.ReactNode;
};

export function StickyActionBar({
  className,
  helper,
  children,
  ...rest
}: StickyActionBarProps) {
  return (
    <>
      <div className="h-[84px] md:hidden" aria-hidden />
      <div
        // On phones: fixed above the bottom tab. The tab owns the safe-area;
        // this bar only offsets by the tab's full painted height.
        // On `md+`: behaves as an inline footer row inside the form card.
        className={cn(
          "fixed left-0 right-0 z-30 safe-px",
          "bottom-[calc(56px+env(safe-area-inset-bottom,0px))]",
          "flex flex-col gap-2 border-t border-neutral-200 bg-white px-4 py-3 shadow-sm",
          "md:static md:flex-row md:items-center md:gap-3 md:rounded-b-lg md:border-0 md:border-t md:px-0 md:py-4 md:bg-transparent md:shadow-none",
          className,
        )}
        {...rest}
      >
        {helper ? (
          <div className="text-[12px] text-ink-tertiary md:flex-1">{helper}</div>
        ) : (
          <div className="md:flex-1" />
        )}
        <div className="flex items-center justify-end gap-2">{children}</div>
      </div>
    </>
  );
}
