"use client";

// The rail's links. A client component so the current item follows the URL
// on every client navigation: the shell is drawn once by the buyer layout and
// is not re-rendered when the page under it changes, so a server-chosen
// `active` would stay on the page the buyer arrived at. `active` is still
// accepted (the gallery and the tests name a screen); omitted, the path decides.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatCount } from "@/lib/dashboard/facts";
import { NAV, navMatch, type NavKey } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils";
import { Count } from "./controls";
import { Icon } from "./icons";
import { NavCurrent } from "./nav-current";

export type NavCounts = { suppliers?: number | null; rfqs?: number | null; saved?: number | null };

function navCount(key: NavKey, counts: NavCounts): string | null {
  // The Search row carries no "⌘K": the topbar shows the hint beside the
  // field it acts on. A count that could not be read renders nothing, never 0.
  const n = key === "suppliers" ? counts.suppliers : key === "rfqs" ? counts.rfqs : key === "saved" ? counts.saved : null;
  return n === null || n === undefined ? null : formatCount(n);
}

export function SidebarNav({
  label,
  active,
  activeExact,
  counts,
}: {
  label: string;
  active?: NavKey | null;
  activeExact?: boolean;
  counts: NavCounts;
}) {
  const pathname = usePathname() ?? "";
  const current = active === undefined ? navMatch(pathname) : { key: active, exact: activeExact !== false };
  return (
    <nav
      aria-label={label}
      // `overflow-x-auto` computes `overflow-y: auto` too, and an outline is
      // not scrollable overflow — so on a 32px-tall strip the global
      // `outline-offset-2` focus ring was cut off top and bottom (WCAG
      // 2.4.11). `-mx-1 px-1` buys that room horizontally, `-my-1 py-1`
      // vertically, at no layout cost: the negative margin gives it back.
      className="-mx-1 -my-1 flex snap-x gap-1 overflow-x-auto px-1 py-1 md:mx-0 md:my-0 md:flex-col md:gap-0.5 md:overflow-visible md:px-0 md:py-0"
    >
      {NAV.map((item) => {
        const on = item.key === current.key;
        const count = navCount(item.key, counts);
        return (
          // `Link`, so a click is a client navigation under a shell that stays
          // put. Prefetched — the route's loading state arrives before the
          // click — except the search, which is rate-limited in middleware
          // and would spend the buyer's allowance on a hover.
          <Link
            key={item.key}
            href={item.href}
            prefetch={item.href === "/app/discover" ? false : undefined}
            aria-current={on ? (current.exact ? "page" : "true") : undefined}
            className={cn(
              "flex h-8 shrink-0 snap-start items-center gap-2.5 whitespace-nowrap rounded-sm px-2 text-sm font-medium text-ink-muted transition-colors duration-fast hover:bg-surface-sunken hover:text-ink-strong md:shrink",
              // The current page: a hairline in `brand` all the way round, the
              // tint, brand ink and a heavier weight. The tint alone is 1.07:1
              // against the canvas and never carries the state by itself
              // (WCAG 1.4.11 asks 3:1); the brand outline is 7.87:1.
              on && "bg-brand-tint font-semibold text-brand-ink ring-1 ring-inset ring-brand hover:bg-brand-tint",
            )}
          >
            <Icon name={item.icon} />
            {item.label}
            {count !== null ? <Count className={cn("ml-auto", on && "text-brand-ink")}>{count}</Count> : null}
          </Link>
        );
      })}
      {/* Phones: bring the current item into view on the strip, on every page. */}
      <NavCurrent currentKey={current.key} />
    </nav>
  );
}
