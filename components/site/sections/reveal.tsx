"use client";

// The home page's motion (Paper "Home · Notes"): one moment per section at most, each played once as the section
// comes into view. The server's HTML is the end state, so with no script, under reduced motion, or for anything
// already on screen when the page opens, nothing moves and nothing is ever hidden. Only an element still below the
// fold is held back (`data-reveal="wait"`) until it scrolls in; its children style themselves with the
// `group-data-[reveal=wait]/reveal:` variant, and the block itself comes in from a soft blur to sharp, as glass
// clearing (mercury.com's sections; the founder's review of 22 Oct 14:18). Reduced motion stills every transition
// (app/ds.css), so the blur never shows there.

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";

const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const below = (el: Element) => el.getBoundingClientRect().top > innerHeight;

/** Calls `go` once when `el` scrolls in; returns false (and never calls) when it should not wait at all. */
function onceInView(el: Element, go: () => void): (() => void) | false {
  if (still() || !below(el) || typeof IntersectionObserver === "undefined") return false;
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      go();
    }
  }, { rootMargin: "0px 0px -10% 0px" });
  io.observe(el);
  return () => io.disconnect();
}

/** A wrapper whose children reveal once it scrolls in. */
export function Reveal({ children, className, as: As = "div" }: { children: ReactNode; className?: string; as?: "div" | "ul" | "ol" }) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"wait" | "in" | undefined>(undefined);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = onceInView(el, () => setState("in"));
    if (stop) setState("wait");
    return stop || undefined;
  }, []);
  return (
    <As ref={ref as Ref<never>} data-reveal={state} className={cn("group/reveal transition-[filter] duration-reveal ease-reveal motion-reduce:transition-none data-[reveal=wait]:blur", className)}>
      {children}
    </As>
  );
}
