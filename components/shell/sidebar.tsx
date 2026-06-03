"use client";

// App-shell sidebar. Slot lists are locked by `context/frontend-design-spec.md` §2.
// FE-PROTO rewrite groups slots under prototype `.nav-section` labels and
// renders rows as `.proto-nav-item` to match prototypes/profile-naafco-group.html.
// Variant (`buyer` / `supplier` / `admin`) is chosen by the top-level path segment;
// real role-gating is enforced server-side by middleware + Spec F3 auth.

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
  Sparkle,
  Storefront,
  Tray,
  Users,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

type Slot = { label: string; href: string; Icon: Icon };
type Section = { label: string; slots: Slot[] };

const BUYER_SECTIONS: Section[] = [
  {
    label: "Sourcing",
    slots: [
      { label: "Discover", href: "/app/discover", Icon: MagnifyingGlass },
      { label: "Smart Match", href: "/app/match", Icon: Sparkle },
      { label: "Saved", href: "/app/saved", Icon: BookmarkSimple },
    ],
  },
  {
    label: "Engage",
    slots: [
      { label: "Messages", href: "/app/messages", Icon: ChatCircleText },
      { label: "RFQ Manager", href: "/app/rfqs", Icon: FileText },
      { label: "Orders", href: "/app/orders", Icon: Package },
    ],
  },
  {
    label: "Governance",
    slots: [
      { label: "Compliance Hub", href: "/app/compliance", Icon: ShieldCheck },
    ],
  },
  {
    label: "Account",
    slots: [{ label: "Settings", href: "/app/settings", Icon: GearSix }],
  },
];

const SUPPLIER_SECTIONS: Section[] = [
  {
    label: "Workspace",
    slots: [
      { label: "Dashboard", href: "/supplier", Icon: Gauge },
      { label: "Company profile", href: "/supplier/profile", Icon: Storefront },
    ],
  },
  {
    label: "Engage",
    slots: [
      { label: "Messages", href: "/supplier/messages", Icon: ChatCircleText },
      { label: "RFQs received", href: "/supplier/rfqs", Icon: Tray },
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
      { label: "Settings", href: "/supplier/settings", Icon: GearSix },
    ],
  },
];

const ADMIN_SECTIONS: Section[] = [
  {
    label: "Overview",
    slots: [{ label: "Overview", href: "/admin", Icon: Gauge }],
  },
  {
    label: "Moderation",
    slots: [
      { label: "Suppliers", href: "/admin/suppliers", Icon: Storefront },
      { label: "Supplier queue", href: "/admin/queue", Icon: Tray },
      {
        label: "Claim verification",
        href: "/admin/claims",
        Icon: IdentificationBadge,
      },
      {
        label: "Certification queue",
        href: "/admin/certifications",
        Icon: Certificate,
      },
      { label: "Sanctions queue", href: "/admin/sanctions", Icon: Prohibit },
    ],
  },
  {
    label: "Data",
    slots: [
      { label: "Sources & ingestion", href: "/admin/sources", Icon: Database },
      {
        label: "Audit log",
        href: "/admin/audit-log",
        Icon: ClockCounterClockwise,
      },
    ],
  },
  {
    label: "Governance",
    slots: [{ label: "Scoring", href: "/admin/scoring", Icon: ShieldCheck }],
  },
  {
    label: "Account",
    slots: [{ label: "Users & access", href: "/admin/users", Icon: Users }],
  },
];

export type ShellVariant = "buyer" | "supplier" | "admin";

function variantFromPath(pathname: string): ShellVariant {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/supplier" || pathname.startsWith("/supplier/"))
    return "supplier";
  return "buyer";
}

const VARIANT_LABEL: Record<ShellVariant, string> = {
  buyer: "Buyer workspace",
  supplier: "Supplier workspace",
  admin: "Admin console",
};

const SECTIONS: Record<ShellVariant, Section[]> = {
  buyer: BUYER_SECTIONS,
  supplier: SUPPLIER_SECTIONS,
  admin: ADMIN_SECTIONS,
};

export function Sidebar() {
  const pathname = usePathname() ?? "/app";
  const variant = variantFromPath(pathname);
  const sections = SECTIONS[variant];

  return (
    <aside
      aria-label={`${VARIANT_LABEL[variant]} navigation`}
      className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:gap-2 md:border-r md:border-hairline md:bg-surface-l1 md:px-3 md:py-4"
    >
      <div className="sidebar-ws">
        <div className="ws-mark" aria-hidden>
          SB
        </div>
        <div className="ws-text">
          <span className="ws-name">{VARIANT_LABEL[variant]}</span>
          <span className="ws-plan">Free plan</span>
        </div>
      </div>

      <nav className="flex flex-col gap-3">
        {sections.map((section) => (
          <div key={section.label} className="flex flex-col gap-0.5">
            <p className="nav-section">{section.label}</p>
            {section.slots.map(({ label, href, Icon: SlotIcon }) => {
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`proto-nav-item${active ? " active" : ""}`}
                >
                  <SlotIcon
                    size={16}
                    weight={active ? "fill" : "regular"}
                    aria-hidden
                  />
                  <span className="nav-label">{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3 pt-4">
        <div className="sidebar-freshness">
          <span className="fresh-label">Data moat</span>
          <span className="fresh-count">10,742</span>
          <span className="fresh-sub">verified factories · refreshed daily</span>
        </div>
      </div>
    </aside>
  );
}
