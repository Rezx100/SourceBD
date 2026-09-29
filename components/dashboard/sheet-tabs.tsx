"use client";

// The record's section tabs. Each is a fragment link (`#products`), and a
// followed fragment scrolls EVERY scrollable ancestor to its target —
// `overflow: hidden` ones included — so clicking Products slid the whole
// workbench up under the topbar, the results' filter bar with it, and left an
// empty strip at the foot of the screen (founder's video, 29 Sep 2026). A
// click now scrolls only the pane's own scroll region, lands the section
// under the sticky tabs, and replaces the URL's fragment rather than adding a
// history entry. The href stays for a reader without script.

import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";

/** What a tab needs from a click event; exported with `goToSection` for its test. */
export type TabClick = Pick<MouseEvent<HTMLAnchorElement>, "currentTarget" | "defaultPrevented" | "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "preventDefault">;

export function goToSection(e: TabClick): void {
  const link = e.currentTarget;
  if (link.getAttribute("aria-disabled") === "true") {
    // `href="#"` on a tab with nothing behind it: following it only jumped.
    e.preventDefault();
    return;
  }
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const id = decodeURIComponent(link.hash.slice(1));
  const scroller = link.closest<HTMLElement>("[data-sheet-scroll]");
  const target = id && scroller ? scroller.querySelector<HTMLElement>(`[id="${id.replace(/["\\]/g, "\\$&")}"]`) : null;
  if (!scroller || !target) return;
  e.preventDefault();
  const tabs = link.closest("nav");
  const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - (tabs ? tabs.getBoundingClientRect().height : 0);
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  scroller.scrollTo({ top, behavior: still ? "auto" : "smooth" });
  // `null`, so Next's router takes the new URL as its own; with its own state
  // passed back it kept the old URL and dropped the `#` on its next update.
  window.history.replaceState(null, "", `#${id}`);
  // Where the next Tab goes from, as a followed fragment would have left it.
  // Focusable only once a tab has sent focus there: a permanent tabindex made
  // every click on a section's text move focus to the whole section.
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
}

/**
 * A tab links only to a section this sheet actually renders. The others keep
 * the approved fragment's inert `href="#"` and say so to a screen reader,
 * rather than pointing at an anchor that does not exist.
 */
export function SheetTabs({ tabs }: { tabs: readonly { label: string; count: string | null; href: string | null; active?: boolean }[] }) {
  // Eight tabs at 320px is ~640px of nav. It scrolls sideways rather than
  // wrapping into three rows or pushing the sheet past the viewport, and
  // `tabIndex` lets a keyboard reach that scroll region (WCAG 2.1.1).
  return (
    // Sticky: on a record that runs to 3,000px the tabs used to scroll away
    // after the first screen, and compliance staff jumping to Sources or
    // Locations had to scroll back up to find them. The space above the tabs
    // is their own padding, not a margin: a margin left an 8px strip over the
    // stuck tabs where the source marks scrolled through. `z-raised`, a token:
    // the numeric class here compiled to nothing (the theme's z scale replaces
    // Tailwind's), and product photos scrolling up painted over the tabs
    // (founder's review, 29 Sep 2026).
    <nav
      aria-label="Record sections"
      tabIndex={0}
      className="sticky top-0 z-raised flex gap-5 overflow-x-auto border-b border-line-subtle bg-surface px-6 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((t) => (
        <a
          key={t.label}
          href={t.href ?? "#"}
          onClick={goToSection}
          aria-disabled={t.href === null ? "true" : undefined}
          tabIndex={t.href === null ? -1 : undefined}
          title={t.href === null ? "Not available on this record" : undefined}
          aria-current={t.active ? "true" : undefined}
          className={cn(
            "-mb-px inline-flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent text-base font-medium text-ink-muted transition-colors duration-fast hover:text-ink-strong",
            t.href === null && "text-ink-subtle hover:text-ink-subtle",
            t.active && "border-accent text-ink-strong",
          )}
        >
          {t.label}
          {t.count !== null ? (
            <span className={cn("font-mono text-[11px] text-ink-subtle", t.active && "text-brand-ink")}>{t.count}</span>
          ) : null}
        </a>
      ))}
    </nav>
  );
}
