"use client";

// The record's tabs on a phone (Paper page 35): each tab is a view of its own, not a place on one long
// page. Every panel is in the page already, so a tap swaps the view at once and the address follows
// without a read; with no script each tab is still a link (`?tab=`) the server draws. The bar that
// holds Share and Close says the name and the three statuses in short once the name has scrolled
// under it (the board's "scrolled" state).

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { TabLink } from "@/components/kit";
import { cn } from "@/lib/utils";
import type { TabId } from "./words";

type Go = (e: MouseEvent<HTMLAnchorElement>, tab: TabId, href: string) => void;
const Tabs = createContext<{ active: TabId; go: Go } | null>(null);

export function PhoneTabs({ initial, className, children }: { initial: TabId; className?: string; children: ReactNode }) {
  const [active, setActive] = useState<TabId>(initial);
  const root = useRef<HTMLDivElement>(null);
  // A link from elsewhere that the server answered with another tab.
  useEffect(() => setActive(initial), [initial]);
  const go: Go = (e, tab, href) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setActive(tab);
    history.replaceState(null, "", href);
    // Once the new panel is drawn: a reader who had scrolled past the tabs starts the new view at its top.
    requestAnimationFrame(() => {
      const strip = root.current?.querySelector("[data-phone-tabs]");
      const panels = root.current?.querySelector("[data-phone-panels]");
      if (strip && panels && panels.getBoundingClientRect().top < strip.getBoundingClientRect().bottom) panels.scrollIntoView({ block: "start" });
    });
  };
  return (
    <Tabs.Provider value={{ active, go }}>
      <div ref={root} data-record-phone="" className={className}>
        {children}
      </div>
    </Tabs.Provider>
  );
}

export type PhoneTab = { id: TabId; label: string; href: string; count?: number };

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
    // What sticks is a plain box on its own layer; the strip that scrolls sideways sits inside it.
    <div data-phone-tabs="" className={cn("sticky z-raised bg-surface [transform:translateZ(0)]", className)}>
      <nav ref={nav} aria-label="Record sections" className="flex h-12 gap-1 overflow-x-auto overscroll-x-contain border-b border-line px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <TabLink
            key={t.id}
            href={t.href}
            current={t.id === active}
            count={t.count}
            scroll={false}
            onClick={(e) => ctx?.go(e, t.id, t.href)}
            className="h-12 px-2 text-md/[20px] text-ink-3 active:bg-sunken aria-[current=page]:border-ink"
          >
            {t.label}
          </TabLink>
        ))}
      </nav>
    </div>
  );
}

/** A link to one of the record's tabs from inside the record: a status row, a card under Needs a look, "All exports". */
export function PhoneTabLink({ tab, href, className, children, ...rest }: { tab: TabId; href: string; className?: string; children: ReactNode; "aria-label"?: string }) {
  const ctx = useContext(Tabs);
  return (
    <Link href={href} scroll={false} className={className} onClick={(e) => ctx?.go(e, tab, href)} {...rest}>
      {children}
    </Link>
  );
}

/** One tab's view. `lazy`: its body is not mounted until the tab is first shown (the map). */
export function PhonePanel({ id, label, lazy = false, children }: { id: TabId; label: string; lazy?: boolean; children: ReactNode }) {
  const ctx = useContext(Tabs);
  const on = ctx ? ctx.active === id : true;
  const [seen, setSeen] = useState(on);
  if (on && !seen) setSeen(true);
  return (
    <div role="region" aria-label={label} data-phone-panel={id} hidden={!on}>
      {lazy && !seen ? null : children}
    </div>
  );
}

/** The bar with Share and Close, stuck to the top. `data-stuck` once the record's name has scrolled under it. */
export function PhoneBar({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const bar = ref.current;
    const name = bar?.parentElement?.querySelector("[data-phone-name]");
    if (!bar || !name) return;
    const seen = new IntersectionObserver(([e]) => setStuck(Boolean(e) && !e!.isIntersecting), { rootMargin: `-${bar.offsetHeight}px 0px 0px 0px` });
    seen.observe(name);
    return () => seen.disconnect();
  }, []);
  return (
    <div ref={ref} data-record-bar="" data-stuck={stuck ? "" : undefined} className={cn("group/bar", className)}>
      {children}
    </div>
  );
}
