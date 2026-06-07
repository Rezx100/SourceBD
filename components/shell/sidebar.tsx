"use client";

// App-shell sidebar — strict port of `prototypes/profile-naafco-group.html`.
// Slot lists are locked by `context/frontend-design-spec.md` §2.
// Variant (`buyer` / `supplier` / `admin`) is chosen by the top-level path
// segment; real role-gating is enforced server-side by middleware + Spec F3
// auth. Badge counts are passed in from the (server) layout — see
// `app/(app)/layout.tsx`.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookmarkSimple,
  CaretUpDown,
  Certificate,
  ChatCircleText,
  ClockCounterClockwise,
  FileText,
  GearSix,
  Gauge,
  IdentificationBadge,
  MagnifyingGlass,
  Package,
  Prohibit,
  ShieldCheck,
  Sparkle,
  Storefront,
  Tray,
  Users,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

import type { Role } from "@/lib/auth";

type BadgeKind = "neutral" | "alert" | "dot";

export type SidebarBadges = {
  discover?: number;
  saved?: number;
  messages?: "dot" | number | null;
  rfqs?: number;
  orders?: number;
  compliance?: number;
  supplierClaims?: number;
  adminClaims?: number;
  adminCerts?: number;
  adminSanctions?: number;
};

export type Slot = {
  label: string;
  href: string;
  Icon: Icon;
  badgeKey?: keyof SidebarBadges;
};
export type Section = { label: string; slots: Slot[] };

export const BUYER_SECTIONS: Section[] = [
  {
    label: "Discover",
    slots: [
      { label: "Search suppliers", href: "/app/discover", Icon: MagnifyingGlass, badgeKey: "discover" },
      { label: "Find matches", href: "/app/match", Icon: Sparkle },
      { label: "Saved suppliers", href: "/app/saved", Icon: BookmarkSimple, badgeKey: "saved" },
    ],
  },
  {
    label: "Activity",
    slots: [
      { label: "Messages", href: "/app/messages", Icon: ChatCircleText, badgeKey: "messages" },
      { label: "RFQs", href: "/app/rfqs", Icon: FileText, badgeKey: "rfqs" },
      { label: "Orders", href: "/app/orders", Icon: Package, badgeKey: "orders" },
    ],
  },
  {
    label: "Compliance",
    slots: [
      { label: "Compliance", href: "/app/compliance", Icon: ShieldCheck, badgeKey: "compliance" },
    ],
  },
  {
    label: "Account",
    slots: [{ label: "Settings", href: "/app/settings", Icon: GearSix }],
  },
];

export const SUPPLIER_SECTIONS: Section[] = [
  {
    label: "Workspace",
    slots: [
      { label: "Dashboard", href: "/supplier", Icon: Gauge },
      { label: "Company profile", href: "/supplier/profile", Icon: Storefront, badgeKey: "supplierClaims" },
    ],
  },
  {
    label: "Activity",
    slots: [
      { label: "Messages", href: "/supplier/messages", Icon: ChatCircleText, badgeKey: "messages" },
      { label: "RFQs received", href: "/supplier/rfqs", Icon: Tray, badgeKey: "rfqs" },
      { label: "Partners", href: "/supplier/partners", Icon: UsersThree },
    ],
  },
  {
    label: "Documents",
    slots: [
      { label: "Documents", href: "/supplier/documents", Icon: FileText },
    ],
  },
  {
    label: "Account",
    slots: [
      { label: "Settings", href: "/app/settings", Icon: GearSix },
    ],
  },
];

export const ADMIN_SECTIONS: Section[] = [
  {
    label: "Overview",
    slots: [{ label: "Overview", href: "/admin", Icon: Gauge }],
  },
  {
    label: "Moderation",
    slots: [
      { label: "Suppliers", href: "/admin/suppliers", Icon: Storefront },
      { label: "Supplier claim review", href: "/admin/claims", Icon: IdentificationBadge, badgeKey: "adminClaims" },
      { label: "Certification review", href: "/admin/certifications", Icon: Certificate, badgeKey: "adminCerts" },
      { label: "Sanctions screening", href: "/admin/sanctions", Icon: Prohibit, badgeKey: "adminSanctions" },
    ],
  },
  {
    label: "Data",
    slots: [
      { label: "Audit log", href: "/admin/audit-log", Icon: ClockCounterClockwise },
    ],
  },
  {
    label: "Account",
    slots: [{ label: "Users & access", href: "/admin/users", Icon: Users }],
  },
];

export type ShellVariant = "buyer" | "supplier" | "admin";

export function variantFromPath(pathname: string): ShellVariant {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/supplier" || pathname.startsWith("/supplier/"))
    return "supplier";
  return "buyer";
}

export const VARIANT_LABEL: Record<ShellVariant, string> = {
  buyer: "Buyer workspace",
  supplier: "Supplier workspace",
  admin: "Admin console",
};

export const SECTIONS: Record<ShellVariant, Section[]> = {
  buyer: BUYER_SECTIONS,
  supplier: SUPPLIER_SECTIONS,
  admin: ADMIN_SECTIONS,
};

export const VARIANT_HREF: Record<ShellVariant, string> = {
  buyer: "/app",
  supplier: "/supplier",
  admin: "/admin",
};

function resolveBadge(
  slot: Slot,
  badges: SidebarBadges | undefined,
  active: boolean,
): { text: string; kind: BadgeKind } | null {
  if (!slot.badgeKey || !badges) return null;
  const v = badges[slot.badgeKey];
  if (v == null) return null;
  if (v === "dot") return { text: "", kind: "dot" };
  if (typeof v !== "number" || v <= 0) return null;
  // Compliance + sanctions render as red alert pills when present.
  const alertKey =
    slot.badgeKey === "compliance" || slot.badgeKey === "adminSanctions";
  // Slot.adminClaims / adminCerts get a soft alert tone when there's pending
  // review queue regardless of active state.
  const queueKey =
    slot.badgeKey === "adminClaims" || slot.badgeKey === "adminCerts";
  const kind: BadgeKind = alertKey || (queueKey && v > 0) ? "alert" : "neutral";
  const text = v >= 1000 ? v.toLocaleString("en-US") : String(v);
  void active;
  return { text, kind };
}

function relativeRefresh(iso: string | null | undefined): string {
  if (!iso) return "Refreshed daily";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "Refreshed daily";
  const diff = Math.max(0, Date.now() - then);
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Last refresh · just now";
  if (h < 24) return `Last refresh · ${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `Last refresh · ${d} day${d === 1 ? "" : "s"} ago`;
}

export type SidebarProps = {
  role: Role | null;
  email?: string | null;
  displayName?: string | null;
  planTier?: string | null;
  moatTotal?: number | null;
  moatRefreshedAt?: string | null;
  badges?: SidebarBadges;
};

export function Sidebar({
  role,
  email,
  displayName,
  planTier,
  moatTotal,
  moatRefreshedAt,
  badges,
}: SidebarProps) {
  const pathname = usePathname() ?? "/app";
  const variant = variantFromPath(pathname);
  const sections = SECTIONS[variant];
  const isAdmin = role === "admin";

  const initials = ((email ?? "??").split("@")[0] ?? "??")
    .slice(0, 2)
    .toUpperCase();
  const userName = (displayName ?? "").trim() || email || "Account";
  const userRole = role
    ? `${role[0]!.toUpperCase()}${role.slice(1)}`
    : "Guest";
  const planLabel = isAdmin
    ? "Admin · all access"
    : planTier
      ? `${planTier[0]!.toUpperCase()}${planTier.slice(1)} plan`
      : "Free plan";

  const wsCard = (
    <Link
      href={VARIANT_HREF[variant]}
      className="sidebar-ws"
      aria-label={`${VARIANT_LABEL[variant]} home`}
    >
      <span className="ws-mark" aria-hidden>
        SB
      </span>
      <span className="ws-text">
        <span className="ws-name">{VARIANT_LABEL[variant]}</span>
        <span className="ws-plan">{planLabel}</span>
      </span>
      <CaretUpDown className="ws-chev" aria-hidden weight="bold" />
    </Link>
  );

  const switcher = isAdmin ? (
    <div
      role="group"
      aria-label="Switch workspace"
      className="mt-1 mb-1 flex items-center gap-1 rounded-pill border border-hairline bg-bg-l0 p-1"
    >
      {(["buyer", "supplier", "admin"] as const).map((v) => {
        const active = variant === v;
        return (
          <Link
            key={v}
            href={VARIANT_HREF[v]}
            aria-current={active ? "page" : undefined}
            className={`flex-1 rounded-pill px-2 py-1 text-center text-[10px] font-semibold transition-colors duration-hover ease-smooth ${
              active
                ? "bg-brand-forest-tint text-ink-primary shadow-l1"
                : "text-ink-tertiary hover:bg-brand-forest-tint hover:text-ink-primary"
            }`}
          >
            {v}
          </Link>
        );
      })}
    </div>
  ) : null;

  const navBody = (
    <nav aria-label={`${VARIANT_LABEL[variant]} sections`} className="flex flex-col gap-0.5">
      {sections.map((section) => (
        <div key={section.label} className="flex flex-col gap-0.5">
          <p className="nav-section">{section.label}</p>
          {section.slots.map((slot) => {
            const { label, href, Icon: SlotIcon } = slot;
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            const badge = resolveBadge(slot, badges, active);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`proto-nav-item${active ? " active" : ""}`}
              >
                <SlotIcon
                  size={18}
                  weight={active ? "fill" : "regular"}
                  aria-hidden
                  className="ico"
                />
                <span className="nav-label">{label}</span>
                {badge ? (
                  <span
                    className={
                      badge.kind === "alert"
                        ? "nav-badge alert"
                        : badge.kind === "dot"
                          ? "nav-badge dot"
                          : "nav-badge"
                    }
                    aria-label={badge.kind === "dot" ? "unread" : undefined}
                  >
                    {badge.kind === "dot" ? "" : badge.text}
                  </span>
                ) : (
                  <span aria-hidden />
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="sidebar-bottom">
      <div className="sidebar-freshness" role="status" aria-label="Verified supplier directory">
        <div className="fresh-top">
          <span className="fresh-label">Verified suppliers</span>
          <span className="fresh-dot" aria-hidden />
        </div>
        <span className="fresh-count">
          {moatTotal != null
            ? `${moatTotal.toLocaleString("en-US")} verified`
            : "Verified factories"}
        </span>
        <span className="fresh-sub">{relativeRefresh(moatRefreshedAt)}</span>
      </div>
      <Link
        href={
          variant === "admin"
            ? "/admin/users"
            : "/app/settings"
        }
        className="sidebar-user"
        aria-label="Account menu"
      >
        <span className="user-avatar" aria-hidden>
          {initials}
        </span>
        <span className="user-text">
          <span className="user-name">{userName}</span>
          <span className="user-role">{userRole}</span>
        </span>
        <CaretUpDown className="user-chev" aria-hidden weight="bold" />
      </Link>
    </div>
  );

  return (
    <>
      {/* R2: mobile disclosure removed — the topbar hamburger now opens
         the full sidebar via <MobileDrawer>. The aside below shifts one
         tier later (md→lg) so the tablet band hands off to <SidebarRail>. */}
      <aside
        aria-label={`${VARIANT_LABEL[variant]} navigation`}
        className="proto-sidebar hidden lg:sticky lg:top-14 lg:flex lg:h-[calc(100vh-56px)] lg:w-[272px] lg:shrink-0 lg:flex-col lg:gap-0.5 lg:overflow-y-auto lg:border-r lg:border-hairline-strong lg:px-[14px] lg:pb-[14px] lg:pt-[18px]"
      >
        {wsCard}
        {switcher}
        <div className="mt-1 flex-1">{navBody}</div>
        {footer}
      </aside>
    </>
  );
}
