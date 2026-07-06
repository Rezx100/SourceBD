"use client";

// Spec R1 — MasterDetail.
//
// Wide viewport: list pane + detail pane side-by-side.
// Narrow viewport (`<lg`): single pane with explicit back navigation
// (the consumer renders the back link inside the detail pane; this
// component is layout-only).
//
// Two sub-exports — `<MasterDetail>` (the layout) and
// `<MasterDetailScrollRestore>` (the tiny island that snapshots the
// list-pane scroll position to sessionStorage on detail-open and
// restores it on detail-close).
//
// Layout itself is CSS-only — the island is opt-in for routes that
// want scroll-position restore. Routes that don't include the island
// still get a perfectly functional layout.

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type MasterDetailProps = {
  /** Whether the route is on the detail half of the master/detail pair.
   *  Wide viewports render both; narrow viewports render whichever side
   *  matches `mode`. */
  mode: "list" | "detail";
  list: React.ReactNode;
  detail: React.ReactNode;
  className?: string;
};

export function MasterDetail({
  mode,
  list,
  detail,
  className,
}: MasterDetailProps) {
  return (
    <div
      className={cn(
        "flex w-full gap-4",
        // Narrow: stack — only the active side is visible.
        "flex-col",
        // Wide: split.
        "lg:flex-row lg:gap-6",
        className,
      )}
    >
      <div
        className={cn(
          "min-w-0",
          // Narrow visibility: hide when on detail.
          mode === "detail" ? "hidden lg:block" : "block",
          // Wide: fixed-width list pane.
          "lg:w-[322px] lg:flex-shrink-0 lg:max-w-[360px]",
        )}
      >
        {list}
      </div>
      <div
        className={cn(
          "min-w-0 flex-1",
          mode === "list" ? "hidden lg:block" : "block",
        )}
      >
        {detail}
      </div>
    </div>
  );
}

/**
 * Mount inside the LIST pane to snapshot its scroll position to
 * sessionStorage whenever the user navigates away (to a detail page).
 * On return to the list, the scroll position is restored.
 *
 * Pass a stable `storageKey` — typically the list route's pathname
 * (e.g. "/app/messages").
 */
export function MasterDetailScrollRestore({
  storageKey,
}: {
  storageKey?: string;
}) {
  const pathname = usePathname() ?? "";
  const key = `r1-md-scroll:${storageKey ?? pathname}`;
  React.useLayoutEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const n = Number.parseInt(raw, 10);
        if (Number.isFinite(n)) window.scrollTo({ top: n, behavior: "instant" as ScrollBehavior });
      }
    } catch {
      /* sessionStorage can throw in private mode; degrade silently. */
    }
    const onScroll = () => {
      try {
        sessionStorage.setItem(key, String(window.scrollY));
      } catch {
        /* noop */
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [key]);
  return null;
}
