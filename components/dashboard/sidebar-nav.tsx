"use client";

// The rail's links, from `md` (below it, the tab bar: `bottom-nav.tsx`). A
// client component so the current item follows the URL
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
    <nav aria-label={label} className="flex flex-col gap-0.5">
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
            // The collapsed rail shows the icon alone; the name stays for a
            // screen reader and appears on hover.
            title={item.label}
            className={cn(
              "flex h-8 items-center gap-2.5 whitespace-nowrap rounded-sm px-2 text-sm font-medium text-ink transition-colors duration-fast hover:bg-surface-sunken hover:text-ink-strong md:group-data-[rail=collapsed]/shell:justify-center md:group-data-[rail=collapsed]/shell:px-0",
              // The current page (founder's video, 29 Sep 2026: the green tint
              // and ring went; then slate): the grey tint, the ink, a heavier weight and
              // a 3px near-black bar at the row's start. The tint alone is too close
              // to the canvas to carry the state (WCAG 1.4.11 asks 3:1); the
              // bar is 17.5:1 against it.
              on &&
                "bg-accent-tint font-semibold text-accent-ink shadow-[inset_3px_0_0_rgb(var(--ds-accent))] hover:bg-accent-tint hover:text-accent-ink",
            )}
          >
            <Icon name={item.icon} className={on ? undefined : "text-ink-muted"} />
            <span className="md:group-data-[rail=collapsed]/shell:sr-only">{item.label}</span>
            {count !== null ? <Count className={cn("ml-auto md:group-data-[rail=collapsed]/shell:hidden", on && "text-accent-ink")}>{count}</Count> : null}
          </Link>
        );
      })}
    </nav>
  );
}
