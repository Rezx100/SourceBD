"use client";

// Spec M6a — Hero word-up reveal + scroll-driven `.mkt-reveal` swap.
//
// Single mount-time effect: (1) tag `[data-mkt-hero]` element with
// `.in` so the CSS word-up keyframe runs on its descendant spans;
// (2) IntersectionObserver toggles `.in` on every element marked
// `[data-mkt-reveal]` as it enters the viewport. Honours
// `prefers-reduced-motion`: under reduce, elements are settled at
// final state by the scoped CSS override and this effect short-
// circuits without observing anything.

import { useEffect } from "react";

export function HeroReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const hero = document.querySelector<HTMLElement>("[data-mkt-hero]");
    if (hero) hero.classList.add("in");
    if (reduce) {
      document
        .querySelectorAll<HTMLElement>("[data-mkt-reveal]")
        .forEach((el) => el.classList.add("in"));
      return;
    }

    const targets = document.querySelectorAll<HTMLElement>("[data-mkt-reveal]");
    if (targets.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return null;
}
