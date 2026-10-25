"use client";

// The marketing site's motion foundation (handoff-mercury-motion-sitewide.md §4, M0), what is left of it once every
// page took the home page's design (25 Oct 2026) and the coded demos went: `stillPreferred` (reduced motion or
// Save-Data, so nothing plays by itself) and `useInView` (one IntersectionObserver). The pages' grounds are `HomeMain`
// (home-main.tsx); app/ds.css stills every CSS transition under reduced motion.

import { useEffect, useState, type RefObject } from "react";

/** Reduced motion asked for, or Save-Data on: nothing plays by itself. */
export function stillPreferred(): boolean {
  if (typeof window === "undefined") return true;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  return saveData || matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Whether `ref` is at least `threshold` in view, or fills that share of the viewport (an element taller than the
 * screen can never be half visible). False on the server and until the observer reports.
 */
export function useInView(ref: RefObject<Element | null>, threshold = 0.5): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => setInView(!!e && e.isIntersecting && (e.intersectionRatio >= threshold || e.intersectionRect.height >= innerHeight * threshold)),
      { threshold: [0, 0.1, 0.25, threshold, 0.75, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return inView;
}
