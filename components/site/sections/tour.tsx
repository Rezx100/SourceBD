"use client";

// The pinned tour (M3, handoff-mercury-motion-sitewide.md §4.2): Find · Check · Ask · Watch, the four things a buyer does,
// each played by its demo on real records. From 1024 up the section is four times 90vh and its inner box pins for the
// ride: the heading and the four items on the left (the open one shows its two lines, "See how" and a 2px bar of how
// far through it the scroll is), the open item's demo on the right. The open item follows the scroll, a click jumps
// to it, and when the tour is pinned and the visitor stops scrolling it moves on by itself every 7 s (never under
// reduced motion, never past the last). Below 1024 nothing pins: each item stacks with its own demo, which plays in
// view. The server draws Find open.

import { memo, useCallback, useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from "react";
import { DemoCompliance, DemoRecord, DemoRfq, DemoSearch } from "@/components/site/demos";
import { stillPreferred } from "@/components/site/motion";
import { motion } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { HomeIcon, type IconName } from "./icons";
import { H2, TextLink, measure, ring } from "./ui";

export type TourItem = { key: string; icon: IconName; title: string; body: string; href: string; Demo: ComponentType<{ className?: string }> };

export const TOUR: readonly TourItem[] = [
  { key: "find", icon: "search", title: "Find", body: "Search by product, district, certificate or source. Open a record beside the results and never lose your place.", href: "/product/search", Demo: DemoSearch },
  { key: "check", icon: "receipt", title: "Check", body: "Every fact carries the register it came from and the day we read it. When two sources disagree, you see both.", href: "/product/records", Demo: DemoRecord },
  { key: "ask", icon: "send", title: "Ask", body: "Save a shortlist and send one RFQ to up to 50 suppliers. Quotes come back side by side.", href: "/product/rfqs", Demo: DemoRfq },
  { key: "watch", icon: "bell", title: "Watch", body: "Certificates that expire, registers that change, names that appear on the UFLPA list. We check again and tell you.", href: "/product/compliance", Demo: DemoCompliance },
];

const N = TOUR.length;

function Heading({ id }: { id?: string }) {
  return (
    <H2 id={id}>
      Everything you do to vet a factory.
      <br className="max-md:hidden" /> In one record.
    </H2>
  );
}

/** The open item's demo, swapping out then in. Memoised: the scroll re-renders the tour every frame for its bar, not the demo. */
const TourDemo = memo(function TourDemo({ shown, leaving }: { shown: number; leaving: boolean }) {
  const Shown = TOUR[shown]!.Demo;
  return (
    <div key={shown} className={cn(leaving ? "animate-swap-out" : "animate-swap-in", "motion-reduce:animate-none")}>
      <Shown />
    </div>
  );
});

export function PinnedTour() {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const activeRef = useRef(0);
  const pinned = useRef(false);
  const geometry = useRef({ top: 0, span: 1 });

  /** Scrolls the page to where item `i` opens: the section's top plus its share of the pinned run. */
  const go = useCallback((i: number) => {
    const at = Math.max(0, Math.min(N - 1, i));
    window.scrollTo({ top: geometry.current.top + (at / N) * geometry.current.span + 1, behavior: stillPreferred() ? "auto" : "smooth" });
  }, []);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const wide = matchMedia("(min-width: 1024px)");
    let raf = 0;
    let timer = 0;
    // The section's place is read when the window or the page changes size (a late image, a wrapped line), never in
    // the scroll handler.
    const measure = () => {
      geometry.current = { top: el.getBoundingClientRect().top + scrollY, span: Math.max(1, el.offsetHeight - innerHeight) };
    };
    const arm = () => {
      clearTimeout(timer);
      if (!pinned.current || !wide.matches || stillPreferred() || document.hidden) return;
      timer = window.setTimeout(() => {
        if (pinned.current && activeRef.current < N - 1) go(activeRef.current + 1);
      }, motion.tourItemMs);
    };
    const place = () => {
      raf = 0;
      if (!wide.matches) return;
      const { top, span } = geometry.current;
      const y = scrollY - top;
      const p = Math.min(1, Math.max(0, y / span));
      const i = Math.min(N - 1, Math.floor(p * N));
      pinned.current = y >= 0 && y <= span;
      activeRef.current = i;
      setActive(i);
      setProgress(p * N - i);
      arm();
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(place);
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    measure();
    place();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", arm);
    const grew = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onResize);
    grew?.observe(document.body);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", arm);
      grew?.disconnect();
    };
  }, [go]);

  // The demo swaps out (200 ms, blur) before the next swaps in (320 ms, rise); at once under reduced motion.
  useEffect(() => {
    if (active === shown) return;
    setLeaving(true);
    const t = window.setTimeout(
      () => {
        setShown(active);
        setLeaving(false);
      },
      stillPreferred() ? 0 : motion.swapOutMs,
    );
    return () => clearTimeout(t);
  }, [active, shown]);

  const keys = (e: KeyboardEvent, i: number) => {
    const to = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? N - 1 : null;
    if (to === null) return;
    e.preventDefault();
    go(to);
    (e.currentTarget.parentElement?.parentElement?.querySelectorAll<HTMLButtonElement>("button")[Math.max(0, Math.min(N - 1, to))])?.focus();
  };

  return (
    <section ref={section} data-tone="dark" aria-labelledby="home-tour" className="relative lg:h-[360vh]">
      {/* From 1024: the pinned box. */}
      <div className="sticky top-0 hidden h-screen lg:block">
        <div className={cn(measure, "grid h-full grid-cols-12 items-center gap-10 xl:gap-16")}>
          <div className="col-span-5 flex flex-col gap-8">
            <Heading id="home-tour" />
            <ol className="flex flex-col border-t border-line">
              {TOUR.map((t, i) => {
                const on = i === active;
                return (
                  <li key={t.key} className="relative border-b border-line">
                    <button
                      type="button"
                      aria-expanded={on}
                      aria-controls={`tour-item-${t.key}`}
                      onClick={() => go(i)}
                      onKeyDown={(e) => keys(e, i)}
                      className={cn("flex min-h-14 w-full items-center gap-3 py-3 text-left text-site-title font-medium", ring, on ? "text-ink-strong" : "text-ink-muted hover:text-ink-strong")}
                    >
                      <HomeIcon name={t.icon} size={20} className={on ? "text-ink-strong" : "text-ink-subtle"} />
                      {t.title}
                    </button>
                    <div id={`tour-item-${t.key}`} hidden={!on} className="flex flex-col gap-3 pb-5 pl-8">
                      <p className="max-w-[440px] text-site-body text-ink-muted">{t.body}</p>
                      <TextLink href={t.href} className="min-h-8">
                        See how
                      </TextLink>
                    </div>
                    {/* How far through the open item the scroll is: a 2px bar, drawn by transform only. */}
                    {on ? <span aria-hidden className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-ink-strong" style={{ transform: `scaleX(${progress})` }} /> : null}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="col-span-7 min-w-0">
            <TourDemo shown={shown} leaving={leaving} />
          </div>
        </div>
      </div>
      {/* Below 1024: each item with its own demo, in flow. */}
      <div className={cn(measure, "flex flex-col gap-14 py-14 lg:hidden")}>
        <Heading />
        <ol className="flex flex-col gap-14">
          {TOUR.map((t) => (
            <li key={t.key} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2.5">
                <h3 className="flex items-center gap-3 text-site-title font-medium text-ink-strong">
                  <HomeIcon name={t.icon} size={24} className="text-ink-strong" />
                  {t.title}
                </h3>
                <p className="text-md text-ink-muted">{t.body}</p>
                <TextLink href={t.href}>See how</TextLink>
              </div>
              <t.Demo />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
