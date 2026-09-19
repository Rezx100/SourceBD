// Source marks and the initials tile (REZ-A, artifact SourceMarks README).
//
// A mark is a 20px `rounded-sm` square coloured by rank — `tier-1` darkest
// (government) to `tier-5` white with an outline (foreign regulators) — with
// a two-letter mono stamp inside. Beside a single fact it is 16px. Neutral on
// purpose: rank reads without a legend and colour stays free for status.

import type { TierRank } from "@/lib/design/tokens";
import { sourceCountLabel, type SourceMarkModel } from "@/lib/dashboard/source-tiers";
import { cn } from "@/lib/utils";

export const TIER_FILL: Record<TierRank, string> = {
  1: "bg-tier-1 text-tier-1-on",
  2: "bg-tier-2 text-tier-2-on",
  3: "bg-tier-3 text-tier-3-on",
  4: "bg-tier-4 text-tier-4-on",
  5: "bg-tier-5 text-tier-5-on ring-1 ring-inset ring-tier-5-line",
};

/** One rank square. `sm` is the 16px form used beside a fact. Links to the register page when the record carries one. */
export function SourceMark({ mark, sm = false, className }: { mark: SourceMarkModel; sm?: boolean; className?: string }) {
  const classes = cn(
    "inline-grid shrink-0 place-items-center font-mono font-medium leading-none tracking-[0.02em]",
    sm ? "size-4 rounded-xs text-[8px]" : "size-5 rounded-sm text-[9.5px]",
    TIER_FILL[mark.tier],
    className,
  );
  if (mark.href) {
    return (
      <a href={mark.href} target="_blank" rel="noreferrer" aria-label={`Source: ${mark.name} (opens the register page)`} title={mark.name} className={classes}>
        {mark.mark}
      </a>
    );
  }
  return (
    <span role="img" aria-label={`Source: ${mark.name}`} title={mark.name} className={classes}>
      {mark.mark}
    </span>
  );
}

/**
 * The mark row: one square per source, best rank first, then a caption —
 * the count ("11 sources") or the names spelled out. Wraps at 11.
 */
export function SourceMarks({
  marks,
  caption = "count",
  sm = false,
  className,
}: {
  marks: readonly SourceMarkModel[];
  caption?: "count" | "names" | "none";
  sm?: boolean;
  className?: string;
}) {
  const text =
    caption === "count" ? sourceCountLabel(marks.length) : caption === "names" ? marks.map((m) => m.label).join(" · ") : null;
  return (
    <span className={cn("inline-flex flex-wrap items-center", sm ? "gap-0.5" : "gap-[3px]", className)}>
      {marks.map((m) => (
        <SourceMark key={m.code} mark={m} sm={sm} />
      ))}
      {text ? <span className="ml-[5px] whitespace-nowrap text-xs text-ink-subtle">{text}</span> : null}
    </span>
  );
}

/** The 48px initials slot on the top source's rank colour; 24px in a table row. */
export function LogoTile({
  initials,
  tier,
  size = "md",
  className,
}: {
  initials: string;
  tier: TierRank;
  size?: "md" | "sm";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center font-medium tracking-[0.01em]",
        size === "md" ? "size-12 rounded-sm text-title" : "size-6 rounded-xs text-[10px]",
        TIER_FILL[tier],
        className,
      )}
    >
      {initials}
    </span>
  );
}
