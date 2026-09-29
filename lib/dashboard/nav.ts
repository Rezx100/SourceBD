// The buyer rail's items and which one a path belongs to. A plain module with
// no React in it, because both the server (`load-buyer-shell.ts`) and the
// client rail (`components/dashboard/sidebar-nav.tsx`, which reads the URL on
// every client navigation) need the same answer.

import type { IconName } from "@/components/dashboard/icons";

/** The cookie that keeps the rail collapsed to its icons: written by `RailToggle`, read by the buyer layout. */
export const RAIL_COOKIE = "sb_rail";

/**
 * A full record page's `?back=`: the list it was expanded from (the pane's
 * Expand). Only a path inside the buyer app is followed; anything else draws
 * no Back link, so the parameter cannot send the buyer off the site.
 */
export function backToList(raw: string | string[] | undefined): string | null {
  const back = Array.isArray(raw) ? raw[0] : raw;
  if (!back || !back.startsWith("/app/") || /[\\\s]/.test(back)) return null;
  try {
    const url = new URL(back, "https://sourcebd.invalid");
    return url.origin === "https://sourcebd.invalid" && url.pathname.startsWith("/app/") ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
}

export type NavKey =
  | "search"
  | "suppliers"
  | "products"
  | "headings"
  | "saved"
  | "searches"
  | "messages"
  | "rfqs"
  | "orders"
  | "compliance"
  | "settings";

// Order and membership follow `BUYER_SECTIONS` in components/shell/sidebar.tsx,
// which the supplier portal and admin still render (WCAG 3.2.3: the same
// items in the same order on every page).
export const NAV: readonly { key: NavKey; label: string; icon: IconName; href: string }[] = [
  // Search opens the search landing, the app's first viewport (founder,
  // 28 Sep 2026): one large field, filters and templates, no supplier listed
  // until the buyer asks. Suppliers is the whole ledger.
  { key: "search", label: "Search", icon: "search", href: "/app" },
  { key: "suppliers", label: "Suppliers", icon: "building", href: "/app/discover" },
  // The buyer's own product base (enterprise pass, 27 Sep 2026); the HS
  // catalogue that used to sit at /app/products lives at /app/headings.
  { key: "products", label: "Products", icon: "tag", href: "/app/products" },
  { key: "headings", label: "HS headings", icon: "list", href: "/app/headings" },
  { key: "saved", label: "Saved", icon: "bookmark", href: "/app/saved" },
  { key: "searches", label: "Saved searches", icon: "funnel", href: "/app/searches" },
  { key: "messages", label: "Messages", icon: "chat", href: "/app/messages" },
  { key: "rfqs", label: "RFQs", icon: "send", href: "/app/rfqs" },
  { key: "orders", label: "Orders", icon: "box", href: "/app/orders" },
  { key: "compliance", label: "Compliance hub", icon: "shield", href: "/app/compliance" },
  { key: "settings", label: "Settings", icon: "gear", href: "/app/settings" },
];

/**
 * The phone's bottom tab bar (the phone hand-off's D9, founder, 30 Sep 2026:
 * "on mobile the navigation must be on the bottom part of the screen"): these
 * four, then More, which holds every other item. Derived from `NAV`, so the
 * rail and the bar cannot drift.
 */
export const PHONE_TABS: readonly NavKey[] = ["search", "saved", "rfqs", "messages"];
export const MORE_NAV = NAV.filter((item) => !PHONE_TABS.includes(item.key));

/**
 * Which nav item this path belongs to, and whether it IS that item's page or
 * merely sits under it. A section ancestor is `aria-current="true"`, the page
 * itself `aria-current="page"`; naming the wrong one announces the buyer as
 * being on a page they are not on (WCAG 4.1.2), so the key is resolved from
 * the path and never named by a caller.
 *
 * `/app/discover` — a search's results — sits under Search, whose page is
 * the landing at `/app`; the rail has always highlighted Search there, and
 * the Suppliers row that also links to it is the whole ledger rather than a
 * page of its own. `/app/suppliers/<slug>` belongs to Suppliers although that
 * row points at the search.
 */
export function navMatch(pathname: string): { key: NavKey | null; exact: boolean } {
  const path = pathname.replace(/[?#].*$/, "").replace(/(.)\/+$/, "$1");
  if (path === "/app/discover") return { key: "search", exact: false };
  const hit = NAV.find((item) => item.href === path);
  if (hit) return { key: hit.key, exact: true };
  // Longest href wins so /app/searches/new cannot be claimed by /app/search-anything.
  // The landing's `/app` is the app's root, not a section: every page is under
  // it, and matching it as a prefix marked Search current on all of them.
  const under = NAV.filter((item) => item.href !== "/app" && path.startsWith(item.href + "/")).sort((a, b) => b.href.length - a.href.length);
  if (under[0]) return { key: under[0].key, exact: false };
  if (path === "/app/suppliers" || path.startsWith("/app/suppliers/")) {
    return { key: "suppliers", exact: false };
  }
  return { key: null, exact: false };
}

/** The nav item whose href IS this path, or the section it sits under; null when none. */
export function activeNavKey(pathname: string): NavKey | null {
  return navMatch(pathname).key;
}
