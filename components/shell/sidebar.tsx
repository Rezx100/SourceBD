"use client";

// App-shell sidebar. Slot lists are locked by `context/frontend-design-spec.md` §2.
// Variant (`buyer` / `supplier` / `admin`) is chosen by the top-level path segment;
// pages within each surface inherit the matching nav. Real role-gating (buyers
// can't see admin nav etc.) is enforced server-side by middleware + Spec F3 auth.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookmarkSimple,
  Certificate,
  ChatCircleText,
  Database,
  FileText,
  GearSix,
  Gauge,
  IdentificationBadge,
  MagnifyingGlass,
  Package,
  ShieldCheck,
  Sparkle,
  Storefront,
  Tray,
  Users,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Slot = { label: string; href: string; Icon: Icon };

const BUYER_SLOTS: Slot[] = [
  { label: "Discover", href: "/app/discover", Icon: MagnifyingGlass },
  { label: "Smart Match", href: "/app/match", Icon: Sparkle },
  { label: "Saved", href: "/app/saved", Icon: BookmarkSimple },
  { label: "Messages", href: "/app/messages", Icon: ChatCircleText },
  { label: "RFQ Manager", href: "/app/rfqs", Icon: FileText },
  { label: "Orders", href: "/app/orders", Icon: Package },
  { label: "Compliance Hub", href: "/app/compliance", Icon: ShieldCheck },
  { label: "Settings", href: "/app/settings", Icon: GearSix },
];

const SUPPLIER_SLOTS: Slot[] = [
  { label: "Dashboard", href: "/supplier", Icon: Gauge },
  { label: "Company profile", href: "/supplier/profile", Icon: Storefront },
  { label: "Messages", href: "/supplier/messages", Icon: ChatCircleText },
  { label: "RFQs received", href: "/supplier/rfqs", Icon: Tray },
  { label: "Partners", href: "/supplier/partners", Icon: UsersThree },
  { label: "Documents", href: "/supplier/documents", Icon: FileText },
  { label: "Settings", href: "/supplier/settings", Icon: GearSix },
];

const ADMIN_SLOTS: Slot[] = [
  { label: "Overview", href: "/admin", Icon: Gauge },
  { label: "Suppliers", href: "/admin/suppliers", Icon: Storefront },
  { label: "Supplier queue", href: "/admin/queue", Icon: Tray },
  { label: "Claim verification", href: "/admin/claims", Icon: IdentificationBadge },
  { label: "Certification queue", href: "/admin/certifications", Icon: Certificate },
  { label: "Sources & ingestion", href: "/admin/sources", Icon: Database },
  { label: "Scoring", href: "/admin/scoring", Icon: ShieldCheck },
  { label: "Users & access", href: "/admin/users", Icon: Users },
];

export type ShellVariant = "buyer" | "supplier" | "admin";

function variantFromPath(pathname: string): ShellVariant {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/supplier" || pathname.startsWith("/supplier/")) return "supplier";
  return "buyer";
}

const VARIANT_LABEL: Record<ShellVariant, string> = {
  buyer: "Buyer",
  supplier: "Supplier",
  admin: "Admin",
};

const SLOTS: Record<ShellVariant, Slot[]> = {
  buyer: BUYER_SLOTS,
  supplier: SUPPLIER_SLOTS,
  admin: ADMIN_SLOTS,
};

export function Sidebar() {
  const pathname = usePathname() ?? "/app";
  const variant = variantFromPath(pathname);
  const slots = SLOTS[variant];

  return (
    <aside
      aria-label={`${VARIANT_LABEL[variant]} navigation`}
      className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-hairline md:bg-surface-l1 md:px-3 md:py-5 md:shadow-l1"
    >
      <p className="px-2 pb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
        {VARIANT_LABEL[variant]}
      </p>
      <nav className="flex flex-col gap-0.5">
        {slots.map(({ label, href, Icon: SlotIcon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-2.5 rounded-pill px-2.5 py-2 text-[13px] font-medium",
                "transition-[background-color,color,box-shadow] duration-hover ease-smooth",
                "text-ink-secondary hover:bg-brand-forest-tint hover:text-ink-primary",
                active && "bg-brand-forest-tint text-ink-primary",
              )}
            >
              <SlotIcon
                size={16}
                weight={active ? "fill" : "regular"}
                aria-hidden
                className={cn(active ? "text-accent-indigo" : "text-ink-tertiary group-hover:text-ink-secondary")}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
