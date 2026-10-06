"use client";

// The record's tabs over its stacked sections: a click scrolls to the section (and keeps the
// address on that tab), and scrolling moves the marked tab to the section in view. The scroller
// is the window on the full page and a phone, and the pane's own overflow beside search results,
// so the observer takes whichever scrolls. While a click's smooth scroll is moving, the observer
// does not mark the sections it passes through. Without script each tab is still a link.

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { TabLink } from "@/components/kit";
import { sectionInView, type TabId } from "./words";

export type SectionTab = { id: TabId; label: string; href: string; count?: number };

const sectionOf = (id: TabId) => document.getElementById(`record-${id}`);
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The nearest ancestor that scrolls vertically, or null for the window. */
function scroller(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

export function SectionTabs({ tabs, initial }: { tabs: SectionTab[]; initial: TabId }) {
  const [active, setActive] = useState<TabId>(initial);
  const nav = useRef<HTMLElement>(null);
  const clicking = useRef(false);

  // The address's tab on arrival: open the record at that section.
  useEffect(() => {
    if (initial !== "overview" && !location.hash) sectionOf(initial)?.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on arrival only; a later click owns the scroll
  }, []);

  // Scroll spy: one observer for a band under the sticky chrome, one for the record's foot.
  useEffect(() => {
    const bar = nav.current;
    const record = bar?.closest<HTMLElement>("[data-record]");
    if (!bar || !record) return;
    const root = scroller(record);
    const order = tabs.map((t) => t.id);
    const inBand = new Set<TabId>();
    let atEnd = false;
    let spy: IntersectionObserver | null = null;
    const end = record.querySelector("[data-record-end]");

    const pick = () => {
      if (!clicking.current) setActive((prev) => sectionInView(order, inBand, atEnd, prev));
    };
    const watch = () => {
      // What sticks over the sections: the header (from 640) and the tab strip.
      const head = record.querySelector(":scope > header");
      const headH = head && getComputedStyle(head).position === "sticky" ? head.getBoundingClientRect().height : 0;
      const top = Math.round(headH + bar.getBoundingClientRect().height);
      record.style.setProperty("--record-head", `${Math.round(headH)}px`);
      record.style.setProperty("--record-offset", `${top}px`);
      spy?.disconnect();
      spy = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const id = e.target.id.replace(/^record-/, "") as TabId;
            if (e.isIntersecting) inBand.add(id);
            else inBand.delete(id);
          }
          pick();
        },
        { root, rootMargin: `-${top}px 0px -55% 0px` },
      );
      for (const id of order) {
        const s = sectionOf(id);
        if (s) spy.observe(s);
      }
    };
    watch();
    const sized = new ResizeObserver(watch);
    sized.observe(record);
    const foot = new IntersectionObserver(
      ([e]) => {
        // At the foot only once the reader has scrolled: a record shorter than its scroller is not "at the end".
        atEnd = Boolean(e?.isIntersecting) && (root ? root.scrollTop : window.scrollY) > 0;
        pick();
      },
      { root },
    );
    if (end) foot.observe(end);
    return () => {
      spy?.disconnect();
      sized.disconnect();
      foot.disconnect();
    };
  }, [tabs]);

  // Keep the marked tab in sight inside a strip that overflows sideways (a phone).
  useEffect(() => {
    const bar = nav.current;
    const a = bar?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!bar || !a || bar.scrollWidth <= bar.clientWidth) return;
    bar.scrollTo({ left: a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2, behavior: reduced() ? "auto" : "smooth" });
  }, [active]);

  const go = (e: MouseEvent<HTMLAnchorElement>, t: SectionTab) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const target = sectionOf(t.id);
    if (!target) return;
    e.preventDefault();
    clicking.current = true;
    setActive(t.id);
    history.replaceState(null, "", t.href);
    const root = scroller(target) ?? window;
    const done = () => {
      clicking.current = false;
      clearTimeout(timer);
      root.removeEventListener("scrollend", done);
    };
    // `scrollend` where the browser has it; the timer where it does not, or when nothing moved.
    const timer = setTimeout(done, 1000);
    root.addEventListener("scrollend", done);
    target.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  };

  return (
    <nav
      ref={nav}
      aria-label="Record sections"
      className="sticky top-[var(--record-head,0px)] z-raised -mx-4 flex gap-1 overflow-x-auto border-b border-line bg-surface px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((t) => (
        <TabLink key={t.id} href={t.href} current={t.id === active} count={t.count} scroll={false} prefetch={false} onClick={(e) => go(e, t)}>
          {t.label}
        </TabLink>
      ))}
    </nav>
  );
}
