"use client";

// The home page's motion (Paper "Home · Notes"): one moment per section at most, each played once as the section
// comes into view. The server's HTML is the end state, so with no script, under reduced motion, or for anything
// already on screen when the page opens, nothing moves and nothing is ever hidden. Only an element still below the
// fold is held back (`data-reveal="wait"`) until it scrolls in; its children style themselves with the
// `group-data-[reveal=wait]/reveal:` variant.

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
    <As ref={ref as Ref<never>} data-reveal={state} className={cn("group/reveal", className)}>
      {children}
    </As>
  );
}

/** A figure that counts up from 0 over 900 ms when it scrolls in; otherwise, and on the server, the figure itself. */
export function CountUp({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const el = ref.current;
    const target = Number(value.replace(/,/g, ""));
    if (!el || !Number.isFinite(target) || target === 0) return;
    const fmt = new Intl.NumberFormat("en-GB");
    let frame = 0;
    const stop = onceInView(el, () => {
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 900);
        setShown(fmt.format(Math.round(target * (1 - (1 - p) ** 3))));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    if (!stop) return;
    setShown("0");
    return () => {
      stop();
      cancelAnimationFrame(frame);
    };
  }, [value]);
  return <span ref={ref}>{shown}</span>;
}
