"use client";

// The record's tabs on a phone. Every section is on the one page, in tab order, and the strip follows
// the scroll (founder, 12 Oct 2026: "it should reveal while scrolling", not a tap back to the strip
// for each section): a tab scrolls to its section and the address follows without a read, as the
// desktop's strip does (`section-tabs.tsx`). With no script each tab is still a link (`?tab=`) and
// every section is still on the page. The bar that holds Share and Close says the name in one line
// once the name has scrolled out of its row, and the three statuses in short once their rows have.

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { TabLink } from "@/components/kit";
import { cn } from "@/lib/utils";
import { scroller } from "./section-tabs";
import { SECTIONS, type SectionId } from "./desktop-words";
import { sectionInView } from "./words";

type Go = (e: MouseEvent<HTMLAnchorElement>, tab: SectionId, href: string) => void;
/** `built`: every section is drawn, the ones that wait for the reader included (a jump must not land short of a section that grows on the way). */
const Tabs = createContext<{ active: SectionId; built: boolean; go: Go } | null>(null);

// The nine sections the desktop record has, in its order (Paper page 35, 13 Oct 2026). Checks and Contact ride
// on a neighbour's `?tab=`, as they do there: the address knows the seven tabs it always did.
const ORDER = SECTIONS.map((t) => t.id);
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function PhoneTabs({ initial, className, children }: { initial: SectionId; className?: string; children: ReactNode }) {
  const [active, setActive] = useState<SectionId>(initial);
  const [built, setBuilt] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  // A tapped tab stays marked until the reader moves the page themselves: a short section near the foot
  // cannot reach the band under the strip, and the spy would hand its mark to a neighbour once the jump ended.
  const clicking = useRef(false);
  const release = useRef<(() => void) | null>(null);
  const panel = (id: SectionId) => root.current?.querySelector<HTMLElement>(`[data-phone-panel="${id}"]`) ?? null;

  // The marked tab is the first section crossing the band under the stuck strip; at the foot, the last.
  useEffect(() => {
    const box = root.current;
    const strip = box?.querySelector<HTMLElement>("[data-phone-tabs]");
    if (!box || !strip) return;
    const within = scroller(box);
    const inBand = new Set<SectionId>();
    let atEnd = false;
    const pick = () => {
      if (!clicking.current) setActive((prev) => sectionInView(ORDER, inBand, atEnd, prev));
    };
    // What sticks over the sections: the strip, under whatever its own `top` leaves room for.
    const top = Math.round((parseFloat(getComputedStyle(strip).top) || 0) + (strip.offsetHeight || 48));
    const spy = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.phonePanel as SectionId;
          if (e.isIntersecting) inBand.add(id);
          else inBand.delete(id);
        }
        pick();
      },
      { root: within, rootMargin: `-${top}px 0px -55% 0px` },
    );
    for (const id of ORDER) {
      const p = panel(id);
      if (p) spy.observe(p);
    }
    const foot = new IntersectionObserver(
      ([e]) => {
        atEnd = Boolean(e?.isIntersecting) && (within ? within.scrollTop : window.scrollY) > 0;
        pick();
      },
      { root: within },
    );
    const end = box.querySelector("[data-phone-end]");
    if (end) foot.observe(end);
    // A link that names a tab lands on its section; a reader the browser brought back to where they were (Back) stays there.
    setActive(initial);
    if (initial !== "overview" && (within ? within.scrollTop : window.scrollY) === 0) panel(initial)?.scrollIntoView({ block: "start" });
    return () => {
      spy.disconnect();
      foot.disconnect();
      release.current?.();
    };
  }, [initial]);

  const go: Go = (e, tab, href) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const target = panel(tab);
    if (!target) return;
    e.preventDefault();
    release.current?.(); // a second tap before the first scroll ended: only the latest one counts
    clicking.current = true;
    // Before the scroll is aimed: a section built on the way would push the target down under it.
    flushSync(() => setBuilt(true));
    setActive(tab);
    history.replaceState(null, "", href);
    const within = scroller(target) ?? window;
    const MOVES = ["touchstart", "wheel", "keydown"] as const;
    const done = () => {
      clicking.current = false;
      release.current = null;
      for (const m of MOVES) window.removeEventListener(m, done);
    };
    for (const m of MOVES) window.addEventListener(m, done, { passive: true });
    release.current = done;
    const behavior = reduced() ? "auto" : "smooth";
    // Overview is the record from its top: the name and the statuses, not the first section under the strip.
    if (tab === "overview") within.scrollTo({ top: 0, behavior });
    else target.scrollIntoView({ behavior, block: "start" });
  };

  return (
    <Tabs.Provider value={{ active, built, go }}>
      <div ref={root} data-record-phone="" className={className}>
        {children}
      </div>
    </Tabs.Provider>
  );
}

export type PhoneTab = { id: SectionId; label: string; href: string; count?: number };

export function PhoneTabStrip({ tabs, className }: { tabs: PhoneTab[]; className?: string }) {
  const ctx = useContext(Tabs);
  const nav = useRef<HTMLElement>(null);
  const active = ctx?.active;
  // Keep the marked tab in sight in a strip that overflows sideways, at once (a smooth scroll on a stuck strip shakes).
  useEffect(() => {
    const bar = nav.current;
    const a = bar?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!bar || !a || bar.scrollWidth <= bar.clientWidth) return;
    if (a.offsetLeft >= bar.scrollLeft && a.offsetLeft + a.offsetWidth <= bar.scrollLeft + bar.clientWidth) return;
    bar.scrollLeft = a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2;
  }, [active]);
  return (
    // What sticks is a plain box on its own layer; the strip that scrolls sideways sits inside it. The
    // hairline is the box's, so the strip is exactly as tall as its tabs and has nothing to scroll up
    // or down by: with the line on the strip its tabs stood 1px taller than it, and a touch moved the
    // whole rail (founder, 12 Oct 2026).
    <div data-phone-tabs="" className={cn("sticky z-raised border-b border-line bg-surface [transform:translateZ(0)]", className)}>
      <nav ref={nav} aria-label="Record sections" className="flex h-12 gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <TabLink
            key={t.id}
            href={t.href}
            current={t.id === active}
            count={t.count}
            scroll={false}
            onClick={(e) => ctx?.go(e, t.id, t.href)}
            className="h-12 px-2 text-md/[20px] text-ink-3 active:text-ink aria-[current=page]:border-ink"
          >
            {t.label}
          </TabLink>
        ))}
      </nav>
    </div>
  );
}

/** A link to one of the record's sections from inside the record: the status strip, a row under Checks, "All exports". */
export function PhoneTabLink({ tab, href, className, children, ...rest }: { tab: SectionId; href: string; className?: string; children: ReactNode; "aria-label"?: string }) {
  const ctx = useContext(Tabs);
  return (
    <Link href={href} scroll={false} className={className} onClick={(e) => ctx?.go(e, tab, href)} {...rest}>
      {children}
    </Link>
  );
}

/**
 * One section of the record. `lazy`: its body is not built until the reader is a screen away from it
 * (the map), a tab is tapped, or the address names it or a section after it (it would grow above the
 * reader). Hidden from 640 with the rest of the phone's record, it never is.
 */
export function PhonePanel({ id, label, lazy = false, className, children }: { id: SectionId; label: string; lazy?: boolean; className?: string; children: ReactNode }) {
  const ctx = useContext(Tabs);
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(!lazy || !ctx || ORDER.indexOf(ctx.active) >= ORDER.indexOf(id));
  const seen = near || Boolean(ctx?.built);
  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const ahead = new IntersectionObserver(([e]) => e?.isIntersecting && setNear(true), { root: scroller(el), rootMargin: "100% 0px" });
    ahead.observe(el);
    return () => ahead.disconnect();
  }, [seen]);
  return (
    <div ref={ref} role="region" aria-label={label} data-phone-panel={id} className={cn(!seen && "min-h-40", className)}>
      {seen ? children : null}
    </div>
  );
}

/**
 * The bar with Share and Close, stuck to the top. The name's first line shares its row; `data-stuck`
 * once the name has scrolled out of it (the bar then has a ground and says the name in one line), and
 * `data-past` once the head's status strip has gone under it (it then carries the strip itself).
 */
export function PhoneBar({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [past, setPast] = useState(false);
  useEffect(() => {
    const bar = ref.current;
    const box = bar?.parentElement;
    if (!bar || !box) return;
    // Gone above the line, not merely out of sight below it; a record that is not drawn (from 640) has no box at all.
    const above = (e: IntersectionObserverEntry | undefined, line: number) => Boolean(e) && !e!.isIntersecting && e!.boundingClientRect.height > 0 && e!.boundingClientRect.top < line;
    const watch = (el: Element | null, line: number, set: (v: boolean) => void) => {
      if (!el) return null;
      const seen = new IntersectionObserver(([e]) => set(above(e, line)), { rootMargin: `-${line}px 0px 0px 0px` });
      seen.observe(el);
      return seen;
    };
    const name = watch(box.querySelector("[data-phone-name]"), 36, setStuck);
    // The short statuses fill the gap between this bar and where the strip sticks: shown as the rows leave that gap.
    const strip = box.querySelector("[data-phone-tabs]");
    const rows = watch(box.querySelector("[data-phone-summary]"), (strip && parseFloat(getComputedStyle(strip).top)) || bar.offsetHeight || 56, setPast);
    return () => {
      name?.disconnect();
      rows?.disconnect();
    };
  }, []);
  return (
    <div ref={ref} data-record-bar="" data-stuck={stuck ? "" : undefined} data-past={past ? "" : undefined} className={cn("group/bar", className)}>
      {children}
    </div>
  );
}
