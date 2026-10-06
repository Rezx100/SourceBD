"use client";

// A thin bar across the top while the landing hands over to the results. A
// search can take seconds to answer, and the founder's walkthrough (6 Oct 2026)
// picked a product from a filter menu and watched a page that looked unchanged
// for most of a minute. React events bubble through portals, so a click on a
// menu item (drawn in a portal) reaches this wrapper too.

import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

/** True for a plain left click on a same-tab link: the clicks that start a navigation here. */
export function startsNavigation(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; target: unknown }): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const el = e.target as { closest?: (s: string) => { getAttribute: (n: string) => string | null } | null } | null;
  const a = el?.closest?.("a[href]");
  if (!a) return false;
  const target = a.getAttribute("target");
  return !target || target === "_self";
}

export function PendingNav({ children, className }: { children: ReactNode; className?: string }) {
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();
  useEffect(() => setBusy(false), [pathname]);
  // Back from the results restores this page from the browser's cache with the bar still drawn.
  useEffect(() => {
    const off = () => setBusy(false);
    window.addEventListener("pageshow", off);
    return () => window.removeEventListener("pageshow", off);
  }, []);
  return (
    <div
      className={className}
      aria-busy={busy || undefined}
      onClickCapture={(e: MouseEvent) => {
        if (startsNavigation(e)) setBusy(true);
      }}
      onSubmitCapture={() => setBusy(true)}
    >
      {busy ? (
        <div role="status" aria-label="Loading suppliers" className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-brand-tint">
          <div className="h-full w-1/3 bg-brand motion-safe:animate-pending" />
        </div>
      ) : null}
      {children}
    </div>
  );
}
