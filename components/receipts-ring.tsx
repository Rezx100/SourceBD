import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ReceiptsRing — the canonical trust glyph (frontend-design-spec.md §0,
 * design-brief-phase1.md §13, ai-workflow-rules.md).
 *
 * Hard invariants (NEVER violate):
 *  - Centre payload is the COUNT of distinct Tier 1–3 sources for the supplier.
 *  - It is NOT the SBI numeric total, pillar value, or A/B/C/D grade.
 *  - It is NOT a "score" / "rating". Centre label is the integer only.
 *  - aria-label is always `"<N> verified sources"` (count noun).
 *  - Ring fill saturates at 5+; colour ladder is count-based, not score-based.
 */

export type ReceiptsRingSize = 12 | 24 | 32 | 48 | 64;

export interface ReceiptsRingProps {
  /** Count of distinct Tier 1–3 sources (gov + industry register + cert body). */
  sources: number;
  /** Optical size in pixels. One of the locked optical sizes. */
  size?: ReceiptsRingSize;
  className?: string;
}

const SATURATION = 5; // ring fills 0→1 over [0, SATURATION]

function colourForCount(count: number): { ring: string; ink: string } {
  // Count-based ladder (frontend-design-spec.md §0, design-brief-phase1.md §13).
  if (count <= 0) return { ring: "#7A0B1F", ink: "#7A0B1F" }; // dark red
  if (count === 1) return { ring: "var(--sem-red)", ink: "var(--sem-red)" };
  if (count === 2) return { ring: "var(--sem-amber)", ink: "var(--sem-amber)" };
  return { ring: "var(--sem-green)", ink: "var(--sem-green)" };
}

const STROKE_BY_SIZE: Record<ReceiptsRingSize, number> = {
  12: 1.5,
  24: 2,
  32: 2.5,
  48: 3,
  64: 3.5,
};

const FONT_BY_SIZE: Record<ReceiptsRingSize, number> = {
  12: 0, // numeric hidden — accessible label only
  24: 10,
  32: 12,
  48: 16,
  64: 22,
};

export function ReceiptsRing({
  sources,
  size = 32,
  className,
}: ReceiptsRingProps) {
  const count = Math.max(0, Math.floor(sources));
  const filled = Math.min(1, count / SATURATION);
  const stroke = STROKE_BY_SIZE[size];
  const fontSize = FONT_BY_SIZE[size];
  const colours = colourForCount(count);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * filled;

  const label = `${count} verified ${count === 1 ? "source" : "sources"}`;

  return (
    <span
      className={cn("inline-flex shrink-0", className)}
      role="img"
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        focusable="false"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--hairline-strong)"
          strokeWidth={stroke}
        />
        {/* Fill arc — starts at 12 o'clock, clockwise */}
        {count > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colours.ring}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
        {/* Centre payload — count, never SBI/score/grade */}
        {fontSize > 0 && (
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-mono)"
            fontWeight={700}
            fontSize={fontSize}
            fill={colours.ink}
          >
            {count}
          </text>
        )}
      </svg>
    </span>
  );
}
