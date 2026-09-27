"use client";

// On a phone the rail is a sideways-scrolling strip, and the current page's
// item — Messages, RFQs, Orders, Settings — starts off-screen to the right,
// so the first viewport never said where the buyer was. This scrolls the
// current item into view once on mount, only when the strip actually
// overflows (on the desktop rail there is nothing to scroll). The order of
// the items never changes, so the rail stays the same on every page
// (WCAG 3.2.3).

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

/** Mounted inside the primary nav; draws nothing. */
export function NavCurrent() {
  const ref = useRef<HTMLSpanElement>(null);
  // Its own nav, found from itself: the gallery renders several shells on one
  // page, so querying the document would find the first shell's rail.
  useEffect(() => {
    revealCurrentNavItem(ref.current?.closest("nav") ?? null);
  }, []);
  return <span ref={ref} hidden />;
}
