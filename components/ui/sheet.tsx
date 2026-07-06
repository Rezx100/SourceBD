"use client";

// Spec R1 — Sheet / responsive modal.
//
// Built on the native HTML <dialog> element + .showModal(). This gives us
// (for free): focus containment inside the dialog, Esc-to-close, native
// `::backdrop` pseudo-element, top-layer rendering (above everything else
// without z-index gymnastics), and screen-reader modal semantics.
//
// What we add ourselves:
//   - Body scroll-lock via `data-scroll-lock` on <html> while open.
//   - `inert` on every sibling of the dialog under <body> so background
//     content cannot be focused or tab-stopped (defence in depth on top
//     of dialog's native focus trap).
//   - Backdrop-click closes (native dialog does not close on backdrop
//     click — we add a one-line listener).
//   - Swipe-down close on the bottom-sheet variant.
//   - Safe-area-inset padding on the bottom-sheet content.
//   - Focus restore on close is native to <dialog>.
//
// No new dependencies. Per AGENTS rule 4: no Radix Dialog.
//
// Variants:
//   side="bottom"  — bottom-sheet on every viewport (best for mobile filters)
//   side="center"  — centered modal on `md+`, bottom-sheet on `<md`
//                    (best for form dialogs)
//   side="left" / side="right" — off-canvas drawer (MobileDrawer uses its
//                    own fixed overlay; not this Sheet primitive)

import * as React from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

type Side = "bottom" | "center" | "left" | "right";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  side?: Side;
  /** ARIA-labelling for the dialog. One of `label` (visible heading text)
   *  or `aria-labelledby` (id of an existing heading) must be set. */
  label?: string;
  ariaLabelledBy?: string;
  /** Whether the user can swipe down to dismiss a bottom-side sheet. */
  swipeToClose?: boolean;
  /** Show the close × button in the header. Default true. */
  showCloseButton?: boolean;
  /** Optional heading rendered inside the sheet. Pass `null` to skip; if
   *  omitted, falls back to `label` text. */
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function Sheet({
  open,
  onClose,
  side = "bottom",
  label,
  ariaLabelledBy,
  swipeToClose = true,
  showCloseButton = true,
  header,
  children,
  className,
}: SheetProps) {
  const ref = React.useRef<HTMLDialogElement | null>(null);
  const touchStartY = React.useRef<number | null>(null);
  const touchDeltaY = React.useRef(0);
  // Drives the slide/fade-in transition (see r1-sheet--entered in
  // globals.css). Kept as state — not a CSS keyframe on `[open]` — because
  // re-matching a keyframe selector races with the synchronous `inert`
  // sweep below on some browsers, which visibly stutters/reverses the
  // panel for a frame or two ("pingpong" jank) right as it opens.
  const [entered, setEntered] = React.useState(false);
  const openRef = React.useRef(open);
  openRef.current = open;

  // Open/close + scroll-lock + inert siblings.
  React.useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;

    if (!open) {
      setEntered(false);
      if (dlg.open) {
        dlg.close();
      }
      document.documentElement.removeAttribute("data-scroll-lock");
      return;
    }

    // `open` — show if needed, then slide in after an off-screen paint.
    // Must run even when `dlg.open` is already true: Strict Mode's effect
    // re-mount can leave the dialog open while a prior cleanup cancelled the
    // enter rAF; skipping this branch caused the panel to slide in, get
    // reset off-screen ("pingpong"), and stay hidden.
    if (!dlg.open) {
      try {
        dlg.showModal();
      } catch {
        // Some browsers throw if showModal is called twice; ignore.
      }
    }

    document.documentElement.setAttribute("data-scroll-lock", "true");
    const sibs = Array.from(document.body.children).filter(
      (el) => el !== dlg && !el.contains(dlg),
    );
    sibs.forEach((el) => el.setAttribute("inert", ""));

    // A *single* rAF here isn't enough: React's commit for `setEntered`
    // can land in the very same frame React/the browser paints the
    // dialog's just-opened (pre-transition) state, so the panel never
    // gets a chance to actually render off-screen first — it jumps
    // straight to its resting position with no visible slide at all
    // (confirmed by sampling the real DOM: 0 → 68px with zero
    // in-between frames). Nesting two rAFs guarantees the browser has
    // committed a full paint of the off-screen state before we flip
    // to "entered", so the transition always has a real starting frame.
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setEntered(true);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      sibs.forEach((el) => el.removeAttribute("inert"));
      document.documentElement.removeAttribute("data-scroll-lock");
      // Strict Mode re-runs this cleanup while `open` is still true; only
      // reset the slide state on a real close so the panel doesn't bounce
      // back off-screen for a frame ("pingpong" jank).
      if (!openRef.current) {
        setEntered(false);
      }
    };
  }, [open]);

  // Native <dialog> fires `cancel` (on Esc) and `close` (after .close()).
  // We bind to both so the parent can clean up its own `open` state.
  React.useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    const onCloseEv = () => onClose();
    dlg.addEventListener("cancel", onCancel);
    dlg.addEventListener("close", onCloseEv);
    return () => {
      dlg.removeEventListener("cancel", onCancel);
      dlg.removeEventListener("close", onCloseEv);
    };
  }, [onClose]);

  // Backdrop click → close. Native <dialog> does not auto-close on
  // backdrop click; we detect "click landed on the dialog element
  // itself" (which is true when the click is on the backdrop area
  // outside the content panel).
  const onDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Swipe-down to close (bottom variant only).
  const onTouchStart = (e: React.TouchEvent) => {
    if (side !== "bottom" || !swipeToClose) return;
    touchStartY.current = e.touches[0]?.clientY ?? null;
    touchDeltaY.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (side !== "bottom" || !swipeToClose) return;
    if (touchStartY.current == null) return;
    const y = e.touches[0]?.clientY ?? touchStartY.current;
    touchDeltaY.current = y - touchStartY.current;
  };
  const onTouchEnd = () => {
    if (side !== "bottom" || !swipeToClose) return;
    if (touchDeltaY.current > 64) onClose();
    touchStartY.current = null;
    touchDeltaY.current = 0;
  };

  const sideClass =
    side === "bottom"
      ? "r1-sheet--bottom"
      : side === "center"
        ? "r1-sheet--center"
        : side === "left"
          ? "r1-sheet--left"
          : "r1-sheet--right";

  return (
    <dialog
      ref={ref}
      aria-label={ariaLabelledBy ? undefined : label}
      aria-labelledby={ariaLabelledBy}
      onClick={onDialogClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={cn(
        "r1-sheet",
        sideClass,
        entered && "r1-sheet--entered",
        "p-0 m-0 bg-transparent text-ink-primary",
        className,
      )}
    >
      <div
        className={cn(
          "r1-sheet-panel",
          "flex flex-col bg-surface-l1 shadow-l2",
          side === "bottom" &&
            "w-full max-h-[90dvh] rounded-t-card safe-pb",
          side === "center" &&
            "w-full max-h-[90dvh] rounded-t-card safe-pb md:w-auto md:min-w-[422px] md:max-w-[640px] md:rounded-card md:safe-pb-0",
          side === "left" &&
            "h-full max-h-[100dvh] w-[min(86vw,322px)] safe-py",
          side === "right" &&
            "h-full max-h-[100dvh] w-[min(86vw,322px)] safe-py",
        )}
      >
        {side === "bottom" && swipeToClose ? (
          <div className="mx-auto mt-2 h-1 w-10 rounded-pill bg-hairline-strong" aria-hidden />
        ) : null}
        {(header !== null && (header || label)) || showCloseButton ? (
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
            <div className="min-w-0 flex-1 truncate font-display text-[16px] font-semibold text-ink-primary">
              {header ?? label}
            </div>
            {showCloseButton ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-pill text-ink-tertiary hover:bg-brand-forest-tint hover:text-ink-primary"
              >
                <X size={18} weight="bold" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </dialog>
  );
}
