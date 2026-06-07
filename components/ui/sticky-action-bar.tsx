// Spec R1 — StickyActionBar.
//
// Bottom action bar for long forms + wizards. On phones it pins to the
// viewport bottom with safe-area inset; on desktop it sits inline as a
// regular footer row. Primary action is always on the right at all
// widths. Children are `<Button>` elements; the consumer decides which
// is primary.
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
    <div
      // On phones: fixed to viewport bottom with safe-area inset, full-width,
      // backdrop-blur so content scrolling underneath remains legible.
      // On `md+`: behaves as an inline footer row inside the form card.
      className={cn(
        // Mobile (phone) — fixed to viewport bottom.
        "fixed left-0 right-0 bottom-0 z-30 safe-pb safe-px",
        "flex flex-col gap-2 border-t border-hairline-strong bg-surface-l1/95 px-4 py-3 shadow-[0_-6px_18px_-8px_rgba(15,15,20,0.08)]",
        "supports-[backdrop-filter]:bg-surface-l1/80 supports-[backdrop-filter]:backdrop-blur",
        // Desktop+ — inline static footer, no shadow, no blur, no inset.
        "md:static md:flex-row md:items-center md:gap-3 md:rounded-b-card md:border-0 md:border-t md:px-0 md:py-4 md:shadow-none md:backdrop-blur-none md:bg-transparent",
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
  );
}
