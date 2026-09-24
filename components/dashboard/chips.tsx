// Chips and badges (REZ-A, artifact StatusBadge README): facts in status hues.
//
// `positive` valid / active · `caution` expiring, expired, behind schedule,
// no longer covered · `neutral` outline for plain facts (EPB exporter · N
// lines, Listed by) · `quiet` dashed for nothing on file · `sanction` solid,
// reserved · `on` brand-tint-strong for the active filter. Never brand on a
// fact, never a score.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";

export type ChipTone = "positive" | "caution" | "neutral" | "quiet" | "sanction" | "on";

const CHIP_TONE: Record<ChipTone, string> = {
  positive: "bg-positive-tint text-positive-ink",
  caution: "bg-caution-tint text-caution-ink",
  neutral: "border-line bg-surface text-ink",
  quiet: "border-dashed border-quiet-line font-normal text-quiet-ink",
  sanction: "bg-sanction text-sanction-on",
  on: "bg-brand-tint-strong text-brand-ink",
};

/** `.chip`: 26px, 13px medium, `rounded-sm`; 22px `compact` in a table row. */
export function Chip({
  tone = "neutral",
  icon,
  compact = false,
  className,
  children,
}: {
  tone?: ChipTone;
  icon?: IconName;
  compact?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        // Not `whitespace-nowrap`, and not a fixed height. One RSC chip —
        // "RSC covers S M Knitwears Limited. (Extension) · 53 % · behind
        // schedule" — is 428px on a single line, and inside a 218px column at
        // 320px it alone forced the whole DOCUMENT to 493px: hiding that one
        // element dropped it to 320. A chip carries a building's name, so its
        // width is the data's, not the design's, and any name of ordinary
        // length reproduces it. `min-h` keeps the one-line case identical to
        // the old fixed height; `[overflow-wrap:anywhere]` handles a single
        // token longer than the column, which a registration number can be.
        "inline-flex items-center rounded-sm border border-transparent font-medium [overflow-wrap:anywhere]",
        compact ? "min-h-[22px] gap-1 px-[7px] py-px text-xs" : "min-h-[26px] gap-1.5 px-2.5 py-px text-sm",
        CHIP_TONE[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} small /> : null}
      {children}
    </span>
  );
}

/** `.chips`: a wrapping row of chips with a "+N more" link at the end. */
export function Chips({
  more,
  moreHref = "#",
  nowrap = false,
  className,
  children,
}: {
  more?: number;
  moreHref?: string;
  nowrap?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn("flex items-center gap-2", nowrap ? "flex-nowrap gap-1" : "flex-wrap", className)}>
      {children}
      {more && more > 0 ? (
        // A bare `href="#"` is not inert: it is a focusable link that scrolls
        // the document to the top and destroys reading position, with nothing
        // telling the user it goes nowhere. The sheet's tabs already say so;
        // eleven of the page's nineteen placeholders did not.
        <a
          href={moreHref}
          aria-disabled={moreHref === "#" ? "true" : undefined}
          tabIndex={moreHref === "#" ? -1 : undefined}
          title={moreHref === "#" ? "The rest arrive with the record page" : undefined}
          className={cn("px-1 font-medium text-brand-ink", nowrap ? "text-xs" : "text-sm")}
        >
          +{more}
          {nowrap ? "" : " more"}
        </a>
      ) : null}
    </span>
  );
}

export type BadgeTone = "positive" | "caution" | "type" | "sanction" | "smart";

const BADGE_TONE: Record<BadgeTone, string> = {
  positive: "bg-positive-tint text-positive-ink",
  caution: "bg-caution-tint text-caution-ink",
  type: "bg-surface-sunken text-ink-muted",
  sanction: "bg-sanction text-sanction-on",
  smart: "bg-smart-tint text-smart",
};

/** `.badge`: 20px, 12px medium — a certificate state, an RFQ status, a company type. */
export function Badge({
  tone,
  icon,
  className,
  children,
}: {
  tone: BadgeTone;
  icon?: IconName;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-sm px-[7px] text-xs font-medium leading-4",
        BADGE_TONE[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} small /> : null}
      {children}
    </span>
  );
}
