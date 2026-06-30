import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ReceiptsRing — the canonical R1 verified-sources trust glyph.
 *
 * Visual: stack of up to 5 short horizontal lines (decreasing widths) inside a
 * rounded card. Per design-brief-phase1.md §13 / prototypes/profile-naafco-group.html.
 * Hard invariants:
 *  - Payload = COUNT of distinct Tier 1–3 sources for the supplier.
 *  - NOT the SBI numeric, pillar value, or A/B/C/D grade.
 *  - aria-label is `"Verified by <N> independent Tier 1–3 sources"`.
 *  - Stack saturates at 5 lines; the count itself can be higher.
 *  - The pre-existing circular-meter variant is permanently retired.
 */

export type ReceiptsRingSize = 12 | 24 | 32 | 48 | 64;

export interface ReceiptsRingProps {
  sources: number;
  size?: ReceiptsRingSize;
  className?: string;
}

const SATURATION = 5;

const BOX_BY_SIZE: Record<
  ReceiptsRingSize,
  { w: number; h: number; padX: number; padY: number; gap: number }
> = {
  12: { w: 16, h: 14, padX: 2, padY: 3, gap: 1 },
  24: { w: 28, h: 28, padX: 4, padY: 5, gap: 2 },
  32: { w: 36, h: 36, padX: 6, padY: 7, gap: 3 },
  48: { w: 52, h: 52, padX: 7, padY: 9, gap: 4 },
  64: { w: 64, h: 60, padX: 8, padY: 10, gap: 5 },
};

const LINE_WIDTHS = ["90%", "70%", "80%", "60%", "50%"] as const;

export function ReceiptsRing({
  sources,
  size = 32,
  className,
}: ReceiptsRingProps) {
  const count = Math.max(0, Math.floor(sources));
  const visible = count === 0 ? 0 : Math.min(SATURATION, count);
  const dims = BOX_BY_SIZE[size];

  const label =
    count === 0
      ? "No verified Tier 1–3 sources yet"
      : `Verified by ${count} independent Tier 1–3 ${count === 1 ? "source" : "sources"}`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("glyph", className)}
      style={{
        width: dims.w,
        height: dims.h,
        padding: `${dims.padY}px ${dims.padX}px`,
        gap: dims.gap,
      }}
    >
      {visible === 0 ? (
        <span
          aria-hidden
          style={{
            width: "50%",
            height: 2,
            background: "var(--ink-tertiary)",
            opacity: 0.35,
            borderRadius: 1,
          }}
        />
      ) : (
        Array.from({ length: visible }).map((_, i) => (
          <span key={i} className="line" style={{ width: LINE_WIDTHS[i] }} />
        ))
      )}
    </span>
  );
}
