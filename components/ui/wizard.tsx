// Spec R1 — Wizard primitive.
//
// Multi-step form chrome used by Smart-Match (R4 buyer B4) and the
// supplier-claim flow (R5 S1). Renders a stepper above the current
// step's content. Steps content is the consumer's responsibility —
// this component is pure shell + progress indicator.
//
// Mobile: compact "Step N of M" + segmented bar.
// Desktop (`md+`): full horizontal stepper with numbered chips + labels.
//
// Pair with <StickyActionBar> for Back/Next/Submit.

import * as React from "react";
import { cn } from "@/lib/utils";

type WizardStep = {
  /** Stable step id, used as the segmented-bar key. */
  id: string;
  /** Short label shown next to the step number on desktop. */
  label: string;
  /** Optional hint shown under the label on desktop. */
  hint?: string;
};

type WizardProps = {
  steps: WizardStep[];
  /** Zero-based index of the active step. */
  current: number;
  /** Body content for the active step. */
  children: React.ReactNode;
  className?: string;
};

export function Wizard({ steps, current, children, className }: WizardProps) {
  const total = steps.length;
  const safeCurrent = Math.min(Math.max(0, current), Math.max(0, total - 1));
  const activeStep = steps[safeCurrent];

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Mobile compact stepper. */}
      <div
        role="group"
        aria-label="Progress"
        className="md:hidden"
      >
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-tertiary">
            Step {safeCurrent + 1} of {total}
          </p>
          <p className="font-display text-[14px] font-semibold text-ink-primary">
            {activeStep?.label}
          </p>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "h-1.5 flex-1 rounded-pill transition-colors duration-tab ease-smooth",
                i <= safeCurrent ? "bg-brand-forest" : "bg-hairline-strong",
              )}
            />
          ))}
        </div>
      </div>

      {/* Desktop horizontal stepper. */}
      <ol
        role="list"
        aria-label="Wizard steps"
        className="hidden md:flex md:items-start md:gap-3"
      >
        {steps.map((s, i) => {
          const status =
            i < safeCurrent ? "done" : i === safeCurrent ? "active" : "todo";
          return (
            <li
              key={s.id}
              aria-current={status === "active" ? "step" : undefined}
              className="flex flex-1 items-start gap-3"
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-pill border font-mono text-[12px] font-semibold",
                  status === "done" &&
                    "border-brand-forest bg-brand-forest text-ink-on-accent",
                  status === "active" &&
                    "border-brand-forest bg-brand-forest-tint text-brand-forest",
                  status === "todo" &&
                    "border-hairline-strong bg-surface-l1 text-ink-tertiary",
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "font-display text-[13px] font-semibold leading-tight",
                    status === "todo" ? "text-ink-tertiary" : "text-ink-primary",
                  )}
                >
                  {s.label}
                </p>
                {s.hint ? (
                  <p className="mt-0.5 font-mono text-[11px] leading-snug text-ink-tertiary">
                    {s.hint}
                  </p>
                ) : null}
              </div>
              {i < total - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "mt-3 hidden h-px flex-1 md:block",
                    status === "done" ? "bg-brand-forest" : "bg-hairline-strong",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div>{children}</div>
    </div>
  );
}
