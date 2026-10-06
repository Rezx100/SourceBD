// The supplier claim track (find, start, verify) on the v4 kit: the three steps and the status chip
// the landing, the status page and the verify page share. Server-safe.

import { CheckCircle, Clock, MinusCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { Chip } from "@/components/kit";
import { cn } from "@/lib/utils";

export const CLAIM_STEPS = [
  { id: "search", label: "Find company", hint: "Search the directory" },
  { id: "initiate", label: "Verify ownership", hint: "Company email proof" },
  { id: "verify", label: "Confirm", hint: "Click the email link" },
] as const;

/** The three steps, the one in hand marked `aria-current="step"`. `current` is zero-based. */
export function ClaimSteps({ current }: { current: number }) {
  return (
    <ol aria-label="Claim steps" className="flex flex-col gap-3 sm:flex-row sm:gap-6">
      {CLAIM_STEPS.map((s, i) => {
        const done = i < current;
        const here = i === current;
        return (
          <li key={s.id} aria-current={here ? "step" : undefined} className="flex flex-1 items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
                done ? "border-brand bg-brand text-surface" : here ? "border-brand bg-brand-tint text-brand" : "border-line-strong text-ink-3",
              )}
            >
              {i + 1}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className={cn("text-base font-medium", i > current ? "text-ink-3" : "text-ink")}>{s.label}</span>
              <span className="text-sm text-ink-3">{s.hint}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const STATUS: Record<string, { icon: Icon; caution?: true }> = {
  pending_email: { icon: Clock },
  email_verified: { icon: Clock },
  approved: { icon: CheckCircle },
  rejected: { icon: XCircle, caution: true },
  expired: { icon: Clock, caution: true },
  cancelled: { icon: MinusCircle },
};

/** A claim's status as a chip; `children` is the words (the landing and the status page word them differently). */
export function ClaimStatusChip({ status, children }: { status: string; children: string }) {
  const s = STATUS[status] ?? { icon: MinusCircle };
  return (
    <Chip icon={s.icon} tone={s.caution ? "caution" : "neutral"}>
      {children}
    </Chip>
  );
}
