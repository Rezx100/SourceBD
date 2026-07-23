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
  Certificate,
  ChatCircleText,
  ClockCounterClockwise,
  Database,
  FileText,
  GearSix,
  Gauge,
  IdentificationBadge,
  MagnifyingGlass,
  Package,
  Prohibit,
  ShieldCheck,
  SignOut,
  Sparkle,
  Storefront,
  Tray,
  Users,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

import { UserAvatar } from "@/components/shell/user-avatar";
import { publicRoleLabel } from "@/lib/shell/role-label";
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
  adminQueue?: number;
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
    slots: [
      { label: "Overview", href: "/admin", Icon: Gauge },
      { label: "Beta analytics", href: "/admin/beta", Icon: Sparkle },
    ],
  },
  {
    label: "Moderation",
    slots: [
      { label: "Review queue", href: "/admin/queue", Icon: FileText, badgeKey: "adminQueue" },
      { label: "Suppliers", href: "/admin/suppliers", Icon: Storefront },
      { label: "User feedback", href: "/admin/feedback", Icon: ChatCircleText },
      { label: "Supplier claim review", href: "/admin/claims", Icon: IdentificationBadge, badgeKey: "adminClaims" },
      { label: "Certification review", href: "/admin/certifications", Icon: Certificate, badgeKey: "adminCerts" },
      { label: "Sanctions screening", href: "/admin/sanctions", Icon: Prohibit, badgeKey: "adminSanctions" },
    ],
  },
  {
    label: "Data",
    slots: [
      { label: "Sources & ingestion", href: "/admin/sources", Icon: Database },
      { label: "Audit log", href: "/admin/audit-log", Icon: ClockCounterClockwise },
    ],
  },
  {
    label: "Account",
    slots: [{ label: "Users & access", href: "/admin/users", Icon: Users }],
  },
];

export type ShellVariant = "buyer" | "supplier" | "admin";

export function variantFromPath(
  pathname: string,
  role?: Role | null,
): ShellVariant {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/supplier" || pathname.startsWith("/supplier/"))
    return "supplier";
  // Shared settings route — keep supplier/admin chrome for signed-in role.
  if (pathname.startsWith("/app/settings") && role === "supplier")
    return "supplier";
  if (pathname.startsWith("/app/settings") && role === "admin") return "admin";
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
    slot.badgeKey === "adminClaims" ||
    slot.badgeKey === "adminCerts" ||
    slot.badgeKey === "adminQueue";
  const kind: BadgeKind = alertKey || (queueKey && v > 0) ? "alert" : "neutral";
  const text = v >= 1000 ? v.toLocaleString("en-US") : String(v);
  void active;
  return { text, kind };
}

export type SidebarProps = {
  role: Role | null;
  email?: string | null;
  displayName?: string | null;
  /** Profile picture URL. Falls back to initials when absent. */
  avatarUrl?: string | null;
  planTier?: string | null;
  moatTotal?: number | null;
  moatRefreshedAt?: string | null;
  badges?: SidebarBadges;
};

export function Sidebar({
  role,
  email,
  displayName,
  avatarUrl,
  badges,
}: SidebarProps) {
  const pathname = usePathname() ?? "/app";
  const variant = variantFromPath(pathname, role);
  const sections = SECTIONS[variant];
  const isAdmin = role === "admin";

  const userRole = publicRoleLabel(role);
  const profileName =
    (displayName ?? "").trim() || email || (role ? "Account" : "Sign in");
  const profileSub = userRole;
  const settingsHref =
    variant === "admin" ? "/admin/users" : "/app/settings";

  const profileHeader = (
    <Link
      href={settingsHref}
      className="group flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors duration-150 ease-smooth hover:bg-[rgba(15,15,20,0.045)]"
      aria-label="Your profile and settings"
    >
      <UserAvatar
        avatarUrl={avatarUrl}
        displayName={displayName}
        email={email}
        size="lg"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-display text-[16px] font-bold tracking-[-0.01em] text-ink-primary">
          {profileName}
        </span>
        <span className="truncate text-[12px] text-ink-tertiary">{profileSub}</span>
      </span>
      <GearSix
        size={16}
        className="shrink-0 text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
    </Link>
  );

  const navBody = (
    <nav aria-label={`${VARIANT_LABEL[variant]} sections`} className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.label} className="flex flex-col gap-0.5">
          <p className="mb-1 px-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
            {section.label}
          </p>
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
                className={`group flex items-center gap-3 rounded-md px-2.5 py-[8px] text-[14px] transition-colors duration-150 ease-smooth ${
                  active
                    ? "bg-brand-forest-soft font-semibold text-brand-forest"
                    : "font-medium text-ink-secondary hover:bg-[rgba(15,15,20,0.045)] hover:text-ink-primary"
                }`}
              >
                <SlotIcon
                  size={18}
                  weight={active ? "fill" : "regular"}
                  aria-hidden
                  className={`shrink-0 ${active ? "text-brand-forest" : "text-ink-tertiary group-hover:text-ink-secondary"}`}
                />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {badge ? (
                  badge.kind === "dot" ? (
                    <span
                      aria-label="unread"
                      className="size-2 shrink-0 rounded-full bg-brand-forest"
                    />
                  ) : (
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[13px] font-semibold tabular-nums ${
                        badge.kind === "alert"
                          ? "bg-sem-red-soft text-sem-red"
                          : "bg-[rgba(15,15,20,0.06)] text-ink-tertiary"
                      }`}
                      aria-label={
                        slot.badgeKey === "compliance"
                          ? `${badge.text} saved-supplier compliance alerts`
                          : undefined
                      }
                      title={
                        slot.badgeKey === "compliance"
                          ? "Alerts across your saved suppliers — not this profile's compliance tab"
                          : undefined
                      }
                    >
                      {badge.text}
                    </span>
                  )
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const sessionActions = (
    <div className="mt-3 space-y-1 border-t border-hairline pt-3">
      {isAdmin ? (
        <div
          role="group"
          aria-label="Switch workspace"
          className="mb-1 flex items-center gap-1 rounded-lg border border-hairline bg-bg-l0 p-1"
        >
          {(["buyer", "supplier", "admin"] as const).map((v) => {
            const active = variant === v;
            return (
              <Link
                key={v}
                href={VARIANT_HREF[v]}
                aria-current={active ? "page" : undefined}
                className={`flex-1 rounded-md px-2 py-1 text-center text-[12px] font-semibold capitalize transition-colors duration-150 ease-smooth ${
                  active
                    ? "bg-surface-l1 text-brand-forest shadow-[0_1px_2px_rgba(15,15,20,0.08)]"
                    : "text-ink-tertiary hover:text-ink-primary"
                }`}
              >
                {v}
              </Link>
            );
          })}
        </div>
      ) : null}
      <form action="/auth/sign-out" method="post">
        <button
          type="submit"
          className="group flex w-full items-center gap-3 rounded-md px-2.5 py-[8px] text-[14px] font-medium text-ink-secondary transition-colors duration-150 ease-smooth hover:bg-sem-red-soft hover:text-sem-red"
        >
          <SignOut
            size={18}
            aria-hidden
            className="shrink-0 text-ink-tertiary group-hover:text-sem-red"
          />
          <span className="flex-1 text-left">Sign out</span>
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* R2: mobile disclosure removed — the topbar hamburger now opens
         the full sidebar via <MobileDrawer>. The aside below shifts one
         tier later (md→lg) so the tablet band hands off to <SidebarRail>. */}
      <aside
        aria-label={`${VARIANT_LABEL[variant]} navigation`}
        className="hidden bg-surface-l1 lg:sticky lg:top-14 lg:flex lg:h-[calc(100dvh-3.5rem)] lg:w-[268px] lg:shrink-0 lg:flex-col lg:gap-2 lg:overflow-y-auto lg:border-r lg:border-hairline lg:px-3 lg:pb-3 lg:pt-4"
      >
        {profileHeader}
        <div className="mt-2 flex-1">{navBody}</div>
        {sessionActions}
      </aside>
    </>
  );
}
