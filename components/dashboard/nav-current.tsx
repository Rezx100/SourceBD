"use client";

// On a phone the rail is a sideways-scrolling strip, and the current page's
// item — Messages, RFQs, Orders, Settings — starts off-screen to the right,
// so the first viewport never said where the buyer was. This scrolls the
// current item into view whenever the current item changes — the rail is
// the layout's and lives across every client navigation (27 Sep 2026), so
// "on mount" would be the first page only — and only when the strip
// actually overflows (on the desktop rail there is nothing to scroll). The
// order of the items never changes, so the rail stays the same on every
// page (WCAG 3.2.3).

import { useEffect, useRef } from "react";

type NavLike = { scrollWidth: number; clientWidth: number; querySelector: (s: string) => unknown };

/** Scrolls the strip's current item into view; says whether it did, so a stub can check. */
export function revealCurrentNavItem(nav: NavLike | null): boolean {
  if (!nav || nav.scrollWidth <= nav.clientWidth) return false;
  const current = nav.querySelector("[aria-current]") as { scrollIntoView?: (o: object) => void } | null;
  if (!current || typeof current.scrollIntoView !== "function") return false;
  current.scrollIntoView({ inline: "center", block: "nearest" });
  return true;
}

/** Mounted inside the primary nav; draws nothing. `currentKey` is what it follows. */
export function NavCurrent({ currentKey }: { currentKey: string | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  // Its own nav, found from itself: the gallery renders several shells on one
  // page, so querying the document would find the first shell's rail.
  useEffect(() => {
    revealCurrentNavItem(ref.current?.closest("nav") ?? null);
  }, [currentKey]);
  return <span ref={ref} hidden />;
}
