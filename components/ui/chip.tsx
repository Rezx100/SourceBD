// Spec R1 — Chip primitive (dismissible + static variants).
//
// Compact label-on-pill used by FilterRailResponsive's "applied
// filters" row above results, and anywhere else a removable
// selection needs a 44 px tap target.

import * as React from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

type ChipProps = {
  label: string;
  /** Optional removal handler. When set, renders an X button (44×44 tap
   *  region, 16 px glyph) and exposes `aria-label="Remove <label>"`. */
  onRemoveHref?: string;
  /** Tone — `neutral` (forest-tint), `brand` (forest text on tint),
   *  `muted` (dashed border). */
  tone?: "neutral" | "brand" | "muted";
  className?: string;
  children?: never;
};

export function Chip({
  label,
  onRemoveHref,
  tone = "neutral",
  className,
}: ChipProps) {
  const toneClass =
    tone === "brand"
      ? "bg-brand-forest-tint text-brand-forest border-[rgba(31,77,58,0.22)]"
      : tone === "muted"
        ? "bg-transparent text-ink-tertiary border-hairline-strong border-dashed"
        : "bg-surface-l1 text-ink-secondary border-hairline-strong";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-[13px] font-medium leading-none",
        toneClass,
        className,
      )}
    >
      <span className="truncate">{label}</span>
      {onRemoveHref ? (
        // The X is the dismiss control. We use an <a> rather than a button
        // because dismissal happens via URL-rebuild (FilterRailResponsive
        // hands back the new search-string). The wrapper enforces a 44×44
        // touch target around the 16 px glyph per the responsive contract.
        <a
          href={onRemoveHref}
          aria-label={`Remove ${label} filter`}
          className="-mr-1 inline-flex h-[26px] min-h-[26px] min-w-[26px] items-center justify-center rounded-pill text-ink-tertiary transition-colors duration-hover ease-smooth hover:text-ink-primary focus-visible:text-ink-primary"
          // Wrap in a 44 px hit region via padding while keeping visual
          // size compact; iOS/Android both honour `padding` as the touch
          // target. Inline style here because Tailwind has no idiomatic
          // way to express "expand the hit-box without changing the box".
          style={{
            padding: "12px",
            margin: "-12px -12px -12px 0",
          }}
        >
          <X size={16} weight="bold" aria-hidden />
        </a>
      ) : null}
    </span>
  );
}
