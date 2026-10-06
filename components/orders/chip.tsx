// The status chip of an order (Paper `10 · Orders list`): 24 tall, radius 4, 14/500. A draft is
// dashed (nothing has started), in production an outline, shipped and in transit the info tint,
// delivered a grey tint with a check, cancelled an outline in quiet ink. Server-safe.

import { Check } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import type { OrderChipTone } from "./words";

const TONE: Record<OrderChipTone, string> = {
  draft: "border border-dashed border-line-strong text-ink-3",
  production: "border border-line text-ink-2",
  shipped: "bg-info-tint text-info",
  delivered: "bg-sunken text-ink-2",
  cancelled: "border border-line text-ink-3",
};

export function OrderChip({ tone, children, className }: { tone: OrderChipTone; children: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-2 text-sm font-medium", TONE[tone], className)}>
      {tone === "delivered" ? <Check size={14} weight="bold" className="shrink-0" aria-hidden /> : null}
      {children}
    </span>
  );
}
