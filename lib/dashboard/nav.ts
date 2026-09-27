// The buyer rail's items and which one a path belongs to. A plain module with
// no React in it, because both the server (`load-buyer-shell.ts`) and the
// client rail (`components/dashboard/sidebar-nav.tsx`, which reads the URL on
// every client navigation) need the same answer.

import type { IconName } from "@/components/dashboard/icons";

export type NavKey =
  | "search"
  | "suppliers"
  | "products"
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
  { key: "search", label: "Search", icon: "search", href: "/app/discover" },
  { key: "suppliers", label: "Suppliers", icon: "building", href: "/app/discover" },
  { key: "products", label: "Products", icon: "tag", href: "/app/products" },
  { key: "saved", label: "Saved", icon: "bookmark", href: "/app/saved" },
  { key: "searches", label: "Saved searches", icon: "funnel", href: "/app/searches" },
  { key: "messages", label: "Messages", icon: "chat", href: "/app/messages" },
  { key: "rfqs", label: "RFQs", icon: "send", href: "/app/rfqs" },
  { key: "orders", label: "Orders", icon: "box", href: "/app/orders" },
  { key: "compliance", label: "Compliance hub", icon: "shield", href: "/app/compliance" },
  { key: "settings", label: "Settings", icon: "gear", href: "/app/settings" },
];

/**
 * Which nav item this path belongs to, and whether it IS that item's page or
 * merely sits under it. A section ancestor is `aria-current="true"`, the page
 * itself `aria-current="page"`; naming the wrong one announces the buyer as
 * being on a page they are not on (WCAG 4.1.2), so the key is resolved from
 * the path and never named by a caller.
 *
 * `/app/discover` matches `search` before `suppliers`; both link there and the
 * first is the one the rail has always highlighted. `/app/suppliers/<slug>`
 * belongs to Suppliers although that row points at the search.
 */
export function navMatch(pathname: string): { key: NavKey | null; exact: boolean } {
  const path = pathname.replace(/[?#].*$/, "").replace(/(.)\/+$/, "$1");
  const hit = NAV.find((item) => item.href === path);
  if (hit) return { key: hit.key, exact: true };
  // Longest href wins so /app/searches/new cannot be claimed by /app/search-anything.
  const under = NAV.filter((item) => path.startsWith(item.href + "/")).sort((a, b) => b.href.length - a.href.length);
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
