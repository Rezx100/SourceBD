"use client";

// Spec R1 — MobileDrawer.
//
// Off-canvas nav drawer for phones. Uses a permanently mounted fixed
// overlay + CSS transform transitions — same pattern as marketing top-nav.
// Native <dialog> + flex layout caused visible "pingpong" jank on open
// (panel slides in, snaps back off-screen, settles). Sheet is kept for
// bottom/center modals only.

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Edge to slide in from. Defaults to left (matches typical app-nav
   *  drawer convention). */
  side?: "left" | "right";
  label: string;
  children: React.ReactNode;
  className?: string;
};

export function MobileDrawer({
  open,
  onClose,
  side = "left",
  label,
  children,
  className,
}: MobileDrawerProps) {
  const [entered, setEntered] = React.useState(false);
  const openRef = React.useRef(open);
  openRef.current = open;

  // Slide in only after one off-screen paint (double rAF).
  React.useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }

    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setEntered(true);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (!openRef.current) {
        setEntered(false);
      }
    };
  }, [open]);

  // Scroll lock + Esc while open.
  React.useEffect(() => {
    if (!open) return;
    document.documentElement.setAttribute("data-scroll-lock", "true");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.removeAttribute("data-scroll-lock");
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const fromRight = side === "right";
  const visible = open && entered;
  const offScreen = fromRight ? "translate3d(100%, 0, 0)" : "translate3d(-100%, 0, 0)";

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const drawer = (
    <div
      className={cn(
        "fixed inset-0 z-[100] overflow-hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={cn(
          "absolute inset-0 h-full w-full cursor-default bg-neutral-950/30 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none",
          visible ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        inert={!open}
        style={{ transform: visible ? "translate3d(0, 0, 0)" : offScreen }}
        className={cn(
          "absolute top-0 flex h-[100dvh] max-h-[100dvh] w-[min(86vw,322px)] flex-col overflow-hidden border-neutral-200 bg-white",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
          fromRight ? "right-0 border-l" : "left-0 border-r",
          className,
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 safe-pt">
          <div className="min-w-0 flex-1 truncate font-display text-[16px] font-semibold text-ink-primary">
            {label}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-pill text-ink-tertiary hover:bg-brand-forest-tint hover:text-ink-primary"
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 safe-pb">
          {children}
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(drawer, document.body);
}
