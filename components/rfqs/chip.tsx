// The status chip of an RFQ (Paper `10 · RFQs list`): 24 tall, radius 4, 14/500. Quotes in are
// info; waiting is a plain outline; accepted is the one brand tint (a quote chosen, not just
// quotes arriving); a draft is dashed, because it has not been sent. Server-safe.

import { Check } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import type { ChipTone } from "./words";

const TONE: Record<ChipTone, string> = {
  quoted: "bg-info-tint text-info",
  waiting: "border border-line text-ink-2",
  accepted: "bg-brand-tint text-brand-ink",
  draft: "border border-dashed border-line-strong text-ink-3",
  closed: "border border-line text-ink-3",
};

export function RfqChip({ tone, children, className }: { tone: ChipTone; children: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-2 text-sm font-medium", TONE[tone], className)}>
      {tone === "accepted" ? <Check size={14} weight="bold" className="shrink-0" aria-hidden /> : null}
      {children}
    </span>
  );
}
