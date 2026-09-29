// Source marks and the initials tile (REZ-A, artifact SourceMarks README).
//
// A mark is a 20px `rounded-sm` square coloured by rank — `tier-1` darkest
// (government) to `tier-5` white with an outline (foreign regulators) — with
// a two-letter mono stamp inside. Beside a single fact it is 16px. Neutral on
// purpose: rank reads without a legend and colour stays free for status.

import { tiers, type TierRank } from "@/lib/design/tokens";
import { sourceLogo } from "@/lib/dashboard/source-logos";
import { sourceCountLabel, type SourceMarkModel } from "@/lib/dashboard/source-tiers";
import { cn } from "@/lib/utils";

export const TIER_FILL: Record<TierRank, string> = {
  1: "bg-tier-1 text-tier-1-on",
  2: "bg-tier-2 text-tier-2-on",
  3: "bg-tier-3 text-tier-3-on",
  4: "bg-tier-4 text-tier-4-on",
  5: "bg-tier-5 text-tier-5-on ring-1 ring-inset ring-tier-5-line",
};

// Rank is carried by fill lightness alone, which fails WCAG 1.4.1/1.3.1 for
// anyone who cannot tell the fills apart: the accessible name below is the
// text equivalent (accessibility, cycle 19, BLOCKING F1 part A). `tiers` is
// the same rank→name list the dev tools legend renders (app/dev/ds/page.tsx).
const TIER_NAME: Record<TierRank, string> = Object.fromEntries(tiers.map((t) => [t.rank, t.label])) as Record<
  TierRank,
  string
>;

// The 1px ring round a logo frame carries the rank the square's fill carried:
// the same neutral ramp, tier 1 darkest (logos.lock.md §1, "tier ring").
const TIER_RING: Record<TierRank, string> = {
  1: "ring-tier-1",
  2: "ring-tier-2",
  3: "ring-tier-3",
  4: "ring-line-strong",
  5: "ring-tier-5-line",
};

/**
 * One source mark. With an approved logo (`lib/dashboard/source-logos.ts`) it
 * is the register's own mark in one colour, in a white frame ringed by rank;
 * without one, the two-letter square filled by rank. `sm` sits beside a fact,
 * `lg` heads a row in the Sources list and a certificate card. Links to the
 * register page when the record carries one.
 */
export function SourceMark({
  mark,
  sm = false,
  lg = false,
  className,
}: {
  mark: SourceMarkModel;
  sm?: boolean;
  lg?: boolean;
  className?: string;
}) {
  const logo = sourceLogo(mark.code);
  const classes = logo
    ? cn(
        "inline-grid shrink-0 place-items-center rounded-sm bg-surface ring-1 ring-inset",
        lg ? "size-8 p-[5px]" : sm ? "size-5 p-[3px]" : "size-6 p-[3px]",
        TIER_RING[mark.tier],
        className,
      )
    : cn(
        "inline-grid shrink-0 place-items-center font-mono font-medium leading-none tracking-[0.02em]",
        lg ? "size-8 rounded-sm text-xs" : sm ? "size-4 rounded-xs text-[8px]" : "size-5 rounded-sm text-[9.5px]",
        TIER_FILL[mark.tier],
        className,
      );
  // A mask, so the one colour is the kit's ink token rather than whatever the
  // file was drawn in.
  const body = logo ? (
    <span
      aria-hidden
      className="block size-full bg-ink-strong [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
      style={{ maskImage: `url(${logo})`, WebkitMaskImage: `url(${logo})` }}
    />
  ) : (
    mark.mark
  );
  if (mark.href) {
    return (
      <a
        href={mark.href}
        target="_blank"
        rel="noreferrer"
        aria-label={`Source: ${mark.name}, ${TIER_NAME[mark.tier]} (opens ${mark.opens === "list" ? "the disclosure list" : "the register page"})`}
        title={mark.name}
        className={classes}
      >
        {body}
      </a>
    );
  }
  return (
    <span role="img" aria-label={`Source: ${mark.name}, ${TIER_NAME[mark.tier]}`} title={mark.name} className={classes}>
      {body}
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
      {/* Wraps: eleven register names spelled out ran 598px wide on a 320px sheet. */}
      {text ? <span className="ml-[5px] text-xs text-ink-subtle [overflow-wrap:anywhere]">{text}</span> : null}
    </span>
  );
}

/** The 48px initials slot on the top source's rank colour; 40px in a list row (as tall as the name and its place line, founder's video, 29 Sep 2026); 24px in a picker. */
export function LogoTile({
  initials,
  tier,
  size = "md",
  className,
}: {
  initials: string;
  tier: TierRank;
  size?: "md" | "row" | "sm";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center font-medium tracking-[0.01em]",
        size === "md" ? "size-12 rounded-sm text-title" : size === "row" ? "size-10 rounded-sm text-sm" : "size-6 rounded-xs text-[10px]",
        TIER_FILL[tier],
        className,
      )}
    >
      {initials}
    </span>
  );
}
