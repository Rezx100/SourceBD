// The v4 app frame's navigation (B3, Paper `03 Patterns` · App shell, and
// `Phone navigation · D-3`). A plain module with no React in it: the sidebar,
// the phone bar and the tab bar read the URL on the client and all three ask
// this one place which item is current, so they cannot disagree.

export type FrameKey = "search" | "saved" | "messages" | "rfqs" | "orders" | "compliance" | "products" | "settings";
export type FrameItem = { key: FrameKey; label: string; href: string };

/** The sidebar's top group, in Paper's order. */
export const FRAME_NAV: readonly FrameItem[] = [
  { key: "search", label: "Search", href: "/app" },
  { key: "saved", label: "Saved", href: "/app/saved" },
  { key: "messages", label: "Messages", href: "/app/messages" },
  { key: "rfqs", label: "RFQs and quotes", href: "/app/rfqs" },
  { key: "orders", label: "Orders", href: "/app/orders" },
  { key: "compliance", label: "Compliance", href: "/app/compliance" },
];

/** The sidebar's foot. On a phone these two live in the account sheet. */
export const FRAME_FOOT: readonly FrameItem[] = [
  { key: "products", label: "Products", href: "/app/products" },
  { key: "settings", label: "Settings", href: "/app/settings" },
];

/** D-3: Messages · Quotes · Alerts · Saved · Search. Quotes holds the RFQs and the orders. */
export const PHONE_TABS: readonly FrameItem[] = [
  { key: "messages", label: "Messages", href: "/app/messages" },
  { key: "rfqs", label: "Quotes", href: "/app/rfqs" },
  { key: "compliance", label: "Alerts", href: "/app/compliance" },
  { key: "saved", label: "Saved", href: "/app/saved" },
  { key: "search", label: "Search", href: "/app" },
];

function clean(pathname: string): string {
  return pathname.replace(/[?#].*$/, "").replace(/(.)\/+$/, "$1");
}

/** Pages that belong to an item without sitting under its href. */
const ALSO: readonly [string, FrameKey][] = [
  ["/app/discover", "search"],
  ["/app/suppliers", "search"],
  ["/app/match", "search"],
  ["/app/searches", "saved"],
  ["/app/headings", "products"],
];

/**
 * The item this path belongs to, and whether it IS that item's page
 * (`aria-current="page"`) or sits under it (`aria-current="true"`).
 */
export function frameMatch(pathname: string): { key: FrameKey | null; exact: boolean } {
  const path = clean(pathname);
  const all = [...FRAME_NAV, ...FRAME_FOOT];
  const hit = all.find((item) => item.href === path);
  if (hit) return { key: hit.key, exact: true };
  const under = [...all.filter((i) => i.href !== "/app").map((i): [string, FrameKey] => [i.href, i.key]), ...ALSO]
    .filter(([href]) => path === href || path.startsWith(href + "/"))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return under ? { key: under[1], exact: false } : { key: null, exact: false };
}

/** The phone tab for this path: the orders sit under Quotes; Products and Settings have no tab. */
export function phoneTab(pathname: string): FrameKey | null {
  const { key } = frameMatch(pathname);
  if (key === "orders") return "rfqs";
  return PHONE_TABS.some((t) => t.key === key) ? key : null;
}

/** The phone top bar's title, as Paper's phone boards print it. The longest drawn prefix wins. */
const TITLES: readonly [string, string][] = [
  ["/app", "Search"],
  ["/app/discover", "Search"],
  ["/app/suppliers", "Search"],
  ["/app/saved", "Saved"],
  ["/app/searches", "Saved"],
  ["/app/messages", "Messages"],
  ["/app/rfqs", "Quotes"],
  ["/app/rfqs/new", "New RFQ"],
  ["/app/orders", "Quotes"],
  ["/app/orders/new", "New order"],
  ["/app/compliance", "Alerts"],
  ["/app/compliance/expiry", "Certificate expiry"],
  ["/app/compliance/uflpa", "UFLPA checks"],
  ["/app/compliance/msa", "Modern slavery statement"],
  ["/app/products", "Products"],
  ["/app/headings", "HS codes"],
  ["/app/settings", "Settings"],
  ["/app/settings/subscription", "Plan and usage"],
  ["/app/settings/members", "Team and roles"],
];

export function phoneTitle(pathname: string): string | null {
  const path = clean(pathname);
  const hit = TITLES.filter(([href]) => path === href || (href !== "/app" && path.startsWith(href + "/"))).sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? hit[1] : null;
}
