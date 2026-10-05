// The navigation of the two portals that are not the buyer app: admin (`/admin`) and the supplier portal
// (`/supplier`), B10. A plain module with no React, like `lib/frame-nav.ts`: the sidebar, the phone menu and the
// page title read the URL on the client and ask this one place which item is current, so they cannot disagree.
// The items are the ones the old shell listed; the supplier's "Settings" is not here because it pointed at
// `/app/settings`, which a supplier is redirected away from.

export type PortalRole = "admin" | "supplier";
export type PortalIconKey =
  | "gauge"
  | "sparkle"
  | "queue"
  | "store"
  | "chat"
  | "badge"
  | "certificate"
  | "prohibit"
  | "database"
  | "magnify"
  | "history"
  | "users"
  | "tray"
  | "partners"
  | "file";
export type PortalBadgeKey = "adminQueue" | "adminClaims" | "adminCerts" | "adminSanctions";
export type PortalItem = { key: string; label: string; href: string; icon: PortalIconKey; badge?: PortalBadgeKey };
export type PortalGroup = { label: string; items: readonly PortalItem[] };

export const PORTAL_HOME: Record<PortalRole, string> = { admin: "/admin", supplier: "/supplier" };
export const PORTAL_NAME: Record<PortalRole, string> = { admin: "Admin", supplier: "Supplier portal" };

export const PORTAL_NAV: Record<PortalRole, readonly PortalGroup[]> = {
  admin: [
    {
      label: "Overview",
      items: [
        { key: "overview", label: "Overview", href: "/admin", icon: "gauge" },
        { key: "beta", label: "Beta analytics", href: "/admin/beta", icon: "sparkle" },
      ],
    },
    {
      label: "Moderation",
      items: [
        { key: "queue", label: "Review queue", href: "/admin/queue", icon: "queue", badge: "adminQueue" },
        { key: "suppliers", label: "Suppliers", href: "/admin/suppliers", icon: "store" },
        { key: "feedback", label: "User feedback", href: "/admin/feedback", icon: "chat" },
        { key: "claims", label: "Supplier claim review", href: "/admin/claims", icon: "badge", badge: "adminClaims" },
        { key: "certifications", label: "Certification review", href: "/admin/certifications", icon: "certificate", badge: "adminCerts" },
        { key: "sanctions", label: "Sanctions screening", href: "/admin/sanctions", icon: "prohibit", badge: "adminSanctions" },
      ],
    },
    {
      label: "Data",
      items: [
        { key: "sources", label: "Sources and ingestion", href: "/admin/sources", icon: "database" },
        { key: "evidence", label: "Citation health", href: "/admin/evidence", icon: "magnify" },
        { key: "audit", label: "Audit log", href: "/admin/audit-log", icon: "history" },
      ],
    },
    { label: "Account", items: [{ key: "users", label: "Users and access", href: "/admin/users", icon: "users" }] },
  ],
  supplier: [
    {
      label: "Workspace",
      items: [
        { key: "home", label: "Dashboard", href: "/supplier", icon: "gauge" },
        { key: "profile", label: "Company profile", href: "/supplier/profile", icon: "store" },
      ],
    },
    {
      label: "Activity",
      items: [
        { key: "messages", label: "Messages", href: "/supplier/messages", icon: "chat" },
        { key: "rfqs", label: "RFQs received", href: "/supplier/rfqs", icon: "tray" },
        { key: "partners", label: "Partners", href: "/supplier/partners", icon: "partners" },
      ],
    },
    { label: "Documents", items: [{ key: "documents", label: "Documents", href: "/supplier/documents", icon: "file" }] },
  ],
};

/** `/admin/users/123?x=1#y` as `/admin/users/123`. */
function clean(pathname: string): string {
  return pathname.replace(/[?#].*$/, "").replace(/(.)\/+$/, "$1");
}

/** Which portal a path belongs to; the supplier's claim pages and everything else under `/supplier` are the supplier's. */
export function portalOf(pathname: string): PortalRole {
  const p = clean(pathname);
  return p === "/admin" || p.startsWith("/admin/") ? "admin" : "supplier";
}

const all = (role: PortalRole): PortalItem[] => PORTAL_NAV[role].flatMap((g) => g.items);

/**
 * The item this path belongs to, and whether it IS that item's page (`aria-current="page"`) or sits under it
 * (`aria-current="true"`). The two home pages match only themselves, so Overview is not lit on every admin page.
 */
export function portalMatch(role: PortalRole, pathname: string): { key: string | null; exact: boolean } {
  const path = clean(pathname);
  const items = all(role);
  const hit = items.find((i) => i.href === path);
  if (hit) return { key: hit.key, exact: true };
  const under = items
    .filter((i) => i.href !== PORTAL_HOME[role] && (path === i.href || path.startsWith(i.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return under ? { key: under.key, exact: false } : { key: null, exact: false };
}

/** The phone top bar's title: the matched item's name; the claim pages, which have no item, say "Claim your company". */
export function portalTitle(role: PortalRole, pathname: string): string | null {
  const { key } = portalMatch(role, pathname);
  const item = all(role).find((i) => i.key === key);
  if (item) return item.label;
  return clean(pathname).startsWith("/supplier/claim") ? "Claim your company" : null;
}
