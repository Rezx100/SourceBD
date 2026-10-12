"use client";

// The record's section nav on a desktop (Paper page 37): the tabs over the pane's sections, or the
// "On this page" rail beside the full page's. A click scrolls to the section (and keeps the address
// on its tab), and scrolling moves the mark to the section in view. The scroller is the window on
// the full page and the pane's own overflow beside a list, so the observer takes whichever scrolls.
// While a click's smooth scroll is moving, the observer does not mark the sections it passes through.
// It also tells the record when its head has scrolled away (`data-stuck`, which shows the page's
// stuck bar) and takes any `a[data-jump]` in the record ("All exports", a check's row) to its section.
// Without script each entry is still a link.

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ring } from "@/components/kit";
import { cn } from "@/lib/utils";
import { sectionInView } from "./words";

export type SectionTab = { id: string; label: string; href: string; count?: number };

const sectionOf = (id: string) => document.getElementById(`record-${id}`);
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The nearest ancestor that scrolls vertically, or null for the window. */
export function scroller(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

export function SectionTabs({ tabs, initial, variant = "tabs" }: { tabs: SectionTab[]; initial: string; /** `rail`: the full page's "On this page" list, which sits beside the sections, not over them. `page-tabs`: the tabs on the full page, inset as its head is. */ variant?: "tabs" | "page-tabs" | "rail" }) {
  const [active, setActive] = useState(initial);
  const nav = useRef<HTMLElement>(null);
  const clicking = useRef(false);
  const release = useRef<(() => void) | null>(null);
  const arrived = useRef(false);
  const rail = variant === "rail";

  /** Scroll to a section and mark it; the observer stays quiet until the scroll ends. */
  const jump = useRef((id: string, href: string | null) => {
    const target = sectionOf(id);
    if (!target) return false;
    release.current?.(); // a second click before the first scroll ended: only the latest one counts
    clicking.current = true;
    setActive(id);
    if (href) history.replaceState(null, "", href);
    const root = scroller(target) ?? window;
    const done = () => {
      clicking.current = false;
      release.current = null;
      clearTimeout(timer);
      root.removeEventListener("scrollend", done);
    };
    // `scrollend` where the browser has it; the timer where it does not, or when nothing moved.
    const timer = setTimeout(done, 1000);
    root.addEventListener("scrollend", done);
    release.current = done;
    target.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
    return true;
  });

  // Scroll spy: one observer for a band under the sticky chrome, one for the record's foot, one for its head.
  useEffect(() => {
    const bar = nav.current;
    const record = bar?.closest<HTMLElement>("[data-record]");
    if (!bar || !record) return;
    const root = scroller(record);
    const order = tabs.map((t) => t.id);
    const inBand = new Set<string>();
    let atEnd = false;
    let spy: IntersectionObserver | null = null;
    const end = record.querySelector("[data-record-end]");

    const pick = () => {
      if (!clicking.current) setActive((prev) => sectionInView(order, inBand, atEnd, prev));
    };
    const watch = () => {
      // The page draws two of these, the rail from 1280 and the tabs under it, and a phone draws neither:
      // only the one on screen measures and follows the scroll.
      if (bar.offsetParent === null) {
        spy?.disconnect();
        spy = null;
        return;
      }
      // What sticks over the sections: the pane's header, or the page's stuck bar (drawn only from 640),
      // then the tab strip. The rail is beside the sections, so it adds nothing.
      let headH = 0;
      for (const el of record.querySelectorAll(":scope > header, :scope > [data-record-bar]")) {
        if (getComputedStyle(el).position === "sticky") headH += el.getBoundingClientRect().height;
      }
      const stuck = record.querySelector<HTMLElement>(":scope > [data-record-stuck] > *");
      if (stuck && stuck.offsetParent !== null) headH += stuck.offsetHeight;
      const top = Math.round(headH + (rail ? 0 : bar.getBoundingClientRect().height));
      record.style.setProperty("--record-head", `${Math.round(headH)}px`);
      record.style.setProperty("--record-offset", `${top}px`);
      spy?.disconnect();
      spy = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const id = e.target.id.replace(/^record-/, "");
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
    // On arrival, once the sticky height is known: the address's anchor (a section or a certificate's
    // row), else its tab. The browser's own jump ran before that height, so the target sat under the bars.
    if (!arrived.current && bar.offsetParent !== null) {
      const hash = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
      (hash ?? (initial !== "overview" ? sectionOf(initial) : null))?.scrollIntoView({ block: "start" });
    }
    arrived.current = true;
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
    // The page's head has left the screen: the record shows its stuck bar.
    const head = record.querySelector("[data-record-head]");
    // Shown as soon as only the bar's own height of the head is left, so nothing scrolls through above the
    // page's tabs (which stick under the bar). A nav that is not on screen leaves the record's state alone:
    // the page mounts two, and the hidden one would undo what the shown one set.
    const stuck = record.querySelector<HTMLElement>(":scope > [data-record-stuck] > *");
    const gone = new IntersectionObserver(
      ([e]) => {
        if (bar.offsetParent === null || !e) return;
        record.toggleAttribute("data-stuck", !e.isIntersecting);
      },
      { root, rootMargin: `-${stuck?.offsetHeight ?? 0}px 0px 0px 0px` },
    );
    if (head) gone.observe(head);
    // A link to a section from inside the record scrolls there instead of loading the page again.
    const onJump = (e: MouseEvent) => {
      if (bar.offsetParent === null || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a[data-jump]");
      if (a && record.contains(a) && jump.current(a.dataset.jump!, a.getAttribute("href"))) e.preventDefault();
    };
    record.addEventListener("click", onJump);
    return () => {
      spy?.disconnect();
      sized.disconnect();
      foot.disconnect();
      gone.disconnect();
      record.removeEventListener("click", onJump);
    };
  }, [tabs, initial, rail]);

  // Keep the marked tab in sight inside a strip that overflows sideways (a narrow pane): only when it
  // has left the strip, and at once.
  useEffect(() => {
    const bar = nav.current;
    const a = bar?.querySelector<HTMLElement>("[aria-current]");
    if (!bar || !a || bar.scrollWidth <= bar.clientWidth) return;
    if (a.offsetLeft >= bar.scrollLeft && a.offsetLeft + a.offsetWidth <= bar.scrollLeft + bar.clientWidth) return;
    bar.scrollLeft = a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2;
  }, [active]);

  const go = (e: ReactMouseEvent<HTMLAnchorElement>, t: SectionTab) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (jump.current(t.id, t.href)) e.preventDefault();
  };

  if (rail) {
    return (
      <nav ref={nav} aria-label="On this page" className="flex flex-col gap-px">
        <p className="px-3 pb-1.5 text-xs font-medium text-ink-3">On this page</p>
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <Link
              key={t.id}
              href={t.href}
              aria-current={on ? "location" : undefined}
              scroll={false}
              prefetch={false}
              onClick={(e) => go(e, t)}
              className={cn("flex h-8 items-center justify-between rounded-md pl-0.5 pr-3 hover:bg-subtle", ring, on && "bg-sunken hover:bg-sunken")}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden className={cn("h-4 w-0.5 shrink-0 rounded-sm", on ? "bg-ink" : "bg-transparent")} />
                <span className={cn("text-base", on ? "font-medium text-ink" : "text-ink-2")}>{t.label}</span>
              </span>
              {t.count ? <span className="text-xs text-ink-3 [font-variant-numeric:tabular-nums]">{t.count}</span> : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    // What sticks is a plain box on its own layer, and the strip that scrolls sideways sits inside it.
    <div className="sticky top-[var(--record-head,0px)] z-raised bg-surface [transform:translateZ(0)]">
      <nav ref={nav} aria-label="Record sections" className={cn("flex gap-[9px] overflow-x-auto overscroll-x-contain border-b border-line px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", variant === "page-tabs" && "lg:px-8")}>
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <Link
              key={t.id}
              href={t.href}
              aria-current={on ? "page" : undefined}
              scroll={false}
              prefetch={false}
              onClick={(e) => go(e, t)}
              className={cn(
                "flex h-10 shrink-0 items-center gap-[5px] whitespace-nowrap text-sm font-medium outline-none hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus",
                on ? "text-ink [box-shadow:inset_0_-2px_0_theme(colors.ink)]" : "text-ink-3",
              )}
            >
              {t.label}
              {t.count ? <span className="text-xs font-normal text-ink-3 [font-variant-numeric:tabular-nums]">{t.count}</span> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
