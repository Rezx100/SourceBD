"use client";

// Plain-English explainer for the source-trust hierarchy, rebuilt as a
// proper popover (was a native <details>, which couldn't close on
// outside-click and rendered a generic, mis-aligned panel on mobile).
//
// Variants:
//   - `inline` → compact "Sources" pill in the profile header. Opens a
//                floating popover on desktop (anchored under the pill) and
//                a centred modal + scrim on phones. Closes on outside-click
//                and Escape.
//   - `footer` → an in-flow expandable card at the page footer.

import { useEffect, useRef, useState } from "react";
import { Info, X } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";

type Variant = "header" | "footer" | "inline";

const SUMMARY = "How we verify our sources";

function ExplainerBody() {
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-ink-secondary">
      <p>
        We rank every source by how official it is. A factory only appears here
        when at least one source from groups 1, 2 or 3 confirms it — a brand
        mention alone is never enough.
      </p>
      <ol className="space-y-2">
        <li>
          <strong className="font-semibold text-ink-primary">
            Government registries
          </strong>{" "}
          — RJSC, BIN, EPB. The most trusted.
        </li>
        <li>
          <strong className="font-semibold text-ink-primary">
            Industry associations
          </strong>{" "}
          — BGMEA, BKMEA, BTMA, BGAPMEA. Verified factory members.
        </li>
        <li>
          <strong className="font-semibold text-ink-primary">
            Audit &amp; certification bodies
          </strong>{" "}
          — RSC, OEKO-TEX, WRAP, GOTS, GRS.
        </li>
        <li>
          <strong className="font-semibold text-ink-primary">
            Brand-published supplier lists
          </strong>{" "}
          — useful, but never enough on their own.
        </li>
      </ol>
    </div>
  );
}

export function SourcesExplainer({ variant = "header" }: { variant?: Variant }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // ── Footer: in-flow expandable card (no floating layer needed) ──────────
  if (variant === "footer") {
    return (
      <div ref={rootRef} className="mt-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-secondary transition-colors hover:text-ink-primary"
        >
          <span className="flex size-[18px] items-center justify-center rounded-full bg-brand-forest text-[10px] font-bold text-white">
            ?
          </span>
          {SUMMARY}
        </button>
        {open ? (
          <div className="mt-3 max-w-2xl rounded-card border border-hairline bg-surface-l1 p-5">
            <ExplainerBody />
          </div>
        ) : null}
      </div>
    );
  }

  // ── Inline / header: trigger pill + floating popover ────────────────────
  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors",
          open
            ? "border-brand-forest bg-brand-forest-soft text-brand-forest"
            : "border-hairline-strong bg-surface-l1 text-ink-secondary hover:border-brand-forest/40 hover:text-brand-forest",
        )}
      >
        <Info size={13} weight="fill" aria-hidden className="text-brand-forest" />
        Sources
      </button>

      {open ? (
        <>
          {/* Phone scrim — tap to dismiss. Hidden on sm+. */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] sm:hidden"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label={SUMMARY}
            className={cn(
              // Phone: centred modal. Desktop: anchored popover under the pill.
              "fixed inset-x-4 top-1/2 z-50 mx-auto max-w-[360px] -translate-y-1/2 rounded-card border border-hairline bg-surface-l1 p-5 shadow-l2",
              "sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+10px)] sm:mx-0 sm:w-[340px] sm:max-w-none sm:translate-y-0",
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-display text-[15px] font-bold tracking-[-0.01em] text-ink-primary">
                {SUMMARY}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex size-7 shrink-0 items-center justify-center rounded-pill text-ink-tertiary transition-colors hover:bg-brand-forest-tint hover:text-ink-primary"
              >
                <X size={15} weight="bold" aria-hidden />
              </button>
            </div>
            <ExplainerBody />
          </div>
        </>
      ) : null}
    </div>
  );
}
