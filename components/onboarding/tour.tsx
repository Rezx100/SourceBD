"use client";

// Spec H5 — In-app onboarding tour client.
//
// Route-independent modal (≥640px) / bottom sheet (<640px) with 5 steps.
// Persistence is via the `profile_onboarding_set` RPC (migration 0047), which
// verifies auth.uid() = profiles.id server-side. Esc + the Skip button both
// dismiss; Enter on the Next/Done button advances. Tab is trapped inside the
// active step so keyboard users can't focus background page chrome.
//
// Renders nothing until mounted in the browser to avoid a hydration mismatch
// when the server-rendered shell carries the un-styled portal target.

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

import { BUYER_STEPS, SUPPLIER_STEPS, type TourStep } from "./tour-steps";

type Flavour = "buyer" | "supplier";

type TourProps = {
  flavour: Flavour;
  initialStep?: number;
};

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function Tour({ flavour, initialStep = 0 }: TourProps) {
  const steps = useMemo<ReadonlyArray<TourStep>>(
    () => (flavour === "buyer" ? BUYER_STEPS : SUPPLIER_STEPS),
    [flavour],
  );
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(
    Math.max(0, Math.min(initialStep, steps.length - 1)),
  );
  const cardRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    setOpen(true);
  }, []);

  const persist = useCallback(
    async (key: string, value: unknown) => {
      try {
        const supabase = getSupabaseBrowserClient();
        await supabase.rpc("profile_onboarding_set", {
          p_key: key,
          p_value: value as never,
        });
      } catch {
        // Best-effort. If the persist fails the user will re-see the tour
        // next visit — acceptable for a v1 in-app onboarding flow.
      }
    },
    [],
  );

  const close = useCallback(
    async (reason: "completed" | "dismissed") => {
      setOpen(false);
      const key = reason === "completed" ? "tour_completed_at" : "tour_dismissed_at";
      await persist(key, new Date().toISOString());
    },
    [persist],
  );

  const advance = useCallback(async () => {
    const next = stepIdx + 1;
    if (next >= steps.length) {
      await close("completed");
      return;
    }
    setStepIdx(next);
    await persist("tour_last_step", next);
  }, [stepIdx, steps.length, close, persist]);

  const back = useCallback(() => {
    setStepIdx((i) => Math.max(0, i - 1));
  }, []);

  // Esc closes; Tab is trapped inside the card.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void close("dismissed");
        return;
      }
      if (e.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;
      const focusables = Array.from(
        card.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Initial focus + recover stray focus that escapes the card.
  useEffect(() => {
    if (!open) return;
    const card = cardRef.current;
    if (!card) return;
    const first = card.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onFocusIn = (e: FocusEvent) => {
      if (!cardRef.current) return;
      const target = e.target as Node | null;
      if (target && !cardRef.current.contains(target)) {
        const recover = cardRef.current.querySelector<HTMLElement>(FOCUSABLE);
        recover?.focus();
      }
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [open]);

  if (!open) return null;
  const step = steps[stepIdx];
  if (!step) return null;
  const isLast = stepIdx === steps.length - 1;

  return (
    <div
      aria-hidden={!open}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-0 py-0 sm:items-center sm:px-4 sm:py-8"
      style={{ animation: "fadeIn var(--dur-tab) var(--ease)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) void close("dismissed");
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="w-full max-w-xl rounded-t-[var(--r-hero)] border border-hairline bg-bg-l1 p-5 shadow-l2 sm:rounded-[var(--r-card)] sm:p-6"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-ink-tertiary">
            Step {stepIdx + 1} of {steps.length}
          </p>
          <button
            type="button"
            onClick={() => void close("dismissed")}
            className="text-[11px] text-ink-tertiary hover:text-ink-primary"
            aria-label="Skip tour"
          >
            Skip
          </button>
        </div>
        <h2
          id={titleId}
          className="font-display text-xl font-semibold tracking-tightish text-ink-primary"
        >
          {step.title}
        </h2>
        <p id={bodyId} className="mt-2 text-[14px] text-ink-secondary">
          {step.body}
        </p>
        <div className="mt-4">
          <Button asChild variant="ghost" size="sm">
            <Link href={step.cta_href}>{step.cta_label} →</Link>
          </Button>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={
                  i === stepIdx
                    ? "h-1.5 w-6 rounded-full bg-accent-indigo"
                    : "h-1.5 w-1.5 rounded-full bg-hairline"
                }
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={back}
              disabled={stepIdx === 0}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void advance()}
            >
              {isLast ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
